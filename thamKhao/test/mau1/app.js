// Quản lý Modal
const modal = document.getElementById('addUrlModal');
const btnAdd = document.getElementById('btnAdd');
const btnClose = document.getElementById('btnCloseModal');
const btnCancel = document.getElementById('btnCancelModal');
const btnStart = document.getElementById('btnStartDownload');

// Hiển thị và ẩn modal
const openModal = () => { modal.style.display = 'flex'; document.getElementById('urlInput').focus(); };
const closeModal = () => { modal.style.display = 'none'; document.getElementById('urlInput').value = ''; };

btnAdd.addEventListener('click', openModal);
btnClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);

// Bắt đầu tải
btnStart.addEventListener('click', () => {
    const url = document.getElementById('urlInput').value.trim();
    const threads = parseInt(document.getElementById('threadCount').value);
    
    if(!url) return alert('Vui lòng nhập URL hợp lệ!');
    
    const fileName = url.substring(url.lastIndexOf('/') + 1) || "video_hd_1080p.mp4";
    addNewDownloadTask(fileName, threads);
    closeModal();
});

function addNewDownloadTask(fileName, threads) {
    const tbody = document.getElementById('downloadTableBody');
    const tr = document.createElement('tr');
    
    // Khởi tạo các đoạn HTML cho thanh tiến trình đa luồng (IDM style)
    let segmentsHtml = '';
    for(let i=0; i < threads; i++) {
        // Mỗi luồng quản lý một phần (vd: 8 luồng thì mỗi luồng chứa tối đa 12.5% độ dài thanh tiến trình)
        segmentsHtml += `<div class="progress-segment" id="thread-${Date.now()}-${i}" style="width: 0%; max-width: ${100/threads}%"></div>`;
    }

    tr.innerHTML = `
        <td><input type="checkbox"></td>
        <td><i class="fa-solid fa-file file-icon"></i> ${fileName}</td>
        <td>1.2 GB</td>
        <td><span class="status downloading">Đang kết nối...</span></td>
        <td class="speed">0 MB/s</td>
        <td class="eta">Đang tính...</td>
        <td>
            <div class="progress-bar-container" style="justify-content: flex-start;">
                ${segmentsHtml}
            </div>
            <div style="font-size: 10px; margin-top: 2px; color: #888;" class="percent-text">0%</div>
        </td>
    `;
    
    tbody.prepend(tr);
    simulateMultiThreadDownload(tr, threads);
}

function simulateMultiThreadDownload(rowElement, numThreads) {
    const statusText = rowElement.querySelector('.status');
    const speedText = rowElement.querySelector('.speed');
    const etaText = rowElement.querySelector('.eta');
    const percentText = rowElement.querySelector('.percent-text');
    
    // Mảng lưu trữ tiến độ (từ 0.0 đến 1.0) của từng luồng
    let threadProgress = new Array(numThreads).fill(0);
    let isComplete = false;

    statusText.innerText = `Đang tải (${numThreads} luồng)`;

    const interval = setInterval(() => {
        let totalPercent = 0;
        let activeThreads = 0;

        // Giả lập từng luồng nhận dữ liệu
        for(let i=0; i < numThreads; i++) {
            if (threadProgress[i] < 1.0) {
                // Tốc độ tải ngẫu nhiên cho từng luồng
                threadProgress[i] += Math.random() * 0.05; 
                if (threadProgress[i] > 1.0) threadProgress[i] = 1.0;
                activeThreads++;
            }
            
            // Cập nhật UI cho từng đoạn tiến trình
            const segmentDiv = rowElement.querySelectorAll('.progress-segment')[i];
            const maxSegmentWidth = 100 / numThreads; 
            segmentDiv.style.width = `${threadProgress[i] * maxSegmentWidth}%`;
            
            totalPercent += (threadProgress[i] * maxSegmentWidth);
        }

        // Cập nhật thông số chung
        percentText.innerText = `${totalPercent.toFixed(1)}%`;
        speedText.innerText = `${(Math.random() * 3 + 2).toFixed(1)} MB/s`; // Tốc độ giả lập 2-5 MB/s
        etaText.innerText = `00:00:${Math.floor(Math.random() * 40 + 10)}`;

        // Hoàn thành
        if (activeThreads === 0 && !isComplete) {
            isComplete = true;
            clearInterval(interval);
            statusText.className = 'status completed';
            statusText.innerText = 'Hoàn thành';
            speedText.innerText = '0 KB/s';
            etaText.innerText = '-';
            percentText.innerText = '100% (Đã ghép nối file)';
            rowElement.querySelectorAll('.progress-segment').forEach(el => el.style.background = '#2ecc71');
        }
    }, 200);
}