import fitz  # PyMuPDF
from llama_cpp import Llama
import os
import textwrap

# ─────────────────────────────────────────────
# 1. LOAD MODEL ONCE (Warm Start for CPU)
# ─────────────────────────────────────────────
llm = Llama(
    model_path="models/Mini-mistral.Q4_K_M.gguf",
    n_ctx=2048,
    n_threads=4,
    verbose=False
)

# How many characters fit safely in one LLM call (leave room for prompt overhead)
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200  # overlap so context doesn't get cut mid-sentence


# ─────────────────────────────────────────────
# 2. FILE EXTRACTION
# ─────────────────────────────────────────────
def extract_text(file_path):
    """Extracts text from PDF or TXT files."""
    if not os.path.exists(file_path):
        return None
    if file_path.endswith('.pdf'):
        doc = fitz.open(file_path)
        return "".join(page.get_text() for page in doc)
    elif file_path.endswith('.txt'):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    return None


# ─────────────────────────────────────────────
# 3. CHUNKING  (fixes the context-loss problem)
# ─────────────────────────────────────────────
def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """
    Splits text into overlapping chunks so the model never loses
    context at chunk boundaries.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap   # slide forward with overlap
    return chunks


# ─────────────────────────────────────────────
# 4. SUMMARISE EACH CHUNK, THEN MERGE
# ─────────────────────────────────────────────
def summarise_chunk(chunk, chunk_num, total):
    """Asks the model to summarise a single chunk."""
    prompt = f"""### Instruction:
Summarise the following text in 3-5 concise bullet points. Focus on key facts and ideas.

### Text:
{chunk}

### Summary:"""
    print(f"  Summarising chunk {chunk_num}/{total}...", end="\r")
    resp = llm(prompt, max_tokens=200, stop=["###"], temperature=0.1)
    return resp['choices'][0]['text'].strip()


def build_summary(text):
    """
    Summarises the full document by chunking it and merging
    per-chunk summaries into one final summary.
    """
    chunks = chunk_text(text)
    total = len(chunks)

    if total == 1:
        # Short doc — summarise directly
        return summarise_chunk(chunks[0], 1, 1), chunks

    # Summarise each chunk
    partial_summaries = []
    for i, chunk in enumerate(chunks, 1):
        s = summarise_chunk(chunk, i, total)
        partial_summaries.append(s)

    print()  # newline after \r progress

    # Merge all partial summaries into one final summary
    merged = "\n\n".join(partial_summaries)
    merge_prompt = f"""### Instruction:
Below are partial summaries of a larger document. Combine them into one coherent summary of 5-8 bullet points. Remove duplicates.

### Partial Summaries:
{merged[:2000]}

### Final Summary:"""
    resp = llm(merge_prompt, max_tokens=300, stop=["###"], temperature=0.1)
    return resp['choices'][0]['text'].strip(), chunks


# ─────────────────────────────────────────────
# 5. CONTEXT-AWARE Q&A
# ─────────────────────────────────────────────
def find_relevant_chunks(query, chunks, top_n=2):
    """
    Keyword relevance scoring. Also returns the best score
    so we can detect totally off-topic queries.
    """
    STOPWORDS = {"what", "is", "the", "who", "a", "an", "in", "of", "to", "and"}
    query_words = set(word for word in query.lower().split() if word not in STOPWORDS)
    
    scored = []
    for i, chunk in enumerate(chunks):
        chunk_words = set(chunk.lower().split())
        score = len(query_words & chunk_words)
        scored.append((score, i, chunk))
    scored.sort(reverse=True)
    best_score = scored[0][0] if scored else 0
    best = [c for _, _, c in scored[:top_n]]
    return "\n\n---\n\n".join(best), best_score


