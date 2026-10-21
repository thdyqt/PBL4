using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Tính và xác minh checksum SHA-256 / MD5 của file.
    /// Dùng SHA-256 làm mặc định vì an toàn hơn MD5.
    /// </summary>
    public static class ChecksumHelper
    {
        private const int BufferSize = 1 << 20; // 1 MB buffer để tính hash nhanh

        /// <summary>Tính SHA-256 của file. Trả về chuỗi hex lowercase.</summary>
        public static string ComputeSha256(string filePath)
        {
            using (var sha = SHA256.Create())
            using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, BufferSize))
            {
                byte[] hash = sha.ComputeHash(fs);
                return ToHex(hash);
            }
        }

        /// <summary>Tính MD5 của file. Trả về chuỗi hex lowercase.</summary>
        public static string ComputeMd5(string filePath)
        {
            using (var md5 = MD5.Create())
            using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, BufferSize))
            {
                byte[] hash = md5.ComputeHash(fs);
                return ToHex(hash);
            }
        }

        /// <summary>
        /// Xác minh file có khớp với hash kỳ vọng không.
        /// Tự động nhận dạng MD5 (32 ký tự) hoặc SHA-256 (64 ký tự).
        /// So sánh case-insensitive.
        /// </summary>
        public static bool Verify(string filePath, string expectedHash)
        {
            if (string.IsNullOrWhiteSpace(expectedHash)) return false;
            string clean = expectedHash.Trim().ToLowerInvariant();

            string actual;
            if (clean.Length == 32)
                actual = ComputeMd5(filePath);
            else if (clean.Length == 64)
                actual = ComputeSha256(filePath);
            else
                return false; // Độ dài không hợp lệ

            return string.Equals(actual, clean, StringComparison.Ordinal);
        }

        private static string ToHex(byte[] bytes)
        {
            var sb = new StringBuilder(bytes.Length * 2);
            foreach (byte b in bytes) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }
}
