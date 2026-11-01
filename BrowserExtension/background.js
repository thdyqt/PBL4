/**
 * DUT Download Accelerator - Chrome / Edge Extension Background Service Worker
 * Cơ chế tối ưu: Lắng nghe sự kiện chrome.downloads.onDeterminingFilename và contextMenus
 * Đón bắt chuẩn xác mọi liên kết tải kể cả link redirect, dynamic script (PHP, ASPX, Cloud Drive)
 * Gửi dữ liệu qua Local IPC Loopback HTTP Server (http://127.0.0.1:8989/capture)
 */

const DEFAULT_SERVER_URL = "http://127.0.0.1:8989";
const DEFAULT_EXTENSIONS = [
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
    "iso", "img", "vhd", "bin",
    "exe", "msi", "apk", "appx", "dmg",
    "mp4", "mkv", "avi", "mov", "flv", "wmv", "webm",
    "mp3", "wav", "flac", "aac", "ogg", "m4a",
    "pdf", "docx", "xlsx", "pptx"
];

// Tập hợp lưu ID lượt tải đang xử lý để tránh trùng lặp
const handledDownloadIds = new Set();
let lastPingTime = 0;
let lastPingStatus = false;

// Đăng ký Context Menu (chuột phải)
function setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "dut-download-link",
            title: "Tải bằng DUT Download Accelerator",
            contexts: ["link"]
        });

        chrome.contextMenus.create({
            id: "dut-download-media",
            title: "Tải video / âm thanh bằng DUT Accelerator",
            contexts: ["video", "audio"]
        });
    });
}

// Khởi tạo menu chuột phải và cấu hình mặc định khi cài đặt hoặc cập nhật
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(["enabled", "autoStart", "extensions", "serverUrl"], (res) => {
        const update = {};
        if (res.enabled === undefined) update.enabled = true;
        if (res.autoStart === undefined) update.autoStart = false;
        if (!res.extensions) update.extensions = DEFAULT_EXTENSIONS;
        if (!res.serverUrl) update.serverUrl = DEFAULT_SERVER_URL;
        if (Object.keys(update).length > 0) {
            chrome.storage.sync.set(update);
        }
    });

    setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
    setupContextMenus();
});

// Xử lý khi người dùng chọn menu chuột phải
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const targetUrl = info.linkUrl || info.srcUrl;
    if (!targetUrl) return;

    const config = await getConfig();
    const serverUrl = config.serverUrl || DEFAULT_SERVER_URL;

    // Kiểm tra server C# đang chạy
    const isOnline = await pingServer(serverUrl);
    if (!isOnline) {
        showNotification(
            "DUT Download Accelerator chưa mở",
            "Vui lòng khởi động ứng dụng DUT Download Accelerator trên máy tính để tải."
        );
        return;
    }

    const payload = {
        url: targetUrl,
        fileName: extractFileNameFromUrl(targetUrl),
        referrer: tab ? tab.url : "",
        totalBytes: 0,
        mime: "",
        autoStart: config.autoStart || false,
        userAgent: navigator.userAgent
    };

    const res = await sendToApp(serverUrl, payload);
    if (res && res.success) {
        showNotification(
            "Đã chuyển liên kết sang App!",
            `URL: ${targetUrl.length > 50 ? targetUrl.substring(0, 50) + "..." : targetUrl}`
        );
    }
});

/**
 * Lắng nghe sự kiện xác định tên file (onDeterminingFilename)
 * Đây là thời điểm vàng: Chrome đã theo dõi hết các bước chuyển hướng (Redirects),
 * đã nhận đầy đủ HTTP Headers (Content-Disposition, Content-Type, Content-Length)
 * và đã xác định chính xác tên file thực tế (kể cả link động không có đuôi trên URL).
 */
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    handleDownloadCapture(item, suggest);
    // Trả về true để báo cho Chrome biết suggest sẽ được gọi bất đồng bộ
    return true;
});

