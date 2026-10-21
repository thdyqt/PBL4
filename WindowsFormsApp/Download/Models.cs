using System;
using System.Collections.Generic;
using System.IO;

namespace WindowsFormsApp.Download
{
    public enum DownloadState
    {
        Queued,
        Preparing,
        Downloading,
        Paused,
        Completed,
        Failed,
        Cancelled
    }

    /// <summary>
    /// Lỗi "chắc chắn" không thể khắc phục bằng cách thử lại (sai Range, file đổi, HTTP 4xx...).
    /// </summary>
    public class DownloadException : IOException
    {
        public DownloadException(string message) : base(message) { }
    }

    /// <summary>Dữ liệu tiến độ gửi lên giao diện (JSON, camelCase).</summary>
    public sealed class ProgressDto
    {
        public string TaskId { get; set; }
        public string State { get; set; }
        public string FileName { get; set; }
        public string TargetPath { get; set; }
        public long TotalBytes { get; set; }      // <= 0 nếu server không cho biết kích thước
        public long Downloaded { get; set; }
        public double Speed { get; set; }         // byte/giây
        public long EtaSeconds { get; set; }      // -1 nếu chưa tính được
        public double ElapsedSeconds { get; set; } // Tổng số giây thực tế tải (loại trừ thời gian tạm dừng)
        public int Threads { get; set; }
        public bool SupportsRanges { get; set; }
        public string Error { get; set; }
        public string FileHash { get; set; }      // SHA-256 hex (64 ký tự) sau khi hoàn thành
        public List<SegmentDto> Segments { get; set; }

        /// <summary>
        /// JSON đầy đủ của List&lt;SegmentMeta&gt; (Index, Start, End, Downloaded, Finished).
        /// Dùng để lưu vào SQLite — đủ thông tin để resume sau crash.
        /// Không gửi lên giao diện (chỉ dùng nội bộ C#).
        /// </summary>
        public string SegmentsMetaJson { get; set; }
    }

    public sealed class SegmentDto
    {
        public long Downloaded { get; set; }
        public long Length { get; set; }
    }
}
