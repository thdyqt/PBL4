using System;

using System.IO;

using System.Text.Json;

using System.Threading.Tasks;

using System.Windows.Forms;

using WindowsFormsApp.Download;



namespace WindowsFormsApp.IPC

{

    public class MessageHandler

    {

        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions

        {

            PropertyNamingPolicy = JsonNamingPolicy.CamelCase

        };



        private readonly Form1 _mainForm;

        private readonly DownloadManager _manager;

        private readonly DownloadScheduler _scheduler;



        // Cache local để tránh query DB mỗi 400ms: taskId -> DownloadRecord

        // Chỉ đọc/ghi từ luồng event ProgressChanged (single-threaded qua message pump)

        private readonly System.Collections.Generic.Dictionary<string, DownloadRecord> _dbCache

            = new System.Collections.Generic.Dictionary<string, DownloadRecord>(StringComparer.Ordinal);



        // Biến phục vụ tính toán tài nguyên CPU / RAM cho biểu đồ thời gian thực (Chart.js)

        private static readonly System.Diagnostics.Process _currentProcess = System.Diagnostics.Process.GetCurrentProcess();

        private TimeSpan _lastCpuTime = TimeSpan.Zero;

        private DateTime _lastCpuSample = DateTime.MinValue;

        private double _cachedCpuUsage = 0;

        private readonly object _cpuLock = new object();

        private long _cachedTotalRamBytes = 0;

        private readonly System.Threading.Timer _metricsTimer;

        private readonly System.Collections.Generic.HashSet<string> _notifiedCompletedTasks

            = new System.Collections.Generic.HashSet<string>(StringComparer.Ordinal);



        public MessageHandler(Form1 mainForm)

        {

            _mainForm = mainForm;



            // Khởi tạo CSDL SQLite ngay khi app mở

            DatabaseHelper.Initialize();



            _manager = new DownloadManager();

            _manager.ProgressChanged += OnProgressChanged;

            _manager.AllDownloadsCompleted += OnAllDownloadsCompleted;



            var settings = SettingsManager.Load();

            _scheduler = new DownloadScheduler(settings.Schedule);

            _scheduler.SchedulerTriggered += OnSchedulerTriggered;

            _scheduler.CountdownTick += OnSchedulerCountdownTick;

            _scheduler.CountdownFinished += OnSchedulerCountdownFinished;

            _scheduler.CountdownCancelled += OnSchedulerCountdownCancelled;



            _cachedTotalRamBytes = GetTotalSystemRam();



            // Phát số liệu hiệu năng (tốc độ, CPU, RAM, threads) mỗi 500ms cho biểu đồ

            _metricsTimer = new System.Threading.Timer(OnMetricsTick, null, 500, 500);

        }



        /// <summary>Gọi khi đóng form: dừng các luồng tải và lưu tiến độ để lần sau Resume.</summary>

        public void Shutdown()

        {

            try { _metricsTimer?.Dispose(); } catch { }

            try { _scheduler?.Dispose(); } catch { }

            _manager.ProgressChanged -= OnProgressChanged;

            _manager.AllDownloadsCompleted -= OnAllDownloadsCompleted;

            _manager.Shutdown();

        }



        /// <summary>

        /// Gọi ngay sau khi trang HTML load xong (NavigationCompleted).

        /// Gửi toàn bộ lịch sử từ SQLite xuống frontend để hiển thị lại.

        /// Các tác vụ đang dở (downloading/preparing/queued) được đánh dấu thành paused

        /// vì app vừa khởi động lại — chúng chưa thực sự đang chạy.

        /// </summary>

        public void SendHistoryOnStartup()

        {

            try

            {

                var history = DatabaseHelper.GetAll();

                foreach (var rec in history)

                {

                    // Nếu app crash khi đang tải -> đổi state về paused để user có thể resume

                    if (rec.State == "downloading" || rec.State == "preparing" || rec.State == "queued")

                    {

                        rec.State = "paused";

                        DatabaseHelper.UpdateProgress(rec);

                    }

                }

                Send(new { action = "HISTORY_DATA", data = history });

            }

            catch (Exception ex)

            {

                Send(new { action = "HISTORY_DATA", data = new object[0], error = ex.Message });

            }

        }



        public void ProcessMessage(string jsonMessage)

