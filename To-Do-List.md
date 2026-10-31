# Đề xuất Tính năng Đề tài PBL4 (Hệ điều hành & Mạng máy tính)

Để đề tài PBL4 gây ấn tượng mạnh với giảng viên và hội đồng bảo vệ, bạn không nên chỉ thêm tính năng "cho có", mà mỗi tính năng thêm vào phải làm nổi bật được kiến thức về HĐH Windows hoặc Mạng máy tính. 

Dưới đây là các chức năng được phân loại theo mức độ giá trị, bản chất kỹ thuật và độ khó để nhóm bạn lựa chọn:

## NHÓM 1: CÁC CHỨC NĂNG ĐẬM CHẤT "HỆ ĐIỀU HÀNH WINDOWS" 
*(⭐ Ghi điểm lý thuyết HĐH cao nhất)*

### 1. Lập lịch tải & Quản lý nguồn điện Windows (Scheduler & Windows Power Management) [ĐÃ HOÀN THÀNH - COMPLETED]
- **Mô tả:** Người dùng hẹn giờ: "01:00 sáng tự động bắt đầu tải danh sách hàng đợi, tải xong hết thì tự Tắt máy (Shutdown) hoặc Ngủ (Sleep)".
- **Bản chất HĐH:**
  - *Tránh bị hệ điều hành "ru ngủ" khi đang tải:* Gọi Win32 API `SetThreadExecutionState` (`ES_SYSTEM_REQUIRED | ES_CONTINUOUS`) để báo Windows không được tự động Sleep khi đang có luồng tải chạy ngầm.
  - *Tự động tắt máy / Sleep:* Sau khi tất cả task hoàn tất, gọi API Win32 `ExitWindowsEx` hoặc lệnh hệ thống `shutdown.exe /s /t 60` (kèm thông báo đếm ngược 60s để người dùng có thể hủy nếu còn ngồi trước máy).
- **Độ khó:** ⭐⭐ *(Khá dễ làm, nhưng giảng viên HĐH rất thích vì có tương tác với Windows Power Management).*

### 2. Tự động quét virus qua Windows Defender sau khi tải xong (Antivirus Integration)
- **Mô tả:** Ngay sau khi file tải về và verify SHA-256 hoàn tất, ứng dụng tự động kích hoạt bộ quét mã độc của Windows để kiểm tra file an toàn trước khi cho phép người dùng mở.
- **Bản chất HĐH:**
  - *Tương tác tiến trình hệ thống:* Sử dụng `Process.Start` để gọi công cụ dòng lệnh tích hợp sẵn của Windows Defender: `"C:\Program Files\Windows Defender\MpCmdRun.exe" -Scan -ScanType 3 -File "duong_dan_file"`
  - *Đọc Exit Code và Standard Output:* Đọc dữ liệu của tiến trình để hiển thị trạng thái trên giao diện: "File an toàn" hoặc "Phát hiện mối đe dọa!".
- **Độ khó:** ⭐⭐ *(Rất dễ cài đặt, tính ứng dụng thực tế cực cao).*

### 3. Tích hợp sâu vào Windows Shell (System Tray, Toast Notification, Run on Startup)
- **Mô tả:**
  - Khi bấm dấu X tắt app, app thu nhỏ xuống khay hệ thống (System Tray Icon) chứ không tắt hẳn để tải ngầm.
  - Khi tải xong một file, bắn Windows Toast Notification ở góc dưới màn hình (kèm nút "Mở file").
  - Tùy chọn "Khởi động cùng Windows" trong phần Cài đặt.
- **Bản chất HĐH:**
  - *Khay hệ thống:* Sử dụng Win32 `NotifyIcon` và quản lý vòng đời ứng dụng nền (Background Process Lifecycle).
  - *Khởi động cùng Windows:* Thao tác trực tiếp với Windows Registry tại nhánh: `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`.
  - *Windows Notification API:* Gửi thông báo chuẩn qua Windows Notification Server.
- **Độ khó:** ⭐⭐ *(Giao diện chuyên nghiệp như IDM thật).*

---

## NHÓM 2: CÁC CHỨC NĂNG ĐẬM CHẤT "MẠNG MÁY TÍNH" 
*(⭐ Ghi điểm kiến thức Mạng)*

### 4. Bắt link tự động từ trình duyệt (Browser Integration / Extension)
- **Mô tả:** Người dùng lướt web trên Chrome/Edge, khi bấm vào một link tải file `.zip`, `.iso`, `.exe`, ứng dụng tự động "bắt" lấy link và bật cửa sổ Download lên thay vì để trình duyệt tải.
- **Bản chất Mạng & HĐH:**
  - Viết một Extension nhỏ cho Chrome/Edge.
  - *Cơ chế IPC / Local Loopback:* Extension dùng `chrome.downloads.onCreated` để chặn lượt tải, sau đó gửi URL qua một Local HTTP Web Server / WebSocket chạy ngầm ngay trong C# (ví dụ cổng `http://127.0.0.1:8989`), hoặc sử dụng chuẩn Chrome Native Messaging (giao tiếp qua stdin/stdout giữa extension và file `.exe` qua Registry).
