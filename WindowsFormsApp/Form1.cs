using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.IO;
using System.Linq;
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
        private MessageHandler _messageHandler;

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
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
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
