using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    public sealed class RemoteFileInfo
    {
        public string Url { get; set; }               // URL cuối cùng sau khi theo redirect
        public long Length { get; set; } = -1;        // -1 nếu server không cho biết
        public bool SupportsRanges { get; set; }
        public string FileName { get; set; }
        public string ETag { get; set; }              // chỉ strong ETag, dùng cho If-Range
        public DateTimeOffset? LastModified { get; set; }
    }

    /// <summary>
    /// Khâu 1: dò thông tin file trên server trước khi tải.
    /// B1: HEAD -> Content-Length + Accept-Ranges.
    /// B2 (dự phòng): nhiều server chặn HEAD hoặc không báo Accept-Ranges,
    ///     nên gửi GET "Range: bytes=0-0": trả 206 + Content-Range: bytes 0-0/TỔNG nghĩa là có hỗ trợ Range.
    /// </summary>
    public static class RemoteProbe
    {
        private const int TimeoutMs = 30000;

        public static async Task<RemoteFileInfo> InspectAsync(HttpClient http, string url, CancellationToken ct)
        {
            RemoteFileInfo head = null;
            try
            {
                head = await ProbeAsync(http, HttpMethod.Head, url, ct).ConfigureAwait(false);
            }
            catch (HttpRequestException) { }
            catch (TimeoutException) { }
            catch (DownloadException) { }   // HEAD bị từ chối (403/405...) -> thử GET

            if (head != null && head.Length > 0 && head.SupportsRanges)
            {
                Finish(head, url);
                return head;
            }

            RemoteFileInfo probe = await ProbeAsync(http, HttpMethod.Get, head != null ? head.Url : url, ct).ConfigureAwait(false);
            if (head != null)
            {
                if (string.IsNullOrEmpty(probe.FileName)) probe.FileName = head.FileName;
                if (probe.Length <= 0) probe.Length = head.Length;
                if (probe.ETag == null) probe.ETag = head.ETag;
                if (!probe.LastModified.HasValue) probe.LastModified = head.LastModified;
            }
            Finish(probe, url);
            return probe;
        }

        private static async Task<RemoteFileInfo> ProbeAsync(HttpClient http, HttpMethod method, string url, CancellationToken ct)
        {
            var req = new HttpRequestMessage(method, url);
            if (method == HttpMethod.Get) req.Headers.Range = new RangeHeaderValue(0, 0);

            HttpResponseMessage resp;
            using (var cts = CancellationTokenSource.CreateLinkedTokenSource(ct))
            {
                cts.CancelAfter(TimeoutMs);
                try
                {
                    resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cts.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    throw new TimeoutException("Kết nối tới máy chủ bị quá thời gian chờ.");
                }
            }

            using (resp)
            {
                int code = (int)resp.StatusCode;
                if (code >= 400)
                    throw new DownloadException("Máy chủ trả về lỗi HTTP " + code + " (" + resp.ReasonPhrase + ").");

                var info = new RemoteFileInfo();
                info.Url = resp.RequestMessage != null && resp.RequestMessage.RequestUri != null
                    ? resp.RequestMessage.RequestUri.ToString()
                    : url;

                ContentRangeHeaderValue cr = resp.Content.Headers.ContentRange;
                if (code == 206 && cr != null && cr.Length.HasValue)
                {
                    info.Length = cr.Length.Value;
                    info.SupportsRanges = true;
                }
                else
                {
                    info.Length = resp.Content.Headers.ContentLength ?? -1;
                    // Với GET mà server trả 200 nghĩa là nó bỏ qua Range -> không hỗ trợ
                    info.SupportsRanges = method == HttpMethod.Head
                        && resp.Headers.AcceptRanges.Contains("bytes", StringComparer.OrdinalIgnoreCase);
                }

                EntityTagHeaderValue etag = resp.Headers.ETag;
                if (etag != null && !etag.IsWeak) info.ETag = etag.Tag;
                info.LastModified = resp.Content.Headers.LastModified;
                info.FileName = FileNameFromHeaders(resp);
                return info;
            }
            // using(resp) dispose khi chưa đọc body -> ngắt kết nối, không tải dữ liệu thừa
        }

        private static void Finish(RemoteFileInfo info, string originalUrl)
        {
            if (string.IsNullOrWhiteSpace(info.FileName))
                info.FileName = FileNameFromUrl(info.Url ?? originalUrl);
            info.FileName = Sanitize(info.FileName);
        }

        private static string FileNameFromHeaders(HttpResponseMessage resp)
        {
            ContentDispositionHeaderValue cd = resp.Content.Headers.ContentDisposition;
            if (cd == null) return null;
            string name = cd.FileNameStar ?? cd.FileName;
            return string.IsNullOrWhiteSpace(name) ? null : name.Trim('"', ' ');
        }

        private static string FileNameFromUrl(string url)
        {
            try
            {
                var uri = new Uri(url);
                string last = Path.GetFileName(Uri.UnescapeDataString(uri.AbsolutePath));
                return string.IsNullOrWhiteSpace(last) ? "download.bin" : last;
            }
            catch
            {
                return "download.bin";
            }
        }

        public static string Sanitize(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "download.bin";
            foreach (char c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '_');
            name = name.Trim().TrimEnd('.');
            if (name.Length == 0) return "download.bin";
            if (name.Length > 150)
            {
                string ext = Path.GetExtension(name);
                if (ext.Length > 20) ext = "";
                name = name.Substring(0, 150 - ext.Length) + ext;
            }
            return name;
        }
    }
}
