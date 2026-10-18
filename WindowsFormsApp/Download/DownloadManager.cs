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
        private readonly HttpClient _http;
        private readonly SpeedLimiter _limiter = new SpeedLimiter();
        private readonly ConcurrentDictionary<string, DownloadJob> _jobs = new ConcurrentDictionary<string, DownloadJob>();
        private readonly object _targetLock = new object();
        private readonly System.Threading.Timer _timer;
        private int _tickBusy;
        private int _tickCount;
        private bool _disposed;

        public event Action<ProgressDto> ProgressChanged;

        public DownloadManager()
        {
            var handler = new HttpClientHandler
            {
                AllowAutoRedirect = true,
                MaxAutomaticRedirections = 8,
                // Phải tắt nén: nếu server nén gzip thì offset byte của Range không còn khớp
                AutomaticDecompression = DecompressionMethods.None
            };
            try { handler.MaxConnectionsPerServer = 64; } catch { }

            _http = new HttpClient(handler);
            _http.Timeout = Timeout.InfiniteTimeSpan; // timeout được kiểm soát riêng cho từng request/luồng đọc
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("DUTDownloadAccelerator/1.0 (Windows)");
            _http.DefaultRequestHeaders.AcceptEncoding.Add(new StringWithQualityHeaderValue("identity"));

            _timer = new System.Threading.Timer(OnTick, null, 400, 400);
        }

        public long SpeedLimitBytesPerSecond
        {
            get { return _limiter.BytesPerSecond; }
            set { _limiter.BytesPerSecond = value; }
        }

        // ------------------------------------------------------------------ tạo tác vụ

        public async Task StartAsync(string taskId, string url, string folder, int threads)
        {
            Uri uri;
            if (!Uri.TryCreate(url, UriKind.Absolute, out uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                throw new DownloadException("Chỉ hỗ trợ liên kết HTTP/HTTPS hợp lệ.");
            if (string.IsNullOrWhiteSpace(folder))
                throw new DownloadException("Bạn chưa chọn nơi lưu tệp.");
            if (_jobs.ContainsKey(taskId)) return;

            Directory.CreateDirectory(folder);
            threads = Math.Max(1, Math.Min(threads, SegmentPlanner.MaxThreads));

            // Khâu 1: dò thông tin file
            RemoteFileInfo info = await RemoteProbe.InspectAsync(_http, url, CancellationToken.None).ConfigureAwait(false);
            bool ranges = info.SupportsRanges && info.Length > 1;

            // Khâu 2: chọn tên file đích, phát hiện tác vụ dở dang để Resume, chia segment
            List<SegmentMeta> resume;
            string target;
            lock (_targetLock)
            {
                target = ResolveTarget(folder, info, url, ranges, out resume);
                if (!File.Exists(target))
                {
                    try
                    {
                        if (resume == null && info.Length > 0) CheckDiskSpace(folder, info.Length);
                        using (File.Create(target)) { }   // giữ chỗ để tác vụ khác không chọn trùng tên
                    }
                    catch
                    {
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

            var job = new DownloadJob(taskId, url, info, target, threads, ranges, segments, _http, _limiter);
            job.Changed += OnJobChanged;
            _jobs[taskId] = job;
            job.Start();
        }

        private static string ResolveTarget(string folder, RemoteFileInfo info, string url, bool ranges, out List<SegmentMeta> resume)
        {
            resume = null;
            string name = info.FileName;
            string baseName = Path.GetFileNameWithoutExtension(name);
            string ext = Path.GetExtension(name);

            for (int i = 0; ; i++)
            {
                string candidate = Path.Combine(folder, i == 0 ? name : baseName + " (" + i + ")" + ext);

                // Có meta khớp URL + kích thước + ETag + file đúng độ dài -> tiếp tục tải dở
                if (ranges && File.Exists(candidate) && File.Exists(MetaStore.PathFor(candidate)))
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

                if (!File.Exists(candidate) && !File.Exists(MetaStore.PathFor(candidate)))
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

        private static void CheckDiskSpace(string folder, long needed)
        {
            try
            {
                string root = Path.GetPathRoot(Path.GetFullPath(folder));
                var drive = new DriveInfo(root);
                if (drive.AvailableFreeSpace < needed)
                    throw new DownloadException("Ổ đĩa không đủ dung lượng trống cho tệp này.");
            }
            catch (DownloadException)
            {
                throw;
            }
            catch
            {
                // Không kiểm tra được (ví dụ ổ mạng UNC) thì bỏ qua
            }
        }

        // ------------------------------------------------------------------ điều khiển

        public void Pause(string taskId)
        {
            DownloadJob job;
            if (_jobs.TryGetValue(taskId, out job)) job.Pause();
        }

        public void Resume(string taskId)
        {
            DownloadJob job;
            if (_jobs.TryGetValue(taskId, out job)) job.Start();
        }

        /// <summary>Gỡ tác vụ. Chưa xong -> xóa file dở; đã xong -> giữ file.</summary>
        public async Task RemoveAsync(string taskId)
        {
            DownloadJob job;
            if (_jobs.TryRemove(taskId, out job)) await job.CancelAsync().ConfigureAwait(false);
        }

        public void Shutdown()
        {
            if (_disposed) return;
            _disposed = true;
            _timer.Dispose();
            foreach (DownloadJob job in _jobs.Values) job.Shutdown();
            _http.Dispose();
        }

        public void Dispose()
        {
            Shutdown();
        }

        // ------------------------------------------------------------------ phát tiến độ

        private void OnJobChanged(DownloadJob job)
        {
            Raise(job.Snapshot());
        }

        private void OnTick(object state)
        {
            if (Interlocked.Exchange(ref _tickBusy, 1) == 1) return;
            try
            {
                bool saveMeta = (++_tickCount % 5) == 0; // 400 ms x 5 = 2 giây lưu metadata một lần
                foreach (DownloadJob job in _jobs.Values)
                {
                    if (job.State != DownloadState.Downloading) continue;
                    job.UpdateSpeed();
                    if (saveMeta) job.SaveMetaSafe();
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
    }
}
