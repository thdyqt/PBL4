using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Quản lý nguồn điện Windows & Tương tác Win32 API:
    /// 1. Gọi SetThreadExecutionState (ES_SYSTEM_REQUIRED | ES_CONTINUOUS) để ngăn Windows tự động ngủ khi đang tải.
    /// 2. Hẹn giờ Tắt máy (Shutdown) an toàn kèm lệnh hủy đếm ngược (shutdown.exe /s /t 60 và shutdown /a).
    /// 3. Đưa hệ thống vào trạng thái Ngủ (Sleep / Suspend).
    /// </summary>
    public static class PowerManagementHelper
    {
        [Flags]
        public enum EXECUTION_STATE : uint
        {
            ES_AWAYMODE_REQUIRED = 0x00000040,
            ES_CONTINUOUS        = 0x80000000,
            ES_DISPLAY_REQUIRED  = 0x00000002,
            ES_SYSTEM_REQUIRED   = 0x00000001
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern EXECUTION_STATE SetThreadExecutionState(EXECUTION_STATE esFlags);

        [DllImport("Powrprof.dll", SetLastError = true)]
        private static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

        private static bool _isSleepPrevented = false;
        private static readonly object _syncLock = new object();

        /// <summary>
        /// Cho biết hệ thống hiện có đang được giữ thức (ngăn sleep) hay không.
        /// </summary>
        public static bool IsSleepPrevented
        {
            get { lock (_syncLock) return _isSleepPrevented; }
        }

        /// <summary>
        /// Ngăn chặn Windows tự động rơi vào chế độ Ngủ (Sleep) hoặc Ngủ đông (Hibernate)
        /// khi có tác vụ tải đang chạy ngầm. Sử dụng Win32 API SetThreadExecutionState.
        /// </summary>
        public static void PreventSleep()
        {
            lock (_syncLock)
            {
                if (!_isSleepPrevented)
                {
                    try
                    {
                        EXECUTION_STATE prev = SetThreadExecutionState(EXECUTION_STATE.ES_CONTINUOUS | EXECUTION_STATE.ES_SYSTEM_REQUIRED);
                        _isSleepPrevented = true;
                        Debug.WriteLine("[PowerManagement] Đã kích hoạt chống ngủ tự động: SetThreadExecutionState(ES_SYSTEM_REQUIRED | ES_CONTINUOUS)");
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine("[PowerManagement] Lỗi PreventSleep: " + ex.Message);
                    }
                }
            }
        }

        /// <summary>
        /// Cho phép Windows khôi phục lại chế độ quản lý nguồn điện bình thường (cho phép tự động Sleep theo cấu hình Power Plan)
        /// khi không còn tác vụ tải nào đang hoạt động.
        /// </summary>
        public static void AllowSleep()
        {
            lock (_syncLock)
            {
                if (_isSleepPrevented)
                {
                    try
                    {
                        SetThreadExecutionState(EXECUTION_STATE.ES_CONTINUOUS);
                        _isSleepPrevented = false;
                        Debug.WriteLine("[PowerManagement] Đã khôi phục chế độ ngủ bình thường: SetThreadExecutionState(ES_CONTINUOUS)");
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine("[PowerManagement] Lỗi AllowSleep: " + ex.Message);
                    }
                }
            }
        }

        /// <summary>
        /// Lên lịch tắt máy Windows sau số giây quy định sử dụng shutdown.exe hệ thống.
        /// Có hiển thị thông báo đếm ngược của hệ điều hành.
        /// </summary>
        public static bool ScheduleShutdown(int countdownSeconds = 60, string comment = "DUT Download Accelerator: Đã tải xong toàn bộ danh sách hàng đợi. Máy tính sẽ tắt sau ít phút.")
        {
            try
            {
                int sec = Math.Max(5, countdownSeconds);
                string args = string.Format("/s /t {0} /c \"{1}\"", sec, comment.Replace("\"", "\\\""));

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "shutdown.exe",
                    Arguments = args,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };

                using (var p = Process.Start(psi))
                {
                    p?.WaitForExit(2000);
                }

                Debug.WriteLine($"[PowerManagement] Đã kích hoạt lệnh tắt máy hệ thống sau {sec}s.");
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[PowerManagement] ScheduleShutdown failed: " + ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Hủy lệnh tắt máy tính đang đếm ngược (shutdown /a).
        /// </summary>
        public static bool CancelShutdown()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "shutdown.exe",
                    Arguments = "/a",
                    CreateNoWindow = true,
                    UseShellExecute = false
                };

                using (var p = Process.Start(psi))
                {
                    p?.WaitForExit(2000);
                }

                Debug.WriteLine("[PowerManagement] Đã hủy lệnh tắt máy tính (shutdown /a).");
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[PowerManagement] CancelShutdown failed: " + ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Đưa máy tính vào chế độ Ngủ (Sleep - Suspend).
        /// </summary>
        public static bool SleepSystem()
        {
            try
            {
                // Gọi Application.SetSuspendState của Windows Forms
                bool success = Application.SetSuspendState(PowerState.Suspend, false, false);
                if (!success)
                {
                    // Fallback sang Win32 SetSuspendState trong Powrprof.dll
                    success = SetSuspendState(false, true, false);
                }
                Debug.WriteLine("[PowerManagement] Kích hoạt Sleep: " + success);
                return success;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[PowerManagement] SleepSystem failed: " + ex.Message);
                return false;
            }
        }
    }
}

