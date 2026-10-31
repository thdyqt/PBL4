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

    const trimmed = rawUrl.trim();

    if (!trimmed) return "";

    try {

        const u = new URL(trimmed);

        const pathname = u.pathname;

        let lastSegment = pathname.split("/").filter(Boolean).pop() || "";

        if (lastSegment) {

            lastSegment = decodeURIComponent(lastSegment);

            lastSegment = lastSegment.replace(/[\\/:*?"<>|]/g, "_").trim();

            return lastSegment;

        }

    } catch (e) {

        try {

            if (trimmed.includes("/")) {

                const clean = trimmed.split("?")[0].split("#")[0];

                const parts = clean.split("/").filter(Boolean);

                if (parts.length > 1 || (parts.length === 1 && parts[0].includes("."))) {

                    return decodeURIComponent(parts[parts.length - 1]).replace(/[\\/:*?"<>|]/g, "_").trim();

                }

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



    const defaultPlaceholder = (window.i18n && window.i18n.t)

        ? window.i18n.t("add.custom_name_placeholder")

        : "Tự động nhận diện từ liên kết (hoặc nhập tên bạn muốn đổi)";



    if (!isFileNameManuallyEdited) {

        if (extracted) {

            fileNameInput.value = extracted;

            fileNameInput.placeholder = extracted;

        } else {

            fileNameInput.value = "";

            fileNameInput.placeholder = defaultPlaceholder;

        }

    } else {

        if (extracted) {

            fileNameInput.placeholder = extracted;

        } else {

            fileNameInput.placeholder = defaultPlaceholder;

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

                        const msg = (window.i18n && window.i18n.t) ? window.i18n.t("validate.clipboard_empty") : "Bộ nhớ tạm đang trống hoặc không phải là chữ!";

                        alert(msg);

                    }

                }).catch(error => {

                    console.error("Lỗi đọc Clipboard trên Web: ", error);

                    const msg = (window.i18n && window.i18n.t) ? window.i18n.t("validate.clipboard_blocked") : "Trình duyệt chặn quyền đọc Clipboard. Hãy nhấn Ctrl+V!";

                    alert(msg);

                });

            } catch(e) {

                const msg = (window.i18n && window.i18n.t) ? window.i18n.t("validate.clipboard_fail") : "Không thể dán tự động. Hãy nhấn Ctrl+V!";

                alert(msg);

            }

        }

    });



    urlInput.addEventListener("input", (e) => {

        const val = e.target.value.trim();

        if (!val) {

            urlInput.classList.remove("just-validate-success-field", "just-validate-error-field");

            const errLabel = document.querySelector("#input-form .just-validate-error-label");

            if (errLabel) errLabel.remove();

        }

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

        const msg = (window.i18n && window.i18n.t) ? window.i18n.t("validate.browse_desktop_only") : "Tính năng chọn thư mục chỉ hoạt động trên ứng dụng Desktop!";

        alert(msg);

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

                    const msg = (window.i18n && window.i18n.t) ? window.i18n.t("validate.clipboard_empty") : "Bộ nhớ tạm đang trống hoặc không chứa văn bản (link)!";

                    alert(msg);

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

                        const isEn = window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === "en";

                        window.showAppToast((isEn ? "Save location: " : "Đã chọn nơi lưu: ") + shortName);

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

                const toastMsg = (window.i18n && window.i18n.t) ? window.i18n.t("toast.settings_saved") : "Đã lưu cài đặt thành công!";

                if (window.showAppToast) window.showAppToast(toastMsg);

                if (window.populateSettingsForm) window.populateSettingsForm(response.data);

                const modal = document.getElementById("settings-modal");

                if (modal) modal.style.display = "none";

            }



            // Xử lý khi nhận lệnh tạm dừng tất cả từ Tray Menu hoặc Backend

            if (response.action === "ALL_PAUSED") {

                const items = Array.from(document.querySelectorAll("#download-list .download-item"))

                    .filter(el => el.dataset.state === "downloading" || el.dataset.state === "queued");

                items.forEach(el => {

                    el.dataset.state = "paused";

                    const btn = el.querySelector('[data-item-action="toggle-pause"]');

                    if (btn) {

                        btn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i>';

                        const isEn = window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === "en";

                        btn.title = isEn ? "Resume" : "Tiếp tục";

                    }

                });

                if (window.updateDownloadCounts) window.updateDownloadCounts();

            }



            // Xử lý kết quả kiểm tra Proxy

            if (response.action === "PROXY_TEST_RESULT") {

                const btnTest = document.getElementById("btn-test-proxy");

                const statusEl = document.getElementById("proxy-test-status");

                if (btnTest) {

                    btnTest.classList.remove("loading");

                    const testBtnText = (window.i18n && window.i18n.t) ? window.i18n.t("settings.proxy.test_btn") : "Kiểm tra kết nối Proxy";

                    btnTest.innerHTML = `<i class="fa-solid fa-bolt-lightning"></i> <span data-i18n="settings.proxy.test_btn">${testBtnText}</span>`;

                }

                if (statusEl) {

                    statusEl.className = "proxy-test-status " + (response.success ? "success" : "error");

                    statusEl.textContent = response.message;

                    statusEl.style.display = "block";

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



            // Xử lý Lập lịch & Quản lý nguồn điện Windows

            if (response.action === "SCHEDULE_TRIGGERED") {

                const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";

                const msg = (window.i18n && window.i18n.format)

                    ? window.i18n.format("schedule.triggered_toast", response.time)

                    : (isEn ? `Scheduled time reached (${response.time}), queue downloads started!` : `Đã đến giờ hẹn (${response.time}), tự động bắt đầu tải hàng đợi!`);

                if (window.showAppToast) window.showAppToast(msg);

            }



            if (response.action === "POWER_ACTION_COUNTDOWN") {

                if (window.showPowerCountdownModal) {

                    window.showPowerCountdownModal(response.powerAction, response.remainingSeconds);

                }

            }



            if (response.action === "POWER_ACTION_CANCELLED") {

                if (window.hidePowerCountdownModal) window.hidePowerCountdownModal();

                const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";

                const msg = (window.i18n && window.i18n.t)

                    ? window.i18n.t("power.cancelled_toast", "Đã hủy lệnh tắt máy tính thành công!")

                    : (isEn ? "Power action cancelled successfully!" : "Đã hủy lệnh tắt máy tính thành công!");

                if (window.showAppToast) window.showAppToast(msg);

            }



            if (response.action === "PERFORMANCE_METRICS") {

                if (response.isSleepPrevented !== undefined && window.updateWin32SleepStatus) {

                    window.updateWin32SleepStatus(response.isSleepPrevented);

                }

                if (response.isCountingDown && response.remainingSeconds !== undefined && window.showPowerCountdownModal) {

                    window.showPowerCountdownModal(response.powerAction, response.remainingSeconds);

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



    let fileName = (customFileName && customFileName.trim()) ? customFileName.trim() : "";

    if (!fileName) {

        fileName = extractFileNameFromUrl(url) || "unknown_file";

    }



    const category = window.getFileCategory ? window.getFileCategory(fileName) : "other";

    let iconClass = "fa-solid fa-file";

    if (category === "audio") iconClass = "fa-solid fa-music";

    else if (category === "video") iconClass = "fa-solid fa-video";

    else if (category === "document") iconClass = "fa-solid fa-file-zipper";



    if (typeof window.globalTaskSeq === 'undefined') window.globalTaskSeq = 0;
    const taskId = 'task-' + Date.now() + '-' + (++window.globalTaskSeq) + '-' + Math.random().toString(36).substring(2, 8);



    const emptyState = document.getElementById("empty-state");

    if (emptyState) emptyState.style.display = "none";



    const now = Date.now();

    const safeFileName = fileName.replace(/"/g, '&quot;');

    const safeUrl = url.replace(/"/g, '&quot;');

    const safeSavePath = (savePath || "").replace(/"/g, '&quot;');



    const isEn = window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === "en";

    const titleForce = isEn ? "Start now (Bypass queue)" : "Bắt đầu tải ngay (Bỏ qua hàng đợi)";

    const titlePause = isEn ? "Pause" : "Tạm dừng";

    const titleCancel = isEn ? "Cancel download" : "Hủy tải";

    const titleDelete = isEn ? "Delete" : "Xóa";

    const speedLabel = isEn ? "Speed:" : "Tốc độ:";

    const speedCalc = isEn ? "Calculating..." : "Đang tính...";

    const downloadedLabel = isEn ? "Downloaded:" : "Đã tải:";

    const etaLabel = isEn ? "ETA:" : "Còn lại:";



    const prepText = (window.i18n && window.i18n.t) ? window.i18n.t("state.preparing") : (isEn ? "Preparing..." : "Đang chuẩn bị...");

    const downloadHTML = `

        <div class="download-item" id="${taskId}"

             role="article"

             aria-labelledby="${taskId}-filename"

             data-state="preparing"

             data-category="${category}"

             data-file-name="${safeFileName}"

             data-created-at="${now}"

             data-start-time="${now}"

             data-total-bytes="0"

             data-downloaded-bytes="0"

             data-elapsed-time="0"

             data-speed="0"

             data-source-url="${safeUrl}"

             data-target-path="${safeSavePath}">

            <div class="progress-header">

                <div class="file-info">

                    <i class="${iconClass}" aria-hidden="true"></i>

                    <span class="file-name" id="${taskId}-filename" title="${safeFileName}">${safeFileName}</span>

                    <span class="status-pill status-pill-preparing" id="${taskId}-status-pill">${prepText}</span>

                </div>

                <div class="header-right">

                    <div class="item-actions">

                        <button type="button" class="btn-item-action btn-force-start" title="${titleForce}" aria-label="${titleForce}" data-item-action="force-start" style="display: none;">

                            <i class="fa-solid fa-bolt" aria-hidden="true"></i>

                        </button>

                        <button type="button" class="btn-item-action btn-pause-resume" title="${titlePause}" aria-label="${titlePause}" data-item-action="toggle-pause">

                            <i class="fa-solid fa-pause" aria-hidden="true"></i>

                        </button>

                        <button type="button" class="btn-item-action btn-cancel" title="${titleCancel}" aria-label="${titleCancel}" data-item-action="cancel">

                            <i class="fa-solid fa-ban" aria-hidden="true"></i>

                        </button>

                        <button type="button" class="btn-item-action btn-delete" title="${titleDelete}" aria-label="${titleDelete}" data-item-action="delete">

                            <i class="fa-solid fa-trash" aria-hidden="true"></i>

                        </button>

                    </div>

                    <div class="progress-percentage" id="${taskId}-percent">0%</div>

                </div>

            </div>

            

            <div class="progress-bar-container" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="${taskId}-progress-container">

                <div class="progress-bar-fill" id="${taskId}-progress"></div>

            </div>

            

            <div class="progress-stats">

                <span class="stat-item"><span id="${taskId}-speed-label">${speedLabel}</span> <b id="${taskId}-speed">${speedCalc}</b></span>

                <span class="stat-item"><span id="${taskId}-downloaded-label">${downloadedLabel}</span> <b id="${taskId}-downloaded">0 MB / -- MB</b></span>

                <span class="stat-item"><span id="${taskId}-eta-label">${etaLabel}</span> <b id="${taskId}-eta">--:--</b></span>

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

/**
 * Kiểm tra nhanh xem URL hoặc chuỗi có chứa cú pháp quy luật [...] hay không.
 */
function hasUrlPattern(url) {
    if (!url || typeof url !== "string") return false;
    const bracketRegex = /\[\s*([^\]]+?)\s*\]/g;
    let m;
    while ((m = bracketRegex.exec(url)) !== null) {
        const inner = m[1].trim();
        if (/^\d+\s*-\s*\d+(?:\s*:\s*\d+)?$/.test(inner)) return true;
        if (/^[a-zA-Z]\s*-\s*[a-zA-Z](?:\s*:\s*\d+)?$/.test(inner)) return true;
        if (inner.includes(",") && !inner.includes("::")) return true;
    }
    return false;
}
window.hasUrlPattern = hasUrlPattern;

/**
 * Thêm danh sách nhiều tác vụ tải hàng loạt vào giao diện và gửi xuống C# (Queue Scheduling).
 * Tránh nghẽn card mạng bằng cách điều phối qua hàng đợi của DownloadManager.
 */
function addBatchDownloadTasks(urls, savePath, thread, customFileNamePattern = "") {
    if (!Array.isArray(urls) || urls.length === 0 || !savePath) return [];

    const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";
    const emptyState = document.getElementById("empty-state");
    if (emptyState) emptyState.style.display = "none";

    let expandedCustomNames = [];
    if (customFileNamePattern && hasUrlPattern(customFileNamePattern)) {
        const exp = expandUrlPattern(customFileNamePattern);
        if (!exp.error && exp.urls.length > 0) expandedCustomNames = exp.urls;
    }

    if (typeof window.globalTaskSeq === 'undefined') window.globalTaskSeq = 0;

    const taskList = [];
    for (let i = 0; i < urls.length; i++) {
        const u = urls[i];
        let customName = "";
        if (expandedCustomNames.length > i) {
            customName = expandedCustomNames[i];
        } else if (customFileNamePattern && !hasUrlPattern(customFileNamePattern)) {
            customName = (i === 0) ? customFileNamePattern : "";
        }
        let fileName = (customName && customName.trim()) ? customName.trim() : (extractFileNameFromUrl(u) || `task_file_${i + 1}`);
        const taskId = 'task-' + Date.now() + '-' + (++window.globalTaskSeq) + '-' + Math.random().toString(36).substring(2, 8);
        taskList.push({ taskId, url: u, fileName, customFileName: customName, savePath, thread });
    }

    // Chèn vào giao diện DOM:
    // Chèn ngược từ task cuối lên task đầu với 'afterbegin' để Task 1 nằm trên cùng!
    const downloadList = document.getElementById("download-list");
    if (downloadList) {
        for (let i = taskList.length - 1; i >= 0; i--) {
            const item = taskList[i];
            const category = window.getFileCategory ? window.getFileCategory(item.fileName) : "other";
            let iconClass = "fa-solid fa-file";
            if (category === "audio") iconClass = "fa-solid fa-music";
            else if (category === "video") iconClass = "fa-solid fa-video";
            else if (category === "document") iconClass = "fa-solid fa-file-zipper";

            const now = Date.now();
            const safeFileName = item.fileName.replace(/"/g, '&quot;');
            const safeUrl = item.url.replace(/"/g, '&quot;');
            const safeSavePath = (savePath || "").replace(/"/g, '&quot;');
            const titleForce = isEn ? "Start now (Bypass queue)" : "Bắt đầu tải ngay (Bỏ qua hàng đợi)";
            const titlePause = isEn ? "Pause" : "Tạm dừng";
            const titleCancel = isEn ? "Cancel download" : "Hủy tải";
            const titleDelete = isEn ? "Delete" : "Xóa";
            const speedLabel = isEn ? "Speed:" : "Tốc độ:";
            const downloadedLabel = isEn ? "Downloaded:" : "Đã tải:";
            const etaLabel = isEn ? "ETA:" : "Còn lại:";
            const queueText = (window.i18n && window.i18n.t) ? window.i18n.t("state.queued") : (isEn ? "Queued" : "Chờ tải (Trong hàng đợi)");

            const downloadHTML = `
                <div class="download-item" id="${item.taskId}"
                     role="article"
                     aria-labelledby="${item.taskId}-filename"
                     data-state="queued"
                     data-category="${category}"
                     data-file-name="${safeFileName}"
                     data-created-at="${now}"
                     data-start-time="${now}"
                     data-total-bytes="0"
                     data-downloaded-bytes="0"
                     data-elapsed-time="0"
                     data-speed="0"
                     data-source-url="${safeUrl}"
                     data-target-path="${safeSavePath}">
                    <div class="progress-header">
                        <div class="file-info">
                            <i class="${iconClass}" aria-hidden="true"></i>
                            <span class="file-name" id="${item.taskId}-filename" title="${safeFileName}">${safeFileName}</span>
                            <span class="status-pill status-pill-queued" id="${item.taskId}-status-pill">${queueText}</span>
                        </div>
                        <div class="header-right">
                            <div class="item-actions">
                                <button type="button" class="btn-item-action btn-force-start" title="${titleForce}" aria-label="${titleForce}" data-item-action="force-start">
                                    <i class="fa-solid fa-bolt" aria-hidden="true"></i>
                                </button>
                                <button type="button" class="btn-item-action btn-pause-resume" title="${titlePause}" aria-label="${titlePause}" data-item-action="toggle-pause" style="display: none;">
                                    <i class="fa-solid fa-pause" aria-hidden="true"></i>
                                </button>
                                <button type="button" class="btn-item-action btn-cancel" title="${titleCancel}" aria-label="${titleCancel}" data-item-action="cancel">
                                    <i class="fa-solid fa-ban" aria-hidden="true"></i>
                                </button>
                                <button type="button" class="btn-item-action btn-delete" title="${titleDelete}" aria-label="${titleDelete}" data-item-action="delete">
                                    <i class="fa-solid fa-trash" aria-hidden="true"></i>
                                </button>
                            </div>
                            <div class="progress-percentage" id="${item.taskId}-percent">Chờ...</div>
                        </div>
                    </div>
                    <div class="progress-bar-container" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="${item.taskId}-progress-container">
                        <div class="progress-bar-fill" id="${item.taskId}-progress" style="width: 0%;"></div>
                    </div>
                    <div class="progress-stats">
                        <span class="stat-item"><span id="${item.taskId}-speed-label">${speedLabel}</span> <b id="${item.taskId}-speed">${isEn ? "Waiting..." : "Chờ đến lượt"}</b></span>
                        <span class="stat-item"><span id="${item.taskId}-downloaded-label">${downloadedLabel}</span> <b id="${item.taskId}-downloaded">0 B / --</b></span>
                        <span class="stat-item"><span id="${item.taskId}-eta-label">${etaLabel}</span> <b id="${item.taskId}-eta">--:--</b></span>
                    </div>
                </div>
            `;
            downloadList.insertAdjacentHTML('afterbegin', downloadHTML);
        }
    }

    if (window.applyFilter) window.applyFilter();
    else if (window.updateTaskCounter) window.updateTaskCounter();

    // Gửi START_BATCH_DOWNLOAD xuống C# để bắt đầu tải theo hàng đợi (Socket Control)
    const payload = JSON.stringify({
        action: "START_BATCH_DOWNLOAD",
        tasks: taskList.map(t => ({
            taskId: t.taskId,
            url: t.url,
            savePath: t.savePath,
            threads: t.thread,
            thread: t.thread,
            customFileName: t.customFileName
        }))
    });

    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage(payload);
    }

    return taskList.map(t => t.taskId);
}
window.addBatchDownloadTasks = addBatchDownloadTasks;



// Form nhập link tải đơn lẻ

let mainFormValidator = null;



function setupMainValidator() {

    const inputForm = document.querySelector("#input-form");

    if (!inputForm || typeof JustValidate === "undefined") return;



    if (mainFormValidator) {

        try {

            mainFormValidator.destroy();

        } catch (e) {}

    }



    const t = (key, fallback) => (window.i18n && window.i18n.t) ? window.i18n.t(key) : fallback;



    mainFormValidator = new JustValidate("#input-form", {

        errorFieldCssClass: "just-validate-error-field",

        successFieldCssClass: "just-validate-success-field",

        errorLabelCssClass: "just-validate-error-label",

        errorLabelStyle: {

            color: null

        }

    });



    mainFormValidator

        .addField("#url", [

            {

                rule: "required",

                errorMessage: t("validate.url_required", "Vui lòng nhập đường link tải về!")

            },

            {

                validator: (value) => {

                    if (typeof hasUrlPattern === "function" && hasUrlPattern(value)) {

                        const res = expandUrlPattern(value);

                        return !res.error && res.urls.length > 0;

                    }

                    try {

                        const u = new URL(value);

                        return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "ftp:";

                    } catch (e) {

                        return false;

                    }

                },

                errorMessage: t("validate.url_invalid", "Liên kết không hợp lệ! Hãy nhập URL bắt đầu bằng http:// hoặc https://")

            }

        ])

        .addField("#save-path", [

            {

                rule: "required",

                errorMessage: t("validate.save_required", "Vui lòng chọn vị trí lưu file!")

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



            const isPattern = typeof hasUrlPattern === "function" && hasUrlPattern(url);

            if (isPattern) {

                const result = expandUrlPattern(url);

                if (result.error) {

                    if (window.showAppToast) window.showAppToast("Lỗi quy luật: " + result.error);

                    return;

                }



                addBatchDownloadTasks(result.urls, savePath, thread, customFileName);



                const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";

                if (window.showAppToast) {

                    window.showAppToast(isEn

                        ? `Pattern detected! Added ${result.urls.length} tasks to download queue.`

                        : `Đã phát hiện URL quy luật! Tự động sinh ${result.urls.length} tác vụ tải và đưa vào hàng đợi.`);

                }



                if (urlInput) {

                    urlInput.value = '';

                    urlInput.classList.remove("just-validate-success-field", "just-validate-error-field");

                }

                const det = document.getElementById("url-pattern-detector");

                if (det) { det.style.display = "none"; det.classList.remove("show"); }

                if (customNameEl) {

                    customNameEl.value = '';

                    customNameEl.placeholder = (window.i18n && window.i18n.t)

                        ? window.i18n.t("add.custom_name_placeholder")

                        : "Tự động nhận diện từ liên kết (hoặc nhập tên bạn muốn đổi)";

                }

                return;

            }



            addDownloadTask(url, savePath, thread, customFileName);



            if (urlInput) {

                urlInput.value = '';

                urlInput.classList.remove("just-validate-success-field", "just-validate-error-field");

            }

            const det = document.getElementById("url-pattern-detector");

            if (det) { det.style.display = "none"; det.classList.remove("show"); }

            if (customNameEl) {

                customNameEl.value = '';

                customNameEl.placeholder = (window.i18n && window.i18n.t)

                    ? window.i18n.t("add.custom_name_placeholder")

                    : "Tự động nhận diện từ liên kết (hoặc nhập tên bạn muốn đổi)";

            }

            detectedUrlFileName = "";

            isFileNameManuallyEdited = false;

            const btnResetFileName = document.getElementById("btn-reset-filename");

            if (btnResetFileName) btnResetFileName.style.display = "none";



            if (mainFormValidator) {

                try {

                    mainFormValidator.refresh();

                } catch (e) {}

            }

        });



    inputForm.justValidate = mainFormValidator;

}

window.setupMainValidator = setupMainValidator;



// Khởi tạo validator lần đầu

setupMainValidator();

// Lắng nghe phát hiện quy luật URL thời gian thực trên ô nhập liên kết chính
const urlInputMain = document.getElementById("url");
const patternDetector = document.getElementById("url-pattern-detector");
const patternDetectorText = document.getElementById("url-pattern-detector-text");

function checkUrlPatternDetector() {
    if (!urlInputMain || !patternDetector) return;
    const val = (urlInputMain.value || "").trim();
    if (typeof hasUrlPattern === "function" && hasUrlPattern(val)) {
        const res = expandUrlPattern(val);
        if (!res.error && res.urls.length > 0) {
            const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";
            const sampleFirst = res.urls[0].split("/").pop().split("?")[0];
            const sampleLast = res.urls[res.urls.length - 1].split("/").pop().split("?")[0];
            if (patternDetectorText) {
                patternDetectorText.innerHTML = isEn
                    ? `Pattern detected: <b>${res.urls.length} files</b> (${sampleFirst} ... ${sampleLast}). Click Download to queue sequentially.`
                    : `Phát hiện URL quy luật: <b>${res.urls.length} tệp</b> (${sampleFirst} ... ${sampleLast}). Nhấn Bắt đầu tải để tự động đưa vào hàng đợi.`;
            }
            patternDetector.style.display = "flex";
            patternDetector.classList.add("show");
            return;
        }
    }
    patternDetector.style.display = "none";
    patternDetector.classList.remove("show");
}

if (urlInputMain) {
    urlInputMain.addEventListener("input", checkUrlPatternDetector);
    urlInputMain.addEventListener("paste", () => setTimeout(checkUrlPatternDetector, 50));
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



    const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";



    if (kbps && kbps > 0) {

        btn.classList.add("is-limited");

        label.removeAttribute("data-i18n");

        btn.removeAttribute("data-i18n-title");

        if (kbps >= 1024) {

            const mb = (kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1);

            label.textContent = `${mb} MB/s`;

        } else {

            label.textContent = `${kbps} KB/s`;

        }

        btn.title = isEn

            ? `Bandwidth limit: ${label.textContent} (Click to adjust)`

            : `Giới hạn băng thông: ${label.textContent} (Nhấp để điều chỉnh)`;

    } else {

        btn.classList.remove("is-limited");

        label.setAttribute("data-i18n", "header.speed_unlimited");

        btn.setAttribute("data-i18n-title", "header.speed_limit_title");

        label.textContent = (window.i18n && window.i18n.t)

            ? window.i18n.t("header.speed_unlimited")

            : (isEn ? "Unlimited" : "Không giới hạn");

        btn.title = (window.i18n && window.i18n.t)

            ? window.i18n.t("header.speed_limit_title")

            : (isEn ? "Speed limit (Click to adjust)" : "Giới hạn băng thông (Nhấp để điều chỉnh)");

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

    const infoSystem = document.getElementById("proxy-info-system");

    const infoDirect = document.getElementById("proxy-info-direct");

    const isManual = (p.mode !== "system" && p.mode !== "direct");

    if (proxyManualFields) proxyManualFields.style.display = isManual ? "" : "none";

    if (infoSystem) infoSystem.style.display = p.mode === "system" ? "flex" : "none";

    if (infoDirect) infoDirect.style.display = p.mode === "direct" ? "flex" : "none";



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



    // Windows Shell Integration

    const startWithWin = document.getElementById("setting-start-with-windows");

    if (startWithWin) startWithWin.checked = !!s.startWithWindows;



    const minToTray = document.getElementById("setting-minimize-to-tray");

    if (minToTray) minToTray.checked = s.minimizeToTrayOnClose !== false;



    const toastComp = document.getElementById("setting-toast-on-completion");

    if (toastComp) toastComp.checked = s.showToastOnCompletion !== false;



    // Giao diện (Theme)

    const currentTheme = s.theme || localStorage.getItem("app_theme") || "light";

    applyTheme(currentTheme, false);



    // Ngôn ngữ (Language)

    const currentLang = s.language || localStorage.getItem("app_language") || "vi";

    if (window.setLanguage) {

        window.setLanguage(currentLang, false);

    }



    // 4. Tab Lập lịch & Quản lý nguồn điện Windows

    const sched = s.schedule || {};

    const schedEnable = document.getElementById("setting-schedule-enable");

    const schedSub = document.getElementById("schedule-sub-wrap");

    const schedTime = document.getElementById("setting-schedule-time");

    const countdownSec = document.getElementById("setting-countdown-sec");

    const countdownWrap = document.getElementById("countdown-duration-wrap");



    if (schedEnable) schedEnable.checked = !!sched.enabled;

    if (schedSub) schedSub.style.display = sched.enabled ? "block" : "none";

    if (schedTime) schedTime.value = sched.startTime || "01:00";

    if (countdownSec) {
        const val = sched.countdownSeconds || 60;
        countdownSec.value = String(val);
        if (window.updateCountdownPresetHighlight) window.updateCountdownPresetHighlight(val);
    }



    const action = (sched.actionOnComplete || "none").toLowerCase();

    document.querySelectorAll(".power-card").forEach(c => {

        const isMatch = c.dataset.action === action;

        c.classList.toggle("active", isMatch);

        const radio = c.querySelector(".power-radio");

        if (radio) radio.checked = isMatch;

    });

    if (countdownWrap) {

        countdownWrap.style.display = (action === "shutdown" || action === "sleep") ? "block" : "none";

    }



    if (window.updateHeaderScheduleBadge) {

        window.updateHeaderScheduleBadge(sched);

    }

    if (window.updateScheduleStatusText) {

        window.updateScheduleStatusText(sched.enabled, sched.startTime || "01:00");

    }

}

window.populateSettingsForm = populateSettingsForm;



// Áp dụng chế độ giao diện Sáng / Tối / Mặc định hệ thống

function applyTheme(themeSetting, persist = true) {

    const validThemes = ["light", "dark", "system"];

    const theme = validThemes.includes(themeSetting) ? themeSetting : "light";



    let effectiveTheme = theme;

    if (theme === "system") {

        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

        effectiveTheme = prefersDark ? "dark" : "light";

    }



    document.documentElement.setAttribute("data-theme", effectiveTheme);

    document.documentElement.setAttribute("data-theme-setting", theme);



    // Cập nhật radio và class active trên thẻ giao diện

    const targetRadio = document.getElementById(`setting-theme-${theme}`);

    if (targetRadio) targetRadio.checked = true;



    document.querySelectorAll(".theme-option-card").forEach(card => {

        card.classList.toggle("active", card.dataset.themeVal === theme);

    });



    if (persist) {

        try { localStorage.setItem("app_theme", theme); } catch (e) {}

        if (window.chrome && window.chrome.webview) {

            window.chrome.webview.postMessage(JSON.stringify({

                action: "UPDATE_THEME",

                theme: theme

            }));

        }

    }

}

window.applyTheme = applyTheme;



// Khởi chạy kiểm tra theme ngay khi script load

(function initAppTheme() {

    try {

        const savedTheme = localStorage.getItem("app_theme") || "light";

        applyTheme(savedTheme, false);

    } catch (e) {}



    // Lắng nghe thay đổi theme từ hệ thống Windows nếu đang chọn "system"

    if (window.matchMedia) {

        try {

            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {

                const currentSetting = document.documentElement.getAttribute("data-theme-setting") || localStorage.getItem("app_theme") || "light";

                if (currentSetting === "system") {

                    applyTheme("system", false);

                }

            });

        } catch (e) {}

    }

})();



// Bắt sự kiện click chọn thẻ theme trực tiếp (Chỉ xem trước giao diện trong modal, không tự động lưu)

document.addEventListener("click", (e) => {

    const themeCard = e.target.closest(".theme-option-card");

    if (themeCard) {

        const themeVal = themeCard.dataset.themeVal;

        if (themeVal) {

            applyTheme(themeVal, false);

        }

    }

});



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



let modalInitialTheme = "light";

let modalInitialLanguage = "vi";



// Mở modal cài đặt

function openSettingsModal(defaultTab = "tab-queue") {

    const modal = document.getElementById("settings-modal");

    if (!modal) return;



    // Lưu lại theme và ngôn ngữ đang áp dụng để khôi phục nếu người dùng hủy bỏ

    modalInitialTheme = document.documentElement.getAttribute("data-theme-setting") || localStorage.getItem("app_theme") || "light";

    modalInitialLanguage = (window.i18n && window.i18n.getLanguage) ? window.i18n.getLanguage() : (localStorage.getItem("app_language") || "vi");



    // Đổ lại cấu hình hiện tại vào form

    if (currentSettings && window.populateSettingsForm) {

        window.populateSettingsForm(currentSettings);

    }



    // Chuyển tới tab mong muốn

    document.querySelectorAll(".settings-tab-btn").forEach(btn => {

        btn.classList.toggle("active", btn.dataset.tab === defaultTab);

    });

    document.querySelectorAll(".settings-tab-content").forEach(content => {

        content.classList.toggle("active", content.id === defaultTab);

    });

    const tabsContainer = modal.querySelector(".settings-tabs");
    if (tabsContainer) {
        if (defaultTab === "tab-queue") {
            tabsContainer.scrollLeft = 0;
        } else {
            const activeBtn = tabsContainer.querySelector(`.settings-tab-btn[data-tab="${defaultTab}"]`);
            if (activeBtn) {
                activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }
        }
    }



    const statusEl = document.getElementById("proxy-test-status");

    if (statusEl) {

        statusEl.className = "proxy-test-status";

        statusEl.style.display = "none";

    }



    modal.style.display = "flex";

}



function cancelSettingsModal() {

    // Khôi phục lại theme và language đã xem trước

    if (window.applyTheme) {

        window.applyTheme(modalInitialTheme, false);

    }

    if (window.setLanguage) {

        window.setLanguage(modalInitialLanguage, false);

    }

    // Khôi phục lại dữ liệu các trường cài đặt

    if (currentSettings && window.populateSettingsForm) {

        window.populateSettingsForm(currentSettings);

    }

    closeSettingsModal();

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



    // 3. Đóng Cài đặt (Hủy bỏ các thay đổi chưa lưu)

    if (e.target.closest("#btn-close-settings") || e.target.closest("#btn-cancel-settings")) {

        cancelSettingsModal();

        return;

    }



    // Đóng khi click ngoài thẻ card (Hủy bỏ các thay đổi chưa lưu)

    const settingsModal = document.getElementById("settings-modal");

    if (settingsModal && e.target === settingsModal) {

        cancelSettingsModal();

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



    // 6. Thao tác Tab Trình duyệt (Browser Extension)

    if (e.target.closest("#btn-open-extension-folder")) {

        if (window.chrome && window.chrome.webview) {

            window.chrome.webview.postMessage(JSON.stringify({ action: "OPEN_EXTENSION_FOLDER" }));

        }

        return;

    }



    if (e.target.closest("#btn-test-capture")) {

        if (window.chrome && window.chrome.webview) {

            window.chrome.webview.postMessage(JSON.stringify({ action: "TEST_CAPTURE_LINK" }));

        }

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

        const val = e.target.value;

        const manualFields = document.getElementById("proxy-manual-fields");

        const infoSystem = document.getElementById("proxy-info-system");

        const infoDirect = document.getElementById("proxy-info-direct");

        const isManual = (val !== "system" && val !== "direct");

        if (manualFields) manualFields.style.display = isManual ? "" : "none";

        if (infoSystem) infoSystem.style.display = val === "system" ? "flex" : "none";

        if (infoDirect) infoDirect.style.display = val === "direct" ? "flex" : "none";

    });

}



// Bật tắt Xác thực Proxy

const proxyAuthToggle = document.getElementById("setting-proxy-auth");

if (proxyAuthToggle) {

    proxyAuthToggle.addEventListener("change", (e) => {

        const authFields = document.getElementById("proxy-auth-fields");

        if (authFields) authFields.style.display = e.target.checked ? "grid" : "none";

    });

}



// Ẩn / Hiện mật khẩu Proxy

const btnToggleProxyPass = document.getElementById("btn-toggle-proxy-pass");

if (btnToggleProxyPass) {

    btnToggleProxyPass.addEventListener("click", () => {

        const passInput = document.getElementById("setting-proxy-pass");

        if (!passInput) return;

        const isPw = passInput.type === "password";

        passInput.type = isPw ? "text" : "password";

        btnToggleProxyPass.innerHTML = isPw ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';

    });

}



// Kiểm tra kết nối Proxy

const btnTestProxy = document.getElementById("btn-test-proxy");

if (btnTestProxy) {

    btnTestProxy.addEventListener("click", () => {

        const proxyConfig = collectProxyFromForm();
        proxyConfig.enabled = true; // Luôn kiểm tra thông số người dùng vừa nhập



        btnTestProxy.classList.add("loading");

        btnTestProxy.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang kết nối thử nghiệm...</span>';



        const statusEl = document.getElementById("proxy-test-status");

        if (statusEl) {

            statusEl.style.display = "none";

            statusEl.className = "proxy-test-status";

            statusEl.textContent = "";

        }



        if (window.chrome && window.chrome.webview) {

            window.chrome.webview.postMessage(JSON.stringify({

                action: "TEST_PROXY",

                proxy: proxyConfig

            }));

        } else {

            setTimeout(() => {

                btnTestProxy.classList.remove("loading");

                btnTestProxy.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i> <span>Kiểm tra kết nối Proxy</span>';

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



        const themeVal = document.querySelector('input[name="setting-theme"]:checked')?.value || "light";

        applyTheme(themeVal, true);



        const langVal = document.querySelector('input[name="setting-language"]:checked')?.value || "vi";

        if (window.setLanguage) {

            window.setLanguage(langVal, true);

        }



        modalInitialTheme = themeVal;

        modalInitialLanguage = langVal;



        const startWithWindows = document.getElementById("setting-start-with-windows")?.checked ?? false;

        const minimizeToTray = document.getElementById("setting-minimize-to-tray")?.checked ?? true;

        const showToast = document.getElementById("setting-toast-on-completion")?.checked ?? true;



        const newSettings = {

            maxConcurrentDownloads: isNaN(maxConcurrent) ? 2 : maxConcurrent,

            speedLimitKbps: speedKbps,

            proxy: proxy,

            defaultSavePath: document.getElementById("save-path")?.value || currentSettings.defaultSavePath || "",

            defaultThreads: defaultThreads,

            autoStartNextInQueue: autoNext,

            confirmBeforeDelete: confirmBeforeDelete,

            startWithWindows: startWithWindows,

            minimizeToTrayOnClose: minimizeToTray,

            showToastOnCompletion: showToast,

            theme: themeVal,

            language: langVal,

            schedule: {

                enabled: document.getElementById("setting-schedule-enable")?.checked ?? false,

                startTime: document.getElementById("setting-schedule-time")?.value || "01:00",

                actionOnComplete: document.querySelector(".power-card.active")?.dataset.action || "none",

                countdownSeconds: parseInt(document.getElementById("setting-countdown-sec")?.value || "60", 10)

            }

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



    // Nếu ô nhập URL chính đang có nội dung và danh sách đang trống, tự động đưa sang ô danh sách
    const mainUrlInput = document.getElementById("url");
    const textarea = document.getElementById("batch-urls-input");
    if (mainUrlInput && textarea && !textarea.value.trim() && mainUrlInput.value.trim()) {
        textarea.value = mainUrlInput.value.trim();
        updateBatchCount();
    }
    if (textarea) textarea.focus();

}



function closeBatchModal() {

    const modal = document.getElementById("batch-modal");

    if (modal) modal.style.display = "none";

}



/**
 * Sinh danh sách URL từ cú pháp quy luật (Pattern Matching).
 * Hỗ trợ các cú pháp:
 * 1. Dải số nguyên có đệm 0 và bước nhảy: [01-20], [1-50:5], [20-01]
 * 2. Dải chữ cái: [a-z], [A-Z], [a-e:2], [z-a]
 * 3. Danh sách phân tách dấu phẩy: [en,vi,fr], [1080p,720p]
 * 4. Nhiều quy luật lồng nhau (Tích Descartes): vol_[1-2]/ep_[01-03].mp4
 */
function expandUrlPattern(pattern) {
    if (!pattern || !pattern.trim()) return { urls: [], error: "Vui lòng nhập URL mẫu." };
    const trimmed = pattern.trim();
    const bracketRegex = /\[\s*([^\]]+?)\s*\]/;

    function expandRecursive(current, maxCount = 500) {
        const match = current.match(bracketRegex);
        if (!match) return [current];

        const inner = match[1].trim();
        const fullBracket = match[0];
        const replacements = [];

        // 1. Dải số nguyên: [01-20] hoặc [1-20:2] hoặc [20-01]
        const numMatch = inner.match(/^(\d+)\s*-\s*(\d+)(?:\s*:\s*(\d+))?$/);
        if (numMatch) {
            const rawStart = numMatch[1], rawEnd = numMatch[2], rawStep = numMatch[3];
            const start = parseInt(rawStart, 10);
            const end = parseInt(rawEnd, 10);
            const step = rawStep ? Math.max(1, parseInt(rawStep, 10)) : 1;
            const padLen = (rawStart.startsWith("0") || rawEnd.startsWith("0"))
                ? Math.max(rawStart.length, rawEnd.length)
                : 0;

            if (start <= end) {
                for (let i = start; i <= end; i += step) {
                    replacements.push(padLen > 0 ? String(i).padStart(padLen, "0") : String(i));
                    if (replacements.length > maxCount) break;
                }
            } else {
                for (let i = start; i >= end; i -= step) {
                    replacements.push(padLen > 0 ? String(i).padStart(padLen, "0") : String(i));
                    if (replacements.length > maxCount) break;
                }
            }
        } else {
            // 2. Dải chữ cái: [a-z], [A-Z], [a-e:2], [z-a]
            const letterMatch = inner.match(/^([a-zA-Z])\s*-\s*([a-zA-Z])(?:\s*:\s*(\d+))?$/);
            if (letterMatch) {
                const startCode = letterMatch[1].charCodeAt(0);
                const endCode = letterMatch[2].charCodeAt(0);
                const step = letterMatch[3] ? Math.max(1, parseInt(letterMatch[3], 10)) : 1;
                if (startCode <= endCode) {
                    for (let c = startCode; c <= endCode; c += step) {
                        replacements.push(String.fromCharCode(c));
                        if (replacements.length > maxCount) break;
                    }
                } else {
                    for (let c = startCode; c >= endCode; c -= step) {
                        replacements.push(String.fromCharCode(c));
                        if (replacements.length > maxCount) break;
                    }
                }
            } else if (inner.includes(",") && !inner.includes("::")) {
                // 3. Danh sách phân tách phẩy: [en,vi,fr]
                const parts = inner.split(",").map(p => p.trim()).filter(p => p.length > 0);
                replacements.push(...parts);
            } else {
                return [current];
            }
        }

        if (replacements.length === 0) return [current];

        const results = [];
        for (const rep of replacements) {
            const nextStr = current.replace(fullBracket, rep);
            const subResults = expandRecursive(nextStr, maxCount);
            results.push(...subResults);
            if (results.length > maxCount) break;
        }
        return results;
    }

    let expanded;
    try {
        expanded = expandRecursive(trimmed, 500);
    } catch (e) {
        return { urls: [], error: "Lỗi phân tích quy luật URL: " + e.message };
    }

    if (expanded.length === 1 && expanded[0] === trimmed && !bracketRegex.test(trimmed)) {
        try {
            const u = new URL(trimmed);
            if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "ftp:") {
                return { urls: [trimmed], error: null };
            }
        } catch (e) {
            return { urls: [], error: "URL không hợp lệ. Cú pháp: [start-end] hoặc [start-end:step]" };
        }
    }

    if (expanded.length > 500) {
        return { urls: [], error: `Số lượng URL sinh ra quá lớn (${expanded.length}). Giới hạn 500 URL mỗi lần.` };
    }

    const validUrls = [];
    for (const u of expanded) {
        if (/^(https?|ftp):\/\/[^\s]+$/i.test(u)) {
            validUrls.push(u);
        } else {
            return { urls: [], error: `URL sau khi sinh không đúng định dạng: ${u}` };
        }
    }

    return { urls: validUrls, error: null };
}
window.expandUrlPattern = expandUrlPattern;

/**
 * Trích xuất toàn bộ URL hợp lệ từ chuỗi văn bản (hỗ trợ .txt, .csv),
 * tự động nhận diện và mở rộng mọi URL theo quy luật [01-20].
 */
function parseValidUrlsFromText(text) {
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    const valid = [];
    const seen = new Set();
    const urlRegex = /(?:https?|ftp):\/\/[^\s",;<>]+/gi;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;

        let m;
        urlRegex.lastIndex = 0;
        let foundInLine = false;

        while ((m = urlRegex.exec(trimmed)) !== null) {
            foundInLine = true;
            let candidate = m[0].replace(/^[\"']|[\"\',;)]+$/g, "").trim();
            if (!candidate) continue;

            if (typeof hasUrlPattern === "function" && hasUrlPattern(candidate)) {
                const res = expandUrlPattern(candidate);
                if (!res.error && res.urls.length > 0) {
                    res.urls.forEach(u => {
                        if (!seen.has(u)) { seen.add(u); valid.push(u); }
                    });
                } else if (!seen.has(candidate)) {
                    seen.add(candidate);
                    valid.push(candidate);
                }
            } else {
                try {
                    const u = new URL(candidate);
                    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "ftp:") {
                        if (!seen.has(candidate)) {
                            seen.add(candidate);
                            valid.push(candidate);
                        }
                    }
                } catch (e) { }
            }
        }

        if (!foundInLine) {
            const cleaned = trimmed.replace(/^[\"']|[\"\',;)]+$/g, "").trim();
            if (typeof hasUrlPattern === "function" && hasUrlPattern(cleaned)) {
                const res = expandUrlPattern(cleaned);
                if (!res.error && res.urls.length > 0) {
                    res.urls.forEach(u => {
                        if (!seen.has(u)) { seen.add(u); valid.push(u); }
                    });
                }
            }
        }
    });

    return valid;
}
window.parseValidUrlsFromText = parseValidUrlsFromText;



function updateBatchCount() {

    const textarea = document.getElementById("batch-urls-input");

    const badge = document.getElementById("batch-urls-count");

    const submitText = document.getElementById("btn-submit-batch-text");

    if (!textarea || !badge) return;



    const validUrls = parseValidUrlsFromText(textarea.value);

    const count = validUrls.length;

    const isEn = window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === "en";



    if (window.i18n && window.i18n.format) {

        badge.textContent = window.i18n.format("batch.valid_count", count);

    } else {

        badge.textContent = isEn ? `${count} valid links` : `${count} liên kết hợp lệ`;

    }

    badge.classList.toggle("has-items", count > 0);



    if (submitText) {

        const baseSubmit = (window.i18n && window.i18n.t) ? window.i18n.t("batch.submit", isEn ? "Add to Queue" : "Thêm vào hàng đợi") : (isEn ? "Add to Queue" : "Thêm vào hàng đợi");

        const suffix = isEn ? ` (${count} files)` : ` (${count} tệp)`;

        submitText.textContent = count > 0 ? `${baseSubmit}${suffix}` : baseSubmit;

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

        return;

    }

    // Nhập từ file .txt/.csv
    if (e.target.closest("#btn-import-batch-file")) {

        if (window.chrome && window.chrome.webview) {

            window.chrome.webview.postMessage(JSON.stringify({ action: "IMPORT_BATCH_FILE" }));

        }

        return;

    }

    // Xóa toàn bộ danh sách URL
    if (e.target.closest("#btn-clear-batch")) {

        const ta = document.getElementById("batch-urls-input");

        if (ta) { ta.value = ""; updateBatchCount(); }

        return;

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

        const isEn = window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === "en";



        const urls = parseValidUrlsFromText(textarea?.value || "");

        if (urls.length === 0) {

            alert(isEn ? "Please enter at least one valid HTTP/HTTPS link into the list!" : "Vui lòng nhập ít nhất một đường dẫn HTTP/HTTPS hợp lệ vào danh sách!");

            return;

        }



        const savePath = (batchSave?.value || document.getElementById("save-path")?.value || "").trim();

        if (!savePath) {

            alert(isEn ? "Please select a download folder before starting!" : "Vui lòng chọn thư mục lưu tệp trước khi bắt đầu tải!");

            return;

        }



        const thread = parseInt(batchThread?.value || "4", 10) || 4;



        // Thêm hàng loạt vào giao diện và gửi xuống C# với cơ chế điều phối hàng đợi (Queue Scheduling)
        addBatchDownloadTasks(urls, savePath, thread);



        if (window.showAppToast) {

            window.showAppToast(isEn ? `Added ${urls.length} links to the download queue!` : `Đã thêm ${urls.length} liên kết vào hàng đợi tải về!`);

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

    const isEn = window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === "en";



    if (data.isAllDrivesFull) {

        // Tất cả các ổ đều gần đầy hoặc không đủ

        if (iconWrap) {

            iconWrap.className = "disk-space-icon-wrap danger";

        }

        if (icon) {

            icon.className = "fa-solid fa-triangle-exclamation";

        }

        if (titleEl) {

            titleEl.textContent = isEn ? "Insufficient System Storage!" : "Không đủ bộ nhớ toàn hệ thống!";

        }

        if (subtitleEl) {

            subtitleEl.textContent = isEn ? "All drives on your computer are nearly full or out of space" : "Tất cả các ổ đĩa trên máy đều gần đầy hoặc không đủ dung lượng";

        }

        if (msgEl) {

            msgEl.textContent = data.message || (isEn ? "All drives on this computer are full or have insufficient free space. Download has been safely cancelled!" : "Tất cả các ổ đĩa trên thiết bị đều gần đầy hoặc không đủ chỗ trống để chứa tệp này. Quá trình tải đã được tự động huỷ để tránh lỗi hệ thống!");

        }

        if (comparisonEl) {

            comparisonEl.style.display = "none";

        }

        if (btnSwitch) {

            btnSwitch.style.display = "none";

        }

        if (btnClose) {

            btnClose.textContent = isEn ? "Understood" : "Đã hiểu";

        }

    } else {

        // Ổ đích không đủ nhưng có ổ khác đủ -> Đề xuất đổi sang ổ khác

        if (iconWrap) {

            iconWrap.className = "disk-space-icon-wrap warning";

        }

        if (icon) {

            icon.className = "fa-solid fa-hard-drive";

        }

        if (titleEl) {

            titleEl.textContent = isEn ? "Destination Drive Out of Space!" : "Ổ đĩa đích không đủ dung lượng!";

        }

        if (subtitleEl) {

            subtitleEl.textContent = isEn ? "Suggest changing save destination to another drive" : "Đề xuất đổi vị trí lưu tệp sang ổ đĩa khác còn trống";

        }

        if (msgEl) {

            msgEl.textContent = data.message || (isEn ? "The current drive does not have enough free space. Please switch to another drive." : "Ổ đĩa hiện tại không đủ dung lượng trống để lưu tệp. Hãy đổi thư mục lưu sang ổ đĩa khác có đủ chỗ trống.");

        }

        if (comparisonEl) {

            comparisonEl.style.display = "flex";

            const driveWord = isEn ? "Drive" : "Ổ";

            const freeWord = isEn ? "Free" : "Còn";

            if (currentValEl) {

                currentValEl.textContent = `${driveWord} ${data.targetDrive || 'C:'} (${freeWord} ${formatBytesCompact(data.targetFreeBytes)})`;

            }

            if (suggestedValEl) {

                suggestedValEl.textContent = `${driveWord} ${data.suggestedDrive || 'D:'} (${freeWord} ${formatBytesCompact(data.suggestedFreeBytes)})`;

            }

        }

        if (btnSwitch) {

            btnSwitch.style.display = "inline-flex";

            btnSwitch.innerHTML = `<i class="fa-regular fa-folder-open"></i> <span>${isEn ? "Switch Folder Now" : "Đổi thư mục lưu ngay"}</span>`;

        }

        if (btnClose) {

            btnClose.textContent = isEn ? "Later" : "Để sau";

        }

    }



    modal.style.display = "flex";



    if (window.showAppToast) {

        window.showAppToast(data.message, 5000);

    }

};



window.addEventListener("app:languagechange", () => {

    updateBatchCount();

    if (typeof setupMainValidator === "function") {

        setupMainValidator();

    }



    const fileNameInput = document.getElementById("custom-file-name");

    if (fileNameInput && !isFileNameManuallyEdited && !detectedUrlFileName) {

        fileNameInput.placeholder = (window.i18n && window.i18n.t)

            ? window.i18n.t("add.custom_name_placeholder")

            : "Tự động nhận diện từ liên kết (hoặc nhập tên bạn muốn đổi)";

    }

});



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





// ==========================================================================

// Module: Lập lịch tải & Quản lý nguồn điện Windows (Scheduler & Power)

// ==========================================================================



function updateHeaderScheduleBadge(sched) {

    const btn = document.getElementById("btn-header-schedule");

    const label = document.getElementById("header-schedule-label");

    if (!btn || !label) return;



    const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";

    const defaultLabel = isEn ? "Schedule" : "Lập lịch";



    if (sched && sched.enabled) {

        btn.classList.add("is-scheduled");

        const action = sched.actionOnComplete || "none";

        let actionSuffix = "";

        if (action === "shutdown") actionSuffix = isEn ? " (Shutdown)" : " (Tắt máy)";

        else if (action === "sleep") actionSuffix = isEn ? " (Sleep)" : " (Ngủ)";



        label.textContent = `${sched.startTime || "01:00"}${actionSuffix}`;

        btn.title = isEn

            ? `Download scheduler active: starts at ${sched.startTime || "01:00"}${actionSuffix}`

            : `Hẹn giờ tải đang bật: bắt đầu lúc ${sched.startTime || "01:00"}${actionSuffix}`;

    } else {

        btn.classList.remove("is-scheduled");

        label.textContent = defaultLabel;

        btn.title = isEn

            ? "Download Scheduler & Windows Power Management (Click to configure)"

            : "Lập lịch tải & Quản lý nguồn điện Windows (Click để cài đặt)";

    }

}

window.updateHeaderScheduleBadge = updateHeaderScheduleBadge;



function updateScheduleStatusText(enabled, time) {

    const statusText = document.getElementById("schedule-status-text");

    const pulseDot = document.getElementById("schedule-pulse-dot");

    if (!statusText) return;



    const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";



    if (enabled) {

        if (pulseDot) pulseDot.style.display = "inline-block";

        statusText.textContent = isEn

            ? `Waiting until ${time} to automatically start queue...`

            : `Đang chờ đến ${time} để tự động tải danh sách hàng đợi...`;

    } else {

        if (pulseDot) pulseDot.style.display = "none";

        statusText.textContent = isEn

            ? "Download scheduler is currently disabled"

            : "Lập lịch tải hiện đang tắt";

    }

}

window.updateScheduleStatusText = updateScheduleStatusText;



function updateWin32SleepStatus(isSleepPrevented) {

    const badge = document.getElementById("os-sleep-status-badge");

    const text = document.getElementById("os-sleep-status-text");

    if (!badge || !text) return;



    const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";



    if (isSleepPrevented) {

        badge.classList.add("active");

        text.textContent = isEn ? "Active protection (ES_SYSTEM_REQUIRED)" : "Đang bảo vệ (ES_SYSTEM_REQUIRED)";

    } else {

        badge.classList.remove("active");

        text.textContent = isEn ? "Standby (ES_CONTINUOUS)" : "Chế độ chờ (ES_CONTINUOUS)";

    }

}

window.updateWin32SleepStatus = updateWin32SleepStatus;



// Power countdown dialog management

let powerCountdownInterval = null;

let currentCountdownRemaining = 60;

let initialCountdownDuration = 60;



function showPowerCountdownModal(action, remainingSeconds) {

    const modal = document.getElementById("power-countdown-modal");

    const digits = document.getElementById("power-countdown-digits");

    const fill = document.getElementById("power-progress-fill");

    const title = document.getElementById("power-countdown-title");

    const subtitle = document.getElementById("power-countdown-subtitle");

    const icon = document.getElementById("power-pulsing-icon");

    const btnCancel = document.getElementById("btn-cancel-power-action");



    if (!modal) return;



    const isSleep = (action === "sleep");

    const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";



    currentCountdownRemaining = remainingSeconds;

    if (remainingSeconds > initialCountdownDuration) {

        initialCountdownDuration = remainingSeconds;

    }



    if (digits) {

        digits.textContent = String(remainingSeconds);

        digits.classList.toggle("sleep-mode", isSleep);

    }



    if (fill) {

        fill.classList.toggle("sleep-mode", isSleep);

        const percent = Math.max(0, Math.min(100, (remainingSeconds / initialCountdownDuration) * 100));

        fill.style.width = percent + "%";

    }



    if (icon) {

        icon.classList.toggle("sleep-mode", isSleep);

        icon.innerHTML = isSleep ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-power-off"></i>';

    }



    if (title) {

        title.textContent = isEn ? "ALL DOWNLOADS COMPLETED" : "HÀNG ĐỢI TẢI ĐÃ HOÀN TẤT";

    }



    if (subtitle) {

        if (isSleep) {

            subtitle.textContent = isEn ? "Computer will enter Sleep mode in:" : "Máy tính sẽ tự động vào chế độ Ngủ (Sleep) sau:";

        } else {

            subtitle.textContent = isEn ? "Computer will automatically shut down in:" : "Máy tính sẽ tự động tắt nguồn (Shutdown) sau:";

        }

    }



    if (btnCancel) {

        btnCancel.innerHTML = isSleep

            ? '<i class="fa-solid fa-ban"></i> <span>' + (isEn ? "CANCEL SLEEP" : "HỦY CHẾ ĐỘ NGỦ (CANCEL)") + '</span>'

            : '<i class="fa-solid fa-ban"></i> <span>' + (isEn ? "CANCEL SHUTDOWN (ABORT)" : "HỦY TẮT MÁY NGAY (CANCEL)") + '</span>';

    }



    modal.style.display = "flex";

}

window.showPowerCountdownModal = showPowerCountdownModal;



function hidePowerCountdownModal() {

    const modal = document.getElementById("power-countdown-modal");

    if (modal) modal.style.display = "none";

    if (powerCountdownInterval) {

        clearInterval(powerCountdownInterval);

        powerCountdownInterval = null;

    }

}

window.hidePowerCountdownModal = hidePowerCountdownModal;



// Setup Schedule & Power UI Interaction Events

document.addEventListener("DOMContentLoaded", () => {

    // 1. Toggle switch schedule

    const schedEnable = document.getElementById("setting-schedule-enable");

    const schedSub = document.getElementById("schedule-sub-wrap");

    const schedTime = document.getElementById("setting-schedule-time");



    if (schedEnable && schedSub) {

        schedEnable.addEventListener("change", () => {

            schedSub.style.display = schedEnable.checked ? "block" : "none";

            updateScheduleStatusText(schedEnable.checked, schedTime ? schedTime.value : "01:00");

        });

    }



    if (schedTime) {

        schedTime.addEventListener("input", () => {

            const isEnabled = schedEnable ? schedEnable.checked : false;

            updateScheduleStatusText(isEnabled, schedTime.value);

        });

    }



    // 2. Select Power Action Card

    const powerCards = document.querySelectorAll(".power-card");

    const countdownWrap = document.getElementById("countdown-duration-wrap");



    powerCards.forEach(card => {

        card.addEventListener("click", () => {

            powerCards.forEach(c => c.classList.remove("active"));

            card.classList.add("active");

            const radio = card.querySelector(".power-radio");

            if (radio) radio.checked = true;



            const action = card.dataset.action;

            if (countdownWrap) {

                countdownWrap.style.display = (action === "shutdown" || action === "sleep") ? "block" : "none";

            }

        });

    });



    // 3. Test Trigger Schedule Now button

    const btnTestSchedule = document.getElementById("btn-trigger-schedule-now");

    if (btnTestSchedule) {

        btnTestSchedule.addEventListener("click", () => {

            if (window.chrome && window.chrome.webview) {

                window.chrome.webview.postMessage(JSON.stringify({ action: "TRIGGER_SCHEDULE_NOW" }));

            }

            const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";

            if (window.showAppToast) {

                window.showAppToast(isEn ? "Triggering schedule queue immediately..." : "Đang kích hoạt ngay danh sách hàng đợi...");

            }

        });

    }



    // 4. Cancel Power Action (Countdown)


    // Countdown Stepper & Preset Pills
    const countdownInput = document.getElementById("setting-countdown-sec");
    const btnMinus = document.getElementById("btn-countdown-minus");
    const btnPlus = document.getElementById("btn-countdown-plus");
    const presetPills = document.querySelectorAll(".countdown-preset-pill");

    function updateCountdownPresetHighlight(sec) {
        presetPills.forEach(p => {
            const val = parseInt(p.dataset.sec, 10);
            p.classList.toggle("active", val === sec);
        });
    }
    window.updateCountdownPresetHighlight = updateCountdownPresetHighlight;

    if (btnMinus && countdownInput) {
        btnMinus.addEventListener("click", () => {
            let current = parseInt(countdownInput.value, 10) || 60;
            current = Math.max(10, current - 10);
            countdownInput.value = current;
            updateCountdownPresetHighlight(current);
        });
    }

    if (btnPlus && countdownInput) {
        btnPlus.addEventListener("click", () => {
            let current = parseInt(countdownInput.value, 10) || 60;
            current = Math.min(600, current + 10);
            countdownInput.value = current;
            updateCountdownPresetHighlight(current);
        });
    }

    if (countdownInput) {
        countdownInput.addEventListener("input", () => {
            const val = parseInt(countdownInput.value, 10);
            updateCountdownPresetHighlight(val);
        });
    }

    presetPills.forEach(pill => {
        pill.addEventListener("click", () => {
            const sec = parseInt(pill.dataset.sec, 10);
            if (countdownInput) {
                countdownInput.value = sec;
            }
            updateCountdownPresetHighlight(sec);
        });
    });

    const btnCancelPower = document.getElementById("btn-cancel-power-action");

    if (btnCancelPower) {

        btnCancelPower.addEventListener("click", () => {

            if (window.chrome && window.chrome.webview) {

                window.chrome.webview.postMessage(JSON.stringify({ action: "CANCEL_POWER_ACTION" }));

            }

            hidePowerCountdownModal();

        });

    }



    // 5. Execute Power Action Now

    const btnExecNow = document.getElementById("btn-exec-power-now");

    if (btnExecNow) {

        btnExecNow.addEventListener("click", () => {

            if (window.chrome && window.chrome.webview) {

                window.chrome.webview.postMessage(JSON.stringify({ action: "EXECUTE_POWER_ACTION_NOW" }));

            }

            hidePowerCountdownModal();

        });

    }



    // 6. Keyboard Shortcut ESC to cancel power countdown

    document.addEventListener("keydown", (e) => {

        if (e.key === "Escape") {

            const modal = document.getElementById("power-countdown-modal");

            if (modal && modal.style.display !== "none") {

                if (window.chrome && window.chrome.webview) {

                    window.chrome.webview.postMessage(JSON.stringify({ action: "CANCEL_POWER_ACTION" }));

                }

                hidePowerCountdownModal();

            }

        }

    });

});

