const { ipcRenderer } = require('electron');

// 元素
const pipVideo = document.getElementById('pipVideo');
const recordingIndicator = document.getElementById('recordingIndicator');
const timerElement = document.getElementById('timer');
const closeBtn = document.getElementById('closeBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const alwaysTopBtn = document.getElementById('alwaysTopBtn');

// 状态
let isRecording = false;
let recordingStartTime = null;
let timerInterval = null;

// 初始化
async function init() {
    // 监听来自主窗口的消息
    ipcRenderer.on('set-video-stream', (event, streamId) => {
        // 这里需要获取视频流，实际情况可能需要更复杂的处理
        console.log('设置视频流:', streamId);
    });
    
    ipcRenderer.on('start-recording', (event, startTime) => {
        isRecording = true;
        recordingStartTime = startTime;
        recordingIndicator.style.display = 'flex';
        startTimer();
    });
    
    ipcRenderer.on('stop-recording', () => {
        isRecording = false;
        recordingIndicator.style.display = 'none';
        stopTimer();
    });
    
    ipcRenderer.on('update-timer', (event, time) => {
        if (timerElement) {
            timerElement.textContent = time;
            timerElement.style.display = 'block';
        }
    });
    
    // 按钮事件
    closeBtn.addEventListener('click', () => {
        ipcRenderer.send('pip-window-close');
    });
    
    minimizeBtn.addEventListener('click', () => {
        ipcRenderer.send('pip-window-minimize');
    });
    
    alwaysTopBtn.addEventListener('click', () => {
        ipcRenderer.send('pip-window-toggle-always-on-top');
    });
    
    // 设置窗口可拖拽
    makeWindowDraggable();
}

// 设置窗口可拖拽
function makeWindowDraggable() {
    let isDragging = false;
    let startX, startY;
    
    document.addEventListener('mousedown', (e) => {
        // 如果点击的是按钮，不启动拖拽
        if (e.target.closest('.control-btn')) {
            return;
        }
        
        isDragging = true;
        startX = e.screenX;
        startY = e.screenY;
        
        document.body.style.cursor = 'grabbing';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.screenX - startX;
        const dy = e.screenY - startY;
        
        ipcRenderer.send('pip-window-move', { dx, dy });
        
        startX = e.screenX;
        startY = e.screenY;
    });
    
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        
        isDragging = false;
        document.body.style.cursor = 'default';
    });
}

// 计时器
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (!recordingStartTime) return;
        
        const elapsed = Date.now() - recordingStartTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        const timeStr = 
            `${hours.toString().padStart(2, '0')}:` +
            `${minutes.toString().padStart(2, '0')}:` +
            `${seconds.toString().padStart(2, '0')}`;
        
        if (timerElement) {
            timerElement.textContent = timeStr;
            timerElement.style.display = 'block';
        }
        
        // 发送给主进程
        ipcRenderer.send('pip-timer-update', timeStr);
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    if (timerElement) {
        timerElement.style.display = 'none';
    }
}

// 启动
document.addEventListener('DOMContentLoaded', init);