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
    const cleanName = String(fileName).trim().replace(/^["']|["']$/g, '').split(/[?#]/)[0];
    const dotIndex = cleanName.lastIndexOf(".");
    if (dotIndex === -1) return "other";
    const ext = cleanName.slice(dotIndex + 1).toLowerCase();

    const audioExts = [
        "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus", "alac", "aiff", "mid", "midi", "mka"
    ];
    const videoExts = [
        "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "3gp", "ts", "mpg", "mpeg", "vob", "ogv", "rmvb", "asf", "divx"
    ];
    const docExts = [
        "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "tgz", "tbz2", "txz", "cab", "dmg", "pkg", "deb", "rpm", "wim",
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "epub", "rtf", "odt", "ods", "odp", "md", "log", "json", "xml", "html", "htm"
    ];

    if (audioExts.indexOf(ext) !== -1) return "audio";
    if (videoExts.indexOf(ext) !== -1) return "video";
    if (docExts.indexOf(ext) !== -1) return "document";
    return "other";
}
window.getFileCategory = getFileCategory;

const HOME_RECENT_LIMIT = 10;

function getFilterConfig(filterName) {
    const key = filterName || currentFilter || "home";
    const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
    switch (key) {
        case "home":
            return {
                label: t("filter.home.label", "GẦN ĐÂY"),
                title: t("filter.home.title", "Tệp gần đây"),
                emptyTitle: t("filter.home.emptyTitle", "Chưa có tệp nào"),
                emptyDesc: t("filter.home.emptyDesc", "Dán liên kết tải về, chọn vị trí lưu rồi bắt đầu.")
            };
        case "downloading":
            return {
                label: t("filter.downloading.label", "DANH MỤC"),
                title: t("filter.downloading.title", "Tệp đang tải"),
                emptyTitle: t("filter.downloading.emptyTitle", "Không có tệp đang tải"),
                emptyDesc: t("filter.downloading.emptyDesc", "Các tác vụ đang tải sẽ hiển thị tại đây.")
            };
        case "completed":
            return {
                label: t("filter.completed.label", "DANH MỤC"),
                title: t("filter.completed.title", "Tệp đã hoàn thành"),
                emptyTitle: t("filter.completed.emptyTitle", "Chưa có tệp hoàn thành"),
                emptyDesc: t("filter.completed.emptyDesc", "Các tệp đã tải xong sẽ xuất hiện tại đây.")
            };
        case "audio":
            return {
                label: t("filter.audio.label", "DANH MỤC"),
                title: t("filter.audio.title", "Tệp âm thanh"),
                emptyTitle: t("filter.audio.emptyTitle", "Không có tệp âm thanh"),
                emptyDesc: t("filter.audio.emptyDesc", "Các tệp âm thanh (.mp3, .wav, .flac...) sẽ hiển thị tại đây.")
            };
        case "video":
            return {
                label: t("filter.video.label", "DANH MỤC"),
                title: t("filter.video.title", "Tệp video"),
                emptyTitle: t("filter.video.emptyTitle", "Không có tệp video"),
                emptyDesc: t("filter.video.emptyDesc", "Các tệp video (.mp4, .mkv, .avi...) sẽ hiển thị tại đây.")
            };
        case "document":
            return {
                label: t("filter.document.label", "DANH MỤC"),
                title: t("filter.document.title", "Nén & Tài liệu"),
                emptyTitle: t("filter.document.emptyTitle", "Không có tệp nén / tài liệu"),
                emptyDesc: t("filter.document.emptyDesc", "Các tệp .zip, .rar, .pdf, .docx... sẽ hiển thị tại đây.")
            };
        case "chart":
            return {
                label: t("chart.queue_badge", "TIẾN TRÌNH"),
                title: t("chart.queue_title", "Tác vụ đang tải"),
                emptyTitle: "",
                emptyDesc: ""
            };
        case "device":
            return {
                label: t("filter.device.label", "HỆ THỐNG"),
                title: t("filter.device.title", "Thông tin thiết bị"),
                emptyTitle: "",
                emptyDesc: ""
            };
        case "all":
        default:
            return {
                label: t("filter.all.label", "DANH MỤC"),
                title: t("filter.all.title", "Tất cả tệp"),
                emptyTitle: t("filter.all.emptyTitle", "Chưa có tệp nào"),
                emptyDesc: t("filter.all.emptyDesc", "Danh sách tác vụ tải về đang trống.")
            };
    }
}
window.getFilterConfig = getFilterConfig;

let currentFilter = "home";

window.addEventListener("app:languagechange", () => {
    if (typeof applyFilter === "function") {
        applyFilter(currentFilter);
    }
});

// ── Quản lý trạng thái Tìm kiếm & Sắp xếp ──
const VALID_CRITERIA = ["date", "name", "size", "duration", "speed", "status"];
const DEFAULT_DIRECTIONS = {
    date: "desc",
    name: "asc",
    size: "desc",
    duration: "asc",
    speed: "desc",
    status: "asc"
};

let currentSortCriteria = "date";
try {
    const savedCriteria = localStorage.getItem("dut_sort_criteria");
    if (VALID_CRITERIA.includes(savedCriteria)) {
        currentSortCriteria = savedCriteria;
    }
} catch (e) {}

let currentSortDirection = DEFAULT_DIRECTIONS[currentSortCriteria] || "desc";
try {
    const savedDirection = localStorage.getItem("dut_sort_direction");
    if (savedDirection === "asc" || savedDirection === "desc") {
        currentSortDirection = savedDirection;
    }
} catch (e) {}

let currentSearchQuery = "";

// Tiện ích bỏ dấu tiếng Việt để tìm kiếm không dấu / có dấu
function removeVietnameseTones(str) {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase()
        .trim();
}

function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeAccentInsensitiveRegex(token) {
    const charMap = {
        'a': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'e': '[eèéẻẽẹêềếểễệ]',
        'i': '[iìíỉĩị]',
        'o': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'u': '[uùúủũụưừứửữự]',
        'y': '[yỳýỷỹỵ]',
        'd': '[dđ]'
    };
    return token.split('').map(ch => {
        const lower = ch.toLowerCase();
        if (charMap[lower]) {
            return charMap[lower];
        }
        return escapeRegExp(ch);
    }).join('');
}

function formatFileSizeForSearch(bytes) {
    if (!bytes || bytes <= 0) return "";
    const units = ["b", "kb", "mb", "gb", "tb"];
    let i = 0;
    let val = Number(bytes);
    while (val >= 1024 && i < units.length - 1) {
        val /= 1024;
        i++;
    }
    const numStr = val.toFixed(i === 0 ? 0 : (val >= 100 ? 0 : 1));
    return `${numStr} ${units[i]} ${numStr}${units[i]}`;
}

const STATE_SEARCH_MAP = {
    downloading: "dang tai tai ve downloading download run running dang chay",
    preparing: "dang chuan bi khoi tao preparing prepare start",
    queued: "cho tai hang doi dang cho queued queue wait waiting cho den luot",
    paused: "tam dung da tam dung paused pause resume tiep tuc",
    completed: "hoan thanh da hoan thanh hoan tat da hoan tat xong da xong completed complete done finish finished thanh cong",
    failed: "that bai loi that bai error failed fail",
    cancelled: "da huy huy bo cancelled cancel da dung"
};

const CATEGORY_SEARCH_MAP = {
    audio: "audio am thanh nhac music song mp3 sound bai hat",
    video: "video phim clip movie mp4 mkv phim anh",
    document: "document tai lieu file nen nen tap tin archive zip rar pdf doc docx xls xlsx ppt pptx text txt",
    other: "other khac file tap tin"
};

// Đánh dấu từ khóa tìm kiếm an toàn (DOM node), hỗ trợ tiếng Việt không dấu & có dấu
function highlightFilename(el, rawText, query) {
    if (!el) return;
    if (!query || !query.trim()) {
        el.textContent = rawText;
        return;
    }

    const tokens = removeVietnameseTones(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        el.textContent = rawText;
        return;
    }

    try {
        const pattern = tokens.map(makeAccentInsensitiveRegex).join("|");
        const regex = new RegExp(`(${pattern})`, "gi");
        const parts = rawText.split(regex);
        el.innerHTML = "";

        const testRegex = new RegExp(`^(?:${pattern})$`, "i");

        parts.forEach(part => {
            if (!part) return;
            if (testRegex.test(part)) {
                const mark = document.createElement("mark");
                mark.className = "search-highlight";
                mark.textContent = part;
                el.appendChild(mark);
            } else {
                el.appendChild(document.createTextNode(part));
            }
        });
    } catch (e) {
        el.textContent = rawText;
    }
}
window.highlightFilename = highlightFilename;
window.getCurrentSearchQuery = () => currentSearchQuery;

// Kiểm tra tệp có khớp với từ khóa tìm kiếm không (tên, link, đuôi file, trạng thái, danh mục, dung lượng, đường dẫn...)
function matchesSearch(item, queryRaw) {
    if (!queryRaw || !queryRaw.trim()) return true;
    const queryNorm = removeVietnameseTones(queryRaw);
    const tokens = queryNorm.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;

    const fileName = item.dataset.fileName || item.querySelector(".file-name")?.textContent || "";
    const sourceUrl = item.dataset.sourceUrl || "";
    const targetPath = item.dataset.targetPath || "";
    const state = (item.dataset.state || "").toLowerCase();
    const category = (item.dataset.category || getFileCategory(fileName) || "other").toLowerCase();
    const statusText = item.querySelector(".download-status")?.textContent || "";
    const completedAt = item.dataset.completedAt || "";

    const totalBytes = Number(item.dataset.totalBytes) || Number(item.dataset.downloadedBytes) || 0;
    const sizeStr = formatFileSizeForSearch(totalBytes);

    let decodedUrl = sourceUrl;
    try { decodedUrl = decodeURIComponent(sourceUrl); } catch (e) {}

    const fileNameNorm = removeVietnameseTones(fileName);
    const fileNameSpaces = fileNameNorm.replace(/[_\-.,]+/g, " ");
    const sourceUrlNorm = removeVietnameseTones(decodedUrl).toLowerCase();
    const targetPathNorm = removeVietnameseTones(targetPath).replace(/\\/g, "/");
    const targetPathBackslash = removeVietnameseTones(targetPath);
    const statusTextNorm = removeVietnameseTones(statusText);
    const completedAtNorm = removeVietnameseTones(completedAt);

    const stateTerms = (STATE_SEARCH_MAP[state] || "") + " " + state;
    const categoryTerms = (CATEGORY_SEARCH_MAP[category] || "") + " " + category;

    // Toàn bộ dữ liệu của tệp gom vào một "kho" tìm kiếm phong phú
    const haystack = [
        fileNameNorm,
        fileNameSpaces,
        categoryTerms,
        stateTerms,
        sourceUrlNorm,
        targetPathNorm,
        targetPathBackslash,
        statusTextNorm,
        sizeStr,
        completedAtNorm
    ].join(" ");

    return tokens.every(token => haystack.includes(token));
}

// So sánh 2 tệp theo tiêu chí sắp xếp
function compareItems(a, b, criteria, direction) {
    let result = 0;
    const isAsc = direction === "asc";

    switch (criteria) {
        case "name": {
            const nameA = a.dataset.fileName || a.querySelector(".file-name")?.textContent || "";
            const nameB = b.dataset.fileName || b.querySelector(".file-name")?.textContent || "";
            result = nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true });
            break;
        }
        case "date": {
            const dateA = Number(a.dataset.createdAt) || 0;
            const dateB = Number(b.dataset.createdAt) || 0;
            result = dateA - dateB;
            break;
        }
        case "size": {
            const sizeA = Number(a.dataset.totalBytes) || Number(a.dataset.downloadedBytes) || 0;
            const sizeB = Number(b.dataset.totalBytes) || Number(b.dataset.downloadedBytes) || 0;
            result = sizeA - sizeB;
            break;
        }
        case "duration": {
            const durA = parseFloat(a.dataset.elapsedTime) || 0;
            const durB = parseFloat(b.dataset.elapsedTime) || 0;
            if (durA === 0 && durB > 0) return 1;
            if (durB === 0 && durA > 0) return -1;
            result = durA - durB;
            break;
        }
        case "speed": {
            const getEffectiveSpeed = (el) => {
                const sp = parseFloat(el.dataset.speed) || 0;
                if (sp > 0) return sp;
                const tot = Number(el.dataset.totalBytes) || Number(el.dataset.downloadedBytes) || 0;
                const elap = parseFloat(el.dataset.elapsedTime) || 0;
                if (tot > 0 && elap > 0) return tot / elap;
                return 0;
            };
            const speedA = getEffectiveSpeed(a);
            const speedB = getEffectiveSpeed(b);
            if (speedA === 0 && speedB > 0) return 1;
            if (speedB === 0 && speedA > 0) return -1;
            result = speedA - speedB;
            break;
        }
        case "status": {
            const STATE_ORDER = {
                downloading: 1,
                preparing: 2,
                queued: 3,
                paused: 4,
                completed: 5,
                failed: 6,
                cancelled: 7
            };
            const orderA = STATE_ORDER[a.dataset.state] || 99;
            const orderB = STATE_ORDER[b.dataset.state] || 99;
            result = orderA - orderB;
            break;
        }
        default:
            result = 0;
    }

    // Tiêu chí phụ khi hòa: sắp xếp theo thời điểm tạo mới hơn
    if (result === 0) {
        const timeA = Number(a.dataset.createdAt) || 0;
        const timeB = Number(b.dataset.createdAt) || 0;
        return timeB - timeA;
    }

    return isAsc ? result : -result;
}

