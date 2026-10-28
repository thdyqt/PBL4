using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using WindowsFormsApp.IPC;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace WindowsFormsApp
{
    public partial class Form1 : Form
    {
        // --- Win32 Native API: Đưa cửa sổ ứng dụng lên đầu khi bắt link từ trình duyệt ---
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool IsIconic(IntPtr hWnd);

        private const int SW_RESTORE = 9;
        private const int SW_SHOW = 5;

        private MessageHandler _messageHandler;
        private BrowserExtensionServer _extensionServer;

        public Form1()
        {
            InitializeComponent();
            _messageHandler = new MessageHandler(this);
        }

        private async void InitializeWebView()
        {
            try
            {
                // 1. Chờ môi trường WebView2 khởi động xong
                await webView.EnsureCoreWebView2Async(null);

                // 2. Lấy đường dẫn gốc của ứng dụng (thư mục bin/Debug nơi chứa file .exe)
                string appPath = Application.StartupPath;

                // 3. Nối đường dẫn gốc với thư mục public để trỏ thẳng tới file index.html
                string htmlFilePath = Path.Combine(appPath, "public/html", "index.html");

                // 4. Lắng nghe các thông điệp (messages) được gửi từ mã JavaScript ở Frontend
                webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

                // 5. Sau khi trang HTML load xong -> tự động gửi lịch sử tải từ DB xuống giao diện
                //    Đây là cách duy nhất để restore danh sách file khi khởi động lại app.
                webView.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;

                // 6. Yêu cầu lõi WebView2 mở file giao diện cục bộ này lên
                webView.CoreWebView2.Navigate(htmlFilePath);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Không khởi tạo được WebView2: " + ex.Message +
                                "\nHãy cài WebView2 Runtime của Microsoft.", "Lỗi");
            }
        }

        private void CoreWebView2_NavigationCompleted(object sender,
            Microsoft.Web.WebView2.Core.CoreWebView2NavigationCompletedEventArgs e)
        {
            // Trang đã load xong -> gửi lịch sử tải từ DB để frontend hiển thị
            _messageHandler.SendHistoryOnStartup();
        }

        private void Form1_Load(object sender, EventArgs e)
        {
            InitializeWebView();
            InitializeBrowserExtensionServer();
        }

        /// <summary>
        /// Khởi động Local Loopback HTTP Web Server trên http://127.0.0.1:8989/
        /// để giao tiếp IPC với Chrome / Edge Extension.
        /// </summary>
        private void InitializeBrowserExtensionServer()
        {
            try
            {
                _extensionServer = new BrowserExtensionServer();
                _extensionServer.LinkCaptured += OnBrowserLinkCaptured;
                _extensionServer.Start();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ExtensionServer] Init failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Xử lý sự kiện khi Extension bắt được link tải từ trình duyệt:
        /// 1. Tự động phục hồi và đưa cửa sổ C# lên trên cùng màn hình (Win32 API).
        /// 2. Gửi thông điệp BROWSER_LINK_CAPTURED sang WebView2 để điền URL vào form tải.
        /// </summary>
        private void OnBrowserLinkCaptured(CapturedLinkDto link)
        {
            BringToFrontAndRestore();

            var payload = new
            {
                action = "BROWSER_LINK_CAPTURED",
                data = link
            };

            SendToWeb(JsonSerializer.Serialize(payload));
        }

        /// <summary>
        /// Khôi phục cửa sổ nếu đang thu nhỏ (Minimized) và đưa lên tiền cảnh (Foreground).
        /// </summary>
        public void BringToFrontAndRestore()
        {
            if (InvokeRequired)
            {
                try { BeginInvoke(new Action(BringToFrontAndRestore)); } catch { }
                return;
            }

            try
            {
                if (WindowState == FormWindowState.Minimized || IsIconic(this.Handle))
                {
                    ShowWindow(this.Handle, SW_RESTORE);
                    WindowState = FormWindowState.Normal;
                }
                else
                {
                    ShowWindow(this.Handle, SW_SHOW);
                }

                this.Activate();
                this.BringToFront();
                SetForegroundWindow(this.Handle);
            }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            // Dừng Local Loopback Server của Extension
            try
            {
                _extensionServer?.Stop();
                _extensionServer?.Dispose();
            }
            catch { }

            // Dừng các luồng tải và lưu tiến độ (file .dlmeta) để lần sau tiếp tục được
            _messageHandler.Shutdown();
            base.OnFormClosing(e);
        }

        // --- Hàm bắt thông điệp IPC từ Web gửi tới C# ---
        private void CoreWebView2_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string jsonMessage = e.TryGetWebMessageAsString();
            _messageHandler.ProcessMessage(jsonMessage);
        }

        /// <summary>
        /// Gửi JSON lên giao diện. An toàn khi gọi từ luồng nền (tiến độ tải được phát từ luồng khác):
        /// WebView2 chỉ cho phép gọi trên luồng giao diện nên ta tự chuyển luồng.
        /// </summary>
        public void SendToWeb(string jsonMessage)
        {
            if (IsDisposed || !IsHandleCreated) return;

            if (InvokeRequired)
            {
                try { BeginInvoke(new Action<string>(SendToWeb), jsonMessage); }
                catch (ObjectDisposedException) { }
                catch (InvalidOperationException) { }
                return;
            }

            if (webView != null && webView.CoreWebView2 != null)
            {
                webView.CoreWebView2.PostWebMessageAsString(jsonMessage);
            }
        }
    }
}

