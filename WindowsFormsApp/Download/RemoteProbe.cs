using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Thông tin về file trên server, lấy được TRƯỚC khi tải.
    /// </summary>
    public sealed class RemoteFileInfo
    {
        public string Url { get; set; }                 // URL cuối cùng sau khi theo redirect
        public long Length { get; set; } = -1;          // tổng số byte, -1 nếu server không cho biết
        public bool SupportsRanges { get; set; }        // server có cho tải theo từng khúc không
        public string FileName { get; set; }            // tên file đề xuất để lưu
        public string ETag { get; set; }                // "dấu vân tay" của file (dùng ở bước sau)
        public DateTimeOffset? LastModified { get; set; }
    }

    /// <summary>
    /// BƯỚC 2: dò thông tin file bằng một request HEAD.
    /// HEAD giống GET nhưng server chỉ trả header, không trả nội dung,
    /// nên rất nhanh và không tốn băng thông.
    /// </summary>
    public static class RemoteProbe
    {
        public static async Task<RemoteFileInfo> InspectAsync(HttpClient http, string url, CancellationToken ct)
        {
            using (var request = new HttpRequestMessage(HttpMethod.Head, url))
            using (HttpResponseMessage response = await http
                .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct)
                .ConfigureAwait(false))
            {
                int code = (int)response.StatusCode;
                if (code >= 400)
                {
                    throw new InvalidOperationException(
                        "Máy chủ trả về lỗi HTTP " + code + " (" + response.ReasonPhrase + ").");
                }

                var info = new RemoteFileInfo();

                // 1. URL cuối cùng. HttpClient tự theo redirect (301/302...),
                //    RequestUri của request trong response chính là địa chỉ cuối.
                info.Url = response.RequestMessage != null && response.RequestMessage.RequestUri != null
                    ? response.RequestMessage.RequestUri.ToString()
                    : url;

                // 2. Tổng kích thước: header Content-Length
                info.Length = response.Content.Headers.ContentLength ?? -1;

                // 3. Có hỗ trợ Range không: header "Accept-Ranges: bytes"
                info.SupportsRanges = response.Headers.AcceptRanges
                    .Contains("bytes", StringComparer.OrdinalIgnoreCase);

                // 4. Dấu hiệu nhận biết phiên bản file (dùng cho Resume ở bước sau)
                EntityTagHeaderValue etag = response.Headers.ETag;
                if (etag != null && !etag.IsWeak) info.ETag = etag.Tag;
                info.LastModified = response.Content.Headers.LastModified;

                // 5. Tên file: ưu tiên Content-Disposition, nếu không có thì lấy từ URL
                string name = FileNameFromHeader(response);
                if (string.IsNullOrWhiteSpace(name)) name = FileNameFromUrl(info.Url);
                info.FileName = Sanitize(name);

                return info;
            }
        }

        private static string FileNameFromHeader(HttpResponseMessage response)
        {
            // Ví dụ: Content-Disposition: attachment; filename="bao-cao.pdf"
            ContentDispositionHeaderValue cd = response.Content.Headers.ContentDisposition;
            if (cd == null) return null;

            string name = cd.FileNameStar ?? cd.FileName;
            return string.IsNullOrWhiteSpace(name) ? null : name.Trim('"', ' ');
        }

        private static string FileNameFromUrl(string url)
        {
            try
            {
                // https://site.com/files/My%20Doc.pdf?token=1  ->  "My Doc.pdf"
                var uri = new Uri(url);
                string last = Path.GetFileName(Uri.UnescapeDataString(uri.AbsolutePath));
                return string.IsNullOrWhiteSpace(last) ? "download.bin" : last;
            }
            catch
            {
                return "download.bin";
            }
        }

        /// <summary>Thay ký tự Windows không cho phép trong tên file (\ / : * ? " &lt; &gt; |) bằng '_'.</summary>
        public static string Sanitize(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "download.bin";

            foreach (char c in Path.GetInvalidFileNameChars())
                name = name.Replace(c, '_');

            name = name.Trim().TrimEnd('.');
            return name.Length == 0 ? "download.bin" : name;
        }
    }
}