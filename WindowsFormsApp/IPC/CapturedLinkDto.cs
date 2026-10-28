using System;

namespace WindowsFormsApp.IPC
{
    /// <summary>
    /// Dữ liệu liên kết tải được bắt tự động từ Chrome / Edge Extension gửi sang
    /// </summary>
    public sealed class CapturedLinkDto
    {
        public string Url { get; set; }
        public string FileName { get; set; }
        public string Referrer { get; set; }
        public long TotalBytes { get; set; }
        public string Mime { get; set; }
        public bool AutoStart { get; set; }
        public string UserAgent { get; set; }
    }
}
