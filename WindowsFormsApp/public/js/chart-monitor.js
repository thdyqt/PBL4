/**
 * DUT Download Accelerator - Real-Time Performance & Speed Chart (Chart.js)
 * High-frequency telemetry monitor (500ms polling from C# IPC)
 */
(function (global) {
    'use strict';

    // Telemetry History Buffers
    let currentRangeSeconds = 30; // 30s, 60s, 120s
    let maxPoints = 60; // 30s * 2 points/sec (500ms)
    let isStreamPaused = false;
    let peakSpeedBytes = 0;

    const history = {
        labels: [],
        speedKbps: [],
        cpuPercent: [],
        ramMb: []
    };

    let speedChartInstance = null;
    let cpuChartInstance = null;
    let ramChartInstance = null;
    let isInitialized = false;

    // Helper: format bytes/sec to human readable string
    function formatSpeed(bytesPerSec) {
        if (!bytesPerSec || bytesPerSec <= 0) return "0 B/s";
        const units = ["B/s", "KB/s", "MB/s", "GB/s"];
        let i = 0;
        let val = Number(bytesPerSec);
        while (val >= 1024 && i < units.length - 1) {
            val /= 1024;
            i++;
        }
        return val.toFixed(i === 0 ? 0 : 2) + " " + units[i];
    }

    // Helper: format bytes to human readable string
    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let i = 0;
        let val = Number(bytes);
        while (val >= 1024 && i < units.length - 1) {
            val /= 1024;
            i++;
        }
        return val.toFixed(i === 0 ? 0 : 2) + " " + units[i];
    }

    // Detect if current theme is Dark Mode
    function isDarkTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    // Get chart theme configuration (colors, gridlines, fonts)
    function getThemeColors() {
        const dark = isDarkTheme();
        return {
            dark: dark,
            textColor: dark ? '#cbd5e1' : '#64748b',
            gridColor: dark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.7)',
            speedBorder: dark ? '#38bdf8' : '#2563eb',
            speedFillTop: dark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(37, 99, 235, 0.28)',
            speedFillBottom: dark ? 'rgba(56, 189, 248, 0.0)' : 'rgba(37, 99, 235, 0.0)',
            cpuBorder: dark ? '#c084fc' : '#9333ea',
            cpuFillTop: dark ? 'rgba(192, 132, 252, 0.3)' : 'rgba(147, 51, 234, 0.25)',
            cpuFillBottom: 'rgba(147, 51, 234, 0.0)',
            ramBorder: dark ? '#34d399' : '#10b981',
            ramFillTop: dark ? 'rgba(52, 211, 153, 0.3)' : 'rgba(16, 185, 129, 0.25)',
            ramFillBottom: 'rgba(16, 185, 129, 0.0)'
        };
    }

    // Create a smooth vertical linear gradient for canvas fills
    function createGradient(ctx, height, colorTop, colorBottom) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height || 250);
        gradient.addColorStop(0, colorTop);
        gradient.addColorStop(1, colorBottom);
        return gradient;
    }

    // Initialize all 3 Chart.js instances
    function initCharts() {
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js is not loaded yet.");
            return;
        }

        const colors = getThemeColors();
        const fontConfig = {
            family: "'Lexend Deca', -apple-system, BlinkMacSystemFont, sans-serif",
            size: 11
        };

        if (history.labels.length === 0) {
            const timeLabel = new Date().toTimeString().split(' ')[0];
            history.labels.push(timeLabel);
            history.speedKbps.push(0);
            history.cpuPercent.push(0);
            history.ramMb.push(0);
        }

        // 1. Main Speed Chart
        const speedCanvas = document.getElementById("speed-chart-canvas");
        if (speedCanvas && !speedChartInstance) {
            const ctx = speedCanvas.getContext("2d");
            speedChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: history.labels,
                    datasets: [{
                        label: 'Tốc độ tải (Throughput)',
                        data: history.speedKbps,
                        borderColor: colors.speedBorder,
                        borderWidth: 2.5,
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            if (!chartArea) return null;
                            return createGradient(ctx, chartArea.bottom, colors.speedFillTop, colors.speedFillBottom);
                        },
                        fill: true,
                        tension: 0.35,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: colors.speedBorder,
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: colors.dark ? '#0f172a' : '#1e293b',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: colors.dark ? '#334155' : '#cbd5e1',
                            borderWidth: 1,
                            padding: 10,
                            titleFont: { ...fontConfig, weight: 'bold' },
                            bodyFont: fontConfig,
                            callbacks: {
                                label: function(ctx) {
                                    const kbps = ctx.parsed.y || 0;
                                    const bytesPerSec = kbps * 1024;
                                    return ' ' + formatSpeed(bytesPerSec);
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: colors.textColor,
                                font: fontConfig,
                                maxTicksLimit: 8,
                                maxRotation: 0
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: colors.gridColor },
                            ticks: {
                                color: colors.textColor,
                                font: fontConfig,
                                callback: function(val) {
                                    const bytesPerSec = val * 1024;
                                    return formatSpeed(bytesPerSec);
                                }
                            }
                        }
                    }
                }
            });
        }

        // 2. CPU Usage Chart
        const cpuCanvas = document.getElementById("cpu-chart-canvas");
        if (cpuCanvas && !cpuChartInstance) {
            const ctx = cpuCanvas.getContext("2d");
            cpuChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: history.labels,
                    datasets: [{
                        label: 'CPU (%)',
                        data: history.cpuPercent,
                        borderColor: colors.cpuBorder,
                        borderWidth: 2,
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            if (!chartArea) return null;
                            return createGradient(ctx, chartArea.bottom, colors.cpuFillTop, colors.cpuFillBottom);
                        },
                        fill: true,
                        tension: 0.35,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: colors.dark ? '#0f172a' : '#1e293b',
                            callbacks: {
                                label: function(ctx) {
                                    return ' CPU: ' + (ctx.parsed.y || 0).toFixed(1) + '%';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: false
                        },
                        y: {
                            min: 0,
                            suggestedMax: 20,
                            grid: { color: colors.gridColor },
                            ticks: {
                                color: colors.textColor,
                                font: fontConfig,
                                callback: function(val) { return val + '%'; }
                            }
                        }
                    }
                }
            });
        }

        // 3. RAM Working Set Chart
        const ramCanvas = document.getElementById("ram-chart-canvas");
        if (ramCanvas && !ramChartInstance) {
            const ctx = ramCanvas.getContext("2d");
            ramChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: history.labels,
                    datasets: [{
                        label: 'RAM (MB)',
                        data: history.ramMb,
                        borderColor: colors.ramBorder,
                        borderWidth: 2,
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            if (!chartArea) return null;
                            return createGradient(ctx, chartArea.bottom, colors.ramFillTop, colors.ramFillBottom);
                        },
                        fill: true,
                        tension: 0.35,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: colors.dark ? '#0f172a' : '#1e293b',
                            callbacks: {
                                label: function(ctx) {
                                    return ' RAM: ' + (ctx.parsed.y || 0).toFixed(1) + ' MB';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: false
                        },
                        y: {
                            beginAtZero: false,
                            grid: { color: colors.gridColor },
                            ticks: {
                                color: colors.textColor,
                                font: fontConfig,
                                callback: function(val) { return Math.round(val) + ' MB'; }
                            }
                        }
                    }
                }
            });
        }

        isInitialized = true;
    }

    // Reapply theme colors to Chart instances if theme changed
    function updateChartsTheme() {
        if (!isInitialized) return;
        const colors = getThemeColors();

        [speedChartInstance, cpuChartInstance, ramChartInstance].forEach(chart => {
            if (!chart) return;
            if (chart.options.scales.x && chart.options.scales.x.ticks) {
                chart.options.scales.x.ticks.color = colors.textColor;
            }
            if (chart.options.scales.y) {
                if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = colors.textColor;
                if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = colors.gridColor;
            }
            chart.update('none');
        });
    }

    // Active downloading tasks tracker (real-time telemetry fallback)
    const activeTasksMap = new Map(); // taskId -> { speed, threads, state, lastSeen }

    // Handle individual download task progress ticks (emitted every ~400ms from C#)
    function handleDownloadProgress(d) {
        if (!d || !d.taskId) return;
        const now = Date.now();
        if (d.state === "downloading") {
            activeTasksMap.set(d.taskId, {
                speed: Number(d.speed) || 0,
                threads: Number(d.threads) || 1,
                state: d.state,
                lastSeen: now
            });
        } else {
            activeTasksMap.delete(d.taskId);
        }

        // Clean up stale tasks (> 3.5s without progress)
        activeTasksMap.forEach((val, key) => {
            if (now - val.lastSeen > 3500) activeTasksMap.delete(key);
        });

        const activeCount = activeTasksMap.size;
        let sumSpeed = 0;
        let sumThreads = 0;
        activeTasksMap.forEach(item => {
            sumSpeed += item.speed;
            sumThreads += item.threads;
        });

        // Fast update KPI card so speed is instantly responsive
        if (activeCount > 0 && sumSpeed > 0) {
            const speedEl = document.getElementById("kpi-live-speed");
            if (speedEl) speedEl.textContent = formatSpeed(sumSpeed);

            if (sumSpeed > peakSpeedBytes) {
                peakSpeedBytes = sumSpeed;
                const peakEl = document.getElementById("kpi-speed-peak");
                if (peakEl) {
                    const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
                    peakEl.textContent = t("chart.speed_peak", "Đỉnh: {0}").replace("{0}", formatSpeed(peakSpeedBytes));
                }
            }

            const threadsEl = document.getElementById("kpi-live-threads");
            if (threadsEl) threadsEl.textContent = sumThreads + " luồng";

            const threadsSub = document.getElementById("kpi-threads-sub");
            if (threadsSub) {
                const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
                threadsSub.textContent = t("chart.threads_sub", "{0} tệp đang kết nối").replace("{0}", activeCount);
            }
        }
    }

    // Process incoming PERFORMANCE_METRICS message from C# (500ms heartbeat)
    function handleMetrics(metrics) {
        if (!metrics) return;

        let totalSpeed = Number(metrics.totalSpeed) || 0;
        let activeThreads = Number(metrics.activeThreads) || 0;
        let activeJobs = Number(metrics.activeJobs) || 0;
        const cpuPercent = Number(metrics.cpuPercent) || 0;
        const ramUsedBytes = Number(metrics.ramUsedBytes) || 0;
        const totalRamBytes = Number(metrics.totalRamBytes) || (8 * 1024 * 1024 * 1024);
        const processorCount = Number(metrics.processorCount) || 8;

        // Dual-source fusion: if C# aggregate metrics speed is 0 but active downloads are reporting speed
        const nowMs = Date.now();
        activeTasksMap.forEach((val, key) => {
            if (nowMs - val.lastSeen > 3500) activeTasksMap.delete(key);
        });

        let progressSpeedSum = 0;
        let progressThreadsSum = 0;
        activeTasksMap.forEach(item => {
            progressSpeedSum += item.speed;
            progressThreadsSum += item.threads;
        });

        if (totalSpeed <= 0 && progressSpeedSum > 0) {
            totalSpeed = progressSpeedSum;
        }
        if (activeThreads <= 0 && progressThreadsSum > 0) {
            activeThreads = progressThreadsSum;
        }
        if (activeJobs <= 0 && activeTasksMap.size > 0) {
            activeJobs = activeTasksMap.size;
        }

        if (totalSpeed > peakSpeedBytes) {
            peakSpeedBytes = totalSpeed;
        }

        // 1. Update KPI Cards in UI
        const speedEl = document.getElementById("kpi-live-speed");
        if (speedEl) speedEl.textContent = formatSpeed(totalSpeed);

        const peakEl = document.getElementById("kpi-speed-peak");
        if (peakEl) {
            const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
            peakEl.textContent = t("chart.speed_peak", "Đỉnh: {0}").replace("{0}", formatSpeed(peakSpeedBytes));
        }

        const cpuEl = document.getElementById("kpi-live-cpu");
        if (cpuEl) cpuEl.textContent = cpuPercent.toFixed(1) + "%";

        const cpuBar = document.getElementById("kpi-cpu-bar");
        if (cpuBar) cpuBar.style.width = Math.min(100, Math.max(2, cpuPercent)) + "%";

        const cpuSub = document.getElementById("kpi-cpu-sub");
        if (cpuSub) {
            const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
            cpuSub.textContent = t("chart.cpu_sub", "Tiến trình trên {0} nhân logic").replace("{0}", processorCount);
        }

        const ramMb = ramUsedBytes / (1024 * 1024);
        const ramEl = document.getElementById("kpi-live-ram");
        if (ramEl) ramEl.textContent = ramMb.toFixed(1) + " MB";

        const ramPct = (ramUsedBytes / totalRamBytes) * 100;
        const ramBar = document.getElementById("kpi-ram-bar");
        if (ramBar) ramBar.style.width = Math.min(100, Math.max(2, ramPct)) + "%";

        const ramSub = document.getElementById("kpi-ram-sub");
        if (ramSub) {
            const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
            ramSub.textContent = t("chart.ram_sub", "Working Set ({0}% RAM máy)").replace("{0}", ramPct.toFixed(1));
        }

        const threadsEl = document.getElementById("kpi-live-threads");
        if (threadsEl) {
            threadsEl.textContent = activeThreads + " luồng";
        }

        const threadsSub = document.getElementById("kpi-threads-sub");
        if (threadsSub) {
            const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
            threadsSub.textContent = t("chart.threads_sub", "{0} tệp đang kết nối").replace("{0}", activeJobs);
        }

        const cpuPill = document.getElementById("chart-cpu-pill");
        if (cpuPill) cpuPill.textContent = cpuPercent.toFixed(1) + "%";

        const ramPill = document.getElementById("chart-ram-pill");
        if (ramPill) ramPill.textContent = ramMb.toFixed(1) + " MB";

        // 2. Buffer data for charts (unless paused)
        if (!isStreamPaused) {
            const now = new Date();
            const timeLabel = now.toTimeString().split(' ')[0]; // HH:mm:ss
            const speedKb = totalSpeed / 1024.0;

            history.labels.push(timeLabel);
            history.speedKbps.push(speedKb);
            history.cpuPercent.push(cpuPercent);
            history.ramMb.push(ramMb);

            // Trim old points to match selected window
            while (history.labels.length > maxPoints) {
                history.labels.shift();
                history.speedKbps.shift();
                history.cpuPercent.shift();
                history.ramMb.shift();
            }

            // 3. Render updates to charts if tab is open
            const sectionChart = document.getElementById("section-chart");
            if (sectionChart && sectionChart.style.display !== "none") {
                if (!isInitialized) initCharts();

                if (speedChartInstance) speedChartInstance.update('none');
                if (cpuChartInstance) cpuChartInstance.update('none');
                if (ramChartInstance) ramChartInstance.update('none');
            }
        }
    }

    // Toggle Pause/Resume Stream
    function toggleStream() {
        isStreamPaused = !isStreamPaused;
        const icon = document.getElementById("chart-pause-icon");
        const text = document.getElementById("chart-pause-text");
        const indicator = document.getElementById("chart-live-indicator");
        const liveText = indicator ? indicator.querySelector(".live-text") : null;
        const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;

        if (isStreamPaused) {
            if (icon) icon.className = "fa-solid fa-play";
            if (text) text.textContent = t("chart.btn_resume", "Tiếp tục vẽ");
            if (indicator) indicator.classList.add("paused");
            if (liveText) liveText.textContent = t("chart.paused_badge", "ĐÃ TẠM DỪNG VẼ");
        } else {
            if (icon) icon.className = "fa-solid fa-pause";
            if (text) text.textContent = t("chart.btn_pause", "Tạm dừng vẽ");
            if (indicator) indicator.classList.remove("paused");
            if (liveText) liveText.textContent = t("chart.live", "TRỰC TIẾP");
        }
    }

    // Clear chart history
    function clearHistory() {
        history.labels.length = 0;
        history.speedKbps.length = 0;
        history.cpuPercent.length = 0;
        history.ramMb.length = 0;
        peakSpeedBytes = 0;

        if (speedChartInstance) speedChartInstance.update('none');
        if (cpuChartInstance) cpuChartInstance.update('none');
        if (ramChartInstance) ramChartInstance.update('none');

        const peakEl = document.getElementById("kpi-speed-peak");
        if (peakEl) peakEl.textContent = "Đỉnh: 0 B/s";
    }

    // Set time range window (30s, 60s, 120s)
    function setTimeRange(seconds) {
        currentRangeSeconds = Number(seconds) || 30;
        maxPoints = Math.round(currentRangeSeconds * 2); // 2 points per second at 500ms

        document.querySelectorAll(".btn-time-range").forEach(btn => {
            const isActive = Number(btn.dataset.range) === currentRangeSeconds;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        // Trim buffer if shrank
        while (history.labels.length > maxPoints) {
            history.labels.shift();
            history.speedKbps.shift();
            history.cpuPercent.shift();
            history.ramMb.shift();
        }

        if (speedChartInstance) speedChartInstance.update('none');
    }

    // Called when user opens the "Giám sát tốc độ" tab
    function onOpenTab() {
        setTimeout(() => {
            if (!isInitialized) {
                initCharts();
            } else {
                updateChartsTheme();
            }
            if (speedChartInstance) {
                speedChartInstance.resize();
                speedChartInstance.update('none');
            }
            if (cpuChartInstance) {
                cpuChartInstance.resize();
                cpuChartInstance.update('none');
            }
            if (ramChartInstance) {
                ramChartInstance.resize();
                ramChartInstance.update('none');
            }
        }, 60);

        // Request immediate snapshot from C# backend
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify({ action: "GET_PERFORMANCE_METRICS" }));
        }
    }

    // Attach event listeners
    function setupEvents() {
        // Time range buttons
        document.addEventListener("click", (e) => {
            const btnRange = e.target.closest(".btn-time-range");
            if (btnRange && btnRange.dataset.range) {
                setTimeRange(btnRange.dataset.range);
                return;
            }

            const btnPause = e.target.closest("#btn-toggle-chart-stream");
            if (btnPause) {
                toggleStream();
                return;
            }

            const btnClear = e.target.closest("#btn-clear-chart-data");
            if (btnClear) {
                clearHistory();
                return;
            }
        });

        // Watch for Dark/Light theme changes to keep Chart colors synchronized
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.attributeName === 'data-theme') {
                    updateChartsTheme();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Responsive resize listener with debounce
        let resizeTimer = null;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (speedChartInstance) speedChartInstance.resize();
                if (cpuChartInstance) cpuChartInstance.resize();
                if (ramChartInstance) ramChartInstance.resize();
            }, 100);
        });

        // Synchronize labels and tooltips when language changes
        window.addEventListener("app:languagechange", () => {
            const t = (k, fb) => (window.i18n && window.i18n.t) ? window.i18n.t(k, fb) : fb;
            const fmt = (k, ...args) => (window.i18n && window.i18n.format) ? window.i18n.format(k, ...args) : args[0];

            // Update peak speed
            const peakEl = document.getElementById("kpi-speed-peak");
            if (peakEl) {
                peakEl.textContent = t("chart.speed_peak", "??nh: {0}").replace("{0}", formatSpeed(peakSpeedBytes));
            }

            // Update thread subtext
            const threadsSub = document.getElementById("kpi-threads-sub");
            if (threadsSub) {
                threadsSub.textContent = t("chart.threads_sub", "{0} t?p ?ang k?t n?i").replace("{0}", activeTasksMap.size);
            }

            // Update stream pause/resume button label
            const text = document.getElementById("chart-pause-text");
            const indicator = document.getElementById("chart-live-indicator");
            const liveText = indicator ? indicator.querySelector(".live-text") : null;
            if (isStreamPaused) {
                if (text) text.textContent = t("chart.btn_resume", "Ti?p t?c v?");
                if (liveText) liveText.textContent = t("chart.paused_badge", "?? T?M D?NG V?");
            } else {
                if (text) text.textContent = t("chart.btn_pause", "T?m d?ng v?");
                if (liveText) liveText.textContent = t("chart.live", "TR?C TI?P");
            }
        });

        // Listen for IPC messages from C#
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.addEventListener("message", (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.action === "PERFORMANCE_METRICS") {
                        handleMetrics(msg.data);
                    } else if (msg.action === "DOWNLOAD_PROGRESS") {
                        handleDownloadProgress(msg.data);
                    }
                } catch (e) { }
            });
        }
    }

    // Expose API globally
    global.initSpeedCharts = onOpenTab;
    global.onOpenChartTab = onOpenTab;
    global.handleDownloadProgressForChart = handleDownloadProgress;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupEvents);
    } else {
        setupEvents();
    }

})(window);
