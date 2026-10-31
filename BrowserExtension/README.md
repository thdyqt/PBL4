# DUT Download Accelerator - Tiện ích Trình duyệt (Chrome / Microsoft Edge)

Tiện ích mở rộng chính thức cho trình duyệt Google Chrome và Microsoft Edge (chuẩn Manifest V3) giúp tự động chặn và "bắt" liên kết tải về của các tệp tin (`.zip`, `.rar`, `.iso`, `.exe`, `.mp4`...) và gửi thẳng tới ứng dụng **DUT Download Accelerator** thông qua Local Loopback Socket (`http://127.0.0.1:8989`).

---

## Hướng dẫn cài đặt vào trình duyệt (3 bước cực nhanh)

### Đối với Google Chrome:
1. Mở Chrome, truy cập vào đường dẫn: `chrome://extensions`
2. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
3. Nhấp vào nút **"Tải tiện ích đã giải nén" (Load unpacked)** ở góc trên bên trái.
4. Chọn thư mục này: `C:\PBL4-Branch\BrowserExtension`.
5. Biểu tượng **DUT Accelerator** sẽ xuất hiện trên thanh công cụ của trình duyệt!

### Đối với Microsoft Edge:
1. Mở Edge, truy cập vào đường dẫn: `edge://extensions`
2. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở menu bên trái.
3. Nhấp vào nút **"Tải phần mở rộng đã giải nén" (Load unpacked)**.
4. Chọn thư mục này: `C:\PBL4-Branch\BrowserExtension`.

---

## Các tính năng chính
- **Tự động bắt link tải (Download Interception):** Bấm tải bất kỳ file nén, video, phần mềm trên web sẽ tự động kích hoạt cửa sổ tải của ứng dụng.
- **Menu chuột phải (Context Menu):** Nhấp chuột phải vào link bất kỳ chọn *"Tải bằng DUT Download Accelerator"*.
- **Tùy biến định dạng tệp:** Thêm/bớt các đuôi mở rộng muốn bắt link ngay trên giao diện Popup.
- **An toàn & mượt mà:** Nếu ứng dụng chưa mở, tiện ích sẽ không làm gián đoạn lượt tải mặc định của trình duyệt.