async function handleDownloadCapture(item, suggest) {
    try {
        if (handledDownloadIds.has(item.id)) {
            suggest({ filename: item.filename });
            return;
        }

        const config = await getConfig();
        if (!config.enabled) {
            suggest({ filename: item.filename });
            return;
        }

        const downloadUrl = item.finalUrl || item.url;
        if (!downloadUrl) {
            suggest({ filename: item.filename });
            return;
        }

        // Bỏ qua các URL nội bộ của trình duyệt
        if (downloadUrl.startsWith("blob:") ||
            downloadUrl.startsWith("data:") ||
            downloadUrl.startsWith("chrome://") ||
            downloadUrl.startsWith("chrome-extension://") ||
            downloadUrl.startsWith("edge://") ||
            downloadUrl.startsWith("about:")) {
            suggest({ filename: item.filename });
            return;
        }

        // 1. Phân tích tên tệp và đuôi mở rộng thực tế
        let rawFileName = item.filename ? item.filename.split(/[\\/]/).pop() : extractFileNameFromUrl(downloadUrl);
        let ext = getExtension(rawFileName).toLowerCase();
        const monitoredExts = (config.extensions || DEFAULT_EXTENSIONS).map(e => e.toLowerCase());

        let isExtMatch = ext && monitoredExts.includes(ext);
        const isMimeMatch = isDownloadMime(item.mime);

        // Nếu URL động chưa có đuôi nhưng MIME type rõ ràng -> bổ sung đuôi tương ứng
        if (!ext && item.mime) {
            const extFromMime = getExtensionFromMime(item.mime);
            if (extFromMime) {
                rawFileName += "." + extFromMime;
                ext = extFromMime;
                isExtMatch = monitoredExts.includes(ext);
            }
        }

        const shouldCapture = isExtMatch || (isMimeMatch && (!ext || ext === "bin" || ext === "tmp"));

        if (!shouldCapture) {
            suggest({ filename: item.filename });
            return;
        }

        const serverUrl = config.serverUrl || DEFAULT_SERVER_URL;

        // 2. Kiểm tra nhanh xem App C# có đang lắng nghe cổng 8989 không
        const isOnline = await pingServer(serverUrl);
        if (!isOnline) {
            // App chưa mở -> Để trình duyệt tự tải bình thường, không hủy lượt tải
            suggest({ filename: item.filename });
            return;
        }

        // Đánh dấu đã xử lý item này
        handledDownloadIds.add(item.id);
        setTimeout(() => handledDownloadIds.delete(item.id), 30000);

        // 3. Hủy lượt tải trên trình duyệt Chrome
        try {
            await chrome.downloads.cancel(item.id);
        } catch (e) {
            console.warn("[DUT Extension] Không thể hủy lượt tải trình duyệt:", e);
        }

        // 4. Giải phóng suggest an toàn để kết thúc vòng đời download trên Chrome
        try {
            suggest({ filename: item.filename });
        } catch (e) { }

        // 5. Xóa khỏi thanh tải về (download history) của trình duyệt
        try {
            await chrome.downloads.erase({ id: item.id });
        } catch (e) { }

        // 6. Gửi payload sang C# App qua Local IPC Loopback
        const payload = {
            url: downloadUrl,
            fileName: rawFileName,
            referrer: item.referrer || "",
            totalBytes: item.totalBytes > 0 ? item.totalBytes : (item.fileSize > 0 ? item.fileSize : 0),
            mime: item.mime || "",
            autoStart: config.autoStart || false,
            userAgent: navigator.userAgent
        };

        const result = await sendToApp(serverUrl, payload);

        if (result && result.success) {
            showNotification(
                "Đã bắt link tải thành công!",
                `Tệp: ${rawFileName}\nĐang chuyển sang DUT Download Accelerator để tăng tốc tải đa luồng.`
            );
        }
    } catch (err) {
        console.error("[DUT Extension] Lỗi khi xử lý chặn tải:", err);
        try {
            suggest({ filename: item.filename });
        } catch (e) { }
    }
}

// Helper: Lấy cấu hình từ storage
function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["enabled", "autoStart", "extensions", "serverUrl"], (res) => {
            resolve({
                enabled: res.enabled !== false,
                autoStart: res.autoStart === true,
                extensions: res.extensions || DEFAULT_EXTENSIONS,
                serverUrl: res.serverUrl || DEFAULT_SERVER_URL
            });
        });
    });
}

// Helper: Kiểm tra kết nối tới C# App qua GET /ping (có cache ngắn 1.5s để cực nhanh)
async function pingServer(serverUrl) {
    const now = Date.now();
    if (now - lastPingTime < 1500 && lastPingStatus) {
        return true;
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600);
        const res = await fetch(`${serverUrl}/ping`, {
            method: "GET",
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        lastPingStatus = res.ok;
        lastPingTime = Date.now();
        return res.ok;
    } catch (e) {
        lastPingStatus = false;
        lastPingTime = Date.now();
        return false;
    }
}

// Helper: Gửi link tải tới C# App qua POST /capture
async function sendToApp(serverUrl, payload) {
    try {
        const res = await fetch(`${serverUrl}/capture`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch (e) {
        console.error("[DUT Extension] Lỗi gửi dữ liệu tới C#:", e);
        return null;
    }
}

// Helper: Nhận diện MIME type của tệp tải về
function isDownloadMime(mime) {
    if (!mime) return false;
    const m = mime.toLowerCase();
    return m.includes("application/octet-stream") ||
           m.includes("application/x-msdownload") ||
           m.includes("application/x-msdos-program") ||
           m.includes("application/exe") ||
           m.includes("application/x-exe") ||
           m.includes("application/zip") ||
           m.includes("application/x-zip") ||
           m.includes("application/x-rar") ||
           m.includes("application/x-7z") ||
           m.includes("application/x-iso") ||
           m.includes("application/x-tar") ||
           m.includes("application/x-bzip") ||
           m.includes("application/x-gzip") ||
           m.includes("application/pdf") ||
           m.startsWith("video/") ||
           m.startsWith("audio/");
}

// Helper: Suy luận đuôi mở rộng từ MIME type
function getExtensionFromMime(mime) {
    if (!mime) return "";
    const m = mime.toLowerCase();
    if (m.includes("msdownload") || m.includes("msdos") || m.includes("exe")) return "exe";
    if (m.includes("zip")) return "zip";
    if (m.includes("rar")) return "rar";
    if (m.includes("7z")) return "7z";
    if (m.includes("iso")) return "iso";
    if (m.includes("pdf")) return "pdf";
    if (m.includes("video/mp4")) return "mp4";
    if (m.includes("video/x-matroska")) return "mkv";
    if (m.includes("audio/mpeg")) return "mp3";
    return "";
}

// Helper: Lấy đuôi mở rộng từ tên file
function getExtension(filename) {
    if (!filename) return "";
    const clean = filename.split("?")[0].split("#")[0];
    const parts = clean.split(".");
    return parts.length > 1 ? parts.pop() : "";
}

// Helper: Tách tên file từ URL
function extractFileNameFromUrl(urlStr) {
    try {
        const u = new URL(urlStr);
        const pathname = u.pathname;
        const lastPart = pathname.substring(pathname.lastIndexOf("/") + 1);
        return decodeURIComponent(lastPart) || "downloaded_file";
    } catch (e) {
        return "downloaded_file";
    }
}

// Helper: Hiển thị thông báo trên hệ điều hành
function showNotification(title, message) {
    try {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: title,
            message: message,
            priority: 2
        });
    } catch (e) { }
}
