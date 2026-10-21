using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Tác vụ tải FTP: dùng FtpWebRequest + ContentOffset để resume.
    /// Luôn chạy đơn luồng (FTP không hỗ trợ Range song song).
    /// </summary>
    public sealed class FtpJob
    {
        private const int BufferSize = 81920;
        private const int MaxRetries = 5;
        public static int StallTimeoutMs = 30000;

        private readonly SpeedLimiter _limiter;
        private readonly object _sync = new object();
        private readonly object _metaLock = new object();
        private readonly Stopwatch _activeStopwatch = new Stopwatch();

        private CancellationTokenSource _cts;
        private Task _runTask = Task.CompletedTask;
        private long _downloaded;
        private double _speed;
        private long _lastTicks;
        private long _lastBytes;
        private string _firstError;

        public FtpJob(string id, string url, long totalBytes, string targetPath,
                      SpeedLimiter limiter, long resumeOffset = 0)
        {
            Id = id;
            Url = url;
            TotalBytes = totalBytes;
            TargetPath = targetPath;
            _limiter = limiter;
            _downloaded = resumeOffset;
            State = DownloadState.Preparing;
        }

        public string Id { get; }
        public string Url { get; }
        public long TotalBytes { get; private set; }
        public string TargetPath { get; }
        public DownloadState State { get; private set; }
        public string Error { get; private set; }
        public string FileHash { get; private set; }
        public long Downloaded => Interlocked.Read(ref _downloaded);

        public event Action<FtpJob> Changed;

        // ------------------------------------------------------------------ điều khiển

        public void Start()
        {
            lock (_sync)
            {
                if (State == DownloadState.Downloading || State == DownloadState.Completed || State == DownloadState.Cancelled)
                    return;

                _cts = new CancellationTokenSource();
                CancellationToken ct = _cts.Token;
                Task previous = _runTask;

                Error = null;
                _firstError = null;
                State = DownloadState.Downloading;
                _activeStopwatch.Start();
                ResetSpeed();

                _runTask = Task.Run(async () =>
                {
                    try { await previous.ConfigureAwait(false); } catch { }
                    await RunAsync(ct).ConfigureAwait(false);
                });
            }
            RaiseChanged();
        }

        public void Pause()
        {
            lock (_sync)
            {
                if (State != DownloadState.Downloading) return;
                State = DownloadState.Paused;
                _speed = 0;
                _activeStopwatch.Stop();
                if (_cts != null) _cts.Cancel();
            }
            RaiseChanged();
        }

        public async Task CancelAsync()
        {
            bool wasCompleted;
            CancellationTokenSource cts;
            lock (_sync)
            {
                wasCompleted = State == DownloadState.Completed;
                if (!wasCompleted) State = DownloadState.Cancelled;
                _activeStopwatch.Stop();
                cts = _cts;
            }
            if (wasCompleted) return;

            try { if (cts != null) cts.Cancel(); } catch (ObjectDisposedException) { }
            try { await _runTask.ConfigureAwait(false); } catch { }

            lock (_metaLock)
            {
                try { if (File.Exists(TargetPath)) File.Delete(TargetPath); } catch { }
                MetaStore.Delete(TargetPath);
            }
            RaiseChanged();
        }

        public void Shutdown()
        {
            Pause();
            try { _runTask.Wait(2000); } catch { }
            SaveFtpResumeMeta();
        }

        // ------------------------------------------------------------------ vòng chạy chính

        private async Task RunAsync(CancellationToken ct)
        {
            try
            {
                await DownloadWithRetryAsync(ct).ConfigureAwait(false);
                ct.ThrowIfCancellationRequested();

                // Tính SHA-256 sau khi tải xong
                FileHash = await Task.Run(() => ChecksumHelper.ComputeSha256(TargetPath), ct).ConfigureAwait(false);

                lock (_sync)
                {
                    State = DownloadState.Completed;
                    _speed = 0;
                    _activeStopwatch.Stop();
                }
                lock (_metaLock) { MetaStore.Delete(TargetPath); }
            }
            catch (Exception ex)
            {
                lock (_sync) { _activeStopwatch.Stop(); }
                if (ct.IsCancellationRequested)
                {
                    SaveFtpResumeMeta();
                    return;
                }
                lock (_sync)
                {
                    State = DownloadState.Failed;
                    Error = ex.Message;
                    _speed = 0;
                }
                SaveFtpResumeMeta();
            }
            RaiseChanged();
        }

        private async Task DownloadWithRetryAsync(CancellationToken ct)
        {
            int attempt = 0;
            while (true)
            {
                long before = Downloaded;
                try
                {
                    await DownloadOnceAsync(ct).ConfigureAwait(false);
                    return;
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception)
                {
                    if (Downloaded > before) attempt = 0;
                    attempt++;
                    if (attempt > MaxRetries) throw;
                    int delay = Math.Min(1000 * (1 << (attempt - 1)), 15000);
                    await Task.Delay(delay, ct).ConfigureAwait(false);
                }
            }
        }

        private async Task DownloadOnceAsync(CancellationToken ct)
        {
            long offset = Downloaded; // Resume từ byte đã tải
            var req = (FtpWebRequest)WebRequest.Create(Url);
            req.Method = WebRequestMethods.Ftp.DownloadFile;
            req.UseBinary = true;
            req.UsePassive = true;
            req.KeepAlive = false;
            req.Timeout = 30000;
            req.ContentOffset = offset; // Lệnh REST – resume

            FtpWebResponse resp = null;
            try
            {
                resp = await Task.Factory.FromAsync(req.BeginGetResponse, req.EndGetResponse, null)
                                 .ContinueWith(t => (FtpWebResponse)t.Result, ct)
                                 .ConfigureAwait(false);

                // Cập nhật tổng kích thước nếu chưa biết
                if (TotalBytes <= 0 && resp.ContentLength > 0)
                    TotalBytes = resp.ContentLength + offset;

                FileMode mode = offset > 0 ? FileMode.OpenOrCreate : FileMode.Create;
                using (var fs = new FileStream(TargetPath, mode, FileAccess.Write, FileShare.Read, 1, true))
                {
                    if (offset > 0) fs.Seek(offset, SeekOrigin.Begin);
                    await PumpAsync(resp.GetResponseStream(), fs, ct).ConfigureAwait(false);
                }
            }
            finally
            {
                resp?.Close();
            }
        }

        private async Task PumpAsync(Stream net, Stream dest, CancellationToken ct)
        {
            var buffer = new byte[BufferSize];
            using (var stall = CancellationTokenSource.CreateLinkedTokenSource(ct))
            {
                try
                {
                    while (true)
                    {
                        stall.CancelAfter(StallTimeoutMs);
                        int n = await net.ReadAsync(buffer, 0, buffer.Length, stall.Token).ConfigureAwait(false);
                        stall.CancelAfter(Timeout.Infinite);
                        if (n == 0) break;

                        if (_limiter != null) await _limiter.WaitAsync(n, ct).ConfigureAwait(false);
                        await dest.WriteAsync(buffer, 0, n, ct).ConfigureAwait(false);

                        Interlocked.Add(ref _downloaded, n);
                    }
                }
                catch (Exception) when (ct.IsCancellationRequested)
                {
                    throw new OperationCanceledException(ct);
                }
                catch (Exception) when (stall.IsCancellationRequested)
                {
                    throw new TimeoutException("Máy chủ FTP không gửi dữ liệu trong " + (StallTimeoutMs / 1000) + " giây.");
                }
            }
        }

        // ------------------------------------------------------------------ resume meta

        private void SaveFtpResumeMeta()
        {
            if (Downloaded <= 0) return;
            lock (_metaLock)
            {
                if (State == DownloadState.Completed || State == DownloadState.Cancelled) return;
                try
                {
                    // Dùng lại DownloadMeta với 1 segment giả: start=0, downloaded=đã tải
                    var meta = new DownloadMeta
                    {
                        Url = Url,
                        RemoteUrl = Url,
                        TotalBytes = TotalBytes,
                        Threads = 1,
                        Segments = new System.Collections.Generic.List<SegmentMeta>
                        {
                            new SegmentMeta
                            {
                                Index = 0,
                                Start = 0,
                                End = TotalBytes - 1,
                                Downloaded = Downloaded,
                                Finished = false
                            }
                        }
                    };
                    MetaStore.Save(TargetPath, meta);
                }
                catch { }
            }
        }

        // ------------------------------------------------------------------ tốc độ + snapshot

        private void ResetSpeed()
        {
            _speed = 0;
            _lastTicks = Stopwatch.GetTimestamp();
            _lastBytes = Downloaded;
        }

        public void UpdateSpeed()
        {
            long now = Stopwatch.GetTimestamp();
            long bytes = Downloaded;
            double dt = (now - _lastTicks) / (double)Stopwatch.Frequency;
            if (dt < 0.2) return;

            double instant = (bytes - _lastBytes) / dt;
            _speed = _speed <= 0 ? instant : 0.7 * _speed + 0.3 * instant;
            _lastTicks = now;
            _lastBytes = bytes;
        }

        public ProgressDto Snapshot()
        {
            long done = Downloaded;
            DownloadState state = State;
            double speed = state == DownloadState.Downloading ? _speed : 0;
            long eta = (speed > 1 && TotalBytes > 0) ? (long)((TotalBytes - done) / speed) : -1;

            return new ProgressDto
            {
                TaskId = Id,
                State = state.ToString().ToLowerInvariant(),
                FileName = Path.GetFileName(TargetPath),
                TargetPath = TargetPath,
                TotalBytes = TotalBytes,
                Downloaded = done,
                Speed = speed,
                EtaSeconds = eta,
                ElapsedSeconds = _activeStopwatch.Elapsed.TotalSeconds,
                Threads = 1,
                SupportsRanges = false,
                Error = Error,
                FileHash = FileHash,
                Segments = new System.Collections.Generic.List<SegmentDto>()
            };
        }

        private void RaiseChanged()
        {
            Action<FtpJob> handler = Changed;
            if (handler == null) return;
            try { handler(this); } catch { }
        }
    }
}
