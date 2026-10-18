using System;
using System.Collections.Generic;
using System.Threading;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Một phần của file: các byte từ Start đến End (tính cả hai đầu).
    /// Mỗi luồng tải sẽ phụ trách đúng một Segment.
    /// </summary>
    public sealed class Segment
    {
        private long _downloaded;   // số byte đã ghi xuống đĩa (dùng ở Bước 5)
        private int _finished;      // 0 = chưa xong, 1 = xong

        public Segment(int index, long start, long end)
        {
            Index = index;
            Start = start;
            End = end;
        }

        public int Index { get; }
        public long Start { get; }
        public long End { get; }

        /// <summary>Độ dài đoạn. Cộng 1 vì hai đầu đều tính: [0-9] là 10 byte.</summary>
        public long Length => End - Start + 1;

        /// <summary>Số byte đã tải xong của đoạn này.</summary>
        public long Downloaded => Interlocked.Read(ref _downloaded);

        /// <summary>Byte tiếp theo cần xin server. Dùng khi tải tiếp (retry, resume).</summary>
        public long NextByte => Start + Downloaded;

        public bool Finished
        {
            get { return Volatile.Read(ref _finished) == 1; }
            set { Volatile.Write(ref _finished, value ? 1 : 0); }
        }

        /// <summary>Cộng thêm số byte vừa ghi. Interlocked vì nhiều luồng có thể cùng gọi.</summary>
        public void Add(int bytes)
        {
            Interlocked.Add(ref _downloaded, bytes);
        }

        public override string ToString()
        {
            return "#" + Index + " [" + Start + "-" + End + "] " + Length + " byte";
        }
    }

    public static class SegmentPlanner
    {
        public const int MaxThreads = 16;
        public const long MinSegmentSize = 256 * 1024;   // không chia nhỏ hơn 256 KB mỗi đoạn

        /// <summary>
        /// Chia totalBytes thành tối đa requestedThreads đoạn liền nhau, gần bằng nhau.
        /// Ví dụ 10 byte, 3 luồng:  base = 10 / 3 = 3, extra = 10 % 3 = 1
        ///   đoạn 0: 3 + 1 = 4 byte  -> [0-3]
        ///   đoạn 1: 3 byte          -> [4-6]
        ///   đoạn 2: 3 byte          -> [7-9]
        /// Tham số minSegmentSize chỉ để kiểm thử (truyền 1 để chia file rất nhỏ).
        /// </summary>
        public static List<Segment> Split(long totalBytes, int requestedThreads, long minSegmentSize = MinSegmentSize)
        {
            if (totalBytes <= 0) throw new ArgumentOutOfRangeException("totalBytes");

            // Số luồng thực dùng: không vượt số yêu cầu, không vượt 16, và mỗi đoạn >= minSegmentSize
            long bySize = Math.Max(1, totalBytes / Math.Max(1, minSegmentSize));
            int threads = (int)Math.Max(1, Math.Min(Math.Min(requestedThreads, MaxThreads), bySize));

            long baseSize = totalBytes / threads;   // phần chia nguyên
            long extra = totalBytes % threads;      // phần dư: chia cho các đoạn đầu, mỗi đoạn thêm 1 byte

            var list = new List<Segment>(threads);
            long start = 0;
            for (int i = 0; i < threads; i++)
            {
                long size = baseSize + (i < extra ? 1 : 0);
                list.Add(new Segment(i, start, start + size - 1));
                start += size;   // đoạn sau bắt đầu ngay sau chỗ đoạn trước kết thúc
            }
            return list;
        }

        /// <summary>
        /// Kiểm thử nhanh: thử hàng chục nghìn tổ hợp (tổng byte, số luồng) và kiểm tra các tính chất bắt buộc.
        /// Đúng thì trả về thông báo OK, sai thì ném lỗi nói rõ tổ hợp nào sai.
        /// </summary>
        public static string SelfTest()
        {
            int cases = 0;
            for (long total = 1; total <= 2000; total++)
            {
                for (int req = 1; req <= 16; req++)
                {
                    List<Segment> segs = Split(total, req, 1);
                    cases++;
                    string where = "total=" + total + ", threads=" + req;

                    if (segs.Count < 1 || segs.Count > req) throw new Exception("Sai số đoạn: " + where);
                    if (segs[0].Start != 0) throw new Exception("Đoạn đầu không bắt đầu từ 0: " + where);
                    if (segs[segs.Count - 1].End != total - 1) throw new Exception("Đoạn cuối không kết thúc ở total-1: " + where);

                    long sum = 0, min = long.MaxValue, max = 0;
                    for (int i = 0; i < segs.Count; i++)
                    {
                        sum += segs[i].Length;
                        min = Math.Min(min, segs[i].Length);
                        max = Math.Max(max, segs[i].Length);
                        if (i > 0 && segs[i].Start != segs[i - 1].End + 1)
                            throw new Exception("Hai đoạn không nối liền (hở hoặc chồng): " + where);
                    }
                    if (sum != total) throw new Exception("Tổng độ dài các đoạn khác total: " + where);
                    if (max - min > 1) throw new Exception("Các đoạn chênh nhau quá 1 byte: " + where);
                }
            }
            return "OK - " + cases + " tổ hợp đều đúng";
        }
    }
}
