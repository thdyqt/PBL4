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
    function showConfirmModal({ title, message, confirmText = "Đồng ý", cancelText = "Hủy bỏ", danger = false, onConfirm }) {
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
                    <div class="confirm-modal-footer">
                        <button type="button" class="btn-modal-cancel" id="confirm-modal-btn-cancel">Hủy bỏ</button>
                        <button type="button" class="btn-modal-confirm" id="confirm-modal-btn-confirm">Đồng ý</button>
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

        if (titleEl) titleEl.textContent = title || "Xác nhận";
        if (bodyEl) bodyEl.textContent = message || "Bạn có chắc chắn muốn thực hiện thao tác này?";
        if (confirmBtn) {
            confirmBtn.textContent = confirmText;
            confirmBtn.className = "btn-modal-confirm" + (danger ? " danger" : "");
        }
        if (cancelBtn) cancelBtn.textContent = cancelText;

        if (iconEl) {
            iconEl.className = "confirm-modal-icon " + (danger ? "danger" : "warning");
            iconEl.innerHTML = danger
                ? '<i class="fa-solid fa-triangle-exclamation"></i>'
                : '<i class="fa-solid fa-circle-question"></i>';
        }

        function closeConfirmModal() {
            overlay.style.display = "none";
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        }

        cancelBtn.onclick = closeConfirmModal;
        confirmBtn.onclick = () => {
            closeConfirmModal();
            if (typeof onConfirm === "function") onConfirm();
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

    // ---------- Đồng bộ nút Tạm dừng / Tiếp tục trên Header ----------
    function syncHeaderPauseButton() {
        const headerPauseBtn = document.getElementById("btn-header-pause-all");
        if (!headerPauseBtn) return;

        const items = Array.from(document.querySelectorAll("#download-list .download-item"));
        const hasDownloading = items.some(el => el.dataset.state === "downloading" || el.dataset.state === "preparing" || el.dataset.state === "queued");
        const hasPaused = items.some(el => el.dataset.state === "paused");

        if (hasDownloading) {
            headerPauseBtn.dataset.headerAction = "pause-all";
            headerPauseBtn.title = "Tạm dừng tất cả các tệp";
            headerPauseBtn.classList.remove("btn-resume");
            headerPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Tạm dừng tất cả</span>';
        } else if (hasPaused) {
            headerPauseBtn.dataset.headerAction = "resume-all";
            headerPauseBtn.title = "Tiếp tục tất cả các tệp";
            headerPauseBtn.classList.add("btn-resume");
            headerPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Tiếp tục tất cả</span>';
        } else {
            headerPauseBtn.dataset.headerAction = "pause-all";
            headerPauseBtn.title = "Tạm dừng tất cả các tệp";
            headerPauseBtn.classList.remove("btn-resume");
            headerPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Tạm dừng tất cả</span>';
        }
    }

    // ---------- cập nhật giao diện tác vụ ----------
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
                wrap.insertAdjacentHTML("beforeend", '<div class="segment-bar"><div class="segment-fill"></div></div>');
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
        item.dataset.state = d.state;
        if (d.targetPath) item.dataset.targetPath = d.targetPath;

        const nameEl = item.querySelector(".file-name");
        if (nameEl && d.fileName) {
            nameEl.textContent = d.fileName;
            nameEl.title = d.fileName;
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

        if (d.state === "queued") {
            set("speed", "Chờ đến lượt");
            set("eta", "--:--");
        } else if (d.state === "completed") {
            if (!item.dataset.elapsedTime) {
                let elapsedSec = "0.0";
                if (typeof d.elapsedSeconds === "number" && d.elapsedSeconds > 0) {
                    elapsedSec = d.elapsedSeconds.toFixed(1);
                } else {
                    const startTime = parseInt(item.dataset.startTime || Date.now(), 10);
                    elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000).toFixed(1);
                }
                item.dataset.elapsedTime = elapsedSec;

                const avgSpeedStr = (d.totalBytes > 0 && parseFloat(elapsedSec) > 0)
                    ? fmtBytes(d.totalBytes / parseFloat(elapsedSec)) + "/s"
                    : "";
                item.dataset.avgSpeed = avgSpeedStr;

                console.log(`[KẾT QUẢ TẢI] Tệp: ${d.fileName || "unknown"} | Số luồng: ${d.threads} | Dung lượng: ${fmtBytes(d.totalBytes)} | Thời gian: ${elapsedSec}s${avgSpeedStr ? ` | Tốc độ TB: ${avgSpeedStr}` : ""}`);
            }

            const elapsedSec = item.dataset.elapsedTime;
            const avgSpeed = item.dataset.avgSpeed;

            const etaLabel = document.getElementById(`${d.taskId}-eta-label`);
            if (etaLabel) etaLabel.textContent = "Thời gian tải:";

            set("eta", elapsedSec ? elapsedSec + "s" : "--:--");
            set("speed", avgSpeed ? avgSpeed : "—");
        } else {
            set("speed", d.state === "downloading" ? fmtBytes(d.speed) + "/s" : "—");
            set("eta", d.state === "downloading" ? fmtEta(d.etaSeconds) : "--:--");
        }

        const bar = document.getElementById(`${d.taskId}-progress`);
        if (bar) bar.style.width = percent + "%";

        // Thanh tiến độ từng luồng
        const fills = item.querySelectorAll(".segment-fill");
        (d.segments || []).forEach((seg, i) => {
            if (fills[i]) fills[i].style.width = (seg.length > 0 ? (seg.downloaded / seg.length) * 100 : 0) + "%";
        });

        let text = STATE_TEXT[d.state] || d.state;
        if (d.state === "downloading") {
            text += d.supportsRanges
                ? ` — ${d.threads} luồng`
                : " — 1 luồng (server không hỗ trợ Range)";
        } else if (d.state === "queued") {
            text += ` — ${d.threads} luồng`;
        } else if (d.state === "completed") {
            const elapsedSec = item.dataset.elapsedTime;
            const avgSpeed = item.dataset.avgSpeed;
            text = `Hoàn thành — ${d.threads} luồng` +
                   (elapsedSec ? ` (Thời gian: ${elapsedSec}s${avgSpeed ? ` — Tốc độ TB: ${avgSpeed}` : ""})` : "");
        }
        if (d.state === "failed" && d.error) text += ": " + d.error;
        status.textContent = text;
        status.classList.toggle("is-error", d.state === "failed" || d.state === "cancelled");
        status.classList.toggle("is-done", d.state === "completed");

        if (d.state === "completed" && !item.querySelector(".download-actions")) {
            const actions = document.createElement("div");
            actions.className = "download-actions";
            actions.innerHTML = `
                <button type="button" class="btn-action btn-open-file" data-action="open-file"><i class="fa-solid fa-arrow-up-right-from-square"></i> Mở file</button>
                <button type="button" class="btn-action btn-open-folder" data-action="open-folder"><i class="fa-regular fa-folder-open"></i> Mở thư mục</button>
            `;
            item.appendChild(actions);
        }

        if (previousState !== d.state) {
            syncHeaderPauseButton();
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
        syncHeaderPauseButton();
        if (window.applyFilter) window.applyFilter();
    }

    if (hasHost) {
        window.chrome.webview.addEventListener("message", (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.action === "DOWNLOAD_PROGRESS") applyProgress(msg.data);
                else if (msg.action === "DOWNLOAD_ERROR") applyError(msg);
            } catch (e) {
                console.error("Lỗi xử lý thông điệp tiến độ:", e);
            }
        });
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
        syncHeaderPauseButton();
    };

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
            if (action === "force-start") {
                post({ action: "FORCE_START_DOWNLOAD", taskId: taskId });
                item.dataset.state = "downloading";
                itemActionBtn.style.display = "none";
                const btnPause = item.querySelector('[data-item-action="toggle-pause"]');
                if (btnPause) {
                    btnPause.style.display = "inline-flex";
                    btnPause.title = "Tạm dừng";
                    btnPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
                }
                const st = item.querySelector(".download-status");
                if (st) st.textContent = "Đang bắt đầu tải ngay...";
                syncHeaderPauseButton();
                return;
            }

            if (action === "toggle-pause") {
                const currentState = item.dataset.state;
                if (currentState === "paused") {
                    post({ action: "RESUME_DOWNLOAD", taskId: taskId });
                    item.dataset.state = "downloading";
                    itemActionBtn.title = "Tạm dừng";
                    itemActionBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    const st = item.querySelector(".download-status");
                    if (st) st.textContent = "Đang tiếp tục...";
                } else {
                    post({ action: "PAUSE_DOWNLOAD", taskId: taskId });
                    item.dataset.state = "paused";
                    itemActionBtn.title = "Tiếp tục";
                    itemActionBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                    const st = item.querySelector(".download-status");
                    if (st) st.textContent = "Đã tạm dừng";
                    const sp = document.getElementById(`${taskId}-speed`);
                    if (sp) sp.textContent = "—";
                }
                syncHeaderPauseButton();
                return;
            }

            if (action === "cancel") {
                showConfirmModal({
                    title: "Xác nhận hủy tải",
                    message: `Bạn có chắc chắn muốn hủy tải tệp "${fileName}" không?`,
                    confirmText: "Hủy tải",
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
                            st.textContent = "Đã hủy";
                            st.className = "download-status is-error";
                        }
                        const sp = document.getElementById(`${taskId}-speed`);
                        if (sp) sp.textContent = "—";
                        const eta = document.getElementById(`${taskId}-eta`);
                        if (eta) eta.textContent = "--:--";
                        syncHeaderPauseButton();
                    }
                });
                return;
            }

            if (action === "delete") {
                const isCompleted = item.dataset.state === "completed";
                const msg = isCompleted
                    ? `Bạn có chắc chắn muốn xóa "${fileName}" khỏi danh sách tải về?`
                    : `Bạn có chắc chắn muốn xóa tác vụ "${fileName}"? Tệp tải dở dang sẽ bị dừng và xóa khỏi đĩa.`;
                showConfirmModal({
                    title: "Xác nhận xóa tác vụ",
                    message: msg,
                    confirmText: "Xóa",
                    danger: true,
                    onConfirm: () => {
                        post({ action: "REMOVE_DOWNLOAD", taskId: taskId });
                        item.remove();
                        window.updateTaskCounter();
                        syncHeaderPauseButton();
                    }
                });
                return;
            }
        }

        // 3. Nút điều khiển chung trên Header (Tạm dừng tất cả, Hủy tất cả, Xóa tất cả)
        const headerBtn = e.target.closest("[data-header-action]");
        if (headerBtn) {
            const headerAction = headerBtn.dataset.headerAction;

            if (headerAction === "pause-all") {
                const items = Array.from(document.querySelectorAll("#download-list .download-item"))
                    .filter(el => el.dataset.state === "downloading" || el.dataset.state === "preparing");
                if (items.length === 0) {
                    const pausedItems = Array.from(document.querySelectorAll("#download-list .download-item"))
                        .filter(el => el.dataset.state === "paused");
                    if (pausedItems.length === 0) {
                        showToast("Không có tệp nào đang tải để tạm dừng.");
                        return;
                    }
                }
                items.forEach(el => {
                    post({ action: "PAUSE_DOWNLOAD", taskId: el.id });
                    el.dataset.state = "paused";
                    const btn = el.querySelector('[data-item-action="toggle-pause"]');
                    if (btn) {
                        btn.title = "Tiếp tục";
                        btn.innerHTML = '<i class="fa-solid fa-play"></i>';
                    }
                    const st = el.querySelector(".download-status");
                    if (st) st.textContent = "Đã tạm dừng";
                    const sp = document.getElementById(`${el.id}-speed`);
                    if (sp) sp.textContent = "—";
                });
                headerBtn.dataset.headerAction = "resume-all";
                headerBtn.title = "Tiếp tục tất cả các tệp";
                headerBtn.classList.add("btn-resume");
                headerBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Tiếp tục tất cả</span>';
                return;
            }

            if (headerAction === "resume-all") {
                const items = Array.from(document.querySelectorAll("#download-list .download-item"))
                    .filter(el => el.dataset.state === "paused");
                if (items.length === 0) {
                    showToast("Không có tệp nào đang tạm dừng để tiếp tục.");
                    headerBtn.dataset.headerAction = "pause-all";
                    headerBtn.title = "Tạm dừng tất cả các tệp";
                    headerBtn.classList.remove("btn-resume");
                    headerBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Tạm dừng tất cả</span>';
                    return;
                }
                items.forEach(el => {
                    post({ action: "RESUME_DOWNLOAD", taskId: el.id });
                    el.dataset.state = "downloading";
                    const btn = el.querySelector('[data-item-action="toggle-pause"]');
                    if (btn) {
                        btn.title = "Tạm dừng";
                        btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    }
                    const st = el.querySelector(".download-status");
                    if (st) st.textContent = "Đang tải...";
                });
                headerBtn.dataset.headerAction = "pause-all";
                headerBtn.title = "Tạm dừng tất cả các tệp";
                headerBtn.classList.remove("btn-resume");
                headerBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Tạm dừng tất cả</span>';
                return;
            }

            if (headerAction === "cancel-all") {
                const items = Array.from(document.querySelectorAll("#download-list .download-item"))
                    .filter(el => el.dataset.state !== "completed" && el.dataset.state !== "cancelled");
                if (items.length === 0) {
                    showToast("Không có tệp nào đang tải để hủy.");
                    return;
                }
                showConfirmModal({
                    title: "Xác nhận hủy tất cả",
                    message: `Bạn có chắc chắn muốn hủy tất cả (${items.length}) tệp đang tải không?`,
                    confirmText: "Hủy tất cả",
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
                                st.textContent = "Đã hủy";
                                st.className = "download-status is-error";
                            }
                            const sp = document.getElementById(`${el.id}-speed`);
                            if (sp) sp.textContent = "—";
                            const eta = document.getElementById(`${el.id}-eta`);
                            if (eta) eta.textContent = "--:--";
                        });
                        syncHeaderPauseButton();
                    }
                });
                return;
            }

            if (headerAction === "delete-all") {
                const items = Array.from(document.querySelectorAll("#download-list .download-item"));
                if (items.length === 0) {
                    showToast("Danh sách tải về hiện đang trống.");
                    return;
                }
                showConfirmModal({
                    title: "Xác nhận xóa tất cả",
                    message: `Bạn có chắc chắn muốn xóa tất cả (${items.length}) tác vụ khỏi danh sách không? Các tệp đang tải dở dang sẽ bị dừng và xóa khỏi đĩa.`,
                    confirmText: "Xóa tất cả",
                    danger: true,
                    onConfirm: () => {
                        items.forEach(el => {
                            post({ action: "REMOVE_DOWNLOAD", taskId: el.id });
                            el.remove();
                        });
                        window.updateTaskCounter();
                        syncHeaderPauseButton();
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
})();
