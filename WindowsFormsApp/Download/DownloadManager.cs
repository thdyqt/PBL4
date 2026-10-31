using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Quản lý nhiều tác vụ tải: tạo job (khâu 1-2), phát tiến độ định kỳ (khâu 4),
    /// nhận lệnh Pause/Resume/Remove và giới hạn tốc độ.
    /// ProgressChanged được gọi từ luồng nền: nơi nhận phải tự chuyển về luồng giao diện.
    /// </summary>
    public sealed class DownloadManager : IDisposable
    {
        private HttpClient _http;
        private readonly SpeedLimiter _limiter = new SpeedLimiter();
        private readonly ConcurrentDictionary<string, DownloadJob> _jobs = new ConcurrentDictionary<string, DownloadJob>();
        private readonly ConcurrentDictionary<string, FtpJob>    _ftpJobs = new ConcurrentDictionary<string, FtpJob>();
        private readonly HashSet<string> _activeTargets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly object _targetLock = new object();
        private readonly List<string> _queue = new List<string>();
        private readonly object _queueLock = new object();
        private int _maxConcurrentDownloads = 2; // 0 = Không giới hạn
        private ProxySettings _currentProxy;
        private readonly System.Threading.Timer _timer;
        private int _tickBusy;
        private int _tickCount;
        private bool _disposed;

        public event Action<ProgressDto> ProgressChanged;
        public event Action AllDownloadsCompleted;
        private bool _wasDownloading;

        public DownloadManager()
        {
            var settings = SettingsManager.Load();
            _maxConcurrentDownloads = settings.MaxConcurrentDownloads;
            _limiter.BytesPerSecond = settings.SpeedLimitKbps * 1024L;
            _currentProxy = settings.Proxy ?? new ProxySettings();
            _http = CreateHttpClient(_currentProxy);

            _timer = new System.Threading.Timer(OnTick, null, 400, 400);
        }

        public long SpeedLimitBytesPerSecond
        {
            get { return _limiter.BytesPerSecond; }
            set { _limiter.BytesPerSecond = value; }
        }

        public int MaxConcurrentDownloads
        {
            get { lock (_queueLock) return _maxConcurrentDownloads; }
            set
            {
                lock (_queueLock) _maxConcurrentDownloads = Math.Max(0, value);
                CheckAndProcessQueue();
            }
        }

        public int ActiveDownloadingCount
        {
            get
            {
                return _jobs.Values.Count(j => j.State == DownloadState.Downloading || j.State == DownloadState.Preparing)
                     + _ftpJobs.Values.Count(j => j.State == DownloadState.Downloading || j.State == DownloadState.Preparing);
            }
        }

        public static HttpClient CreateHttpClient(ProxySettings proxy)
        {
            var handler = new HttpClientHandler
            {
                AllowAutoRedirect = true,
                MaxAutomaticRedirections = 8,
                // Phải tắt nén: nếu server nén gzip thì offset byte của Range không còn khớp
                AutomaticDecompression = DecompressionMethods.None,
                ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true
            };
            try { handler.MaxConnectionsPerServer = 64; } catch { }

            if (proxy != null && proxy.Enabled)
            {
                if (string.Equals(proxy.Mode, "system", StringComparison.OrdinalIgnoreCase))
                {
                    handler.UseProxy = true;
                    handler.Proxy = WebRequest.GetSystemWebProxy();
                }
                else if (!string.IsNullOrWhiteSpace(proxy.Host))
                {
                    try
                    {
                        string scheme = string.Equals(proxy.Type, "socks5", StringComparison.OrdinalIgnoreCase) ? "socks5" : "http";
                        string proxyUri = $"{scheme}://{proxy.Host.Trim()}:{proxy.Port}";
                        var webProxy = new WebProxy(new Uri(proxyUri), proxy.BypassLocal);

                        if (proxy.AuthRequired && !string.IsNullOrEmpty(proxy.Username))
                        {
                            webProxy.Credentials = new NetworkCredential(proxy.Username, proxy.Password ?? "");
                        }

                        handler.Proxy = webProxy;
                        handler.UseProxy = true;
                    }
                    catch
                    {
                        handler.UseProxy = false;
                    }
                }
                else
                {
                    handler.UseProxy = false;
                }
            }
            else
            {
                handler.UseProxy = false;
            }

            var client = new HttpClient(handler);
            client.Timeout = Timeout.InfiniteTimeSpan;
            client.DefaultRequestHeaders.UserAgent.ParseAdd("DUTDownloadAccelerator/1.0 (Windows)");
            client.DefaultRequestHeaders.AcceptEncoding.Add(new StringWithQualityHeaderValue("identity"));
            return client;
        }

        public void UpdateProxy(ProxySettings proxy)
        {
            _currentProxy = proxy ?? new ProxySettings();
            var oldClient = _http;
            _http = CreateHttpClient(_currentProxy);
            try { oldClient?.Dispose(); } catch { }
        }

        public void ApplySettings(AppSettings settings)
        {
            if (settings == null) return;
            MaxConcurrentDownloads = settings.MaxConcurrentDownloads;
            SpeedLimitBytesPerSecond = settings.SpeedLimitKbps * 1024L;
            UpdateProxy(settings.Proxy);
            CheckAndProcessQueue();
        }

        // ------------------------------------------------------------------ tạo tác vụ

        public async Task StartAsync(string taskId, string url, string folder, int threads, bool forceStart = false, string customFileName = null)
        {
            Uri uri;
            if (!Uri.TryCreate(url, UriKind.Absolute, out uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeFtp))
                throw new DownloadException("Chỉ hỗ trợ liên kết HTTP, HTTPS hoặc FTP hợp lệ.");

            if (uri.Scheme == Uri.UriSchemeFtp)
            {
                await StartFtpAsync(taskId, url, folder, customFileName).ConfigureAwait(false);
                return;
            }
            if (string.IsNullOrWhiteSpace(folder))
                throw new DownloadException("Bạn chưa chọn nơi lưu tệp.");
            if (_jobs.ContainsKey(taskId)) return;

            Directory.CreateDirectory(folder);
            threads = Math.Max(1, Math.Min(threads, SegmentPlanner.MaxThreads));

            // Khâu 1: dò thông tin file
            RemoteFileInfo info = await RemoteProbe.InspectAsync(_http, url, CancellationToken.None).ConfigureAwait(false);

            // Đổi tên tệp nếu người dùng chỉ định trước khi tải
            if (!string.IsNullOrWhiteSpace(customFileName))
            {
                string sanitized = SanitizeFileName(customFileName.Trim());
                if (!string.IsNullOrWhiteSpace(sanitized))
                {
                    string userExt = Path.GetExtension(sanitized);
                    string originalExt = Path.GetExtension(info.FileName);
                    if (string.IsNullOrEmpty(userExt) && !string.IsNullOrEmpty(originalExt))
                    {
                        sanitized += originalExt;
                    }
                    info.FileName = sanitized;
                }
            }

            bool ranges = info.SupportsRanges && info.Length > 1;

            // Khâu 2: chọn tên file đích, phát hiện tác vụ dở dang để Resume, chia segment
            List<SegmentMeta> resume;
            string target;
            lock (_targetLock)
            {
                target = ResolveTarget(folder, info, url, ranges, out resume);
                _activeTargets.Add(target);
                if (!File.Exists(target))
                {
                    try
                    {
                        if (resume == null && info.Length > 0) CheckDiskSpace(folder, info.Length);
                        using (File.Create(target)) { }   // giữ chỗ để tác vụ khác không chọn trùng tên
                    }
                    catch
                    {
                        _activeTargets.Remove(target);
                        try { if (File.Exists(target)) File.Delete(target); } catch { }
                        throw;
                    }
                }
            }

            List<Segment> segments;
            if (!ranges)
            {
                segments = new List<Segment>();
            }
            else if (resume != null)
            {
                segments = resume.Select(m =>
                {
                    var s = new Segment(m.Index, m.Start, m.End);
                    s.Restore(m.Downloaded, m.Finished);
                    return s;
                }).ToList();
            }
            else
            {
                segments = SegmentPlanner.Split(info.Length, threads);
            }

            DownloadJob job;
            bool shouldQueue;
            try
            {
                lock (_queueLock)
                {
                    shouldQueue = !forceStart && _maxConcurrentDownloads > 0 && ActiveDownloadingCount >= _maxConcurrentDownloads;
                    job = new DownloadJob(taskId, url, info, target, threads, ranges, segments, _http, _limiter, queued: shouldQueue);
                    job.Changed += OnJobChanged;
                    _jobs[taskId] = job;

                    if (shouldQueue)
                    {
                        if (!_queue.Contains(taskId)) _queue.Add(taskId);
                    }
                }

                if (shouldQueue)
                {
                    Raise(job.Snapshot());
                }
                else
                {
                    job.Start();
                }
            }
            catch
            {
                lock (_targetLock)
                {
                    _activeTargets.Remove(target);
                }
                throw;
            }
        }

        private string ResolveTarget(string folder, RemoteFileInfo info, string url, bool ranges, out List<SegmentMeta> resume)
        {
            resume = null;
            string name = info.FileName;
            string baseName = Path.GetFileNameWithoutExtension(name);
            string ext = Path.GetExtension(name);

            for (int i = 0; ; i++)
            {
                string candidate = Path.Combine(folder, i == 0 ? name : baseName + " (" + i + ")" + ext);

                // 1. Nếu candidate đang được xử lý bởi tác vụ khác trong phiên hiện tại -> bỏ qua để lấy bản sao (1), (2)...
                if (_activeTargets.Contains(candidate) ||
                    _jobs.Values.Any(j => string.Equals(j.TargetPath, candidate, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                // 2. Nếu file trên đĩa đã tồn tại: không ghi đè, tạo bản sao (trừ trường hợp khôi phục file dở dang có .dlmeta hợp lệ)
                if (File.Exists(candidate))
                {
                    if (ranges && File.Exists(MetaStore.PathFor(candidate)))
                    {
                        DownloadMeta meta = MetaStore.Load(candidate);
                        if (meta != null && meta.Segments != null && meta.Segments.Count > 0
                            && MetaMatches(meta, url, info)
                            && new FileInfo(candidate).Length == info.Length)
                        {
                            resume = meta.Segments;
                            return candidate;
                        }
                    }
                    // Tệp đã tồn tại (hoàn thành hoặc không thể resume) -> tạo bản sao mới
                    continue;
                }

                // 3. Nếu file chưa tồn tại cả dữ liệu lẫn meta -> chọn candidate này
                if (!File.Exists(MetaStore.PathFor(candidate)))
                    return candidate;
            }
        }

        private static bool MetaMatches(DownloadMeta meta, string url, RemoteFileInfo info)
        {
            return meta.Url == url
                && meta.TotalBytes == info.Length
                && string.Equals(meta.ETag, info.ETag, StringComparison.Ordinal)
                && Nullable.Equals(meta.LastModified, info.LastModified);
        }

        private static string FormatBytes(long bytes)
        {
            if (bytes <= 0) return "0 B";
            string[] units = { "B", "KB", "MB", "GB", "TB" };
            int i = 0;
            double val = bytes;
            while (val >= 1024 && i < units.Length - 1)
            {
                val /= 1024;
                i++;
            }
            return $"{val:0.##} {units[i]}";
        }

        public static void CheckDiskSpace(string folder, long needed)
        {
            try
            {
                string fullPath = Path.GetFullPath(folder);
                string root = Path.GetPathRoot(fullPath);
                if (string.IsNullOrEmpty(root)) return;

                var targetDrive = new DriveInfo(root);
                if (!targetDrive.IsReady) return;

                long targetFree = targetDrive.AvailableFreeSpace;

                // Nếu ổ đích đủ dung lượng cho tệp -> OK
                if (targetFree >= needed)
                {
                    return;
                }

                // Ổ đích không đủ dung lượng! Kiểm tra tất cả các ổ đĩa khác trên máy
                DriveInfo[] allDrives = DriveInfo.GetDrives();
                var readyDrives = allDrives
                    .Where(d => d.IsReady && (d.DriveType == DriveType.Fixed || d.DriveType == DriveType.Removable))
                    .ToList();

                // Tìm các ổ đĩa khác có đủ dung lượng chứa tệp
                var suitableOtherDrives = readyDrives
                    .Where(d => !string.Equals(d.Name, targetDrive.Name, StringComparison.OrdinalIgnoreCase)
                                && d.AvailableFreeSpace >= needed)
                    .OrderByDescending(d => d.AvailableFreeSpace)
                    .ToList();

                string targetName = targetDrive.Name.TrimEnd('\\');

                // Nếu không có ổ nào đủ dung lượng hoặc tất cả các ổ đều gần đầy
                if (suitableOtherDrives.Count == 0)
                {
                    long totalFreeAll = readyDrives.Sum(d => d.AvailableFreeSpace);
                    string msg = $"Tất cả các ổ đĩa trên thiết bị đều gần đầy hoặc không đủ dung lượng ({FormatBytes(totalFreeAll)} khả dụng toàn máy, tệp cần {FormatBytes(needed)}). Quá trình tải đã tự động bị huỷ để bảo vệ hệ thống!";

                    throw new DiskSpaceException(
                        isAllDrivesFull: true,
                        message: msg,
                        targetDrive: targetName,
                        suggestedDrive: null,
                        targetFreeBytes: targetFree,
                        suggestedFreeBytes: 0,
                        neededBytes: needed
                    );
                }
                else
                {
                    // Ổ hiện tại không đủ, nhưng có ổ khác đủ dung lượng -> Đề xuất đổi sang ổ khác
                    var bestDrive = suitableOtherDrives.First();
                    string bestName = bestDrive.Name.TrimEnd('\\');
                    string bestLabel = string.IsNullOrWhiteSpace(bestDrive.VolumeLabel) ? "" : $" ({bestDrive.VolumeLabel})";

                    string msg = $"Ổ đĩa {targetName} không đủ dung lượng trống ({FormatBytes(targetFree)} còn trống, tệp cần {FormatBytes(needed)}). " +
                                 $"Bạn nên đổi thư mục lưu sang ổ đĩa khác (Đề xuất: Ổ {bestName}{bestLabel} còn trống {FormatBytes(bestDrive.AvailableFreeSpace)})!";

                    throw new DiskSpaceException(
                        isAllDrivesFull: false,
                        message: msg,
                        targetDrive: targetName,
                        suggestedDrive: bestName,
                        targetFreeBytes: targetFree,
                        suggestedFreeBytes: bestDrive.AvailableFreeSpace,
                        neededBytes: needed
                    );
                }
            }
            catch (DiskSpaceException)
            {
                throw;
            }
            catch (Exception ex)
            {
                // Không kiểm tra được (ví dụ ổ mạng UNC) thì bỏ qua
                System.Diagnostics.Debug.WriteLine("CheckDiskSpace: " + ex.Message);
            }
        }

        // ------------------------------------------------------------------ FTP

        public static string SanitizeFileName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return name;
            foreach (char c in Path.GetInvalidFileNameChars())
            {
                name = name.Replace(c, '_');
            }
            return name.Trim();
        }

        private async Task StartFtpAsync(string taskId, string url, string folder, string customFileName = null)
        {
            if (string.IsNullOrWhiteSpace(folder))
                throw new DownloadException("Bạn chưa chọn nơi lưu tệp.");
            if (_ftpJobs.ContainsKey(taskId)) return;

            Directory.CreateDirectory(folder);

            // Dò thông tin file qua FTP
            RemoteFileInfo info = await FtpProbe.InspectAsync(url, CancellationToken.None).ConfigureAwait(false);

            if (!string.IsNullOrWhiteSpace(customFileName))
            {
                string sanitized = SanitizeFileName(customFileName.Trim());
                if (!string.IsNullOrWhiteSpace(sanitized))
                {
                    string userExt = Path.GetExtension(sanitized);
                    string originalExt = Path.GetExtension(info.FileName);
                    if (string.IsNullOrEmpty(userExt) && !string.IsNullOrEmpty(originalExt))
                    {
                        sanitized += originalExt;
                    }
                    info.FileName = sanitized;
                }
            }

            string fileName = info.FileName;

            string target;
            long resumeOffset = 0;
            lock (_targetLock)
            {
                string candidate = Path.Combine(folder, fileName);
                // Kiểm tra resume
                if (File.Exists(candidate) && File.Exists(MetaStore.PathFor(candidate)))
                {
                    var meta = MetaStore.Load(candidate);
                    if (meta != null && meta.Segments != null && meta.Segments.Count > 0
                        && meta.Url == url && meta.TotalBytes == info.Length)
                    {
                        resumeOffset = meta.Segments[0].Downloaded;
                    }
                }
                // Đảm bảo tên độc đáo
                int copy = 0;
                string baseName = Path.GetFileNameWithoutExtension(fileName);
                string ext = Path.GetExtension(fileName);
                target = candidate;
                while (_activeTargets.Contains(target))
                {
                    copy++;
                    target = Path.Combine(folder, baseName + " (" + copy + ")" + ext);
                    resumeOffset = 0;
                }
                if (resumeOffset == 0 && info.Length > 0)
                {
                    CheckDiskSpace(folder, info.Length);
                }
                _activeTargets.Add(target);
            }

            var job = new FtpJob(taskId, url, info.Length, target, _limiter, resumeOffset);
            job.Changed += OnFtpJobChanged;
            _ftpJobs[taskId] = job;
            job.Start();
        }

        private void OnFtpJobChanged(FtpJob job)
        {
            Raise(job.Snapshot());
            if (job.State == DownloadState.Completed ||
                job.State == DownloadState.Failed ||
                job.State == DownloadState.Cancelled ||
                job.State == DownloadState.Paused)
            {
                CheckAndProcessQueue();
            }
        }

        // ------------------------------------------------------------------ điều khiển

        /// <summary>
        /// Tạm dừng tất cả các tác vụ tải đang chạy hoặc đang nằm trong hàng đợi.
        /// </summary>
        public void PauseAll()
        {
            lock (_queueLock)
            {
                _queue.Clear();
            }

            foreach (var job in _jobs.Values)
            {
                if (job.State == DownloadState.Downloading || job.State == DownloadState.Preparing || job.State == DownloadState.Queued)
                {
                    try { job.Pause(); } catch { }
                }
            }

            foreach (var ftpJob in _ftpJobs.Values)
            {
                if (ftpJob.State == DownloadState.Downloading || ftpJob.State == DownloadState.Preparing || ftpJob.State == DownloadState.Queued)
                {
                    try { ftpJob.Pause(); } catch { }
                }
            }
        }

        public void Pause(string taskId)
        {
            lock (_queueLock)
            {
                _queue.Remove(taskId);
            }

            DownloadJob job;
            if (_jobs.TryGetValue(taskId, out job))
            {
                job.Pause();
            }
            FtpJob ftpJob;
            if (_ftpJobs.TryGetValue(taskId, out ftpJob))
            {
                ftpJob.Pause();
            }
            CheckAndProcessQueue();
        }

        public void Resume(string taskId)
        {
            DownloadJob job;
            if (_jobs.TryGetValue(taskId, out job))
            {
                lock (_queueLock)
                {
                    if (_maxConcurrentDownloads > 0 && ActiveDownloadingCount >= _maxConcurrentDownloads)
                    {
                        if (!_queue.Contains(taskId)) _queue.Add(taskId);
                        job.SetQueued();
                        Raise(job.Snapshot());
                        return;
                    }
                }
                job.Start();
                return;
            }
            FtpJob ftpJob;
            if (_ftpJobs.TryGetValue(taskId, out ftpJob))
            {
                ftpJob.Start();
            }
        }

        /// <summary>Bắt đầu ngay một tác vụ đang chờ trong hàng đợi (bỏ qua giới hạn hàng đợi).</summary>
        public void ForceStart(string taskId)
        {
            lock (_queueLock)
            {
                _queue.Remove(taskId);
            }

            DownloadJob job;
            if (_jobs.TryGetValue(taskId, out job))
            {
                job.Start();
            }
        }

        public void StartAllQueued()
        {
            lock (_queueLock)
            {
                var queuedList = _queue.ToList();
                _queue.Clear();
                foreach (var taskId in queuedList)
                {
                    DownloadJob job;
                    if (_jobs.TryGetValue(taskId, out job) && job.State == DownloadState.Queued)
                    {
                        job.Start();
                    }
                }
            }
            CheckAndProcessQueue();
        }

        public void CheckAndProcessQueue()
        {
            lock (_queueLock)
            {
                while (_maxConcurrentDownloads <= 0 || ActiveDownloadingCount < _maxConcurrentDownloads)
                {
                    if (_queue.Count == 0) break;
                    string nextTaskId = _queue[0];
                    _queue.RemoveAt(0);

                    DownloadJob nextJob;
                    if (_jobs.TryGetValue(nextTaskId, out nextJob) && nextJob.State == DownloadState.Queued)
                    {
                        nextJob.Start();
                    }
                }
            }

            int queuedCount;
            lock (_queueLock) { queuedCount = _queue.Count; }
            int active = ActiveDownloadingCount;
            if (active > 0)
            {
                _wasDownloading = true;
                PowerManagementHelper.PreventSleep();
            }
            else
            {
                PowerManagementHelper.AllowSleep();
                if (_wasDownloading && queuedCount == 0)
                {
                    _wasDownloading = false;
                    try { AllDownloadsCompleted?.Invoke(); } catch { }
                }
            }

        }

        /// <summary>Hủy tác vụ tải: dừng luồng, xóa file dở dang và .dlmeta.</summary>
        public async Task CancelAsync(string taskId)
        {
            lock (_queueLock) { _queue.Remove(taskId); }

            DownloadJob job;
            if (_jobs.TryGetValue(taskId, out job))
            {
                job.Changed -= OnJobChanged;
                lock (_targetLock) { _activeTargets.Remove(job.TargetPath); }
                await job.CancelAsync().ConfigureAwait(false);
            }
            FtpJob ftpJob;
            if (_ftpJobs.TryGetValue(taskId, out ftpJob))
            {
                ftpJob.Changed -= OnFtpJobChanged;
                lock (_targetLock) { _activeTargets.Remove(ftpJob.TargetPath); }
                await ftpJob.CancelAsync().ConfigureAwait(false);
            }

            CheckAndProcessQueue();
        }

        /// <summary>Gỡ tác vụ. Chưa xong -> xóa file dở; đã xong -> giữ file.</summary>
        public async Task RemoveAsync(string taskId)
        {
            lock (_queueLock) { _queue.Remove(taskId); }

            DownloadJob job;
            if (_jobs.TryRemove(taskId, out job))
            {
                job.Changed -= OnJobChanged;
                lock (_targetLock) { _activeTargets.Remove(job.TargetPath); }
                await job.CancelAsync().ConfigureAwait(false);
            }
            FtpJob ftpJob;
            if (_ftpJobs.TryRemove(taskId, out ftpJob))
            {
                ftpJob.Changed -= OnFtpJobChanged;
                lock (_targetLock) { _activeTargets.Remove(ftpJob.TargetPath); }
                await ftpJob.CancelAsync().ConfigureAwait(false);
            }

            CheckAndProcessQueue();
        }


        /// <summary>Kiểm tra xem tác vụ có đang tồn tại trong bộ nhớ không.</summary>
        public bool HasJob(string taskId)
        {
            if (string.IsNullOrEmpty(taskId)) return false;
            return _jobs.ContainsKey(taskId) || _ftpJobs.ContainsKey(taskId);
        }

        /// <summary>Lấy đường dẫn tệp đích của tác vụ theo taskId.</summary>
        public string GetTargetPath(string taskId)
        {
            DownloadJob job;
            if (_jobs.TryGetValue(taskId, out job)) return job.TargetPath;
            FtpJob ftpJob;
            if (_ftpJobs.TryGetValue(taskId, out ftpJob)) return ftpJob.TargetPath;
            return null;
        }

        public void Shutdown()
        {
            if (_disposed) return;
            _disposed = true;
            _timer.Dispose();
            foreach (DownloadJob job in _jobs.Values) job.Shutdown();
            foreach (FtpJob job in _ftpJobs.Values) job.Shutdown();
            _http.Dispose();
            PowerManagementHelper.AllowSleep();
        }

        public void Dispose()
        {
            Shutdown();
        }

        // ------------------------------------------------------------------ phát tiến độ

        private void OnJobChanged(DownloadJob job)
        {
            Raise(job.Snapshot());

            if (job.State == DownloadState.Completed ||
                job.State == DownloadState.Failed ||
                job.State == DownloadState.Cancelled ||
                job.State == DownloadState.Paused)
            {
                CheckAndProcessQueue();
            }
        }

        private void OnTick(object state)
        {
            if (Interlocked.Exchange(ref _tickBusy, 1) == 1) return;
            try
            {
                bool saveMeta = (++_tickCount % 5) == 0;
                foreach (DownloadJob job in _jobs.Values)
                {
                    if (job.State != DownloadState.Downloading) continue;
                    job.UpdateSpeed();
                    if (saveMeta) job.SaveMetaSafe();
                    Raise(job.Snapshot());
                }
                foreach (FtpJob job in _ftpJobs.Values)
                {
                    if (job.State != DownloadState.Downloading) continue;
                    job.UpdateSpeed();
                    Raise(job.Snapshot());
                }
            }
            catch { }
            finally
            {
                Interlocked.Exchange(ref _tickBusy, 0);
            }
        }

        private void Raise(ProgressDto dto)
        {
            Action<ProgressDto> handler = ProgressChanged;
            if (handler == null) return;
            try { handler(dto); } catch { }
        }

        /// <summary>
        /// Thu thập số liệu hiệu năng tổng hợp (tốc độ tổng, số luồng active, số tệp đang tải)
        /// phục vụ vẽ biểu đồ giám sát thời gian thực.
        /// </summary>
        public void GetAggregateMetrics(out double totalSpeed, out int activeThreads, out int activeJobs, out long totalDownloaded)
        {
            totalSpeed = 0;
            activeThreads = 0;
            activeJobs = 0;
            totalDownloaded = 0;

            foreach (DownloadJob job in _jobs.Values)
            {
                totalDownloaded += job.Downloaded;
                if (job.State == DownloadState.Downloading)
                {
                    job.UpdateSpeed();
                    totalSpeed += job.CurrentSpeed;
                    int th = (job.SupportsRanges && job.Segments != null && job.Segments.Count > 0)
                        ? job.Segments.Count
                        : 1;
                    activeThreads += th;
                    activeJobs++;
                }
            }

            foreach (FtpJob job in _ftpJobs.Values)
            {
                totalDownloaded += job.Downloaded;
                if (job.State == DownloadState.Downloading)
                {
                    job.UpdateSpeed();
                    totalSpeed += job.CurrentSpeed;
                    activeThreads += 1;
                    activeJobs++;
                }
            }
        }
    }
}
