using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Một tác vụ tải. Gồm các khâu:
    ///   Khâu 3  RunMultiSegmentAsync  : mỗi Segment một Task (đa luồng), ghi vào đúng offset của file đích
    ///   Khâu 4  Pause/Start/CancelAsync: dừng, tiếp tục, hủy
    ///   Khâu 5  VerifyIntegrity        : kiểm tra toàn vẹn khi hoàn tất
    ///   Khâu 6  SaveMetaSafe           : lưu tiến độ để Resume kể cả sau khi tắt app
    /// </summary>
    public sealed class DownloadJob
    {
        private const int BufferSize = 81920;
        private const int MaxRetries = 5;

        // public static để có thể chỉnh khi kiểm thử (ví dụ đặt 5000 để thấy phát hiện treo nhanh hơn)
        public static int StallTimeoutMs = 30000;   // 30 s không nhận được byte nào -> coi là treo
        public static int HeaderTimeoutMs = 30000;  // chờ server trả header

        private readonly HttpClient _http;
        private readonly SpeedLimiter _limiter;
        private readonly object _sync = new object();
        private readonly object _metaLock = new object();
        private readonly object _segmentsLock = new object();
        private readonly HashSet<Segment> _activeSegments = new HashSet<Segment>();
        private readonly SemaphoreSlim _workSignal = new SemaphoreSlim(0, int.MaxValue);
        private readonly Stopwatch _activeStopwatch = new Stopwatch();

        private CancellationTokenSource _cts;
        private Task _runTask = Task.CompletedTask;
        private Exception _firstError;
        private long _downloaded;

        private long _lastTicks;
        private long _lastBytes;
        private double _speed;

        public DownloadJob(string id, string sourceUrl, RemoteFileInfo info, string targetPath,
                           int requestedThreads, bool supportsRanges, List<Segment> segments,
                           HttpClient http, SpeedLimiter limiter, bool queued = false)
        {
            Id = id;
            SourceUrl = sourceUrl;
            RemoteUrl = info.Url;
            TargetPath = targetPath;
            TotalBytes = info.Length;
            ETag = info.ETag;
            LastModified = info.LastModified;
            RequestedThreads = requestedThreads;
            SupportsRanges = supportsRanges;
            Segments = segments;
            _http = http;
            _limiter = limiter;
            State = queued ? DownloadState.Queued : DownloadState.Preparing;

            _downloaded = segments.Sum(s => s.Downloaded);
        }

        public string Id { get; }
        public string SourceUrl { get; }
        public string RemoteUrl { get; }
        public string TargetPath { get; }
        public long TotalBytes { get; private set; }
        public string ETag { get; }
        public DateTimeOffset? LastModified { get; }
        public int RequestedThreads { get; }
        public bool SupportsRanges { get; }
        public List<Segment> Segments { get; }
        public DownloadState State { get; private set; }
        public string Error { get; private set; }
        public string FileHash { get; private set; }  // SHA-256 hex sau khi hoàn thành
        public string VirusScanStatus { get; private set; } // safe | threat | error | scanning | not_available
        public string VirusScanResult { get; private set; }
        public long Downloaded => Interlocked.Read(ref _downloaded);
        public double CurrentSpeed => State == DownloadState.Downloading ? _speed : 0;

        public event Action<DownloadJob> Changed;

        // ------------------------------------------------------------------ điều khiển

        /// <summary>Bắt đầu hoặc tiếp tục (từ Paused/Failed/Preparing/Queued).</summary>
        public void Start()
        {
            lock (_sync)
            {
                if (State == DownloadState.Downloading || State == DownloadState.Completed || State == DownloadState.Cancelled)
                    return;

                _cts = new CancellationTokenSource();
                CancellationToken ct = _cts.Token;
                Task previous = _runTask;

                _firstError = null;
                Error = null;
                State = DownloadState.Downloading;
                _activeStopwatch.Start();
                ResetSpeed();

                _runTask = Task.Run(async () =>
                {
                    // Nếu lần chạy trước (vừa bị Pause) chưa kịp thoát thì chờ nó xong,
                    // tránh hai lần chạy cùng ghi một file.
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
                if (State != DownloadState.Downloading && State != DownloadState.Queued) return;
                State = DownloadState.Paused;
                _speed = 0;
                _activeStopwatch.Stop();
                if (_cts != null) _cts.Cancel();
            }
            RaiseChanged();
        }

        public void SetQueued()
        {
            lock (_sync)
            {
                if (State == DownloadState.Completed || State == DownloadState.Cancelled) return;
                State = DownloadState.Queued;
                _speed = 0;
                _activeStopwatch.Stop();
                if (_cts != null)
                {
                    try { _cts.Cancel(); } catch { }
                }
            }
            RaiseChanged();
        }

        /// <summary>Hủy: dừng, xóa file dở và metadata. Với tác vụ đã Completed chỉ gỡ khỏi danh sách (giữ file).</summary>
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

        /// <summary>Gọi khi đóng ứng dụng: dừng và lưu tiến độ đồng bộ để lần sau Resume được.</summary>
        public void Shutdown()
        {
            Pause();
            try { _runTask.Wait(2000); } catch { }
            SaveMetaSafe();
        }

        // ------------------------------------------------------------------ vòng chạy chính

        private async Task RunAsync(CancellationToken ct)
        {
            try
            {
                if (SupportsRanges) await RunMultiSegmentAsync(ct).ConfigureAwait(false);
                else await RunSingleStreamAsync(ct).ConfigureAwait(false);

                ct.ThrowIfCancellationRequested();

                // Tính SHA-256 trong Task.Run để không block luồng giao diện
                string hash = await Task.Run(() => ChecksumHelper.ComputeSha256(TargetPath), ct).ConfigureAwait(false);
                FileHash = hash;

                lock (_sync)
                {
                    State = DownloadState.Completed;
                    _speed = 0;
                    _activeStopwatch.Stop();
                    VirusScanStatus = "scanning";
                    VirusScanResult = "Đang quét mã độc qua Windows Defender...";
                }
                lock (_metaLock) { MetaStore.Delete(TargetPath); }
                RaiseChanged();

                // Tự động quét mã độc qua Windows Defender ngay sau khi verify SHA-256
                try
                {
                    var scan = await AntivirusScanner.ScanFileAsync(TargetPath, ct).ConfigureAwait(false);
                    lock (_sync)
                    {
                        VirusScanStatus = scan.Status;
                        VirusScanResult = scan.Message;
                    }
                }
                catch (Exception scanEx)
                {
                    lock (_sync)
                    {
                        VirusScanStatus = "error";
                        VirusScanResult = "Lỗi khi quét virus: " + scanEx.Message;
                    }
                }
            }
            catch (Exception ex)
            {
                lock (_sync) { _activeStopwatch.Stop(); }
                if (ct.IsCancellationRequested)
                {
                    // Pause hoặc Cancel: trạng thái đã được đặt bởi Pause()/CancelAsync()
                    SaveMetaSafe();
                    return;
                }
                Exception real = _firstError ?? ex;
                lock (_sync)
                {
                    State = DownloadState.Failed;
                    Error = Describe(real);
                    _speed = 0;
                }
                SaveMetaSafe();
            }
            RaiseChanged();
        }

        // ------------------------------------------------------------------ khâu 3: đa luồng theo Range & Chia nhỏ động (Dynamic Segment Splitting / IDM)

        private async Task RunMultiSegmentAsync(CancellationToken ct)
        {
            EnsureTargetFile();

            using (var failCts = CancellationTokenSource.CreateLinkedTokenSource(ct))
            {
                lock (_segmentsLock)
                {
                    _activeSegments.Clear();
                }

                int workerCount = Math.Max(1, Math.Min(RequestedThreads, Segments.Count));
                var workerTasks = new List<Task>(workerCount);

                for (int i = 0; i < workerCount; i++)
                {
                    int workerId = i + 1;
                    workerTasks.Add(RunWorkerLoopAsync(workerId, failCts));
                }

                await Task.WhenAll(workerTasks).ConfigureAwait(false);
            }

            VerifyIntegrity();
        }

        /// <summary>Tạo file đích có đúng kích thước cuối cùng để mọi luồng Seek + ghi song song vào đúng chỗ.</summary>
        private void EnsureTargetFile()
        {
            using (var fs = new FileStream(TargetPath, FileMode.OpenOrCreate, FileAccess.Write, FileShare.ReadWrite))
            {
                if (fs.Length != TotalBytes) fs.SetLength(TotalBytes);
            }
        }

        /// <summary>
        /// Vòng lặp Worker theo cơ chế Work Stealing / Dynamic Segment Splitting:
        /// 1. Ưu tiên nhận phân đoạn chưa chạy.
        /// 2. Khi hết phân đoạn rảnh, tìm phân đoạn dở dang dài nhất để cắt đôi (TrySplit).
        /// 3. Luôn giữ tối đa băng thông liên tục cho đến byte cuối cùng.
        /// </summary>
        private async Task RunWorkerLoopAsync(int workerId, CancellationTokenSource failCts)
        {
            var ct = failCts.Token;
            while (!ct.IsCancellationRequested)
            {
                Segment seg = null;

                lock (_segmentsLock)
                {
                    // 1. Kiểm tra nếu tất cả phân đoạn đã hoàn tất -> kết thúc worker
                    if (Segments.All(s => s.Finished))
                    {
                        break;
                    }

                    // 2. Ưu tiên 1: Nhận phân đoạn chưa hoàn thành và chưa được luồng nào tải
                    seg = Segments.FirstOrDefault(s => !s.Finished && !_activeSegments.Contains(s));

                    // 3. Ưu tiên 2: Cắt đôi phân đoạn động (Dynamic Segment Splitting / Work Stealing kiểu IDM)
                    if (seg == null && Segments.Count < RequestedThreads)
                    {
                        Segment longest = null;
                        long maxRemaining = 0;

                        foreach (var s in Segments)
                        {
                            if (s.Finished) continue;
                            long rem = s.Remaining;
                            if (rem > maxRemaining)
                            {
                                maxRemaining = rem;
                                longest = s;
                            }
                        }

                        if (longest != null && maxRemaining >= SegmentPlanner.MinSplitSize)
                        {
                            int newIndex = Segments.Count;
                            if (longest.TrySplit(newIndex, SegmentPlanner.MinSplitSize, out Segment newSeg))
                            {
                                Segments.Add(newSeg);
                                seg = newSeg;
                            }
                        }
                    }

                    if (seg != null)
                    {
                        _activeSegments.Add(seg);
                    }
                }

                if (seg != null)
                {
                    try
                    {
                        await DownloadSegmentWithRetryAsync(seg, ct).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        Interlocked.CompareExchange(ref _firstError, ex, null);
                        failCts.Cancel(); // một đoạn lỗi hẳn -> dừng các đoạn còn lại
                        throw;
                    }
                    finally
                    {
                        lock (_segmentsLock)
                        {
                            _activeSegments.Remove(seg);
                        }
                        try { _workSignal.Release(); } catch { }
                        SaveMetaSafe();
                        RaiseChanged();
                    }
                }
                else
                {
                    // Chưa có việc để nhận hoặc phân tách
                    lock (_segmentsLock)
                    {
                        if (Segments.All(s => s.Finished))
                        {
                            break;
                        }
                    }

                    // Chờ tín hiệu từ các worker khác hoặc timeout 250ms
                    try
                    {
                        await _workSignal.WaitAsync(250, ct).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                }
            }
        }

        private async Task DownloadSegmentWithRetryAsync(Segment seg, CancellationToken ct)
        {
            int attempt = 0;
            while (true)
            {
                long before = seg.Downloaded;
                try
                {
                    await DownloadSegmentOnceAsync(seg, ct).ConfigureAwait(false);
                    return;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    if (seg.Downloaded > before) attempt = 0; // có tiến triển thì đếm lại số lần thử
                    attempt++;
                    if (IsFatal(ex) || attempt > MaxRetries) throw;

                    // Backoff lũy thừa: 1s, 2s, 4s, 8s, 15s. Lần thử sau tiếp tục từ byte đã ghi (NextByte).
                    int delay = Math.Min(1000 * (1 << (attempt - 1)), 15000);
                    await Task.Delay(delay, ct).ConfigureAwait(false);
                }
            }
        }

        private async Task DownloadSegmentOnceAsync(Segment seg, CancellationToken ct)
        {
            long start = seg.NextByte;
            long end = seg.End;
            if (start > end)
            {
                seg.Finished = true;
                return;
            }

            var req = new HttpRequestMessage(HttpMethod.Get, RemoteUrl);
            req.Headers.Range = new RangeHeaderValue(start, end);
            ApplyIfRange(req);

            using (HttpResponseMessage resp = await SendAsync(req, ct).ConfigureAwait(false))
            {
                ValidateRangeResponse(resp, start, end);

                // bufferSize = 1 -> không đệm trong FileStream: byte nào đã tính vào Downloaded
                // thì chắc chắn đã giao cho hệ điều hành, an toàn khi Resume sau crash.
                using (var fs = new FileStream(TargetPath, FileMode.Open, FileAccess.Write, FileShare.ReadWrite, 1, true))
                {
                    fs.Seek(start, SeekOrigin.Begin);
                    long got = await PumpAsync(resp, fs, seg, ct).ConfigureAwait(false);
                }
            }

            // Kiểm tra xem phân đoạn đã tải đủ đến End chưa (End có thể đã bị thu nhỏ do TrySplit)
            if (seg.NextByte > seg.End)
            {
                seg.Finished = true;
            }
            else
            {
                throw new IOException("Kết nối bị đóng sớm khi tải phân đoạn #" + seg.Index + " (" + seg.Downloaded + "/" + seg.Length + " byte).");
            }
        }

        private void ApplyIfRange(HttpRequestMessage req)
        {
            // If-Range: nếu file trên server đã đổi, server trả 200 (cả file) thay vì 206
            // -> ta phát hiện được và không ghép nhầm dữ liệu của hai phiên bản file.
            if (!string.IsNullOrEmpty(ETag))
                req.Headers.IfRange = new RangeConditionHeaderValue(new EntityTagHeaderValue(ETag));
            else if (LastModified.HasValue)
                req.Headers.IfRange = new RangeConditionHeaderValue(LastModified.Value);
        }

        private void ValidateRangeResponse(HttpResponseMessage resp, long start, long end)
        {
            int code = (int)resp.StatusCode;
            if (code == 200)
                throw new DownloadException("Máy chủ trả về toàn bộ tệp (HTTP 200) thay vì một phân đoạn: tệp đã thay đổi hoặc server không hỗ trợ Range.");
            if (code != 206)
            {
                if (code == 408 || code == 429 || code >= 500)
                    throw new HttpRequestException("Máy chủ trả về lỗi HTTP " + code + " (có thể thử lại).");
                throw new DownloadException("Máy chủ trả về lỗi HTTP " + code + " (" + resp.ReasonPhrase + ").");
            }

            ContentRangeHeaderValue cr = resp.Content.Headers.ContentRange;
            if (cr == null || !cr.From.HasValue || !cr.To.HasValue || cr.From.Value != start || cr.To.Value != end)
                throw new DownloadException("Máy chủ trả về phạm vi byte không khớp với yêu cầu.");
            if (cr.Length.HasValue && cr.Length.Value != TotalBytes)
                throw new DownloadException("Kích thước tệp trên máy chủ đã thay đổi.");
        }

        // ------------------------------------------------------------------ dự phòng 1 luồng

        private async Task RunSingleStreamAsync(CancellationToken ct)
        {
            // Không có Range thì không thể nối tiếp từng byte: luôn tải lại từ đầu.
            Interlocked.Exchange(ref _downloaded, 0);
            ResetSpeed();

            var req = new HttpRequestMessage(HttpMethod.Get, RemoteUrl);
            using (HttpResponseMessage resp = await SendAsync(req, ct).ConfigureAwait(false))
            {
                int code = (int)resp.StatusCode;
                if (code >= 400)
                    throw new DownloadException("Máy chủ trả về lỗi HTTP " + code + " (" + resp.ReasonPhrase + ").");

                using (var fs = new FileStream(TargetPath, FileMode.Create, FileAccess.Write, FileShare.Read, 1, true))
                {
                    long got = await PumpAsync(resp, fs, null, ct).ConfigureAwait(false);
                    if (TotalBytes > 0 && got != TotalBytes)
                        throw new IOException("Dữ liệu nhận được không đầy đủ (" + got + "/" + TotalBytes + " byte).");
                    TotalBytes = got;
                }
            }
        }

        // ------------------------------------------------------------------ dùng chung

        private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            using (var hdr = CancellationTokenSource.CreateLinkedTokenSource(ct))
            {
                hdr.CancelAfter(HeaderTimeoutMs);
                try
                {
                    return await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, hdr.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    throw new TimeoutException("Kết nối tới máy chủ bị quá thời gian chờ.");
                }
            }
        }

        /// <summary>
        /// Đọc body từ mạng, ghi xuống dest. Nếu seg != null thì đọc cho đến khi seg.NextByte > seg.End
        /// (hoặc dừng sớm nếu seg.End bị thu hẹp do luồng khác cắt đôi - Dynamic Segment Splitting).
        /// Trả về số byte đã ghi. Cập nhật bộ đếm SAU khi ghi xong.
        /// </summary>
        private async Task<long> PumpAsync(HttpResponseMessage resp, Stream dest, Segment seg, CancellationToken ct)
        {
            using (var stall = CancellationTokenSource.CreateLinkedTokenSource(ct))
            using (stall.Token.Register(() => { try { resp.Dispose(); } catch { } }))
            using (Stream net = await resp.Content.ReadAsStreamAsync().ConfigureAwait(false))
            {
                var buffer = new byte[BufferSize];
                long total = 0;
                try
                {
                    while (true)
                    {
                        int want = buffer.Length;
                        if (seg != null)
                        {
                            long remaining = seg.End - seg.NextByte + 1;
                            if (remaining <= 0) break; // Đã đạt End (kể cả khi End vừa bị cắt ngắn do split)
                            want = (int)Math.Min(buffer.Length, remaining);
                        }

                        stall.CancelAfter(StallTimeoutMs);                 // bắt đầu đếm giờ treo
                        int n = await net.ReadAsync(buffer, 0, want, stall.Token).ConfigureAwait(false);
                        stall.CancelAfter(Timeout.Infinite);               // đọc xong: ngừng đếm
                        if (n == 0) break;

                        // [BẢO VỆ ĐA LUỒNG]: Ngăn ngừa Worker khác TrySplit() lấn byte khi đang đọc mạng
                        if (seg != null)
                        {
                            long maxAllowed = seg.End - seg.NextByte + 1;
                            if (maxAllowed <= 0) break;
                            if (n > maxAllowed) n = (int)maxAllowed;
                        }

                        if (_limiter != null) await _limiter.WaitAsync(n, ct).ConfigureAwait(false);
                        await dest.WriteAsync(buffer, 0, n, ct).ConfigureAwait(false);

                        if (seg != null) seg.Add(n);
                        Interlocked.Add(ref _downloaded, n);
                        total += n;
                        if (seg != null && seg.NextByte > seg.End) break;
                    }
                }
                catch (Exception) when (ct.IsCancellationRequested)
                {
                    throw new OperationCanceledException(ct);
                }
                catch (Exception) when (stall.IsCancellationRequested)
                {
                    throw new TimeoutException("Máy chủ không gửi dữ liệu trong " + (StallTimeoutMs / 1000) + " giây.");
                }
                return total;
            }
        }

        // ------------------------------------------------------------------ khâu 5: toàn vẹn dữ liệu

        private void VerifyIntegrity()
        {
            List<Segment> sorted;
            lock (_segmentsLock)
            {
                foreach (Segment s in Segments)
                {
                    if (!s.Finished || s.Downloaded < s.Length)
                        throw new DownloadException("Phân đoạn #" + s.Index + " chưa tải đủ dữ liệu (" + s.Downloaded + "/" + s.Length + " byte).");
                }
                sorted = Segments.OrderBy(s => s.Start).ToList();
            }

            if (sorted.Count == 0)
                throw new DownloadException("Không có phân đoạn nào được ghi nhận.");

            // Kiểm tra tính liên tục và không chồng lấn của các phân đoạn
            if (sorted[0].Start != 0)
                throw new DownloadException("Lỗi toàn vẹn dữ liệu: Phân đoạn đầu tiên không bắt đầu từ byte 0 (bắt đầu từ " + sorted[0].Start + ").");

            for (int i = 0; i < sorted.Count - 1; i++)
            {
                if (sorted[i].End + 1 != sorted[i + 1].Start)
                {
                    throw new DownloadException(string.Format(
                        "Lỗi toàn vẹn dữ liệu: Xuất hiện khe hở hoặc chồng lấn giữa phân đoạn #{0} [{1}..{2}] và #{3} [{4}..{5}].",
                        sorted[i].Index, sorted[i].Start, sorted[i].End,
                        sorted[i + 1].Index, sorted[i + 1].Start, sorted[i + 1].End));
                }
            }

            if (sorted[sorted.Count - 1].End != TotalBytes - 1)
                throw new DownloadException("Lỗi toàn vẹn dữ liệu: Phân đoạn cuối cùng không kết thúc ở byte " + (TotalBytes - 1) + " (kết thúc ở " + sorted[sorted.Count - 1].End + ").");

            long totalSegmentBytes = sorted.Sum(s => s.Length);
            if (totalSegmentBytes != TotalBytes)
                throw new DownloadException("Lỗi toàn vẹn dữ liệu: Tổng chiều dài các phân đoạn (" + totalSegmentBytes + ") khác kích thước tệp (" + TotalBytes + ").");

            long size = new FileInfo(TargetPath).Length;
            if (size != TotalBytes)
                throw new DownloadException("Kiểm tra toàn vẹn thất bại: kích thước tệp trên đĩa (" + size + ") khác dự kiến (" + TotalBytes + ").");
        }

        // ------------------------------------------------------------------ khâu 6: lưu/khôi phục tiến độ

        public void SaveMetaSafe()
        {
            if (!SupportsRanges) return;
            lock (_metaLock)
            {
                if (State == DownloadState.Completed || State == DownloadState.Cancelled) return;
                try
                {
                    List<SegmentMeta> segMetas;
                    lock (_segmentsLock)
                    {
                        segMetas = Segments.Select(s => new SegmentMeta
                        {
                            Index = s.Index,
                            Start = s.Start,
                            End = s.End,
                            Downloaded = s.Downloaded,
                            Finished = s.Finished
                        }).ToList();
                    }

                    var meta = new DownloadMeta
                    {
                        Url = SourceUrl,
                        RemoteUrl = RemoteUrl,
                        TotalBytes = TotalBytes,
                        ETag = ETag,
                        LastModified = LastModified,
                        Threads = RequestedThreads,
                        Segments = segMetas
                    };
                    MetaStore.Save(TargetPath, meta);
                }
                catch { }
            }
        }

        // ------------------------------------------------------------------ tốc độ, snapshot

        private void ResetSpeed()
        {
            _speed = 0;
            _lastTicks = Stopwatch.GetTimestamp();
            _lastBytes = Downloaded;
        }

        /// <summary>Gọi định kỳ (~400 ms) bởi DownloadManager. Làm mượt tốc độ bằng trung bình động.</summary>
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

            // Serialize đầy đủ SegmentMeta để DB có đủ thông tin resume sau crash
            string segsMeta = null;
            List<SegmentDto> segDtos = null;
            int threadCount = 1;

            if (SupportsRanges && Segments != null)
            {
                lock (_segmentsLock)
                {
                    if (Segments.Count > 0)
                    {
                        try
                        {
                            var metas = Segments.Select(s => new SegmentMeta
                            {
                                Index      = s.Index,
                                Start      = s.Start,
                                End        = s.End,
                                Downloaded = s.Downloaded,
                                Finished   = s.Finished
                            }).ToList();
                            segsMeta = JsonSerializer.Serialize(metas);
                        }
                        catch { }

                        segDtos = Segments.Select(s => new SegmentDto { Downloaded = s.Downloaded, Length = s.Length }).ToList();
                        threadCount = RequestedThreads;
                    }
                }
            }

            return new ProgressDto
            {
                TaskId          = Id,
                State           = state.ToString().ToLowerInvariant(),
                FileName        = Path.GetFileName(TargetPath),
                TargetPath      = TargetPath,
                TotalBytes      = TotalBytes,
                Downloaded      = done,
                Speed           = speed,
                EtaSeconds      = eta,
                ElapsedSeconds  = _activeStopwatch.Elapsed.TotalSeconds,
                Threads         = threadCount,
                SupportsRanges  = SupportsRanges,
                Error           = Error,
                FileHash        = FileHash,
                VirusScanStatus = VirusScanStatus,
                VirusScanResult = VirusScanResult,
                Segments        = segDtos ?? new List<SegmentDto>(),
                SegmentsMetaJson = segsMeta
            };
        }

        private void RaiseChanged()
        {
            Action<DownloadJob> handler = Changed;
            if (handler == null) return;
            try { handler(this); } catch { }
        }

        // ------------------------------------------------------------------ lỗi

        private static bool IsFatal(Exception ex)
        {
            if (ex is DownloadException || ex is UnauthorizedAccessException) return true;
            var io = ex as IOException;
            if (io != null)
            {
                int win32 = io.HResult & 0xFFFF;
                if (win32 == 112 || win32 == 39) return true; // ERROR_DISK_FULL / ERROR_HANDLE_DISK_FULL
            }
            return false;
        }

        private static string Describe(Exception ex)
        {
            if (ex is TimeoutException || ex is DownloadException) return ex.Message;

            var s = SettingsManager.Current;
            if (s != null && s.Proxy != null && s.Proxy.Enabled &&
                (ex.Message.IndexOf("connect", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 ex.Message.IndexOf("refused", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 (ex.InnerException != null && (ex.InnerException.Message.IndexOf("connect", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                                ex.InnerException.Message.IndexOf("refused", StringComparison.OrdinalIgnoreCase) >= 0))))
            {
                bool isEn = string.Equals(s.Language, "en", StringComparison.OrdinalIgnoreCase);
                return isEn
                    ? $"Proxy connection error ({s.Proxy.Host}:{s.Proxy.Port}): Unable to reach server. Please check Proxy in Settings or disable Proxy."
                    : $"Lỗi kết nối máy chủ Proxy ({s.Proxy.Host}:{s.Proxy.Port}): Không thể kết nối. Vui lòng kiểm tra lại Proxy trong Cài đặt hoặc tắt Proxy nếu không sử dụng.";
            }

            if (ex is HttpRequestException && ex.InnerException != null) return "Lỗi mạng: " + ex.InnerException.Message;
            return ex.Message;
        }
    }
}