// Cập nhật giao diện nút đảo chiều sắp xếp
function updateSortButtonUI() {
    const btnOrder = document.getElementById("btn-sort-order");
    const iconEl = document.getElementById("sort-order-icon");
    const textEl = document.getElementById("sort-order-text");
    const selectEl = document.getElementById("sort-select");

    if (selectEl && selectEl.value !== currentSortCriteria) {
        selectEl.value = currentSortCriteria;
    }
    if (!btnOrder || !iconEl || !textEl) return;

    const isAsc = currentSortDirection === "asc";
    const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
    const isEn = window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === "en";

    let iconClass = "fa-arrow-down-wide-short";
    let label = isAsc ? (isEn ? "Oldest" : "Cũ nhất") : (isEn ? "Newest" : "Mới nhất");
    let tooltip = isEn ? "Toggle sort order" : "Đảo chiều sắp xếp";

    switch (currentSortCriteria) {
        case "name":
            iconClass = isAsc ? "fa-arrow-down-a-z" : "fa-arrow-up-z-a";
            label = isAsc ? "A → Z" : "Z → A";
            tooltip = isEn
                ? (isAsc ? "Sorting: A to Z. Click to switch to Z to A." : "Sorting: Z to A. Click to switch to A to Z.")
                : (isAsc ? "Đang sắp xếp: Tên file từ A đến Z. Bấm để đổi sang Z đến A." : "Đang sắp xếp: Tên file từ Z đến A. Bấm để đổi sang A đến Z.");
            break;
        case "date":
            iconClass = isAsc ? "fa-arrow-up-short-wide" : "fa-arrow-down-wide-short";
            label = isAsc ? (isEn ? "Oldest" : "Cũ nhất") : (isEn ? "Newest" : "Mới nhất");
            tooltip = isEn
                ? (isAsc ? "Sorting: Oldest first. Click to switch to Newest." : "Sorting: Newest first. Click to switch to Oldest.")
                : (isAsc ? "Đang sắp xếp: Tệp tải cũ nhất trước. Bấm để đổi sang Mới nhất trước." : "Đang sắp xếp: Tệp tải mới nhất trước. Bấm để đổi sang Cũ nhất trước.");
            break;
        case "size":
            iconClass = isAsc ? "fa-arrow-up-short-wide" : "fa-arrow-down-wide-short";
            label = isAsc ? (isEn ? "Smallest" : "Nhỏ nhất") : (isEn ? "Largest" : "Lớn nhất");
            tooltip = isEn
                ? (isAsc ? "Sorting: Smallest first. Click to switch to Largest." : "Sorting: Largest first. Click to switch to Smallest.")
                : (isAsc ? "Đang sắp xếp: Dung lượng nhỏ nhất trước. Bấm để đổi sang Lớn nhất trước." : "Đang sắp xếp: Dung lượng lớn nhất trước. Bấm để đổi sang Nhỏ nhất trước.");
            break;
        case "duration":
            iconClass = isAsc ? "fa-arrow-down-short-wide" : "fa-arrow-up-wide-short";
            label = isAsc ? (isEn ? "Fastest" : "Nhanh nhất") : (isEn ? "Slowest" : "Lâu nhất");
            tooltip = isEn
                ? (isAsc ? "Sorting: Shortest duration first. Click for Longest." : "Sorting: Longest duration first. Click for Shortest.")
                : (isAsc ? "Đang sắp xếp: Thời gian tải ngắn nhất trước. Bấm để đổi sang Lâu nhất trước." : "Đang sắp xếp: Thời gian tải lâu nhất trước. Bấm để đổi sang Nhanh nhất trước.");
            break;
        case "speed":
            iconClass = isAsc ? "fa-arrow-up-short-wide" : "fa-arrow-down-wide-short";
            label = isAsc ? (isEn ? "Slowest" : "Chậm nhất") : (isEn ? "Fastest" : "Nhanh nhất");
            tooltip = isEn
                ? (isAsc ? "Sorting: Slowest first. Click for Fastest." : "Sorting: Fastest first. Click for Slowest.")
                : (isAsc ? "Đang sắp xếp: Tốc độ thấp nhất trước. Bấm để đổi sang Nhanh nhất trước." : "Đang sắp xếp: Tốc độ cao nhất trước. Bấm để đổi sang Chậm nhất trước.");
            break;
        case "status":
            iconClass = isAsc ? "fa-arrow-down-short-wide" : "fa-arrow-up-wide-short";
            label = isAsc ? (isEn ? "Downloading first" : "Đang tải trước") : (isEn ? "Completed first" : "Hoàn thành trước");
            tooltip = isEn
                ? (isAsc ? "Sorting: Downloading → Completed. Click to invert." : "Sorting: Completed → Downloading. Click to invert.")
                : (isAsc ? "Đang sắp xếp: Đang tải → Hoàn thành. Bấm để đảo chiều." : "Đang sắp xếp: Hoàn thành → Đang tải. Bấm để đảo chiều.");
            break;
    }

    iconEl.className = "fa-solid " + iconClass;
    textEl.textContent = label;
    btnOrder.title = tooltip;
}

