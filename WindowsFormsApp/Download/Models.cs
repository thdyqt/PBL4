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

    /// <summary>
    /// Lỗi dung lượng ổ đĩa: ổ đích không đủ chỗ (kèm đề xuất đổi ổ khác) hoặc tất cả ổ đều gần đầy (huỷ tải).
    /// </summary>
    public class DiskSpaceException : DownloadException
    {
        public bool IsAllDrivesFull { get; }
        public string TargetDrive { get; }
        public string SuggestedDrive { get; }
        public long TargetFreeBytes { get; }
        public long SuggestedFreeBytes { get; }
        public long NeededBytes { get; }

        public DiskSpaceException(bool isAllDrivesFull, string message, string targetDrive, string suggestedDrive, long targetFreeBytes, long suggestedFreeBytes, long neededBytes)
            : base(message)
        {
            IsAllDrivesFull = isAllDrivesFull;
            TargetDrive = targetDrive;
            SuggestedDrive = suggestedDrive;
            TargetFreeBytes = targetFreeBytes;
            SuggestedFreeBytes = suggestedFreeBytes;
            NeededBytes = neededBytes;
        }
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
        public string AvgSpeed { get; set; }       // Tốc độ trung bình (chuỗi hiển thị)
        public string CompletedAt { get; set; }    // Thời điểm hoàn thành theo giờ VN
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
