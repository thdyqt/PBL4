// Tính năng Dán liên kết từ Clipboard
const pasteButton = document.querySelector(".btn-paste");
const urlInput = document.getElementById('url'); 

const showSuccessIcon = (btn) => {
    if (!btn) return;
    btn.classList.remove("fa-clipboard", "fa-regular");
    btn.classList.add("fa-check", "fa-solid");
    btn.style.color = "#10b981"; 
    btn.style.transform = "scale(1.2)";
    btn.style.transition = "all 0.3s ease";

    setTimeout(() => {
        btn.classList.remove("fa-check", "fa-solid");
        btn.classList.add("fa-clipboard", "fa-regular");
        btn.style.color = ""; 
        btn.style.transform = ""; 
    }, 2000);
};

let detectedUrlFileName = "";
let isFileNameManuallyEdited = false;

function extractFileNameFromUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    try {
        const u = new URL(rawUrl.trim());
        const pathname = u.pathname;
        let lastSegment = pathname.split("/").filter(Boolean).pop() || "";
        lastSegment = decodeURIComponent(lastSegment);
        lastSegment = lastSegment.replace(/[\\/:*?"<>|]/g, "_").trim();
        return lastSegment;
    } catch (e) {
        try {
            const clean = rawUrl.split("?")[0].split("#")[0];
            const parts = clean.split("/").filter(Boolean);
            if (parts.length > 0) {
                return decodeURIComponent(parts[parts.length - 1]).replace(/[\\/:*?"<>|]/g, "_").trim();
            }
        } catch (e2) {}
    }
    return "";
}

function updateFileNameFromUrl(url) {
    const fileNameInput = document.getElementById("custom-file-name");
    const btnResetName = document.getElementById("btn-reset-filename");
    if (!fileNameInput) return;

    const extracted = extractFileNameFromUrl(url);
    detectedUrlFileName = extracted;

    if (!isFileNameManuallyEdited) {
        if (extracted) {
            fileNameInput.value = extracted;
            fileNameInput.placeholder = extracted;
        } else {
            fileNameInput.value = "";
            fileNameInput.placeholder = "Tự động nhận diện từ liên kết (hoặc nhập tên bạn muốn đổi)";
        }
    } else {
        if (extracted) {
            fileNameInput.placeholder = extracted;
        }
    }

    if (btnResetName) {
        const isDifferent = fileNameInput.value.trim() !== detectedUrlFileName;
        btnResetName.style.display = (isFileNameManuallyEdited && isDifferent && detectedUrlFileName) ? "inline-flex" : "none";
    }
}
window.updateFileNameFromUrl = updateFileNameFromUrl;

if (pasteButton && urlInput) {
    pasteButton.addEventListener('click', () => {
        if (window.chrome && window.chrome.webview) {
            const payload = JSON.stringify({
                action: "READ_CLIPBOARD"
            });
            window.chrome.webview.postMessage(payload);
        } 
        else {
            try {
                navigator.clipboard.readText().then(text => {
                    if (text && text.trim() !== "") {
                        urlInput.value = text.trim();
                        updateFileNameFromUrl(urlInput.value);
                        urlInput.focus();
                        showSuccessIcon(pasteButton); 
                    } else {
                        alert("Bộ nhớ tạm đang trống hoặc không phải là chữ!");
                    }
                }).catch(error => {
                    console.error("Lỗi đọc Clipboard trên Web: ", error);
                    alert("Trình duyệt chặn quyền đọc Clipboard. Hãy nhấn Ctrl+V!");
                });
            } catch(e) {
                alert("Không thể dán tự động. Hãy nhấn Ctrl+V!");
            }
        }
    });

    urlInput.addEventListener("input", (e) => {
        updateFileNameFromUrl(e.target.value);
    });
    urlInput.addEventListener("change", (e) => {
        updateFileNameFromUrl(e.target.value);
    });
}

const customFileNameInput = document.getElementById("custom-file-name");
const btnResetFilename = document.getElementById("btn-reset-filename");

if (customFileNameInput) {
    customFileNameInput.addEventListener("input", () => {
        isFileNameManuallyEdited = true;
        if (btnResetFilename) {
            const isDifferent = customFileNameInput.value.trim() !== detectedUrlFileName;
            btnResetFilename.style.display = (isDifferent && detectedUrlFileName) ? "inline-flex" : "none";
        }
    });
}

if (btnResetFilename) {
    btnResetFilename.addEventListener("click", () => {
        isFileNameManuallyEdited = false;
        if (customFileNameInput) {
            customFileNameInput.value = detectedUrlFileName;
            customFileNameInput.focus();
        }
        btnResetFilename.style.display = "none";
    });
}

// Tính năng "Chọn nơi lưu" (Gửi lệnh mở hộp thoại xuống C#)
let isBrowsingForBatch = false;

function requestBrowseFolder(forBatch = false) {
    isBrowsingForBatch = forBatch;
    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage(JSON.stringify({ action: "BROWSE_FOLDER" }));
    } else {
        alert("Tính năng chọn thư mục chỉ hoạt động trên ứng dụng Desktop!");
    }
}
window.requestBrowseFolder = requestBrowseFolder;

const browseButton = document.querySelector(".inner-browse-button");
const savePathInput = document.getElementById("save-path");

if (browseButton) {
    browseButton.addEventListener("click", () => requestBrowseFolder(false));
}
if (savePathInput) {
    savePathInput.addEventListener("click", () => requestBrowseFolder(false));
}

// Bắt sự kiện phản hồi từ C#
if (window.chrome && window.chrome.webview) {
    window.chrome.webview.addEventListener('message', event => {
        try {
            const response = JSON.parse(event.data);

            // Xử lý thông báo lỗi hệ thống từ C#
            if (response.action === "ERROR") {
                const msg = response.message || response.data || "Đã xảy ra lỗi!";
                if (window.showAppToast) window.showAppToast(msg, 4000);
                else alert(msg);
                return;
            }
            
            // Xử lý kịch bản dán Clipboard 
            if (response.action === "CLIPBOARD_DATA") {
                const copiedText = response.data;
                const pasteBtn = document.querySelector(".btn-paste"); 
                
                if (copiedText && copiedText.trim() !== "") {
                    urlInput.value = copiedText.trim();
                    updateFileNameFromUrl(urlInput.value);
                    urlInput.focus();   
                    showSuccessIcon(pasteBtn);
                } else {
                    alert("Bộ nhớ tạm đang trống hoặc không chứa văn bản (link)!");
                }
            }
            
            // Xử lý kịch bản nhận đường dẫn thư mục
            if (response.action === "FOLDER_SELECTED") {
                const selectedPath = response.data;
                const savePathInput = document.getElementById("save-path");
                const batchSavePath = document.getElementById("batch-save-path");
                
                if (selectedPath) {
                    if (savePathInput) {
                        savePathInput.value = selectedPath;
                        const form = document.querySelector("#input-form");
                        if (form && form.justValidate) {
                            form.justValidate.revalidateField("#save-path");
                        }
                    }

                    if (batchSavePath) {
                        batchSavePath.value = selectedPath;
                    }

                    if (window.showAppToast) {
                        const shortName = selectedPath.length > 35 ? "..." + selectedPath.slice(-32) : selectedPath;
                        window.showAppToast("Đã chọn nơi lưu: " + shortName);
                    }
                }

                isBrowsingForBatch = false;
            }

            // Xử lý nạp dữ liệu cài đặt
            if (response.action === "SETTINGS_DATA") {
                if (window.populateSettingsForm) window.populateSettingsForm(response.data);
            }

            // Xử lý sau khi lưu cài đặt
            if (response.action === "SETTINGS_SAVED") {
                if (window.showAppToast) window.showAppToast("Đã lưu cài đặt thành công!");
                if (window.populateSettingsForm) window.populateSettingsForm(response.data);
                const modal = document.getElementById("settings-modal");
                if (modal) modal.style.display = "none";
            }

            // Xử lý kết quả kiểm tra Proxy
            if (response.action === "PROXY_TEST_RESULT") {
                const btnTest = document.getElementById("btn-test-proxy");
                const statusEl = document.getElementById("proxy-test-status");
                if (btnTest) {
                    btnTest.classList.remove("loading");
                    btnTest.innerHTML = '<i class="fa-solid fa-plug-circle-bolt"></i> <span>Kiểm tra kết nối Proxy</span>';
                }
                if (statusEl) {
                    statusEl.className = "proxy-test-status " + (response.success ? "success" : "error");
                    statusEl.textContent = response.message;
                }
            }

            // Xử lý cập nhật giới hạn tốc độ
            if (response.action === "SPEED_LIMIT_UPDATED") {
                if (window.updateHeaderSpeedLabel) window.updateHeaderSpeedLabel(response.kbps);
            }

            // Xử lý thông tin hệ thống (ổ đĩa, RAM, CPU...)
            if (response.action === "SYSTEM_INFO_DATA") {
                if (window.renderDeviceInfo) window.renderDeviceInfo(response.data);
            }

            // Xử lý cảnh báo dung lượng ổ đĩa (ổ đích không đủ hoặc tất cả ổ gần đầy)
            if (response.action === "DISK_SPACE_WARNING") {
                if (window.showDiskSpaceWarningModal) {
                    window.showDiskSpaceWarningModal(response);
                }
            }

        } catch (error) {
            console.error("Lỗi đọc dữ liệu từ C#: ", error);
        }
    });

    // Yêu cầu C# nạp cài đặt ngay khi WebView2 sẵn sàng
    setTimeout(() => {
        window.chrome.webview.postMessage(JSON.stringify({ action: "GET_SETTINGS" }));
    }, 150);
}

// Hàm dùng chung để tạo task và gửi lệnh tải xuống C#
function addDownloadTask(url, savePath, thread, customFileName = "") {
    if (!url || !savePath) return null;

    let fileName = (customFileName && customFileName.trim()) ? customFileName.trim() : "unknown_file";
    if (!customFileName || !customFileName.trim()) {
        try {
            fileName = decodeURIComponent(new URL(url).pathname.split("/").pop()) || fileName;
        } catch (e) { }
    }

    const category = window.getFileCategory ? window.getFileCategory(fileName) : "other";
    let iconClass = "fa-solid fa-file";
    if (category === "audio") iconClass = "fa-solid fa-music";
    else if (category === "video") iconClass = "fa-solid fa-video";
    else if (category === "document") iconClass = "fa-solid fa-file-zipper";

    const taskId = 'task-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const emptyState = document.getElementById("empty-state");
    if (emptyState) emptyState.style.display = "none";

    const now = Date.now();
    const safeFileName = fileName.replace(/"/g, '&quot;');
    const safeUrl = url.replace(/"/g, '&quot;');

    const downloadHTML = `
        <div class="download-item" id="${taskId}"
             data-state="preparing"
             data-category="${category}"
             data-file-name="${safeFileName}"
             data-created-at="${now}"
             data-start-time="${now}"
             data-total-bytes="0"
             data-downloaded-bytes="0"
             data-elapsed-time="0"
             data-speed="0"
             data-source-url="${safeUrl}">
            <div class="progress-header">
                <div class="file-info">
                    <i class="${iconClass}"></i>
                    <span class="file-name" title="${safeFileName}">${safeFileName}</span>
                </div>
                <div class="header-right">
                    <div class="item-actions">
                        <button type="button" class="btn-item-action btn-force-start" title="Bắt đầu tải ngay (Bỏ qua hàng đợi)" data-item-action="force-start" style="display: none;">
                            <i class="fa-solid fa-bolt"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-pause-resume" title="Tạm dừng" data-item-action="toggle-pause">
                            <i class="fa-solid fa-pause"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-cancel" title="Hủy tải" data-item-action="cancel">
                            <i class="fa-solid fa-ban"></i>
                        </button>
                        <button type="button" class="btn-item-action btn-delete" title="Xóa" data-item-action="delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="progress-percentage" id="${taskId}-percent">0%</div>
                </div>
            </div>
            
            <div class="progress-bar-container">
                <div class="progress-bar-fill" id="${taskId}-progress"></div>
            </div>
            
            <div class="progress-stats">
                <span class="stat-item"><span id="${taskId}-speed-label">Tốc độ:</span> <b id="${taskId}-speed">Đang tính...</b></span>
                <span class="stat-item">Đã tải: <b id="${taskId}-downloaded">0 MB / -- MB</b></span>
                <span class="stat-item"><span id="${taskId}-eta-label">Còn lại:</span> <b id="${taskId}-eta">--:--</b></span>
            </div>
        </div>
    `;

    const downloadList = document.getElementById("download-list");
    if (downloadList) {
        downloadList.insertAdjacentHTML('afterbegin', downloadHTML); 
    }

    if (window.applyFilter) window.applyFilter();
    else if (window.updateTaskCounter) window.updateTaskCounter();

    const payload = JSON.stringify({
        action: "START_DOWNLOAD", 
        taskId: taskId, 
        url: url, 
        savePath: savePath, 
        thread: thread, 
        threads: thread,
        customFileName: (customFileName && customFileName.trim()) ? customFileName.trim() : ""
    });

    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage(payload);
    }
    return taskId;
}
window.addDownloadTask = addDownloadTask;

// Form nhập link tải đơn lẻ
const inputForm = document.querySelector("#input-form");
if (inputForm) {
    const validator = new JustValidate("#input-form");

    validator
        .addField("#url", [
            {
                rule: "required",
                errorMessage: "Vui lòng nhập đường link tải về!"
            },
            {
                validator: (value) => {
                    try {
                        const u = new URL(value);
                        return u.protocol === "http:" || u.protocol === "https:";
                    } catch (e) {
                        return false;
                    }
                },
                errorMessage: "Liên kết không hợp lệ! Hãy nhập URL bắt đầu bằng http:// hoặc https://"
            }
        ])
        .addField("#save-path", [
            {
                rule: "required",
                errorMessage: "Vui lòng chọn vị trí lưu file!"
            },
        ])
        .onSuccess(event => {
            event.preventDefault();

            const url = event.target.url.value;
            const savePath = event.target.elements["save-path"].value;
            const threadEl = document.getElementById("thread");
            const threadNum = threadEl ? parseInt(threadEl.value, 10) : 4;
            const thread = (!isNaN(threadNum) && threadNum >= 1) ? threadNum : 4;
            const customNameEl = document.getElementById("custom-file-name");
            const customFileName = customNameEl ? customNameEl.value.trim() : "";

            addDownloadTask(url, savePath, thread, customFileName);

            if (urlInput) urlInput.value = '';
            if (customNameEl) {
                customNameEl.value = '';
                customNameEl.placeholder = "Tự động nhận diện từ liên kết (hoặc nhập tên bạn muốn đổi)";
            }
            detectedUrlFileName = "";
            isFileNameManuallyEdited = false;
            const btnResetFileName = document.getElementById("btn-reset-filename");
            if (btnResetFileName) btnResetFileName.style.display = "none";
        });
}

// ==========================================================================
// CÀI ĐẶT ỨNG DỤNG (SETTINGS MODAL: QUEUE, BANDWIDTH, PROXY)
// ==========================================================================

let currentSettings = {
    maxConcurrentDownloads: 2,
    speedLimitKbps: 0,
    proxy: {
        enabled: false,
        mode: "manual",
        type: "http",
        host: "",
        port: 8080,
        authRequired: false,
        username: "",
        password: "",
        bypassLocal: true
    },
    defaultSavePath: "",
    defaultThreads: 4,
    autoStartNextInQueue: true
};

function updateHeaderSpeedLabel(kbps) {
    const btn = document.getElementById("btn-header-speed-limit");
    const label = document.getElementById("header-speed-limit-label");
    if (!btn || !label) return;

    if (kbps && kbps > 0) {
        btn.classList.add("is-limited");
        if (kbps >= 1024) {
            const mb = (kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1);
            label.textContent = `${mb} MB/s`;
        } else {
            label.textContent = `${kbps} KB/s`;
        }
        btn.title = `Giới hạn băng thông: ${label.textContent} (Nhấp để điều chỉnh)`;
    } else {
        btn.classList.remove("is-limited");
        label.textContent = "Không giới hạn";
        btn.title = "Giới hạn băng thông (Nhấp để điều chỉnh)";
    }
}
window.updateHeaderSpeedLabel = updateHeaderSpeedLabel;

function populateSettingsForm(s) {
    if (!s) return;
    currentSettings = s;

    // 1. Tab Hàng đợi
    const maxConc = document.getElementById("setting-max-concurrent");
    if (maxConc) maxConc.value = String(s.maxConcurrentDownloads ?? 2);

    const autoNext = document.getElementById("setting-auto-start-next");
    if (autoNext) autoNext.checked = s.autoStartNextInQueue ?? true;

    const defThreads = document.getElementById("setting-default-threads");
    if (defThreads) defThreads.value = String(s.defaultThreads ?? 4);

    // 2. Tab Băng thông
    const speedEnable = document.getElementById("setting-speed-limit-enable");
    const speedSub = document.getElementById("speed-limit-sub-wrap");
    const customSpeed = document.getElementById("setting-custom-speed");
    const isLimited = (s.speedLimitKbps && s.speedLimitKbps > 0);

    if (speedEnable) speedEnable.checked = isLimited;
    if (speedSub) speedSub.style.display = isLimited ? "flex" : "none";
    if (customSpeed) customSpeed.value = isLimited ? s.speedLimitKbps : "";

    document.querySelectorAll(".preset-pills .btn-pill").forEach(p => {
        const pKbps = parseInt(p.dataset.kbps, 10);
        p.classList.toggle("active", isLimited && pKbps === s.speedLimitKbps);
    });

    updateHeaderSpeedLabel(s.speedLimitKbps);

    // 3. Tab Proxy
    const p = s.proxy || {};
    const proxyEnable = document.getElementById("setting-proxy-enable");
    const proxySub = document.getElementById("proxy-sub-wrap");
    if (proxyEnable) proxyEnable.checked = !!p.enabled;
    if (proxySub) proxySub.style.display = p.enabled ? "flex" : "none";

    const proxyMode = document.getElementById("setting-proxy-mode");
    if (proxyMode) proxyMode.value = p.mode || "manual";

    const proxyManualFields = document.getElementById("proxy-manual-fields");
    if (proxyManualFields) {
        proxyManualFields.style.display = (p.mode === "system" || p.mode === "direct") ? "none" : "";
    }

    const proxyType = document.getElementById("setting-proxy-type");
    if (proxyType) proxyType.value = p.type || "http";

    const proxyHost = document.getElementById("setting-proxy-host");
    if (proxyHost) proxyHost.value = p.host || "";

    const proxyPort = document.getElementById("setting-proxy-port");
    if (proxyPort) proxyPort.value = p.port || 8080;

    const proxyAuth = document.getElementById("setting-proxy-auth");
    const proxyAuthFields = document.getElementById("proxy-auth-fields");
    if (proxyAuth) proxyAuth.checked = !!p.authRequired;
    if (proxyAuthFields) proxyAuthFields.style.display = p.authRequired ? "flex" : "none";

    const proxyUser = document.getElementById("setting-proxy-user");
    if (proxyUser) proxyUser.value = p.username || "";

    const proxyPass = document.getElementById("setting-proxy-pass");
    if (proxyPass) proxyPass.value = p.password || "";

    const proxyBypass = document.getElementById("setting-proxy-bypass-local");
    if (proxyBypass) proxyBypass.checked = (p.bypassLocal !== false);

    // Điền mặc định vào form chính nếu ô còn trống
    const saveInput = document.getElementById("save-path");
    if (saveInput && !saveInput.value && s.defaultSavePath) {
        saveInput.value = s.defaultSavePath;
    }
    const batchSave = document.getElementById("batch-save-path");
    if (batchSave && !batchSave.value && s.defaultSavePath) {
        batchSave.value = s.defaultSavePath;
    }
    const threadInput = document.getElementById("thread");
    if (threadInput && s.defaultThreads) {
        threadInput.value = String(s.defaultThreads);
    }

    const confirmDelete = document.getElementById("setting-confirm-delete");
    const isConfirm = s.confirmBeforeDelete !== false;
    if (confirmDelete) confirmDelete.checked = isConfirm;
    window.confirmBeforeDelete = isConfirm;
    try { localStorage.setItem("confirmBeforeDelete", isConfirm ? "true" : "false"); } catch (e) {}
}
window.populateSettingsForm = populateSettingsForm;

window.shouldConfirmDelete = function () {
    if (typeof window.confirmBeforeDelete === "boolean") {
        return window.confirmBeforeDelete;
    }
    try {
        const local = localStorage.getItem("confirmBeforeDelete");
        if (local !== null) return local !== "false";
    } catch (e) {}
    return true;
};

window.setConfirmBeforeDelete = function (val) {
    const isConfirm = !!val;
    window.confirmBeforeDelete = isConfirm;
    try { localStorage.setItem("confirmBeforeDelete", isConfirm ? "true" : "false"); } catch (e) {}
    const chk = document.getElementById("setting-confirm-delete");
    if (chk) chk.checked = isConfirm;
    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage(JSON.stringify({
            action: "UPDATE_CONFIRM_DELETE",
            confirmBeforeDelete: isConfirm
        }));
    }
};

// Mở modal cài đặt
function openSettingsModal(defaultTab = "tab-queue") {
    const modal = document.getElementById("settings-modal");
    if (!modal) return;

    // Chuyển tới tab mong muốn
    document.querySelectorAll(".settings-tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === defaultTab);
    });
    document.querySelectorAll(".settings-tab-content").forEach(content => {
        content.classList.toggle("active", content.id === defaultTab);
    });

    const statusEl = document.getElementById("proxy-test-status");
    if (statusEl) {
        statusEl.className = "proxy-test-status";
        statusEl.style.display = "none";
    }

    modal.style.display = "flex";
}

function closeSettingsModal() {
    const modal = document.getElementById("settings-modal");
    if (modal) modal.style.display = "none";
}

// Bắt sự kiện Modal Cài đặt
document.addEventListener("click", (e) => {
    // 1. Mở Cài đặt từ Header Gear icon
    if (e.target.closest("#btn-header-settings")) {
        openSettingsModal("tab-queue");
        return;
    }

    // 2. Mở Cài đặt từ Header Speed Limit button
    if (e.target.closest("#btn-header-speed-limit")) {
        openSettingsModal("tab-bandwidth");
        return;
    }

    // 3. Đóng Cài đặt
    if (e.target.closest("#btn-close-settings") || e.target.closest("#btn-cancel-settings")) {
        closeSettingsModal();
        return;
    }

    // Đóng khi click ngoài thẻ card
    const settingsModal = document.getElementById("settings-modal");
    if (settingsModal && e.target === settingsModal) {
        closeSettingsModal();
        return;
    }

    // 4. Chuyển Tab cài đặt
    const tabBtn = e.target.closest(".settings-tab-btn");
    if (tabBtn) {
        const tabId = tabBtn.dataset.tab;
        document.querySelectorAll(".settings-tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".settings-tab-content").forEach(c => c.classList.remove("active"));
        tabBtn.classList.add("active");
        const activeContent = document.getElementById(tabId);
        if (activeContent) activeContent.classList.add("active");
        return;
    }

    // 5. Chọn Preset tốc độ
    const pill = e.target.closest(".preset-pills .btn-pill");
    if (pill) {
        document.querySelectorAll(".preset-pills .btn-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        const customInput = document.getElementById("setting-custom-speed");
        if (customInput) customInput.value = pill.dataset.kbps;
        return;
    }
});

// Bật tắt Giới hạn tốc độ
const speedEnableToggle = document.getElementById("setting-speed-limit-enable");
if (speedEnableToggle) {
    speedEnableToggle.addEventListener("change", (e) => {
        const sub = document.getElementById("speed-limit-sub-wrap");
        if (sub) sub.style.display = e.target.checked ? "flex" : "none";
        if (e.target.checked) {
            const custom = document.getElementById("setting-custom-speed");
            if (custom && (!custom.value || parseInt(custom.value, 10) <= 0)) {
                custom.value = "2048"; // Mặc định 2 MB/s
                const p2 = document.querySelector('.preset-pills .btn-pill[data-kbps="2048"]');
                if (p2) p2.classList.add("active");
            }
        }
    });
}

// Bật tắt Proxy
const proxyEnableToggle = document.getElementById("setting-proxy-enable");
if (proxyEnableToggle) {
    proxyEnableToggle.addEventListener("change", (e) => {
        const sub = document.getElementById("proxy-sub-wrap");
        if (sub) sub.style.display = e.target.checked ? "flex" : "none";
    });
}

// Thay đổi chế độ Proxy
const proxyModeSelect = document.getElementById("setting-proxy-mode");
if (proxyModeSelect) {
    proxyModeSelect.addEventListener("change", (e) => {
        const manualFields = document.getElementById("proxy-manual-fields");
        if (manualFields) {
            manualFields.style.display = (e.target.value === "system" || e.target.value === "direct") ? "none" : "";
        }
    });
}

// Bật tắt Xác thực Proxy
const proxyAuthToggle = document.getElementById("setting-proxy-auth");
if (proxyAuthToggle) {
    proxyAuthToggle.addEventListener("change", (e) => {
        const authFields = document.getElementById("proxy-auth-fields");
        if (authFields) authFields.style.display = e.target.checked ? "flex" : "none";
    });
}

// Kiểm tra kết nối Proxy
const btnTestProxy = document.getElementById("btn-test-proxy");
if (btnTestProxy) {
    btnTestProxy.addEventListener("click", () => {
        const proxyConfig = collectProxyFromForm();
        if (!proxyConfig.enabled) {
            alert("Vui lòng bật công tắc Proxy trước khi kiểm tra!");
            return;
        }

        btnTestProxy.classList.add("loading");
        btnTestProxy.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang kết nối thử nghiệm...</span>';

        const statusEl = document.getElementById("proxy-test-status");
        if (statusEl) statusEl.style.display = "none";

        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify({
                action: "TEST_PROXY",
                proxy: proxyConfig
            }));
        } else {
            setTimeout(() => {
                btnTestProxy.classList.remove("loading");
                btnTestProxy.innerHTML = '<i class="fa-solid fa-plug-circle-bolt"></i> <span>Kiểm tra kết nối Proxy</span>';
                if (statusEl) {
                    statusEl.className = "proxy-test-status success";
                    statusEl.textContent = "Giả lập kiểm tra Proxy thành công (Độ trễ: 85 ms)!";
                    statusEl.style.display = "block";
                }
            }, 800);
        }
    });
}

function collectProxyFromForm() {
    const enabled = document.getElementById("setting-proxy-enable")?.checked ?? false;
    const mode = document.getElementById("setting-proxy-mode")?.value || "manual";
    const type = document.getElementById("setting-proxy-type")?.value || "http";
    const host = (document.getElementById("setting-proxy-host")?.value || "").trim();
    const port = parseInt(document.getElementById("setting-proxy-port")?.value || "8080", 10) || 8080;
    const authRequired = document.getElementById("setting-proxy-auth")?.checked ?? false;
    const username = document.getElementById("setting-proxy-user")?.value || "";
    const password = document.getElementById("setting-proxy-pass")?.value || "";
    const bypassLocal = document.getElementById("setting-proxy-bypass-local")?.checked ?? true;

    return {
        enabled,
        mode,
        type,
        host,
        port,
        authRequired,
        username,
        password,
        bypassLocal
    };
}

// Lưu cài đặt
const btnSaveSettings = document.getElementById("btn-save-settings");
if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", () => {
        const maxConcurrent = parseInt(document.getElementById("setting-max-concurrent")?.value || "2", 10);
        const autoNext = document.getElementById("setting-auto-start-next")?.checked ?? true;
        const defaultThreads = parseInt(document.getElementById("setting-default-threads")?.value || "4", 10);

        const speedEnable = document.getElementById("setting-speed-limit-enable")?.checked ?? false;
        let speedKbps = 0;
        if (speedEnable) {
            const customVal = parseInt(document.getElementById("setting-custom-speed")?.value || "0", 10);
            speedKbps = (!isNaN(customVal) && customVal > 0) ? customVal : 2048;
        }

        const proxy = collectProxyFromForm();

        const confirmBeforeDelete = document.getElementById("setting-confirm-delete")?.checked ?? true;
        window.confirmBeforeDelete = confirmBeforeDelete;
        try { localStorage.setItem("confirmBeforeDelete", confirmBeforeDelete ? "true" : "false"); } catch (e) {}

        const newSettings = {
            maxConcurrentDownloads: isNaN(maxConcurrent) ? 2 : maxConcurrent,
            speedLimitKbps: speedKbps,
            proxy: proxy,
            defaultSavePath: document.getElementById("save-path")?.value || currentSettings.defaultSavePath || "",
            defaultThreads: defaultThreads,
            autoStartNextInQueue: autoNext,
            confirmBeforeDelete: confirmBeforeDelete
        };

        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify({
                action: "SAVE_SETTINGS",
                settings: newSettings
            }));
        } else {
            populateSettingsForm(newSettings);
            closeSettingsModal();
            if (window.showAppToast) window.showAppToast("Đã lưu cài đặt giả lập!");
        }
    });
}

