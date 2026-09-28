const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const downloads = new Map();
const MAX_THREADS = 16;
const MAX_REDIRECTS = 5;

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 630,
    backgroundColor: '#f7f9fc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function safeFileName(value) {
  const cleaned = String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned.slice(0, 180) : 'tai-xuong.bin';
}

function nameFromUrl(url) {
  try {
    const candidate = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return safeFileName(candidate || 'tai-xuong.bin');
  } catch {
    return 'tai-xuong.bin';
  }
}

function nameFromDisposition(header) {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  const normal = /filename="?([^";]+)"?/i.exec(header);
  try {
    return safeFileName(decodeURIComponent((encoded || normal || [])[1] || ''));
  } catch {
    return null;
  }
}

function assertHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Liên kết không hợp lệ. Hãy nhập URL HTTP hoặc HTTPS.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Ứng dụng chỉ hỗ trợ liên kết HTTP và HTTPS.');
  }
  return url;
}

function rawRequest(urlString, method, headers = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = assertHttpUrl(urlString);
    } catch (error) {
      reject(error);
      return;
    }
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, {
      method,
      headers: {
        'User-Agent': 'FastDown/1.0 (Windows Download Accelerator)',
        ...headers,
      },
    }, (response) => {
      const code = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(code) && response.headers.location) {
        response.resume();
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error('Liên kết chuyển hướng quá nhiều lần.'));
          return;
        }
        const nextUrl = new URL(response.headers.location, url).toString();
        rawRequest(nextUrl, method, headers, redirectCount + 1).then(resolve, reject);
        return;
      }
      resolve({ response, url: url.toString() });
    });
    request.setTimeout(30000, () => request.destroy(new Error('Kết nối đến máy chủ bị quá thời gian chờ.')));
    request.on('error', reject);
    request.end();
  });
}

async function inspectRemote(url) {
  const head = await rawRequest(url, 'HEAD');
  const { response } = head;
  const status = response.statusCode || 0;
  const length = Number(response.headers['content-length']);
  const dispositionName = nameFromDisposition(response.headers['content-disposition']);
  const rangeHeader = String(response.headers['accept-ranges'] || '').toLowerCase();
  response.resume();

  if (status >= 400 && status !== 405) {
    throw new Error(`Máy chủ trả về lỗi HTTP ${status}.`);
  }

  // Some servers omit Accept-Ranges even though Range requests work. Probe one byte.
  if (Number.isFinite(length) && length > 0 && rangeHeader.includes('bytes')) {
    return { url: head.url, length, supportsRanges: true, fileName: dispositionName || nameFromUrl(head.url) };
  }

  const probe = await rawRequest(head.url, 'GET', { Range: 'bytes=0-0' });
  const probeResponse = probe.response;
  const contentRange = String(probeResponse.headers['content-range'] || '');
  const totalMatch = /\/(\d+)$/.exec(contentRange);
  const probeLength = totalMatch ? Number(totalMatch[1]) : Number(probeResponse.headers['content-length']);
  const supportsRanges = probeResponse.statusCode === 206 && Number.isFinite(probeLength) && probeLength > 0;
  const probeName = nameFromDisposition(probeResponse.headers['content-disposition']);
  probeResponse.resume();

  if (!Number.isFinite(probeLength) || probeLength <= 0) {
    throw new Error('Máy chủ không cung cấp kích thước tệp, nên chưa thể tải an toàn.');
  }
  return {
    url: probe.url,
    length: probeLength,
    supportsRanges,
    fileName: probeName || dispositionName || nameFromUrl(probe.url),
  };
}

function splitSegments(totalBytes, requestedThreads) {
  const threads = Math.max(1, Math.min(Number(requestedThreads) || 4, MAX_THREADS, totalBytes));
  const baseSize = Math.floor(totalBytes / threads);
  const extra = totalBytes % threads;
  const segments = [];
  let start = 0;
  for (let index = 0; index < threads; index += 1) {
    const size = baseSize + (index < extra ? 1 : 0);
    segments.push({ start, end: start + size - 1, downloaded: 0, finished: false });
    start += size;
  }
  return segments;
}

function jobSnapshot(job) {
  const elapsedSeconds = Math.max((Date.now() - job.startedAt) / 1000, 0.001);
  const speed = job.downloaded / elapsedSeconds;
  return {
    id: job.id,
    fileName: path.basename(job.targetPath),
    targetPath: job.targetPath,
    sourceUrl: job.sourceUrl,
    totalBytes: job.totalBytes,
    downloaded: job.downloaded,
    speed,
    threads: job.segments.length,
    requestedThreads: job.requestedThreads,
    state: job.state,
    error: job.error || null,
    supportsRanges: job.supportsRanges,
  };
}

