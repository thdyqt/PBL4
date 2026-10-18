// Xử lý tiến độ tải, các nút Tạm dừng / Tiếp tục / Xóa.
// Nhận thông điệp từ C# (DOWNLOAD_PROGRESS, DOWNLOAD_ERROR), gửi lệnh xuống C#.
(function () {
    const hasHost = !!(window.chrome && window.chrome.webview);

    function post(obj) {
        if (hasHost) window.chrome.webview.postMessage(JSON.stringify(obj));
        else console.log("[giả lập gửi xuống C#]", obj);
    }

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
        preparing: "Đang chuẩn bị...",
        downloading: "Đang tải",
        paused: "Đã tạm dừng",
        completed: "Hoàn thành",
        failed: "Lỗi",
        cancelled: "Đã hủy"
    };

    // ---------- cập nhật giao diện ----------
    function ensureExtras(item, segmentCount) {
        let status = item.querySelector(".download-status");
        if (!status) {
            status = document.createElement("div");
            status.className = "download-status";
            item.appendChild(status);
        }
        if (segmentCount > 1 && !item.querySelector(".segment-bars")) {
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
        item.dataset.state = d.state;

        const nameEl = item.querySelector(".file-name");
        if (nameEl && d.fileName) nameEl.textContent = d.fileName;

        const known = d.totalBytes > 0;
        const ratio = known ? Math.min(d.downloaded / d.totalBytes, 1) : 0;
        const percent = d.state === "completed" ? 100 : Math.floor(ratio * 100);

        const set = (suffix, text) => {
            const el = document.getElementById(`${d.taskId}-${suffix}`);
            if (el) el.textContent = text;
        };

        set("percent", known || d.state === "completed" ? percent + "%" : "...");
        set("downloaded", `${fmtBytes(d.downloaded)} / ${known ? fmtBytes(d.totalBytes) : "--"}`);
        set("speed", d.state === "downloading" ? fmtBytes(d.speed) + "/s" : "—");
        set("eta", d.state === "downloading" ? fmtEta(d.etaSeconds) : "--:--");

        const bar = document.getElementById(`${d.taskId}-progress`);
        if (bar) bar.style.width = percent + "%";

        // thanh tiến độ từng luồng
        const fills = item.querySelectorAll(".segment-fill");
        (d.segments || []).forEach((seg, i) => {
            if (fills[i]) fills[i].style.width = (seg.length > 0 ? (seg.downloaded / seg.length) * 100 : 0) + "%";
        });

        let text = STATE_TEXT[d.state] || d.state;
        if (d.state === "downloading") {
            text += d.supportsRanges
                ? ` — ${d.threads} luồng`
                : " — 1 luồng (server không hỗ trợ Range)";
        }
        if (d.state === "failed" && d.error) text += ": " + d.error;
        status.textContent = text;
        status.classList.toggle("is-error", d.state === "failed");
        status.classList.toggle("is-done", d.state === "completed");
    }

    function applyError(msg) {
        const item = document.getElementById(msg.taskId);
        if (!item) { alert(msg.message); return; }
        const status = ensureExtras(item, 0);
        item.dataset.state = "failed";
        status.textContent = "Lỗi: " + msg.message;
        status.classList.add("is-error");
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
        const count = document.querySelectorAll("#download-list .download-item").length;
        const badge = document.querySelector(".inner-count-badge");
        if (badge) badge.textContent = `${count} tác vụ`;
        const empty = document.getElementById("empty-state");
        if (empty) empty.style.display = count === 0 ? "" : "none";
    };

    // ---------- chọn tác vụ + nút trên header ----------
    document.addEventListener("click", (e) => {
        const item = e.target.closest(".download-item");
        if (item) item.classList.toggle("selected");

        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const all = Array.from(document.querySelectorAll("#download-list .download-item"));
        let targets = all.filter((el) => el.classList.contains("selected"));
        const action = btn.dataset.action;

        // Không chọn gì: Tạm dừng / Tiếp tục áp dụng cho tất cả
        if (targets.length === 0 && (action === "pause" || action === "resume")) targets = all;
        if (targets.length === 0) {
            if (action === "remove") alert("Hãy bấm chọn tác vụ cần xóa trong danh sách.");
            return;
        }

        if (action === "pause") {
            targets.forEach((el) => post({ action: "PAUSE_DOWNLOAD", taskId: el.id }));
        } else if (action === "resume") {
            targets.forEach((el) => post({ action: "RESUME_DOWNLOAD", taskId: el.id }));
        } else if (action === "remove") {
            const hasUnfinished = targets.some((el) => el.dataset.state !== "completed");
            if (hasUnfinished && !confirm("Xóa các tác vụ đã chọn? Tệp tải dở dang sẽ bị xóa khỏi ổ đĩa.")) return;
            targets.forEach((el) => {
                post({ action: "REMOVE_DOWNLOAD", taskId: el.id });
                el.remove();
            });
            window.updateTaskCounter();
        }
    });
})();