// ==========================================================================
// TẢI HÀNG LOẠT LIÊN KẾT (BATCH URLS MODAL)
// ==========================================================================

function openBatchModal() {
    const modal = document.getElementById("batch-modal");
    if (!modal) return;

    // Kế thừa nơi lưu và số luồng từ form chính
    const mainSave = document.getElementById("save-path");
    const batchSave = document.getElementById("batch-save-path");
    if (mainSave && batchSave && mainSave.value) {
        batchSave.value = mainSave.value;
    }

    const mainThread = document.getElementById("thread");
    const batchThread = document.getElementById("batch-thread-select");
    if (mainThread && batchThread) {
        batchThread.value = mainThread.value;
    }

    updateBatchCount();
    modal.style.display = "flex";

    const textarea = document.getElementById("batch-urls-input");
    if (textarea) textarea.focus();
}

function closeBatchModal() {
    const modal = document.getElementById("batch-modal");
    if (modal) modal.style.display = "none";
}

function parseValidUrlsFromText(text) {
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    const valid = [];
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
            const u = new URL(trimmed);
            if (u.protocol === "http:" || u.protocol === "https:") {
                valid.push(trimmed);
            }
        } catch (e) { }
    });
    return valid;
}

function updateBatchCount() {
    const textarea = document.getElementById("batch-urls-input");
    const badge = document.getElementById("batch-urls-count");
    const submitText = document.getElementById("btn-submit-batch-text");
    if (!textarea || !badge) return;

    const validUrls = parseValidUrlsFromText(textarea.value);
    const count = validUrls.length;

    badge.textContent = `${count} liên kết hợp lệ`;
    badge.classList.toggle("has-items", count > 0);

    if (submitText) {
        submitText.textContent = count > 0 ? `Thêm vào hàng đợi (${count} tệp)` : "Thêm vào hàng đợi";
    }
}

