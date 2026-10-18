using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace WindowsFormsApp.Download
{
    /// <summary>
    /// Giới hạn băng thông toàn ứng dụng bằng thuật toán token bucket.
    /// BytesPerSecond = 0 nghĩa là không giới hạn. Mọi luồng của mọi tác vụ dùng chung một đối tượng.
    /// </summary>
    public sealed class SpeedLimiter
    {
        private readonly object _lock = new object();
        private long _bytesPerSecond;
        private double _allowance;
        private long _lastTicks = Stopwatch.GetTimestamp();

        public long BytesPerSecond
        {
            get { lock (_lock) return _bytesPerSecond; }
            set
            {
                lock (_lock)
                {
                    _bytesPerSecond = Math.Max(0, value);
                    _allowance = 0;
                    _lastTicks = Stopwatch.GetTimestamp();
                }
            }
        }

        public async Task WaitAsync(int bytes, CancellationToken ct)
        {
            double delayMs;
            lock (_lock)
            {
                if (_bytesPerSecond <= 0) return;

                long now = Stopwatch.GetTimestamp();
                double elapsed = (now - _lastTicks) / (double)Stopwatch.Frequency;
                _lastTicks = now;

                // Cho phép dồn tối đa 1 giây băng thông
                _allowance = Math.Min(_allowance + elapsed * _bytesPerSecond, _bytesPerSecond);
                _allowance -= bytes;
                if (_allowance >= 0) return;

                delayMs = -_allowance / _bytesPerSecond * 1000.0;
            }
            await Task.Delay((int)Math.Ceiling(delayMs), ct).ConfigureAwait(false);
        }
    }
}
