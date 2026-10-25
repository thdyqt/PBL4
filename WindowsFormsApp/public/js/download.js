// Xử lý tiến độ tải, các tác vụ Tạm dừng / Tiếp tục / Hủy / Xóa.
// Nhận thông điệp từ C# (DOWNLOAD_PROGRESS, DOWNLOAD_ERROR), gửi lệnh xuống C#.
(function () {
    const hasHost = !!(window.chrome && window.chrome.webview);

    function post(obj) {
        if (hasHost) window.chrome.webview.postMessage(JSON.stringify(obj));
        else console.log("[giả lập gửi xuống C#]", obj);
    }

    // ---------- Toast thông báo nhẹ ----------
    function showToast(msg) {
        let toast = document.querySelector(".app-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "app-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2500);
    }

    // ---------- Modal hộp thoại xác nhận (Confirm Dialog) ----------
    function showConfirmModal({ title, message, htmlContent = null, confirmText, cancelText, danger = false, showDontAskAgain = false, onConfirm }) {
        const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";
        const defConfirm = isEn ? "Confirm" : "Đồng ý";
        const defCancel = isEn ? "Cancel" : "Hủy bỏ";
        const finalConfirm = confirmText || defConfirm;
        const finalCancel = cancelText || defCancel;

        let overlay = document.getElementById("confirm-modal");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "confirm-modal";
            overlay.className = "confirm-modal-overlay";
            overlay.innerHTML = `
                <div class="confirm-modal-box">
                    <div class="confirm-modal-header">
                        <div class="confirm-modal-icon warning" id="confirm-modal-icon">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h3 class="confirm-modal-title" id="confirm-modal-title">Xác nhận</h3>
                    </div>
                    <div class="confirm-modal-body" id="confirm-modal-body">
                        Nội dung xác nhận
                    </div>
                    <div class="confirm-modal-checkbox-row" id="confirm-modal-checkbox-wrap" style="display: none;">
                        <label class="confirm-checkbox-label">
                            <input type="checkbox" id="confirm-modal-dont-ask">
                            <span id="confirm-modal-dont-ask-text">${isEn ? "Don't ask for confirmation again" : "Không hiển thị yêu cầu xác nhận xóa nữa"}</span>
                        </label>
                    </div>
                    <div class="confirm-modal-footer">
                        <button type="button" class="btn-modal-cancel" id="confirm-modal-btn-cancel">${finalCancel}</button>
                        <button type="button" class="btn-modal-confirm" id="confirm-modal-btn-confirm">${finalConfirm}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Đóng khi click ngoài hộp thoại
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) closeConfirmModal();
            });

            // Đóng khi nhấn phím Escape
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && overlay.style.display !== "none") {
                    closeConfirmModal();
                }
            });
        }

        const titleEl = document.getElementById("confirm-modal-title");
        const bodyEl = document.getElementById("confirm-modal-body");
        const iconEl = document.getElementById("confirm-modal-icon");
        const confirmBtn = document.getElementById("confirm-modal-btn-confirm");
        const cancelBtn = document.getElementById("confirm-modal-btn-cancel");
        const chkWrap = document.getElementById("confirm-modal-checkbox-wrap");
        const dontAskChk = document.getElementById("confirm-modal-dont-ask");
        const dontAskText = document.getElementById("confirm-modal-dont-ask-text");

        if (titleEl) titleEl.textContent = title || (isEn ? "Confirmation" : "Xác nhận");
        if (bodyEl) {
            if (htmlContent) {
                bodyEl.innerHTML = htmlContent;
            } else {
                bodyEl.textContent = message || (isEn ? "Are you sure you want to proceed?" : "Bạn có chắc chắn muốn thực hiện thao tác này?");
            }
        }
        if (confirmBtn) {
            confirmBtn.textContent = finalConfirm;
            confirmBtn.className = "btn-modal-confirm" + (danger ? " danger" : "");
        }
        if (cancelBtn) cancelBtn.textContent = finalCancel;
        if (dontAskText) {
            dontAskText.textContent = isEn ? "Don't ask for confirmation again" : "Không hiển thị yêu cầu xác nhận xóa nữa";
        }

        if (iconEl) {
            iconEl.className = "confirm-modal-icon " + (danger ? "danger" : "warning");
            iconEl.innerHTML = danger
                ? '<i class="fa-solid fa-triangle-exclamation"></i>'
                : '<i class="fa-solid fa-circle-question"></i>';
        }

        if (chkWrap) {
            chkWrap.style.display = showDontAskAgain ? "block" : "none";
        }
        if (dontAskChk) {
            dontAskChk.checked = false;
        }

        function closeConfirmModal() {
            overlay.style.display = "none";
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        }

        cancelBtn.onclick = closeConfirmModal;
        confirmBtn.onclick = () => {
            const dontAsk = !!(dontAskChk && dontAskChk.checked);
            closeConfirmModal();
            if (typeof onConfirm === "function") onConfirm(dontAsk);
        };

        overlay.style.display = "flex";
        confirmBtn.focus();
    }

    window.postIpcMessage = post;
    window.showAppToast = showToast;

    // ---------- định dạng hiển thị ----------
    function fmtBytes(n) {
        if (!(n >= 0)) return "--";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let i = 0;
        while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
        return n.toFixed(i === 0 ? 0 : 2) + " " + units[i];
    }

    function fmtEta(sec) {
        if (!(sec >= 0)) return "--:--";
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const pad = (x) => String(x).padStart(2, "0");
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    }

    const STATE_TEXT = {
        queued: "Chờ tải (Trong hàng đợi)",
        preparing: "Đang chuẩn bị...",
        downloading: "Đang tải",
        paused: "Đã tạm dừng",
        completed: "Hoàn thành",
        failed: "Lỗi",
        cancelled: "Đã hủy"
    };

    function getStateText(state) {
        if (window.i18n && window.i18n.t) {
            return window.i18n.t("state." + state, STATE_TEXT[state] || state);
        }
        return STATE_TEXT[state] || state;
    }
    window.getStateText = getStateText;

    // ---------- Đồng bộ các nút Tạm dừng / Tiếp tục trên Header ----------
    function syncHeaderPauseButtons() {
        const items = Array.from(document.querySelectorAll("#download-list .download-item"));
        const activityStatus = document.getElementById("download-activity-status");
        if (activityStatus) {
            const activeItems = items.filter(el =>
                el.dataset.state === "preparing" ||
                el.dataset.state === "downloading" ||
                el.dataset.state === "queued");
            const hasActiveDownload = activeItems.length > 0;
            const statusLabel = activityStatus.querySelector(".status-label");
            activityStatus.classList.toggle("is-downloading", hasActiveDownload);
            if (statusLabel) {
                const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
                const fmt = (k, ...args) => (window.i18n && window.i18n.format) ? window.i18n.format(k, ...args) : `Đang tải ${activeItems.length} tệp`;
                statusLabel.textContent = hasActiveDownload
                    ? fmt("state.downloading_count", activeItems.length)
                    : t("state.ready", "Sẵn sàng tải");
            }
        }

        const headerPauseBtn = document.getElementById("btn-header-pause-all");
        const headerResumeBtn = document.getElementById("btn-header-resume-all");
        if (!headerPauseBtn || !headerResumeBtn) return;

        const hasPausableDownload = items.some(el => el.dataset.state === "downloading" || el.dataset.state === "queued");
        const hasPaused = items.some(el => el.dataset.state === "paused");

        const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
        headerPauseBtn.disabled = !hasPausableDownload;
        headerPauseBtn.title = hasPausableDownload
            ? t("header.pause_all_title", "Tạm dừng tất cả các tệp")
            : t("header.pause_none_title", "Không có tệp nào đang tải để tạm dừng");

        headerResumeBtn.disabled = !hasPaused;
        headerResumeBtn.title = hasPaused
            ? t("header.resume_all_title", "Tiếp tục tất cả các tệp")
            : t("header.resume_none_title", "Không có tệp nào đang tạm dừng để tiếp tục");
    }

    window.addEventListener("app:languagechange", () => {
        const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";
        document.querySelectorAll("#download-list .download-item").forEach(item => {
            const state = item.dataset.state;
            const statusEl = item.querySelector(".download-status");
            if (state && statusEl) {
                if (state === "completed") {
                    const elapsedSec = item.dataset.elapsedTime;
                    const avgSpeed = item.dataset.avgSpeed;
                    const completedAt = item.dataset.completedAt;
                    const thCount = item.querySelectorAll(".segment-bar").length || 1;
                    const threadWord = isEn ? (thCount > 1 ? "threads" : "thread") : "luồng";
                    const completedWord = isEn ? "Completed" : "Hoàn thành";
                    const durationWord = isEn ? "Duration" : "Thời gian";
                    const avgWord = isEn ? "Avg Speed" : "Tốc độ TB";
                    let text = `${completedWord} — ${thCount} ${threadWord}`;
                    if (elapsedSec) {
                        text += ` (${durationWord}: ${elapsedSec}s${avgSpeed ? ` — ${avgWord}: ${avgSpeed}` : ""})`;
                    }
                    if (completedAt) {
                        text += ` • ${completedAt}`;
                    }
                    statusEl.textContent = text;
                } else {
                    statusEl.textContent = getStateText(state);
                }
            }

            const speedLabel = item.querySelector(`[id$="-speed-label"]`);
            if (speedLabel) {
                speedLabel.textContent = state === "completed" ? (isEn ? "Avg Speed:" : "Tốc độ TB:") : (isEn ? "Speed:" : "Tốc độ:");
            }
            const etaLabel = item.querySelector(`[id$="-eta-label"]`);
            if (etaLabel) {
                etaLabel.textContent = state === "completed" ? (isEn ? "Duration:" : "Thời gian tải:") : (isEn ? "ETA:" : "Còn lại:");
            }
            const downloadedLabel = item.querySelector(`[id$="-downloaded-label"]`);
            if (downloadedLabel) {
                downloadedLabel.textContent = isEn ? "Downloaded:" : "Đã tải:";
            }

            const btnOpenFile = item.querySelector(".btn-open-file span");
            if (btnOpenFile) btnOpenFile.textContent = isEn ? "Open File" : "Mở file";
            const btnOpenFolder = item.querySelector(".btn-open-folder span");
            if (btnOpenFolder) btnOpenFolder.textContent = isEn ? "Open Folder" : "Mở thư mục";
        });
        syncHeaderPauseButtons();
    });

    // ---------- cập nhật giao diện tác vụ ----------
    // Bảng màu phân biệt cho từng luồng (tối đa 16 luồng)
    const SEG_PALETTE = [
        "#1E5173", "#0ea5e9", "#6366f1", "#8b5cf6",
        "#ec4899", "#f97316", "#eab308", "#22c55e",
        "#14b8a6", "#06b6d4", "#a855f7", "#f43f5e",
        "#84cc16", "#f59e0b", "#10b981", "#3b82f6"
    ];

    function ensureExtras(item, segmentCount) {
        let status = item.querySelector(".download-status");
        if (!status) {
            status = document.createElement("div");
            status.className = "download-status";
            item.appendChild(status);
        }
        if (segmentCount >= 1 && !item.querySelector(".segment-bars")) {
            const wrap = document.createElement("div");
            wrap.className = "segment-bars";
            for (let i = 0; i < segmentCount; i++) {
                const color = SEG_PALETTE[i % SEG_PALETTE.length];
                const bar = document.createElement("div");
                bar.className = "segment-bar";
                bar.title = `Luồng ${i + 1}: 0%`;
                const fill = document.createElement("div");
                fill.className = "segment-fill";
                fill.style.setProperty("--seg-color", color);
                bar.appendChild(fill);
                wrap.appendChild(bar);
            }
            item.insertBefore(wrap, status);
        }
        return status;
    }

    function applyProgress(d) {
        const item = document.getElementById(d.taskId);
        if (!item) return;

        const status = ensureExtras(item, d.supportsRanges ? (d.segments || []).length : 0);
        const previousState = item.dataset.state;
        const previousFileName = item.dataset.fileName;
        const previousCategory = item.dataset.category;
        item.dataset.state = d.state;
        if (d.targetPath) item.dataset.targetPath = d.targetPath;
        if (d.fileName) item.dataset.fileName = d.fileName;
        if (typeof d.totalBytes === "number" && d.totalBytes > 0) item.dataset.totalBytes = d.totalBytes;
        if (typeof d.downloaded === "number") item.dataset.downloadedBytes = d.downloaded;
        if (typeof d.speed === "number") item.dataset.speed = d.speed;
        if (typeof d.elapsedSeconds === "number" && d.elapsedSeconds > 0) {
            item.dataset.elapsedTime = d.elapsedSeconds.toFixed(1);
        }
        if (d.avgSpeed) item.dataset.avgSpeed = d.avgSpeed;
        if (d.completedAt) item.dataset.completedAt = d.completedAt;

        const nameEl = item.querySelector(".file-name");
        if (nameEl && d.fileName) {
            nameEl.title = d.fileName;
            if (window.highlightFilename && window.getCurrentSearchQuery) {
                window.highlightFilename(nameEl, d.fileName, window.getCurrentSearchQuery());
            } else {
                nameEl.textContent = d.fileName;
            }
            if (window.getFileCategory) {
                const cat = window.getFileCategory(d.fileName);
                item.dataset.category = cat;
                const icon = item.querySelector(".file-info i");
                if (icon) {
                    icon.className = cat === "audio" ? "fa-solid fa-music" :
                                     cat === "video" ? "fa-solid fa-video" :
                                     cat === "document" ? "fa-solid fa-file-zipper" : "fa-solid fa-file";
                }
            }
        }

        // Cập nhật các nút tác vụ trên item: Pause/Resume, Cancel, Delete, Force-start
        let btnForce = item.querySelector('[data-item-action="force-start"]');
        if (!btnForce) {
            btnForce = document.createElement("button");
            btnForce.type = "button";
            btnForce.className = "btn-item-action btn-force-start";
            btnForce.title = "Bắt đầu tải ngay (Bỏ qua hàng đợi)";
            btnForce.dataset.itemAction = "force-start";
            btnForce.innerHTML = '<i class="fa-solid fa-bolt"></i>';
            const actionsWrap = item.querySelector(".item-actions");
            if (actionsWrap) actionsWrap.insertBefore(btnForce, actionsWrap.firstChild);
        }

        const btnPause = item.querySelector('[data-item-action="toggle-pause"]');
        const btnCancel = item.querySelector('[data-item-action="cancel"]');
        const btnDelete = item.querySelector('[data-item-action="delete"]');

        if (d.state === "completed") {
            // Yêu cầu: Khi file hoàn thành thì ẩn Pause và Cancel, chỉ còn được xóa
            if (btnForce) btnForce.style.display = "none";
            if (btnPause) btnPause.style.display = "none";
            if (btnCancel) btnCancel.style.display = "none";
            if (btnDelete) btnDelete.style.display = "inline-flex";
        } else if (d.state === "queued") {
            if (btnForce) btnForce.style.display = "inline-flex";
            if (btnPause) btnPause.style.display = "none";
            if (btnCancel) btnCancel.style.display = "inline-flex";
            if (btnDelete) btnDelete.style.display = "inline-flex";
        } else if (d.state === "paused") {
            if (btnForce) btnForce.style.display = "inline-flex";
            if (btnPause) {
                btnPause.style.display = "inline-flex";
                btnPause.title = "Tiếp tục";
                btnPause.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
            if (btnCancel) btnCancel.style.display = "inline-flex";
            if (btnDelete) btnDelete.style.display = "inline-flex";
        } else if (d.state === "cancelled" || d.state === "failed") {
            if (btnForce) btnForce.style.display = "none";
            if (btnPause) btnPause.style.display = "none";
            if (btnCancel) btnCancel.style.display = "none";
            if (btnDelete) btnDelete.style.display = "inline-flex";
        } else {
            // downloading hoặc preparing
            if (btnForce) btnForce.style.display = "none";
            if (btnPause) {
                btnPause.style.display = "inline-flex";
                btnPause.title = "Tạm dừng";
                btnPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
            }
            if (btnCancel) btnCancel.style.display = "inline-flex";
            if (btnDelete) btnDelete.style.display = "inline-flex";
        }

        const known = d.totalBytes > 0;
        const ratio = known ? Math.min(d.downloaded / d.totalBytes, 1) : 0;
        const percent = d.state === "completed" ? 100 : Math.floor(ratio * 100);

        const set = (suffix, text) => {
            const el = document.getElementById(`${d.taskId}-${suffix}`);
            if (el) el.textContent = text;
        };

        set("percent", known || d.state === "completed" ? percent + "%" : (d.state === "queued" ? "Chờ..." : "..."));
        set("downloaded", `${fmtBytes(d.downloaded)} / ${known ? fmtBytes(d.totalBytes) : "--"}`);

        const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";

        if (d.state === "queued") {
            const speedLabel = document.getElementById(`${d.taskId}-speed-label`);
            if (speedLabel) speedLabel.textContent = isEn ? "Speed:" : "Tốc độ:";
            const etaLabel = document.getElementById(`${d.taskId}-eta-label`);
            if (etaLabel) etaLabel.textContent = isEn ? "ETA:" : "Còn lại:";
            set("speed", isEn ? "Waiting..." : "Chờ đến lượt");
            set("eta", "--:--");
        } else if (d.state === "completed") {
            let elapsedSec = "";
            if (typeof d.elapsedSeconds === "number" && d.elapsedSeconds > 0) {
                elapsedSec = d.elapsedSeconds.toFixed(1);
            } else if (item.dataset.elapsedTime) {
                const parsed = parseFloat(item.dataset.elapsedTime);
                elapsedSec = !isNaN(parsed) && parsed > 0 ? parsed.toFixed(1) : "";
            } else {
                const startTime = parseInt(item.dataset.startTime || Date.now(), 10);
                elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000).toFixed(1);
            }
            if (elapsedSec) {
                item.dataset.elapsedTime = elapsedSec;
            }

            let avgSpeed = d.avgSpeed || item.dataset.avgSpeed;
            if (!avgSpeed && d.totalBytes > 0 && parseFloat(elapsedSec) > 0) {
                avgSpeed = fmtBytes(d.totalBytes / parseFloat(elapsedSec)) + "/s";
            }
            if (avgSpeed) {
                item.dataset.avgSpeed = avgSpeed;
            }

            const speedLabel = document.getElementById(`${d.taskId}-speed-label`);
            if (speedLabel) speedLabel.textContent = isEn ? "Avg Speed:" : "Tốc độ TB:";

            const etaLabel = document.getElementById(`${d.taskId}-eta-label`);
            if (etaLabel) etaLabel.textContent = isEn ? "Duration:" : "Thời gian tải:";

            set("eta", elapsedSec ? elapsedSec + "s" : (isEn ? "Done" : "Hoàn tất"));
            set("speed", avgSpeed ? avgSpeed : "—");
        } else {
            const speedLabel = document.getElementById(`${d.taskId}-speed-label`);
            if (speedLabel) speedLabel.textContent = isEn ? "Speed:" : "Tốc độ:";
            const etaLabel = document.getElementById(`${d.taskId}-eta-label`);
            if (etaLabel) etaLabel.textContent = isEn ? "ETA:" : "Còn lại:";
            set("speed", d.state === "downloading" ? fmtBytes(d.speed) + "/s" : "—");
            set("eta", d.state === "downloading" ? fmtEta(d.etaSeconds) : "--:--");
        }

        const bar = document.getElementById(`${d.taskId}-progress`);
        if (bar) bar.style.width = percent + "%";

        // Thanh tiến độ từng luồng + tooltip realtime
        const bars = item.querySelectorAll(".segment-bar");
        const fills = item.querySelectorAll(".segment-fill");
        (d.segments || []).forEach((seg, i) => {
            const isDone = d.state === "completed";
            const pct = isDone ? 100 : (seg.length > 0 ? Math.floor((seg.downloaded / seg.length) * 100) : 0);
            if (fills[i]) fills[i].style.width = pct + "%";
            if (bars[i]) {
                const doneBytes = isDone && seg.length > 0 ? seg.length : seg.downloaded;
                const doneStr = fmtBytes(doneBytes);
                const totalStr = seg.length > 0 ? fmtBytes(seg.length) : "--";
                const segTitlePrefix = isEn ? "Thread" : "Luồng";
                bars[i].title = `${segTitlePrefix} ${i + 1}: ${pct}% (${doneStr} / ${totalStr})`;
            }
        });

        let text = getStateText(d.state);
        const thCount = d.threads || 1;
        const threadWord = isEn ? (thCount > 1 ? "threads" : "thread") : "luồng";
        if (d.state === "downloading") {
            text += d.supportsRanges
                ? ` — ${thCount} ${threadWord}`
                : (isEn ? " — 1 thread (server doesn't support Range)" : " — 1 luồng (server không hỗ trợ Range)");
        } else if (d.state === "queued") {
            text += ` — ${thCount} ${threadWord}`;
        } else if (d.state === "completed") {
            const elapsedSec = (typeof d.elapsedSeconds === "number" && d.elapsedSeconds > 0)
                ? d.elapsedSeconds.toFixed(1)
                : item.dataset.elapsedTime;
            const avgSpeed = d.avgSpeed || item.dataset.avgSpeed;
            const completedAt = d.completedAt || item.dataset.completedAt || "";
            if (completedAt) item.dataset.completedAt = completedAt;
            const completedWord = isEn ? "Completed" : "Hoàn thành";
            const durationWord = isEn ? "Duration" : "Thời gian";
            const avgWord = isEn ? "Avg Speed" : "Tốc độ TB";
            text = `${completedWord} — ${thCount} ${threadWord}` +
                   (elapsedSec ? ` (${durationWord}: ${elapsedSec}s${avgSpeed ? ` — ${avgWord}: ${avgSpeed}` : ""})` : "") +
                   (completedAt ? ` • ${completedAt}` : "");
        }
        if (d.state === "failed" && d.error) text += ": " + d.error;
        status.textContent = text;
        status.classList.toggle("is-error", d.state === "failed" || d.state === "cancelled");
        status.classList.toggle("is-done", d.state === "completed");

        if (d.state === "completed" && !item.querySelector(".download-actions")) {
            const actions = document.createElement("div");
            actions.className = "download-actions";
            const openFileText = isEn ? "Open File" : "Mở file";
            const openFolderText = isEn ? "Open Folder" : "Mở thư mục";
            actions.innerHTML = `
                <button type="button" class="btn-action btn-open-file" data-action="open-file"><i class="fa-solid fa-arrow-up-right-from-square"></i> <span>${openFileText}</span></button>
                <button type="button" class="btn-action btn-open-folder" data-action="open-folder"><i class="fa-regular fa-folder-open"></i> <span>${openFolderText}</span></button>
            `;
            item.appendChild(actions);
        }

        const metadataChanged = (previousState !== d.state) ||
                                (d.fileName && previousFileName !== d.fileName) ||
                                (previousCategory !== item.dataset.category);
        if (metadataChanged) {
            syncHeaderPauseButtons();
            if (window.applyFilter) window.applyFilter();
        }
    }

    function applyError(msg) {
        const item = document.getElementById(msg.taskId);
        if (!item) { alert(msg.message); return; }
        const status = ensureExtras(item, 0);
        item.dataset.state = "failed";
        status.textContent = "Lỗi: " + msg.message;
        status.classList.add("is-error");
        syncHeaderPauseButtons();
        if (window.applyFilter) window.applyFilter();
    }

    if (hasHost) {
        window.chrome.webview.addEventListener("message", (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.action === "DOWNLOAD_PROGRESS") applyProgress(msg.data);
                else if (msg.action === "DOWNLOAD_ERROR") applyError(msg);
                else if (msg.action === "HISTORY_DATA") {
                    if (Array.isArray(msg.data)) {
                        msg.data.forEach(rec => restoreHistoryItem(rec));
                        window.updateTaskCounter();
                        if (window.applyFilter) window.applyFilter();
                    }
                }
            } catch (e) {
                console.error("Lỗi xử lý thông điệp tiến độ:", e);
            }
        });

        // Chủ động yêu cầu C# nạp lịch sử từ CSDL SQLite
        setTimeout(() => {
            post({ action: "GET_HISTORY" });
        }, 150);
    }

    // ---------- số tác vụ + trạng thái rỗng ----------
    window.updateTaskCounter = function () {
        if (window.applyFilter) {
            window.applyFilter();
        } else {
            const count = document.querySelectorAll("#download-list .download-item").length;
            const badge = document.querySelector(".inner-count-badge");
            if (badge) badge.textContent = `${count} tác vụ`;
            const empty = document.getElementById("empty-state");
            if (empty) empty.style.display = count === 0 ? "" : "none";
        }
        syncHeaderPauseButtons();
    };

    syncHeaderPauseButtons();

    function removeDownloadItems(itemsToDelete, successMsg) {
        if (!itemsToDelete || itemsToDelete.length === 0) return;
        const count = itemsToDelete.length;
        itemsToDelete.forEach(el => {
            post({ action: "REMOVE_DOWNLOAD", taskId: el.id });
            el.remove();
        });
        window.updateTaskCounter();
        syncHeaderPauseButtons();
        if (window.applyFilter) window.applyFilter();
        showToast(successMsg || `Đã xóa ${count} tệp.`);
    }

    // ---------- Xử lý sự kiện click toàn trang ----------
    document.addEventListener("click", (e) => {
        // 1. Thao tác Mở file / Mở thư mục khi hoàn thành
        const actionBtn = e.target.closest(".download-actions .btn-action");
        if (actionBtn) {
            const item = actionBtn.closest(".download-item");
            if (!item) return;
            const action = actionBtn.dataset.action;
            const taskId = item.id;
            const path = item.dataset.targetPath || "";

            if (action === "open-file") {
                post({ action: "OPEN_FILE", taskId: taskId, path: path });
            } else if (action === "open-folder") {
                post({ action: "OPEN_FOLDER", taskId: taskId, path: path });
            }
            return;
        }

        // 2. Thao tác icon trên từng file: Tạm dừng/Tiếp tục, Hủy, Xóa
        const itemActionBtn = e.target.closest(".btn-item-action");
        if (itemActionBtn) {
            e.stopPropagation();
            const item = itemActionBtn.closest(".download-item");
            if (!item) return;
            const taskId = item.id;
            const action = itemActionBtn.dataset.itemAction;
            const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";
            const fileNameElement = item.querySelector(".file-name");
            const fileName = fileNameElement ? fileNameElement.textContent : (isEn ? "this file" : "tệp này");
            if (action === "force-start") {
                post({ action: "FORCE_START_DOWNLOAD", taskId: taskId });
                item.dataset.state = "downloading";
                itemActionBtn.style.display = "none";
                const btnPause = item.querySelector('[data-item-action="toggle-pause"]');
                if (btnPause) {
                    btnPause.style.display = "inline-flex";
                    btnPause.title = isEn ? "Pause" : "Tạm dừng";
                    btnPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
                }
                const st = item.querySelector(".download-status");
                if (st) st.textContent = isEn ? "Starting download..." : "Đang bắt đầu tải ngay...";
                syncHeaderPauseButtons();
                if (window.applyFilter) window.applyFilter();
                return;
            }

            if (action === "toggle-pause") {
                const currentState = item.dataset.state;
                if (currentState === "paused") {
                    post({ action: "RESUME_DOWNLOAD", taskId: taskId });
                    item.dataset.state = "downloading";
                    itemActionBtn.title = isEn ? "Pause" : "Tạm dừng";
                    itemActionBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    const st = item.querySelector(".download-status");
                    if (st) st.textContent = isEn ? "Resuming..." : "Đang tiếp tục...";
                } else {
                    post({ action: "PAUSE_DOWNLOAD", taskId: taskId });
                    item.dataset.state = "paused";
                    itemActionBtn.title = isEn ? "Resume" : "Tiếp tục";
                    itemActionBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                    const st = item.querySelector(".download-status");
                    if (st) st.textContent = isEn ? "Paused" : "Đã tạm dừng";
                    const sp = document.getElementById(`${taskId}-speed`);
                    if (sp) sp.textContent = "—";
                }
                syncHeaderPauseButtons();
                if (window.applyFilter) window.applyFilter();
                return;
            }

            if (action === "cancel") {
                showConfirmModal({
                    title: isEn ? "Confirm Cancel Download" : "Xác nhận hủy tải",
                    message: isEn ? `Are you sure you want to cancel downloading "${fileName}"?` : `Bạn có chắc chắn muốn hủy tải tệp "${fileName}" không?`,
                    confirmText: isEn ? "Cancel Download" : "Hủy tải",
                    danger: true,
                    onConfirm: () => {
                        post({ action: "CANCEL_DOWNLOAD", taskId: taskId });
                        item.dataset.state = "cancelled";
                        const btnPause = item.querySelector('[data-item-action="toggle-pause"]');
                        const btnCancel = item.querySelector('[data-item-action="cancel"]');
                        if (btnPause) btnPause.style.display = "none";
                        if (btnCancel) btnCancel.style.display = "none";
                        const st = item.querySelector(".download-status");
                        if (st) {
                            st.textContent = isEn ? "Cancelled" : "Đã hủy";
                            st.className = "download-status is-error";
                        }
                        const sp = document.getElementById(`${taskId}-speed`);
                        if (sp) sp.textContent = "—";
                        const eta = document.getElementById(`${taskId}-eta`);
                        if (eta) eta.textContent = "--:--";
                        syncHeaderPauseButtons();
                        if (window.applyFilter) window.applyFilter();
                    }
                });
                return;
            }

            if (action === "delete") {
                const doDelete = () => {
                    post({ action: "REMOVE_DOWNLOAD", taskId: taskId });
                    item.remove();
                    window.updateTaskCounter();
                    syncHeaderPauseButtons();
                };

                if (window.shouldConfirmDelete && !window.shouldConfirmDelete()) {
                    doDelete();
                    return;
                }

                const isCompleted = item.dataset.state === "completed";
                const msg = isEn
                    ? (isCompleted
                        ? `Are you sure you want to remove "${fileName}" from the download list?`
                        : `Are you sure you want to delete "${fileName}"? Incomplete file will be stopped and removed from disk.`)
                    : (isCompleted
                        ? `Bạn có chắc chắn muốn xóa "${fileName}" khỏi danh sách tải về?`
                        : `Bạn có chắc chắn muốn xóa tác vụ "${fileName}"? Tệp tải dở dang sẽ bị dừng và xóa khỏi đĩa.`);
                showConfirmModal({
                    title: isEn ? "Confirm Delete Task" : "Xác nhận xóa tác vụ",
                    message: msg,
                    confirmText: isEn ? "Delete" : "Xóa",
                    danger: true,
                    showDontAskAgain: true,
                    onConfirm: (dontAsk) => {
                        if (dontAsk && window.setConfirmBeforeDelete) {
                            window.setConfirmBeforeDelete(false);
                        }
                        doDelete();
                    }
                });
                return;
            }
        }

        // 3. Nút điều khiển chung trên Header (Tạm dừng, Tiếp tục, Hủy, Xóa tất cả)
        const headerBtn = e.target.closest("[data-header-action]");
        if (headerBtn) {
            const headerAction = headerBtn.dataset.headerAction;
            const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";

            if (headerAction === "pause-all") {
                const items = Array.from(document.querySelectorAll("#download-list .download-item"))
                    .filter(el => el.dataset.state === "downloading" || el.dataset.state === "queued");
                if (items.length === 0) {
                    showToast(isEn ? "No files currently downloading to pause." : "Không có tệp nào đang tải để tạm dừng.");
                    return;
                }
                items.forEach(el => {
                    post({ action: "PAUSE_DOWNLOAD", taskId: el.id });
                    el.dataset.state = "paused";
                    const btn = el.querySelector('[data-item-action="toggle-pause"]');
                    if (btn) {
                        btn.title = isEn ? "Resume" : "Tiếp tục";
                        btn.innerHTML = '<i class="fa-solid fa-play"></i>';
                    }
                    const st = el.querySelector(".download-status");
                    if (st) st.textContent = isEn ? "Paused" : "Đã tạm dừng";
                    const sp = document.getElementById(`${el.id}-speed`);
                    if (sp) sp.textContent = "—";
                });
                syncHeaderPauseButtons();
                if (window.applyFilter) window.applyFilter();
                return;
            }

            if (headerAction === "resume-all") {
                const items = Array.from(document.querySelectorAll("#download-list .download-item"))
                    .filter(el => el.dataset.state === "paused");
                if (items.length === 0) {
                    showToast(isEn ? "No paused files to resume." : "Không có tệp nào đang tạm dừng để tiếp tục.");
                    return;
                }
                items.forEach(el => {
                    post({ action: "RESUME_DOWNLOAD", taskId: el.id });
                    el.dataset.state = "downloading";
                    const btn = el.querySelector('[data-item-action="toggle-pause"]');
                    if (btn) {
                        btn.title = isEn ? "Pause" : "Tạm dừng";
                        btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    }
                    const st = el.querySelector(".download-status");
                    if (st) st.textContent = isEn ? "Downloading..." : "Đang tải...";
                });
                syncHeaderPauseButtons();
                if (window.applyFilter) window.applyFilter();
                return;
            }

            if (headerAction === "cancel-all") {
                const items = Array.from(document.querySelectorAll("#download-list .download-item"))
                    .filter(el => el.dataset.state !== "completed" && el.dataset.state !== "cancelled");
                if (items.length === 0) {
                    showToast(isEn ? "No files currently downloading to cancel." : "Không có tệp nào đang tải để hủy.");
                    return;
                }
                showConfirmModal({
                    title: isEn ? "Confirm Cancel All" : "Xác nhận hủy tất cả",
                    message: isEn ? `Are you sure you want to cancel all (${items.length}) downloading files?` : `Bạn có chắc chắn muốn hủy tất cả (${items.length}) tệp đang tải không?`,
                    confirmText: isEn ? "Cancel All" : "Hủy tất cả",
                    danger: true,
                    onConfirm: () => {
                        items.forEach(el => {
                            post({ action: "CANCEL_DOWNLOAD", taskId: el.id });
                            el.dataset.state = "cancelled";
                            const btnPause = el.querySelector('[data-item-action="toggle-pause"]');
                            const btnCancel = el.querySelector('[data-item-action="cancel"]');
                            if (btnPause) btnPause.style.display = "none";
                            if (btnCancel) btnCancel.style.display = "none";
                            const st = el.querySelector(".download-status");
                            if (st) {
                                st.textContent = isEn ? "Cancelled" : "Đã hủy";
                                st.className = "download-status is-error";
                            }
                            const sp = document.getElementById(`${el.id}-speed`);
                            if (sp) sp.textContent = "—";
                            const eta = document.getElementById(`${el.id}-eta`);
                            if (eta) eta.textContent = "--:--";
                        });
                        syncHeaderPauseButtons();
                        if (window.applyFilter) window.applyFilter();
                    }
                });
                return;
            }

            if (headerAction === "delete-all") {
                const FILTER_NAMES = {
                    home: "Tệp gần đây",
                    all: "Tất cả",
                    downloading: "Đang tải",
                    completed: "Đã hoàn thành",
                    audio: "Âm thanh",
                    video: "Video",
                    document: "Tài liệu & Nén"
                };
                const FILTER_NAMES_EN = {
                    home: "Recent Files",
                    all: "All Files",
                    downloading: "Downloading",
                    completed: "Completed",
                    audio: "Audio",
                    video: "Video",
                    document: "Archives & Docs"
                };
                const currentFilter = (window.getCurrentFilter && window.getCurrentFilter()) || "all";
                const categoryLabel = isEn ? (FILTER_NAMES_EN[currentFilter] || "Current Section") : (FILTER_NAMES[currentFilter] || "Mục hiện tại");

                // Chỉ lấy các file đang hiển thị trong mục hiện tại
                const visibleItems = Array.from(document.querySelectorAll("#download-list .download-item"))
                    .filter(el => el.style.display !== "none");

                if (visibleItems.length === 0) {
                    showToast(isEn ? "No files in this category to delete." : "Không có tệp nào trong mục này để xóa.");
                    return;
                }

                // Kiểm tra xem có file nào được click chọn (selected) trong danh sách hiển thị không
                const selectedItems = visibleItems.filter(el => el.classList.contains("selected"));

                if (selectedItems.length > 0) {
                    // Nếu có lựa chọn 1 hay nhiều file -> chỉ xóa những file được lựa chọn
                    const doDeleteSelected = () => {
                        removeDownloadItems(selectedItems, isEn ? `Deleted ${selectedItems.length} selected files.` : `Đã xóa ${selectedItems.length} tệp đã chọn.`);
                    };

                    if (window.shouldConfirmDelete && !window.shouldConfirmDelete()) {
                        doDeleteSelected();
                        return;
                    }

                    showConfirmModal({
                        title: isEn ? "Confirm Delete Selected Files" : "Xác nhận xóa tệp đã chọn",
                        message: isEn
                            ? `Are you sure you want to remove ${selectedItems.length} selected files in "${categoryLabel}" from the list? Incomplete downloads will be stopped and deleted.`
                            : `Bạn có chắc chắn muốn xóa ${selectedItems.length} tệp đã chọn trong mục "${categoryLabel}" khỏi danh sách không? Các tệp đang tải dở dang sẽ bị dừng và xóa khỏi đĩa.`,
                        confirmText: isEn ? `Delete (${selectedItems.length})` : `Xóa (${selectedItems.length})`,
                        danger: true,
                        showDontAskAgain: true,
                        onConfirm: (dontAsk) => {
                            if (dontAsk && window.setConfirmBeforeDelete) {
                                window.setConfirmBeforeDelete(false);
                            }
                            doDeleteSelected();
                        }
                    });
                    return;
                }

                // Nếu không có file nào được chọn -> hiển thị hộp thoại chọn phạm vi xóa
                const completedItems = visibleItems.filter(el => el.dataset.state === "completed");
                const downloadingItems = visibleItems.filter(el =>
                    el.dataset.state === "downloading" ||
                    el.dataset.state === "queued" ||
                    el.dataset.state === "preparing" ||
                    el.dataset.state === "paused"
                );
                const cancelledItems = visibleItems.filter(el =>
                    el.dataset.state === "cancelled" ||
                    el.dataset.state === "failed"
                );
                const totalCount = visibleItems.length;

                let defaultChoice = "all";
                if (completedItems.length > 0) {
                    defaultChoice = "completed";
                } else if (cancelledItems.length > 0) {
                    defaultChoice = "cancelled";
                } else if (downloadingItems.length > 0) {
                    defaultChoice = "downloading";
                }

                const descText = isEn
                    ? `You are in <strong>${categoryLabel}</strong>. Please select which files to delete:`
                    : `Bạn đang ở mục <strong>${categoryLabel}</strong>. Vui lòng chọn loại tệp muốn xóa:`;
                const optDoneTitle = isEn ? "Delete all completed files" : "Xóa tất cả các file đã tải";
                const optDownloadingTitle = isEn ? "Delete all downloading files" : "Xóa tất cả các file đang tải";
                const optCancelledTitle = isEn ? "Delete all cancelled files" : "Xóa tất cả các file đã hủy";
                const optAllTitle = isEn ? "Delete all files" : "Xóa toàn bộ file";
                const badgeWord = isEn ? "files" : "tệp";
                const warningText = isEn ? "Incomplete download files will be stopped and removed from disk." : "Các tệp đang tải dở dang sẽ bị dừng và xóa khỏi đĩa.";

                const modalHtml = `
                    <div class="delete-all-prompt">
                        <div class="delete-all-desc">
                            ${descText}
                        </div>
                        <div class="delete-options-list">
                            <label class="delete-option-item ${completedItems.length === 0 ? "disabled" : ""}">
                                <input type="radio" name="deleteScope" value="completed" ${defaultChoice === "completed" ? "checked" : ""} ${completedItems.length === 0 ? "disabled" : ""}>
                                <div class="delete-option-text">
                                    <span class="delete-option-title">
                                        <i class="fa-solid fa-circle-check" style="color: #10B981;"></i>
                                        ${optDoneTitle}
                                    </span>
                                    <span class="delete-option-badge">${completedItems.length} ${badgeWord}</span>
                                </div>
                            </label>
                            <label class="delete-option-item ${downloadingItems.length === 0 ? "disabled" : ""}">
                                <input type="radio" name="deleteScope" value="downloading" ${defaultChoice === "downloading" ? "checked" : ""} ${downloadingItems.length === 0 ? "disabled" : ""}>
                                <div class="delete-option-text">
                                    <span class="delete-option-title">
                                        <i class="fa-solid fa-arrows-rotate" style="color: #0EA5E9;"></i>
                                        ${optDownloadingTitle}
                                    </span>
                                    <span class="delete-option-badge">${downloadingItems.length} ${badgeWord}</span>
                                </div>
                            </label>
                            <label class="delete-option-item ${cancelledItems.length === 0 ? "disabled" : ""}">
                                <input type="radio" name="deleteScope" value="cancelled" ${defaultChoice === "cancelled" ? "checked" : ""} ${cancelledItems.length === 0 ? "disabled" : ""}>
                                <div class="delete-option-text">
                                    <span class="delete-option-title">
                                        <i class="fa-solid fa-ban" style="color: #F97316;"></i>
                                        ${optCancelledTitle}
                                    </span>
                                    <span class="delete-option-badge">${cancelledItems.length} ${badgeWord}</span>
                                </div>
                            </label>
                            <label class="delete-option-item">
                                <input type="radio" name="deleteScope" value="all" ${defaultChoice === "all" ? "checked" : ""}>
                                <div class="delete-option-text">
                                    <span class="delete-option-title">
                                        <i class="fa-solid fa-trash-can" style="color: #EF4444;"></i>
                                        ${optAllTitle}
                                    </span>
                                    <span class="delete-option-badge">${totalCount} ${badgeWord}</span>
                                </div>
                            </label>
                        </div>
                        <div class="delete-warning-note">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <span>${warningText}</span>
                        </div>
                    </div>
                `;

                showConfirmModal({
                    title: isEn ? `Delete Options (${categoryLabel})` : `Tùy chọn xóa tệp (${categoryLabel})`,
                    htmlContent: modalHtml,
                    confirmText: isEn ? "Delete" : "Xóa",
                    danger: true,
                    showDontAskAgain: true,
                    onConfirm: (dontAsk) => {
                        const selectedScope = document.querySelector('input[name="deleteScope"]:checked')?.value || "all";
                        let targetItems = [];
                        let labelMsg = "";
                        if (selectedScope === "completed") {
                            targetItems = completedItems;
                            labelMsg = isEn ? `Deleted ${targetItems.length} completed files in ${categoryLabel}.` : `Đã xóa ${targetItems.length} tệp đã tải trong mục ${categoryLabel}.`;
                        } else if (selectedScope === "downloading") {
                            targetItems = downloadingItems;
                            labelMsg = isEn ? `Deleted ${targetItems.length} downloading files in ${categoryLabel}.` : `Đã xóa ${targetItems.length} tệp đang tải trong mục ${categoryLabel}.`;
                        } else if (selectedScope === "cancelled") {
                            targetItems = cancelledItems;
                            labelMsg = isEn ? `Deleted ${targetItems.length} cancelled files in ${categoryLabel}.` : `Đã xóa ${targetItems.length} tệp đã hủy trong mục ${categoryLabel}.`;
                        } else {
                            targetItems = visibleItems;
                            labelMsg = isEn ? `Deleted all ${targetItems.length} files in ${categoryLabel}.` : `Đã xóa toàn bộ ${targetItems.length} tệp trong mục ${categoryLabel}.`;
                        }

                        if (targetItems.length === 0) {
                            showToast(isEn ? "No matching files to delete." : "Không có tệp nào phù hợp để xóa.");
                            return;
                        }

                        if (dontAsk && window.setConfirmBeforeDelete) {
                            window.setConfirmBeforeDelete(false);
                        }

                        removeDownloadItems(targetItems, labelMsg);
                    }
                });
                return;
            }
        }

        // 4. Chọn tác vụ khi click vào thẻ download-item (tránh chọn khi click nút thao tác)
        const item = e.target.closest(".download-item");
        if (item && !e.target.closest("button") && !e.target.closest("a")) {
            item.classList.toggle("selected");
        }
    });

    // ------------------------------------------------------------------ Restore lịch sử từ DB

    /**
     * Render một bản ghi DownloadRecord từ SQLite thành DOM item.
     * Gọi khi app khởi động để hiển thị lại lịch sử tải từ lần trước.
     * @param {Object} rec - DownloadRecord (camelCase từ JSON C#)
     */
    function restoreHistoryItem(rec) {
        // Bỏ qua nếu đã có item này trong DOM (tránh duplicate)
        if (document.getElementById(rec.id)) return;

        const fileName = rec.fileName || rec.id;
        const category = window.getFileCategory ? window.getFileCategory(fileName) : "other";
        let iconClass = "fa-solid fa-file";
        if (category === "audio") iconClass = "fa-solid fa-music";
        else if (category === "video") iconClass = "fa-solid fa-video";
        else if (category === "document") iconClass = "fa-solid fa-file-zipper";

        const state = rec.state || "failed";

        // Ẩn nút tùy theo trạng thái khôi phục
        const showPause   = state === "paused";
        const showCancel  = state === "paused";
        const showForce   = state === "paused" || state === "queued";
        const showActions = state === "completed";

        const pct = (rec.totalBytes > 0 && rec.downloaded >= 0)
            ? Math.min(100, Math.floor(rec.downloaded / rec.totalBytes * 100))
            : (state === "completed" ? 100 : 0);

        const fmtB = (n) => {
            if (!(n > 0)) return "--";
            const u = ["B","KB","MB","GB"]; let i = 0;
            while (n >= 1024 && i < u.length-1) { n /= 1024; i++; }
            return n.toFixed(i === 0 ? 0 : 2) + " " + u[i];
        };

        const stateText = getStateText(state);
        const isEn = window.i18n && window.i18n.getCurrentLanguage && window.i18n.getCurrentLanguage() === "en";

        const threadCount = rec.threads || 1;
        const elapsedSec = rec.elapsedSeconds > 0 ? rec.elapsedSeconds.toFixed(1) : "";
        const avgSpeed = rec.avgSpeed || ((rec.totalBytes > 0 && parseFloat(elapsedSec) > 0)
            ? fmtB(rec.totalBytes / parseFloat(elapsedSec)) + "/s"
            : "");
        const completedAt = rec.completedAt || "";

        let statusText = stateText;
        if (state === "completed") {
            const threadWord = isEn ? (threadCount > 1 ? "threads" : "thread") : "luồng";
            const completedWord = isEn ? "Completed" : "Hoàn thành";
            const durationWord = isEn ? "Duration" : "Thời gian";
            const avgWord = isEn ? "Avg Speed" : "Tốc độ TB";
            statusText = `${completedWord} — ${threadCount} ${threadWord}`;
            if (elapsedSec) {
                statusText += ` (${durationWord}: ${elapsedSec}s${avgSpeed ? ` — ${avgWord}: ${avgSpeed}` : ""})`;
            }
            if (completedAt) {
                statusText += ` • ${completedAt}`;
            }
        } else if (rec.errorMessage) {
            statusText += ": " + rec.errorMessage;
        }

        let segmentBarsHtml = "";
        if (state === "completed" && threadCount >= 1) {
            segmentBarsHtml = `<div class="segment-bars">`;
            for (let i = 0; i < threadCount; i++) {
                const color = SEG_PALETTE[i % SEG_PALETTE.length];
                const segTitle = isEn ? `Thread ${i + 1}: 100%` : `Luồng ${i + 1}: 100%`;
                segmentBarsHtml += `
                    <div class="segment-bar" title="${segTitle}">
                        <div class="segment-fill" style="width: 100%; --seg-color: ${color};"></div>
                    </div>`;
            }
            segmentBarsHtml += `</div>`;
        }

        const openFileText = isEn ? "Open File" : "Mở file";
        const openFolderText = isEn ? "Open Folder" : "Mở thư mục";
        const openFileBtn = state === "completed" ? `
            <div class="download-actions">
                <button type="button" class="btn-action btn-open-file" data-action="open-file">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> <span>${openFileText}</span>
                </button>
                <button type="button" class="btn-action btn-open-folder" data-action="open-folder">
                    <i class="fa-regular fa-folder-open"></i> <span>${openFolderText}</span>
                </button>
            </div>` : "";

        const createdAtTs = rec.createdAt ? new Date(rec.createdAt).getTime() : Date.now();
        const safeFileName = (fileName || "").replace(/"/g, "&quot;");
        const safeTargetPath = (rec.targetPath || "").replace(/"/g, "&quot;");
        const safeSourceUrl = (rec.sourceUrl || "").replace(/"/g, "&quot;");

        const html = `
            <div class="download-item" id="${rec.id}"
                 data-state="${state}"
                 data-category="${category}"
                 data-file-name="${safeFileName}"
                 data-created-at="${createdAtTs}"
                 data-total-bytes="${rec.totalBytes || 0}"
                 data-downloaded-bytes="${rec.downloaded || 0}"
                 data-elapsed-time="${elapsedSec || 0}"
                 data-avg-speed="${avgSpeed}"
                 data-speed="0"
                 data-completed-at="${completedAt}"
                 data-source-url="${safeSourceUrl}"
                 data-target-path="${safeTargetPath}">
                <div class="progress-header">
                    <div class="file-info">
                        <i class="${iconClass}"></i>
                        <span class="file-name" title="${safeFileName}">${safeFileName}</span>
                    </div>
                    <div class="header-right">
                        <div class="item-actions">
                            <button type="button" class="btn-item-action btn-force-start"
                                    title="${isEn ? "Start now (Bypass queue)" : "Bắt đầu tải ngay (Bỏ qua hàng đợi)"}"
                                    data-item-action="force-start"
                                    style="display:${showForce ? "inline-flex" : "none"};">
                                <i class="fa-solid fa-bolt"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-pause-resume"
                                    title="${showPause ? (isEn ? "Resume" : "Tiếp tục") : (isEn ? "Pause" : "Tạm dừng")}"
                                    data-item-action="toggle-pause"
                                    style="display:${showPause ? "inline-flex" : "none"};">
                                <i class="fa-solid ${showPause ? "fa-play" : "fa-pause"}"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-cancel"
                                    title="${isEn ? "Cancel download" : "Hủy tải"}" data-item-action="cancel"
                                    style="display:${showCancel ? "inline-flex" : "none"};">
                                <i class="fa-solid fa-ban"></i>
                            </button>
                            <button type="button" class="btn-item-action btn-delete"
                                    title="${isEn ? "Delete" : "Xóa"}" data-item-action="delete"
                                    style="display:inline-flex;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                        <div class="progress-percentage" id="${rec.id}-percent">
                            ${pct}%
                        </div>
                    </div>
                </div>

                <div class="progress-bar-container">
                    <div class="progress-bar-fill" id="${rec.id}-progress" style="width:${pct}%"></div>
                </div>

                <div class="progress-stats">
                    <span class="stat-item"><span id="${rec.id}-speed-label">${state === "completed" ? (isEn ? "Avg Speed:" : "Tốc độ TB:") : (isEn ? "Speed:" : "Tốc độ:")}</span> <b id="${rec.id}-speed">${state === "completed" ? (avgSpeed || "—") : "—"}</b></span>
                    <span class="stat-item"><span id="${rec.id}-downloaded-label">${isEn ? "Downloaded:" : "Đã tải:"}</span> <b id="${rec.id}-downloaded">
                        ${fmtB(rec.downloaded)} / ${rec.totalBytes > 0 ? fmtB(rec.totalBytes) : fmtB(rec.downloaded)}
                    </b></span>
                    <span class="stat-item">
                        <span id="${rec.id}-eta-label">${state === "completed" ? (isEn ? "Duration:" : "Thời gian tải:") : (isEn ? "ETA:" : "Còn lại:")}</span>
                        <b id="${rec.id}-eta">${state === "completed" ? (elapsedSec ? elapsedSec + "s" : (isEn ? "Done" : "Hoàn tất")) : "--:--"}</b>
                    </span>
                </div>

                ${segmentBarsHtml}

                <div class="download-status ${state === "failed" || state === "cancelled" ? "is-error" : ""} ${state === "completed" ? "is-done" : ""}">
                    ${statusText}
                </div>

                ${openFileBtn}
            </div>`;

        const list = document.getElementById("download-list");
        if (list) {
            const emptyState = document.getElementById("empty-state");
            if (emptyState) emptyState.style.display = "none";
            list.insertAdjacentHTML("beforeend", html);
        }
    }

    window.restoreHistoryItem = restoreHistoryItem;

})();