// Lắng nghe sự kiện Batch modal
const btnOpenBatch = document.getElementById("btn-open-batch-modal");
if (btnOpenBatch) {
    btnOpenBatch.addEventListener("click", openBatchModal);
}

document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-close-batch") || e.target.closest("#btn-cancel-batch")) {
        closeBatchModal();
        return;
    }

    const batchModal = document.getElementById("batch-modal");
    if (batchModal && e.target === batchModal) {
        closeBatchModal();
        return;
    }

    // Chọn thư mục lưu trong batch modal
    if (e.target.closest("#btn-batch-browse") || e.target.closest("#batch-save-path")) {
        requestBrowseFolder(true);
    }
});

const batchTextarea = document.getElementById("batch-urls-input");
if (batchTextarea) {
    batchTextarea.addEventListener("input", updateBatchCount);
    batchTextarea.addEventListener("paste", () => setTimeout(updateBatchCount, 50));
}

// Bấm nút bắt đầu thêm hàng loạt vào hàng đợi
const btnSubmitBatch = document.getElementById("btn-submit-batch");
if (btnSubmitBatch) {
    btnSubmitBatch.addEventListener("click", () => {
        const textarea = document.getElementById("batch-urls-input");
        const batchSave = document.getElementById("batch-save-path");
        const batchThread = document.getElementById("batch-thread-select");

        const urls = parseValidUrlsFromText(textarea?.value || "");
        if (urls.length === 0) {
            alert("Vui lòng nhập ít nhất một đường dẫn HTTP/HTTPS hợp lệ vào danh sách!");
            return;
        }

        const savePath = (batchSave?.value || document.getElementById("save-path")?.value || "").trim();
        if (!savePath) {
            alert("Vui lòng chọn thư mục lưu tệp trước khi bắt đầu tải!");
            return;
        }

        const thread = parseInt(batchThread?.value || "4", 10) || 4;

        // Thêm từng tác vụ vào giao diện và gửi xuống C#
        urls.forEach(url => {
            addDownloadTask(url, savePath, thread);
        });

        if (window.showAppToast) {
            window.showAppToast(`Đã thêm ${urls.length} liên kết vào hàng đợi tải về!`);
        }

        if (textarea) textarea.value = "";
        closeBatchModal();
    });
}

