/* ══════════════════════════════════════════════
   Offline AI Assistant — Frontend Logic
   ══════════════════════════════════════════════ */

const API = "";

// ── DOM Elements ────────────────────────────────
const chatMessages   = document.getElementById("chatMessages");
const messageInput   = document.getElementById("messageInput");
const sendBtn        = document.getElementById("sendBtn");
const welcomeScreen  = document.getElementById("welcomeScreen");
const sidebar        = document.getElementById("sidebar");
const sidebarToggle  = document.getElementById("sidebarToggle");
const menuBtn        = document.getElementById("menuBtn");
const uploadZone     = document.getElementById("uploadZone");
const fileInput      = document.getElementById("fileInput");
const docInfo        = document.getElementById("docInfo");
const docName        = document.getElementById("docName");
const docMeta        = document.getElementById("docMeta");
const clearDoc       = document.getElementById("clearDoc");
const showSummary    = document.getElementById("showSummary");
const summaryModal   = document.getElementById("summaryModal");
const summaryContent = document.getElementById("summaryContent");
const closeModal     = document.getElementById("closeModal");
const statusCard     = document.getElementById("statusCard");
const statusLabel    = statusCard.querySelector(".status-label");
const statusDetail   = statusCard.querySelector(".status-detail");
const headerSubtitle = document.getElementById("headerSubtitle");
const connectionBadge = document.getElementById("connectionBadge");
const quickUpload    = document.getElementById("quickUpload");

let isWaiting = false;


// ══════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════
sidebarToggle.addEventListener("click", () => {
    sidebar.classList.add("collapsed");
});

menuBtn.addEventListener("click", () => {
    // Mobile: toggle open class, Desktop: remove collapsed
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle("open");
    } else {
        sidebar.classList.remove("collapsed");
    }
});

// Close mobile sidebar when clicking outside
document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains("open")) {
        if (!sidebar.contains(e.target) && e.target !== menuBtn) {
            sidebar.classList.remove("open");
        }
    }
});


// ══════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════

// Auto-resize textarea
messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
    sendBtn.disabled = !messageInput.value.trim();
});

// Enter to send
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled && !isWaiting) sendMessage();
    }
});

sendBtn.addEventListener("click", () => {
    if (!isWaiting) sendMessage();
});

// Quick-action buttons
document.querySelectorAll(".quick-btn[data-prompt]").forEach(btn => {
    btn.addEventListener("click", () => {
        messageInput.value = btn.dataset.prompt;
        sendBtn.disabled = false;
        sendMessage();
    });
});

quickUpload.addEventListener("click", () => fileInput.click());


function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    // Hide welcome
    if (welcomeScreen) welcomeScreen.remove();

    appendMessage("user", text);
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendBtn.disabled = true;

    showTyping();
    isWaiting = true;

    fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
    })
    .then(res => res.json())
    .then(data => {
        hideTyping();
        isWaiting = false;
        appendMessage("ai", data.reply || data.error || "No response.");
    })
    .catch(err => {
        hideTyping();
        isWaiting = false;
        appendMessage("ai", "⚠ Connection error. Is the server running?");
        console.error(err);
    });
}