def get_ai_response(query, chunks, summary):
    """
    Builds context from the most relevant chunks + the summary,
    then queries the model with a strict grounding prompt.
    """
    relevant, best_score = find_relevant_chunks(query, chunks)

    # If zero keyword overlap, the question is almost certainly off-topic
    if best_score == 0:
        return "I don't know based on the provided document."

    context = f"[Document Summary]\n{summary}\n\n[Relevant Sections]\n{relevant}"

    prompt = f"""### Instruction:
You are a document assistant. You ONLY answer using the context provided below.
You must NOT use any outside knowledge or make up information.
If the answer cannot be found in the context, you MUST respond with exactly:
"I don't know based on the provided document."

### Context:
{context[:2800]}

### Question:
{query}

### Answer (based only on the context above):"""

    resp = llm(prompt, max_tokens=200, stop=["###"], temperature=0.0)
    answer = resp['choices'][0]['text'].strip()

    # Post-process: if the model ignored instructions and went off-topic,
    # catch it by checking if ANY word from the answer appears in the context
    answer_words = set(answer.lower().split())
    context_words = set(context.lower().split())
    overlap = len(answer_words & context_words)
    if overlap < 5:
        return "I don't know based on the provided document."

    return answer


# ─────────────────────────────────────────────
# 6. GENERAL CHAT (no document required)
# ─────────────────────────────────────────────
def general_chat(query):
    """Answer a question using the model's own knowledge (no document)."""
    prompt = f"""### Instruction:
You are a helpful AI assistant. Answer the user's question clearly and concisely.

### Question:
{query}

### Answer:"""
    resp = llm(prompt, max_tokens=300, stop=["###"], temperature=0.3)
    return resp['choices'][0]['text'].strip()


# ─────────────────────────────────────────────
# 7. MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "="*40)
    print("   OFFLINE AI ASSISTANT  (CPU)")
    print("="*40)
    print("  Start chatting right away!")
    print("  Commands:")
    print("    /load <filepath>  — Load a PDF/TXT for document Q&A")
    print("    /summary          — Show summary of loaded document")
    print("    /clear            — Unload current document")
    print("    exit / quit       — Quit")
    print("="*40 + "\n")

    # State — stays None until user loads a document
    chunks = None
    summary = None

    while True:
        user_input = input("You: ").strip()
        if not user_input:
            continue
        if user_input.lower() in ('exit', 'quit'):
            print("Goodbye!")
            break

        # ── /load command ──────────────────────
        if user_input.lower().startswith("/load"):
            path = user_input[5:].strip()
            if not path:
                print("[!] Usage: /load <filepath>\n")
                continue
            raw_text = extract_text(path)
            if not raw_text:
                print("[✗] File not found or unsupported format.\n")
                continue
            print(f"[✓] Loaded {len(raw_text):,} characters.")
            print("[*] Building summary — please wait...\n")
            summary, chunks = build_summary(raw_text)
            print("\n" + "-"*40)
            print("  DOCUMENT SUMMARY")
            print("-"*40)
            for line in summary.splitlines():
                if line.strip():
                    print(textwrap.fill(line.strip(), width=72,
                                        subsequent_indent="    "))
            print("-"*40)
            print(f"[✓] {len(chunks)} chunk(s) ready. "
                  "Ask questions about the document!\n")
            continue

        # ── /summary command ───────────────────
        if user_input.lower() == "/summary":
            if summary:
                print("\n" + "-"*40)
                for line in summary.splitlines():
                    if line.strip():
                        print(textwrap.fill(line.strip(), width=72,
                                            subsequent_indent="    "))
                print("-"*40 + "\n")
            else:
                print("[!] No document loaded. Use /load <filepath> first.\n")
            continue

        # ── /clear command ─────────────────────
        if user_input.lower() == "/clear":
            chunks = None
            summary = None
            print("[✓] Document cleared. Back to general chat.\n")
            continue

        # ── Answer: document-aware or general ──
        if chunks and summary:
            answer = get_ai_response(user_input, chunks, summary)
        else:
            answer = general_chat(user_input)

        print(f"\nAI: {answer}\n")