function emitUpdate(job) {
  const payload = jobSnapshot(job);
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('download:update', payload);
  }
}

function startTicker(job) {
  clearInterval(job.ticker);
  job.ticker = setInterval(() => {
    if (job.state === 'downloading') emitUpdate(job);
  }, 400);
}

function stopTicker(job) {
  clearInterval(job.ticker);
  job.ticker = null;
}

function isAbort(error) {
  return error && (error.name === 'AbortError' || error.code === 'ABORT_ERR' || error.message === 'Tải xuống đã bị dừng.');
}

function getSegment(job, segment, attempt) {
  return new Promise((resolve, reject) => {
    const startAt = segment.start + segment.downloaded;
    if (startAt > segment.end) {
      segment.finished = true;
      resolve();
      return;
    }

    const requestUrl = assertHttpUrl(job.remoteUrl);
    const client = requestUrl.protocol === 'https:' ? https : http;
    const request = client.request(requestUrl, {
      method: 'GET',
      headers: {
        Range: `bytes=${startAt}-${segment.end}`,
        'Accept-Encoding': 'identity',
        'User-Agent': 'FastDown/1.0 (Windows Download Accelerator)',
      },
    }, (response) => {
      const contentRange = String(response.headers['content-range'] || '');
      const expectedRange = `bytes ${startAt}-${segment.end}/${job.totalBytes}`;
      if (response.statusCode !== 206) {
        response.resume();
        reject(new Error(`Máy chủ không trả dữ liệu phân đoạn hợp lệ (HTTP ${response.statusCode}).`));
        return;
      }
      if (contentRange.toLowerCase() !== expectedRange) {
        response.resume();
        reject(new Error('Máy chủ trả về một phạm vi byte không khớp với yêu cầu.'));
        return;
      }
      const expected = segment.end - startAt + 1;
      let received = 0;
      const output = fs.createWriteStream(job.targetPath, { flags: 'r+', start: startAt });
      job.streams.add(output);
      output.on('close', () => job.streams.delete(output));
      const fail = (error) => {
        response.destroy();
        output.destroy();
        reject(error);
      };
      response.on('data', (chunk) => {
        if (attempt !== job.attempt) return;
        received += chunk.length;
        segment.downloaded += chunk.length;
        job.downloaded += chunk.length;
      });
      response.on('error', fail);
      output.on('error', fail);
      output.on('finish', () => {
        if (attempt !== job.attempt) {
          reject(Object.assign(new Error('Tải xuống đã bị dừng.'), { code: 'ABORT_ERR' }));
          return;
        }
        if (received !== expected) {
          reject(new Error('Dữ liệu phân đoạn nhận được không đầy đủ.'));
          return;
        }
        segment.finished = true;
        resolve();
      });
      response.pipe(output);
    });
    request.setTimeout(30000, () => request.destroy(new Error('Kết nối tải xuống bị quá thời gian chờ.')));
    request.on('error', reject);
    job.requests.add(request);
    request.on('close', () => job.requests.delete(request));
    request.end();
  });
}

function getSingleStream(job, attempt) {
  return new Promise((resolve, reject) => {
    // A non-Range response cannot be resumed byte-for-byte, so restart it cleanly.
    job.downloaded = 0;
    const requestUrl = assertHttpUrl(job.remoteUrl);
    const client = requestUrl.protocol === 'https:' ? https : http;
    const request = client.request(requestUrl, { method: 'GET', headers: { 'Accept-Encoding': 'identity' } }, (response) => {
      if ((response.statusCode || 0) >= 400) {
        response.resume();
        reject(new Error(`Máy chủ trả về lỗi HTTP ${response.statusCode}.`));
        return;
      }
      const output = fs.createWriteStream(job.targetPath, { flags: 'w' });
      job.streams.add(output);
      output.on('close', () => job.streams.delete(output));
      response.on('data', (chunk) => {
        if (attempt === job.attempt) job.downloaded += chunk.length;
      });
      response.on('error', reject);
      output.on('error', reject);
      output.on('finish', () => {
        if (attempt !== job.attempt) {
          reject(Object.assign(new Error('Tải xuống đã bị dừng.'), { code: 'ABORT_ERR' }));
          return;
        }
        resolve();
      });
      response.pipe(output);
    });
    request.setTimeout(30000, () => request.destroy(new Error('Kết nối tải xuống bị quá thời gian chờ.')));
    request.on('error', reject);
    job.requests.add(request);
    request.on('close', () => job.requests.delete(request));
    request.end();
  });
}

