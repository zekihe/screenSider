// DOM 元素引用
const elements = {
    startRecordingBtn: document.getElementById('start-recording-btn'),
    stopRecordingBtn: document.getElementById('stop-recording-btn'),
    pauseRecordingBtn: document.getElementById('pause-recording-btn'),
    sourceSelect: document.getElementById('source-select'),
    refreshSourcesBtn: document.getElementById('refresh-sources'),
    regionSelect: document.getElementById('region-select'),
    cameraPipCheckbox: document.getElementById('camera-pip'),
    recordAudioCheckbox: document.getElementById('record-audio'),
    cameraPipContainer: document.getElementById('camera-pip-container'),
    cameraPreview: document.getElementById('camera-preview'),
    closeCameraBtn: document.getElementById('close-camera-btn'),
    previewArea: document.getElementById('preview-area'),
    statusInfo: document.getElementById('status-info'),
    timerDisplay: document.getElementById('timer-display'),
    recordingTimer: document.getElementById('recording-timer'),
    resolutionInfo: document.getElementById('resolution-info'),
    fpsInfo: document.getElementById('fps-info'),
    fpsSelect: document.getElementById('fps-select'),
    qualitySelect: document.getElementById('quality-select'),
    permissionStatus: document.getElementById('permission-status'),
    cameraPermissionModal: document.getElementById('camera-permission-modal'),
    recordingCompleteModal: document.getElementById('recording-complete-modal'),
    savedPath: document.getElementById('saved-path'),
    openFolderBtn: document.getElementById('open-folder-btn'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    grantCameraPermissionBtn: document.getElementById('grant-camera-permission'),
    skipCameraBtn: document.getElementById('skip-camera'),
    selectRegionBtn: document.getElementById('select-region-btn'),
    clearRegionBtn: document.getElementById('clear-region-btn'),
    openFileBtn: document.getElementById('open-file-btn'),
    minimizeBtn: document.getElementById('minimize-btn'),
    maximizeBtn: document.getElementById('maximize-btn'),
    closeBtn: document.getElementById('close-btn')
};

// 状态变量
let state = {
    isRecording: false,
    isPaused: false,
    recordingStartTime: null,
    timerInterval: null,
    currentSource: null,
    cameraStream: null,
    selectedRegion: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
    },
    permissions: {
        screen: 'not-determined',
        camera: 'not-determined',
        microphone: 'not-determined'
    }
};

// 初始化
async function init() {
    console.log('初始化屏幕录制工具...');
    
    // 检查权限
    await checkPermissions();
    
    // 加载屏幕源
    await loadScreenSources();
    
    // 初始化摄像头
    initCamera();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 检查录制状态
    checkRecordingStatus();
    
    // 设置窗口控制
    setupWindowControls();
    
    console.log('初始化完成');
}

// 检查权限
async function checkPermissions() {
    try {
        state.permissions = await window.electronAPI.checkPermissions();
        updatePermissionStatus();
        
        // 如果有未授权的权限，显示提示
        if (state.permissions.screen !== 'granted') {
            showPermissionAlert('需要屏幕录制权限才能开始录制');
        }
    } catch (error) {
        console.error('检查权限失败:', error);
    }
}

// 更新权限状态显示
function updatePermissionStatus() {
    const { screen, camera, microphone } = state.permissions;
    const grantedCount = [screen, camera, microphone].filter(p => p === 'granted').length;
    
    let statusText = '';
    if (grantedCount === 3) {
        statusText = '所有权限已授予';
    } else {
        statusText = `${grantedCount}/3 个权限已授予`;
    }
    
    elements.permissionStatus.innerHTML = `<i class="fas fa-shield-alt"></i> 权限: ${statusText}`;
}

// 加载屏幕源
async function loadScreenSources() {
    try {
        console.log('electronAPI', window.electronAPI)
        elements.sourceSelect.innerHTML = '<option value="">选择屏幕或窗口...</option>';
        
        const sources = await window.electronAPI.getSources();
        
        sources.forEach(source => {
            const option = document.createElement('option');
            option.value = source.id;
            option.textContent = source.name;
            elements.sourceSelect.appendChild(option);
        });
        console.log('electronAPI sources', sources)
        
        console.log('elements ====', elements)
        if (sources.length > 0) {
            // 默认选择第一个屏幕
            elements.sourceSelect.value = sources[0].id;
            state.currentSource = sources[0];
            updatePreviewInfo();
        }
    } catch (error) {
        console.error('加载屏幕源失败:', error);
        showError('无法获取屏幕源，请检查权限设置');
    }
}

