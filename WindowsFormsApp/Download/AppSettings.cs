using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    public class ProxySettings
    {
        public bool Enabled { get; set; } = false;
        public string Mode { get; set; } = "direct"; // "direct", "system", "manual"
        public string Type { get; set; } = "http";   // "http", "socks5"
        public string Host { get; set; } = "";
        public int Port { get; set; } = 8080;
        public bool AuthRequired { get; set; } = false;
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public bool BypassLocal { get; set; } = true;
    }

    public class AppSettings
    {
        public int MaxConcurrentDownloads { get; set; } = 2; // 0 = Không giới hạn
        public long SpeedLimitKbps { get; set; } = 0;        // 0 = Không giới hạn (KB/s)
        public ProxySettings Proxy { get; set; } = new ProxySettings();
        public string DefaultSavePath { get; set; } = "";
        public int DefaultThreads { get; set; } = 4;
        public bool AutoStartNextInQueue { get; set; } = true;
        public bool ConfirmBeforeDelete { get; set; } = true;
        public string Theme { get; set; } = "light"; // "light", "dark", "system"
    }

    public class ProxyTestResult
    {
        public bool Success { get; set; }
        public long LatencyMs { get; set; }
        public string Message { get; set; }
    }

    public static class SettingsManager
    {
        private static readonly string SettingsFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "settings.json");
        private static readonly object _syncLock = new object();
        private static AppSettings _current;

        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNameCaseInsensitive = true
        };

        public static AppSettings Current
        {
            get
            {
                lock (_syncLock)
                {
                    if (_current == null) _current = Load();
                    return _current;
                }
            }
        }

        public static AppSettings Load()
        {
            lock (_syncLock)
            {
                try
                {
                    if (File.Exists(SettingsFilePath))
                    {
                        string json = File.ReadAllText(SettingsFilePath);
                        var settings = JsonSerializer.Deserialize<AppSettings>(json, JsonOptions);
                        if (settings != null)
                        {
                            if (settings.Proxy == null) settings.Proxy = new ProxySettings();
                            _current = settings;
                            return _current;
                        }
                    }
                }
                catch { }

                _current = new AppSettings();
                return _current;
            }
        }

        public static void Save(AppSettings settings)
        {
            if (settings == null) return;
            lock (_syncLock)
            {
                _current = settings;
                try
                {
                    string json = JsonSerializer.Serialize(settings, JsonOptions);
                    File.WriteAllText(SettingsFilePath, json);
                }
                catch { }
            }
        }
    }

    public static class ProxyTester
    {
        public static async Task<ProxyTestResult> TestConnectionAsync(ProxySettings proxy, string testUrl = "https://www.google.com")
        {
            if (proxy == null || !proxy.Enabled)
            {
                return new ProxyTestResult
                {
                    Success = false,
                    Message = "Proxy chưa được kích hoạt."
                };
            }

            var sw = Stopwatch.StartNew();
            try
            {
                var handler = new HttpClientHandler
                {
                    AllowAutoRedirect = true,
                    MaxAutomaticRedirections = 3
                };

                if (string.Equals(proxy.Mode, "system", StringComparison.OrdinalIgnoreCase))
                {
                    handler.UseProxy = true;
                    handler.Proxy = WebRequest.GetSystemWebProxy();
                }
                else
                {
                    if (string.IsNullOrWhiteSpace(proxy.Host))
                    {
                        return new ProxyTestResult { Success = false, Message = "Vui lòng nhập địa chỉ máy chủ Proxy." };
                    }

                    string scheme = string.Equals(proxy.Type, "socks5", StringComparison.OrdinalIgnoreCase) ? "socks5" : "http";
                    string proxyUri = $"{scheme}://{proxy.Host.Trim()}:{proxy.Port}";
                    var webProxy = new WebProxy(new Uri(proxyUri), proxy.BypassLocal);

                    if (proxy.AuthRequired && !string.IsNullOrEmpty(proxy.Username))
                    {
                        webProxy.Credentials = new NetworkCredential(proxy.Username, proxy.Password ?? "");
                    }

                    handler.Proxy = webProxy;
                    handler.UseProxy = true;
                }

                using (var client = new HttpClient(handler))
                {
                    client.Timeout = TimeSpan.FromSeconds(10);
                    client.DefaultRequestHeaders.UserAgent.ParseAdd("DUTDownloadAccelerator-ProxyTest/1.0");

                    var req = new HttpRequestMessage(HttpMethod.Head, testUrl);
                    using (var resp = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false))
                    {
                        sw.Stop();
                        return new ProxyTestResult
                        {
                            Success = true,
                            LatencyMs = sw.ElapsedMilliseconds,
                            Message = $"Kết nối Proxy thành công! Độ trễ phản hồi: {sw.ElapsedMilliseconds} ms."
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                sw.Stop();
                string err = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return new ProxyTestResult
                {
                    Success = false,
                    LatencyMs = sw.ElapsedMilliseconds,
                    Message = "Không thể kết nối qua Proxy: " + err
                };
            }
        }
    }
}
