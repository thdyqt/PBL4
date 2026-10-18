using System;
using System.Text.Json;
using System.Windows.Forms;
using System.IO;

namespace WindowsFormsApp.IPC
{
    public class MessageHandler
    {
        private Form1 _mainForm;

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
                        HandleStartDownload(doc.RootElement);
                        break;
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