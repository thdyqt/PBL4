using System;
using System.Collections.Generic;
using System.Threading;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Một phần của file: byte [Start, End] (đóng hai đầu).
    /// Hỗ trợ chia nhỏ luồng động (Dynamic Segment Splitting / Work Stealing kiểu IDM) an toàn đa luồng.
    /// Downloaded chỉ tăng SAU KHI dữ liệu đã được ghi xuống đĩa.
    /// </summary>
    public sealed class Segment
    {
        private readonly object _lock = new object();
        private long _end;
        private long _downloaded;
        private int _finished;

        public Segment(int index, long start, long end)
        {
            Index = index;
            Start = start;
            _end = end;
        }

        public int Index { get; }
        public long Start { get; }

        public long End
        {
            get { lock (_lock) return _end; }
        }

        public long Length
        {
            get { lock (_lock) return _end - Start + 1; }
        }

        public long Downloaded => Interlocked.Read(ref _downloaded);
        public long NextByte => Start + Downloaded;

        public long Remaining
        {
            get
            {
                lock (_lock)
                {
                    long rem = _end - NextByte + 1;
                    return rem > 0 ? rem : 0;
                }
            }
        }

        public bool Finished
        {
            get { return Volatile.Read(ref _finished) == 1; }
            set { Volatile.Write(ref _finished, value ? 1 : 0); }
        }

        public void Add(int bytes)
        {
            Interlocked.Add(ref _downloaded, bytes);
        }

        public void Restore(long downloaded, bool finished)
        {
            Interlocked.Exchange(ref _downloaded, downloaded);
            Finished = finished;
        }

        /// <summary>
        /// Thuật toán Dynamic Segment Splitting của IDM (Work Stealing):
        /// Cắt đôi phạm vi byte chưa tải còn lại [NextByte, _end].
        /// Phân đoạn hiện tại giữ nửa đầu [Start, splitPoint - 1].
        /// Phân đoạn mới gánh nửa sau [splitPoint, oldEnd].
        /// Đảm bảo thread-safe với lock(_lock), không trùng lặp và không bỏ sót bất kỳ byte nào.
        /// </summary>
        public bool TrySplit(int newIndex, long minSplitSize, out Segment newSegment)
        {
            lock (_lock)
            {
                if (Finished)
                {
                    newSegment = null;
                    return false;
                }

                long next = Start + Interlocked.Read(ref _downloaded);
                long remaining = _end - next + 1;
                if (remaining < minSplitSize)
                {
                    newSegment = null;
                    return false;
                }

                long half = remaining / 2;
                long splitPoint = next + half;
                long oldEnd = _end;

                // Thu hẹp phân đoạn hiện tại
                _end = splitPoint - 1;

                // Phân đoạn mới đảm nhiệm nửa còn lại
                newSegment = new Segment(newIndex, splitPoint, oldEnd);
                return true;
            }
        }
    }

    public static class SegmentPlanner
    {
        public const int MaxThreads = 16;
        public const long MinSegmentSize = 256 * 1024; // không chia nhỏ hơn 256 KB ban đầu
        public const long MinSplitSize = 512 * 1024;   // 512 KB: ngưỡng tối thiểu để kích hoạt chia đôi động (tránh vi phân mảnh)
        public const int MaxDynamicSegments = 64;      // Giới hạn phân đoạn tối đa để tối ưu tài nguyên

        /// <summary>
        /// Chia totalBytes thành tối đa requestedThreads đoạn gần bằng nhau.
        /// Ví dụ 10 byte, 3 luồng -> [0-3] [4-6] [7-9] (đoạn đầu nhận phần dư).
        /// </summary>
        public static List<Segment> Split(long totalBytes, int requestedThreads)
        {
            if (totalBytes <= 0) throw new ArgumentOutOfRangeException(nameof(totalBytes));

            long bySize = Math.Max(1, totalBytes / MinSegmentSize);
            int threads = (int)Math.Max(1, Math.Min(Math.Min(requestedThreads, MaxThreads), bySize));

            long baseSize = totalBytes / threads;
            long extra = totalBytes % threads;

            var list = new List<Segment>(threads);
            long start = 0;
            for (int i = 0; i < threads; i++)
            {
                long size = baseSize + (i < extra ? 1 : 0);
                list.Add(new Segment(i, start, start + size - 1));
                start += size;
            }
            return list;
        }
    }
}
