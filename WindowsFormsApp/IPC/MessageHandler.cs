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

        public MessageHandler(Form1 mainForm)
        {
            _mainForm = mainForm;
            _manager = new DownloadManager();
            _manager.ProgressChanged += OnProgressChanged;
        }

        /// <summary>Gọi khi đóng form: dừng các luồng tải và lưu tiến độ để lần sau Resume.</summary>
        public void Shutdown()
        {
            _manager.ProgressChanged -= OnProgressChanged;
            _manager.Shutdown();
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
                                int threads = GetInt(root, "thread", 4);
                                _ = HandleStartDownloadAsync(taskId, url, savePath, threads);
                                break;
                            }

                        case "PAUSE_DOWNLOAD":
                            _manager.Pause(GetString(root, "taskId"));
                            break;

                        case "RESUME_DOWNLOAD":
                            _manager.Resume(GetString(root, "taskId"));
                            break;

                        case "REMOVE_DOWNLOAD":
                            _ = HandleRemoveAsync(GetString(root, "taskId"));
                            break;

                        case "SET_SPEED_LIMIT":
                            // kbps = KB/giây, 0 = không giới hạn
                            _manager.SpeedLimitBytesPerSecond = GetInt(root, "kbps", 0) * 1024L;
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

        private async Task HandleStartDownloadAsync(string taskId, string url, string folder, int threads)
        {
            try
            {
                await _manager.StartAsync(taskId, url, folder, threads).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                string message = ex is TimeoutException || ex is DownloadException
                    ? ex.Message
                    : (ex.InnerException != null ? ex.InnerException.Message : ex.Message);

                Send(new { action = "DOWNLOAD_ERROR", taskId = taskId, message = message });
            }
        }

        private async Task HandleRemoveAsync(string taskId)
        {
            try
            {
                await _manager.RemoveAsync(taskId).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Send(new { action = "DOWNLOAD_ERROR", taskId = taskId, message = ex.Message });
            }
        }

        private void OnProgressChanged(ProgressDto dto)
        {
            Send(new { action = "DOWNLOAD_PROGRESS", data = dto });
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
            using (FolderBrowserDialog folderDialog = new FolderBrowserDialog())
            {
                folderDialog.Description = "Chọn thư mục để lưu tệp tải về";
                folderDialog.ShowNewFolderButton = true; // Cho phép tạo thư mục mới

                if (folderDialog.ShowDialog() == DialogResult.OK)
                {
                    string selectedPath = folderDialog.SelectedPath;

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
    }
}
