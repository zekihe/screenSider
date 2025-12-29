// 状态管理
class RecorderState {
    constructor() {
        this.selectedSourceId = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.permissions = {
            screen: 'not-determined',
            camera: 'not-determined',
            microphone: 'not-determined'
        };
        this.cameraStream = null;
        this.cameraEnabled = false;
        this.pipPosition = 'bottom-right';
        this.pipSize = 160;
        this.recordingStartTime = null;
        this.timerInterval = null;
        this.currentVideoBlob = null;

        // 添加样式相关属性
        this.pipStyle = 'rounded'; // rectangle, rounded, circle
        this.showBorder = true;
        this.showShadow = true;
        this.borderColor = '#667eea';
        this.borderWidth = 3;
    }
}

const state = new RecorderState();

// DOM 元素
const elements = {
    // 基础元素
    sourcesList: document.getElementById('sourcesList'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    status: document.getElementById('status'),
    permissionWarning: document.getElementById('permissionWarning'),
    permissionDetails: document.getElementById('permissionDetails'),
    previewArea: document.getElementById('previewArea'),
    previewPlaceholder: document.getElementById('previewPlaceholder'),
    recordingTimer: document.getElementById('recordingTimer'),
    timer: document.getElementById('timer'),
    
    // 摄像头相关
    cameraToggle: document.getElementById('cameraToggle'),
    cameraPreview: document.getElementById('cameraPreview'),
    cameraPreviewContainer: document.getElementById('cameraPreviewContainer'),
    cameraPip: document.getElementById('cameraPip'),
    cameraPipVideo: document.getElementById('cameraPipVideo'),
    pipOptions: document.querySelectorAll('.pip-option'),
    pipSizeSlider: document.getElementById('pipSize'),
    pipSizeValue: document.getElementById('pipSizeValue'),
    
    // 视频预览
    videoPreview: document.getElementById('videoPreview'),
    resultVideo: document.getElementById('resultVideo')
};

// 初始化应用
async function init() {
    console.log('初始化屏幕录制应用...');
    
    // 检查权限
    await checkPermissions();
    
    // 加载屏幕源
    await loadSources();
    
    // 初始化摄像头
    initCameraControls();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 加载保存的设置
    loadSettings();
    
    console.log('应用初始化完成');
}

// 检查权限
async function checkPermissions() {
    try {
        state.permissions = await window.electronAPI.checkPermissions();
        updatePermissionDisplay();
    } catch (error) {
        console.error('检查权限失败:', error);
    }
}

// 更新权限显示
function updatePermissionDisplay() {
    const { screen, camera, microphone } = state.permissions;
    
    let warnings = [];
    if (screen !== 'granted') warnings.push('屏幕录制权限');
    if (camera !== 'granted') warnings.push('摄像头权限');
    if (microphone !== 'granted') warnings.push('麦克风权限');
    
    if (warnings.length > 0) {
        elements.permissionDetails.innerHTML = `
            <p>缺少以下权限:</p>
            <ul style="text-align: left; margin: 10px 0;">
                ${warnings.map(w => `<li>${w}</li>`).join('')}
            </ul>
            <p>应用功能将受到限制</p>
        `;
        elements.permissionWarning.style.display = 'block';
    } else {
        elements.permissionWarning.style.display = 'none';
    }
}

// 请求所有权限
async function requestAllPermissions() {
    try {
        if (state.permissions.screen !== 'granted') {
            const granted = await window.electronAPI.requestPermission('screen');
            state.permissions.screen = granted ? 'granted' : 'denied';
        }
        
        if (state.permissions.camera !== 'granted') {
            const granted = await window.electronAPI.requestPermission('camera');
            state.permissions.camera = granted ? 'granted' : 'denied';
        }
        
        if (state.permissions.microphone !== 'granted') {
            const granted = await window.electronAPI.requestPermission('microphone');
            state.permissions.microphone = granted ? 'granted' : 'denied';
        }
        
        updatePermissionDisplay();
        
        // 如果摄像头权限被授予，初始化摄像头
        if (state.permissions.camera === 'granted' && state.cameraEnabled) {
            await initCamera();
        }
        
    } catch (error) {
        console.error('请求权限失败:', error);
        alert('请求权限时出错: ' + error.message);
    }
}

// 加载屏幕源
async function loadSources() {
    try {
        elements.sourcesList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">加载中...</div>';
        
        const sources = await window.electronAPI.getSources();
        
        if (sources.length === 0) {
            elements.sourcesList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">未找到可录制的屏幕</div>';
            return;
        }
        
        elements.sourcesList.innerHTML = '';
        
        sources.forEach(source => {
            const sourceItem = document.createElement('div');
            sourceItem.className = 'source-item';
            sourceItem.dataset.id = source.id;
            
            sourceItem.innerHTML = `
                <img src="${source.thumbnail}" class="source-thumbnail" alt="${source.name}">
                <p style="font-size: 14px; margin: 5px 0;">${source.name}</p>
            `;
            
            sourceItem.addEventListener('click', () => {
                // 移除之前选中的
                document.querySelectorAll('.source-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // 选中当前
                sourceItem.classList.add('selected');
                state.selectedSourceId = source.id;
                elements.startBtn.disabled = false;
                
                // 更新预览区域提示
                elements.previewPlaceholder.innerHTML = `
                    <i class="fas fa-check-circle" style="color: #28a745;"></i>
                    <p>已选择: ${source.name}</p>
                    <p style="font-size: 12px; color: #999;">点击开始录制按钮开始录制</p>
                `;
                
                console.log('选择了屏幕:', source.name, 'ID:', source.id);
            });
            
            elements.sourcesList.appendChild(sourceItem);
        });
        
        // 默认选择第一个
        if (sources.length > 0) {
            const firstItem = elements.sourcesList.querySelector('.source-item');
            if (firstItem) {
                firstItem.click();
            }
        }
        
    } catch (error) {
        console.error('加载屏幕源失败:', error);
        elements.sourcesList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #ff3b30;">
                <i class="fas fa-exclamation-triangle"></i><br>
                加载失败: ${error.message}
            </div>
        `;
    }
}

// 初始化摄像头控制
function initCameraControls() {
    // 摄像头开关
    elements.cameraToggle.addEventListener('change', async (e) => {
        state.cameraEnabled = e.target.checked;
        saveSettings();
        
        if (state.cameraEnabled) {
            // 检查权限
            if (state.permissions.camera !== 'granted') {
                const granted = await window.electronAPI.requestPermission('camera');
                state.permissions.camera = granted ? 'granted' : 'denied';
                updatePermissionDisplay();
                
                if (!granted) {
                    elements.cameraToggle.checked = false;
                    state.cameraEnabled = false;
                    alert('需要摄像头权限才能启用画中画功能');
                    return;
                }
            }
            
            // 初始化摄像头
            await initCamera();
        } else {
            // 关闭摄像头
            stopCamera();
        }
    });
    
    // 画中画位置选择
    elements.pipOptions.forEach(option => {
        option.addEventListener('click', () => {
            elements.pipOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            state.pipPosition = option.dataset.position;
            updateCameraPipPosition();
            saveSettings();
        });
    });
    
    // 画中画大小控制
    elements.pipSizeSlider.addEventListener('input', (e) => {
        state.pipSize = parseInt(e.target.value);
        updatePipSizeDisplay();
        updateCameraPipSize();
        saveSettings();
    });

     // 样式选择
    const styleOptions = document.querySelectorAll('.style-option');
    styleOptions.forEach(option => {
        option.addEventListener('click', () => {
            styleOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            state.pipStyle = option.dataset.style;
            updateCameraPipStyle();
            saveSettings();
        });
    });

    // 边框开关
    document.getElementById('showBorder').addEventListener('change', (e) => {
        state.showBorder = e.target.checked;
        document.getElementById('borderColorPicker').style.display = 
            state.showBorder ? 'block' : 'none';
        updateCameraPipStyle();
        saveSettings();
    });
    
    // 阴影开关
    document.getElementById('showShadow').addEventListener('change', (e) => {
        state.showShadow = e.target.checked;
        updateCameraPipStyle();
        saveSettings();
    });

    // 边框颜色
    document.getElementById('borderColor').addEventListener('input', (e) => {
        state.borderColor = e.target.value;
        updateCameraPipStyle();
        saveSettings();
    });
    
    // 初始更新大小显示
    updatePipSizeDisplay();
}

// 更新画中画大小显示
function updatePipSizeDisplay() {
    let sizeText = '小';
    if (state.pipSize > 200) sizeText = '大';
    else if (state.pipSize > 140) sizeText = '中';
    elements.pipSizeValue.textContent = sizeText;
}

// 更新画中画样式
function updateCameraPipStyle() {
    if (!elements.cameraPip.style.display || elements.cameraPip.style.display === 'none') {
        return;
    }
    
    const pip = elements.cameraPip;
    
    // 移除所有样式类
    pip.classList.remove('rectangle', 'rounded', 'circle', 'with-border', 'with-shadow');
    
    // 添加形状样式
    pip.classList.add(state.pipStyle);
    
    // 添加边框样式
    if (state.showBorder) {
        pip.classList.add('with-border');
        pip.style.borderColor = state.borderColor;
        pip.style.borderWidth = `${state.borderWidth}px`;
    } else {
        pip.style.borderWidth = '0';
    }
    
    // 添加阴影样式
    if (state.showShadow) {
        pip.classList.add('with-shadow');
    } else {
        pip.style.boxShadow = 'none';
    }
    
    // 对于圆形样式，需要调整视频元素的圆角
    if (state.pipStyle === 'circle') {
        elements.cameraPipVideo.style.borderRadius = '50%';
    } else if (state.pipStyle === 'rounded') {
        elements.cameraPipVideo.style.borderRadius = '12px';
    } else {
        elements.cameraPipVideo.style.borderRadius = '0';
    }
}

// 初始化摄像头
async function initCamera() {
    if (!state.cameraEnabled || state.cameraStream) {
        return;
    }
    
    try {
        // 获取摄像头流
        state.cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            },
            audio: false
        });
        
        // 设置预览视频源
        elements.cameraPreview.srcObject = state.cameraStream;
        elements.cameraPreviewContainer.style.display = 'block';
        
        // 设置画中画视频源
        elements.cameraPipVideo.srcObject = state.cameraStream;
        elements.cameraPip.style.display = 'block';
        
        // 更新画中画位置和大小
        updateCameraPipPosition();
        updateCameraPipSize();
        
        // 启用画中画拖拽
        setupCameraPipDrag();
        
        console.log('摄像头初始化成功');
        
    } catch (error) {
        console.error('摄像头初始化失败:', error);
        alert('无法访问摄像头: ' + error.message);
        
        // 重置状态
        elements.cameraToggle.checked = false;
        state.cameraEnabled = false;
        state.cameraStream = null;
    }
}

// 停止摄像头
function stopCamera() {
    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(track => track.stop());
        state.cameraStream = null;
    }
    
    elements.cameraPreview.srcObject = null;
    elements.cameraPipVideo.srcObject = null;
    elements.cameraPreviewContainer.style.display = 'none';
    elements.cameraPip.style.display = 'none';
    
    console.log('摄像头已停止');
}

// 切换画中画显示
function toggleCameraPip() {
    if (state.cameraEnabled && state.cameraStream) {
        state.cameraEnabled = false;
        elements.cameraToggle.checked = false;
        stopCamera();
    }
}

// 更新画中画位置
function updateCameraPipPosition() {
    if (!elements.cameraPip.style.display || elements.cameraPip.style.display === 'none') {
        return;
    }
    
    const positions = {
        'top-left': { top: '20px', left: '20px', right: 'auto', bottom: 'auto' },
        'top-right': { top: '20px', right: '20px', left: 'auto', bottom: 'auto' },
        'bottom-left': { bottom: '20px', left: '20px', right: 'auto', top: 'auto' },
        'bottom-right': { bottom: '20px', right: '20px', left: 'auto', top: 'auto' }
    };
    
    const pos = positions[state.pipPosition] || positions['bottom-right'];
    Object.assign(elements.cameraPip.style, pos);
}

// 更新画中画大小
function updateCameraPipSize() {
    if (!elements.cameraPip.style.display || elements.cameraPip.style.display === 'none') {
        return;
    }
    
    elements.cameraPip.style.width = `${state.pipSize}px`;
    elements.cameraPip.style.height = `${state.pipSize * 0.75}px`; // 保持 4:3 比例
}


// 修改 setupCameraPipDrag 函数，使事件处理器可访问
let startDrag, drag, stopDrag, handleTouchStart, handleTouchMove, handleTouchEnd;
// 设置画中画拖拽功能
function setupCameraPipDrag() {
    const pip = elements.cameraPip;
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    // 定义事件处理器
    startDrag = function(e) {
        // 如果正在录制，不允许拖拽
        if (state.isRecording) {
            return;
        }
        
        // 如果点击的是关闭按钮或调整大小手柄，不启动拖拽
        if (e.target.closest('.pip-close') || e.target.closest('.pip-resize')) {
            return;
        }
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = pip.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        pip.style.opacity = '0.8';
        pip.style.cursor = 'grabbing';
        
        e.preventDefault();
    };
    
    drag = function(e) {
        if (!isDragging || state.isRecording) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newX = initialX + dx;
        let newY = initialY + dy;
        
        // 限制在预览区域内
        const previewRect = elements.previewArea.getBoundingClientRect();
        const pipRect = pip.getBoundingClientRect();
        
        newX = Math.max(previewRect.left, Math.min(newX, previewRect.right - pipRect.width));
        newY = Math.max(previewRect.top, Math.min(newY, previewRect.bottom - pipRect.height));
        
        // 转换为相对于预览区域的百分比位置
        const relativeX = ((newX - previewRect.left) / previewRect.width) * 100;
        const relativeY = ((newY - previewRect.top) / previewRect.height) * 100;
        
        pip.style.left = `${relativeX}%`;
        pip.style.top = `${relativeY}%`;
        pip.style.right = 'auto';
        pip.style.bottom = 'auto';
        
        // 保存自定义位置
        state.pipPosition = 'custom';
        saveSettings();
    };
    
    stopDrag = function() {
        if (!isDragging || state.isRecording) return;
        
        isDragging = false;
        pip.style.opacity = '1';
        pip.style.cursor = 'move';
    };
    
    // 触摸事件处理器
    handleTouchStart = function(e) {
        if (state.isRecording) return;
        e.preventDefault();
        startDrag(e.touches[0]);
    };
    
    handleTouchMove = function(e) {
        if (state.isRecording) return;
        e.preventDefault();
        drag(e.touches[0]);
    };
    
    handleTouchEnd = function(e) {
        if (state.isRecording) return;
        stopDrag();
    };
    
    // 移除之前的监听器（如果存在）
    pip.removeEventListener('mousedown', startDrag);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    pip.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    // 添加事件监听器
    pip.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    pip.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
}

// 开始录制
async function startRecording() {
    if (state.isRecording || !state.selectedSourceId) {
        return;
    }
    
    try {
        console.log('开始录制...');
        
        // 检查屏幕录制权限
        if (state.permissions.screen !== 'granted') {
            const granted = await window.electronAPI.requestPermission('screen');
            if (!granted) {
                alert('需要屏幕录制权限才能开始录制');
                return;
            }
            state.permissions.screen = 'granted';
            updatePermissionDisplay();
        }
        
        // 获取屏幕流
        const screenConstraints = {
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: state.selectedSourceId
                }
            }
        };
        
        console.log('获取屏幕流，约束:', screenConstraints);
        const screenStream = await navigator.mediaDevices.getUserMedia(screenConstraints);
        
        // 如果有摄像头，合并流
        let finalStream;
        if (state.cameraEnabled && state.cameraStream) {
            console.log('合并屏幕和摄像头流');
            
            // 创建一个新的 Canvas 来合并视频
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 创建视频元素来播放屏幕流
            const screenVideo = document.createElement('video');
            screenVideo.srcObject = screenStream;
            screenVideo.play();
            
            // 等待视频就绪
            await new Promise(resolve => {
                screenVideo.onloadedmetadata = () => {
                    canvas.width = screenVideo.videoWidth;
                    canvas.height = screenVideo.videoHeight;
                    resolve();
                };
            });
            
            // 创建摄像头视频元素
            const cameraVideo = document.createElement('video');
            cameraVideo.srcObject = state.cameraStream;
            cameraVideo.play();
            
            // 绘制函数
            function drawFrame() {
                // 绘制屏幕
                ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
                
                // 绘制摄像头画中画
                if (state.cameraEnabled) {
                    const pipWidth = canvas.width * 0.2; // 20% 宽度
                    const pipHeight = pipWidth * 0.75; // 保持 4:3 比例
                    
                    // 根据保存的位置计算坐标
                    let pipX, pipY;
                    switch (state.pipPosition) {
                        case 'top-left':
                            pipX = 10;
                            pipY = 10;
                            break;
                        case 'top-right':
                            pipX = canvas.width - pipWidth - 10;
                            pipY = 10;
                            break;
                        case 'bottom-left':
                            pipX = 10;
                            pipY = canvas.height - pipHeight - 10;
                            break;
                        case 'bottom-right':
                        default:
                            pipX = canvas.width - pipWidth - 10;
                            pipY = canvas.height - pipHeight - 10;
                            break;
                    }
                    
                    // 绘制摄像头视频
                    ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
                    
                    // 添加边框
                    ctx.strokeStyle = '#667eea';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);
                }
                
                requestAnimationFrame(drawFrame);
            }
            
            // 开始绘制
            drawFrame();
            
            // 从 Canvas 获取流
            finalStream = canvas.captureStream(30);
            
        } else {
            // 只录制屏幕
            finalStream = screenStream;
        }
        
        // 尝试获取音频
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            audioStream.getAudioTracks().forEach(track => {
                finalStream.addTrack(track);
            });
            console.log('音频流已添加');
        } catch (audioError) {
            console.warn('音频录制不可用:', audioError);
        }
        
        // 创建 MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
            ? 'video/webm; codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm; codecs=vp8')
            ? 'video/webm; codecs=vp8'
            : 'video/webm';
        
        console.log('使用的 MIME 类型:', mimeType);
        
        /**
         * 录制文件较大
         * 可以调整 videoBitsPerSecond 参数
         * 默认是 2.5 Mbps，可以降低到 1-2 Mbps
         */
        state.mediaRecorder = new MediaRecorder(finalStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 2500000 // 2.5 Mbps
        });
        
        // 收集数据
        state.recordedChunks = [];
        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.recordedChunks.push(event.data);
            }
        };
        
        // 录制完成
        state.mediaRecorder.onstop = () => {
            console.log('录制完成，数据块数量:', state.recordedChunks.length);
            
            // 创建视频 Blob
            const blobType = state.mediaRecorder.mimeType || 'video/webm';
            state.currentVideoBlob = new Blob(state.recordedChunks, { type: blobType });
            
            // 显示预览
            const videoURL = URL.createObjectURL(state.currentVideoBlob);
            elements.resultVideo.src = videoURL;
            elements.videoPreview.style.display = 'block';
            
            // 清理流
            finalStream.getTracks().forEach(track => track.stop());
            state.recordedChunks = [];

            // 恢复控件显示
            if (state.cameraEnabled) {
                elements.cameraPip.classList.remove('recording');
                // 重新启用拖拽功能
                if (state.cameraStream) {
                    setupCameraPipDrag();
                }
            }
            
            // 停止计时器
            stopTimer();
            
            // 更新UI
            updateUIForStopped();
            updateStatus('录制完成', 'success');
        };
        
        // 开始录制
        state.mediaRecorder.start(1000); // 每1秒收集一次数据
        state.isRecording = true;

        // 隐藏画中画控件
        if (state.cameraEnabled) {
            elements.cameraPip.classList.add('recording');
            // 禁用拖拽功能
            disableCameraPipDrag();
        }
        
        // 开始计时器
        startTimer();
        
        // 更新UI
        updateUIForRecording();
        updateStatus('录制中...', 'recording');
        
        console.log('录制已开始');
        
    } catch (error) {
        console.error('开始录制失败:', error);
        
        let errorMessage = '录制失败: ';
        if (error.name === 'NotAllowedError') {
            errorMessage = '权限被拒绝。请检查系统设置中的屏幕录制权限。';
        } else if (error.name === 'NotFoundError') {
            errorMessage = '未找到屏幕源。请刷新屏幕列表重试。';
        } else {
            errorMessage += error.message;
        }
        
        updateStatus(errorMessage, 'error');
        alert(errorMessage);
    }
}

// 禁用画中画拖拽
function disableCameraPipDrag() {
    const pip = elements.cameraPip;
    pip.style.cursor = 'default';
    
    // 移除事件监听器
    pip.removeEventListener('mousedown', startDrag);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    
    // 移除触摸事件
    pip.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
}


// 停止录制
function stopRecording() {
    if (!state.isRecording || !state.mediaRecorder) {
        return;
    }
    
    console.log('停止录制...');

    // 停止录制时恢复控件显示
    if (state.cameraEnabled) {
        elements.cameraPip.classList.remove('recording');
        // 重新启用拖拽功能
        if (state.cameraStream) {
            setupCameraPipDrag();
        }
    }
    
    if (state.mediaRecorder.state === 'recording') {
        state.mediaRecorder.stop();
    }
    
    state.isRecording = false;
    updateStatus('正在处理录制内容...', 'processing');
}

// 计时器功能
function startTimer() {
    state.recordingStartTime = Date.now();
    state.timerInterval = setInterval(updateTimer, 1000);
    elements.recordingTimer.style.display = 'block';
}

function updateTimer() {
    const elapsed = Date.now() - state.recordingStartTime;
    const totalSeconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    elements.timer.textContent = 
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}`;
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    elements.recordingTimer.style.display = 'none';
    elements.timer.textContent = '00:00:00';
}

// 下载视频
function downloadVideo() {
    if (!state.currentVideoBlob) {
        alert('没有可下载的视频');
        return;
    }
    
    const url = URL.createObjectURL(state.currentVideoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screen-recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('视频下载开始');
}

// 清除预览
function clearPreview() {
    if (elements.resultVideo.src) {
        URL.revokeObjectURL(elements.resultVideo.src);
        elements.resultVideo.src = '';
    }
    elements.videoPreview.style.display = 'none';
    state.currentVideoBlob = null;
}

// 更新UI状态
function updateUIForRecording() {
    elements.startBtn.disabled = true;
    elements.startBtn.style.display = 'none';
    elements.stopBtn.style.display = 'block';
    elements.status.className = 'status-bar status-recording';
    
    // 禁用设置
    document.querySelectorAll('.source-item').forEach(item => {
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.6';
    });
    
    // 禁用摄像头控制
    elements.cameraToggle.disabled = true;
    document.getElementById('showBorder').disabled = true;
    document.getElementById('showShadow').disabled = true;
    document.getElementById('borderColor').disabled = true;
    document.querySelectorAll('.style-option').forEach(option => {
        option.style.pointerEvents = 'none';
        option.style.opacity = '0.6';
    });
    document.querySelectorAll('.pip-option').forEach(option => {
        option.style.pointerEvents = 'none';
        option.style.opacity = '0.6';
    });
    elements.pipSizeSlider.disabled = true;
    
    // 隐藏画中画控件
    if (state.cameraEnabled) {
        elements.cameraPip.classList.add('recording');
    }
    
    elements.previewPlaceholder.innerHTML = `
        <i class="fas fa-circle" style="color: #ff3b30; animation: pulse 1.5s infinite;"></i>
        <p>录制中...</p>
        <p style="font-size: 12px; color: #999;">点击停止录制按钮结束录制</p>
    `;
}

function updateUIForStopped() {
    elements.startBtn.disabled = !state.selectedSourceId;
    elements.startBtn.style.display = 'block';
    elements.stopBtn.style.display = 'none';
    elements.status.className = 'status-bar status-ready';
    
    // 启用设置
    document.querySelectorAll('.source-item').forEach(item => {
        item.style.pointerEvents = 'auto';
        item.style.opacity = '1';
    });
    
    // 启用摄像头控制
    elements.cameraToggle.disabled = false;
    document.getElementById('showBorder').disabled = false;
    document.getElementById('showShadow').disabled = false;
    document.getElementById('borderColor').disabled = false;
    document.querySelectorAll('.style-option').forEach(option => {
        option.style.pointerEvents = 'auto';
        option.style.opacity = '1';
    });
    document.querySelectorAll('.pip-option').forEach(option => {
        option.style.pointerEvents = 'auto';
        option.style.opacity = '1';
    });
    elements.pipSizeSlider.disabled = false;
    
    // 显示画中画控件
    if (state.cameraEnabled) {
        elements.cameraPip.classList.remove('recording');
    }
    
    if (state.selectedSourceId) {
        elements.previewPlaceholder.innerHTML = `
            <i class="fas fa-check-circle" style="color: #28a745;"></i>
            <p>准备就绪</p>
            <p style="font-size: 12px; color: #999;">可以开始新的录制</p>
        `;
    }
}

// 更新状态显示
function updateStatus(message, type = 'ready') {
    elements.status.textContent = message;
    elements.status.className = 'status-bar';
    
    switch (type) {
        case 'recording':
            elements.status.classList.add('status-recording');
            break;
        case 'ready':
            elements.status.classList.add('status-ready');
            break;
        case 'processing':
            elements.status.style.background = '#d1ecf1';
            elements.status.style.color = '#0c5460';
            break;
        case 'error':
            elements.status.style.background = '#f8d7da';
            elements.status.style.color = '#721c24';
            break;
        case 'success':
            elements.status.style.background = '#d4edda';
            elements.status.style.color = '#155724';
            break;
    }
}

// 设置保存和加载
function saveSettings() {
    const settings = {
        cameraEnabled: state.cameraEnabled,
        pipPosition: state.pipPosition,
        pipSize: state.pipSize,

        cameraEnabled: state.cameraEnabled,
        pipPosition: state.pipPosition,
        pipSize: state.pipSize,
        
        // 样式设置
        pipStyle: state.pipStyle,
        showBorder: state.showBorder,
        showShadow: state.showShadow,
        borderColor: state.borderColor
    };
    localStorage.setItem('screenRecorderSettings', JSON.stringify(settings));
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('screenRecorderSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            state.cameraEnabled = settings.cameraEnabled || false;
            state.pipPosition = settings.pipPosition || 'bottom-right';
            state.pipSize = settings.pipSize || 160;
            
            // 应用设置
            elements.cameraToggle.checked = state.cameraEnabled;
            updatePipSizeDisplay();
            elements.pipSizeSlider.value = state.pipSize;
            
            // 选择对应的位置选项
            elements.pipOptions.forEach(option => {
                if (option.dataset.position === state.pipPosition) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
            
            // 如果摄像头启用且有权限，初始化摄像头
            if (state.cameraEnabled && state.permissions.camera === 'granted') {
                setTimeout(() => initCamera(), 1000); // 延迟初始化
            }
            // 加载样式设置
            state.pipStyle = settings.pipStyle || 'rounded';
            state.showBorder = settings.showBorder !== false; // 默认true
            state.showShadow = settings.showShadow !== false; // 默认true
            state.borderColor = settings.borderColor || '#667eea';
            
            // 应用样式设置
            const styleOptions = document.querySelectorAll('.style-option');
            styleOptions.forEach(option => {
                if (option.dataset.style === state.pipStyle) {
                    option.classList.add('selected');
                }
            });
            
            document.getElementById('showBorder').checked = state.showBorder;
            document.getElementById('showShadow').checked = state.showShadow;
            document.getElementById('borderColor').value = state.borderColor;
            document.getElementById('borderColorPicker').style.display = 
                state.showBorder ? 'block' : 'none';
            
            // 如果摄像头启用，应用样式
            if (state.cameraEnabled) {
                updateCameraPipStyle();
            }
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 录制控制
    elements.startBtn.addEventListener('click', startRecording);
    elements.stopBtn.addEventListener('click', stopRecording);
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Shift + R 开始/停止录制
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            if (state.isRecording) {
                stopRecording();
            } else if (state.selectedSourceId) {
                startRecording();
            }
        }
        
        // ESC 停止录制
        if (e.key === 'Escape' && state.isRecording) {
            stopRecording();
        }
        
        // 空格键播放/暂停预览视频
        if (e.key === ' ' && elements.resultVideo.src) {
            e.preventDefault();
            if (elements.resultVideo.paused) {
                elements.resultVideo.play();
            } else {
                elements.resultVideo.pause();
            }
        }
    });
}

// 刷新屏幕源
function refreshSources() {
    loadSources();
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);