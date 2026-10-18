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
}

// Tính năng "Chọn nơi lưu" (Gửi lệnh mở hộp thoại xuống C#)
const browseButton = document.querySelector(".inner-browse-button");
const savePathInput = document.getElementById("save-path");

if (browseButton && savePathInput) {
    browseButton.addEventListener("click", () => {
        if (window.chrome && window.chrome.webview) {
            const payload = JSON.stringify({
                action: "BROWSE_FOLDER"
            });
            window.chrome.webview.postMessage(payload);
        } else {
            alert("Tính năng chọn thư mục chỉ hoạt động trên ứng dụng Desktop!");
        }
    });
}

// Bắt sự kiện phản hồi từ C#
if (window.chrome && window.chrome.webview) {
    window.chrome.webview.addEventListener('message', event => {
        try {
            const response = JSON.parse(event.data);
            
            // Xử lý kịch bản dán Clipboard 
            if (response.action === "CLIPBOARD_DATA") {
                const copiedText = response.data;
                const pasteBtn = document.querySelector(".btn-paste"); 
                
                if (copiedText && copiedText.trim() !== "") {
                    urlInput.value = copiedText.trim();
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
                
                if (selectedPath && savePathInput) {
                    savePathInput.value = selectedPath;
                    
                    const form = document.querySelector("#input-form");
                    if (form && form.justValidate) {
                        form.justValidate.revalidateField("#save-path");
                    }
                }
            }

        } catch (error) {
            console.error("Lỗi đọc dữ liệu từ C#: ", error);
        }
    });
}

// Input Form
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

            // 1. Trích xuất tên file từ URL và xác định danh mục file
            let fileName = "unknown_file";
            try {
                fileName = decodeURIComponent(new URL(url).pathname.split("/").pop()) || fileName;
            } catch (e) { /* giữ tên mặc định, C# sẽ gửi lại tên thật */ }

            const category = window.getFileCategory ? window.getFileCategory(fileName) : "other";
            let iconClass = "fa-solid fa-file";
            if (category === "audio") iconClass = "fa-solid fa-music";
            else if (category === "video") iconClass = "fa-solid fa-video";
            else if (category === "document") iconClass = "fa-solid fa-file-zipper";

            // 2. Tạo một ID duy nhất cho tác vụ này (dựa vào thời gian thực)
            const taskId = 'task-' + Date.now();

            // 3. Ẩn trạng thái "Chưa có tệp nào"
            const emptyState = document.getElementById("empty-state");
            if (emptyState) emptyState.style.display = "none";

            // 4. Tạo mã HTML cho tệp đang tải (Sử dụng taskId cho các thẻ chứa dữ liệu)
            const downloadHTML = `
                <div class="download-item" id="${taskId}" data-state="preparing" data-category="${category}" data-start-time="${Date.now()}">
                    <div class="progress-header">
                        <div class="file-info">
                            <i class="${iconClass}"></i>
                            <span class="file-name">${fileName}</span>
                        </div>
                        <div class="progress-percentage" id="${taskId}-percent">0%</div>
                    </div>
                    
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" id="${taskId}-progress"></div>
                    </div>
                    
                    <div class="progress-stats">
                        <span class="stat-item">Tốc độ: <b id="${taskId}-speed">Đang tính...</b></span>
                        <span class="stat-item">Đã tải: <b id="${taskId}-downloaded">0 MB / -- MB</b></span>
                        <span class="stat-item"><span id="${taskId}-eta-label">Còn lại:</span> <b id="${taskId}-eta">--:--</b></span>
                    </div>
                </div>
            `;

            // 5. Bơm HTML vào danh sách 
            const downloadList = document.getElementById("download-list");
            if (downloadList) {
                downloadList.insertAdjacentHTML('afterbegin', downloadHTML); 
            }

            // 6. Cập nhật số lượng tác vụ và áp dụng bộ lọc hiện tại
            if (window.applyFilter) window.applyFilter();
            else if (window.updateTaskCounter) window.updateTaskCounter();

            const payload = JSON.stringify({
                action: "START_DOWNLOAD", 
                taskId: taskId, 
                url: url,
                savePath: savePath,
                thread: thread,
                threads: thread
            });

            if (window.chrome && window.chrome.webview) {
                window.chrome.webview.postMessage(payload);
                console.log("Đã gửi tác vụ mới:", taskId, "Số luồng:", thread);
            } else {
                console.log("Đã giả lập gửi lệnh xuống C#:", payload);
            }
            
            // 8. Chỉ xóa ô URL để có thể tải tiếp tệp khác, giữ nguyên số luồng và nơi lưu đã chọn
            if (urlInput) urlInput.value = '';
        });
}
