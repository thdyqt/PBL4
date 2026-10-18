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
            System.Diagnostics.Debug.WriteLine("[SegmentPlanner] " + WindowsFormsApp.Download.SegmentPlanner.SelfTest());
            _messageHandler = new MessageHandler(this);
        }

        private async void InitializeWebView()
        {
            // 1. Chờ môi trường WebView2 khởi động xong
            await webView.EnsureCoreWebView2Async(null);

            // 2. Lấy đường dẫn gốc của ứng dụng (thư mục bin/Debug nơi chứa file .exe)
            string appPath = Application.StartupPath;

            // 3. Nối đường dẫn gốc với thư mục public để trỏ thẳng tới file index.html
            string htmlFilePath = Path.Combine(appPath, "public/html", "index.html");

            // 4. Lắng nghe các thông điệp (messages) được gửi từ mã JavaScript ở Frontend
            webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

            // 5. Yêu cầu lõi WebView2 mở file giao diện cục bộ này lên
            webView.CoreWebView2.Navigate(htmlFilePath);
        }

        private void Form1_Load(object sender, EventArgs e)
        {
            InitializeWebView();
        }

        // --- Hàm bắt thông điệp IPC từ Web gửi tới C# ---
        private void CoreWebView2_WebMessageReceived(object sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
        {
            string jsonMessage = e.TryGetWebMessageAsString();
            _messageHandler.ProcessMessage(jsonMessage);
        }
        public void SendToWeb(string jsonMessage)
        {
            if (webView != null && webView.CoreWebView2 != null)
            {
                webView.CoreWebView2.PostWebMessageAsString(jsonMessage);
            }
        }
    }
}
