const DEFAULT_EXTENSIONS = [
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
    "iso", "img", "vhd", "bin",
    "exe", "msi", "apk", "appx", "dmg",
    "mp4", "mkv", "avi", "mov", "flv", "wmv", "webm",
    "mp3", "wav", "flac", "aac", "ogg", "m4a",
    "pdf", "docx", "xlsx", "pptx"
];

const SERVER_URL = "http://127.0.0.1:8989";

document.addEventListener("DOMContentLoaded", () => {
    const toggleEnable = document.getElementById("toggle-enable");
    const toggleAutoStart = document.getElementById("toggle-autostart");
    const statusWrap = document.getElementById("connection-status");
    const statusText = document.getElementById("status-text");
    const tagsContainer = document.getElementById("ext-tags");
    const inputNewExt = document.getElementById("input-new-ext");
    const btnAddExt = document.getElementById("btn-add-ext");
    const btnResetExts = document.getElementById("btn-reset-exts");
    const btnPing = document.getElementById("btn-ping-test");

    let currentExtensions = [...DEFAULT_EXTENSIONS];

    // Load initial settings
    chrome.storage.sync.get(["enabled", "autoStart", "extensions"], (res) => {
        toggleEnable.checked = res.enabled !== false;
        toggleAutoStart.checked = res.autoStart === true;
        if (Array.isArray(res.extensions)) {
            currentExtensions = res.extensions;
        }
        renderTags();
    });

    // Check server status
    checkConnection();

    // Toggle Enable
    toggleEnable.addEventListener("change", () => {
        chrome.storage.sync.set({ enabled: toggleEnable.checked });
    });

    // Toggle AutoStart
    toggleAutoStart.addEventListener("change", () => {
        chrome.storage.sync.set({ autoStart: toggleAutoStart.checked });
    });

    // Ping Button
    btnPing.addEventListener("click", () => {
        btnPing.style.opacity = "0.7";
        checkConnection().then(() => {
            btnPing.style.opacity = "1";
        });
    });

    // Add Extension
    function addExtension() {
        const val = (inputNewExt.value || "").trim().toLowerCase().replace(/^\./, "");
        if (val && !currentExtensions.includes(val)) {
            currentExtensions.push(val);
            chrome.storage.sync.set({ extensions: currentExtensions });
            renderTags();
            inputNewExt.value = "";
        }
    }

    btnAddExt.addEventListener("click", addExtension);
    inputNewExt.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addExtension();
    });

    // Reset Extensions
    btnResetExts.addEventListener("click", () => {
        currentExtensions = [...DEFAULT_EXTENSIONS];
        chrome.storage.sync.set({ extensions: currentExtensions });
        renderTags();
    });

    function renderTags() {
        tagsContainer.innerHTML = "";
        currentExtensions.forEach((ext) => {
            const tag = document.createElement("span");
            tag.className = "ext-tag";
            tag.innerHTML = `.${ext} <span class="ext-tag-remove" data-ext="${ext}">&times;</span>`;
            tagsContainer.appendChild(tag);
        });

        // Event delegation for remove
        tagsContainer.querySelectorAll(".ext-tag-remove").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const extToRemove = e.target.dataset.ext;
                currentExtensions = currentExtensions.filter(e => e !== extToRemove);
                chrome.storage.sync.set({ extensions: currentExtensions });
                renderTags();
            });
        });
    }

    async function checkConnection() {
        statusWrap.className = "status-indicator";
        statusText.textContent = "Đang kiểm tra...";

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 800);
            const res = await fetch(`${SERVER_URL}/ping`, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                statusWrap.className = "status-indicator online";
                statusText.textContent = "Đã kết nối App";
            } else {
                throw new Error("Offline");
            }
        } catch (e) {
            statusWrap.className = "status-indicator offline";
            statusText.textContent = "Chưa kết nối App";
        }
    }
});