        {

            try

            {

                using (JsonDocument doc = JsonDocument.Parse(jsonMessage))

                {

                    JsonElement root = doc.RootElement;

                    string action = root.GetProperty("action").GetString();



                    switch (action)

                    {

                        case "READ_CLIPBOARD":

                            HandleReadClipboard();

                            break;



                        case "BROWSE_FOLDER":

                            HandleBrowseFolder();

                            break;



                        case "START_DOWNLOAD":

                            {

                                string taskId = GetString(root, "taskId");

                                string url = GetString(root, "url");

                                string savePath = GetString(root, "savePath");

                                string customFileName = GetString(root, "customFileName") ?? GetString(root, "fileName");

                                int threads = GetInt(root, "thread", GetInt(root, "threads", 4));

                                _ = HandleStartDownloadAsync(taskId, url, savePath, threads, customFileName);

                                break;

                            }



                        case "START_BATCH_DOWNLOAD":

                            HandleStartBatchDownload(root);

                            break;



                        case "FORCE_START_DOWNLOAD":

                            _manager.ForceStart(GetString(root, "taskId"));

                            break;



                        case "PAUSE_DOWNLOAD":

                            _manager.Pause(GetString(root, "taskId"));

                            break;



                        case "RESUME_DOWNLOAD":

                            {

                                string resId = GetString(root, "taskId");

                                if (_manager.HasJob(resId))

                                {

                                    _manager.Resume(resId);

                                }

                                else

                                {

                                    var rec = DatabaseHelper.GetById(resId);

                                    if (rec != null)

                                    {

                                        string folder = !string.IsNullOrWhiteSpace(rec.TargetPath)

                                            ? (Directory.Exists(rec.TargetPath) ? rec.TargetPath : Path.GetDirectoryName(rec.TargetPath))

                                            : Application.StartupPath;

                                        _ = HandleStartDownloadAsync(rec.Id, rec.SourceUrl, folder, rec.Threads > 0 ? rec.Threads : 4, rec.FileName);

                                    }

                                }

                                break;

                            }



                        case "CANCEL_DOWNLOAD":

                            _ = HandleCancelAsync(GetString(root, "taskId"));

                            break;



                        case "REMOVE_DOWNLOAD":

                            _ = HandleRemoveAsync(GetString(root, "taskId"));

                            break;



                        case "SET_SPEED_LIMIT":

                            {

                                int kbps = GetInt(root, "kbps", 0);

                                _manager.SpeedLimitBytesPerSecond = kbps * 1024L;

                                var currentSettings = SettingsManager.Current;

                                currentSettings.SpeedLimitKbps = kbps;

                                SettingsManager.Save(currentSettings);

                                Send(new { action = "SPEED_LIMIT_UPDATED", kbps = kbps });

                                break;

                            }



                        case "GET_SETTINGS":

                            HandleGetSettings();

                            break;



                        case "SAVE_SETTINGS":

                            HandleSaveSettings(root);

                            break;



                        case "UPDATE_CONFIRM_DELETE":

                            {

                                bool confirm = GetBool(root, "confirmBeforeDelete", true);

                                var currentSettings = SettingsManager.Current;

                                currentSettings.ConfirmBeforeDelete = confirm;

                                SettingsManager.Save(currentSettings);

                                break;

                            }



                        case "UPDATE_THEME":

                            {

                                string theme = GetString(root, "theme") ?? "light";

                                var currentSettings = SettingsManager.Current;

                                currentSettings.Theme = theme;

                                SettingsManager.Save(currentSettings);

                                break;

                            }



                        case "UPDATE_LANGUAGE":

                            {

                                string lang = GetString(root, "language") ?? "vi";

                                var currentSettings = SettingsManager.Current;

                                currentSettings.Language = lang;

                                SettingsManager.Save(currentSettings);

                                _mainForm.UpdateTrayLanguage(lang);

                                break;

                            }



                        case "UPDATE_START_WITH_WINDOWS":

                            {

                                bool enable = GetBool(root, "startWithWindows", false);

                                var currentSettings = SettingsManager.Current;

                                currentSettings.StartWithWindows = enable;

                                ShellIntegrationHelper.SetRunOnStartup(enable);

                                SettingsManager.Save(currentSettings);

                                break;

                            }



                        case "UPDATE_MINIMIZE_TO_TRAY":

                            {

                                bool enable = GetBool(root, "minimizeToTray", true);

                                var currentSettings = SettingsManager.Current;

                                currentSettings.MinimizeToTrayOnClose = enable;

                                SettingsManager.Save(currentSettings);

                                break;

                            }



                        case "UPDATE_SHOW_TOAST":

                            {

                                bool enable = GetBool(root, "showToast", true);

                                var currentSettings = SettingsManager.Current;

                                currentSettings.ShowToastOnCompletion = enable;

                                SettingsManager.Save(currentSettings);

                                break;

                            }



                        case "PAUSE_ALL":

                            PauseAllDownloads();

                            break;



                        case "TEST_PROXY":

                            _ = HandleTestProxyAsync(root);

                            break;



                        case "OPEN_FILE":

                            HandleOpenFile(GetString(root, "taskId"), GetString(root, "path"));

                            break;



                        case "OPEN_FOLDER":

                            HandleOpenFolder(GetString(root, "taskId"), GetString(root, "path"));

                            break;



                        case "SCAN_FILE_VIRUS":

                            _ = HandleScanFileVirusAsync(root);

                            break;



                        case "VERIFY_HASH":

                            _ = HandleVerifyHashAsync(root);

                            break;



                        // ---- Lịch sử tải (SQLite) ----



                        case "GET_HISTORY":

                            HandleGetHistory();

                            break;



                        case "CLEAR_HISTORY":

                            HandleClearHistory();

                            break;



                        case "DELETE_HISTORY_ITEM":

                            HandleDeleteHistoryItem(GetString(root, "taskId"));

                            break;



                        case "GET_SYSTEM_INFO":

                            HandleGetSystemInfo();

                            break;



                        case "GET_PERFORMANCE_METRICS":

                            SendPerformanceMetrics();

                            break;



                        case "OPEN_EXTENSION_FOLDER":

                            HandleOpenExtensionFolder();

                            break;



                        case "TEST_CAPTURE_LINK":

                            HandleTestCaptureLink();

                            break;



                        case "GET_SCHEDULE":

                            HandleGetSchedule();

                            break;



                        case "SAVE_SCHEDULE":

                            HandleSaveSchedule(root);

                            break;



                        case "CANCEL_POWER_ACTION":

                            _scheduler.CancelCountdown();

                            break;



                        case "EXECUTE_POWER_ACTION_NOW":

                            _scheduler.ExecuteNow();

                            break;



                        case "TRIGGER_SCHEDULE_NOW":

                            _scheduler.TriggerNow();

                            break;



                        case "START_ALL_QUEUED":

                        case "RESUME_ALL":

                            StartAllQueuedOrPausedDownloads();

                            break;

                    }

                }

            }

            catch (Exception ex)

            {

                MessageBox.Show("Lỗi: " + ex.Message);

            }

        }



        // ------------------------------------------------------------------ tải xuống



        private async Task HandleStartDownloadAsync(string taskId, string url, string folder, int threads, string customFileName = null)

