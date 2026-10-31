using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Kết quả quét virus từ Windows Defender (MpCmdRun.exe)
    /// </summary>
    public sealed class AntivirusScanResult
    {
        public bool IsSafe { get; set; }
        public bool ThreatDetected { get; set; }
        public int ExitCode { get; set; }
        /// <summary>"safe" | "threat" | "error" | "not_available" | "scanning"</summary>
        public string Status { get; set; } = "safe";
        public string Message { get; set; }
        public string RawOutput { get; set; }
        public DateTime ScannedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Tích hợp hệ điều hành: Tự động gọi công cụ dòng lệnh của Windows Defender (MpCmdRun.exe)
    /// để quét mã độc tệp sau khi tải về và tính toán băm SHA-256 hoàn tất.
    /// Lệnh thực thi: "C:\Program Files\Windows Defender\MpCmdRun.exe" -Scan -ScanType 3 -File "duong_dan_file"
    /// </summary>
    public static class AntivirusScanner
    {
        private static string _cachedDefenderPath;
        private static bool _pathResolved;
        private static readonly object _pathLock = new object();

        /// <summary>
        /// Tìm đường dẫn thực thi của công cụ Windows Defender Command Line (MpCmdRun.exe).
        /// Hỗ trợ cả đường dẫn chuẩn Program Files và bản cập nhật Defender Platform trong ProgramData.
        /// </summary>
        public static string GetDefenderPath()
        {
            lock (_pathLock)
            {
                if (_pathResolved) return _cachedDefenderPath;

                // 1. Kiểm tra Program Files mặc định (theo yêu cầu đề tài)
                string defaultPath = @"C:\Program Files\Windows Defender\MpCmdRun.exe";
                if (File.Exists(defaultPath))
                {
                    _cachedDefenderPath = defaultPath;
                    _pathResolved = true;
                    return _cachedDefenderPath;
                }

                // 2. Thử thư mục Program Files chuẩn theo biến môi trường hệ thống
                try
                {
                    string progFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                    string pfPath = Path.Combine(progFiles, "Windows Defender", "MpCmdRun.exe");
                    if (File.Exists(pfPath))
                    {
                        _cachedDefenderPath = pfPath;
                        _pathResolved = true;
                        return _cachedDefenderPath;
                    }
                }
                catch { }

                // 3. Kiểm tra bản cập nhật Defender Platform trong ProgramData (Windows 10/11 mới nhất)
                try
                {
                    string platformDir = @"C:\ProgramData\Microsoft\Windows Defender\Platform";
                    if (Directory.Exists(platformDir))
                    {
                        var exePath = Directory.GetFiles(platformDir, "MpCmdRun.exe", SearchOption.AllDirectories)
                            .OrderByDescending(p => p)
                            .FirstOrDefault();

                        if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                        {
                            _cachedDefenderPath = exePath;
                            _pathResolved = true;
                            return _cachedDefenderPath;
                        }
                    }
                }
                catch { }

                _cachedDefenderPath = null;
                _pathResolved = true;
                return null;
            }
        }

        /// <summary>
        /// Kiểm tra Windows Defender CLI có sẵn trên máy tính không.
        /// </summary>
        public static bool IsAvailable() => !string.IsNullOrEmpty(GetDefenderPath());

        /// <summary>
        /// Kích hoạt tiến trình MpCmdRun.exe quét mã độc cho tệp chỉ định thông qua Process.Start.
        /// Chạy bất đồng bộ, không làm treo luồng giao diện WinForms và cập nhật kết quả qua Exit Code & Standard Output.
        /// </summary>
        /// <param name="filePath">Đường dẫn tuyệt đối đến tệp cần quét</param>
        /// <param name="ct">CancellationToken</param>
        /// <returns>Đối tượng AntivirusScanResult chứa trạng thái và mô tả kết quả</returns>
        public static async Task<AntivirusScanResult> ScanFileAsync(string filePath, CancellationToken ct = default)
        {
            var result = new AntivirusScanResult();

            if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
            {
                result.Status = "error";
                result.Message = "Tệp không tồn tại hoặc đã bị di chuyển.";
                return result;
            }

            string exePath = GetDefenderPath();
            if (string.IsNullOrEmpty(exePath))
            {
                result.Status = "not_available";
                result.Message = "Windows Defender không khả dụng trên hệ thống.";
                result.IsSafe = true; // Không chặn người dùng nếu máy không có Defender
                return result;
            }

            // Tham số dòng lệnh chính thức: -Scan -ScanType 3 -File "duong_dan_file"
            // ScanType 3 = Custom file scan (quét tệp riêng lẻ)
            string safeFilePath = filePath.Replace("\"", "\\\"");
            var psi = new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = $"-Scan -ScanType 3 -File \"{safeFilePath}\"",
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            var outputBuilder = new StringBuilder();
            var errorBuilder = new StringBuilder();

            try
            {
                using (var process = new Process { StartInfo = psi })
                {
                    process.OutputDataReceived += (s, e) =>
                    {
                        if (e.Data != null) outputBuilder.AppendLine(e.Data);
                    };
                    process.ErrorDataReceived += (s, e) =>
                    {
                        if (e.Data != null) errorBuilder.AppendLine(e.Data);
                    };

                    bool started = process.Start();
                    if (!started)
                    {
                        result.Status = "error";
                        result.Message = "Không thể khởi động tiến trình Windows Defender.";
                        return result;
                    }

                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();

                    // Chờ an toàn tránh rò rỉ Task nền và tránh dispose Process khi luồng khác đang wait
                    bool exited = await Task.Run(() => process.WaitForExit(60000), ct).ConfigureAwait(false);
                    if (!exited)
                    {
                        try { if (!process.HasExited) process.Kill(); } catch { }
                        result.Status = "error";
                        result.Message = "Quá thời gian quét virus (Timeout 60s).";
                        return result;
                    }

                    process.WaitForExit();

                    result.ExitCode = process.ExitCode;
                    string fullOutput = (outputBuilder.ToString() + "\n" + errorBuilder.ToString()).Trim();
                    result.RawOutput = fullOutput;

                    // Phân tích Exit Code của MpCmdRun.exe:
                    // 0 = Không phát hiện mã độc (No threats found - File an toàn)
                    // 2 = Phát hiện mối đe dọa (Threat detected)
                    // 1 hoặc khác = Lỗi quét / Hủy
                    if (result.ExitCode == 0)
                    {
                        result.IsSafe = true;
                        result.ThreatDetected = false;
                        result.Status = "safe";
                        result.Message = "File an toàn (Windows Defender không phát hiện mối đe dọa)";
                    }
                    else if (result.ExitCode == 2)
                    {
                        // Kiểm tra nếu output ghi nhận không có threat (edge case)
                        if (fullOutput.IndexOf("found no threats", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            result.IsSafe = true;
                            result.ThreatDetected = false;
                            result.Status = "safe";
                            result.Message = "File an toàn (Windows Defender)";
                        }
                        else
                        {
                            result.IsSafe = false;
                            result.ThreatDetected = true;
                            result.Status = "threat";
                            result.Message = "CẢNH BÁO: Phát hiện mối đe dọa mã độc tiềm ẩn (Windows Defender)!";
                        }
                    }
                    else
                    {
                        result.IsSafe = false;
                        result.Status = "error";
                        result.Message = $"Lỗi khi quét virus (Exit Code: {result.ExitCode})";
                    }

                    return result;
                }
            }
            catch (OperationCanceledException)
            {
                result.Status = "error";
                result.Message = "Quá trình quét virus đã bị hủy.";
                return result;
            }
            catch (Exception ex)
            {
                result.Status = "error";
                result.Message = "Lỗi thực thi quét mã độc: " + ex.Message;
                return result;
            }
        }
    }
}
