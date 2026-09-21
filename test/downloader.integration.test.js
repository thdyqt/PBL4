/* Verifies the main-process downloader without launching an Electron window. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const handlers = new Map();
function FakeBrowserWindow() {
  this.loadFile = async () => {};
}
FakeBrowserWindow.getAllWindows = () => [];

const originalLoad = Module._load;
Module._load = function mockElectron(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: { whenReady: () => Promise.resolve(), on: () => {}, getPath: () => os.tmpdir(), quit: () => {} },
      BrowserWindow: FakeBrowserWindow,
      dialog: { showSaveDialog: async () => ({ canceled: true }) },
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require('../main.js');
Module._load = originalLoad;

const bytes = Buffer.from(Array.from({ length: 48 * 1024 }, (_, index) => index % 251));
const receivedRanges = [];
const server = http.createServer((request, response) => {
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Length', bytes.length);
  if (request.method === 'HEAD') return response.end();
  const range = request.headers.range;
  if (!range) return response.end(bytes);
  const match = /^bytes=(\d+)-(\d+)$/.exec(range);
  assert.ok(match, `Unexpected Range header: ${range}`);
  const start = Number(match[1]);
  const end = Number(match[2]);
  receivedRanges.push({ start, end });
  response.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
    'Content-Length': end - start + 1,
  });
  response.end(bytes.subarray(start, end + 1));
});

function listen() {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close() {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function waitForFile(filePath) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const result = await fs.readFile(filePath);
      if (result.equals(bytes)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Tệp tải về không khớp dữ liệu nguồn trong thời gian cho phép.');
}

(async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'fastdown-test-'));
  const output = path.join(folder, 'sample.bin');
  try {
    await listen();
    const port = server.address().port;
    const job = await handlers.get('download:start')(null, {
      url: `http://127.0.0.1:${port}/sample.bin`,
      targetPath: output,
      threads: 4,
    });
    assert.equal(job.supportsRanges, true);
    assert.equal(job.threads, 4);
    await waitForFile(output);
    assert.equal(receivedRanges.length, 4);
    assert.deepEqual(receivedRanges, [
      { start: 0, end: 12287 },
      { start: 12288, end: 24575 },
      { start: 24576, end: 36863 },
      { start: 36864, end: 49151 },
    ]);
    console.log('Multi-part HTTP Range download integration test passed.');
  } finally {
    await close();
    await fs.rm(folder, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
