/**
 * DUT Download Accelerator - Chrome / Edge Extension Background Service Worker
 * Cơ chế: Lắng nghe sự kiện chrome.downloads.onCreated và contextMenus
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

// Khởi tạo menu chuột phải và cấu hình mặc định
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

    // Tạo Context Menu (Menu chuột phải)
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
});

// Xử lý khi bấm menu chuột phải
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const targetUrl = info.linkUrl || info.srcUrl;
    if (!targetUrl) return;

    const config = await getConfig();
    const serverUrl = config.serverUrl || DEFAULT_SERVER_URL;

    // Kiểm tra server C# đang chạy
    const isOnline = await pingServer(serverUrl);
    if (!isOnline) {
        showNotification("DUT Download Accelerator chưa mở", "Vui lòng khởi động ứng dụng DUT Download Accelerator trên máy tính để tải.");
        return;
    }

    const payload = {
        url: targetUrl,
        fileName: extractFileNameFromUrl(targetUrl),
        referrer: tab ? tab.url : "",
        totalBytes: 0,
        mime: "",
        autoStart: config.autoStart || false
    };

    sendToApp(serverUrl, payload);
});

// Lắng nghe sự kiện bắt link tải tự động từ trình duyệt
chrome.downloads.onCreated.addListener(async (item) => {
    try {
        const config = await getConfig();
        if (!config.enabled) return;

        const downloadUrl = item.finalUrl || item.url;
        if (!downloadUrl) return;

        // Bỏ qua các URL nội bộ của trình duyệt
        if (downloadUrl.startsWith("blob:") ||
            downloadUrl.startsWith("data:") ||
            downloadUrl.startsWith("chrome://") ||
            downloadUrl.startsWith("chrome-extension://") ||
            downloadUrl.startsWith("edge://") ||
            downloadUrl.startsWith("about:")) {
            return;
        }

        // Kiểm tra phần mở rộng tệp
        const rawFileName = item.filename ? item.filename.split(/[\\/]/).pop() : extractFileNameFromUrl(downloadUrl);
        const ext = getExtension(rawFileName);
        const monitoredExts = config.extensions || DEFAULT_EXTENSIONS;

        const shouldCapture = monitoredExts.some(e => e.toLowerCase() === ext.toLowerCase());
        if (!shouldCapture) return;

        const serverUrl = config.serverUrl || DEFAULT_SERVER_URL;

        // Kiểm tra nhanh xem App C# có đang lắng nghe cổng 8989 không
        const isOnline = await pingServer(serverUrl);
        if (!isOnline) {
            // App chưa mở -> Không hủy lượt tải của trình duyệt để người dùng không bị mất file
            return;
        }

        // Hủy lượt tải trên trình duyệt
        try {
            await chrome.downloads.cancel(item.id);
        } catch (e) {
            console.warn("Không thể hủy lượt tải trình duyệt:", e);
        }

        // Xóa item bị hủy khỏi thanh tải về của trình duyệt
        try {
            await chrome.downloads.erase({ id: item.id });
        } catch (e) { }

        // Gửi payload sang C# App qua Local IPC Loopback
        const payload = {
            url: downloadUrl,
            fileName: rawFileName,
            referrer: item.referrer || "",
            totalBytes: item.totalBytes > 0 ? item.totalBytes : 0,
            mime: item.mime || "",
            autoStart: config.autoStart || false
        };

        await sendToApp(serverUrl, payload);

        showNotification(
            "Đã bắt link tải thành công!",
            `Tệp: ${rawFileName}\nĐang chuyển sang DUT Download Accelerator để tăng tốc tải đa luồng.`
        );
    } catch (err) {
        console.error("[DUT Extension] Lỗi khi chặn tải file:", err);
    }
});

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

// Helper: Kiểm tra kết nối tới C# App qua GET /ping
async function pingServer(serverUrl) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600);
        const res = await fetch(`${serverUrl}/ping`, {
            method: "GET",
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return res.ok;
    } catch (e) {
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