function appendMessage(role, text) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";

    if (role === "ai") {
        avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>`;
    } else if (role === "user") {
        avatar.textContent = "U";
    }

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;

    if (role === "system") {
        wrapper.appendChild(content);
    } else {
        wrapper.appendChild(avatar);
        wrapper.appendChild(content);
    }

    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ── Typing indicator ────────────────────────────
let typingEl = null;

function showTyping() {
    typingEl = document.createElement("div");
    typingEl.className = "message ai";
    typingEl.id = "typingIndicator";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;

    const dots = document.createElement("div");
    dots.className = "message-content typing-indicator";
    dots.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;

    typingEl.appendChild(avatar);
    typingEl.appendChild(dots);
    chatMessages.appendChild(typingEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
    const el = document.getElementById("typingIndicator");
    if (el) el.remove();
}


// ══════════════════════════════════════════════
// FILE UPLOAD
// ══════════════════════════════════════════════

uploadZone.addEventListener("click", () => fileInput.click());

uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    if (e.dataTransfer.files.length) {
        handleUpload(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
        handleUpload(fileInput.files[0]);
        fileInput.value = "";
    }
});

function handleUpload(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "txt"].includes(ext)) {
        appendMessage("system", "⚠ Only PDF and TXT files are supported.");
        return;
    }

    // Hide welcome
    if (welcomeScreen) welcomeScreen.remove();

    appendMessage("system", `📄 Uploading "${file.name}"… building summary, please wait.`);
    isWaiting = true;

    const formData = new FormData();
    formData.append("file", file);

    fetch(`${API}/api/upload`, {
        method: "POST",
        body: formData,
    })
    .then(res => res.json())
    .then(data => {
        isWaiting = false;
        if (data.error) {
            appendMessage("system", `⚠ ${data.error}`);
            return;
        }
        setDocLoaded(data.doc_name, data.message, data.summary);
        appendMessage("system", `✅ ${data.message}. Ask questions about the document!`);
    })
    .catch(err => {
        isWaiting = false;
        appendMessage("system", "⚠ Upload failed. Is the server running?");
        console.error(err);
    });
}


function setDocLoaded(name, meta, summary) {
    uploadZone.style.display = "none";
    docInfo.style.display = "block";
    docName.textContent = name;
    docMeta.textContent = meta;

    statusCard.classList.add("doc-loaded");
    statusLabel.textContent = "Document Q&A";
    statusDetail.textContent = name;
    headerSubtitle.textContent = `Document: ${name}`;

    // Store summary for modal
    summaryContent.textContent = summary;
}


// ── Clear Document ──────────────────────────────
clearDoc.addEventListener("click", () => {
    fetch(`${API}/api/clear`, { method: "POST" })
    .then(res => res.json())
    .then(data => {
        uploadZone.style.display = "block";
        docInfo.style.display = "none";
        statusCard.classList.remove("doc-loaded");
        statusLabel.textContent = "General Chat";
        statusDetail.textContent = "No document loaded";
        headerSubtitle.textContent = "General Chat Mode";
        appendMessage("system", "🗑️ Document cleared. Back to general chat.");
    });
});


// ── Summary Modal ───────────────────────────────
showSummary.addEventListener("click", () => {
    summaryModal.style.display = "flex";
});

closeModal.addEventListener("click", () => {
    summaryModal.style.display = "none";
});

summaryModal.addEventListener("click", (e) => {
    if (e.target === summaryModal) summaryModal.style.display = "none";
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && summaryModal.style.display === "flex") {
        summaryModal.style.display = "none";
    }
});


// ══════════════════════════════════════════════
// INIT — check server status
// ══════════════════════════════════════════════
fetch(`${API}/api/status`)
    .then(res => res.json())
    .then(data => {
        connectionBadge.querySelector("span:last-child").textContent = "Connected";
        if (data.doc_loaded) {
            fetch(`${API}/api/summary`)
            .then(r => r.json())
            .then(s => setDocLoaded(s.doc_name, "", s.summary));
        }
    })
    .catch(() => {
        connectionBadge.querySelector("span:last-child").textContent = "Offline";
        connectionBadge.style.borderColor = "rgba(248, 113, 113, 0.15)";
        connectionBadge.style.background = "rgba(248, 113, 113, 0.08)";
        connectionBadge.style.color = "var(--error)";
        connectionBadge.querySelector(".conn-dot").style.background = "var(--error)";
    });


// ══════════════════════════════════════════════
// SYSTEM MONITOR
// ══════════════════════════════════════════════
const sysToggle = document.getElementById("sysMonitorToggle");
const sysPanel  = document.getElementById("sysMonitorPanel");
const cpuVal    = document.getElementById("cpuVal");
const cpuDetail = document.getElementById("cpuDetail");
const cpuRing   = document.querySelector(".cpu-ring");
const ramVal    = document.getElementById("ramVal");
const ramDetail = document.getElementById("ramDetail");
const ramRing   = document.querySelector(".ram-ring");
const gpuStat   = document.getElementById("gpuStat");
const gpuVal    = document.getElementById("gpuVal");
const gpuDetail = document.getElementById("gpuDetail");
const gpuRing   = document.querySelector(".gpu-ring");

const CIRCUMFERENCE = 113.1; // 2 * PI * 18
let statsInterval = null;

sysToggle.addEventListener("click", () => {
    const isOpen = sysPanel.classList.toggle("open");
    sysToggle.classList.toggle("active", isOpen);

    if (isOpen) {
        fetchStats();            // immediate first fetch
        statsInterval = setInterval(fetchStats, 2000);
    } else {
        clearInterval(statsInterval);
        statsInterval = null;
    }
});

function setRing(ringEl, percent) {
    const offset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(percent, 100) / 100);
    ringEl.style.strokeDashoffset = offset;

    // Color thresholds
    ringEl.classList.remove("high", "critical");
    if (percent >= 90) {
        ringEl.classList.add("critical");
    } else if (percent >= 70) {
        ringEl.classList.add("high");
    }
}

function fetchStats() {
    fetch(`${API}/api/stats`)
    .then(res => res.json())
    .then(data => {
        // CPU
        const cpu = Math.round(data.cpu_percent || 0);
        cpuVal.textContent = cpu + "%";
        cpuDetail.textContent = `Usage: ${cpu}%`;
        setRing(cpuRing, cpu);

        // RAM
        const ram = Math.round(data.ram_percent || 0);
        ramVal.textContent = ram + "%";
        ramDetail.textContent = `${data.ram_used_gb || 0}/${data.ram_total_gb || 0} GB`;
        setRing(ramRing, ram);

        // GPU (only if server reports it)
        if (data.gpu_load !== undefined) {
            gpuStat.style.display = "flex";
            const gpu = Math.round(data.gpu_load);
            gpuVal.textContent = gpu + "%";
            const temp = data.gpu_temp ? ` ${data.gpu_temp}°C` : "";
            gpuDetail.textContent = `${data.gpu_mem_used}/${data.gpu_mem_total} MB${temp}`;
            setRing(gpuRing, gpu);
        }
    })
    .catch(() => {
        // silently skip on error   
    });
}

