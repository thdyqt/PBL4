# TỔNG HỢP MÃ NGUỒN MERMAID VÀ ẢNH ĐỒ THỊ CHƯƠNG 2

Tất cả các ảnh PNG độ phân giải cao đã được tạo sẵn trong thư mục `docs/images/`.
Bạn có thể chèn trực tiếp các ảnh này vào file Word `Báo cáo PBL4.docx`.

---

## 1. Hình 2.1: Sơ đồ Use Case tổng thể hệ thống
* File ảnh PNG: [hinh_2_1_use_case.png](file:///c:/PBL4/docs/images/hinh_2_1_use_case.png)
* Mã nguồn Mermaid:

```text
flowchart LR
    User((Người dùng))
    Extension((Browser Extension))

    subgraph SystemBoundary ["HỆ THỐNG DUT DOWNLOAD ACCELERATOR"]
        UC1([Thêm liên kết tải mới])
        UC2([Tải hàng loạt Batch URLs])
        UC3([Tải đa luồng song song])
        UC4([Tạm dừng / Tiếp tục Resume])
        UC5([Hủy / Xóa tác vụ])
        UC6([Điều phối hàng đợi Queue])
        UC7([Giới hạn tốc độ tải])
        UC8([Cấu hình Proxy])
        UC9([Lập lịch tải tự động])
        UC10([Quản lý nguồn điện Win32])
        UC11([Kiểm tra mã băm Checksum])
        UC12([Quét mã độc Windows Defender])
        UC13([Bắt link tự động qua IPC])
        UC14([Giám sát hiệu năng CPU/RAM])
    end

    User --> UC1
    User --> UC2
    User --> UC4
    User --> UC5
    User --> UC7
    User --> UC8
    User --> UC9
    User --> UC10
    User --> UC11
    User --> UC14

    Extension --> UC13
    UC13 -.->|include| UC1
    UC1 -.->|include| UC3
    UC2 -.->|include| UC3
    UC3 -.->|extend| UC6
    UC3 -.->|extend| UC10
    UC3 -.->|include| UC12
```

---

## 2. Hình 2.2: Sơ đồ Kiến trúc phân tầng tổng thể hệ thống
* File ảnh PNG: [hinh_2_2_kien_truc_he_thong.png](file:///c:/PBL4/docs/images/hinh_2_2_kien_truc_he_thong.png)
* Mã nguồn Mermaid:

```text
graph TD
    subgraph Layer1 ["TẦNG TRÌNH DIỄN (PRESENTATION LAYER - WEBVIEW2)"]
        UI["Giao diện HTML5 / CSS3 / JavaScript ES6"]
        Chart["Biểu đồ thời gian thực Chart.js (CPU, RAM, Speed)"]
        Theme["Bộ quản lý Dark/Light Theme & Song ngữ i18n"]
    end

    subgraph Layer2 ["TẦNG GIAO TIẾP VÀ CẦU NỐI (IPC & MESSAGING LAYER)"]
        IPCServer["Local Loopback HTTP Server (127.0.0.1:8989)"]
        MsgHandler["WebView2 MessageHandler (Two-way Async Bridge)"]
    end

    subgraph Layer3 ["TẦNG ĐIỀU PHỐI NGHIỆP VỤ (BUSINESS LOGIC LAYER)"]
        DM["DownloadManager (Quản lý hàng đợi & Tác vụ)"]
        Scheduler["DownloadScheduler (Lập lịch tải tự động)"]
        Limiter["SpeedLimiter (Điều tiết Token Bucket)"]
        Settings["SettingsManager (Cấu hình hệ thống)"]
    end

    subgraph Layer4 ["TẦNG ĐỘNG CƠ TẢI DỮ LIỆU (NETWORK TRANSFER ENGINE)"]
        Probe["RemoteProbe (Thăm dò HEAD / GET Range 0-0)"]
        HttpEngine["DownloadJob (Động cơ tải HTTP/HTTPS đa luồng)"]
        FtpEngine["FtpJob (Động cơ tải FTP Passive Mode)"]
        Workers["N x Segment Workers (Tải song song theo dải byte)"]
    end

    subgraph Layer5 ["TẦNG LƯU TRỮ VÀ HỆ ĐIỀU HÀNH (STORAGE & WINDOWS OS)"]
        FileIO["FileStream Zero-Copy Write (Seek Direct Write)"]
        DB["SQLite Database (downloads.db - WAL Mode)"]
        MetaFile[".dlmeta (Tệp sao lưu phục hồi sự cố)"]
        Win32Power["Win32 API: SetThreadExecutionState (Chống Sleep)"]
        Defender["Windows Defender CLI: MpCmdRun.exe (Quét virus)"]
    end

    BrowserExt["Chrome / Edge Extension"] -.->|POST /capture| IPCServer
    IPCServer -->|Kích hoạt tải| MsgHandler
    UI <===>|postMessage / ExecuteScript| MsgHandler
    MsgHandler <===> DM
    DM --> Scheduler
    DM --> Limiter
    DM --> Probe
    DM --> HttpEngine
    DM --> FtpEngine
    HttpEngine --> Workers
    Workers -->|Ghi dữ liệu song song| FileIO
    HttpEngine -->|Lưu tiến độ| DB
    HttpEngine -->|Sao lưu| MetaFile
    DM --> Win32Power
    HttpEngine --> Defender
```

---

## 3. Hình 2.3: Sơ đồ tuần tự quy trình tải tệp đa luồng song song
* File ảnh PNG: [hinh_2_3_tuan_tu_tai_da_luong.png](file:///c:/PBL4/docs/images/hinh_2_3_tuan_tu_tai_da_luong.png)
* Mã nguồn Mermaid:

```text
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant UI as Giao diện WebView2
    participant DM as DownloadManager
    participant Probe as RemoteProbe
    participant Job as DownloadJob
    participant FS as FileStream (Disk)
    participant Server as Web Server (CDN)

    User->>UI: Dán URL & Nhấn "Bắt đầu tải"
    UI->>DM: START_DOWNLOAD (url, threads=8)
    DM->>Probe: InspectAsync(url)
    Probe->>Server: HEAD /file.zip
    alt Server chặn HEAD (403/405)
        Probe->>Server: GET /file.zip (Range: bytes=0-0)
        Server-->>Probe: 206 Partial Content (Content-Range: bytes 0-0/Total)
    else Server chấp nhận HEAD
        Server-->>Probe: 200 OK (Content-Length, Accept-Ranges: bytes)
    end
    Probe-->>DM: RemoteFileInfo (Length, SupportsRanges=True)

    DM->>Job: Khởi tạo DownloadJob & Tính toán 8 Segments
    Job->>FS: Khởi tạo file & SetLength(TotalLength)
    
    par Tải song song 8 luồng
        Job->>Server: Luồng 1: GET (Range: bytes=0 - End1)
        Job->>Server: Luồng 2: GET (Range: bytes=Start2 - End2)
        Job->>Server: ...
        Job->>Server: Luồng 8: GET (Range: bytes=Start8 - End8)
    end

    loop Trong quá trình truyền dữ liệu
        Server-->>Job: Dòng byte nhị phân của từng đoạn
        Job->>FS: Seek(StartOffset + Downloaded) & Write trực tiếp
        Job->>UI: Phát sự kiện ProgressChanged (Speed, %, Segments)
    end

    Server-->>Job: Toàn bộ 8 luồng hoàn thành
    Job->>FS: Flush() & Đóng FileStream
    Job->>Job: Tính Checksum SHA-256 & Gọi Windows Defender
    Job->>UI: Trạng thái Completed (Phát chuông Asterisk & Toast)
```

---

## 4. Hình 2.4: Sơ đồ tuần tự cơ chế bắt link tự động từ Browser Extension
* File ảnh PNG: [hinh_2_4_tuan_tu_bat_link_extension.png](file:///c:/PBL4/docs/images/hinh_2_4_tuan_tu_bat_link_extension.png)
* Mã nguồn Mermaid:

```text
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Chrome as Trình duyệt (Chrome/Edge)
    participant Ext as Browser Extension (background.js)
    participant IPC as Local IPC Server (127.0.0.1:8989)
    participant App as Form1 & WebView2 UI

    User->>Chrome: Bấm nút "Tải xuống" trên Google Drive / Web bất kỳ
    Chrome->>Chrome: Kích hoạt sự kiện onDeterminingFilename
    Note over Chrome,Ext: Chrome đã nhận diện xong URL chuyển hướng cuối cùng
    Chrome->>Ext: Bắt thông tin: downloadUrl, fileName, cookies, referrer
    Ext->>Chrome: chrome.downloads.cancel (Hủy tải mặc định trên Chrome)
    
    Ext->>IPC: POST http://127.0.0.1:8989/capture (JSON Payload)
    IPC-->>Ext: 200 OK {"success": true}
    
    IPC->>App: Kích hoạt sự kiện LinkCaptured
    App->>App: Gọi Win32 ShowWindow(SW_MAXIMIZE) đưa App lên toàn màn hình
    App->>App: Điền tự động URL & Tên file vào Form tải mới
    App->>User: Hiển thị hộp thoại sẵn sàng tải đa luồng
```

---

## 5. Hình 2.5: Sơ đồ máy trạng thái (State Diagram) của tác vụ tải về
* File ảnh PNG: [hinh_2_5_may_trang_thai_tac_vu.png](file:///c:/PBL4/docs/images/hinh_2_5_may_trang_thai_tac_vu.png)
* Mã nguồn Mermaid:

```text
stateDiagram-v2
    [*] --> Queued : Thêm vào danh sách (Hàng đợi đầy)
    [*] --> Preparing : Bắt đầu ngay (Còn slot tải)
    
    Queued --> Preparing : Đến lượt tải (Slot trống)
    Preparing --> Downloading : Thăm dò tệp thành công & Khởi tạo luồng
    Preparing --> Failed : Lỗi kết nối / URL hỏng / Ổ đĩa đầy

    Downloading --> Paused : Người dùng nhấn "Tạm dừng"
    Paused --> Downloading : Người dùng nhấn "Tiếp tục" (Resume)

    Downloading --> Completed : Tất cả các segment tải xong 100%
    Downloading --> Failed : Mất mạng kéo dài / Lỗi ghi đĩa quá số lần Retry
    
    Queued --> Cancelled : Người dùng hủy tác vụ
    Preparing --> Cancelled : Người dùng hủy tác vụ
    Downloading --> Cancelled : Người dùng hủy tác vụ
    Paused --> Cancelled : Người dùng hủy tác vụ

    Completed --> [*]
    Failed --> [*]
    Cancelled --> [*]
```

---

## 6. Hình 2.6: Sơ đồ cấu trúc cơ sở dữ liệu SQLite
* File ảnh PNG: [hinh_2_6_co_so_du_lieu_erd.png](file:///c:/PBL4/docs/images/hinh_2_6_co_so_du_lieu_erd.png)
* Mã nguồn Mermaid:

```text
erDiagram
    DOWNLOAD_HISTORY {
        TEXT id PK "Khóa chính taskId GUID"
        TEXT source_url "URL goc nguoi dung nhap"
        TEXT remote_url "URL CDN thuc te sau redirect"
        TEXT file_name "Ten tep tin"
        TEXT target_path "Duong dan luu tep tren o dia"
        INTEGER total_bytes "Tong dung luong tep byte"
        INTEGER downloaded "So byte da tai duoc"
        TEXT state "Trang thai downloading, paused..."
        INTEGER supports_ranges "Ho tro chia luong 1 Co, 0 Khong"
        INTEGER threads "So luong cau hinh"
        REAL elapsed_seconds "Thoi gian tai thuc te giay"
        TEXT avg_speed "Toc do tai trung binh"
        TEXT etag "Ma nhan dien ETag"
        TEXT last_modified "Thoi gian sua doi cuoi cung"
        TEXT file_hash "Ma bam SHA-256 sau khi hoan tat"
        TEXT virus_scan_status "Trang thai quet virus"
        TEXT virus_scan_result "Ket qua quet Windows Defender"
        TEXT error_message "Thong bao loi chi tiet"
        TEXT segments_json "Mang JSON luu vet tung Segment"
        TEXT created_at "Thoi diem tao tac vu"
        TEXT updated_at "Thoi diem cap nhat gan nhat"
        TEXT completed_at "Thoi diem hoan thanh"
    }

    SETTINGS_JSON {
        INTEGER maxConcurrentDownloads "So tac vu tai song song toi da"
        INTEGER speedLimitKbps "Gioi han toc do tai KBps"
        TEXT defaultSavePath "Thu muc luu tep mac dinh"
        INTEGER defaultThreads "So luong tai mac dinh"
        BOOLEAN dynamicThreadAllocation "Tu dong dieu chinh luong"
        BOOLEAN autoStartNextInQueue "Tu kich hoat tep tiep theo"
        TEXT theme "Giao dien light dark"
        TEXT language "Ngon ngu vi en"
        BOOLEAN showToastOnCompletion "Thong bao Toast Windows"
        BOOLEAN playSoundOnCompletion "Phat chuong Asterisk"
        BOOLEAN autoOpenFolderOnCompletion "Tu mo thu muc sau khi tai"
    }

    DOWNLOAD_HISTORY ||--o{ SETTINGS_JSON : "Dieu phoi boi"
```

