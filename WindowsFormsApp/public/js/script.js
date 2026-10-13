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
                rule: "customRegexp",
                value: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
                errorMessage: "Liên kết không hợp lệ! Vui lòng nhập đúng định dạng!"
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
            const savePath = event.target.savePath.value;
            const thread = event.target.thread.value;

            const payload = JSON.stringify({
                action: "START_DOWNLOAD", 
                url: url,
                savePath: savePath,
                thread: thread
            });

            // Gửi dữ liệu xuyên qua WebView2 xuống cho Backend C#
            if (window.chrome && window.chrome.webview) {
                window.chrome.webview.postMessage(payload);
                
                console.log("Đã bắn tín hiệu START_DOWNLOAD xuống C#");
            } else {
                alert("Tính năng tải chỉ hoạt động khi chạy trên phần mềm Desktop!");
            }
        })
}