        {

            _notifiedCompletedTasks.Remove(taskId);

            // Ghi trước vào DB để không mất task khi crash (ngay cả khi chưa biết tên file thật)

            try

            {

                string fileName = !string.IsNullOrWhiteSpace(customFileName)

                    ? customFileName.Trim()

                    : Path.GetFileName(url.Split('?')[0]);

                if (string.IsNullOrWhiteSpace(fileName)) fileName = taskId;



                var rec = new DownloadRecord

                {

                    Id         = taskId,

                    SourceUrl  = url,

                    RemoteUrl  = url,

                    FileName   = fileName,

                    TargetPath = folder,   // sẽ được cập nhật thành đường dẫn thật khi nhận progress đầu tiên

                    State      = "preparing",

                    Threads    = threads

                };

                DatabaseHelper.Insert(rec);

                _dbCache[taskId] = rec;    // đưa vào cache

            }

            catch { }



            try

            {

                await _manager.StartAsync(taskId, url, folder, threads, false, customFileName).ConfigureAwait(false);

            }

            catch (DiskSpaceException ex)

            {

                // Cập nhật trạng thái vào DB

                try

                {

                    DownloadRecord rec;

                    if (!_dbCache.TryGetValue(taskId, out rec))

                        rec = DatabaseHelper.GetById(taskId);

                    if (rec != null)

                    {

                        rec.State = ex.IsAllDrivesFull ? "cancelled" : "failed";

                        rec.ErrorMessage = ex.Message;

                        DatabaseHelper.UpdateProgress(rec);

                        _dbCache[taskId] = rec;

                    }

                }

                catch { }



                Send(new

                {

                    action = "DISK_SPACE_WARNING",

                    taskId = taskId,

                    isAllDrivesFull = ex.IsAllDrivesFull,

                    message = ex.Message,

                    targetDrive = ex.TargetDrive,

                    suggestedDrive = ex.SuggestedDrive,

                    targetFreeBytes = ex.TargetFreeBytes,

                    suggestedFreeBytes = ex.SuggestedFreeBytes,

                    neededBytes = ex.NeededBytes

                });



                Send(new { action = "DOWNLOAD_ERROR", taskId = taskId, message = ex.Message });

            }

            catch (Exception ex)

            {

                var s = SettingsManager.Current;

                bool isEn = s != null && string.Equals(s.Language, "en", StringComparison.OrdinalIgnoreCase);

                string message;



                if (s != null && s.Proxy != null && s.Proxy.Enabled &&

                    (ex.Message.IndexOf("connect", StringComparison.OrdinalIgnoreCase) >= 0 ||

                     ex.Message.IndexOf("refused", StringComparison.OrdinalIgnoreCase) >= 0 ||

                     (ex.InnerException != null && (ex.InnerException.Message.IndexOf("connect", StringComparison.OrdinalIgnoreCase) >= 0 ||

                                                    ex.InnerException.Message.IndexOf("refused", StringComparison.OrdinalIgnoreCase) >= 0))))

                {

                    message = isEn

                        ? $"Proxy connection error ({s.Proxy.Host}:{s.Proxy.Port}): Unable to reach server. Please check Proxy in Settings or disable Proxy."

                        : $"Lỗi kết nối máy chủ Proxy ({s.Proxy.Host}:{s.Proxy.Port}): Không thể kết nối. Vui lòng kiểm tra lại Proxy trong Cài đặt hoặc tắt Proxy nếu không sử dụng.";

                }

                else

                {

                    message = ex is TimeoutException || ex is DownloadException

                        ? ex.Message

                        : (ex.InnerException != null ? ex.InnerException.Message : ex.Message);

                }



                // Cập nhật trạng thái lỗi vào DB

                try

                {

                    DownloadRecord rec;

                    if (!_dbCache.TryGetValue(taskId, out rec))

                        rec = DatabaseHelper.GetById(taskId);

                    if (rec != null)

                    {

                        rec.State = "failed";

                        rec.ErrorMessage = message;

                        DatabaseHelper.UpdateProgress(rec);

                        _dbCache[taskId] = rec;

                    }

                }

                catch { }



                Send(new { action = "DOWNLOAD_ERROR", taskId = taskId, message = message });

            }

        }



        private async Task HandleVerifyHashAsync(JsonElement root)

        {

            string taskId = GetString(root, "taskId");

            string expectedHash = GetString(root, "hash");

            string filePath = GetString(root, "path") ?? _manager.GetTargetPath(taskId);



            if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))

            {

                Send(new { action = "HASH_RESULT", taskId = taskId, success = false, match = false,

                           message = "Không tìm thấy tệp để kiểm tra.", actualHash = (string)null });

                return;

            }



            try

            {

                // Tự nhận dạng: MD5 = 32 ký tự, SHA-256 = 64 ký tự

                bool useMd5 = expectedHash != null && expectedHash.Trim().Length == 32;

                string algoName = useMd5 ? "MD5" : "SHA-256";



                string actualHash = await Task.Run(() =>

                    useMd5 ? ChecksumHelper.ComputeMd5(filePath)

                            : ChecksumHelper.ComputeSha256(filePath)

                ).ConfigureAwait(false);



                bool match = !string.IsNullOrEmpty(expectedHash)

                    && string.Equals(actualHash, expectedHash.Trim(), StringComparison.OrdinalIgnoreCase);



                string msg = match

                    ? algoName + " khớp! Tệp toàn vẹn ✔"

                    : string.IsNullOrWhiteSpace(expectedHash)

                        ? algoName + " đã tính xong."

                        : algoName + " KHÔNG khớp! Tệp có thể bị lỗi ✘";



                Send(new { action = "HASH_RESULT", taskId = taskId, success = true, match = match,

                           message = msg, actualHash = actualHash, algo = algoName });

            }

            catch (Exception ex)

