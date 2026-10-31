using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.IPC
{
    /// <summary>
    /// Bản chất Mạng & HĐH: Local Loopback HTTP Web Server chạy ngầm trên http://127.0.0.1:8989/
    /// Đóng vai trò cầu nối IPC (Inter-Process Communication) giữa trình duyệt Chrome/Edge Extension và ứng dụng.
    /// Nhận diện, bắt link tải và tự động kích hoạt cửa sổ tải của ứng dụng.
    /// </summary>
    public sealed class BrowserExtensionServer : IDisposable
    {
        private HttpListener _listener;
        private CancellationTokenSource _cts;
        private Task _listenTask;
        private bool _disposed;

        public const int Port = 8989;
        public static readonly string Prefix = $"http://127.0.0.1:{Port}/";

        /// <summary>
        /// Sự kiện phát ra khi extension bắt được một liên kết tải mới
        /// </summary>
        public event Action<CapturedLinkDto> LinkCaptured;

        public bool IsRunning => _listener != null && _listener.IsListening;

        /// <summary>
        /// Khởi động máy chủ IPC cục bộ
        /// </summary>
        public void Start()
        {
            if (IsRunning) return;

            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add(Prefix);
                _listener.Start();

                _cts = new CancellationTokenSource();
                _listenTask = Task.Run(() => ListenLoopAsync(_cts.Token));
                System.Diagnostics.Debug.WriteLine($"[BrowserExtensionServer] Started on {Prefix}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[BrowserExtensionServer] Start failed on {Prefix}: {ex.Message}");
            }
        }

        private async Task ListenLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && _listener != null && _listener.IsListening)
            {
                try
                {
                    var context = await _listener.GetContextAsync().ConfigureAwait(false);
                    _ = ProcessRequestAsync(context);
                }
                catch (HttpListenerException) { break; }
                catch (ObjectDisposedException) { break; }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[BrowserExtensionServer] Loop error: {ex.Message}");
                }
            }
        }

        private async Task ProcessRequestAsync(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            // [BẢO MẬT CORS]: Chỉ cho phép Extension và nội bộ loopback, chặn đứng website internet
            string origin = req.Headers["Origin"];
            if (!string.IsNullOrEmpty(origin))
            {
                bool isAllowed = origin.StartsWith("chrome-extension://", StringComparison.OrdinalIgnoreCase) ||
                                 origin.StartsWith("moz-extension://", StringComparison.OrdinalIgnoreCase) ||
                                 origin.StartsWith("edge-extension://", StringComparison.OrdinalIgnoreCase) ||
                                 origin.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase) ||
                                 origin.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase);
                if (isAllowed)
                {
                    res.Headers.Add("Access-Control-Allow-Origin", origin);
                }
                else
                {
                    res.StatusCode = 403;
                    byte[] errBytes = Encoding.UTF8.GetBytes("{\"error\":\"Forbidden: Cross-origin access denied\"}");
                    await res.OutputStream.WriteAsync(errBytes, 0, errBytes.Length);
                    res.Close();
                    return;
                }
            }
            else
            {
                res.Headers.Add("Access-Control-Allow-Origin", "http://127.0.0.1");
            }
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
            res.ContentType = "application/json; charset=utf-8";

            // Xử lý Preflight CORS request
            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            try
            {
                string path = req.Url.AbsolutePath.ToLowerInvariant();

                // 1. Health check & Ping từ Extension
                if (path == "/ping" || path == "/" || path == "/status")
                {
                    var pingObj = new
                    {
                        status = "ok",
                        app = "DUT Download Accelerator",
                        version = "1.0",
                        timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                    };
                    byte[] pingBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(pingObj));
                    res.StatusCode = 200;
                    await res.OutputStream.WriteAsync(pingBytes, 0, pingBytes.Length);
                    res.Close();
                    return;
                }

                // 2. Bắt link tải: POST /capture
                if (path == "/capture" && req.HttpMethod == "POST")
                {
                    string jsonBody;
                    using (var reader = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8))
                    {
                        jsonBody = await reader.ReadToEndAsync();
                    }

                    if (string.IsNullOrWhiteSpace(jsonBody))
                    {
                        res.StatusCode = 400;
                        byte[] errBytes = Encoding.UTF8.GetBytes("{\"success\":false,\"error\":\"Empty payload\"}");
                        await res.OutputStream.WriteAsync(errBytes, 0, errBytes.Length);
                        res.Close();
                        return;
                    }

                    var dto = JsonSerializer.Deserialize<CapturedLinkDto>(jsonBody, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

                    if (dto != null && !string.IsNullOrWhiteSpace(dto.Url))
                    {
                        // Kích hoạt sự kiện thông báo cho Form1 và giao diện người dùng
                        LinkCaptured?.Invoke(dto);

                        var okObj = new
                        {
                            success = true,
                            message = "Link captured successfully",
                            fileName = dto.FileName,
                            url = dto.Url
                        };
                        byte[] okBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(okObj));
                        res.StatusCode = 200;
                        await res.OutputStream.WriteAsync(okBytes, 0, okBytes.Length);
                        res.Close();
                        return;
                    }
                }

                // 404 Not Found
                res.StatusCode = 404;
                byte[] notFoundBytes = Encoding.UTF8.GetBytes("{\"error\":\"Endpoint not found\"}");
                await res.OutputStream.WriteAsync(notFoundBytes, 0, notFoundBytes.Length);
                res.Close();
            }
            catch (Exception ex)
            {
                try
                {
                    res.StatusCode = 500;
                    byte[] errBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { error = ex.Message }));
                    await res.OutputStream.WriteAsync(errBytes, 0, errBytes.Length);
                    res.Close();
                }
                catch { }
            }
        }

        /// <summary>
        /// Dừng máy chủ IPC
        /// </summary>
        public void Stop()
        {
            try
            {
                _cts?.Cancel();
                _listener?.Stop();
                _listener?.Close();
            }
            catch { }
            finally
            {
                _listener = null;
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            Stop();
            _cts?.Dispose();
        }
    }
}
