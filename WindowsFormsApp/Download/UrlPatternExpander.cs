using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Bộ phân tích và sinh liên kết tải hàng loạt theo quy luật (Batch Download / Pattern Matching).
    /// Hỗ trợ các cú pháp:
    /// 1. Dải số nguyên có đệm 0 (Zero-padding) và bước nhảy: [01-20], [1-50:5], [20-01]
    /// 2. Dải chữ cái: [a-z], [A-Z], [a-e:2], [z-a]
    /// 3. Danh sách phân tách dấu phẩy: [en,vi,fr], [1080p,720p,480p]
    /// 4. Nhiều quy luật lồng nhau (Tích Descartes): https://example.com/vol_[1-2]/chuong_[01-03].pdf
    /// 5. Trích xuất và mở rộng tự động từ nội dung tệp .txt / .csv
    /// </summary>
    public static class UrlPatternExpander
    {
        private static readonly Regex BracketRegex = new Regex(@"\[\s*([^\]]+?)\s*\]", RegexOptions.Compiled);
        private static readonly Regex NumRangeRegex = new Regex(@"^(\d+)\s*-\s*(\d+)(?:\s*:\s*(\d+))?$", RegexOptions.Compiled);
        private static readonly Regex LetterRangeRegex = new Regex(@"^([a-zA-Z])\s*-\s*([a-zA-Z])(?:\s*:\s*(\d+))?$", RegexOptions.Compiled);
        private static readonly Regex UrlExtractRegex = new Regex(@"(?:https?|ftp)://[^\s"",;<>\r\n]+", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        /// <summary>
        /// Kiểm tra nhanh chuỗi URL có chứa cú pháp quy luật hợp lệ trong ngoặc vuông hay không.
        /// (Phân biệt với địa chỉ IPv6 như http://[::1]/)
        /// </summary>
        public static bool HasPattern(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return false;

            MatchCollection matches = BracketRegex.Matches(input);
            foreach (Match m in matches)
            {
                string inner = m.Groups[1].Value.Trim();
                if (NumRangeRegex.IsMatch(inner)) return true;
                if (LetterRangeRegex.IsMatch(inner)) return true;
                if (inner.Contains(",") && !inner.Contains("::")) return true;
            }
            return false;
        }

        /// <summary>
        /// Sinh danh sách toàn bộ các URL từ chuỗi quy luật mẫu.
        /// </summary>
        /// <param name="pattern">URL chứa một hoặc nhiều dải quy luật [...]</param>
        /// <param name="maxCount">Giới hạn số lượng URL sinh ra (mặc định 500 để bảo vệ bộ nhớ và hàng đợi)</param>
        /// <returns>Danh sách URL hợp lệ đã mở rộng</returns>
        public static List<string> Expand(string pattern, int maxCount = 500)
        {
            if (string.IsNullOrWhiteSpace(pattern))
                return new List<string>();

            string trimmed = pattern.Trim();
            if (!HasPattern(trimmed))
            {
                // Không có quy luật, trả về chính URL nếu hợp lệ
                return new List<string> { trimmed };
            }

            List<string> expanded = ExpandRecursive(trimmed, maxCount);
            if (expanded.Count > maxCount)
            {
                throw new InvalidOperationException($"Số lượng liên kết sinh ra ({expanded.Count}) vượt quá giới hạn cho phép ({maxCount}).");
            }

            return expanded;
        }

        private static List<string> ExpandRecursive(string current, int maxCount)
        {
            Match match = BracketRegex.Match(current);
            if (!match.Success)
            {
                return new List<string> { current };
            }

            string inner = match.Groups[1].Value.Trim();
            List<string> replacements = new List<string>();

            // 1. Dải số nguyên: [01-20] hoặc [1-20:2] hoặc [20-01]
            Match numMatch = NumRangeRegex.Match(inner);
            if (numMatch.Success)
            {
                string rawStart = numMatch.Groups[1].Value;
                string rawEnd = numMatch.Groups[2].Value;
                string rawStep = numMatch.Groups[3].Success ? numMatch.Groups[3].Value : null;

                if (long.TryParse(rawStart, out long start) && long.TryParse(rawEnd, out long end))
                {
                    long step = 1;
                    if (!string.IsNullOrEmpty(rawStep) && long.TryParse(rawStep, out long parsedStep) && parsedStep > 0)
                    {
                        step = parsedStep;
                    }

                    int padLen = Math.Max(rawStart.Length, rawEnd.Length);
                    // Nếu người dùng không nhập số 0 ở đầu (ví dụ 1-20) thì không cần đệm 0 thừa
                    if (!rawStart.StartsWith("0") && !rawEnd.StartsWith("0"))
                    {
                        padLen = 0;
                    }

                    if (start <= end)
                    {
                        for (long i = start; i <= end; i += step)
                        {
                            replacements.Add(padLen > 0 ? i.ToString().PadLeft(padLen, '0') : i.ToString());
                            if (replacements.Count > maxCount) break;
                        }
                    }
                    else
                    {
                        for (long i = start; i >= end; i -= step)
                        {
                            replacements.Add(padLen > 0 ? i.ToString().PadLeft(padLen, '0') : i.ToString());
                            if (replacements.Count > maxCount) break;
                        }
                    }
                }
            }
            else
            {
                // 2. Dải ký tự: [a-z], [A-Z], [a-e:2], [z-a]
                Match letterMatch = LetterRangeRegex.Match(inner);
                if (letterMatch.Success)
                {
                    char startChar = letterMatch.Groups[1].Value[0];
                    char endChar = letterMatch.Groups[2].Value[0];
                    int step = 1;
                    if (letterMatch.Groups[3].Success && int.TryParse(letterMatch.Groups[3].Value, out int parsedStep) && parsedStep > 0)
                    {
                        step = parsedStep;
                    }

                    if (startChar <= endChar)
                    {
                        for (int c = startChar; c <= endChar; c += step)
                        {
                            replacements.Add(((char)c).ToString());
                            if (replacements.Count > maxCount) break;
                        }
                    }
                    else
                    {
                        for (int c = startChar; c >= endChar; c -= step)
                        {
                            replacements.Add(((char)c).ToString());
                            if (replacements.Count > maxCount) break;
                        }
                    }
                }
                else if (inner.Contains(",") && !inner.Contains("::"))
                {
                    // 3. Danh sách phân tách phẩy: [en,vi,fr], [part1,part2]
                    string[] parts = inner.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var p in parts)
                    {
                        string trimmedPart = p.Trim();
                        if (!string.IsNullOrEmpty(trimmedPart))
                        {
                            replacements.Add(trimmedPart);
                        }
                    }
                }
            }

            if (replacements.Count == 0)
            {
                // Không phải quy luật được hỗ trợ, bỏ qua
                return new List<string> { current };
            }

            var results = new List<string>();
            foreach (var rep in replacements)
            {
                // Thay thế ngoặc vuông đầu tiên
                string nextStr = current.Substring(0, match.Index) + rep + current.Substring(match.Index + match.Length);
                var subResults = ExpandRecursive(nextStr, maxCount);
                results.AddRange(subResults);
                if (results.Count > maxCount) break;
            }

            return results;
        }

        /// <summary>
        /// Mở rộng tên tệp tùy chỉnh nếu người dùng nhập tên tệp theo quy luật tương ứng.
        /// Ví dụ: customFileName = "bai_[01-20].pdf" -> lấy tên bài tương ứng theo index.
        /// </summary>
        public static string ExpandCustomName(string customFileName, int index, string matchingUrl)
        {
            if (string.IsNullOrWhiteSpace(customFileName)) return null;

            if (HasPattern(customFileName))
            {
                try
                {
                    var names = Expand(customFileName);
                    if (index >= 0 && index < names.Count)
                    {
                        return names[index];
                    }
                }
                catch { }
            }

            return customFileName;
        }

        /// <summary>
        /// Trích xuất toàn bộ URL hợp lệ từ nội dung tệp .txt hoặc .csv,
        /// tự động mở rộng mọi URL có chứa cú pháp quy luật [start-end].
        /// </summary>
        public static List<string> ExtractUrlsFromContent(string content, int maxTotalUrls = 1000)
        {
            var result = new List<string>();
            if (string.IsNullOrWhiteSpace(content)) return result;

            string[] lines = content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (string rawLine in lines)
            {
                string line = rawLine.Trim();
                if (string.IsNullOrWhiteSpace(line)) continue;
                if (line.StartsWith("#") || line.StartsWith("//")) continue;

                // Tìm tất cả các URL trên dòng này (hỗ trợ cả file CSV có nhiều cột / dấu ngoặc kép)
                MatchCollection matches = UrlExtractRegex.Matches(line);
                foreach (Match m in matches)
                {
                    string candidate = m.Value.Trim();

                    // Làm sạch các ký tự bao quanh như ngoặc kép hoặc dấu phẩy thừa ở đuôi
                    candidate = candidate.TrimEnd(',', ';', '"', '\'');

                    if (HasPattern(candidate))
                    {
                        try
                        {
                            var expanded = Expand(candidate, 500);
                            foreach (var u in expanded)
                            {
                                if (seen.Add(u))
                                {
                                    result.Add(u);
                                    if (result.Count >= maxTotalUrls) return result;
                                }
                            }
                        }
                        catch
                        {
                            if (seen.Add(candidate))
                            {
                                result.Add(candidate);
                                if (result.Count >= maxTotalUrls) return result;
                            }
                        }
                    }
                    else
                    {
                        if (seen.Add(candidate))
                        {
                            result.Add(candidate);
                            if (result.Count >= maxTotalUrls) return result;
                        }
                    }
                }
            }

            return result;
        }
    }
}

