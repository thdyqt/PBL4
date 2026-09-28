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

namespace WindowsFormsApp
{
    public partial class Form1 : Form
    {
        public Form1()
        {
            InitializeComponent();
            InitializeWebView();
        }

        private async void InitializeWebView()
        {
            // 1. Chờ môi trường WebView2 khởi động xong
            await webView.EnsureCoreWebView2Async(null);

            // 2. Lấy đường dẫn gốc của ứng dụng (thư mục bin/Debug nơi chứa file .exe)
            string appPath = Application.StartupPath;

            // 3. Nối đường dẫn gốc với thư mục public để trỏ thẳng tới file index.html
            string htmlFilePath = Path.Combine(appPath, "public", "index.html");

            // 4. Yêu cầu lõi WebView2 mở file giao diện cục bộ này lên
            webView.CoreWebView2.Navigate(htmlFilePath);
        }

        private void Form1_Load(object sender, EventArgs e)
        {

        }
    }
}