// 初始化摄像头
async function initCamera() {
    if (!elements.cameraPipCheckbox.checked) {
        return;
    }
    
    // 检查摄像头权限
    if (state.permissions.camera !== 'granted') {
        showCameraPermissionModal();
        return;
    }
    
    try {
        // 请求摄像头访问
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });
        
        state.cameraStream = stream;
        elements.cameraPreview.srcObject = stream;
        elements.cameraPipContainer.classList.remove('hidden');
        
        // 设置摄像头拖拽
        setupCameraDrag();
        
        console.log('摄像头初始化成功');
    } catch (error) {
        console.error('摄像头初始化失败:', error);
        showError('无法访问摄像头，请检查权限和连接');
        elements.cameraPipCheckbox.checked = false;
    }
}

// 设置摄像头拖拽
function setupCameraDrag() {
    const pipContainer = elements.cameraPipContainer;
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    pipContainer.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    function startDrag(e) {
        if (e.target.classList.contains('pip-close-btn') || 
            e.target.classList.contains('pip-resize-handle')) {
            return;
        }
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = pipContainer.offsetLeft;
        initialY = pipContainer.offsetTop;
        
        pipContainer.style.opacity = '0.8';
        pipContainer.style.cursor = 'grabbing';
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newX = initialX + dx;
        let newY = initialY + dy;
        
        // 限制在预览区域内
        const previewRect = elements.previewArea.getBoundingClientRect();
        const pipRect = pipContainer.getBoundingClientRect();
        
        newX = Math.max(0, Math.min(newX, previewRect.width - pipRect.width));
        newY = Math.max(0, Math.min(newY, previewRect.height - pipRect.height));
        
        pipContainer.style.left = `${newX}px`;
        pipContainer.style.top = `${newY}px`;
    }
    
    function stopDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        pipContainer.style.opacity = '1';
        pipContainer.style.cursor = 'move';
        
        // 保存位置
        saveCameraPosition();
    }
}

// 保存摄像头位置
function saveCameraPosition() {
    const pipContainer = elements.cameraPipContainer;
    const position = {
        left: pipContainer.offsetLeft,
        top: pipContainer.offsetTop
    };
    
    localStorage.setItem('cameraPipPosition', JSON.stringify(position));
}

// 加载摄像头位置
function loadCameraPosition() {
    const saved = localStorage.getItem('cameraPipPosition');
    if (saved) {
        const position = JSON.parse(saved);
        elements.cameraPipContainer.style.left = `${position.left}px`;
        elements.cameraPipContainer.style.top = `${position.top}px`;
    }
}

async function requestAllPermissions() {
    try {
        // 请求屏幕录制权限
        const screenGranted = await window.electronAPI.requestPermission('screen');
        
        // 请求摄像头权限
        const cameraGranted = await window.electronAPI.requestPermission('camera');
        
        // 请求麦克风权限
        const micGranted = await window.electronAPI.requestPermission('microphone');
        
        return { screenGranted, cameraGranted, micGranted };
    } catch (error) {
        console.error('请求权限失败:', error);
        return { screenGranted: false, cameraGranted: false, micGranted: false };
    }
}
// 开始录制
async function startRecording() {
    // 先检查并请求权限
    // const permissions = await requestAllPermissions();
    // console.log('permissions', permissions)
    // if (!permissions.screenGranted) {
    //     showError('需要屏幕录制权限才能开始录制');
    //     return;
    // }
    if (state.isRecording) {
        return;
    }
    
    // 检查屏幕录制权限
    if (state.permissions.screen !== 'granted') {
        const granted = await window.electronAPI.requestPermission('screen');
        if (!granted) {
            showError('需要屏幕录制权限才能开始录制');
            return;
        }
        state.permissions.screen = 'granted';
        updatePermissionStatus();
    }
    
    // 检查摄像头权限
    if (elements.cameraPipCheckbox.checked && state.permissions.camera !== 'granted') {
        const granted = await window.electronAPI.requestPermission('camera');
        if (!granted) {
            elements.cameraPipCheckbox.checked = false;
            showError('摄像头权限被拒绝，已禁用画中画功能');
        } else {
            state.permissions.camera = 'granted';
            updatePermissionStatus();
            await initCamera();
        }
    }
    
    // 检查麦克风权限
    if (elements.recordAudioCheckbox.checked && state.permissions.microphone !== 'granted') {
        const granted = await window.electronAPI.requestPermission('microphone');
        if (!granted) {
            elements.recordAudioCheckbox.checked = false;
            showError('麦克风权限被拒绝，已禁用音频录制');
        } else {
            state.permissions.microphone = 'granted';
            updatePermissionStatus();
        }
    }
    
    // 获取录制选项
    const options = {
        screenId: elements.sourceSelect.value,
        x: state.selectedRegion.x,
        y: state.selectedRegion.y,
        width: state.selectedRegion.width,
        height: state.selectedRegion.height,
        fps: parseInt(elements.fpsSelect.value),
        quality: elements.qualitySelect.value,
        recordAudio: elements.recordAudioCheckbox.checked,
        cameraPip: elements.cameraPipCheckbox.checked && state.cameraStream
    };
    
    if (!options.screenId) {
        showError('请选择录制源');
        return;
    }
    
    try {
        elements.startRecordingBtn.disabled = true;
        elements.statusInfo.textContent = '正在启动录制...';
        elements.statusInfo.className = 'status-recording';
        
        const result = await window.electronAPI.startRecording(options);
        
        if (result.success) {
            state.isRecording = true;
            state.recordingStartTime = Date.now();
            
            // 更新UI
            elements.stopRecordingBtn.disabled = false;
            elements.pauseRecordingBtn.disabled = false;
            elements.statusInfo.textContent = '录制中...';
            elements.recordingTimer.classList.remove('hidden');
            
            // 启动计时器
            startTimer();
            
            console.log('录制已开始，文件保存到:', result.outputPath);
        } else {
            throw new Error(result.message || '录制启动失败');
        }
    } catch (error) {
        console.error('开始录制失败:', error);
        showError(`录制失败: ${error.message}`);
        
        // 重置状态
        resetRecordingState();
    } finally {
        elements.startRecordingBtn.disabled = false;
    }
}

