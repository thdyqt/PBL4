const $ = (selector) => document.querySelector(selector);
const urlInput = $('#url');
const pathInput = $('#save-path');
const threadInput = $('#threads');
const startButton = $('#start-button');
const message = $('#form-message');
const list = $('#download-list');
const emptyState = $('#empty-state');
const count = $('#download-count');
const jobs = new Map();

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)) - 1, units.length - 1);
  return `${(value / (1024 ** (index + 1))).toFixed(value / (1024 ** (index + 1)) >= 100 ? 0 : 1)} ${units[index]}`;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Đang tính thời gian';
  if (seconds < 60) return `Còn khoảng ${Math.ceil(seconds)} giây`;
  const minutes = Math.ceil(seconds / 60);
  return `Còn khoảng ${minutes} phút`;
}

function fileNameFromUrl(value) {
  try {
    const part = decodeURIComponent(new URL(value).pathname.split('/').pop());
    return part || 'tai-xuong.bin';
  } catch {
    return 'tai-xuong.bin';
  }
}

function setMessage(text = '', isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

function stateText(job) {
  const states = {
    preparing: 'Đang chuẩn bị',
    downloading: 'Đang tải',
    paused: 'Đã tạm dừng',
    completed: 'Hoàn tất',
    failed: 'Không tải được',
  };
  return states[job.state] || job.state;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function render() {
  const values = [...jobs.values()];
  emptyState.hidden = values.length > 0;
  count.textContent = `${values.length} tác vụ`;
  list.innerHTML = values.map((job) => {
    const progress = job.totalBytes ? Math.min(100, (job.downloaded / job.totalBytes) * 100) : 0;
    const eta = job.speed > 0 ? (job.totalBytes - job.downloaded) / job.speed : NaN;
    const isDone = job.state === 'completed';
    const button = job.state === 'downloading'
      ? `<button class="card-action" data-action="pause" data-id="${job.id}">Tạm dừng</button>`
      : !isDone ? `<button class="card-action" data-action="resume" data-id="${job.id}">Tiếp tục</button>` : '';
    return `<article class="download-card ${job.state}">
      <div class="file-icon">${isDone ? '✓' : '↓'}</div>
      <div class="download-content">
        <div class="file-line"><h3 title="${escapeHtml(job.fileName)}">${escapeHtml(job.fileName)}</h3><span class="state ${job.state}">${stateText(job)}</span></div>
        <p class="path" title="${escapeHtml(job.targetPath)}">${escapeHtml(job.targetPath)}</p>
        <div class="progress-track" aria-label="${Math.round(progress)}%"><span style="width:${progress}%"></span></div>
        <div class="download-meta">
          <span>${formatBytes(job.downloaded)} / ${formatBytes(job.totalBytes)} · ${Math.round(progress)}%</span>
          <span>${job.state === 'downloading' ? `${formatBytes(job.speed)}/s · ${formatEta(eta)}` : job.state === 'failed' ? escapeHtml(job.error || 'Lỗi không xác định') : job.state === 'completed' ? 'Đã kiểm tra kích thước tệp' : `${job.threads} luồng${job.supportsRanges ? '' : ' · một luồng'}`}</span>
        </div>
      </div>
      <div class="card-actions">${button}<button class="icon-button" data-action="cancel" data-id="${job.id}" aria-label="${isDone ? 'Ẩn' : 'Hủy tải'}" title="${isDone ? 'Ẩn khỏi danh sách' : 'Hủy tải'}">×</button></div>
    </article>`;
  }).join('');
}

async function chooseLocation() {
  const location = await window.downloader.chooseLocation(fileNameFromUrl(urlInput.value));
  if (location) pathInput.value = location;
}

$('#browse-button').addEventListener('click', chooseLocation);

$('#paste-button').addEventListener('click', async () => {
  try {
    const value = await navigator.clipboard.readText();
    if (value) urlInput.value = value.trim();
    setMessage('Đã dán liên kết từ clipboard.');
  } catch {
    setMessage('Không đọc được clipboard. Hãy dán liên kết thủ công.', true);
  }
});

urlInput.addEventListener('input', () => {
  if (pathInput.value) return;
  setMessage();
});

startButton.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    setMessage('Hãy nhập liên kết tải về.', true);
    urlInput.focus();
    return;
  }
  if (!pathInput.value) {
    await chooseLocation();
    if (!pathInput.value) return;
  }
  startButton.disabled = true;
  setMessage('Đang kiểm tra máy chủ và khả năng tải nhiều luồng…');
  try {
    const job = await window.downloader.start({ url, targetPath: pathInput.value, threads: Number(threadInput.value) });
    jobs.set(job.id, job);
    render();
    setMessage(job.supportsRanges ? `Đã bắt đầu tải với ${job.threads} luồng.` : 'Máy chủ không hỗ trợ Range; đang tải bằng một luồng.');
    pathInput.value = '';
  } catch (error) {
    setMessage(error.message || 'Không thể bắt đầu tải xuống.', true);
  } finally {
    startButton.disabled = false;
  }
});

list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  button.disabled = true;
  try {
    if (action === 'pause') await window.downloader.pause(id);
    if (action === 'resume') await window.downloader.resume(id);
    if (action === 'cancel') {
      await window.downloader.cancel(id);
      jobs.delete(id);
      render();
    }
  } catch (error) {
    setMessage(error.message || 'Không thể thực hiện thao tác.', true);
  } finally {
    button.disabled = false;
  }
});

window.downloader.onUpdate((job) => {
  jobs.set(job.id, job);
  render();
});

render();
