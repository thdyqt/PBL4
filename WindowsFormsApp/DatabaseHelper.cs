using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Quản lý CSDL SQLite cục bộ để lưu lịch sử và tiến độ tải xuống.
    /// Tương tự cách IDM lưu trạng thái: mỗi tác vụ là một bản ghi,
    /// thông tin segment được lưu dưới dạng JSON để resume sau crash.
    /// </summary>
    public static class DatabaseHelper
    {
        // ------------------------------------------------------------------ cấu hình

        /// <summary>Đường dẫn file SQLite (nằm cạnh file .exe).</summary>
        public static string DbPath { get; private set; }

        private static string _connectionString;

        // ------------------------------------------------------------------ khởi tạo

        /// <summary>
        /// Khởi tạo CSDL: tạo file nếu chưa có, tạo các bảng, bật WAL.
        /// Phải gọi một lần trước khi dùng bất kỳ phương thức nào khác.
        /// </summary>
        public static void Initialize(string appDirectory = null)
        {
            string dir = appDirectory ?? System.Windows.Forms.Application.StartupPath;
            DbPath = Path.Combine(dir, "downloads.db");
            _connectionString = $"Data Source={DbPath};";

            // Khởi động SQLitePCL (bắt buộc với Microsoft.Data.Sqlite trên .NET Framework)
            SQLitePCL.Batteries_V2.Init();

            using (var conn = Open())
            {
                // WAL mode: ghi nhanh hơn, an toàn hơn khi crash
                Execute(conn, "PRAGMA journal_mode=WAL;");
                Execute(conn, "PRAGMA synchronous=NORMAL;");

                // Bảng chính: mỗi dòng = một tác vụ tải (kể cả đang tải dở)
                Execute(conn, @"
                    CREATE TABLE IF NOT EXISTS download_history (
                        id              TEXT PRIMARY KEY,          -- taskId (GUID)
                        source_url      TEXT NOT NULL,             -- URL người dùng nhập
                        remote_url      TEXT NOT NULL,             -- URL sau redirect
                        file_name       TEXT NOT NULL,             -- tên file
                        target_path     TEXT NOT NULL,             -- đường dẫn lưu
                        total_bytes     INTEGER NOT NULL DEFAULT 0,
                        downloaded      INTEGER NOT NULL DEFAULT 0,
                        state           TEXT NOT NULL DEFAULT 'preparing',
                        supports_ranges INTEGER NOT NULL DEFAULT 0, -- 0/1
                        threads         INTEGER NOT NULL DEFAULT 1,
                        elapsed_seconds REAL NOT NULL DEFAULT 0,    -- thời gian tải thực tế
                        avg_speed       TEXT,                      -- tốc độ trung bình
                        etag            TEXT,
                        last_modified   TEXT,
                        file_hash       TEXT,                      -- SHA-256 khi hoàn thành
                        error_message   TEXT,
                        segments_json   TEXT,                      -- JSON mảng SegmentMeta
                        created_at      TEXT NOT NULL,
                        updated_at      TEXT NOT NULL,
                        completed_at    TEXT                       -- Thời điểm hoàn thành theo giờ VN
                    );
                ");

                // Đảm bảo các cột mới tồn tại cho CSDL cũ đã tạo từ trước
                EnsureColumn(conn, "download_history", "elapsed_seconds", "REAL NOT NULL DEFAULT 0");
                EnsureColumn(conn, "download_history", "avg_speed", "TEXT");
                EnsureColumn(conn, "download_history", "virus_scan_status", "TEXT");
                EnsureColumn(conn, "download_history", "virus_scan_result", "TEXT");

                // Index tìm nhanh theo trạng thái (ví dụ: tải tất cả bản ghi đang dở)
                Execute(conn, "CREATE INDEX IF NOT EXISTS idx_state ON download_history(state);");
                Execute(conn, "CREATE INDEX IF NOT EXISTS idx_created ON download_history(created_at DESC);");
            }
        }

        private static void EnsureColumn(SqliteConnection conn, string table, string column, string typeDef)
        {
            try
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} {typeDef};";
                    cmd.ExecuteNonQuery();
                }
            }
            catch { /* Cột đã tồn tại */ }
        }

        /// <summary>Lấy chuỗi ngày giờ theo múi giờ Việt Nam (UTC+7) chuẩn dd/MM/yyyy HH:mm:ss.</summary>
        public static string GetVietnamTimeString(DateTime? utc = null)
        {
            DateTime u = utc ?? DateTime.UtcNow;
            try
            {
                TimeZoneInfo tz = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
                DateTime vnTime = TimeZoneInfo.ConvertTimeFromUtc(u, tz);
                return vnTime.ToString("dd/MM/yyyy HH:mm:ss");
            }
            catch
            {
                return u.AddHours(7).ToString("dd/MM/yyyy HH:mm:ss");
            }
        }

        // ------------------------------------------------------------------ CRUD

        /// <summary>
        /// Thêm mới một bản ghi tác vụ tải.
        /// Gọi ngay sau khi DownloadJob được tạo, TRƯỚC khi bắt đầu tải.
        /// </summary>
        public static void Insert(DownloadRecord record)
        {
            if (record == null) throw new ArgumentNullException("record");
            record.CreatedAt = record.UpdatedAt = DateTime.UtcNow;

            using (var conn = Open())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    INSERT OR REPLACE INTO download_history
                        (id, source_url, remote_url, file_name, target_path,
                         total_bytes, downloaded, state, supports_ranges, threads,
                         elapsed_seconds, avg_speed,
                         etag, last_modified, file_hash, error_message, segments_json,
                         created_at, updated_at, completed_at,
                         virus_scan_status, virus_scan_result)
                    VALUES
                        (@id, @src, @remote, @name, @path,
                         @total, @dl, @state, @ranges, @threads,
                         @elapsed, @avgspeed,
                         @etag, @lm, @hash, @err, @segs,
                         @created, @updated, @completed,
                         @virus_status, @virus_result);
                ";
                BindRecord(cmd, record);
                cmd.ExecuteNonQuery();
            }
        }

        /// <summary>
        /// Cập nhật trạng thái, tiến độ và segments của một tác vụ đang tải.
        /// Gọi định kỳ (tương tự SaveMetaSafe) và khi trạng thái thay đổi.
        /// </summary>
        public static void UpdateProgress(DownloadRecord record)
        {
            if (record == null) return;
            record.UpdatedAt = DateTime.UtcNow;

            using (var conn = Open())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    UPDATE download_history SET
                        file_name       = @name,
                        target_path     = @path,
                        total_bytes     = @total,
                        downloaded      = @dl,
                        state           = @state,
                        supports_ranges = @ranges,
                        threads         = @threads,
                        elapsed_seconds = @elapsed,
                        avg_speed       = @avgspeed,
                        file_hash       = @hash,
                        error_message   = @err,
                        segments_json   = @segs,
                        updated_at      = @updated,
                        completed_at    = @completed,
                        virus_scan_status = @virus_status,
                        virus_scan_result = @virus_result
                    WHERE id = @id;
                ";
                cmd.Parameters.AddWithValue("@name", (object)record.FileName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@path", (object)record.TargetPath ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@total", record.TotalBytes);
                cmd.Parameters.AddWithValue("@dl", record.Downloaded);
                cmd.Parameters.AddWithValue("@state", record.State ?? "preparing");
                cmd.Parameters.AddWithValue("@ranges", record.SupportsRanges ? 1 : 0);
                cmd.Parameters.AddWithValue("@threads", record.Threads);
                cmd.Parameters.AddWithValue("@elapsed", record.ElapsedSeconds);
                cmd.Parameters.AddWithValue("@avgspeed", (object)record.AvgSpeed ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@hash", (object)record.FileHash ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@err", (object)record.ErrorMessage ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@segs", (object)record.SegmentsJson ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@updated", Iso(record.UpdatedAt));
                cmd.Parameters.AddWithValue("@completed", (object)record.CompletedAt ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@virus_status", (object)record.VirusScanStatus ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@virus_result", (object)record.VirusScanResult ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@id", record.Id);
                cmd.ExecuteNonQuery();
            }
        }

        /// <summary>Xóa toàn bộ bản ghi khỏi CSDL.</summary>
        public static int DeleteAll()
        {
            using (var conn = Open())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "DELETE FROM download_history;";
                return cmd.ExecuteNonQuery();
            }
        }

        /// <summary>Xóa bản ghi khỏi CSDL (khi người dùng Remove hoặc Cancel).</summary>
        public static void Delete(string taskId)
        {
            if (string.IsNullOrWhiteSpace(taskId)) return;
            using (var conn = Open())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "DELETE FROM download_history WHERE id = @id;";
                cmd.Parameters.AddWithValue("@id", taskId);
                cmd.ExecuteNonQuery();
            }
        }

        /// <summary>Lấy toàn bộ lịch sử, mới nhất trước.</summary>
        public static List<DownloadRecord> GetAll()
        {
            var list = new List<DownloadRecord>();
            using (var conn = Open())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT * FROM download_history ORDER BY created_at DESC;";
                using (var reader = cmd.ExecuteReader())
                    while (reader.Read()) list.Add(ReadRecord(reader));
            }
            return list;
        }

        /// <summary>
        /// Lấy các tác vụ chưa hoàn thành (Preparing, Downloading, Paused, Queued, Failed)
        /// để resume khi khởi động lại ứng dụng.
        /// </summary>
        public static List<DownloadRecord> GetIncomplete()
        {
            var list = new List<DownloadRecord>();
            using (var conn = Open())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT * FROM download_history
                    WHERE state NOT IN ('completed', 'cancelled')
                    ORDER BY created_at ASC;
                ";
                using (var reader = cmd.ExecuteReader())
                    while (reader.Read()) list.Add(ReadRecord(reader));
            }
            return list;
        }

        /// <summary>Lấy một bản ghi theo taskId. Trả null nếu không tìm thấy.</summary>
        public static DownloadRecord GetById(string taskId)
        {
            if (string.IsNullOrWhiteSpace(taskId)) return null;
            using (var conn = Open())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT * FROM download_history WHERE id = @id LIMIT 1;";
                cmd.Parameters.AddWithValue("@id", taskId);
                using (var reader = cmd.ExecuteReader())
                    if (reader.Read()) return ReadRecord(reader);
            }
            return null;
        }

        /// <summary>Xóa tất cả bản ghi đã hoàn thành hoặc đã hủy (dọn lịch sử).</summary>
        public static int ClearCompleted()
        {
            using (var conn = Open())
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "DELETE FROM download_history WHERE state IN ('completed','cancelled');";
                return cmd.ExecuteNonQuery();
            }
        }

        // ------------------------------------------------------------------ tiện ích nội bộ

        private static SqliteConnection Open()
        {
            var conn = new SqliteConnection(_connectionString);
            conn.Open();
            return conn;
        }

        private static void Execute(SqliteConnection conn, string sql)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = sql;
                cmd.ExecuteNonQuery();
            }
        }

        private static void BindRecord(SqliteCommand cmd, DownloadRecord r)
        {
            cmd.Parameters.AddWithValue("@id",       r.Id);
            cmd.Parameters.AddWithValue("@src",      r.SourceUrl  ?? "");
            cmd.Parameters.AddWithValue("@remote",   r.RemoteUrl  ?? "");
            cmd.Parameters.AddWithValue("@name",     r.FileName   ?? "");
            cmd.Parameters.AddWithValue("@path",     r.TargetPath ?? "");
            cmd.Parameters.AddWithValue("@total",    r.TotalBytes);
            cmd.Parameters.AddWithValue("@dl",       r.Downloaded);
            cmd.Parameters.AddWithValue("@state",    r.State ?? "preparing");
            cmd.Parameters.AddWithValue("@ranges",   r.SupportsRanges ? 1 : 0);
            cmd.Parameters.AddWithValue("@threads",  r.Threads);
            cmd.Parameters.AddWithValue("@elapsed",  r.ElapsedSeconds);
            cmd.Parameters.AddWithValue("@avgspeed", (object)r.AvgSpeed ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@etag",     (object)r.ETag         ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@lm",       (object)r.LastModified ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@hash",     (object)r.FileHash     ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@err",      (object)r.ErrorMessage ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@segs",     (object)r.SegmentsJson ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@created",  Iso(r.CreatedAt));
            cmd.Parameters.AddWithValue("@updated",  Iso(r.UpdatedAt));
            cmd.Parameters.AddWithValue("@completed",(object)r.CompletedAt  ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@virus_status", (object)r.VirusScanStatus ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@virus_result", (object)r.VirusScanResult ?? DBNull.Value);
        }

        private static DownloadRecord ReadRecord(SqliteDataReader r)
        {
            string rawCompleted = r["completed_at"] as string;
            string completedVn = null;
            if (!string.IsNullOrEmpty(rawCompleted))
            {
                // Nếu bản ghi cũ lưu ISO date thì chuyển sang định dạng ngày giờ VN dd/MM/yyyy HH:mm:ss
                if (DateTime.TryParse(rawCompleted, null, System.Globalization.DateTimeStyles.RoundtripKind, out DateTime dtUtc))
                {
                    completedVn = GetVietnamTimeString(dtUtc.Kind == DateTimeKind.Utc ? dtUtc : dtUtc.ToUniversalTime());
                }
                else
                {
                    completedVn = rawCompleted;
                }
            }

            return new DownloadRecord
            {
                Id             = r["id"]            as string,
                SourceUrl      = r["source_url"]    as string,
                RemoteUrl      = r["remote_url"]    as string,
                FileName       = r["file_name"]     as string,
                TargetPath     = r["target_path"]   as string,
                TotalBytes     = Convert.ToInt64(r["total_bytes"]),
                Downloaded     = Convert.ToInt64(r["downloaded"]),
                State          = r["state"]          as string,
                SupportsRanges = Convert.ToInt64(r["supports_ranges"]) == 1,
                Threads        = Convert.ToInt32(r["threads"]),
                ElapsedSeconds = r["elapsed_seconds"] != DBNull.Value ? Convert.ToDouble(r["elapsed_seconds"]) : 0,
                AvgSpeed       = r["avg_speed"]      as string,
                ETag           = r["etag"]           as string,
                LastModified   = r["last_modified"]  as string,
                FileHash       = r["file_hash"]      as string,
                ErrorMessage   = r["error_message"]  as string,
                SegmentsJson   = r["segments_json"]  as string,
                CreatedAt      = ParseIso(r["created_at"]   as string),
                UpdatedAt      = ParseIso(r["updated_at"]   as string),
                CompletedAt    = completedVn,
                VirusScanStatus = r["virus_scan_status"] as string,
                VirusScanResult = r["virus_scan_result"] as string
            };
        }

        private static string Iso(DateTime dt) => dt.ToString("o");

        private static DateTime ParseIso(string s) =>
            string.IsNullOrEmpty(s)
                ? DateTime.UtcNow
                : DateTime.Parse(s, null, System.Globalization.DateTimeStyles.RoundtripKind);
    }

    // ------------------------------------------------------------------ model

    /// <summary>
    /// Bản ghi lưu trong CSDL cho mỗi tác vụ tải.
    /// Ánh xạ 1-1 với một dòng trong bảng download_history.
    /// </summary>
    public sealed class DownloadRecord
    {
        public string    Id             { get; set; }
        public string    SourceUrl      { get; set; }
        public string    RemoteUrl      { get; set; }
        public string    FileName       { get; set; }
        public string    TargetPath     { get; set; }
        public long      TotalBytes     { get; set; }
        public long      Downloaded     { get; set; }
        /// <summary>preparing | queued | downloading | paused | completed | failed | cancelled</summary>
        public string    State          { get; set; } = "preparing";
        public bool      SupportsRanges { get; set; }
        public int       Threads        { get; set; } = 1;
        public double    ElapsedSeconds { get; set; }
        public string    AvgSpeed       { get; set; }
        public string    ETag           { get; set; }
        public string    LastModified   { get; set; }
        public string    FileHash       { get; set; }
        public string    ErrorMessage   { get; set; }
        /// <summary>JSON của List&lt;SegmentMeta&gt; — dùng để resume sau crash.</summary>
        public string    SegmentsJson   { get; set; }
        public DateTime  CreatedAt      { get; set; }
        public DateTime  UpdatedAt      { get; set; }
        public string    CompletedAt    { get; set; }
        public string    VirusScanStatus { get; set; }
        public string    VirusScanResult { get; set; }

        /// <summary>Helper: parse SegmentsJson về List&lt;SegmentMeta&gt;.</summary>
        public List<SegmentMeta> GetSegments()
        {
            if (string.IsNullOrEmpty(SegmentsJson)) return null;
            try { return JsonSerializer.Deserialize<List<SegmentMeta>>(SegmentsJson); }
            catch { return null; }
        }

        /// <summary>Helper: serialize segments rồi lưu vào SegmentsJson.</summary>
        public void SetSegments(List<SegmentMeta> segs)
        {
            SegmentsJson = segs != null ? JsonSerializer.Serialize(segs) : null;
        }
    }
}