- **Độ khó:** ⭐⭐⭐⭐ *(Khó hơn một chút nhưng nếu làm được thì đề tài này đạt điểm tuyệt đối 9.5 - 10).*

### 5. Chia nhỏ luồng động (Dynamic Segment Splitting - Thuật toán đỉnh cao của IDM)
- **Mô tả:** Hiện tại app của bạn chia đều file từ đầu (ví dụ 4 luồng chia 4 phần bằng nhau). Nhưng giả sử luồng 1, 2, 3 tải xong trước mà luồng 4 gặp mạng chậm còn lại 100MB -> Luồng 1, 2, 3 sẽ bị ngồi chơi (idle).
- **Bản chất:**
  - Khi một luồng tải xong, nó không dừng lại mà tìm luồng đang có đoạn dở dang dài nhất, "cắt đôi" đoạn dở đó ra để hỗ trợ tải tiếp.
  - Tận dụng tối đa băng thông liên tục cho đến byte cuối cùng.
- **Độ khó:** ⭐⭐⭐⭐ *(Thuật toán đồng bộ hóa luồng phức tạp hơn, nhưng phản biện trước hội đồng thì cực kỳ thuyết phục).*

### 6. Tải hàng loạt theo quy luật (Batch Download / Pattern Matching)
- **Mô tả:**
  - Cho phép người dùng nhập cú pháp URL: `https://example.com/tailieu/chuong_[01-20].pdf`.
  - Hoặc nhập danh sách hàng chục link từ file `.txt` / `.csv`.
  - Ứng dụng tự động sinh ra 20 task tải và đưa vào hàng đợi tải lần lượt.
- **Bản chất Mạng:** Quản lý tài nguyên hàng đợi (Queue Scheduling), kiểm soát socket để không làm nghẽn card mạng.
- **Độ khó:** ⭐⭐ *(Rất dễ viết, chỉ cần regex sinh link và vòng lặp add task).*

---

## NHÓM 3: NÂNG TẦM TRẢI NGHIỆM & GIAO DIỆN (UI/UX)

### 7. Biểu đồ thống kê tốc độ thời gian thực (Real-time Speed Chart)
- **Mô tả:** Trên giao diện WebView2, thêm một tab hiển thị đồ thị đường (Line Chart) biểu diễn tốc độ tải (KB/s - MB/s) dao động theo từng giây, kèm biểu đồ tài nguyên CPU / RAM của app.
- **Bản chất:** Dùng JavaScript (Chart.js hoặc Canvas) vẽ dữ liệu tốc độ do C# đẩy lên mỗi 500ms. Thầy cô nhìn vào thấy app rất "sống động" và trực quan.
- **Độ khó:** ⭐⭐ *(Dễ, có sẵn thư viện JS).*

### 8. Tự động phân loại thư mục lưu trữ thông minh (Smart Categorization)
- **Mô tả:** Tương tự IDM:
  - File `.mp4`, `.mkv` -> tự gợi ý lưu vào `Downloads/Videos`
  - File `.zip`, `.rar`, `.7z` -> `Downloads/Compressed`
  - File `.exe`, `.msi` -> `Downloads/Programs`
  - File `.pdf`, `.docx`, `.xlsx` -> `Downloads/Documents`
- **Bản chất HĐH:** Sử dụng `Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments, ...)` để lấy chuẩn thư mục người dùng của Windows.
- **Độ khó:** ⭐ *(Rất dễ, chỉ cần map extension đuôi file).*

---

## 💡 LỜI KHUYÊN NÊN CHỌN GÌ CHO ĐỢT BÁO CÁO NÀY?

Nếu thời gian có hạn, tôi khuyên nhóm bạn nên ưu tiên làm 3 chức năng sau vì tốn ít thời gian nhất nhưng hiệu quả ghi điểm cao nhất:
1. **Lập lịch tải & Tự động tắt máy (Scheduler & Sleep/Shutdown):** Đậm chất môn Hệ điều hành, demo rất sướng mắt.
2. **Quét virus tự động qua Windows Defender:** Chỉ cần 1 hàm gọi `Process.Start("MpCmdRun.exe")` mất khoảng 30 dòng code C#, nhưng tạo cảm giác ứng dụng hoàn chỉnh như phần mềm thương mại.
3. **Phân loại file tự động + Khay hệ thống (System Tray):** Tăng tính tiện dụng cho người dùng.

> **Bạn thấy hứng thú với chức năng nào nhất trong danh sách trên?** Hãy cho tôi biết, tôi sẽ hướng dẫn thiết kế chi tiết và viết mã nguồn chuẩn cho chức năng đó ngay vào dự án của bạn!