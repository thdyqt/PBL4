using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Giới hạn băng thông toàn ứng dụng bằng thuật toán Virtual Clock / Token Bucket đa luồng.
    /// BytesPerSecond = 0 nghĩa là không giới hạn. Mọi luồng của mọi tác vụ dùng chung một đối tượng.
    /// </summary>
    public sealed class SpeedLimiter
    {
        private readonly object _lock = new object();
        private long _bytesPerSecond;
        private long _nextAvailableTicks = Stopwatch.GetTimestamp();

        public long BytesPerSecond
        {
            get { lock (_lock) return _bytesPerSecond; }
            set
            {
                lock (_lock)
                {
                    _bytesPerSecond = Math.Max(0, value);
                    _nextAvailableTicks = Stopwatch.GetTimestamp();
                }
            }
        }

        public async Task WaitAsync(int bytes, CancellationToken ct)
        {
            if (bytes <= 0) return;

            int delayMs = 0;
            lock (_lock)
            {
                if (_bytesPerSecond <= 0) return;

                long now = Stopwatch.GetTimestamp();
                // Cho phép burst tối đa 500ms để không bị giật cục sau lúc nhàn rỗi
                long maxBurstTicks = (long)(Stopwatch.Frequency * 0.5);
                if (_nextAvailableTicks < now - maxBurstTicks)
                {
                    _nextAvailableTicks = now;
                }

                long costTicks = (long)((double)bytes / _bytesPerSecond * Stopwatch.Frequency);
                long scheduledTicks = _nextAvailableTicks;
                _nextAvailableTicks = Math.Max(now, scheduledTicks) + costTicks;

                long diffTicks = scheduledTicks - now;
                if (diffTicks > 0)
                {
                    delayMs = (int)Math.Ceiling((double)diffTicks / Stopwatch.Frequency * 1000.0);
                }
            }

            if (delayMs > 0)
            {
                await Task.Delay(delayMs, ct).ConfigureAwait(false);
            }
        }
    }
}
