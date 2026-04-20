"""
Flask backend for the Offline AI Assistant.
Wraps the existing summarizer logic into a REST API.
"""
import os
import tempfile
import psutil
from flask import Flask, request, jsonify, send_from_directory

try:
    import GPUtil
    HAS_GPU = True
except Exception:
    HAS_GPU = False
from werkzeug.utils import secure_filename

# ── Import from the existing summarizer ──────────────────────
from summarizer import (
    llm, extract_text, build_summary,
    get_ai_response, general_chat
)

app = Flask(__name__, static_folder="frontend", static_url_path="")

# ── Shared state ─────────────────────────────────────────────
state = {
    "chunks": None,
    "summary": None,
    "doc_name": None,
}

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ── Serve the frontend ───────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")


# ── Chat endpoint ────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    query = data.get("message", "").strip()
    if not query:
        return jsonify({"error": "Empty message"}), 400

    if state["chunks"] and state["summary"]:
        answer = get_ai_response(query, state["chunks"], state["summary"])
    else:
        answer = general_chat(query)

    return jsonify({"reply": answer})


# ── Upload document endpoint ─────────────────────────────────
@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    if not (filename.endswith(".pdf") or filename.endswith(".txt")):
        return jsonify({"error": "Only PDF and TXT files are supported"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    raw_text = extract_text(filepath)
    if not raw_text:
        return jsonify({"error": "Could not extract text from file"}), 400

    summary, chunks = build_summary(raw_text)
    state["chunks"] = chunks
    state["summary"] = summary
    state["doc_name"] = filename

    return jsonify({
        "message": f"Loaded {filename} ({len(raw_text):,} chars, {len(chunks)} chunks)",
        "summary": summary,
        "doc_name": filename,
    })


# ── Summary endpoint ─────────────────────────────────────────
@app.route("/api/summary", methods=["GET"])
def summary():
    if state["summary"]:
        return jsonify({
            "summary": state["summary"],
            "doc_name": state["doc_name"],
        })
    return jsonify({"error": "No document loaded"}), 404


# ── Clear document endpoint ──────────────────────────────────
@app.route("/api/clear", methods=["POST"])
def clear():
    state["chunks"] = None
    state["summary"] = None
    state["doc_name"] = None
    return jsonify({"message": "Document cleared. Back to general chat."})


# ── Status endpoint ──────────────────────────────────────────
@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "doc_loaded": state["doc_name"] is not None,
        "doc_name": state["doc_name"],
    })


# ── System stats endpoint ────────────────────────────────────
@app.route("/api/stats", methods=["GET"])
def system_stats():
    mem = psutil.virtual_memory()
    result = {
        "cpu_percent": psutil.cpu_percent(interval=0.3),
        "ram_percent": mem.percent,
        "ram_used_gb": round(mem.used / (1024**3), 1),
        "ram_total_gb": round(mem.total / (1024**3), 1),
    }
    if HAS_GPU:
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                g = gpus[0]
                result["gpu_name"] = g.name
                result["gpu_load"] = round(g.load * 100, 1)
                result["gpu_mem_used"] = round(g.memoryUsed)
                result["gpu_mem_total"] = round(g.memoryTotal)
                result["gpu_temp"] = g.temperature
        except Exception:
            pass
    return jsonify(result)


if __name__ == "__main__":
    print("\n  >> Starting Offline AI Assistant -- open http://localhost:5000\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