function applyFilter(filterName) {
    if (filterName) currentFilter = filterName;
    const config = getFilterConfig(currentFilter);

    const section1 = document.querySelector(".section-1");
    const section2 = document.querySelector(".section-2");
    const section3 = document.querySelector(".section-3");
    const sectionDevice = document.getElementById("section-device");
    const sectionChart = document.getElementById("section-chart");
    const fileToolbar = document.getElementById("file-toolbar");

    // Nếu chọn mục Giám sát tốc độ (Chart): hiện frame biểu đồ phía trên, ẩn toolbar tìm kiếm/sắp xếp
    if (currentFilter === "chart") {
        if (section1) section1.style.display = "";
        if (section2) section2.style.display = "none";
        if (sectionDevice) sectionDevice.style.display = "none";
        if (sectionChart) sectionChart.style.display = "block";
        if (fileToolbar) fileToolbar.style.display = "none";

        window.scrollTo({ top: 0, behavior: "smooth" });

        if (window.initSpeedCharts) {
            window.initSpeedCharts();
        }
    } else if (currentFilter === "device") {
        // Nếu chọn mục Thông tin thiết bị: ẩn các section tải file và hiện frame thiết bị giữa trang
        if (section1) section1.style.display = "none";
        if (section2) section2.style.display = "none";
        if (section3) section3.style.display = "none";
        if (sectionChart) sectionChart.style.display = "none";
        if (fileToolbar) fileToolbar.style.display = "none";
        if (sectionDevice) sectionDevice.style.display = "block";

        if (window.fetchDeviceInfo) {
            window.fetchDeviceInfo();
        }
        return;
    } else {
        if (sectionDevice) sectionDevice.style.display = "none";
        if (sectionChart) sectionChart.style.display = "none";
        if (fileToolbar) fileToolbar.style.display = "";
        if (section1) section1.style.display = "";
        if (section2) section2.style.display = currentFilter === "home" ? "" : "none";
        if (section3) section3.style.display = "";
    }

    // Đổi tiêu đề và nhãn Section-3
    const queueLabel = document.querySelector(".inner-queue-label");
    const downloadTitle = document.querySelector(".inner-download-title");
    if (queueLabel) queueLabel.textContent = config.label;
    if (downloadTitle) downloadTitle.textContent = config.title;

    updateSortButtonUI();

    const list = document.getElementById("download-list");
    const allItems = list ? Array.from(list.querySelectorAll(".download-item")) : [];

    // Tự động chuẩn hóa category cho các file nếu còn thiếu hoặc 'other'
    allItems.forEach(item => {
        const fileName = item.dataset.fileName || item.querySelector(".file-name")?.textContent || "";
        if (!item.dataset.category || item.dataset.category === "other") {
            const detected = getFileCategory(fileName);
            if (detected !== "other") item.dataset.category = detected;
        }
    });

    // 1. Phân loại theo Danh mục (Category Filter)
    let categoryItems = [];
    if (currentFilter === "home") {
        if (currentSearchQuery) {
            // Khi đang tìm kiếm ở Trang chủ: tìm trên toàn bộ tác vụ để người dùng không bị giới hạn 10 tệp
            categoryItems = allItems;
        } else {
            // Ở trang chủ khi không tìm kiếm: ưu tiên tác vụ active & paused, sau đó lấy thêm đến 10
            const homeVisible = new Set();
            const activeItems = allItems.filter(el =>
                el.dataset.state === "downloading" ||
                el.dataset.state === "preparing" ||
                el.dataset.state === "queued" ||
                el.dataset.state === "paused"
            );
            activeItems.forEach(el => homeVisible.add(el));

            if (homeVisible.size < HOME_RECENT_LIMIT) {
                const rest = allItems.filter(el => !homeVisible.has(el))
                    .sort((a, b) => (Number(b.dataset.createdAt) || 0) - (Number(a.dataset.createdAt) || 0));

                for (const el of rest) {
                    if (homeVisible.size >= HOME_RECENT_LIMIT) break;
                    homeVisible.add(el);
                }
            }
            categoryItems = allItems.filter(el => homeVisible.has(el));
        }
    } else {
        categoryItems = allItems.filter(item => {
            const state = item.dataset.state || "preparing";
            const category = item.dataset.category || "other";
            switch (currentFilter) {
                case "all": return true;
                case "chart": return (state === "downloading" || state === "preparing" || state === "queued" || state === "paused");
                case "downloading": return (state === "downloading" || state === "preparing" || state === "queued" || state === "paused");
                case "completed": return (state === "completed");
                case "audio": return (category === "audio");
                case "video": return (category === "video");
                case "document": return (category === "document");
                default: return true;
            }
        });
    }

    // 2. Tìm kiếm (Search Filter) & Đánh dấu từ khóa (Highlight)
    const matchingSet = new Set();
    let visibleCount = 0;

    categoryItems.forEach(item => {
        const isMatch = matchesSearch(item, currentSearchQuery);
        const nameEl = item.querySelector(".file-name");
        const rawFileName = item.dataset.fileName || nameEl?.title || nameEl?.textContent || "";

        if (isMatch) {
            matchingSet.add(item);
            item.style.display = "";
            visibleCount++;
            if (nameEl) highlightFilename(nameEl, rawFileName, currentSearchQuery);
        } else {
            item.style.display = "none";
            if (nameEl) nameEl.textContent = rawFileName;
        }
    });

    // Các item không nằm trong categoryItems cũng ẩn đi
    allItems.forEach(item => {
        if (!matchingSet.has(item)) {
            item.style.display = "none";
            const nameEl = item.querySelector(".file-name");
            const rawFileName = item.dataset.fileName || nameEl?.title || nameEl?.textContent || "";
            if (nameEl) nameEl.textContent = rawFileName;
        }
    });

    // 3. Sắp xếp các tệp trong DOM (Sort Re-ordering)
    if (list && allItems.length > 0) {
        allItems.sort((a, b) => compareItems(a, b, currentSortCriteria, currentSortDirection));
        allItems.forEach(item => list.appendChild(item));
    }

    // 4. Cập nhật Badge & Controls trên Toolbar
    const isEn = window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === "en";
    const taskWord = isEn ? "tasks" : "tác vụ";
    const resultWord = isEn ? "results" : "kết quả";
    const mainBadge = document.querySelector(".inner-count-badge");
    if (mainBadge) {
        if (currentSearchQuery) {
            mainBadge.textContent = `${visibleCount} / ${categoryItems.length} ${taskWord}`;
        } else {
            mainBadge.textContent = `${visibleCount} ${taskWord}`;
        }
    }

    const searchCountPill = document.getElementById("search-count-pill");
    if (searchCountPill) {
        if (currentSearchQuery) {
            searchCountPill.style.display = "inline-flex";
            searchCountPill.textContent = `${visibleCount} ${resultWord}`;
        } else {
            searchCountPill.style.display = "none";
        }
    }

    const btnClearSearch = document.getElementById("btn-clear-search");
    if (btnClearSearch) {
        btnClearSearch.style.display = currentSearchQuery ? "inline-flex" : "none";
    }

    const btnResetToolbar = document.getElementById("btn-reset-toolbar");
    if (btnResetToolbar) {
        const isDefaultSort = currentSortCriteria === "date" && currentSortDirection === "desc";
        const hasSearch = !!currentSearchQuery;
        btnResetToolbar.style.display = (hasSearch || !isDefaultSort) ? "inline-flex" : "none";
    }

    // 5. Cập nhật Trạng thái Rỗng (Empty States)
    const emptyState = document.getElementById("empty-state");
    const searchEmptyState = document.getElementById("search-empty-state");
    const keywordDisplay = document.getElementById("search-keyword-display");

    if (currentSearchQuery) {
        if (visibleCount === 0) {
            if (emptyState) emptyState.style.display = "none";
            if (searchEmptyState) {
                searchEmptyState.style.display = "flex";
                if (keywordDisplay) keywordDisplay.textContent = currentSearchQuery;
            }
        } else {
            if (emptyState) emptyState.style.display = "none";
            if (searchEmptyState) searchEmptyState.style.display = "none";
        }
    } else {
        if (searchEmptyState) searchEmptyState.style.display = "none";
        if (currentFilter === "chart") {
            // Trong tab Giám sát tốc độ: không hiển thị ô rỗng
            // Nếu không có tệp nào đang tải (hoặc sau khi tất cả đã tải xong): ẩn hoàn toàn section-3, chỉ hiện biểu đồ
            // Nếu có tệp đang tải: hiển thị section-3 bên dưới biểu đồ
            if (emptyState) emptyState.style.display = "none";
            if (section3) section3.style.display = categoryItems.length > 0 ? "" : "none";
        } else if (categoryItems.length === 0) {
            if (emptyState) {
                emptyState.style.display = "";
                const h3 = emptyState.querySelector("h3");
                const div = emptyState.querySelector("div");
                if (h3) h3.textContent = config.emptyTitle;
                if (div) div.textContent = config.emptyDesc;
            }
        } else {
            if (emptyState) emptyState.style.display = "none";
        }
    }
}
window.applyFilter = applyFilter;
window.getCurrentFilter = () => currentFilter;

