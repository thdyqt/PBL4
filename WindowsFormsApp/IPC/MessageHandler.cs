using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using WindowsFormsApp.Download;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;

namespace WindowsFormsApp.IPC
{
    public class MessageHandler
    {
        private Form1 _mainForm;
        private static readonly HttpClient Http = CreateHttpClient();

        private static HttpClient CreateHttpClient()
        {
            var handler = new HttpClientHandler
            {
                AllowAutoRedirect = true,
                AutomaticDecompression = DecompressionMethods.None // sau này Range sẽ sai nếu server nén
            };
            var client = new HttpClient(handler);
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("DUTDownloadAccelerator/1.0");
            return client;
        }

        public MessageHandler(Form1 mainForm)
        {
            _mainForm = mainForm;
        }

        public void ProcessMessage(string jsonMessage)
        {
            try
            {
                JsonDocument doc = JsonDocument.Parse(jsonMessage);
                string action = doc.RootElement.GetProperty("action").GetString();

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
                            JsonElement root = doc.RootElement;
                            string taskId = root.GetProperty("taskId").GetString();
                            string url = root.GetProperty("url").GetString();
                            string savePath = root.GetProperty("savePath").GetString();
                            int threads = root.GetProperty("thread").GetInt32();
                            _ = HandleStartDownloadAsync(taskId, url, savePath, threads);
                            break;
                        }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Lỗi: " + ex.Message);
            }
        }

        private void HandleReadClipboard()
        {
            string clipboardText = "";

            // Kiểm tra xem Clipboard của Windows có chứa văn bản (như URL) không
            if (Clipboard.ContainsText())
            {
                clipboardText = Clipboard.GetText();
            }

            // Đóng gói đoạn text vừa lấy được thành chuỗi JSON
            var responseData = new
            {
                action = "CLIPBOARD_DATA",
                data = clipboardText
            };
            string responseJson = JsonSerializer.Serialize(responseData);

            // GỌI HÀM CỦA Form1 ĐỂ BẮN DỮ LIỆU NGƯỢC LÊN GIAO DIỆN
            _mainForm.SendToWeb(responseJson);
        }

        private void HandleBrowseFolder()
        {
            using (FolderBrowserDialog folderDialog = new FolderBrowserDialog())
            {
                folderDialog.Description = "Chọn thư mục để lưu tệp tải về";
                folderDialog.ShowNewFolderButton = true; // Cho phép tạo thư mục mới

                // Hiển thị hộp thoại và kiểm tra xem người dùng có bấm OK không
                if (folderDialog.ShowDialog() == DialogResult.OK)
                {
                    string selectedPath = folderDialog.SelectedPath;

                    // Đóng gói đường dẫn thành JSON
                    var responseData = new
                    {
                        action = "FOLDER_SELECTED",
                        data = selectedPath
                    };
                    string responseJson = JsonSerializer.Serialize(responseData);

                    // GỌI HÀM CỦA Form1 ĐỂ BẮN DỮ LIỆU NGƯỢC LÊN GIAO DIỆN
                    _mainForm.SendToWeb(responseJson);
                }
            }
        }
        private async Task HandleStartDownloadAsync(string taskId, string url, string savePath, int threads)
        {
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

            try
            {
                // Không dùng ConfigureAwait(false) ở đây: sau await, code quay lại luồng giao diện,
                // nên gọi SendToWeb (WebView2) an toàn.
                RemoteFileInfo info = await RemoteProbe.InspectAsync(Http, url, CancellationToken.None);
                // Bước 4: chia đoạn (chỉ chia khi server hỗ trợ Range)
                List<Segment> segments = (info.SupportsRanges && info.Length > 1)
                    ? SegmentPlanner.Split(info.Length, threads)
                    : new List<Segment>();

                foreach (Segment s in segments) Debug.WriteLine("[Segment] " + s);

                var response = new
                {
                    action = "DOWNLOAD_ACCEPTED",
                    taskId = taskId,
                    data = new
                    {
                        fileName = info.FileName,
                        length = info.Length,
                        supportsRanges = info.SupportsRanges,
                        finalUrl = info.Url,
                        segments = segments.Select(s => new { start = s.Start, end = s.End }).ToList()
                    }
                };
                _mainForm.SendToWeb(JsonSerializer.Serialize(response));
                // ===== BƯỚC 6 (TẠM): tải TẤT CẢ các đoạn song song =====
                if (segments.Count > 0)
                {
                    string target = Path.Combine(savePath, info.FileName);

                    var sw = Stopwatch.StartNew();
                    await ParallelDownloader.DownloadAllAsync(Http, info.Url, target, info.Length, segments, CancellationToken.None);
                    sw.Stop();

                    long bytes = segments.Sum(s => s.Downloaded);
                    double seconds = Math.Max(sw.Elapsed.TotalSeconds, 0.001);
                    double mbPerSec = bytes / 1048576.0 / seconds;

                    Debug.WriteLine("[Step6] " + segments.Count + " luồng, " + bytes + " byte, "
                                    + sw.ElapsedMilliseconds + " ms, " + mbPerSec.ToString("F2") + " MB/s");

                    var done = new
                    {
                        action = "DOWNLOAD_DONE",
                        taskId = taskId,
                        data = new
                        {
                            threads = segments.Count,
                            bytes = bytes,
                            ms = sw.ElapsedMilliseconds,
                            mbPerSec = mbPerSec
                        }
                    };
                    _mainForm.SendToWeb(JsonSerializer.Serialize(done));
                }
            }
            catch (TaskCanceledException)
            {
                SendError(taskId, "Máy chủ không phản hồi (quá 30 giây).");
            }
            catch (HttpRequestException ex)
            {
                SendError(taskId, "Không kết nối được: " + (ex.InnerException != null ? ex.InnerException.Message : ex.Message));
            }
            catch (Exception ex)
            {
                SendError(taskId, ex.Message);
            }
        }

        private void SendError(string taskId, string message)
        {
            var response = new { action = "DOWNLOAD_ERROR", taskId = taskId, message = message };
            _mainForm.SendToWeb(JsonSerializer.Serialize(response));
        }
    }
}