// 停止录制
async function stopRecording() {
    if (!state.isRecording) {
        return;
    }
    
    try {
        const result = await window.electronAPI.stopRecording();
        
        if (result.success) {
            console.log('录制已停止');
            
            // 重置状态
            resetRecordingState();
            
            // 显示完成提示
            showRecordingComplete(result.outputPath);
        } else {
            throw new Error(result.message || '停止录制失败');
        }
    } catch (error) {
        console.error('停止录制失败:', error);
        showError(`停止录制失败: ${error.message}`);
    }
}

// 重置录制状态
function resetRecordingState() {
    state.isRecording = false;
    state.isPaused = false;
    
    // 停止计时器
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    
    // 更新UI
    elements.startRecordingBtn.disabled = false;
    elements.stopRecordingBtn.disabled = true;
    elements.pauseRecordingBtn.disabled = true;
    elements.statusInfo.textContent = '就绪';
    elements.statusInfo.className = 'status-idle';
    elements.recordingTimer.classList.add('hidden');
    elements.timerDisplay.textContent = '00:00:00';
    
    // 更新按钮文本
    elements.pauseRecordingBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
}

// 启动计时器
function startTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
    }
    
    state.timerInterval = setInterval(() => {
        if (!state.recordingStartTime) return;
        
        const elapsed = Date.now() - state.recordingStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        elements.timerDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:` +
            `${minutes.toString().padStart(2, '0')}:` +
            `${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// 检查录制状态
async function checkRecordingStatus() {
    try {
        const isRecording = await window.electronAPI.getIsRecording();
        
        if (isRecording && !state.isRecording) {
            // 应用启动时已经有录制在进行
            state.isRecording = true;
            state.recordingStartTime = Date.now() - 1000; // 假设已经开始1秒
            
            elements.startRecordingBtn.disabled = true;
            elements.stopRecordingBtn.disabled = false;
            elements.pauseRecordingBtn.disabled = false;
            elements.statusInfo.textContent = '录制中...';
            elements.statusInfo.className = 'status-recording';
            elements.recordingTimer.classList.remove('hidden');
            
            startTimer();
        }
    } catch (error) {
        console.error('检查录制状态失败:', error);
    }
}

// 更新预览信息
function updatePreviewInfo() {
    console.log('updatePreviewInfo', state.currentSource)
    if (state.currentSource) {
        elements.resolutionInfo.textContent = `${state.selectedRegion.width}x${state.selectedRegion.height}`;
        elements.fpsInfo.textContent = `${elements.fpsSelect.value} FPS`;
    }
}

// 显示摄像头权限请求模态框
function showCameraPermissionModal() {
    elements.cameraPermissionModal.classList.remove('hidden');
}

// 显示录制完成模态框
function showRecordingComplete(filePath) {
    elements.savedPath.textContent = filePath;
    elements.recordingCompleteModal.classList.remove('hidden');
}

// 显示错误提示
function showError(message) {
    // 这里可以替换为更美观的提示组件
    alert(`错误: ${message}`);
}

// 显示权限警告
function showPermissionAlert(message) {
    // 这里可以替换为更美观的提示组件
    console.warn(`权限警告: ${message}`);
}

// 设置事件监听器
function setupEventListeners() {
    // 录制控制按钮
    elements.startRecordingBtn.addEventListener('click', startRecording);
    elements.stopRecordingBtn.addEventListener('click', stopRecording);
    elements.pauseRecordingBtn.addEventListener('click', togglePauseRecording);
    
    // 屏幕源
    elements.sourceSelect.addEventListener('change', (e) => {
        state.currentSource = { id: e.target.value };
        updatePreviewInfo();
    });
    
    elements.refreshSourcesBtn.addEventListener('click', loadScreenSources);
    
    // 摄像头控制
    elements.cameraPipCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            initCamera();
        } else {
            if (state.cameraStream) {
                state.cameraStream.getTracks().forEach(track => track.stop());
                state.cameraStream = null;
            }
            elements.cameraPipContainer.classList.add('hidden');
        }
    });
    
    elements.closeCameraBtn.addEventListener('click', () => {
        elements.cameraPipCheckbox.checked = false;
        elements.cameraPipCheckbox.dispatchEvent(new Event('change'));
    });
    
    // 模态框控制
    elements.grantCameraPermissionBtn.addEventListener('click', async () => {
        const granted = await window.electronAPI.requestPermission('camera');
        elements.cameraPermissionModal.classList.add('hidden');
        
        if (granted) {
            state.permissions.camera = 'granted';
            updatePermissionStatus();
            await initCamera();
        } else {
            elements.cameraPipCheckbox.checked = false;
        }
    });
    
    elements.skipCameraBtn.addEventListener('click', () => {
        elements.cameraPermissionModal.classList.add('hidden');
        elements.cameraPipCheckbox.checked = false;
    });
    
    elements.openFolderBtn.addEventListener('click', () => {
        const filePath = elements.savedPath.textContent;
        window.electronAPI.showInFolder(filePath);
    });
    
    elements.closeModalBtn.addEventListener('click', () => {
        elements.recordingCompleteModal.classList.add('hidden');
    });
    
    // 区域选择
    elements.selectRegionBtn.addEventListener('click', selectRegion);
    elements.clearRegionBtn.addEventListener('click', clearRegion);
    
    // 文件操作
    elements.openFileBtn.addEventListener('click', async () => {
        const filePath = await window.electronAPI.openFileDialog();
        if (filePath) {
            window.electronAPI.showInFolder(filePath);
        }
    });
    
    // 设置变化
    elements.fpsSelect.addEventListener('change', updatePreviewInfo);
    elements.qualitySelect.addEventListener('change', updatePreviewInfo);
    elements.recordAudioCheckbox.addEventListener('change', updatePreviewInfo);
    
    // 区域选择变化
    elements.regionSelect.addEventListener('change', (e) => {
        const customRegionSettings = document.getElementById('custom-region-settings');
        if (e.target.value === 'custom') {
            customRegionSettings.classList.remove('hidden');
        } else {
            customRegionSettings.classList.add('hidden');
        }
    });
    
    // 尺寸滑块
    const widthSlider = document.getElementById('width-slider');
    const heightSlider = document.getElementById('height-slider');
    const widthValue = document.getElementById('width-value');
    const heightValue = document.getElementById('height-value');
    
    widthSlider.addEventListener('input', (e) => {
        widthValue.textContent = e.target.value;
        state.selectedRegion.width = parseInt(e.target.value);
        updatePreviewInfo();
    });
    
    heightSlider.addEventListener('input', (e) => {
        heightValue.textContent = e.target.value;
        state.selectedRegion.height = parseInt(e.target.value);
        updatePreviewInfo();
    });
    
    // IPC 事件监听
    window.electronAPI.onRecordingStopped((data) => {
        console.log('录制已停止，数据:', data);
        resetRecordingState();
        showRecordingComplete(data.outputPath);
    });
    
    window.electronAPI.onStartRecordingFromTray(() => {
        if (!state.isRecording) {
            startRecording();
        }
    });
    
    window.electronAPI.onStopRecordingFromTray(() => {
        if (state.isRecording) {
            stopRecording();
        }
    });
}

