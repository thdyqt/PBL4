/**
 * DUT Download Accelerator - Internationalization (i18n) Module
 * Supports: Vietnamese (Default - "vi") and English ("en")
 */
(function (global) {
    'use strict';

    const translations = {
        vi: {
            // Brand & Header
            "brand.title": "DUT Download Accelerator",
            "brand.subtitle": "PBL4 - High-Speed Download Accelerator",
            "header.speed_unlimited": "Không giới hạn",
            "header.speed_limit_title": "Giới hạn băng thông (Click để chỉnh)",
            "header.pause_all": "Tạm dừng tất cả",
            "header.pause_all_title": "Tạm dừng tất cả các tệp",
            "header.pause_none_title": "Không có tệp nào đang tải để tạm dừng",
            "header.resume_all": "Tiếp tục tất cả",
            "header.resume_all_title": "Tiếp tục tất cả các tệp",
            "header.resume_none_title": "Không có tệp nào đang tạm dừng để tiếp tục",
            "header.cancel_all": "Hủy tất cả",
            "header.cancel_all_title": "Hủy tất cả các tệp đang tải",
            "header.delete_all": "Xóa tất cả",
            "header.delete_all_title": "Xóa tất cả các tác vụ khỏi danh sách",
            "header.settings": "Cài đặt hệ thống",
            "header.lang_switch": "Ngôn ngữ",
            "header.lang_title": "Chuyển đổi ngôn ngữ (Tiếng Việt / English)",

            // Sider Menu
            "sider.category_title": "DANH MỤC",
            "sider.home": "Trang chủ",
            "sider.all": "Tất cả",
            "sider.downloading": "Đang tải",
            "sider.completed": "Đã hoàn thành",
            "sider.audio": "Âm thanh",
            "sider.video": "Video",
            "sider.document": "Nén / Tài liệu",
            "sider.chart": "Giám sát tốc độ",
            "sider.device": "Thông tin thiết bị",

            // Real-Time Speed & Performance Chart
            "chart.badge": "GIÁM SÁT HIỆU NĂNG",
            "chart.main_title": "Biểu đồ Tốc độ tải & Tài nguyên hệ thống",
            "chart.main_desc": "Theo dõi biến thiên tốc độ tải về theo thời gian thực (500ms), mức sử dụng CPU và bộ nhớ RAM của ứng dụng.",
            "chart.live": "TRỰC TIẾP",
            "chart.paused_badge": "ĐÃ TẠM DỪNG VẼ",
            "chart.btn_pause": "Tạm dừng vẽ",
            "chart.btn_resume": "Tiếp tục vẽ",
            "chart.btn_clear": "Xóa dữ liệu",
            "chart.range_30s": "30 giây",
            "chart.range_60s": "60 giây",
            "chart.range_120s": "2 phút",
            "chart.speed_card": "Tốc độ tải hiện tại",
            "chart.speed_peak": "Đỉnh: {0}",
            "chart.speed_idle": "Đang nhàn rỗi (0 B/s)",
            "chart.cpu_card": "Mức sử dụng CPU",
            "chart.cpu_sub": "Tiến trình trên {0} nhân logic",
            "chart.ram_card": "Bộ nhớ RAM tiêu thụ",
            "chart.ram_sub": "Working Set ({0}% RAM máy)",
            "chart.threads_card": "Luồng mạng đang chạy",
            "chart.threads_sub": "{0} tệp đang kết nối",
            "chart.session_card": "Dữ liệu tải trong phiên",
            "chart.speed_chart_title": "Băng thông tải về (Download Throughput)",
            "chart.speed_chart_subtitle": "Đo đạc lưu lượng mạng thực tế gửi từ máy chủ theo từng giây",
            "chart.cpu_chart_title": "Tiêu thụ CPU tiến trình (%)",
            "chart.ram_chart_title": "Bộ nhớ RAM làm việc (MB)",
            "chart.queue_badge": "TIẾN TRÌNH",
            "chart.queue_title": "Tác vụ đang tải",

            // Antivirus Integration (Windows Defender)
            "antivirus.scanning": "Đang quét virus qua Windows Defender...",
            "antivirus.safe": "File an toàn",
            "antivirus.safe_tooltip": "Windows Defender: Không phát hiện mối đe dọa",
            "antivirus.threat": "Phát hiện mối đe dọa!",
            "antivirus.threat_tooltip": "Cảnh báo: Windows Defender phát hiện tệp có chứa mối đe dọa tiềm ẩn!",
            "antivirus.error": "Chưa quét virus",
            "antivirus.not_available": "Defender không khả dụng",
            "antivirus.btn_rescan": "Quét lại",
            "antivirus.rescan_tooltip": "Quét lại mã độc tệp qua Windows Defender",
            "antivirus.opening_warning": "Tệp này bị cảnh báo chứa mối đe dọa mã độc!",

            // Section 1: Add Download Link
            "add.title": "Thêm liên kết tải về",
            "add.batch_btn": "Tải nhiều link (Batch)",
            "add.batch_title": "Thêm nhiều liên kết cùng lúc",
            "add.desc": "Tải tệp từ liên kết URL trực tiếp (HTTP / HTTPS / FTP)",
            "add.url_label": "Liên kết tải về",
            "add.url_placeholder": "https://example.com/tep-can-tai.zip",
            "add.paste_title": "Dán từ Clipboard",
            "add.custom_name_label": "Tên tệp lưu",
            "add.custom_name_hint": "(Tùy chọn đổi tên trước khi tải)",
            "add.custom_name_placeholder": "Tự động nhận diện từ liên kết (hoặc nhập tên bạn muốn đổi)",
            "add.reset_original_name": "Tên gốc",
            "add.save_label": "Lưu tại",
            "add.save_placeholder": "Chưa chọn vị trí lưu (Bấm để chọn)",
            "add.browse": "Chọn nơi lưu",
            "add.browse_title": "Chọn thư mục lưu tệp",
            "add.thread_label": "Số luồng",
            "add.thread_1": "1 luồng",
            "add.thread_2": "2 luồng",
            "add.thread_4": "4 luồng",
            "add.thread_8": "8 luồng",
            "add.thread_12": "12 luồng",
            "add.thread_16": "16 luồng",
            "add.start_btn": "Bắt đầu tải",
            "add.queue_btn": "Thêm vào hàng đợi",

            // Section 2: Toolbar (Search & Sort)
            "search.placeholder": "Tìm kiếm tên file, đuôi mở rộng (.mp4, .zip...), link...",
            "search.title": "Tìm kiếm tệp (Phím tắt: Ctrl + F hoặc /)",
            "search.clear_title": "Xóa nội dung tìm kiếm (Esc)",
            "sort.label": "Sắp xếp:",
            "sort.order_title": "Đảo chiều sắp xếp",
            "sort.opt_date": "Thời điểm tải (Mới / Cũ)",
            "sort.opt_name": "Tên file (A - Z / Z - A)",
            "sort.opt_size": "Độ lớn file (Dung lượng)",
            "sort.opt_duration": "Thời gian tải về (Nhanh / Lâu)",
            "sort.opt_speed": "Tốc độ tải",
            "sort.opt_status": "Trạng thái (Tiến độ)",
            "sort.reset": "Đặt lại",
            "sort.reset_title": "Đặt lại tìm kiếm & sắp xếp mặc định",
            "toolbar.task_count": "{0} tác vụ",
            "sort.date_desc": "Mới nhất",
            "sort.date_asc": "Cũ nhất",
            "sort.name_asc": "A → Z",
            "sort.name_desc": "Z → A",

            // Section 3: Table Headers & Empty States
            "col.name": "Tên tệp",
            "col.progress": "Tiến độ",
            "col.size": "Kích thước",
            "col.speed": "Tốc độ",
            "col.status": "Trạng thái",
            "col.actions": "Thao tác",

            // Filters
            "filter.home.label": "GẦN ĐÂY",
            "filter.home.title": "Tệp gần đây",
            "filter.home.emptyTitle": "Chưa có tệp nào",
            "filter.home.emptyDesc": "Dán liên kết tải về, chọn vị trí lưu rồi bắt đầu.",
            "filter.all.label": "DANH MỤC",
            "filter.all.title": "Tất cả tệp",
            "filter.all.emptyTitle": "Chưa có tệp nào",
            "filter.all.emptyDesc": "Danh sách tác vụ tải về đang trống.",
            "filter.downloading.label": "DANH MỤC",
            "filter.downloading.title": "Tệp đang tải",
            "filter.downloading.emptyTitle": "Không có tệp đang tải",
            "filter.downloading.emptyDesc": "Các tác vụ đang tải sẽ hiển thị tại đây.",
            "filter.completed.label": "DANH MỤC",
            "filter.completed.title": "Tệp đã hoàn thành",
            "filter.completed.emptyTitle": "Chưa có tệp hoàn thành",
            "filter.completed.emptyDesc": "Các tệp đã tải xong sẽ xuất hiện tại đây.",
            "filter.audio.label": "DANH MỤC",
            "filter.audio.title": "Tệp âm thanh",
            "filter.audio.emptyTitle": "Không có tệp âm thanh",
            "filter.audio.emptyDesc": "Các tệp âm thanh (.mp3, .wav, .flac...) sẽ hiển thị tại đây.",
            "filter.video.label": "DANH MỤC",
            "filter.video.title": "Tệp video",
            "filter.video.emptyTitle": "Không có tệp video",
            "filter.video.emptyDesc": "Các tệp video (.mp4, .mkv, .avi...) sẽ hiển thị tại đây.",
            "filter.document.label": "DANH MỤC",
            "filter.document.title": "Nén & Tài liệu",
            "filter.document.emptyTitle": "Không có tệp nén / tài liệu",
            "filter.document.emptyDesc": "Các tệp .zip, .rar, .pdf, .docx... sẽ hiển thị tại đây.",
            "filter.device.label": "HỆ THỐNG",
            "filter.device.title": "Thông tin thiết bị & Bộ nhớ",

            // Empty states
            "empty.home_title": "Chưa có tệp nào",
            "empty.home_desc": "Dán liên kết tải về, chọn vị trí lưu rồi bắt đầu.",
            "empty.search_title": "Không tìm thấy tệp phù hợp",
            "empty.search_desc": "Không có tệp nào khớp với từ khóa \"{0}\" trong danh mục này.",
            "empty.search_clear": "Xóa tìm kiếm",

            // Download Statuses
            "state.queued": "Chờ tải (Trong hàng đợi)",
            "state.preparing": "Đang chuẩn bị...",
            "state.downloading": "Đang tải",
            "state.paused": "Đã tạm dừng",
            "state.completed": "Hoàn thành",
            "state.failed": "Lỗi",
            "state.cancelled": "Đã hủy",
            "state.ready": "Sẵn sàng tải",
            "state.downloading_count": "Đang tải {0} tệp",

            // Actions in Item row
            "action.open_file": "Mở tệp",
            "action.open_folder": "Mở thư mục chứa",
            "action.verify_checksum": "Kiểm tra mã băm (MD5 / SHA256)",
            "action.copy_link": "Sao chép liên kết tải",
            "action.pause": "Tạm dừng",
            "action.resume": "Tiếp tục tải",
            "action.cancel": "Hủy tải",
            "action.delete": "Xóa khỏi danh sách",

            // Item row labels & tooltips
            "item.speed_label": "Tốc độ:",
            "item.avg_speed_label": "Tốc độ TB:",
            "item.downloaded_label": "Đã tải:",
            "item.eta_label": "Còn lại:",
            "item.duration_label": "Thời gian:",
            "item.threads_count": "{0} luồng",
            "item.threads_singular": "1 luồng",
            "item.thread_progress": "Luồng {0}: {1}%",
            "item.completed": "Hoàn thành",
            "item.done": "Hoàn tất",
            "item.bypass_queue": "Bắt đầu tải ngay (Bỏ qua hàng đợi)",
            "item.pause": "Tạm dừng",
            "item.resume": "Tiếp tục",
            "item.cancel": "Hủy tải",
            "item.delete": "Xóa",
            "item.open_file": "Mở file",
            "item.open_folder": "Mở thư mục",
            "item.threat_warning": "Cảnh báo: Tệp chứa mối đe dọa! Bấm để xác nhận trước khi mở.",
            "item.threat_badge": "Phát hiện mối đe dọa!",
            "item.scanning_defender": "Đang quét qua Windows Defender...",
            "item.safe": "An toàn",
            "item.scan_failed": "Lỗi quét",

            // Settings Modal
            "settings.title": "Cài đặt nâng cao",
            "settings.subtitle": "Hàng đợi tải về, Giới hạn băng thông & Cấu hình Proxy",
            "settings.close_title": "Đóng",
            "settings.tab.queue": "Hàng đợi (Queue)",
            "settings.tab.bandwidth": "Băng thông (Speed)",
            "settings.tab.proxy": "Proxy",
            "settings.tab.browser": "Trình duyệt (Browser)",
            "settings.tab.other": "Cài đặt khác",
            "header.schedule": "Lập lịch",
            "header.schedule_title": "Lập lịch tải & Quản lý nguồn điện Windows",
            "settings.tab.schedule": "Lập lịch & Nguồn",

            // Schedule & Power Management (Windows Power Management & Win32 API)
            "schedule.title": "Lập lịch bắt đầu tải (Download Scheduler)",
            "schedule.desc": "Tự động khởi động tất cả tác vụ trong hàng đợi hoặc đang tạm dừng vào đúng khung giờ chỉ định.",
            "schedule.time_label": "Giờ bắt đầu tải (Start Time):",
            "schedule.status_waiting": "Đang chờ đến giờ hẹn...",
            "schedule.status_waiting_time": "Đang chờ đến {0} để tự động tải danh sách hàng đợi",
            "schedule.status_disabled": "Lập lịch tải hiện đang tắt",
            "schedule.trigger_now": "Thử chạy ngay",
            "schedule.triggered_toast": "Đã đến giờ hẹn ({0}), tự động bắt đầu tải danh sách hàng đợi!",
            "schedule.saved_toast": "Đã lưu thiết lập lập lịch & nguồn điện thành công!",

            "power.title": "Quản lý nguồn điện Windows (Power Management)",
            "power.desc": "Tương tác trực tiếp Win32 API: Chống ru ngủ khi tải và tự động hành động sau khi hoàn tất.",
            "power.os_desc": "Hệ điều hành Windows sẽ không tự động kích hoạt chế độ Sleep hoặc tắt màn hình khi đang có ít nhất 1 tác vụ tải ngầm đang hoạt động (ES_SYSTEM_REQUIRED | ES_CONTINUOUS).",
            "power.os_active": "Đang bảo vệ (ES_SYSTEM_REQUIRED)",
            "power.os_standby": "Chế độ chờ (ES_CONTINUOUS)",
            "power.action_label": "Hành động khi tải xong toàn bộ danh sách hàng đợi:",
            "power.action_none": "Không làm gì",
            "power.action_none_desc": "Giữ máy tính hoạt động bình thường, phục hồi chế độ ngủ mặc định của HĐH.",
            "power.action_sleep": "Ngủ (Sleep / Suspend)",
            "power.action_sleep_desc": "Đưa máy tính vào trạng thái tiết kiệm điện năng sau khi hết thời gian đếm ngược.",
            "power.action_shutdown": "Tắt máy tính (Shutdown)",
            "power.action_shutdown_desc": "Thực thi lệnh hệ thống shutdown.exe /s /t 60 để tắt máy an toàn sau khi tải xong.",
            "power.countdown_label": "Thời gian đếm ngược cảnh báo trước khi hành động (giây):",
            "power.countdown_desc": "Cho phép bạn kịp hủy lệnh tắt máy nếu vẫn còn ngồi trước máy tính.",
            "power.seconds": "giây",
            "power.seconds_upper": "GIÂY",
            "power.modal_title": "HÀNG ĐỢI TẢI ĐÃ HOÀN TẤT",
            "power.modal_subtitle": "Máy tính sẽ tự động tắt nguồn sau:",
            "power.modal_subtitle_shutdown": "Máy tính sẽ tự động tắt nguồn (Shutdown) sau:",
            "power.modal_subtitle_sleep": "Máy tính sẽ tự động vào chế độ Ngủ (Sleep) sau:",
            "power.cancel_hint": "Nhấn \"HỦY TẮT MÁY\" hoặc phím ESC để dừng lệnh tắt máy tính.",
            "power.btn_cancel": "HỦY TẮT MÁY NGAY (CANCEL)",
            "power.btn_cancel_sleep": "HỦY CHẾ ĐỘ NGỦ (CANCEL)",
            "power.btn_now": "Thực hiện ngay",
            "power.cancelled_toast": "Đã hủy lệnh tắt máy tính thành công!",


            // Settings Tab 1: Queue
            "settings.queue.max_concurrent": "Số tệp tải đồng thời tối đa (Max Concurrent Downloads)",
            "settings.queue.max_concurrent_desc": "Kiểm soát số lượng tệp được tải cùng lúc. Các tệp vượt quá sẽ nằm trong hàng đợi và tự động kích hoạt khi có tệp hoàn tất.",
            "settings.queue.opt_1": "1 tệp (Tải tuần tự từng tệp)",
            "settings.queue.opt_2": "2 tệp đồng thời (Khuyên dùng)",
            "settings.queue.opt_3": "3 tệp đồng thời",
            "settings.queue.opt_5": "5 tệp đồng thời",
            "settings.queue.opt_8": "8 tệp đồng thời",
            "settings.queue.opt_0": "0 (Không giới hạn - Tải tất cả)",
            "settings.queue.auto_next": "Tự động bắt đầu tệp tiếp theo trong hàng đợi",
            "settings.queue.auto_next_desc": "Kích hoạt tác vụ tiếp theo ngay khi một tệp hoàn thành hoặc bị hủy.",
            "settings.queue.threads": "Số luồng tải mặc định cho mỗi tệp",
            "settings.queue.threads_desc": "Số kết nối song song được thiết lập tự động khi bạn dán liên kết mới mà không tự chọn số luồng.",
            "settings.queue.threads_1": "1 luồng",
            "settings.queue.threads_2": "2 luồng",
            "settings.queue.threads_4": "4 luồng (Tối ưu)",
            "settings.queue.threads_8": "8 luồng",
            "settings.queue.threads_12": "12 luồng",
            "settings.queue.threads_16": "16 luồng",

            // Settings Tab 2: Bandwidth
            "settings.speed.enable": "Giới hạn băng thông (Bandwidth Throttling)",
            "settings.speed.enable_desc": "Áp dụng thuật toán Virtual Clock Leaky Bucket đa luồng, phân phối mượt mà cho toàn ứng dụng.",
            "settings.speed.presets": "Chọn mức giới hạn nhanh (Presets):",
            "settings.speed.custom_label": "Hoặc nhập tốc độ tuỳ chỉnh (KB/giây):",
            "settings.speed.custom_placeholder": "vd: 2048",
            "settings.speed.custom_unit": "KB/s",

            // Settings Tab 3: Proxy
            "settings.proxy.enable": "Kích hoạt Proxy",
            "settings.proxy.enable_desc": "Chuyển hướng mọi luồng tải và dò tìm thông tin tệp qua máy chủ Proxy.",
            "settings.proxy.mode": "Chế độ Proxy",
            "settings.proxy.mode_desc": "Chọn phương thức phát hiện hoặc chỉ định máy chủ Proxy.",
            "settings.proxy.mode_manual": "Tùy chỉnh máy chủ Proxy thủ công",
            "settings.proxy.mode_system": "Sử dụng cấu hình Proxy hệ thống Windows",
            "settings.proxy.mode_direct": "Kết nối trực tiếp (Bỏ qua Proxy)",
            "settings.proxy.info_system_title": "Proxy hệ thống Windows",
            "settings.proxy.info_system_desc": "Ứng dụng sẽ tự động đồng bộ và sử dụng cấu hình Proxy đang hoạt động trong thiết lập mạng của Windows.",
            "settings.proxy.info_direct_title": "Kết nối Internet trực tiếp",
            "settings.proxy.info_direct_desc": "Mọi tác vụ tải về sẽ kết nối thẳng tới máy chủ tệp mà không thông qua bất kỳ máy chủ trung gian nào.",
            "settings.proxy.server_title": "Cấu hình máy chủ",
            "settings.proxy.badge_manual": "Thủ công",
            "settings.proxy.type": "Giao thức",
            "settings.proxy.host": "Địa chỉ máy chủ (Host / IP)",
            "settings.proxy.host_placeholder": "vd: 127.0.0.1 hoặc proxy.example.com",
            "settings.proxy.port": "Cổng (Port)",
            "settings.proxy.auth": "Yêu cầu xác thực tài khoản (Authentication)",
            "settings.proxy.auth_desc": "Bật nếu máy chủ Proxy yêu cầu Tên đăng nhập và Mật khẩu truy cập.",
            "settings.proxy.user": "Tên đăng nhập (Username)",
            "settings.proxy.user_placeholder": "Nhập tên tài khoản...",
            "settings.proxy.pass": "Mật khẩu (Password)",
            "settings.proxy.pass_placeholder": "Nhập mật khẩu...",
            "settings.proxy.bypass": "Bỏ qua Proxy đối với các địa chỉ mạng cục bộ (Bypass Local Addresses)",
            "settings.proxy.bypass_desc": "Không định tuyến qua Proxy khi tải từ localhost, 127.0.0.1 hoặc mạng nội bộ LAN.",
            "settings.proxy.test_btn": "Kiểm tra kết nối Proxy",
            "settings.proxy.test_hint": "Gửi yêu cầu thử nghiệm để đo độ trễ và kiểm tra tính khả dụng",

            // Settings Tab 4: Browser Integration
            "settings.browser.status_title": "Cổng IPC Local Loopback đang lắng nghe",
            "settings.browser.status_ready": "SẴN SÀNG",
            "settings.browser.status_desc": "Trình duyệt Chrome / Edge sẽ tự động gửi URL và tên file qua cổng này ngay khi người dùng nhấn tải file trên web.",
            "settings.browser.guide_title": "Hướng dẫn cài đặt Extension cho Chrome / Edge (3 bước)",
            "settings.browser.step1_title": "Mở trang quản lý Tiện ích mở rộng của Trình duyệt",
            "settings.browser.step1_desc": "Mở Chrome và truy cập chrome://extensions hoặc Edge edge://extensions, sau đó bật công tắc 'Chế độ dành cho nhà phát triển' (Developer mode) ở góc trên bên phải.",
            "settings.browser.step2_title": "Nạp tiện ích đã giải nén (Load Unpacked)",
            "settings.browser.step2_desc": "Bấm nút 'Tải tiện ích đã giải nén' (Load unpacked) và chọn thư mục BrowserExtension của dự án.",
            "settings.browser.step3_title": "Trải nghiệm bắt link tự động",
            "settings.browser.step3_desc": "Bấm vào bất kỳ link tải tệp (.zip, .iso, .exe, .mp4, .pdf...) hoặc nhấp chuột phải chọn 'Tải bằng DUT Download Accelerator', liên kết sẽ được tự động chuyển ngay về app!",
            "settings.browser.btn_open_folder": "Mở thư mục Extension",
            "settings.browser.btn_test_capture": "Bắn link thử nghiệm (Test)",

            // Settings Tab 5: Other Settings
            "settings.theme.title": "Giao diện hiển thị (Theme)",
            "settings.theme.desc": "Tùy chỉnh chế độ sáng, tối hoặc tự động theo thiết lập hệ thống Windows (Mặc định: Chế độ sáng).",
            "settings.theme.light": "Chế độ sáng",
            "settings.theme.light_badge": "Mặc định",
            "settings.theme.light_desc": "Giao diện tươi sáng, rõ ràng và thanh thoát",
            "settings.theme.dark": "Chế độ tối",
            "settings.theme.dark_desc": "Tông màu tối hiện đại, bảo vệ mắt khi dùng lâu",
            "settings.theme.system": "Hệ thống",
            "settings.theme.system_desc": "Tự động đồng bộ theo giao diện hệ điều hành Windows",

            "settings.lang.title": "Ngôn ngữ hiển thị (Display Language)",
            "settings.lang.desc": "Chọn ngôn ngữ hiển thị trên toàn bộ giao diện phần mềm (Mặc định: Tiếng Việt).",
            "settings.lang.vi": "Tiếng Việt",
            "settings.lang.vi_badge": "Mặc định",
            "settings.lang.vi_desc": "Giao diện ngôn ngữ Tiếng Việt chuẩn xác và trực quan",
            "settings.lang.en": "English",
            "settings.lang.en_badge": "International",
            "settings.lang.en_desc": "Standard English interface for global users",

            "settings.confirm_delete": "Xác nhận trước khi xóa tệp",
            "settings.confirm_delete_desc": "Hiển thị hộp thoại xác nhận khi bạn xóa tệp hoặc xóa tất cả tệp khỏi danh sách. Bỏ chọn nếu bạn muốn xóa ngay mà không cần xác nhận lại.",

            "settings.footer.cancel": "Đóng",
            "settings.footer.save": "Lưu cài đặt",

            // Batch Modal
            "batch.title": "Tải hàng loạt liên kết (Batch URLs)",
            "batch.subtitle": "Dán danh sách nhiều URL để tự động thêm tất cả vào hàng đợi tải về",
            "batch.list_label": "Danh sách URL (mỗi dòng một liên kết):",
            "batch.valid_count": "{0} liên kết hợp lệ",
            "batch.save_title": "Vị trí lưu tệp",
            "batch.save_desc": "Chọn thư mục dùng cho toàn bộ liên kết trong danh sách.",
            "batch.save_placeholder": "Chưa chọn thư mục lưu",
            "batch.choose_folder": "Chọn thư mục",
            "batch.thread_title": "Số luồng mỗi tệp",
            "batch.thread_desc": "Nhiều luồng hơn có thể tăng tốc độ tải.",
            "batch.textarea_placeholder": "https://example.com/file1.zip\nhttps://example.com/file2.mp4\nhttps://example.com/file3.iso",
            "batch.cancel": "Hủy bỏ",
            "batch.submit": "Thêm vào hàng đợi",

            // Device Info
            "device.badge": "HỆ THỐNG",
            "device.main_title": "Thông tin thiết bị & Bộ nhớ",
            "device.main_desc": "Theo dõi thông số phần cứng, dung lượng các ổ đĩa và khả năng lưu trữ tệp tin trên máy tính của bạn.",
            "device.refresh": "Làm mới",
            "device.refresh_title": "Cập nhật lại thông tin mới nhất",
            "device.loading": "Đang đọc thông số thiết bị từ hệ thống...",
            "device.machine_name": "Tên thiết bị",
            "device.os_version": "Hệ điều hành",
            "device.cpu": "Bộ vi xử lý (CPU)",
            "device.threads_count": "{0} Luồng xử lý",
            "device.ram": "Bộ nhớ RAM",
            "device.overall_title": "Tổng dung lượng toàn bộ thiết bị",
            "device.used_pct": "Đã sử dụng {0}%",
            "device.used_stat": "Đã dùng: {0}",
            "device.free_stat": "Còn trống khả dụng: {0}",
            "device.total_stat": "Tổng lưu trữ: {0} ({1} ổ đĩa)",
            "device.drives_subtitle": "Chi tiết các ổ đĩa lưu trữ",
            "device.fixed_drive": "Ổ cố định",
            "device.removable_drive": "Ổ di động",
            "device.local_drive": "Ổ đĩa cục bộ",
            "device.status_almost_full": "Gần đầy",
            "device.status_getting_full": "Sắp đầy",
            "device.status_healthy": "Bình thường",
            "device.detail_used": "Đã sử dụng",
            "device.detail_free": "Còn trống",
            "device.detail_total": "Tổng dung lượng",

            // Disk Space Warning Modal
            "disk.title": "Cảnh báo dung lượng ổ đĩa",
            "disk.subtitle": "Kiểm tra không gian lưu trữ hệ thống",
            "disk.current_drive": "Ổ đĩa hiện tại",
            "disk.suggested_drive": "Đề xuất đổi sang",
            "disk.understood": "Đã hiểu",
            "disk.switch_folder": "Đổi thư mục lưu ngay",

            // Checksum / Verify Hash Modal
            "hash.title": "Kiểm tra mã băm tệp (Checksum Hash)",
            "hash.file_label": "Đường dẫn tệp đã tải xong:",
            "hash.expected_label": "Mã băm mong đợi từ nguồn cung cấp (Tùy chọn so khớp):",
            "hash.expected_placeholder": "Dán chuỗi MD5 hoặc SHA-256 do trang web cung cấp để so khớp...",
            "hash.calc_btn": "Tính toán mã băm",
            "hash.match_success": "Mã băm HOÀN TOÀN KHỚP! Tệp tải về nguyên vẹn và an toàn.",
            "hash.match_fail": "Mã băm KHÔNG KHỚP! Tệp có thể đã bị lỗi truyền tải hoặc bị sửa đổi.",

            // Validation & Alerts
            "validate.url_required": "Vui lòng nhập đường link tải về!",
            "validate.url_invalid": "Liên kết không hợp lệ! Hãy nhập URL bắt đầu bằng http:// hoặc https://",
            "validate.save_required": "Vui lòng chọn vị trí lưu file!",
            "validate.clipboard_empty": "Bộ nhớ tạm đang trống hoặc không phải là chữ!",
            "validate.clipboard_blocked": "Trình duyệt chặn quyền đọc Clipboard. Hãy nhấn Ctrl+V!",
            "validate.clipboard_fail": "Không thể dán tự động. Hãy nhấn Ctrl+V!",
            "validate.browse_desktop_only": "Tính năng chọn thư mục chỉ hoạt động trên ứng dụng Desktop!",

            // Common Buttons & Messages
            "common.close": "Đóng",
            "common.cancel": "Hủy bỏ",
            "common.confirm": "Đồng ý",
            "common.save": "Lưu",
            "toast.settings_saved": "Đã lưu cài đặt thành công!",
            "toast.lang_switched": "Đã chuyển sang Tiếng Việt",
            "toast.copied": "Đã sao chép liên kết vào bộ nhớ tạm!"
        },

        en: {
            // Brand & Header
            "brand.title": "DUT Download Accelerator",
            "brand.subtitle": "PBL4 - High-Speed Download Accelerator",
            "header.speed_unlimited": "Unlimited",
            "header.speed_limit_title": "Bandwidth limit (Click to configure)",
            "header.pause_all": "Pause All",
            "header.pause_all_title": "Pause all downloads",
            "header.pause_none_title": "No downloads in progress to pause",
            "header.resume_all": "Resume All",
            "header.resume_all_title": "Resume all downloads",
            "header.resume_none_title": "No paused downloads to resume",
            "header.cancel_all": "Cancel All",
            "header.cancel_all_title": "Cancel all active downloads",
            "header.delete_all": "Delete All",
            "header.delete_all_title": "Remove all tasks from the list",
            "header.settings": "System Settings",
            "header.lang_switch": "Language",
            "header.lang_title": "Switch language (Ti?ng Vi?t / English)",

            // Sider Menu
            "sider.category_title": "CATEGORIES",
            "sider.home": "Home",
            "sider.all": "All Files",
            "sider.downloading": "Downloading",
            "sider.completed": "Completed",
            "sider.audio": "Audio",
            "sider.video": "Video",
            "sider.document": "Archives & Docs",
            "sider.chart": "Speed & Metrics",
            "sider.device": "Device Info",

            // Real-Time Speed & Performance Chart
            "chart.badge": "PERFORMANCE MONITOR",
            "chart.main_title": "Real-Time Download Speed & System Resources",
            "chart.main_desc": "Monitor real-time network throughput fluctuation (500ms updates), application CPU utilization and RAM memory footprint.",
            "chart.live": "LIVE STREAM",
            "chart.paused_badge": "STREAM PAUSED",
            "chart.btn_pause": "Pause Stream",
            "chart.btn_resume": "Resume Stream",
            "chart.btn_clear": "Clear History",
            "chart.range_30s": "30 Seconds",
            "chart.range_60s": "60 Seconds",
            "chart.range_120s": "2 Minutes",
            "chart.speed_card": "Live Download Speed",
            "chart.speed_peak": "Peak: {0}",
            "chart.speed_idle": "Idle (0 B/s)",
            "chart.cpu_card": "App CPU Usage",
            "chart.cpu_sub": "Process across {0} logical cores",
            "chart.ram_card": "RAM Memory Footprint",
            "chart.ram_sub": "Working Set ({0}% system RAM)",
            "chart.threads_card": "Active Network Threads",
            "chart.threads_sub": "{0} active downloading tasks",
            "chart.session_card": "Session Data Downloaded",
            "chart.speed_chart_title": "Download Throughput History",
            "chart.speed_chart_subtitle": "Actual network data transfer rate received from server per second",
            "chart.cpu_chart_title": "Process CPU Utilization (%)",
            "chart.ram_chart_title": "Process Working Set Memory (MB)",
            "chart.queue_badge": "ACTIVE QUEUE",
            "chart.queue_title": "Active Downloading Tasks",

            // Antivirus Integration (Windows Defender)
            "antivirus.scanning": "Scanning for viruses (Windows Defender)...",
            "antivirus.safe": "Safe File",
            "antivirus.safe_tooltip": "Windows Defender: No threats detected",
            "antivirus.threat": "Threat Detected!",
            "antivirus.threat_tooltip": "Warning: Windows Defender detected potential threats in this file!",
            "antivirus.error": "Scan Not Available",
            "antivirus.not_available": "Defender Not Found",
            "antivirus.btn_rescan": "Rescan",
            "antivirus.rescan_tooltip": "Rescan file with Windows Defender",
            "antivirus.opening_warning": "This file was flagged with potential security threats!",

            // Section 1: Add Download Link
            "add.title": "Add Download Link",
            "add.batch_btn": "Batch URLs",
            "add.batch_title": "Add multiple download links at once",
            "add.desc": "Download files from direct URLs (HTTP / HTTPS / FTP)",
            "add.url_label": "Download Link",
            "add.url_placeholder": "https://example.com/file-to-download.zip",
            "add.paste_title": "Paste from Clipboard",
            "add.custom_name_label": "Save File Name",
            "add.custom_name_hint": "(Optional rename before download)",
            "add.custom_name_placeholder": "Auto-detected from URL (or enter custom file name)",
            "add.reset_original_name": "Original Name",
            "add.save_label": "Save to",
            "add.save_placeholder": "No destination selected (Click to choose)",
            "add.browse": "Browse Folder",
            "add.browse_title": "Select destination folder",
            "add.thread_label": "Threads",
            "add.thread_1": "1 thread",
            "add.thread_2": "2 threads",
            "add.thread_4": "4 threads",
            "add.thread_8": "8 threads",
            "add.thread_12": "12 threads",
            "add.thread_16": "16 threads",
            "add.start_btn": "Start Download",
            "add.queue_btn": "Add to Queue",

            // Section 2: Toolbar (Search & Sort)
            "search.placeholder": "Search by filename, extension (.mp4, .zip...), link...",
            "search.title": "Search files (Shortcut: Ctrl + F or /)",
            "search.clear_title": "Clear search input (Esc)",
            "sort.label": "Sort:",
            "sort.order_title": "Toggle Sort Order",
            "sort.opt_date": "Download Date (New / Old)",
            "sort.opt_name": "File Name (A - Z / Z - A)",
            "sort.opt_size": "File Size (Capacity)",
            "sort.opt_duration": "Download Duration (Fast / Slow)",
            "sort.opt_speed": "Download Speed",
            "sort.opt_status": "Status (Progress)",
            "sort.reset": "Reset",
            "sort.reset_title": "Reset search & default sorting",
            "toolbar.task_count": "{0} tasks",
            "sort.date_desc": "Newest",
            "sort.date_asc": "Oldest",
            "sort.name_asc": "A → Z",
            "sort.name_desc": "Z → A",

            // Section 3: Table Headers & Empty States
            "col.name": "File Name",
            "col.progress": "Progress",
            "col.size": "Size",
            "col.speed": "Speed",
            "col.status": "Status",
            "col.actions": "Actions",

            // Filters
            "filter.home.label": "RECENT",
            "filter.home.title": "Recent Files",
            "filter.home.emptyTitle": "No files yet",
            "filter.home.emptyDesc": "Paste a download link, select save folder and start.",
            "filter.all.label": "CATEGORY",
            "filter.all.title": "All Files",
            "filter.all.emptyTitle": "No files yet",
            "filter.all.emptyDesc": "The download queue is currently empty.",
            "filter.downloading.label": "CATEGORY",
            "filter.downloading.title": "Active Downloads",
            "filter.downloading.emptyTitle": "No active downloads",
            "filter.downloading.emptyDesc": "Active downloading tasks will appear here.",
            "filter.completed.label": "CATEGORY",
            "filter.completed.title": "Completed Downloads",
            "filter.completed.emptyTitle": "No completed files",
            "filter.completed.emptyDesc": "Completed downloads will appear here.",
            "filter.audio.label": "CATEGORY",
            "filter.audio.title": "Audio Files",
            "filter.audio.emptyTitle": "No audio files",
            "filter.audio.emptyDesc": "Audio files (.mp3, .wav, .flac...) will appear here.",
            "filter.video.label": "CATEGORY",
            "filter.video.title": "Video Files",
            "filter.video.emptyTitle": "No video files",
            "filter.video.emptyDesc": "Video files (.mp4, .mkv, .avi...) will appear here.",
            "filter.document.label": "CATEGORY",
            "filter.document.title": "Archives & Documents",
            "filter.document.emptyTitle": "No archives or documents",
            "filter.document.emptyDesc": "Archives and documents (.zip, .rar, .pdf, .docx...) will appear here.",
            "filter.device.label": "SYSTEM",
            "filter.device.title": "Device & Storage Information",

            // Empty states
            "empty.home_title": "No files yet",
            "empty.home_desc": "Paste a download link, select save folder and start.",
            "empty.search_title": "No matching files found",
            "empty.search_desc": "No files match keyword \"{0}\" in this category.",
            "empty.search_clear": "Clear Search",

            // Download Statuses
            "state.queued": "Queued",
            "state.preparing": "Preparing...",
            "state.downloading": "Downloading",
            "state.paused": "Paused",
            "state.completed": "Completed",
            "state.failed": "Failed",
            "state.cancelled": "Cancelled",
            "state.ready": "Ready to download",
            "state.downloading_count": "Downloading {0} files",

            // Actions in Item row
            "action.open_file": "Open File",
            "action.open_folder": "Open Containing Folder",
            "action.verify_checksum": "Verify Checksum (MD5 / SHA256)",
            "action.copy_link": "Copy Download Link",
            "action.pause": "Pause",
            "action.resume": "Resume",
            "action.cancel": "Cancel",
            "action.delete": "Remove from List",

            // Item row labels & tooltips
            "item.speed_label": "Speed:",
            "item.avg_speed_label": "Avg Speed:",
            "item.downloaded_label": "Downloaded:",
            "item.eta_label": "ETA:",
            "item.duration_label": "Duration:",
            "item.threads_count": "{0} threads",
            "item.threads_singular": "1 thread",
            "item.thread_progress": "Thread {0}: {1}%",
            "item.completed": "Completed",
            "item.done": "Done",
            "item.bypass_queue": "Start now (Bypass queue)",
            "item.pause": "Pause",
            "item.resume": "Resume",
            "item.cancel": "Cancel download",
            "item.delete": "Delete",
            "item.open_file": "Open file",
            "item.open_folder": "Open folder",
            "item.threat_warning": "Warning: Threat detected! Click to confirm before opening.",
            "item.threat_badge": "Threat Detected!",
            "item.scanning_defender": "Scanning with Windows Defender...",
            "item.safe": "Safe",
            "item.scan_failed": "Scan Failed",

            // Settings Modal
            "settings.title": "Advanced Settings",
            "settings.subtitle": "Download Queue, Bandwidth Limits & Proxy Configuration",
            "settings.close_title": "Close",
            "settings.tab.queue": "Queue",
            "settings.tab.bandwidth": "Bandwidth",
            "settings.tab.proxy": "Proxy",
            "settings.tab.browser": "Browser Integration",
            "settings.tab.other": "Other Settings",
            "header.schedule": "Schedule",
            "header.schedule_title": "Download Scheduler & Windows Power Management",
            "settings.tab.schedule": "Schedule & Power",

            // Schedule & Power Management (Windows Power Management & Win32 API)
            "schedule.title": "Download Scheduler",
            "schedule.desc": "Automatically start all queued or paused download tasks at the specified time.",
            "schedule.time_label": "Start Time:",
            "schedule.status_waiting": "Waiting for scheduled time...",
            "schedule.status_waiting_time": "Waiting until {0} to start queued downloads",
            "schedule.status_disabled": "Download scheduler is currently disabled",
            "schedule.trigger_now": "Test Run Now",
            "schedule.triggered_toast": "Scheduled time reached ({0}), queue downloads started automatically!",
            "schedule.saved_toast": "Schedule and power management settings saved successfully!",

            "power.title": "Windows Power Management",
            "power.desc": "Direct Win32 API interop: prevent sleep while downloading and take action upon completion.",
            "power.os_desc": "Windows will not automatically enter Sleep or turn off the screen while at least one download is actively running (ES_SYSTEM_REQUIRED | ES_CONTINUOUS).",
            "power.os_active": "Protected (ES_SYSTEM_REQUIRED)",
            "power.os_standby": "Standby (ES_CONTINUOUS)",
            "power.action_label": "Action when all queued downloads complete:",
            "power.action_none": "Do Nothing",
            "power.action_none_desc": "Keep computer running normally, restoring standard Windows power plan.",
            "power.action_sleep": "Sleep (Suspend)",
            "power.action_sleep_desc": "Put the computer into power-saving sleep mode after countdown expires.",
            "power.action_shutdown": "Shutdown Computer",
            "power.action_shutdown_desc": "Execute system command shutdown.exe /s /t 60 to shut down safely.",
            "power.countdown_label": "Warning countdown duration before action (seconds):",
            "power.countdown_desc": "Gives you time to abort the shutdown if you are still using the computer.",
            "power.seconds": "seconds",
            "power.seconds_upper": "SECONDS",
            "power.modal_title": "ALL DOWNLOADS COMPLETED",
            "power.modal_subtitle": "The computer will automatically shut down in:",
            "power.modal_subtitle_shutdown": "The computer will automatically shut down in:",
            "power.modal_subtitle_sleep": "The computer will enter sleep mode in:",
            "power.cancel_hint": "Click \"CANCEL SHUTDOWN\" or press ESC to abort.",
            "power.btn_cancel": "CANCEL SHUTDOWN (ABORT)",
            "power.btn_cancel_sleep": "CANCEL SLEEP",
            "power.btn_now": "Execute Now",
            "power.cancelled_toast": "Shutdown aborted successfully!",


            // Settings Tab 1: Queue
            "settings.queue.max_concurrent": "Maximum Concurrent Downloads",
            "settings.queue.max_concurrent_desc": "Controls how many files can download at the same time. Excess files remain queued and auto-start upon completion.",
            "settings.queue.opt_1": "1 file (Sequential download)",
            "settings.queue.opt_2": "2 simultaneous files (Recommended)",
            "settings.queue.opt_3": "3 simultaneous files",
            "settings.queue.opt_5": "5 simultaneous files",
            "settings.queue.opt_8": "8 simultaneous files",
            "settings.queue.opt_0": "0 (Unlimited - Download all)",
            "settings.queue.auto_next": "Auto-start next download in queue",
            "settings.queue.auto_next_desc": "Automatically trigger the next task as soon as a download finishes or is cancelled.",
            "settings.queue.threads": "Default threads per file",
            "settings.queue.threads_desc": "Number of parallel connections created by default when pasting new download links.",
            "settings.queue.threads_1": "1 thread",
            "settings.queue.threads_2": "2 threads",
            "settings.queue.threads_4": "4 threads (Optimal)",
            "settings.queue.threads_8": "8 threads",
            "settings.queue.threads_12": "12 threads",
            "settings.queue.threads_16": "16 threads",

            // Settings Tab 2: Bandwidth
            "settings.speed.enable": "Bandwidth Throttling",
            "settings.speed.enable_desc": "Applies multi-threaded Virtual Clock Leaky Bucket algorithm for smooth traffic shaping.",
            "settings.speed.presets": "Quick Presets:",
            "settings.speed.custom_label": "Or enter custom speed limit (KB/s):",
            "settings.speed.custom_placeholder": "e.g. 2048",
            "settings.speed.custom_unit": "KB/s",

            // Settings Tab 3: Proxy
            "settings.proxy.enable": "Enable Proxy",
            "settings.proxy.enable_desc": "Route all downloads and file probe requests through a Proxy server.",
            "settings.proxy.mode": "Proxy Mode",
            "settings.proxy.mode_desc": "Select automatic proxy detection or configure manual proxy parameters.",
            "settings.proxy.mode_manual": "Manual Proxy Configuration",
            "settings.proxy.mode_system": "Use Windows System Proxy Settings",
            "settings.proxy.mode_direct": "Direct Connection (Bypass Proxy)",
            "settings.proxy.info_system_title": "Windows System Proxy",
            "settings.proxy.info_system_desc": "The application will automatically synchronize and use the active Proxy configuration from Windows network settings.",
            "settings.proxy.info_direct_title": "Direct Internet Connection",
            "settings.proxy.info_direct_desc": "All download tasks will connect directly to the file host without passing through any intermediary proxy.",
            "settings.proxy.server_title": "Server Configuration",
            "settings.proxy.badge_manual": "Manual",
            "settings.proxy.type": "Protocol",
            "settings.proxy.host": "Server Address (Host / IP)",
            "settings.proxy.host_placeholder": "e.g. 127.0.0.1 or proxy.example.com",
            "settings.proxy.port": "Port",
            "settings.proxy.auth": "Require Authentication",
            "settings.proxy.auth_desc": "Enable if the proxy server requires Username and Password to connect.",
            "settings.proxy.user": "Username",
            "settings.proxy.user_placeholder": "Enter username...",
            "settings.proxy.pass": "Password",
            "settings.proxy.pass_placeholder": "Enter password...",
            "settings.proxy.bypass": "Bypass Proxy for local addresses",
            "settings.proxy.bypass_desc": "Do not route via Proxy when downloading from localhost, 127.0.0.1 or local LAN network.",
            "settings.proxy.test_btn": "Test Proxy Connection",
            "settings.proxy.test_hint": "Send test ping to measure latency and verify server availability",

            // Settings Tab 4: Browser Integration
            "settings.browser.status_title": "Local Loopback IPC Port Listening",
            "settings.browser.status_ready": "READY",
            "settings.browser.status_desc": "Chrome and Edge browsers will automatically forward URLs and filenames to this port whenever a web download starts.",
            "settings.browser.guide_title": "Chrome / Edge Extension Setup Guide (3 steps)",
            "settings.browser.step1_title": "Open Browser Extensions Manager",
            "settings.browser.step1_desc": "Open Chrome and navigate to chrome://extensions or Edge edge://extensions, then turn on 'Developer mode' in the top-right corner.",
            "settings.browser.step2_title": "Load Unpacked Extension",
            "settings.browser.step2_desc": "Click 'Load unpacked' and select the BrowserExtension folder from the project directory.",
            "settings.browser.step3_title": "Experience Automatic Download Capture",
            "settings.browser.step3_desc": "Click any downloadable file link (.zip, .iso, .exe, .mp4, .pdf...) or right-click and choose 'Download with DUT Download Accelerator' to instantly intercept!",
            "settings.browser.btn_open_folder": "Open Extension Folder",
            "settings.browser.btn_test_capture": "Send Test Capture Link",

            // Settings Tab 5: Other Settings
            "settings.theme.title": "Display Theme",
            "settings.theme.desc": "Choose Light, Dark or automatically sync with Windows System appearance (Default: Light).",
            "settings.theme.light": "Light Mode",
            "settings.theme.light_badge": "Default",
            "settings.theme.light_desc": "Clean, bright and crisp user interface",
            "settings.theme.dark": "Dark Mode",
            "settings.theme.dark_desc": "Modern dark palette, comfortable for prolonged use",
            "settings.theme.system": "System",
            "settings.theme.system_desc": "Automatically synchronizes with Windows OS theme",

            "settings.lang.title": "Display Language",
            "settings.lang.desc": "Choose the display language across the entire application interface (Default: Vietnamese).",
            "settings.lang.vi": "Tiếng Việt",
            "settings.lang.vi_badge": "Default",
            "settings.lang.vi_desc": "Accurate, intuitive Vietnamese language interface",
            "settings.lang.en": "English",
            "settings.lang.en_badge": "International",
            "settings.lang.en_desc": "Standard English interface for global users",

            "settings.confirm_delete": "Confirm before deleting files",
            "settings.confirm_delete_desc": "Show confirmation dialog before removing a file or clearing all tasks from the list.",

            "settings.footer.cancel": "Close",
            "settings.footer.save": "Save Settings",

            // Batch Modal
            "batch.title": "Batch URLs Download",
            "batch.subtitle": "Paste a list of URLs to automatically add all of them to the download queue",
            "batch.list_label": "URL List (one link per line):",
            "batch.valid_count": "{0} valid links",
            "batch.save_title": "Save Destination Folder",
            "batch.save_desc": "Choose a folder applied to all links in this list.",
            "batch.save_placeholder": "No folder selected",
            "batch.choose_folder": "Choose Folder",
            "batch.thread_title": "Threads per file",
            "batch.thread_desc": "More threads can increase download speed.",
            "batch.textarea_placeholder": "https://example.com/file1.zip\nhttps://example.com/file2.mp4\nhttps://example.com/file3.iso",
            "batch.cancel": "Cancel",
            "batch.submit": "Add to Queue",

            // Device Info
            "device.badge": "SYSTEM",
            "device.main_title": "Device & Storage Information",
            "device.main_desc": "Monitor hardware specs, drive capacity and file storage availability on your computer.",
            "device.refresh": "Refresh",
            "device.refresh_title": "Update to latest hardware information",
            "device.loading": "Reading hardware specs from system...",
            "device.machine_name": "Device Name",
            "device.os_version": "Operating System",
            "device.cpu": "Processor (CPU)",
            "device.threads_count": "{0} Logical Processors",
            "device.ram": "RAM Memory",
            "device.overall_title": "Total Device Storage Capacity",
            "device.used_pct": "{0}% Used",
            "device.used_stat": "Used: {0}",
            "device.free_stat": "Free Available: {0}",
            "device.total_stat": "Total Storage: {0} ({1} drives)",
            "device.drives_subtitle": "Storage Drives Detail",
            "device.fixed_drive": "Fixed Drive",
            "device.removable_drive": "Removable Drive",
            "device.local_drive": "Local Drive",
            "device.status_almost_full": "Almost full",
            "device.status_getting_full": "Getting full",
            "device.status_healthy": "Healthy",
            "device.detail_used": "Used",
            "device.detail_free": "Free",
            "device.detail_total": "Total Capacity",

            // Disk Space Warning Modal
            "disk.title": "Disk Space Warning",
            "disk.subtitle": "Checking system storage availability",
            "disk.current_drive": "Current Drive",
            "disk.suggested_drive": "Suggested Alternative",
            "disk.understood": "Understood",
            "disk.switch_folder": "Switch Folder Now",

            // Checksum / Verify Hash Modal
            "hash.title": "File Checksum Verification (Hash)",
            "hash.file_label": "Downloaded File Path:",
            "hash.expected_label": "Expected Hash from source (Optional match):",
            "hash.expected_placeholder": "Paste MD5 or SHA-256 hash from provider to compare...",
            "hash.calc_btn": "Calculate Hash",
            "hash.match_success": "Hash MATCHES PERFECTLY! The file is intact and authentic.",
            "hash.match_fail": "Hash MISMATCH! The file might be corrupted or modified.",

            // Validation & Alerts
            "validate.url_required": "Please enter a download link!",
            "validate.url_invalid": "Invalid link! Please enter a URL starting with http:// or https://",
            "validate.save_required": "Please choose a save folder!",
            "validate.clipboard_empty": "Clipboard is empty or does not contain text!",
            "validate.clipboard_blocked": "Browser blocked clipboard access. Please press Ctrl+V!",
            "validate.clipboard_fail": "Cannot paste automatically. Please press Ctrl+V!",
            "validate.browse_desktop_only": "Folder selection only works on desktop application!",

            // Common Buttons & Messages
            "common.close": "Close",
            "common.cancel": "Cancel",
            "common.confirm": "Confirm",
            "common.save": "Save",
            "toast.settings_saved": "Settings saved successfully!",
            "toast.lang_switched": "Switched to English",
            "toast.copied": "Link copied to clipboard!"
        }
    };

    let currentLanguage = "vi";

    /**
     * Get translated text for a given key
     * @param {string} key 
     * @param {string} fallback 
     * @returns {string}
     */
    function t(key, fallback = "") {
        const dict = translations[currentLanguage] || translations.vi;
        if (dict && dict[key] !== undefined) {
            return dict[key];
        }
        const fallbackDict = translations.vi;
        if (fallbackDict && fallbackDict[key] !== undefined) {
            return fallbackDict[key];
        }
        return fallback || key;
    }

    /**
     * Translate dynamic text with placeholders like {0}, {1}
     */
    function format(key, ...args) {
        let str = t(key);
        args.forEach((val, idx) => {
            str = str.replace(new RegExp(`\\{${idx}\\}`, 'g'), val);
        });
        return str;
    }

    /**
     * Apply language across the entire DOM
     * @param {string} lang - "vi" or "en"
     * @param {boolean} persist - whether to save to settings / localStorage
     */
    function setLanguage(lang, persist = true) {
        const targetLang = (lang === "en") ? "en" : "vi";
        currentLanguage = targetLang;

        document.documentElement.setAttribute("lang", targetLang);
        document.documentElement.setAttribute("data-language", targetLang);

        // 1. Text content replacement: [data-i18n]
        document.querySelectorAll("[data-i18n]").forEach(el => {
            // Không ghi đè nhãn tốc độ trên header nếu đang bật giới hạn băng thông
            if (el.id === "header-speed-limit-label") {
                const speedBtn = document.getElementById("btn-header-speed-limit");
                if (speedBtn && speedBtn.classList.contains("is-limited")) {
                    return;
                }
            }

            const key = el.getAttribute("data-i18n");
            const translated = t(key);
            if (translated) {
                if (el.hasAttribute("data-i18n-html")) {
                    el.innerHTML = translated;
                } else {
                    el.textContent = translated;
                }
            }
        });

        // 2. Placeholder replacement: [data-i18n-placeholder]
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            const translated = t(key);
            if (translated) {
                el.placeholder = translated;
            }
        });

        // 3. Title / tooltip replacement: [data-i18n-title]
        document.querySelectorAll("[data-i18n-title]").forEach(el => {
            if (el.id === "btn-header-speed-limit" && el.classList.contains("is-limited")) {
                return;
            }
            const key = el.getAttribute("data-i18n-title");
            const translated = t(key);
            if (translated) {
                el.title = translated;
            }
        });

        // 4. Update Language radio and cards UI in Settings Modal
        const radioVi = document.getElementById("setting-lang-vi");
        const radioEn = document.getElementById("setting-lang-en");
        if (targetLang === "en") {
            if (radioEn) radioEn.checked = true;
        } else {
            if (radioVi) radioVi.checked = true;
        }

        document.querySelectorAll(".lang-option-card").forEach(card => {
            card.classList.toggle("active", card.dataset.langVal === targetLang);
        });

        // 5. Update header speed label and tooltip
        const speedLabel = document.getElementById("header-speed-limit-label");
        const speedBtn = document.getElementById("btn-header-speed-limit");
        if (speedBtn) {
            if (speedBtn.classList.contains("is-limited")) {
                if (speedLabel) {
                    speedBtn.title = (targetLang === "en")
                        ? `Bandwidth limit: ${speedLabel.textContent} (Click to adjust)`
                        : `Giới hạn băng thông: ${speedLabel.textContent} (Nhấp để điều chỉnh)`;
                }
            } else {
                if (speedLabel) speedLabel.textContent = t("header.speed_unlimited");
                speedBtn.title = t("header.speed_limit_title");
            }
        }

        // 5b. Update header language toggle button if present
        const langLabel = document.getElementById("header-lang-label");
        const langBtn = document.getElementById("btn-header-lang-toggle");
        if (langLabel) {
            langLabel.textContent = targetLang.toUpperCase();
        }
        if (langBtn) {
            langBtn.title = t("header.lang_title", "Chuy?n ??i ng?n ng? / Switch language");
            langBtn.setAttribute("aria-label", langBtn.title);
        }

        // 6. Notify subscribers (ui.js, download.js, etc.)
        window.dispatchEvent(new CustomEvent("app:languagechange", {
            detail: { language: targetLang }
        }));

        // 7. Persist to localStorage and notify C# via IPC only if explicitly requested
        if (persist) {
            try {
                localStorage.setItem("app_language", targetLang);
            } catch (e) {}

            if (window.chrome && window.chrome.webview) {
                window.chrome.webview.postMessage(JSON.stringify({
                    action: "UPDATE_LANGUAGE",
                    language: targetLang
                }));
            }
        }
    }

    // Auto-initialize on load
    function initLanguage() {
        let savedLang = "vi";
        try {
            savedLang = localStorage.getItem("app_language") || "vi";
        } catch (e) {}
        setLanguage(savedLang, false);
    }

    // Delegate click on Language option cards (Stage/preview locally without auto-saving)
    document.addEventListener("click", (e) => {
        const langCard = e.target.closest(".lang-option-card");
        if (langCard && langCard.dataset.langVal) {
            setLanguage(langCard.dataset.langVal, false);
        }
    });

    // Expose API globally
    global.i18n = {
        t: t,
        format: format,
        getLanguage: () => currentLanguage,
        getCurrentLanguage: () => currentLanguage,
        setLanguage: setLanguage,
        translations: translations
    };
    global.setLanguage = setLanguage;

    // Run init after DOM is interactive
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initLanguage);
    } else {
        initLanguage();
    }

})(window);