// Bắt sự kiện Toolbar Tìm kiếm & Sắp xếp
function initSearchAndSortToolbar() {
    const searchInput = document.getElementById("search-file-input");
    const sortSelect = document.getElementById("sort-select");
    const btnSortOrder = document.getElementById("btn-sort-order");
    const btnClearSearch = document.getElementById("btn-clear-search");
    const btnEmptyClear = document.getElementById("btn-empty-clear");
    const btnResetToolbar = document.getElementById("btn-reset-toolbar");

    if (sortSelect) {
        sortSelect.value = currentSortCriteria;
        sortSelect.addEventListener("change", (e) => {
            const newCriteria = e.target.value;
            currentSortCriteria = newCriteria;
            currentSortDirection = DEFAULT_DIRECTIONS[newCriteria] || "desc";
            try {
                localStorage.setItem("dut_sort_criteria", currentSortCriteria);
                localStorage.setItem("dut_sort_direction", currentSortDirection);
            } catch (err) {}
            applyFilter();
        });
    }

    if (btnSortOrder) {
        btnSortOrder.addEventListener("click", () => {
            currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
            try {
                localStorage.setItem("dut_sort_direction", currentSortDirection);
            } catch (err) {}
            applyFilter();
        });
    }

    let searchTimer = null;
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                currentSearchQuery = (e.target.value || "").trim();
                applyFilter();
            }, 60);
        });

        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                searchInput.value = "";
                currentSearchQuery = "";
                applyFilter();
                searchInput.blur();
            }
        });
    }

    const clearSearch = () => {
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
        }
        currentSearchQuery = "";
        applyFilter();
    };

    if (btnClearSearch) btnClearSearch.addEventListener("click", clearSearch);
    if (btnEmptyClear) btnEmptyClear.addEventListener("click", clearSearch);

    if (btnResetToolbar) {
        btnResetToolbar.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            currentSearchQuery = "";
            currentSortCriteria = "date";
            currentSortDirection = "desc";
            try {
                localStorage.setItem("dut_sort_criteria", "date");
                localStorage.setItem("dut_sort_direction", "desc");
            } catch (err) {}
            applyFilter();
        });
    }

    // Phím tắt toàn cục Ctrl+F hoặc phím '/' để focus vào ô tìm kiếm nhanh
    document.addEventListener("keydown", (e) => {
        const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
        if ((e.ctrlKey && e.key.toLowerCase() === "f") || (e.key === "/" && !isTyping)) {
            const sec3 = document.querySelector(".section-3");
            if (searchInput && sec3 && sec3.style.display !== "none") {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        }
    });

    updateSortButtonUI();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSearchAndSortToolbar);
} else {
    initSearchAndSortToolbar();
}

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