            {

                Send(new { action = "HASH_RESULT", taskId = taskId, success = false, match = false,

                           message = "Lỗi khi tính hash: " + ex.Message, actualHash = (string)null });

            }

        }





        private async Task HandleCancelAsync(string taskId)

        {

            try

            {

                await _manager.CancelAsync(taskId).ConfigureAwait(false);



                // Cập nhật trạng thái = cancelled trong DB (giữ lịch sử, không xóa)

                try

                {

                    DownloadRecord rec;

                    if (!_dbCache.TryGetValue(taskId, out rec))

                        rec = DatabaseHelper.GetById(taskId);

                    if (rec != null)

                    {

                        rec.State = "cancelled";

                        DatabaseHelper.UpdateProgress(rec);

                    }

                    _dbCache.Remove(taskId);

                }

                catch { }

            }

            catch (Exception ex)

            {

                Send(new { action = "DOWNLOAD_ERROR", taskId = taskId, message = ex.Message });

            }

        }



        private async Task HandleRemoveAsync(string taskId)

        {

            try

            {

                await _manager.RemoveAsync(taskId).ConfigureAwait(false);



                // Xóa khỏi cache và xóa khỏi CSDL

                _dbCache.Remove(taskId);

                DatabaseHelper.Delete(taskId);

            }

            catch (Exception ex)

            {

                Send(new { action = "DOWNLOAD_ERROR", taskId = taskId, message = ex.Message });

            }

        }



        // ------------------------------------------------------------------ lịch sử (SQLite)



        private void HandleGetHistory()

        {

            try

            {

                var history = DatabaseHelper.GetAll();

                Send(new { action = "HISTORY_DATA", data = history });

            }

            catch (Exception ex)

            {

                Send(new { action = "HISTORY_DATA", data = new object[0], error = ex.Message });

            }

        }



        private void HandleClearHistory()

        {

            try

            {

                int count = DatabaseHelper.ClearCompleted();

                Send(new { action = "HISTORY_CLEARED", count = count });

            }

            catch (Exception ex)

            {

                Send(new { action = "HISTORY_CLEARED", count = 0, error = ex.Message });

            }

        }



        private void HandleDeleteHistoryItem(string taskId)

        {

            try

            {

                DatabaseHelper.Delete(taskId);

                Send(new { action = "HISTORY_ITEM_DELETED", taskId = taskId });

            }

            catch (Exception ex)

            {

                Send(new { action = "DOWNLOAD_ERROR", taskId = taskId, message = ex.Message });

            }

        }



        private void HandleGetSystemInfo()

        {

            try

            {

                var drives = new System.Collections.Generic.List<object>();

                foreach (var d in DriveInfo.GetDrives())

                {

                    if (!d.IsReady) continue;

                    if (d.DriveType != DriveType.Fixed && d.DriveType != DriveType.Removable) continue;



                    drives.Add(new

                    {

                        name = d.Name,

                        label = string.IsNullOrWhiteSpace(d.VolumeLabel) ? "Local Disk" : d.VolumeLabel,

                        driveType = d.DriveType.ToString(),

                        format = d.DriveFormat,

                        totalBytes = d.TotalSize,

                        freeBytes = d.AvailableFreeSpace,

                        usedBytes = d.TotalSize - d.AvailableFreeSpace

                    });

                }



                long totalRamBytes = 0;

                try

                {

                    // Sử dụng WMI để lấy tổng RAM vật lý

                    using (var searcher = new System.Management.ManagementObjectSearcher("SELECT TotalVisibleMemorySize FROM Win32_OperatingSystem"))

                    {

                        foreach (var obj in searcher.Get())

                        {

                            totalRamBytes = Convert.ToInt64(obj["TotalVisibleMemorySize"]) * 1024; // KB -> Bytes

                        }

                    }

                }

                catch { }



                Send(new

                {

                    action = "SYSTEM_INFO_DATA",

                    data = new

                    {

                        machineName = Environment.MachineName,

                        osVersion = Environment.OSVersion.VersionString,

                        processorCount = Environment.ProcessorCount,

                        totalRamBytes = totalRamBytes,

                        drives = drives

                    }

                });

            }

            catch (Exception ex)

            {

                Send(new { action = "SYSTEM_INFO_DATA", data = (object)null, error = ex.Message });

            }

        }



        // ==================================================================

        // Biểu đồ thời gian thực (Real-time Speed & System Metrics)

        // ==================================================================



        private void OnMetricsTick(object state)

        {

            SendPerformanceMetrics();

        }



        private void SendPerformanceMetrics()

        {

            try

            {

                _manager.GetAggregateMetrics(out double totalSpeed, out int activeThreads, out int activeJobs, out long totalDownloaded);

                double cpuPercent = CalculateCpuUsage();

                _currentProcess.Refresh();

                long ramUsed = _currentProcess.WorkingSet64;



                if (_cachedTotalRamBytes <= 0)

                {

                    _cachedTotalRamBytes = GetTotalSystemRam();

                }



                var dto = new PerformanceMetricsDto

                {

                    TotalSpeed = Math.Round(totalSpeed, 2),

                    ActiveThreads = activeThreads,

                    ActiveJobs = activeJobs,

                    TotalDownloaded = totalDownloaded,

                    CpuPercent = Math.Round(cpuPercent, 1),

                    RamUsedBytes = ramUsed,

                    TotalRamBytes = _cachedTotalRamBytes,

                    ProcessorCount = Environment.ProcessorCount,

                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()

                };



                Send(new

                {

                    action = "PERFORMANCE_METRICS",

                    data = dto,

                    isSleepPrevented = PowerManagementHelper.IsSleepPrevented,

                    isCountingDown = _scheduler.IsCountingDown,

                    remainingSeconds = _scheduler.RemainingSeconds,

                    powerAction = _scheduler.CurrentAction

                });

            }

            catch { }

        }



        private double CalculateCpuUsage()

        {

            lock (_cpuLock)

            {

                var now = DateTime.UtcNow;

                var cpuTime = _currentProcess.TotalProcessorTime;

                if (_lastCpuSample == DateTime.MinValue)

                {

                    _lastCpuSample = now;

                    _lastCpuTime = cpuTime;

                    return 0;

                }

                var elapsedMs = (now - _lastCpuSample).TotalMilliseconds;

                if (elapsedMs >= 400)

                {

                    var cpuMs = (cpuTime - _lastCpuTime).TotalMilliseconds;

                    _lastCpuSample = now;

                    _lastCpuTime = cpuTime;

                    double pct = (cpuMs / (elapsedMs * Environment.ProcessorCount)) * 100.0;

                    _cachedCpuUsage = Math.Max(0.0, Math.Min(100.0, pct));

                }

                return _cachedCpuUsage;

            }

        }



        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential, CharSet = System.Runtime.InteropServices.CharSet.Auto)]

        private class MEMORYSTATUSEX

        {

            public uint dwLength;

            public uint dwMemoryLoad;

            public ulong ullTotalPhys;

            public ulong ullAvailPhys;

            public ulong ullTotalPageFile;

            public ulong ullAvailPageFile;

            public ulong ullTotalVirtual;

            public ulong ullAvailVirtual;

            public ulong ullAvailExtendedVirtual;

            public MEMORYSTATUSEX() { this.dwLength = (uint)System.Runtime.InteropServices.Marshal.SizeOf(typeof(MEMORYSTATUSEX)); }

        }



        [System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet = System.Runtime.InteropServices.CharSet.Auto, SetLastError = true)]

        private static extern bool GlobalMemoryStatusEx([System.Runtime.InteropServices.In, System.Runtime.InteropServices.Out] MEMORYSTATUSEX lpBuffer);



        private static long GetTotalSystemRam()

        {

            try

            {

                var memStatus = new MEMORYSTATUSEX();

                if (GlobalMemoryStatusEx(memStatus) && memStatus.ullTotalPhys > 0)

                {

                    return (long)memStatus.ullTotalPhys;

                }

            }

            catch { }

            return 8L * 1024 * 1024 * 1024; // fallback 8GB

        }



        private void HandleGetSettings()

        {

            var settings = SettingsManager.Current;

            try { settings.StartWithWindows = ShellIntegrationHelper.IsRunOnStartupEnabled(); } catch { }

            Send(new

            {

                action = "SETTINGS_DATA",

                data = settings

            });

        }



        private void HandleSaveSettings(JsonElement root)

        {

            try

            {

                if (root.TryGetProperty("settings", out JsonElement settingsEl))

                {

                    var settings = JsonSerializer.Deserialize<AppSettings>(settingsEl.GetRawText(), JsonOptions);

                    if (settings != null)

                    {

                        SettingsManager.Save(settings);

                        _manager.ApplySettings(settings);

                        if (settings.Schedule != null) _scheduler.UpdateSettings(settings.Schedule);

                        try { ShellIntegrationHelper.SetRunOnStartup(settings.StartWithWindows); } catch { }

                        _mainForm.UpdateTrayLanguage(settings.Language);

                        Send(new

                        {

                            action = "SETTINGS_SAVED",

                            success = true,

                            data = settings

                        });

                        return;

                    }

                }

                Send(new { action = "SETTINGS_SAVED", success = false, message = "Dữ liệu cài đặt không hợp lệ." });

            }

            catch (Exception ex)

            {

                Send(new { action = "SETTINGS_SAVED", success = false, message = ex.Message });

            }

        }



        private async Task HandleTestProxyAsync(JsonElement root)

        {

            try

            {

                ProxySettings proxy = null;

                if (root.TryGetProperty("proxy", out JsonElement proxyEl))

                {

                    proxy = JsonSerializer.Deserialize<ProxySettings>(proxyEl.GetRawText(), JsonOptions);

                }



                if (proxy == null)

                {

                    Send(new { action = "PROXY_TEST_RESULT", success = false, latencyMs = 0, message = "Cấu hình proxy không hợp lệ." });

                    return;

                }



                var result = await ProxyTester.TestConnectionAsync(proxy).ConfigureAwait(false);

                Send(new

                {

                    action = "PROXY_TEST_RESULT",

                    success = result.Success,

                    latencyMs = result.LatencyMs,

                    message = result.Message

                });

            }

            catch (Exception ex)

            {

                Send(new

                {

                    action = "PROXY_TEST_RESULT",

                    success = false,

                    latencyMs = 0,

                    message = "Lỗi kiểm tra proxy: " + ex.Message

                });

            }

        }



        private void HandleStartBatchDownload(JsonElement root)

        {

            try

            {

                if (root.TryGetProperty("tasks", out JsonElement tasksEl) && tasksEl.ValueKind == JsonValueKind.Array)

                {

                    foreach (JsonElement item in tasksEl.EnumerateArray())

                    {

                        string taskId = GetString(item, "taskId");

                        string url = GetString(item, "url");

                        string savePath = GetString(item, "savePath");

                        string customFileName = GetString(item, "customFileName") ?? GetString(item, "fileName");

                        int threads = GetInt(item, "threads", GetInt(item, "thread", 4));

                        if (!string.IsNullOrWhiteSpace(taskId) && !string.IsNullOrWhiteSpace(url))

                        {

                            _ = HandleStartDownloadAsync(taskId, url, savePath, threads, customFileName);

                        }

                    }

                }

            }

            catch (Exception ex)

            {

                Send(new { action = "DOWNLOAD_ERROR", taskId = "", message = "Lỗi thêm hàng loạt: " + ex.Message });

            }

        }



        private void OnProgressChanged(ProgressDto dto)

        {

            // Đồng bộ tiến độ và segments vào SQLite

            // Dùng cache để tránh GetById() mỗi 400ms

            try

            {

                DownloadRecord rec;

                if (!_dbCache.TryGetValue(dto.TaskId, out rec))

                {

                    rec = DatabaseHelper.GetById(dto.TaskId);

                    if (rec != null) _dbCache[dto.TaskId] = rec;

                }



                if (rec != null)

                {

                    bool changed = rec.State != dto.State

                                || rec.Downloaded != dto.Downloaded

                                || rec.FileHash != dto.FileHash;



                    rec.Downloaded     = dto.Downloaded;

                    rec.TotalBytes     = dto.TotalBytes;

                    rec.State          = dto.State;

                    rec.FileHash       = dto.FileHash;

                    rec.ErrorMessage   = dto.Error;

                    rec.FileName       = dto.FileName  ?? rec.FileName;

                    rec.TargetPath     = dto.TargetPath ?? rec.TargetPath;

                    rec.SupportsRanges = dto.SupportsRanges;

                    rec.Threads        = dto.Threads;



                    if (!string.IsNullOrEmpty(dto.VirusScanStatus))

                        rec.VirusScanStatus = dto.VirusScanStatus;

                    else if (!string.IsNullOrEmpty(rec.VirusScanStatus))

                        dto.VirusScanStatus = rec.VirusScanStatus;



                    if (!string.IsNullOrEmpty(dto.VirusScanResult))

                        rec.VirusScanResult = dto.VirusScanResult;

                    else if (!string.IsNullOrEmpty(rec.VirusScanResult))

                        dto.VirusScanResult = rec.VirusScanResult;



                    // Lưu đầy đủ thông tin segment để có thể resume sau crash

                    if (!string.IsNullOrEmpty(dto.SegmentsMetaJson))

                        rec.SegmentsJson = dto.SegmentsMetaJson;



                    if (dto.ElapsedSeconds > 0)

                        rec.ElapsedSeconds = dto.ElapsedSeconds;



                    if (dto.State == "completed")

                    {

                        if (string.IsNullOrEmpty(rec.CompletedAt))

                            rec.CompletedAt = DatabaseHelper.GetVietnamTimeString(DateTime.UtcNow);



                        if (string.IsNullOrEmpty(rec.AvgSpeed))

                        {

                            if (rec.ElapsedSeconds > 0 && rec.TotalBytes > 0)

                            {

                                double avgBytes = (double)rec.TotalBytes / rec.ElapsedSeconds;

                                rec.AvgSpeed = FormatSpeed(avgBytes);

                            }

                            else if (dto.Speed > 0)

                            {

                                rec.AvgSpeed = FormatSpeed(dto.Speed);

                            }

                        }



                        dto.AvgSpeed = rec.AvgSpeed;

                        dto.CompletedAt = rec.CompletedAt;



                        // Windows Shell Toast / BalloonTip Notification khi tải xong một file

                        if (!_notifiedCompletedTasks.Contains(dto.TaskId))

                        {

                            _notifiedCompletedTasks.Add(dto.TaskId);

                            var currentSettings = SettingsManager.Current;

                            if (currentSettings != null && currentSettings.ShowToastOnCompletion)

                            {

                                string fName = !string.IsNullOrEmpty(dto.FileName) ? dto.FileName : rec.FileName;

                                string tPath = !string.IsNullOrEmpty(dto.TargetPath) ? dto.TargetPath : rec.TargetPath;

                                _mainForm.ShowDownloadCompletedToast(fName, tPath);

                            }

                        }

                    }



                    // Luôn ghi (UpdateProgress đã set UpdatedAt mới)

                    DatabaseHelper.UpdateProgress(rec);

                }

            }

            catch { /* DB lỗi không được làm gián đoạn giao diện */ }



            Send(new { action = "DOWNLOAD_PROGRESS", data = dto });

        }



        private static string FormatSpeed(double bytesPerSec)

        {

            if (bytesPerSec <= 0) return "—";

            string[] units = { "B/s", "KB/s", "MB/s", "GB/s" };

            int i = 0;

            while (bytesPerSec >= 1024 && i < units.Length - 1)

            {

                bytesPerSec /= 1024;

                i++;

            }

            return $"{bytesPerSec:0.##} {units[i]}";

        }



        private void Send(object payload)

        {

            _mainForm.SendToWeb(JsonSerializer.Serialize(payload, JsonOptions));

        }



        // ------------------------------------------------------------------ tiện ích đọc JSON



        private static string GetString(JsonElement root, string name)

        {

            JsonElement value;

            if (root.TryGetProperty(name, out value) && value.ValueKind == JsonValueKind.String)

                return value.GetString();

            return null;

        }



        private static int GetInt(JsonElement root, string name, int fallback)

        {

            JsonElement value;

            if (!root.TryGetProperty(name, out value)) return fallback;



            int number;

            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out number)) return number;

            if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out number)) return number;

            return fallback;

        }



        private static bool GetBool(JsonElement root, string name, bool fallback)

        {

            JsonElement value;

            if (!root.TryGetProperty(name, out value)) return fallback;

            if (value.ValueKind == JsonValueKind.True) return true;

            if (value.ValueKind == JsonValueKind.False) return false;

            if (value.ValueKind == JsonValueKind.String && bool.TryParse(value.GetString(), out bool b)) return b;

            return fallback;

        }



        // ------------------------------------------------------------------ clipboard + chọn thư mục (giữ nguyên)



        private void HandleReadClipboard()

        {

            string clipboardText = "";



            // Kiểm tra xem Clipboard của Windows có chứa văn bản (như URL) không

            if (Clipboard.ContainsText())

            {

                clipboardText = Clipboard.GetText();

            }



            var responseData = new

            {

                action = "CLIPBOARD_DATA",

                data = clipboardText

            };

            _mainForm.SendToWeb(JsonSerializer.Serialize(responseData));

        }



        private void HandleBrowseFolder()

        {

            _mainForm.BeginInvoke(new Action(() =>

            {

                try

                {

                    using (FolderBrowserDialog folderDialog = new FolderBrowserDialog())

                    {

                        folderDialog.Description = "Chọn thư mục để lưu tệp tải về:";

                        folderDialog.ShowNewFolderButton = true;

                        folderDialog.RootFolder = Environment.SpecialFolder.Desktop;



                        var settings = SettingsManager.Current;

                        if (!string.IsNullOrEmpty(settings?.DefaultSavePath) && Directory.Exists(settings.DefaultSavePath))

                        {

                            folderDialog.SelectedPath = settings.DefaultSavePath;

                        }

                        else

                        {

                            string downloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");

                            if (Directory.Exists(downloads))

                            {

                                folderDialog.SelectedPath = downloads;

                            }

                        }



                        // Đảm bảo Form1 được đưa lên làm cửa sổ hoạt động chính

                        _mainForm.Activate();



                        if (folderDialog.ShowDialog(_mainForm) == DialogResult.OK)

                        {

                            string selectedPath = folderDialog.SelectedPath;

                            if (!string.IsNullOrWhiteSpace(selectedPath))

                            {

                                // Lưu vào cài đặt mặc định

                                if (settings != null)

                                {

                                    settings.DefaultSavePath = selectedPath;

                                    SettingsManager.Save(settings);

                                }



                                var responseData = new

                                {

                                    action = "FOLDER_SELECTED",

                                    data = selectedPath

                                };

                                string responseJson = JsonSerializer.Serialize(responseData);



                                // Gửi kết quả lên giao diện Web

                                _mainForm.SendToWeb(responseJson);

                            }

                        }

                    }

                }

                catch (Exception ex)

                {

                    SendError("", "Không thể mở hộp thoại chọn thư mục: " + ex.Message);

                }

            }));

        }

        private void HandleStartDownload(JsonElement root)

        {

            string taskId = root.GetProperty("taskId").GetString();

            string url = root.GetProperty("url").GetString();

            string savePath = root.GetProperty("savePath").GetString();

            int threads = root.GetProperty("thread").GetInt32();



            // Kiểm tra lại ở C#: JS chỉ kiểm tra để người dùng đỡ nhập sai,

            // không thể coi dữ liệu từ giao diện là đáng tin.

            Uri uri;

            if (!Uri.TryCreate(url, UriKind.Absolute, out uri) ||

                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))

            {

                SendError(taskId, "Liên kết không hợp lệ (chỉ hỗ trợ HTTP/HTTPS).");

                return;

            }



            if (string.IsNullOrWhiteSpace(savePath) || !Directory.Exists(savePath))

            {

                SendError(taskId, "Thư mục lưu không tồn tại.");

                return;

            }



            threads = Math.Max(1, Math.Min(threads, 16));



            // TODO bước sau: gọi engine tải ở đây. Hiện chỉ xác nhận đã nhận lệnh.

            var response = new

            {

                action = "DOWNLOAD_ACCEPTED",

                taskId = taskId,

                data = new { url = url, savePath = savePath, threads = threads }

            };

            _mainForm.SendToWeb(JsonSerializer.Serialize(response));

        }



        private void SendError(string taskId, string message)

        {

            var response = new { action = "DOWNLOAD_ERROR", taskId = taskId, message = message };

            _mainForm.SendToWeb(JsonSerializer.Serialize(response));

        }



        private void HandleOpenFile(string taskId, string path)

        {

            try

            {

                string targetPath = !string.IsNullOrWhiteSpace(path) ? path : _manager.GetTargetPath(taskId);

                if (string.IsNullOrWhiteSpace(targetPath) || !File.Exists(targetPath))

                {

                    MessageBox.Show("Tệp không tồn tại hoặc đã bị di chuyển.", "Thông báo", MessageBoxButtons.OK, MessageBoxIcon.Warning);

                    return;

                }



                DownloadRecord rec = null;

                if (!string.IsNullOrEmpty(taskId))

                {

                    _dbCache.TryGetValue(taskId, out rec);

                    if (rec == null) rec = DatabaseHelper.GetById(taskId);

                }



                if (rec != null && rec.VirusScanStatus == "threat")

                {

                    DialogResult confirm = MessageBox.Show(

                        "CẢNH BÁO MÃ ĐỘC TỪ WINDOWS DEFENDER!\n\n" +

                        $"Tệp: {Path.GetFileName(targetPath)}\n" +

                        "Bộ quét mã độc của Windows đã phát hiện tệp này chứa mối đe dọa an ninh tiềm ẩn.\n\n" +

                        "Việc mở tệp này có thể gây nguy hiểm cho hệ điều hành và thiết bị của bạn.\n" +

                        "Bạn có chắc chắn muốn bỏ qua cảnh báo bảo mật và tiếp tục mở tệp không?",

                        "Cảnh báo bảo mật hệ thống",

                        MessageBoxButtons.YesNo,

                        MessageBoxIcon.Warning,

                        MessageBoxDefaultButton.Button2);



                    if (confirm != DialogResult.Yes) return;

                }

                else if (rec != null && rec.VirusScanStatus == "scanning")

                {

                    DialogResult waitConfirm = MessageBox.Show(

                        "Windows Defender đang trong quá trình quét mã độc tệp này.\n\n" +

                        "Bạn có muốn chờ quét xong để đảm bảo an toàn tuyệt đối trước khi mở không?\n" +

                        "(Chọn Yes để chờ quét xong, No để mở ngay)",

                        "Đang kiểm tra an toàn tệp",

                        MessageBoxButtons.YesNo,

                        MessageBoxIcon.Information,

                        MessageBoxDefaultButton.Button1);



                    if (waitConfirm == DialogResult.Yes) return;

                }



                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo

                {

                    FileName = targetPath,

                    UseShellExecute = true

                });

            }

            catch (Exception ex)

            {

                MessageBox.Show("Không thể mở tệp: " + ex.Message, "Lỗi", MessageBoxButtons.OK, MessageBoxIcon.Error);

            }

        }



        private void HandleOpenFolder(string taskId, string path)

        {

            try

            {

                string targetPath = !string.IsNullOrWhiteSpace(path) ? path : _manager.GetTargetPath(taskId);

                if (string.IsNullOrWhiteSpace(targetPath))

                {

                    MessageBox.Show("Không tìm thấy đường dẫn tệp.", "Thông báo", MessageBoxButtons.OK, MessageBoxIcon.Warning);

                    return;

                }



                if (File.Exists(targetPath))

                {

                    // Mở thư mục và chọn (bôi đen) tệp trong File Explorer

                    System.Diagnostics.Process.Start("explorer.exe", "/select,\"" + targetPath + "\"");

                }

                else

                {

                    string folder = Path.GetDirectoryName(targetPath);

                    if (!string.IsNullOrWhiteSpace(folder) && Directory.Exists(folder))

                    {

                        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo

                        {

                            FileName = folder,

                            UseShellExecute = true

                        });

                    }

                    else

                    {

                        MessageBox.Show("Thư mục chứa tệp không tồn tại.", "Thông báo", MessageBoxButtons.OK, MessageBoxIcon.Warning);

                    }

                }

            }

            catch (Exception ex)

            {

                MessageBox.Show("Không thể mở thư mục: " + ex.Message, "Lỗi", MessageBoxButtons.OK, MessageBoxIcon.Error);

            }

        }



        private async Task HandleScanFileVirusAsync(JsonElement root)

        {

            string taskId = GetString(root, "taskId");

            string path = GetString(root, "path");



            try

            {

                if (string.IsNullOrEmpty(path) && !string.IsNullOrEmpty(taskId))

                {

                    path = _manager.GetTargetPath(taskId);

                    if (string.IsNullOrEmpty(path))

                    {

                        var recDb = DatabaseHelper.GetById(taskId);

                        if (recDb != null) path = recDb.TargetPath;

                    }

                }



                if (string.IsNullOrEmpty(path) || !File.Exists(path))

                {

                    Send(new { action = "VIRUS_SCAN_RESULT", taskId = taskId, status = "error", message = "Tệp không tồn tại hoặc đã bị xóa." });

                    return;

                }



                // Phát tín hiệu đang quét lên Web

                Send(new { action = "VIRUS_SCAN_RESULT", taskId = taskId, status = "scanning", message = "Đang quét virus qua Windows Defender..." });



                var scan = await AntivirusScanner.ScanFileAsync(path).ConfigureAwait(false);



                // Cập nhật CSDL SQLite

                if (!string.IsNullOrEmpty(taskId))

                {

                    DownloadRecord rec;

                    if (!_dbCache.TryGetValue(taskId, out rec))

                    {

                        rec = DatabaseHelper.GetById(taskId);

                        if (rec != null) _dbCache[taskId] = rec;

                    }



                    if (rec != null)

                    {

                        rec.VirusScanStatus = scan.Status;

                        rec.VirusScanResult = scan.Message;

                        DatabaseHelper.UpdateProgress(rec);

                    }

                }



                Send(new

                {

                    action = "VIRUS_SCAN_RESULT",

                    taskId = taskId,

                    status = scan.Status,

                    message = scan.Message,

                    exitCode = scan.ExitCode,

                    rawOutput = scan.RawOutput

                });

            }

            catch (Exception ex)

            {

                Send(new { action = "VIRUS_SCAN_RESULT", taskId = taskId, status = "error", message = "Lỗi quét mã độc: " + ex.Message });

            }

        }



        private void HandleOpenExtensionFolder()

        {

            try

            {

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;

                string candidate1 = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..\BrowserExtension"));

                string candidate2 = Path.GetFullPath(Path.Combine(baseDir, "BrowserExtension"));

                string candidate3 = @"c:\PBL4-Branch\BrowserExtension";



                string target = Directory.Exists(candidate1) ? candidate1 :

                                Directory.Exists(candidate3) ? candidate3 :

                                Directory.Exists(candidate2) ? candidate2 : baseDir;



                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo

                {

                    FileName = "explorer.exe",

                    Arguments = $"\"{target}\"",

                    UseShellExecute = true

                });

            }

            catch (Exception ex)

            {

                Send(new { action = "SHOW_TOAST", message = "Không mở được thư mục: " + ex.Message });

            }

        }



        private void HandleTestCaptureLink()

        {

            try

            {

                var dummy = new CapturedLinkDto

                {

                    Url = "https://proof.ovh.net/files/100Mb.dat",

                    FileName = "100Mb.dat",

                    Referrer = "https://proof.ovh.net/",

                    TotalBytes = 104857600,

                    AutoStart = false

                };



                _mainForm.BringToFrontAndRestore();

                Send(new

                {

                    action = "BROWSER_LINK_CAPTURED",

                    data = dummy

                });

            }

            catch (Exception ex)

            {

                Send(new { action = "SHOW_TOAST", message = "Lỗi thử nghiệm link: " + ex.Message });

            }

        }

    

        // ------------------------------------------------------------------ Lập lịch & Nguồn điện Windows



        private void OnSchedulerTriggered()

        {

            StartAllQueuedOrPausedDownloads();

            var s = SettingsManager.Current.Schedule;

            Send(new

            {

                action = "SCHEDULE_TRIGGERED",

                time = s?.StartTime ?? "01:00",

                actionOnComplete = s?.ActionOnComplete ?? "none",

                message = $"Đã đến giờ hẹn ({s?.StartTime}), tự động bắt đầu tải hàng đợi!"

            });

        }



        private void OnAllDownloadsCompleted()

        {

            var s = SettingsManager.Current.Schedule;

            if (s != null && !string.Equals(s.ActionOnComplete, "none", StringComparison.OrdinalIgnoreCase))

            {

                int sec = s.CountdownSeconds > 0 ? s.CountdownSeconds : 60;

                _scheduler.StartCountdown(s.ActionOnComplete, sec);

            }

        }



        private void OnSchedulerCountdownTick(string action, int remaining)

        {

            Send(new

            {

                action = "POWER_ACTION_COUNTDOWN",

                powerAction = action,

                remainingSeconds = remaining

            });

        }



        private void OnSchedulerCountdownFinished(string action)

        {

            Send(new

            {

                action = "POWER_ACTION_FINISHED",

                powerAction = action

            });

        }



        private void OnSchedulerCountdownCancelled()

        {

            Send(new

            {

                action = "POWER_ACTION_CANCELLED",

                message = "Đã hủy lệnh tắt máy / ngủ thành công."

            });

        }



        /// <summary>

        /// Tạm dừng tất cả tác vụ và phát thông điệp ALL_PAUSED lên giao diện.

        /// </summary>

        public void PauseAllDownloads()

        {

            try

            {

                _manager.PauseAll();

                Send(new { action = "ALL_PAUSED" });

            }

            catch (Exception ex)

            {

                System.Diagnostics.Debug.WriteLine("[MessageHandler] PauseAllDownloads error: " + ex.Message);

            }

        }



        public void StartAllQueuedOrPausedDownloads()

        {

            try

            {

                _manager.StartAllQueued();



                var history = DatabaseHelper.GetAll();

                foreach (var rec in history)

                {

                    if (rec.State == "paused" || rec.State == "queued")

                    {

                        if (!_manager.HasJob(rec.Id))

                        {

                            string folder = !string.IsNullOrWhiteSpace(rec.TargetPath)

                                ? (Directory.Exists(rec.TargetPath) ? rec.TargetPath : Path.GetDirectoryName(rec.TargetPath))

                                : Application.StartupPath;

                            _ = HandleStartDownloadAsync(rec.Id, rec.SourceUrl, folder, rec.Threads > 0 ? rec.Threads : 4, rec.FileName);

                        }

                        else

                        {

                            _manager.Resume(rec.Id);

                        }

                    }

                }

            }

            catch (Exception ex)

            {

                System.Diagnostics.Debug.WriteLine("[MessageHandler] StartAllQueuedOrPausedDownloads error: " + ex.Message);

            }

        }



        private void HandleGetSchedule()

        {

            var cur = SettingsManager.Current;

            Send(new

            {

                action = "SCHEDULE_CONFIG",

                schedule = cur.Schedule,

                isSleepPrevented = PowerManagementHelper.IsSleepPrevented,

                isCountingDown = _scheduler.IsCountingDown,

                remainingSeconds = _scheduler.RemainingSeconds,

                currentAction = _scheduler.CurrentAction

            });

        }



        private void HandleSaveSchedule(JsonElement root)

        {

            try

            {

                var cur = SettingsManager.Current;

                if (cur.Schedule == null) cur.Schedule = new ScheduleSettings();



                if (root.TryGetProperty("schedule", out JsonElement schedEl))

                {

                    if (schedEl.TryGetProperty("enabled", out var e)) cur.Schedule.Enabled = e.GetBoolean();

                    if (schedEl.TryGetProperty("startTime", out var st)) cur.Schedule.StartTime = st.GetString();

                    if (schedEl.TryGetProperty("actionOnComplete", out var ac)) cur.Schedule.ActionOnComplete = ac.GetString();

                    if (schedEl.TryGetProperty("countdownSeconds", out var cs)) cur.Schedule.CountdownSeconds = cs.GetInt32();

                }



                SettingsManager.Save(cur);

                _scheduler.UpdateSettings(cur.Schedule);



                Send(new

                {

                    action = "SCHEDULE_SAVED",

                    success = true,

                    schedule = cur.Schedule,

                    isSleepPrevented = PowerManagementHelper.IsSleepPrevented

                });

            }

            catch (Exception ex)

            {

                Send(new { action = "SCHEDULE_SAVED", success = false, message = ex.Message });

            }

        }

    }

}