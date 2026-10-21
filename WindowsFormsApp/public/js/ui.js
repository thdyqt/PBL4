// Khởi tạo AOS
AOS.init();

// Bật tắt Sidebar
document.addEventListener("click", (e) => {
    const btnMenu = e.target.closest(".inner-button-menu");
    const overlay = e.target.closest(".sider-overlay");
    
    const sider = document.querySelector(".sider");
    const siderOverlay = document.querySelector(".sider-overlay");

    if (btnMenu && sider && siderOverlay) {
        sider.classList.toggle("active");
        siderOverlay.classList.toggle("active");
    } 

    else if (overlay && sider && siderOverlay) {
        sider.classList.remove("active");
        siderOverlay.classList.remove("active");
    }
});

// ---------- Phân loại tệp & Quản lý frame / Lọc danh sách ----------
function getFileCategory(fileName) {
    if (!fileName) return "other";
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex === -1) return "other";
    const ext = fileName.slice(dotIndex + 1).toLowerCase();

    const audioExts = ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus"];
    const videoExts = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v"];
    const docExts = [
        "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso",
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "epub"
    ];

    if (audioExts.indexOf(ext) !== -1) return "audio";
    if (videoExts.indexOf(ext) !== -1) return "video";
    if (docExts.indexOf(ext) !== -1) return "document";
    return "other";
}
window.getFileCategory = getFileCategory;

const FILTER_CONFIG = {
    home: {
        label: "HÀNG ĐỢI",
        title: "Tệp đang tải",
        emptyTitle: "Chưa có tệp nào",
        emptyDesc: "Dán liên kết tải về, chọn vị trí lưu rồi bắt đầu."
    },
    all: {
        label: "DANH MỤC",
        title: "Tất cả tệp",
        emptyTitle: "Chưa có tệp nào",
        emptyDesc: "Danh sách tác vụ tải về đang trống."
    },
    downloading: {
        label: "DANH MỤC",
        title: "Tệp đang tải",
        emptyTitle: "Không có tệp đang tải",
        emptyDesc: "Các tác vụ đang tải sẽ hiển thị tại đây."
    },
    completed: {
        label: "DANH MỤC",
        title: "Tệp đã hoàn thành",
        emptyTitle: "Chưa có tệp hoàn thành",
        emptyDesc: "Các tệp đã tải xong sẽ xuất hiện tại đây."
    },
    audio: {
        label: "DANH MỤC",
        title: "Tệp âm thanh",
        emptyTitle: "Không có tệp âm thanh",
        emptyDesc: "Các tệp âm thanh (.mp3, .wav, .flac...) sẽ hiển thị tại đây."
    },
    video: {
        label: "DANH MỤC",
        title: "Tệp video",
        emptyTitle: "Không có tệp video",
        emptyDesc: "Các tệp video (.mp4, .mkv, .avi...) sẽ hiển thị tại đây."
    },
    document: {
        label: "DANH MỤC",
        title: "Nén & Tài liệu",
        emptyTitle: "Không có tệp nén / tài liệu",
        emptyDesc: "Các tệp .zip, .rar, .pdf, .docx... sẽ hiển thị tại đây."
    }
};

let currentFilter = "home";

function applyFilter(filterName) {
    if (filterName) currentFilter = filterName;
    const config = FILTER_CONFIG[currentFilter] || FILTER_CONFIG.all;

    // Chuyển frame: Nếu là Trang chủ thì hiện Section-2 (khung nhập link), ngược lại ẩn để tập trung danh sách
    const section2 = document.querySelector(".section-2");
    if (section2) {
        section2.style.display = currentFilter === "home" ? "" : "none";
    }

    // Đổi tiêu đề và nhãn Section-3
    const queueLabel = document.querySelector(".inner-queue-label");
    const downloadTitle = document.querySelector(".inner-download-title");
    if (queueLabel) queueLabel.textContent = config.label;
    if (downloadTitle) downloadTitle.textContent = config.title;

    // Lọc danh sách tác vụ
    const items = document.querySelectorAll("#download-list .download-item");
    let visibleCount = 0;

    items.forEach((item) => {
        const state = item.dataset.state || "preparing";
        const category = item.dataset.category || "other";

        let isMatch = false;
        switch (currentFilter) {
            case "home":
            case "all":
                isMatch = true;
                break;
            case "downloading":
                isMatch = (state === "downloading" || state === "preparing" || state === "queued");
                break;
            case "completed":
                isMatch = (state === "completed");
                break;
            case "audio":
                isMatch = (category === "audio");
                break;
            case "video":
                isMatch = (category === "video");
                break;
            case "document":
                isMatch = (category === "document");
                break;
            default:
                isMatch = true;
        }

        if (isMatch) {
            item.style.display = "";
            visibleCount++;
        } else {
            item.style.display = "none";
        }
    });

    // Cập nhật số lượng tác vụ hiển thị
    const badge = document.querySelector(".inner-count-badge");
    if (badge) badge.textContent = `${visibleCount} tác vụ`;

    // Cập nhật trạng thái rỗng
    const emptyState = document.getElementById("empty-state");
    if (emptyState) {
        if (visibleCount === 0) {
            emptyState.style.display = "";
            const h3 = emptyState.querySelector("h3");
            const div = emptyState.querySelector("div");
            if (h3) h3.textContent = config.emptyTitle;
            if (div) div.textContent = config.emptyDesc;
        } else {
            emptyState.style.display = "none";
        }
    }
}
window.applyFilter = applyFilter;
window.getCurrentFilter = () => currentFilter;

// Bắt sự kiện chuyển mục menu Sidebar
document.addEventListener("click", (e) => {
    const link = e.target.closest(".inner-menu a[data-filter]");
    if (!link) return;

    e.preventDefault();

    // Cập nhật class active
    document.querySelectorAll(".inner-menu a").forEach((el) => el.classList.remove("active"));
    link.classList.add("active");

    // Đóng sidebar nếu đang mở trên màn hình nhỏ
    const sider = document.querySelector(".sider");
    const siderOverlay = document.querySelector(".sider-overlay");
    if (sider && siderOverlay) {
        sider.classList.remove("active");
        siderOverlay.classList.remove("active");
    }

    // Áp dụng bộ lọc tương ứng với mục đã chọn
    const filter = link.dataset.filter;
    applyFilter(filter);
});