// =============================================
// Thông tin thiết bị (Device Info) - Frame giữa trang
// =============================================

(function () {
    let deviceInfoLoaded = false;
    let cachedDeviceData = null;

    function formatBytes(bytes) {
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

    function getUsageColor(pct) {
        if (pct >= 90) return "#ef4444";   // đỏ - gần đầy
        if (pct >= 70) return "#f59e0b";   // cam - sắp đầy
        if (pct >= 50) return "#3b82f6";   // xanh dương
        return "#10b981";                  // xanh lá - thoải mái
    }

    function getDriveStatusBadge(pct) {
        const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
        if (pct >= 90) return { text: t("device.status_almost_full", "Gần đầy"), class: "status-danger" };
        if (pct >= 70) return { text: t("device.status_getting_full", "Sắp đầy"), class: "status-warning" };
        return { text: t("device.status_healthy", "Dung lượng tốt"), class: "status-safe" };
    }

    function getDriveIcon(driveType) {
        if (driveType === "Removable") return "fa-solid fa-hard-drive";
        return "fa-solid fa-server";
    }

    function escHtml(str) {
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

    window.fetchDeviceInfo = function (force) {
        if (deviceInfoLoaded && !force && cachedDeviceData) {
            window.renderDeviceInfo(cachedDeviceData);
            return;
        }

        const loading = document.getElementById("device-loading-state");
        const container = document.getElementById("device-content-container");
        if (loading) loading.style.display = "flex";
        if (container) container.style.display = "none";

        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify({ action: "GET_SYSTEM_INFO" }));
        } else {
            // Fallback chạy trực tiếp trên trình duyệt demo
            setTimeout(() => {
                window.renderDeviceInfo({
                    machineName: "DUT-WORKSTATION",
                    osVersion: "Microsoft Windows 11 Pro 64-bit",
                    processorCount: 16,
                    totalRamBytes: 17179869184,
                    drives: [
                        { name: "C:\\", label: "Windows OS", driveType: "Fixed", format: "NTFS", totalBytes: 256060514304, freeBytes: 32212254720, usedBytes: 223848259584 },
                        { name: "D:\\", label: "Data & Storage", driveType: "Fixed", format: "NTFS", totalBytes: 1000204886016, freeBytes: 644245094400, usedBytes: 355959791616 }
                    ]
                });
            }, 300);
        }
    };

    window.renderDeviceInfo = function (data) {
        deviceInfoLoaded = true;
        cachedDeviceData = data;

        const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
        const fmt = (k, ...args) => (window.i18n && window.i18n.format) ? window.i18n.format(k, ...args) : '';

        const loading = document.getElementById("device-loading-state");
        const container = document.getElementById("device-content-container");
        if (loading) loading.style.display = "none";
        if (!container) return;
        container.style.display = "block";

        if (!data) {
            container.innerHTML = '<div class="device-error-banner"><i class="fa-solid fa-triangle-exclamation"></i> Không thể lấy thông tin phần cứng từ máy tính.</div>';
            return;
        }

        // 1. Hardware Summary Grid (4 cards)
        const sysGrid = document.getElementById("device-sys-grid");
        if (sysGrid) {
            let sysHtml = '';
            sysHtml += `
                <div class="device-sys-card">
                    <div class="sys-card-icon machine"><i class="fa-solid fa-laptop"></i></div>
                    <div class="sys-card-data">
                        <span class="sys-card-label">${t("device.machine_name", "Tên thiết bị")}</span>
                        <strong class="sys-card-val" title="${escHtml(data.machineName)}">${escHtml(data.machineName || "PC-System")}</strong>
                    </div>
                </div>
                <div class="device-sys-card">
                    <div class="sys-card-icon os"><i class="fa-brands fa-windows"></i></div>
                    <div class="sys-card-data">
                        <span class="sys-card-label">${t("device.os_version", "Hệ điều hành")}</span>
                        <strong class="sys-card-val" title="${escHtml(data.osVersion)}">${escHtml(data.osVersion || "Windows")}</strong>
                    </div>
                </div>
                <div class="device-sys-card">
                    <div class="sys-card-icon cpu"><i class="fa-solid fa-microchip"></i></div>
                    <div class="sys-card-data">
                        <span class="sys-card-label">${t("device.cpu", "Bộ vi xử lý (CPU)")}</span>
                        <strong class="sys-card-val">${data.processorCount ? fmt("device.threads_count", data.processorCount) : "—"}</strong>
                    </div>
                </div>
                <div class="device-sys-card">
                    <div class="sys-card-icon ram"><i class="fa-solid fa-memory"></i></div>
                    <div class="sys-card-data">
                        <span class="sys-card-label">${t("device.ram", "Bộ nhớ RAM")}</span>
                        <strong class="sys-card-val">${data.totalRamBytes ? formatBytes(data.totalRamBytes) : "—"}</strong>
                    </div>
                </div>
            `;
            sysGrid.innerHTML = sysHtml;
        }

        // 2. Overall Storage Meter
        const overallCard = document.getElementById("device-overall-card");
        if (overallCard && Array.isArray(data.drives) && data.drives.length > 0) {
            let totalCap = 0;
            let totalUsed = 0;
            let totalFree = 0;
            data.drives.forEach(d => {
                totalCap += (d.totalBytes || 0);
                totalUsed += (d.usedBytes || 0);
                totalFree += (d.freeBytes || 0);
            });
            const overallPct = totalCap > 0 ? ((totalUsed / totalCap) * 100) : 0;
            const overallColor = getUsageColor(overallPct);

            let ovHtml = `
                <div class="overall-header">
                    <div class="overall-title">
                        <i class="fa-solid fa-hard-drive"></i>
                        <span>${t("device.overall_title", "Tổng dung lượng toàn bộ thiết bị")}</span>
                    </div>
                    <span class="overall-usage-pill" style="background:${overallColor}15; color:${overallColor};">
                        ${fmt("device.used_pct", overallPct.toFixed(1))}
                    </span>
                </div>
                <div class="overall-bar-track">
                    <div class="overall-bar-fill" style="width: ${overallPct.toFixed(1)}%; background: ${overallColor};"></div>
                </div>
                <div class="overall-stats-row">
                    <div class="overall-stat">
                        <span class="dot" style="background:${overallColor};"></span>
                        <span>${fmt("device.used_stat", `<strong>${formatBytes(totalUsed)}</strong>`)}</span>
                    </div>
                    <div class="overall-stat">
                        <span class="dot" style="background:#cbd5e1;"></span>
                        <span>${fmt("device.free_stat", `<strong class="text-free">${formatBytes(totalFree)}</strong>`)}</span>
                    </div>
                    <div class="overall-stat ml-auto">
                        <span>${fmt("device.total_stat", `<strong>${formatBytes(totalCap)}</strong>`, data.drives.length)}</span>
                    </div>
                </div>
            `;
            overallCard.innerHTML = ovHtml;
        }

        // 3. Drives Grid
        const drivesGrid = document.getElementById("device-drives-grid");
        if (drivesGrid && Array.isArray(data.drives)) {
            let drivesHtml = '';
            data.drives.forEach(drv => {
                const usedPct = drv.totalBytes > 0 ? ((drv.usedBytes / drv.totalBytes) * 100) : 0;
                const color = getUsageColor(usedPct);
                const statusBadge = getDriveStatusBadge(usedPct);
                const driveLetter = drv.name.replace(/\\/g, '');
                const driveLabel = drv.label || t("device.local_drive", "Ổ đĩa cục bộ");
                const driveTypeStr = drv.driveType === 'Removable' ? t("device.removable_drive", "Ổ di động") : t("device.fixed_drive", "Ổ cố định");

                drivesHtml += `
                    <div class="device-drive-card">
                        <div class="drive-card-top">
                            <div class="drive-badge-letter" style="background:${color}15; color:${color}; border-color:${color}40;">
                                <i class="${getDriveIcon(drv.driveType)}"></i>
                                <span>${escHtml(driveLetter)}</span>
                            </div>
                            <div class="drive-info-meta">
                                <h4 class="drive-title" title="${escHtml(driveLabel)}">${escHtml(driveLabel)}</h4>
                                <div class="drive-subtext">${escHtml(drv.format || 'NTFS')} &bull; ${driveTypeStr}</div>
                            </div>
                            <span class="drive-health-badge ${statusBadge.class}">${statusBadge.text}</span>
                        </div>

                        <div class="drive-progress-wrapper">
                            <div class="drive-progress-bar-track">
                                <div class="drive-progress-bar-fill" style="width: ${usedPct.toFixed(1)}%; background: ${color};"></div>
                            </div>
                            <div class="drive-pct-label" style="color: ${color}; font-weight:700;">${usedPct.toFixed(1)}%</div>
                        </div>

                        <div class="drive-details-grid">
                            <div class="drive-detail-item">
                                <span class="detail-label">${t("device.detail_used", "Đã sử dụng")}</span>
                                <strong class="detail-value">${formatBytes(drv.usedBytes)}</strong>
                            </div>
                            <div class="drive-detail-item">
                                <span class="detail-label">${t("device.detail_free", "Còn trống")}</span>
                                <strong class="detail-value text-green">${formatBytes(drv.freeBytes)}</strong>
                            </div>
                            <div class="drive-detail-item">
                                <span class="detail-label">${t("device.detail_total", "Tổng dung lượng")}</span>
                                <strong class="detail-value">${formatBytes(drv.totalBytes)}</strong>
                            </div>
                        </div>
                    </div>
                `;
            });
            drivesGrid.innerHTML = drivesHtml;
        }
    };

    // Re-render when language changes
    window.addEventListener("app:languagechange", () => {
        if (window.applyFilter) {
            window.applyFilter();
        }
        if (cachedDeviceData) {
            window.renderDeviceInfo(cachedDeviceData);
        }
    });

    // Nút làm mới dữ liệu
    document.addEventListener("click", (e) => {
        if (e.target.closest("#btn-refresh-device-main")) {
            window.fetchDeviceInfo(true);
        }
    });
})();