// 设置窗口控制
function setupWindowControls() {
    if (!window.electronAPI) {
    console.warn('electronAPI 未加载，窗口控制功能不可用');
    return;
  }
    // 检查哪些窗口控制方法可用
  console.log('检查窗口控制API:', {
    hasWindowControl: typeof window.electronAPI.windowControl === 'function',
    hasWindowMinimize: typeof window.electronAPI.windowMinimize === 'function',
    hasWindowMaximize: typeof window.electronAPI.windowMaximize === 'function',
    hasWindowClose: typeof window.electronAPI.windowClose === 'function',
    hasWindowIsMaximized: typeof window.electronAPI.windowIsMaximized === 'function'
  });

  // 最小化按钮
  elements.minimizeBtn.addEventListener('click', async () => {
    try {
      // 尝试使用统一的方法
      if (typeof window.electronAPI.windowControl === 'function') {
        await window.electronAPI.windowControl('minimize');
      } 
      // 或者使用单独的方法
      else if (typeof window.electronAPI.windowMinimize === 'function') {
        await window.electronAPI.windowMinimize();
      } else {
        console.error('没有可用的窗口最小化方法');
      }
    } catch (error) {
      console.error('最小化窗口失败:', error);
    }
  });
  // 最大化/还原按钮
  elements.maximizeBtn.addEventListener('click', async () => {
    try {
      if (typeof window.electronAPI.windowControl === 'function') {
        await window.electronAPI.windowControl('maximize');
      } else if (typeof window.electronAPI.windowMaximize === 'function') {
        await window.electronAPI.windowMaximize();
      } else {
        console.error('没有可用的窗口最大化方法');
      }
      // 更新按钮图标
      updateMaximizeButtonIcon();
    } catch (error) {
      console.error('最大化/还原窗口失败:', error);
    }
  });
  
  elements.closeBtn.addEventListener('click', async () => {
    try {
      if (typeof window.electronAPI.windowControl === 'function') {
        await window.electronAPI.windowControl('close');
      } else if (typeof window.electronAPI.windowClose === 'function') {
        await window.electronAPI.windowClose();
      } else {
        console.error('没有可用的窗口关闭方法');
      }
    } catch (error) {
      console.error('关闭窗口失败:', error);
    }
  });
  
  // 初始更新按钮图标
  updateMaximizeButtonIcon();
  
  // 监听窗口大小变化
  window.addEventListener('resize', updateMaximizeButtonIcon);
}
// 更新最大化按钮图标
async function updateMaximizeButtonIcon() {
  try {
    let isMaximized = false;
    
    // 尝试获取窗口状态
    if (typeof window.electronAPI.windowControl === 'function') {
      isMaximized = await window.electronAPI.windowControl('is-maximized');
    } else if (typeof window.electronAPI.windowIsMaximized === 'function') {
      isMaximized = await window.electronAPI.windowIsMaximized();
    } else {
      // 如果API不可用，根据窗口大小猜测
      isMaximized = window.outerWidth >= screen.availWidth && window.outerHeight >= screen.availHeight;
    }
    const icon = elements.maximizeBtn.querySelector('i');
    if (icon) {
      icon.className = isMaximized ? 'fas fa-clone' : 'fas fa-square';
    }
  } catch (error) {
    console.error('获取窗口状态失败:', error);
    // 即使失败也尝试更新图标
    const icon = elements.maximizeBtn.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-square';
    }
  }
}

// 区域选择功能
function selectRegion() {
    showError('区域选择功能在原型中尚未实现');
    // 实际实现需要创建全屏覆盖层让用户选择区域
}

function clearRegion() {
    state.selectedRegion = {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
    };
    updatePreviewInfo();
}

// 暂停/继续录制
function togglePauseRecording() {
    if (!state.isRecording) return;
    
    state.isPaused = !state.isPaused;
    
    if (state.isPaused) {
        // 暂停录制
        elements.pauseRecordingBtn.innerHTML = '<i class="fas fa-play"></i> 继续';
        elements.statusInfo.textContent = '已暂停';
        elements.statusInfo.className = 'status-paused';
        
        // 这里应该暂停FFmpeg录制，但需要更复杂的实现
        console.log('录制已暂停（功能待实现）');
    } else {
        // 继续录制
        elements.pauseRecordingBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
        elements.statusInfo.textContent = '录制中...';
        elements.statusInfo.className = 'status-recording';
        
        console.log('录制继续（功能待实现）');
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);