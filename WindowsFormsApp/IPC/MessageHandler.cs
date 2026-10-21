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
                                int threads = GetInt(root, "thread", GetInt(root, "threads", 4));
                                _ = HandleStartDownloadAsync(taskId, url, savePath, threads);
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
                            _manager.Resume(GetString(root, "taskId"));
                            break;

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

                        case "TEST_PROXY":
                            _ = HandleTestProxyAsync(root);
                            break;

                        case "OPEN_FILE":
                            HandleOpenFile(GetString(root, "taskId"), GetString(root, "path"));
                            break;

                        case "OPEN_FOLDER":
                            HandleOpenFolder(GetString(root, "taskId"), GetString(root, "path"));
                            break;

                        case "VERIFY_HASH":
                            _ = HandleVerifyHashAsync(root);
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
            }
            catch (Exception ex)
            {
                Send(new { action = "DOWNLOAD_ERROR", taskId = taskId, message = ex.Message });
            }
        }

        private void HandleGetSettings()
        {
            var settings = SettingsManager.Current;
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
                        int threads = GetInt(item, "threads", GetInt(item, "thread", 4));
                        if (!string.IsNullOrWhiteSpace(taskId) && !string.IsNullOrWhiteSpace(url))
                        {
                            _ = HandleStartDownloadAsync(taskId, url, savePath, threads);
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
    }
}
