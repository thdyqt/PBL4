using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Windows.Forms;

namespace WindowsFormsApp
{
    internal static class Program
    {
        private const string MutexName = @"Global\DUTDownloadAccelerator_SingleInstance_Mutex";

        /// <summary>
        /// The main entry point for the application.
        /// Quản lý cơ chế Độc bản (Single-Instance): ngăn mở tiến trình trùng lặp,
        /// tự động phục hồi cửa sổ của tiến trình đang chạy và chuyển URL dòng lệnh sang app.
        /// </summary>
        [STAThread]
        static void Main(string[] args)
        {
            // .NET Framework mặc định chỉ cho 2 kết nối đồng thời tới cùng một máy chủ.
            // Nâng lên 64 để hỗ trợ tải đa luồng tối đa.
            ServicePointManager.DefaultConnectionLimit = 64;
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Tìm xem có tham số URL nào được truyền vào không (http://, https://, ftp://)
            string targetUrl = FindUrlInArgs(args) ?? FindUrlInArgs(Environment.GetCommandLineArgs());

            bool createdNew;
            using (var mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew)
                {
                    // Đã có một phiên bản của ứng dụng đang chạy!
                    // Gửi thông báo sang ứng dụng đang chạy để kích hoạt cửa sổ và truyền URL (nếu có)
                    NotifyRunningInstance(targetUrl);
                    return; // Thoát phiên bản thứ hai ngay lập tức
                }

                bool startInBackground = WindowsFormsApp.Download.ShellIntegrationHelper.HasBackgroundArg(args) ||
                                         WindowsFormsApp.Download.ShellIntegrationHelper.HasBackgroundArg(Environment.GetCommandLineArgs());

                Application.Run(new Form1(startInBackground, targetUrl));
            }
        }

        private static string FindUrlInArgs(string[] args)
        {
            if (args == null || args.Length == 0) return null;
            foreach (var arg in args)
            {
                if (string.IsNullOrWhiteSpace(arg)) continue;
                string trimmed = arg.Trim().Trim('"', '\'');
                if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                    trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
                    trimmed.StartsWith("ftp://", StringComparison.OrdinalIgnoreCase))
                {
                    return trimmed;
                }
            }
            return null;
        }

        private static void NotifyRunningInstance(string url)
        {
            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(3);
                    if (!string.IsNullOrWhiteSpace(url))
                    {
                        var payload = new
                        {
                            url = url,
                            fileName = Path.GetFileName(url.Split('?')[0]),
                            autoStart = false
                        };
                        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                        client.PostAsync("http://127.0.0.1:8989/capture", content).Wait();
                    }
                    else
                    {
                        client.GetAsync("http://127.0.0.1:8989/restore").Wait();
                    }
                }
            }
            catch { }
        }
    }
}