async function runDownload(job) {
  const attempt = ++job.attempt;
  job.state = 'downloading';
  job.error = null;
  job.startedAt = Date.now() - job.activeElapsed;
  job.requests = new Set();
  startTicker(job);
  emitUpdate(job);

  try {
    if (job.supportsRanges) {
      await Promise.all(job.segments.filter((segment) => !segment.finished).map((segment) => getSegment(job, segment, attempt)));
      const stat = await fsp.stat(job.targetPath);
      if (job.downloaded !== job.totalBytes || stat.size !== job.totalBytes) {
        throw new Error('Kiểm tra toàn vẹn thất bại: kích thước tệp không khớp.');
      }
    } else {
      await getSingleStream(job, attempt);
      job.totalBytes = job.downloaded;
    }
    if (attempt !== job.attempt || job.state !== 'downloading') return;
    job.state = 'completed';
    job.activeElapsed = Date.now() - job.startedAt;
    stopTicker(job);
    emitUpdate(job);
  } catch (error) {
    if (attempt !== job.attempt) return;
    job.activeElapsed = Date.now() - job.startedAt;
    if (job.state === 'paused' || job.state === 'cancelled' || isAbort(error)) return;
    job.state = 'failed';
    job.error = error.message || 'Không thể tải tệp.';
    stopTicker(job);
    emitUpdate(job);
  }
}

function stopTransfers(job) {
  for (const request of job.requests) request.destroy(Object.assign(new Error('Tải xuống đã bị dừng.'), { code: 'ABORT_ERR' }));
  job.requests.clear();
  for (const stream of job.streams) stream.destroy(Object.assign(new Error('Tải xuống đã bị dừng.'), { code: 'ABORT_ERR' }));
  job.streams.clear();
}

ipcMain.handle('download:choose-location', async (_event, suggestedName) => {
  const result = await dialog.showSaveDialog({
    title: 'Lưu tệp tải về',
    defaultPath: path.join(app.getPath('downloads'), safeFileName(suggestedName)),
    buttonLabel: 'Chọn vị trí lưu',
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('download:start', async (_event, { url, targetPath, threads }) => {
  assertHttpUrl(url);
  if (!targetPath) throw new Error('Bạn chưa chọn nơi lưu tệp.');
  const info = await inspectRemote(url);
  const id = randomUUID();
  const requestedThreads = Math.max(1, Math.min(Number(threads) || 4, MAX_THREADS));
  const supportsRanges = info.supportsRanges && info.length > 1;
  const segments = supportsRanges ? splitSegments(info.length, requestedThreads) : [{ start: 0, end: info.length - 1, downloaded: 0, finished: false }];
  const job = {
    id,
    sourceUrl: url,
    remoteUrl: info.url,
    targetPath,
    totalBytes: info.length,
    downloaded: 0,
    requestedThreads,
    supportsRanges,
    segments,
    state: 'preparing',
    startedAt: Date.now(),
    activeElapsed: 0,
    requests: new Set(),
    streams: new Set(),
    ticker: null,
    attempt: 0,
    error: null,
  };
  downloads.set(id, job);

  if (supportsRanges) {
    const handle = await fsp.open(targetPath, 'w');
    await handle.truncate(info.length);
    await handle.close();
  }
  runDownload(job);
  return jobSnapshot(job);
});

ipcMain.handle('download:pause', (_event, id) => {
  const job = downloads.get(id);
  if (!job || job.state !== 'downloading') return null;
  job.state = 'paused';
  job.activeElapsed = Date.now() - job.startedAt;
  job.attempt += 1;
  stopTransfers(job);
  stopTicker(job);
  emitUpdate(job);
  return jobSnapshot(job);
});

ipcMain.handle('download:resume', (_event, id) => {
  const job = downloads.get(id);
  if (!job || !['paused', 'failed'].includes(job.state)) return null;
  runDownload(job);
  return jobSnapshot(job);
});

ipcMain.handle('download:cancel', async (_event, id) => {
  const job = downloads.get(id);
  if (!job) return null;
  job.state = 'cancelled';
  job.attempt += 1;
  stopTransfers(job);
  stopTicker(job);
  // Cancellation is an explicit UI action; remove the incomplete target file.
  await fsp.rm(job.targetPath, { force: true }).catch(() => {});
  downloads.delete(id);
  return { id };
});