// =============================================
// Hộp thoại Cảnh báo Dung lượng Ổ đĩa (Disk Space Modal)
// =============================================

function formatBytesCompact(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let val = Number(bytes);
    while (val >= 1024 && i < units.length - 1) {
        val /= 1024;
        i++;
    }
    return val.toFixed(i === 0 ? 0 : 2) + " " + units[i];
}

window.showDiskSpaceWarningModal = function (data) {
    const modal = document.getElementById("disk-space-modal");
    if (!modal) return;

    const iconWrap = document.getElementById("disk-space-icon-wrap");
    const icon = document.getElementById("disk-space-icon");
    const titleEl = document.getElementById("disk-space-title");
    const subtitleEl = document.getElementById("disk-space-subtitle");
    const msgEl = document.getElementById("disk-space-message");
    const comparisonEl = document.getElementById("disk-space-comparison");
    const currentValEl = document.getElementById("compare-current-val");
    const suggestedValEl = document.getElementById("compare-suggested-val");
    const btnSwitch = document.getElementById("btn-disk-switch-folder");
    const btnClose = document.getElementById("btn-disk-close");

    if (data.isAllDrivesFull) {
        // Test case 2: Tất cả các ổ đều gần đầy hoặc không đủ -> Huỷ tải & Cảnh báo an toàn
        if (iconWrap) {
            iconWrap.className = "disk-space-icon-wrap danger";
        }
        if (icon) {
            icon.className = "fa-solid fa-triangle-exclamation";
        }
        if (titleEl) {
            titleEl.textContent = "Không đủ bộ nhớ toàn hệ thống!";
        }
        if (subtitleEl) {
            subtitleEl.textContent = "Tất cả các ổ đĩa trên máy đều gần đầy hoặc không đủ dung lượng";
        }
        if (msgEl) {
            msgEl.textContent = data.message || "Tất cả các ổ đĩa trên thiết bị đều gần đầy hoặc không đủ chỗ trống để chứa tệp này. Quá trình tải đã được tự động huỷ để tránh lỗi hệ thống!";
        }
        if (comparisonEl) {
            comparisonEl.style.display = "none";
        }
        if (btnSwitch) {
            btnSwitch.style.display = "none";
        }
        if (btnClose) {
            btnClose.textContent = "Đã hiểu";
        }
    } else {
        // Test case 1: Ổ đích không đủ nhưng có ổ khác đủ -> Đề xuất đổi sang ổ khác
        if (iconWrap) {
            iconWrap.className = "disk-space-icon-wrap warning";
        }
        if (icon) {
            icon.className = "fa-solid fa-hard-drive";
        }
        if (titleEl) {
            titleEl.textContent = "Ổ đĩa đích không đủ dung lượng!";
        }
        if (subtitleEl) {
            subtitleEl.textContent = "Đề xuất đổi vị trí lưu tệp sang ổ đĩa khác còn trống";
        }
        if (msgEl) {
            msgEl.textContent = data.message || "Ổ đĩa hiện tại không đủ dung lượng trống để lưu tệp. Hãy đổi thư mục lưu sang ổ đĩa khác có đủ chỗ trống.";
        }
        if (comparisonEl) {
            comparisonEl.style.display = "flex";
            if (currentValEl) {
                currentValEl.textContent = `Ổ ${data.targetDrive || 'C:'} (Còn ${formatBytesCompact(data.targetFreeBytes)})`;
            }
            if (suggestedValEl) {
                suggestedValEl.textContent = `Ổ ${data.suggestedDrive || 'D:'} (Còn ${formatBytesCompact(data.suggestedFreeBytes)})`;
            }
        }
        if (btnSwitch) {
            btnSwitch.style.display = "inline-flex";
        }
        if (btnClose) {
            btnClose.textContent = "Để sau";
        }
    }

    modal.style.display = "flex";

    if (window.showAppToast) {
        window.showAppToast(data.message, 5000);
    }
};

function closeDiskSpaceModal() {
    const modal = document.getElementById("disk-space-modal");
    if (modal) modal.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
    const btnCloseModal = document.getElementById("btn-close-disk-modal");
    const btnClose = document.getElementById("btn-disk-close");
    const btnSwitch = document.getElementById("btn-disk-switch-folder");

    if (btnCloseModal) btnCloseModal.addEventListener("click", closeDiskSpaceModal);
    if (btnClose) btnClose.addEventListener("click", closeDiskSpaceModal);

    if (btnSwitch) {
        btnSwitch.addEventListener("click", () => {
            closeDiskSpaceModal();
            // Kích hoạt nút chọn thư mục để người dùng chọn ổ đĩa khác
            const browseBtn = document.getElementById("btn-browse-folder");
            if (browseBtn) browseBtn.click();
        });
    }

    // Đóng khi click ngoài modal
    const modal = document.getElementById("disk-space-modal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeDiskSpaceModal();
        });
    }
});
