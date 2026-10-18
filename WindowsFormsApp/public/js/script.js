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
            if (response.action === "DOWNLOAD_ACCEPTED") {
                console.log("C# đã nhận lệnh tải:", response.data);
                const speedEl = document.getElementById(`${response.taskId}-speed`);
                if (speedEl) speedEl.textContent = "Đã nhận lệnh";
            }

            if (response.action === "DOWNLOAD_ERROR") {
                const speedEl = document.getElementById(`${response.taskId}-speed`);
                if (speedEl) {
                    speedEl.textContent = response.message;
                    speedEl.style.color = "#dc2626";
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

            const form = event.target;
            const url = form.elements["url"].value.trim();
            const savePath = form.elements["save-path"].value;
            const thread = parseInt(form.elements["thread"].value, 10); // gửi số, không gửi chuỗi

            let fileName = "unknown_file";
            try {
                fileName = decodeURIComponent(new URL(url).pathname.split("/").pop()) || fileName;
            } catch (e) { /* giữ tên mặc định */ }

            // 2. Tạo một ID duy nhất cho tác vụ này (dựa vào thời gian thực)
            const taskId = 'task-' + Date.now();

            // 3. Ẩn trạng thái "Chưa có tệp nào"
            const emptyState = document.getElementById("empty-state");
            if (emptyState) emptyState.style.display = "none";

            // 4. Tạo mã HTML cho tệp đang tải (Sử dụng taskId cho các thẻ chứa dữ liệu)
            const downloadHTML = `
                <div class="download-item" id="${taskId}">
                    <div class="progress-header">
                        <div class="file-info">
                            <i class="fa-solid fa-file-zipper"></i>
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
                        <span class="stat-item">Còn lại: <b id="${taskId}-eta">--:--</b></span>
                    </div>
                </div>
            `;

            // 5. Bơm HTML vào danh sách 
            const downloadList = document.getElementById("download-list");
            if (downloadList) {
                downloadList.insertAdjacentHTML('afterbegin', downloadHTML); 
            }

            // 6. Cập nhật số lượng tác vụ linh hoạt
            const badge = document.querySelector(".inner-count-badge");
            if (badge && downloadList) {
                badge.textContent = `${downloadList.querySelectorAll(".download-item").length} tác vụ`;
            }

            const payload = JSON.stringify({
                action: "START_DOWNLOAD", 
                taskId: taskId, 
                url: url,
                savePath: savePath,
                thread: thread
            });

            if (window.chrome && window.chrome.webview) {
                window.chrome.webview.postMessage(payload);
                console.log("Đã gửi tác vụ mới:", taskId);
            } else {
                console.log("Đã giả lập gửi lệnh xuống C#:", payload);
            }
            
            // 8. Reset lại form sau khi bấm tải để nhập link mới nhanh hơn
            event.target.reset();
            document.getElementById('save-path').value = '';
        });
}
