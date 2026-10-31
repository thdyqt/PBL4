using System;
using System.Diagnostics;
using System.Threading;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Bộ điều phối Lập lịch Tải về & Hẹn giờ Tắt máy / Ngủ:
    /// - Theo dõi thời gian thực để kích hoạt hàng đợi tải vào giờ đã hẹn (ví dụ: 01:00 AM).
    /// - Quản lý đồng hồ đếm ngược (60s) trước khi Tắt máy hoặc Ngủ sau khi tải xong.
    /// - Hỗ trợ hủy bỏ đếm ngược kịp thời theo thao tác của người dùng.
    /// </summary>
    public sealed class DownloadScheduler : IDisposable
    {
        private ScheduleSettings _settings;
        private readonly System.Threading.Timer _scheduleTimer;
        private readonly System.Threading.Timer _countdownTimer;
        private readonly object _lock = new object();

        private string _lastTriggerKey = "";
        private bool _isCountingDown = false;
        private int _remainingSeconds = 0;
        private string _currentAction = "none";
        private bool _disposed = false;

        public event Action SchedulerTriggered;
        public event Action<string, int> CountdownTick;
        public event Action<string> CountdownFinished;
        public event Action CountdownCancelled;

        public DownloadScheduler(ScheduleSettings settings)
        {
            _settings = settings ?? new ScheduleSettings();
            _scheduleTimer = new System.Threading.Timer(OnScheduleCheck, null, 1000, 1000);
            _countdownTimer = new System.Threading.Timer(OnCountdownStep, null, Timeout.Infinite, Timeout.Infinite);
        }

        public ScheduleSettings Settings
        {
            get { lock (_lock) return _settings; }
        }

        public bool IsCountingDown
        {
            get { lock (_lock) return _isCountingDown; }
        }

        public int RemainingSeconds
        {
            get { lock (_lock) return _remainingSeconds; }
        }

        public string CurrentAction
        {
            get { lock (_lock) return _currentAction; }
        }

        public void UpdateSettings(ScheduleSettings settings)
        {
            lock (_lock)
            {
                _settings = settings ?? new ScheduleSettings();
            }
        }

        /// <summary>
        /// Kích hoạt lịch ngay lập tức (phục vụ nút test hoặc người dùng muốn chạy ngay danh sách hàng đợi).
        /// </summary>
        public void TriggerNow()
        {
            try
            {
                SchedulerTriggered?.Invoke();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Scheduler] TriggerNow error: " + ex.Message);
            }
        }

        /// <summary>
        /// Bắt đầu quy trình đếm ngược thực hiện tác vụ nguồn (Shutdown hoặc Sleep).
        /// </summary>
        public void StartCountdown(string action, int seconds = 60)
        {
            if (string.Equals(action, "none", StringComparison.OrdinalIgnoreCase)) return;

            lock (_lock)
            {
                if (_isCountingDown) return;

                _isCountingDown = true;
                _currentAction = action.ToLowerInvariant();
                _remainingSeconds = Math.Max(5, seconds);

                // Nếu là lệnh shutdown, gọi ngay shutdown.exe của Windows kèm timeout để Windows đồng bộ
                if (_currentAction == "shutdown")
                {
                    PowerManagementHelper.ScheduleShutdown(_remainingSeconds, "DUT Download Accelerator: Đã tải xong danh sách hàng đợi. Máy tính sẽ tắt sau ít phút.");
                }

                _countdownTimer.Change(1000, 1000);
            }

            CountdownTick?.Invoke(_currentAction, _remainingSeconds);
        }

        /// <summary>
        /// Người dùng nhấn hủy đếm ngược trong giao diện.
        /// </summary>
        public void CancelCountdown()
        {
            bool wasCounting;
            string prevAction;

            lock (_lock)
            {
                wasCounting = _isCountingDown;
                prevAction = _currentAction;

                _countdownTimer.Change(Timeout.Infinite, Timeout.Infinite);
                _isCountingDown = false;
                _currentAction = "none";
                _remainingSeconds = 0;
            }

            if (wasCounting)
            {
                if (prevAction == "shutdown")
                {
                    PowerManagementHelper.CancelShutdown();
                }

                CountdownCancelled?.Invoke();
            }
        }

        /// <summary>
        /// Thực thi lệnh nguồn ngay lập tức (bỏ qua thời gian đếm ngược còn lại).
        /// </summary>
        public void ExecuteNow()
        {
            string action;
            lock (_lock)
            {
                if (!_isCountingDown) return;
                action = _currentAction;
                _countdownTimer.Change(Timeout.Infinite, Timeout.Infinite);
                _isCountingDown = false;
                _currentAction = "none";
                _remainingSeconds = 0;
            }

            if (action == "shutdown")
            {
                PowerManagementHelper.ScheduleShutdown(1, "DUT Download Accelerator: Tắt máy tính ngay.");
            }
            else if (action == "sleep")
            {
                PowerManagementHelper.SleepSystem();
            }

            CountdownFinished?.Invoke(action);
        }

        private void OnScheduleCheck(object state)
        {
            if (_disposed) return;

            try
            {
                ScheduleSettings cfg;
                lock (_lock) { cfg = _settings; }

                if (cfg == null || !cfg.Enabled || string.IsNullOrWhiteSpace(cfg.StartTime))
                    return;

                DateTime now = DateTime.Now;
                string currentHm = now.ToString("HH:mm");

                if (string.Equals(currentHm, cfg.StartTime.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    string triggerKey = $"{now:yyyy-MM-dd}_{currentHm}";
                    if (_lastTriggerKey != triggerKey)
                    {
                        _lastTriggerKey = triggerKey;
                        Debug.WriteLine($"[Scheduler] Đã đến giờ hẹn: {currentHm}. Kích hoạt hàng đợi tải...");
                        SchedulerTriggered?.Invoke();
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Scheduler] OnScheduleCheck error: " + ex.Message);
            }
        }

        private void OnCountdownStep(object state)
        {
            if (_disposed) return;

            int remaining;
            string action;

            lock (_lock)
            {
                if (!_isCountingDown) return;

                _remainingSeconds--;
                remaining = _remainingSeconds;
                action = _currentAction;

                if (remaining <= 0)
                {
                    _countdownTimer.Change(Timeout.Infinite, Timeout.Infinite);
                    _isCountingDown = false;
                    _currentAction = "none";
                }
            }

            if (remaining > 0)
            {
                CountdownTick?.Invoke(action, remaining);
            }
            else
            {
                // Hết giờ đếm ngược
                if (action == "sleep")
                {
                    PowerManagementHelper.SleepSystem();
                }
                // Nếu là shutdown thì shutdown.exe đã được Windows hẹn giờ chạy tại thời điểm 0s.
                CountdownFinished?.Invoke(action);
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            if (_isCountingDown && _currentAction == "shutdown")
            {
                PowerManagementHelper.CancelShutdown();
            }
            try { _scheduleTimer.Dispose(); } catch { }
            try { _countdownTimer.Dispose(); } catch { }
        }
    }
}
