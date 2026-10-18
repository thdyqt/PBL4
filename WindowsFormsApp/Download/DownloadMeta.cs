using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace WindowsFormsApp.Download
{
    /// <summary>Metadata lưu cạnh file đang tải (file.ext.dlmeta) để Resume sau khi tắt app.</summary>
    public sealed class DownloadMeta
    {
        public string Url { get; set; }
        public string RemoteUrl { get; set; }
        public long TotalBytes { get; set; }
        public string ETag { get; set; }
        public DateTimeOffset? LastModified { get; set; }
        public int Threads { get; set; }
        public List<SegmentMeta> Segments { get; set; }
    }

    public sealed class SegmentMeta
    {
        public int Index { get; set; }
        public long Start { get; set; }
        public long End { get; set; }
        public long Downloaded { get; set; }
        public bool Finished { get; set; }
    }

    public static class MetaStore
    {
        public const string Extension = ".dlmeta";

        public static string PathFor(string targetPath)
        {
            return targetPath + Extension;
        }

        public static DownloadMeta Load(string targetPath)
        {
            try
            {
                string path = PathFor(targetPath);
                if (!File.Exists(path)) return null;
                return JsonSerializer.Deserialize<DownloadMeta>(File.ReadAllText(path));
            }
            catch
            {
                return null; // file hỏng -> coi như không có
            }
        }

        /// <summary>Ghi nguyên tử: ghi ra file tạm rồi thay thế, tránh meta bị cắt dở khi app crash.</summary>
        public static void Save(string targetPath, DownloadMeta meta)
        {
            string path = PathFor(targetPath);
            string tmp = path + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(meta));
            if (File.Exists(path)) File.Replace(tmp, path, null);
            else File.Move(tmp, path);
        }

        public static void Delete(string targetPath)
        {
            try
            {
                string path = PathFor(targetPath);
                if (File.Exists(path)) File.Delete(path);
                if (File.Exists(path + ".tmp")) File.Delete(path + ".tmp");
            }
            catch { }
        }
    }
}
