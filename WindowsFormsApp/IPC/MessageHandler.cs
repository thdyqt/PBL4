using System;
using System.Text.Json;
using System.Windows.Forms;

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
    }
}