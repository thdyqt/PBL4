using System;
using System.Collections.Generic;
using System.Threading;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Một phần của file: byte [Start, End] (đóng hai đầu). Mỗi luồng tải đúng một Segment.
    /// Downloaded chỉ tăng SAU KHI dữ liệu đã được ghi xuống đĩa.
    /// </summary>
    public sealed class Segment
    {
        private long _downloaded;
        private int _finished;

        public Segment(int index, long start, long end)
        {
            Index = index;
            Start = start;
            End = end;
        }

        public int Index { get; }
        public long Start { get; }
        public long End { get; }
        public long Length => End - Start + 1;

        public long Downloaded => Interlocked.Read(ref _downloaded);
        public long NextByte => Start + Downloaded;

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
    }

    public static class SegmentPlanner
    {
        public const int MaxThreads = 16;
        public const long MinSegmentSize = 256 * 1024; // không chia nhỏ hơn 256 KB

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
