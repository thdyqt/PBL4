using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Lớp hỗ trợ tích hợp sâu vào hệ điều hành Windows:
    /// - Quản lý khởi động cùng Windows (Run on Startup) qua Windows Registry HKCU\Run.
    /// - Kiểm tra cờ tham số dòng lệnh (/background, /minimized) khi khởi động.
    /// </summary>
    public static class ShellIntegrationHelper
    {
        private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string AppName = "DUTDownloadAccelerator";

        /// <summary>
        /// Kiểm tra xem ứng dụng đã được đăng ký khởi động cùng Windows trong Registry chưa.
        /// Sử dụng nhánh HKEY_CURRENT_USER để không yêu cầu quyền Administrator.
        /// </summary>
        public static bool IsRunOnStartupEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RunKeyPath, false))
                {
                    if (key == null) return false;
                    object val = key.GetValue(AppName);
                    if (val == null) return false;

                    string strVal = val.ToString();
                    return !string.IsNullOrWhiteSpace(strVal);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[ShellIntegrationHelper] IsRunOnStartupEnabled error: " + ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Bật hoặc tắt khởi động cùng Windows bằng cách ghi/xóa giá trị trong Windows Registry:
        /// HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
        /// Khi bật, thêm tham số "/background" để ứng dụng khởi động ngầm vào khay hệ thống.
        /// </summary>
        /// <param name="enable">true nếu muốn bật khởi động cùng Windows, false để tắt</param>
        /// <returns>true nếu thao tác thành công, false nếu gặp lỗi</returns>
        public static bool SetRunOnStartup(bool enable)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RunKeyPath, true))
                {
                    if (key == null) return false;

                    if (enable)
                    {
                        string appPath = Application.ExecutablePath;
                        string command = $"\"{appPath}\" /background";
                        key.SetValue(AppName, command, RegistryValueKind.String);
                        Debug.WriteLine($"[ShellIntegrationHelper] Registered startup in Registry: {command}");
                    }
                    else
                    {
                        if (key.GetValue(AppName) != null)
                        {
                            key.DeleteValue(AppName, false);
                            Debug.WriteLine("[ShellIntegrationHelper] Removed startup from Registry.");
                        }
                    }
                    return true;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[ShellIntegrationHelper] SetRunOnStartup error: " + ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Kiểm tra xem danh sách tham số dòng lệnh có chứa cờ yêu cầu chạy ngầm không (/background, /minimized, /tray).
        /// </summary>
        public static bool HasBackgroundArg(string[] args)
        {
            if (args == null || args.Length == 0) return false;

            foreach (var arg in args)
            {
                if (string.IsNullOrWhiteSpace(arg)) continue;
                string clean = arg.Trim().ToLowerInvariant();
                if (clean == "/background" || clean == "-background" || clean == "--background" ||
                    clean == "/minimized" || clean == "-minimized" || clean == "--minimized" ||
                    clean == "/tray" || clean == "-tray")
                {
                    return true;
                }
            }
            return false;
        }
    }
}

