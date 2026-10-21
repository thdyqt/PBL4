using System;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Dò thông tin file trên FTP server:
    ///   B1: GetFileSize → lấy Content-Length.
    ///   B2: FTP luôn hỗ trợ ContentOffset (lệnh REST) → đánh dấu SupportsRanges = true.
    ///   B3: Lấy tên file từ URL path (FTP không có Content-Disposition).
    /// </summary>
    public static class FtpProbe
    {
        private const int TimeoutMs = 30000;

        public static Task<RemoteFileInfo> InspectAsync(string url, CancellationToken ct)
        {
            return Task.Run(() => Inspect(url), ct);
        }

        private static RemoteFileInfo Inspect(string url)
        {
            // Bước 1: GetFileSize
            long size = -1;
            try
            {
                var sizeReq = (FtpWebRequest)WebRequest.Create(url);
                sizeReq.Method = WebRequestMethods.Ftp.GetFileSize;
                sizeReq.UseBinary = true;
                sizeReq.UsePassive = true;
                sizeReq.KeepAlive = false;
                sizeReq.Timeout = TimeoutMs;

                using (var resp = (FtpWebResponse)sizeReq.GetResponse())
                {
                    size = resp.ContentLength;
                }
            }
            catch (WebException ex)
            {
                var resp = ex.Response as FtpWebResponse;
                // Một số server không hỗ trợ SIZE → thử lấy qua DownloadFile HEAD
                if (resp != null)
                    resp.Close();
                // Tiếp tục với size = -1
            }

            // Bước 2: Lấy tên file từ URL
            string fileName;
            try
            {
                var uri = new Uri(url);
                fileName = Path.GetFileName(Uri.UnescapeDataString(uri.AbsolutePath));
                if (string.IsNullOrWhiteSpace(fileName)) fileName = "ftp_download";
            }
            catch
            {
                fileName = "ftp_download";
            }
            fileName = RemoteProbe.Sanitize(fileName);

            return new RemoteFileInfo
            {
                Url = url,
                Length = size,
                SupportsRanges = size > 0, // FTP hỗ trợ REST (ContentOffset) nếu biết kích thước
                FileName = fileName,
                ETag = null,
                LastModified = null
            };
        }
    }
}
