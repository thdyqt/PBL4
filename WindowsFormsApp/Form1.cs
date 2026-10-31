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
using WindowsFormsApp.Download;
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

        private readonly bool _startInBackground;
        private MessageHandler _messageHandler;
        private BrowserExtensionServer _extensionServer;

        // Windows Shell System Tray & Notification
        private NotifyIcon _notifyIcon;
        private ContextMenuStrip _trayMenu;
        private ToolStripMenuItem _menuItemOpen;
        private ToolStripMenuItem _menuItemPauseAll;
        private ToolStripMenuItem _menuItemResumeAll;
        private ToolStripMenuItem _menuItemExit;
        private bool _allowActualExit = false;
        private string _lastCompletedFilePath = null;
        private bool _hasShownTrayHint = false;

        public Form1() : this(false)
        {
        }

        public Form1(bool startInBackground)
        {
            _startInBackground = startInBackground;
            InitializeComponent();
            InitializeTrayIcon();
            _messageHandler = new MessageHandler(this);
        }

        /// <summary>
        /// Khởi tạo System Tray Icon (NotifyIcon) và ContextMenuStrip điều khiển nền.
        /// </summary>
        private void InitializeTrayIcon()
        {
            try
            {
                _trayMenu = new ContextMenuStrip();

                _menuItemOpen = new ToolStripMenuItem("Mở DUT Download Accelerator", null, (s, e) => BringToFrontAndRestore());
                _menuItemOpen.Font = new Font(_trayMenu.Font, FontStyle.Bold);

                _menuItemPauseAll = new ToolStripMenuItem("Tạm dừng tất cả", null, (s, e) => _messageHandler?.PauseAllDownloads());
                _menuItemResumeAll = new ToolStripMenuItem("Tiếp tục tất cả", null, (s, e) => _messageHandler?.StartAllQueuedOrPausedDownloads());

                _menuItemExit = new ToolStripMenuItem("Thoát ứng dụng", null, (s, e) =>
                {
                    _allowActualExit = true;
                    this.Close();
                });

                _trayMenu.Items.Add(_menuItemOpen);
                _trayMenu.Items.Add(new ToolStripSeparator());
                _trayMenu.Items.Add(_menuItemPauseAll);
                _trayMenu.Items.Add(_menuItemResumeAll);
                _trayMenu.Items.Add(new ToolStripSeparator());
                _trayMenu.Items.Add(_menuItemExit);

                _notifyIcon = new NotifyIcon
                {
                    Text = "DUT Download Accelerator",
                    ContextMenuStrip = _trayMenu,
                    Visible = true
                };

                // Tải icon từ Logo.ico trong thư mục public hoặc icon mặc định
                string iconPath = Path.Combine(Application.StartupPath, "public", "images", "Logo.ico");
                if (File.Exists(iconPath))
                {
                    _notifyIcon.Icon = new Icon(iconPath);
                }
                else if (this.Icon != null)
                {
                    _notifyIcon.Icon = this.Icon;
                }
                else
                {
                    _notifyIcon.Icon = SystemIcons.Application;
                }

                _notifyIcon.DoubleClick += (s, e) => BringToFrontAndRestore();
                _notifyIcon.BalloonTipClicked += OnTrayBalloonTipClicked;

                var settings = SettingsManager.Current;
                if (settings != null && !string.IsNullOrWhiteSpace(settings.Language))
                {
                    UpdateTrayLanguage(settings.Language);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("[Form1] InitializeTrayIcon error: " + ex.Message);
            }
        }

        /// <summary>
        /// Cập nhật ngôn ngữ hiển thị trên ContextMenu của System Tray Icon.
        /// </summary>
        public void UpdateTrayLanguage(string lang)
        {
            if (InvokeRequired)
            {
                try { BeginInvoke(new Action<string>(UpdateTrayLanguage), lang); } catch { }
                return;
            }

            try
            {
                bool isEn = string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase);
                if (_menuItemOpen != null)
                    _menuItemOpen.Text = isEn ? "Open DUT Download Accelerator" : "Mở DUT Download Accelerator";
                if (_menuItemPauseAll != null)
                    _menuItemPauseAll.Text = isEn ? "Pause All" : "Tạm dừng tất cả";
                if (_menuItemResumeAll != null)
                    _menuItemResumeAll.Text = isEn ? "Resume All" : "Tiếp tục tất cả";
                if (_menuItemExit != null)
                    _menuItemExit.Text = isEn ? "Exit Application" : "Thoát ứng dụng";
            }
            catch { }
        }

        /// <summary>
        /// Xử lý sự kiện khi người dùng click vào Windows Toast / BalloonTip Notification:
        /// Tự động mở tệp tin vừa tải về hoặc đưa cửa sổ ứng dụng lên đầu.
        /// </summary>
        private void OnTrayBalloonTipClicked(object sender, EventArgs e)
        {
            BringToFrontAndRestore();

            if (!string.IsNullOrEmpty(_lastCompletedFilePath) && File.Exists(_lastCompletedFilePath))
            {
                try
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = _lastCompletedFilePath,
                        UseShellExecute = true
                    });
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine("[Form1] BalloonTipClicked open file error: " + ex.Message);
                }
                finally
                {
                    _lastCompletedFilePath = null;
                }
            }
        }

        /// <summary>
        /// Hiển thị Windows Shell Toast / BalloonTip Notification ở góc dưới màn hình khi tải xong tệp.
        /// Bấm vào thông báo sẽ kích hoạt mở tệp ngay lập tức.
        /// </summary>
        public void ShowDownloadCompletedToast(string fileName, string targetPath)
        {
            if (InvokeRequired)
            {
                try { BeginInvoke(new Action<string, string>(ShowDownloadCompletedToast), fileName, targetPath); } catch { }
                return;
            }

            try
            {
                _lastCompletedFilePath = targetPath;
                if (_notifyIcon != null)
                {
                    var settings = SettingsManager.Current;
                    bool isEn = settings != null && string.Equals(settings.Language, "en", StringComparison.OrdinalIgnoreCase);
                    string title = isEn ? "Download Completed!" : "Tải tệp hoàn tất!";
                    string msg = isEn
                        ? $"{fileName}\nClick here to open file."
                        : $"{fileName}\nBấm vào đây để mở tệp ngay.";
                    _notifyIcon.ShowBalloonTip(5000, title, msg, ToolTipIcon.Info);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("[Form1] ShowDownloadCompletedToast error: " + ex.Message);
            }
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

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);

            // Nếu ứng dụng được khởi động tự động cùng Windows (cờ /background):
            // Thu nhỏ ngay xuống System Tray mà không làm gián đoạn màn hình làm việc của người dùng.
            if (_startInBackground)
            {
                this.WindowState = FormWindowState.Minimized;
                this.ShowInTaskbar = false;
                this.Hide();

                var settings = SettingsManager.Current;
                bool isEn = settings != null && string.Equals(settings.Language, "en", StringComparison.OrdinalIgnoreCase);
                string title = "DUT Download Accelerator";
                string msg = isEn
                    ? "Application started in background (System Tray)."
                    : "Ứng dụng đã khởi động ngầm trong khay hệ thống.";
                _notifyIcon?.ShowBalloonTip(3000, title, msg, ToolTipIcon.Info);
            }
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
        /// Khôi phục cửa sổ nếu đang thu nhỏ (Minimized) hoặc đang ẩn dưới System Tray
        /// và đưa lên tiền cảnh (Foreground).
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
                this.Show();
                this.ShowInTaskbar = true;

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

        /// <summary>
        /// Xử lý sự kiện đóng Form:
        /// - Nếu bấm dấu [X] và bật tùy chọn "Thu nhỏ xuống Tray": cancel sự kiện đóng, ẩn xuống khay hệ thống.
        /// - Nếu chọn Thoát từ Tray Menu: thoát hoàn toàn ứng dụng, giải phóng NotifyIcon và lưu tiến độ.
        /// </summary>
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            var settings = SettingsManager.Current;
            bool minimizeToTray = settings != null ? settings.MinimizeToTrayOnClose : true;

            // Nếu người dùng bấm dấu [X] tắt app và tùy chọn Thu nhỏ vào Tray được bật
            if (e.CloseReason == CloseReason.UserClosing && minimizeToTray && !_allowActualExit)
            {
                e.Cancel = true;
                this.WindowState = FormWindowState.Minimized;
                this.ShowInTaskbar = false;
                this.Hide();

                if (_notifyIcon != null && !_hasShownTrayHint)
                {
                    _hasShownTrayHint = true;
                    bool isEn = settings != null && string.Equals(settings.Language, "en", StringComparison.OrdinalIgnoreCase);
                    string title = "DUT Download Accelerator";
                    string msg = isEn
                        ? "Application is running in the background to continue downloading."
                        : "Ứng dụng đang tiếp tục chạy ngầm trong khay hệ thống để không làm gián đoạn quá trình tải.";
                    _notifyIcon.ShowBalloonTip(3000, title, msg, ToolTipIcon.Info);
                }
                return;
            }

            // Thoát hoàn toàn:
            try
            {
                if (_notifyIcon != null)
                {
                    _notifyIcon.Visible = false;
                    _notifyIcon.Dispose();
                    _notifyIcon = null;
                }
            }
            catch { }

            // Dừng Local Loopback Server của Extension
            try
            {
                _extensionServer?.Stop();
                _extensionServer?.Dispose();
            }
            catch { }

            // Dừng các luồng tải và lưu tiến độ (file .dlmeta) để lần sau tiếp tục được
            _messageHandler?.Shutdown();
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
