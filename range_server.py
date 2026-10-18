#!/usr/bin/env python3
"""
Server thử nghiệm cho PBL4 (có hỗ trợ HTTP Range) - dùng để kiểm thử ứng dụng tải.

Chạy:    python range_server.py                       (cổng 8000, phục vụ thư mục hiện tại)
Tùy chọn:
  --port 8000
  --dir  .                 thư mục chứa file
  --no-range               giả lập server KHÔNG hỗ trợ Range (kiểm tra chế độ 1 luồng)
  --no-head                giả lập server từ chối HEAD (405)
  --limit-kbps 500         giới hạn tốc độ MỖI kết nối (KB/s) -> thấy rõ lợi ích đa luồng
  --drop-rate 0.2          xác suất ngắt kết nối giữa chừng (kiểm tra retry / resume)
  --make-file test.bin:200 tạo file ngẫu nhiên test.bin dài 200 MB trước khi chạy

Thử: tạo file 200 MB rồi dán http://127.0.0.1:8000/test.bin vào ứng dụng.
"""
import argparse, os, random, re, sys, time, hashlib
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

args = None

class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *a):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % a))

    def _file(self):
        path = self.translate_path(self.path.split("?", 1)[0])
        return path if os.path.isfile(path) else None

    def do_HEAD(self):
        if args.no_head:
            self.send_response(405); self.send_header("Content-Length", "0"); self.end_headers(); return
        self._serve(head=True)

    def do_GET(self):
        self._serve(head=False)

    def _serve(self, head):
        path = self._file()
        if not path:
            self.send_response(404); self.send_header("Content-Length", "0"); self.end_headers(); return
        size = os.path.getsize(path)
        mtime = os.path.getmtime(path)
        etag = '"%x-%x"' % (int(mtime), size)
        rng = self.headers.get("Range")
        start, end, status = 0, size - 1, 200

        if rng and not args.no_range:
            m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
            if m:
                s, e = m.groups()
                if s == "" and e != "":
                    start = max(0, size - int(e))
                else:
                    start = int(s or 0)
                    if e != "": end = min(int(e), size - 1)
                if start >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", "bytes */%d" % size)
                    self.send_header("Content-Length", "0"); self.end_headers(); return
                status = 206

        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(length))
        self.send_header("ETag", etag)
        self.send_header("Last-Modified", self.date_time_string(mtime))
        if not args.no_range:
            self.send_header("Accept-Ranges", "bytes")
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.end_headers()
        if head: return

        drop_at = None
        if args.drop_rate > 0 and length > 1_000_000 and random.random() < args.drop_rate:
            drop_at = random.randint(length // 10, length // 2)   # ngắt giữa chừng

        sent, chunk = 0, 64 * 1024
        t0 = time.time()
        try:
            with open(path, "rb") as f:
                f.seek(start)
                while sent < length:
                    n = min(chunk, length - sent)
                    if drop_at is not None and sent + n > drop_at:
                        n = drop_at - sent
                        if n > 0: self.wfile.write(f.read(n))
                        self.log_message("!! cố ý ngắt kết nối sau %d byte", drop_at)
                        self.close_connection = True
                        self.connection.close()
                        return
                    self.wfile.write(f.read(n))
                    sent += n
                    if args.limit_kbps > 0:
                        expected = sent / (args.limit_kbps * 1024.0)
                        delay = expected - (time.time() - t0)
                        if delay > 0: time.sleep(delay)
        except (BrokenPipeError, ConnectionResetError):
            pass

def make_file(spec):
    name, mb = spec.split(":")
    h = hashlib.sha256()
    with open(name, "wb") as f:
        for _ in range(int(mb)):
            block = os.urandom(1024 * 1024)
            f.write(block); h.update(block)
    print("Đã tạo %s (%s MB), SHA-256 = %s" % (name, mb, h.hexdigest()))

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--dir", default=".")
    ap.add_argument("--no-range", action="store_true")
    ap.add_argument("--no-head", action="store_true")
    ap.add_argument("--limit-kbps", type=int, default=0)
    ap.add_argument("--drop-rate", type=float, default=0.0)
    ap.add_argument("--make-file", default=None)
    args = ap.parse_args()
    os.chdir(args.dir)
    if args.make_file: make_file(args.make_file)
    print("Phục vụ %s tại http://127.0.0.1:%d  (range=%s, head=%s, limit=%s KB/s, drop=%s)" % (
        os.getcwd(), args.port, not args.no_range, not args.no_head, args.limit_kbps or "∞", args.drop_rate))
    ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()
