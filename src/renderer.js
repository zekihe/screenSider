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
        
        // 基础样式属性
        this.pipStyle = 'rounded'; // rectangle, rounded, circle
        this.showBorder = true;
        this.showShadow = true;
        this.borderColor = '#667eea';
        this.borderWidth = 3;
        
        // 高级样式属性
        this.shadowIntensity = 20;
        this.opacity = 100;
        this.enableRecordingOpacity = false;
        this.recordingOpacity = 70;

        // 录制模式相关属性
        this.recordingMode = 'screen+camera'; // screen+camera, camera-only, camera-pip-big
        this.cameraBackground = 'blur'; // blur, color, image, transparent
        this.backgroundColor = '#1a1a1a';
        this.cameraSize = 100; // 百分比
        this.useGreenScreen = false; // 绿幕抠图
        this.greenScreenColor = '#00ff00'; // 绿幕颜色
        this.greenScreenThreshold = 0.3; // 抠图阈值

        // 窗口设置
        this.autoHideWindow = true; // 录制时自动隐藏窗口
        this.showInTaskbar = false; // 录制时在任务栏显示
        this.alwaysOnTop = false; // 窗口始终置顶
        this.clickThrough = false; // 点击穿透
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
    
    // 样式相关
    showBorderCheckbox: document.getElementById('showBorder'),
    showShadowCheckbox: document.getElementById('showShadow'),
    borderColorPicker: document.getElementById('borderColor'),
    borderColorPickerContainer: document.getElementById('borderColorPicker'),
    styleOptions: document.querySelectorAll('.style-option'),
    
    // 高级样式相关
    borderWidthSlider: document.getElementById('borderWidth'),
    borderWidthValue: document.getElementById('borderWidthValue'),
    shadowIntensitySlider: document.getElementById('shadowIntensity'),
    shadowIntensityValue: document.getElementById('shadowIntensityValue'),
    opacitySlider: document.getElementById('opacity'),
    opacityValue: document.getElementById('opacityValue'),
    enableRecordingOpacityCheckbox: document.getElementById('enableRecordingOpacity'),
    recordingOpacitySlider: document.getElementById('recordingOpacity'),
    recordingOpacityValue: document.getElementById('recordingOpacityValue'),
    recordingOpacityContainer: document.getElementById('recordingOpacityContainer'),
    
    // 录制模式设置
    cameraBackground: document.getElementById('cameraBackground'),
    backgroundColor: document.getElementById('backgroundColor'),
    cameraSize: document.getElementById('cameraSize'),

    // 窗口设置
    autoHideWindow: document.getElementById('autoHideWindow'),
    showInTaskbar: document.getElementById('showInTaskbar'),
    alwaysOnTop: document.getElementById('alwaysOnTop'),
    clickThrough: document.getElementById('clickThrough'),
    hideWindowBtn: document.getElementById('hideWindowBtn'),
    showWindowBtn: document.getElementById('showWindowBtn'),

    // 视频预览
    videoPreview: document.getElementById('videoPreview'),
    resultVideo: document.getElementById('resultVideo')
};

// 拖拽相关变量
let startDrag, drag, stopDrag, handleTouchStart, handleTouchMove, handleTouchEnd;

// 初始化应用
async function init() {
    console.log('初始化屏幕录制应用...');
    
    // 检查权限
    await checkPermissions();
    
    // 加载屏幕源
    await loadSources();
    
    // 初始化摄像头控制
    initCameraControls();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 加载保存的设置
    loadSettings();

    // 创建系统托盘
    if (window.electronAPI && window.electronAPI.createTray) {
        await window.electronAPI.createTray();
    }
    
    // 监听托盘事件
    if (window.electronAPI) {
        window.electronAPI.onTrayStartRecording(() => {
            if (!state.isRecording && state.selectedSourceId) {
                startRecording();
            }
        });
        
        window.electronAPI.onTrayStopRecording(() => {
            if (state.isRecording) {
                stopRecording();
            }
        });
        
        window.electronAPI.onGlobalShortcutToggleRecording(() => {
            if (state.isRecording) {
                stopRecording();
            } else if (state.selectedSourceId) {
                startRecording();
            }
        });
        
        window.electronAPI.onGlobalShortcutAction((action) => {
            switch (action) {
                case 'hide-window':
                    hideApplicationWindow();
                    break;
                case 'show-window':
                    showApplicationWindow();
                    break;
                case 'toggle-camera':
                    toggleCamera();
                    break;
            }
        });
        
        // 注册自定义快捷键
        // window.electronAPI.registerGlobalShortcut('CmdOrCtrl+Shift+C', 'toggle-camera');
    }
    
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
    
    // 基础样式选择
    elements.styleOptions.forEach(option => {
        option.addEventListener('click', () => {
            elements.styleOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            state.pipStyle = option.dataset.style;
            updateCameraPipStyle();
            saveSettings();
        });
    });
    
    // 边框开关
    elements.showBorderCheckbox.addEventListener('change', (e) => {
        state.showBorder = e.target.checked;
        elements.borderColorPickerContainer.style.display = 
            state.showBorder ? 'block' : 'none';
        updateCameraPipStyle();
        saveSettings();
    });
    
    // 阴影开关
    elements.showShadowCheckbox.addEventListener('change', (e) => {
        state.showShadow = e.target.checked;
        updateCameraPipStyle();
        saveSettings();
    });
    
    // 边框颜色
    elements.borderColorPicker.addEventListener('input', (e) => {
        state.borderColor = e.target.value;
        updateCameraPipStyle();
        saveSettings();
    });
    
    // 边框粗细控制
    elements.borderWidthSlider.addEventListener('input', (e) => {
        state.borderWidth = parseInt(e.target.value);
        elements.borderWidthValue.textContent = state.borderWidth;
        updateCameraPipStyle();
        saveSettings();
    });
    
    // 阴影强度控制
    elements.shadowIntensitySlider.addEventListener('input', (e) => {
        state.shadowIntensity = parseInt(e.target.value);
        elements.shadowIntensityValue.textContent = state.shadowIntensity;
        updateCameraPipStyle();
        saveSettings();
    });
    
    // 不透明度控制
    elements.opacitySlider.addEventListener('input', (e) => {
        state.opacity = parseInt(e.target.value);
        elements.opacityValue.textContent = state.opacity;
        updateCameraPipOpacity();
        saveSettings();
    });
    
    // 录制时不透明度开关
    elements.enableRecordingOpacityCheckbox.addEventListener('change', (e) => {
        state.enableRecordingOpacity = e.target.checked;
        elements.recordingOpacityContainer.style.display = 
            state.enableRecordingOpacity ? 'block' : 'none';
        saveSettings();
    });
    
    // 录制时不透明度控制
    elements.recordingOpacitySlider.addEventListener('input', (e) => {
        state.recordingOpacity = parseInt(e.target.value);
        elements.recordingOpacityValue.textContent = state.recordingOpacity;
        saveSettings();
    });

    // 录制模式选择
    const modeRadios = document.querySelectorAll('input[name="recordingMode"]');
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                state.recordingMode = e.target.value;
                document.getElementById('cameraOnlySettings').style.display = 
                    state.recordingMode === 'camera-only' ? 'block' : 'none';
                saveSettings();
                
                // 如果摄像头已启用，更新预览
                if (state.cameraEnabled) {
                    updateCameraModePreview();
                }
            }
        });
    });
    
    // 背景类型选择
    elements.cameraBackground.addEventListener('change', (e) => {
        state.cameraBackground = e.target.value;
        document.getElementById('backgroundColorPicker').style.display = 
            state.cameraBackground === 'color' ? 'block' : 'none';
        saveSettings();
        
        if (state.cameraEnabled) {
            updateCameraModePreview();
        }
    });
    
    // 背景颜色选择
    elements.backgroundColor.addEventListener('input', (e) => {
        state.backgroundColor = e.target.value;
        saveSettings();
        
        if (state.cameraEnabled && state.cameraBackground === 'color') {
            updateCameraModePreview();
        }
    });
    
    // 摄像头大小控制
    elements.cameraSize.addEventListener('input', (e) => {
        state.cameraSize = parseInt(e.target.value);
        document.getElementById('cameraSizeValue').textContent = state.cameraSize;
        saveSettings();
        
        if (state.cameraEnabled) {
            updateCameraModePreview();
        }
    });

    // 窗口设置
    elements.autoHideWindow.addEventListener('change', (e) => {
        state.autoHideWindow = e.target.checked;
        saveSettings();
    });
    
    elements.showInTaskbar.addEventListener('change', (e) => {
        state.showInTaskbar = e.target.checked;
        saveSettings();
    });
    
    elements.alwaysOnTop.addEventListener('change', (e) => {
        state.alwaysOnTop = e.target.checked;
        if (window.electronAPI && window.electronAPI.windowSetAlwaysOnTop) {
            window.electronAPI.windowSetAlwaysOnTop(state.alwaysOnTop);
        }
        saveSettings();
    });
    
    elements.clickThrough.addEventListener('change', (e) => {
        state.clickThrough = e.target.checked;
        if (window.electronAPI && window.electronAPI.windowSetIgnoreMouseEvents) {
            window.electronAPI.windowSetIgnoreMouseEvents(state.clickThrough, {
                forward: true // 允许鼠标事件穿透
            });
        }
        saveSettings();
    });
    
    // 隐藏/显示窗口按钮
    elements.hideWindowBtn.addEventListener('click', () => {
        hideApplicationWindow();
    });
    
    elements.showWindowBtn.addEventListener('click', () => {
        showApplicationWindow();
    });
    
    // 初始更新大小显示
    updatePipSizeDisplay();
}

// 隐藏应用窗口
async function hideApplicationWindow() {
    try {
        if (window.electronAPI && window.electronAPI.windowHide) {
            await window.electronAPI.windowHide();
            console.log('窗口已隐藏');
            
            // 更新状态
            updateWindowStatus('hidden');
        }
    } catch (error) {
        console.error('隐藏窗口失败:', error);
    }
}

// 显示应用窗口
async function showApplicationWindow() {
    try {
        if (window.electronAPI && window.electronAPI.windowShow) {
            await window.electronAPI.windowShow();
            console.log('窗口已显示');
            
            // 更新状态
            updateWindowStatus('visible');
        }
    } catch (error) {
        console.error('显示窗口失败:', error);
    }
}

// 更新窗口状态显示
function updateWindowStatus(status) {
    const statusElement = document.getElementById('windowStatus');
    if (statusElement) {
        if (status === 'hidden') {
            statusElement.innerHTML = '<i class="fas fa-eye-slash"></i> 窗口已隐藏';
            statusElement.style.color = '#666';
        } else {
            statusElement.innerHTML = '<i class="fas fa-eye"></i> 窗口已显示';
            statusElement.style.color = '#28a745';
        }
    }
}

// 创建浮动画中画窗口
function createFloatingPIPWindow() {
    // 创建浮动窗口容器
    const floatingContainer = document.createElement('div');
    floatingContainer.id = 'floatingPIP';
    floatingContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 200px;
        height: 150px;
        border-radius: 10px;
        overflow: hidden;
        background: #000;
        border: 2px solid #667eea;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        z-index: 99999;
        display: none;
        cursor: move;
        resize: both;
        overflow: hidden;
    `;
    
    // 创建视频元素
    const floatingVideo = document.createElement('video');
    floatingVideo.id = 'floatingPIPVideo';
    floatingVideo.autoplay = true;
    floatingVideo.muted = true;
    floatingVideo.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
    `;
    
    // 创建控制条
    const controls = document.createElement('div');
    controls.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 5px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
    `;
    
    controls.innerHTML = `
        <span>📹 画中画</span>
        <div>
            <button id="closeFloatingPIP" style="background:none;border:none;color:white;cursor:pointer;margin-left:5px;">
                ✕
            </button>
        </div>
    `;
    
    // 组装
    floatingContainer.appendChild(floatingVideo);
    floatingContainer.appendChild(controls);
    document.body.appendChild(floatingContainer);
    
    // 设置拖拽功能
    setupFloatingPIPDrag(floatingContainer);
    
    // 关闭按钮事件
    document.getElementById('closeFloatingPIP').addEventListener('click', () => {
        floatingContainer.style.display = 'none';
    });
    
    return floatingContainer;
}

// 设置浮动画中画拖拽
function setupFloatingPIPDrag(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    // 鼠标按下开始拖拽
    element.addEventListener('mousedown', (e) => {
        if (e.target.id === 'closeFloatingPIP') return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = element.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        element.style.cursor = 'grabbing';
        element.style.opacity = '0.8';
        
        e.preventDefault();
    });
    
    // 鼠标移动拖拽
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const newX = initialX + dx;
        const newY = initialY + dy;
        
        // 限制在屏幕范围内
        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;
        
        element.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
        element.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
    });
    
    // 鼠标释放停止拖拽
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        
        isDragging = false;
        element.style.cursor = 'move';
        element.style.opacity = '1';
        
        // 保存位置
        saveFloatingPIPPosition(element);
    });
}

// 保存浮动画中画位置
function saveFloatingPIPPosition(element) {
    const position = {
        left: element.style.left,
        top: element.style.top,
        width: element.style.width,
        height: element.style.height
    };
    localStorage.setItem('floatingPIPPosition', JSON.stringify(position));
}

// 加载浮动画中画位置
function loadFloatingPIPPosition(element) {
    const saved = localStorage.getItem('floatingPIPPosition');
    if (saved) {
        const position = JSON.parse(saved);
        if (position.left) element.style.left = position.left;
        if (position.top) element.style.top = position.top;
        if (position.width) element.style.width = position.width;
        if (position.height) element.style.height = position.height;
    }
}

// 更新摄像头模式预览
function updateCameraModePreview() {
    if (!state.cameraEnabled || !state.cameraStream) return;
    
    const pip = elements.cameraPip;
    
    // 重置所有模式类
    pip.classList.remove('camera-only-mode', 'camera-pip-big', 
                        'blur-background', 'color-background', 'transparent-background');
    
    // 根据模式应用样式
    switch (state.recordingMode) {
        case 'camera-only':
            pip.classList.add('camera-only-mode');
            
            // 应用背景样式
            if (state.cameraBackground === 'blur') {
                pip.classList.add('blur-background');
                pip.style.background = 'rgba(255, 255, 255, 0.1)';
            } else if (state.cameraBackground === 'color') {
                pip.classList.add('color-background');
                pip.style.background = state.backgroundColor;
            } else if (state.cameraBackground === 'transparent') {
                pip.classList.add('transparent-background');
                pip.style.background = 'transparent';
            }
            
            // 应用摄像头大小
            const baseSize = 160; // 基础大小
            const newWidth = baseSize * (state.cameraSize / 100);
            const newHeight = newWidth * 0.75;
            pip.style.width = `${newWidth}px`;
            pip.style.height = `${newHeight}px`;
            break;
            
        case 'camera-pip-big':
            pip.classList.add('camera-pip-big');
            pip.style.width = '50%';
            pip.style.height = 'auto';
            break;
            
        case 'screen+camera':
        default:
            // 恢复默认样式
            updateCameraPipSize();
            pip.style.background = '#000';
            break;
    }
}

// 更新画中画大小显示
function updatePipSizeDisplay() {
    let sizeText = '小';
    if (state.pipSize > 200) sizeText = '大';
    else if (state.pipSize > 140) sizeText = '中';
    elements.pipSizeValue.textContent = sizeText;
}

// 更新画中画阴影
function updateCameraPipShadow() {
    if (!elements.cameraPip.style.display || elements.cameraPip.style.display === 'none') {
        return;
    }
    
    if (state.showShadow) {
        const shadowSize = state.shadowIntensity / 10;
        const shadowBlur = state.shadowIntensity;
        elements.cameraPip.style.boxShadow = 
            `0 ${shadowSize}px ${shadowBlur}px rgba(0, 0, 0, 0.3)`;
    } else {
        elements.cameraPip.style.boxShadow = 'none';
    }
}

// 更新画中画不透明度
function updateCameraPipOpacity() {
    if (!elements.cameraPip.style.display || elements.cameraPip.style.display === 'none') {
        return;
    }
    
    if (state.isRecording && state.enableRecordingOpacity) {
        elements.cameraPip.style.opacity = `${state.recordingOpacity / 100}`;
    } else {
        elements.cameraPip.style.opacity = `${state.opacity / 100}`;
    }
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
        updateCameraPipShadow();
    } else {
        pip.style.boxShadow = 'none';
    }
    
    // 更新不透明度
    updateCameraPipOpacity();
    
    // 对于圆形样式，需要调整视频元素的圆角
    if (state.pipStyle === 'circle') {
        elements.cameraPipVideo.style.borderRadius = '50%';
    } else if (state.pipStyle === 'rounded') {
        elements.cameraPipVideo.style.borderRadius = '12px';
    } else {
        elements.cameraPipVideo.style.borderRadius = '0';
    }
}

// 添加录制效果
function addRecordingEffects() {
    const pip = elements.cameraPip;
    
    // 添加录制中类
    pip.classList.add('recording');
    
    // 添加闪烁层
    const flashLayer = document.createElement('div');
    flashLayer.className = 'pip-flash';
    pip.appendChild(flashLayer);
    
    // 更新不透明度
    updateCameraPipOpacity();
    
    // 添加录制时间显示
    const timerDisplay = document.createElement('div');
    timerDisplay.id = 'pipTimer';
    timerDisplay.style.cssText = `
        position: absolute;
        bottom: 5px;
        left: 0;
        right: 0;
        text-align: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
        background: rgba(0, 0, 0, 0.5);
        padding: 2px;
        border-radius: 3px;
        margin: 0 5px;
        z-index: 10;
    `;
    pip.appendChild(timerDisplay);
    
    // 更新画中画内的计时器
    updatePipTimer();
}

// 移除录制效果
function removeRecordingEffects() {
    const pip = elements.cameraPip;
    
    // 移除录制中类
    pip.classList.remove('recording');
    
    // 移除闪烁层
    const flashLayer = pip.querySelector('.pip-flash');
    if (flashLayer) {
        flashLayer.remove();
    }
    
    // 移除计时器显示
    const timerDisplay = pip.querySelector('#pipTimer');
    if (timerDisplay) {
        timerDisplay.remove();
    }
    
    // 恢复不透明度
    updateCameraPipOpacity();
}

// 更新画中画内的计时器
function updatePipTimer() {
    if (!state.isRecording || !state.cameraEnabled) return;
    
    const timerDisplay = elements.cameraPip.querySelector('#pipTimer');
    if (!timerDisplay) return;
    
    const elapsed = Date.now() - state.recordingStartTime;
    const totalSeconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    timerDisplay.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // 每秒更新一次
    setTimeout(updatePipTimer, 1000);
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
        
        // 更新画中画位置、大小和样式
        updateCameraPipPosition();
        updateCameraPipSize();
        updateCameraPipStyle();
        
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

// 创建全屏摄像头预览
function createFullscreenCameraPreview() {
    // 创建全屏覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'camera-full-overlay';
    overlay.id = 'cameraFullOverlay';
    
    // 创建摄像头视图
    const cameraView = document.createElement('div');
    cameraView.className = 'camera-full-view';
    
    // 创建视频元素
    const fullscreenVideo = document.createElement('video');
    fullscreenVideo.autoplay = true;
    fullscreenVideo.muted = true;
    
    // 复制摄像头流
    if (state.cameraStream) {
        fullscreenVideo.srcObject = state.cameraStream;
    }
    
    // 添加模式指示器
    const modeIndicator = document.createElement('div');
    modeIndicator.className = 'mode-indicator';
    modeIndicator.innerHTML = `
        <i class="fas fa-video"></i>
        <span id="modeText">${getModeText()}</span>
        <i class="fas fa-times" id="closeFullscreen" style="margin-left: 10px; cursor: pointer;"></i>
    `;
    
    // 组装
    cameraView.appendChild(fullscreenVideo);
    cameraView.appendChild(modeIndicator);
    overlay.appendChild(cameraView);
    document.body.appendChild(overlay);
    
    // 添加关闭事件
    document.getElementById('closeFullscreen').addEventListener('click', closeFullscreenCamera);
    
    // 显示全屏预览
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);
    
    // 添加键盘退出
    document.addEventListener('keydown', handleFullscreenKeydown);
}

// 获取模式文本
function getModeText() {
    switch (state.recordingMode) {
        case 'camera-only': return '仅摄像头模式';
        case 'camera-pip-big': return '大窗口摄像头模式';
        case 'screen+camera': return '屏幕+摄像头模式';
        default: return '录制模式';
    }
}

// 关闭全屏预览
function closeFullscreenCamera() {
    const overlay = document.getElementById('cameraFullOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
            document.removeEventListener('keydown', handleFullscreenKeydown);
        }, 300);
    }
}

// 全屏模式键盘控制
function handleFullscreenKeydown(e) {
    if (e.key === 'Escape') {
        closeFullscreenCamera();
    }
}

// 在录制状态变化时更新托盘工具提示
function updateTrayTooltip() {
    if (!window.electronAPI || !window.electronAPI.setTrayTooltip) return;
    
    let tooltip = '屏幕录制工具';
    if (state.isRecording) {
        const elapsed = Date.now() - state.recordingStartTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        tooltip = `录制中: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    window.electronAPI.setTrayTooltip(tooltip);
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
            console.log('录制模式:', state.recordingMode);
            
            // 创建一个新的 Canvas 来合并视频
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 创建视频元素来播放屏幕流
            const screenVideo = document.createElement('video');
            screenVideo.srcObject = screenStream;
            screenVideo.play();
            
            // 创建摄像头视频元素
            const cameraVideo = document.createElement('video');
            cameraVideo.srcObject = state.cameraStream;
            cameraVideo.play();
            
            // 等待视频就绪
            await new Promise(resolve => {
                let videosReady = 0;
                const checkReady = () => {
                    videosReady++;
                    if (videosReady === (state.recordingMode === 'screen+camera' ? 2 : 1)) {
                        resolve();
                    }
                };
                
                screenVideo.onloadedmetadata = checkReady;
                cameraVideo.onloadedmetadata = checkReady;
            });
            
            // 设置Canvas大小
            if (state.recordingMode === 'camera-only' || state.recordingMode === 'camera-pip-big') {
                // 仅摄像头模式，使用摄像头分辨率
                canvas.width = cameraVideo.videoWidth;
                canvas.height = cameraVideo.videoHeight;
            } else {
                // 屏幕+摄像头模式，使用屏幕分辨率
                canvas.width = screenVideo.videoWidth;
                canvas.height = screenVideo.videoHeight;
            }
            
            // 绘制函数
            function drawFrame() {
                // 清除画布
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                switch (state.recordingMode) {
                    case 'camera-only':
                        // 仅摄像头模式
                        drawCameraOnlyMode(ctx, cameraVideo);
                        break;
                        
                    case 'camera-pip-big':
                        // 大窗口摄像头模式（摄像头在屏幕中央）
                        drawBigCameraMode(ctx, screenVideo, cameraVideo);
                        break;
                        
                    case 'screen+camera':
                    default:
                        // 屏幕+摄像头画中画模式
                        drawScreenWithCameraMode(ctx, screenVideo, cameraVideo);
                        break;
                }
                
                // 添加录制提示（如果正在录制）
                if (state.isRecording) {
                    addRecordingIndicator(ctx);
                }
                
                requestAnimationFrame(drawFrame);
            }
            
            // 不同的绘制模式函数
            function drawCameraOnlyMode(ctx, cameraVideo) {
                // 绘制背景
                if (state.cameraBackground === 'blur') {
                    // 模糊背景效果
                    ctx.filter = 'blur(20px)';
                    ctx.drawImage(cameraVideo, -20, -20, canvas.width + 40, canvas.height + 40);
                    ctx.filter = 'none';
                    
                    // 绘制半透明覆盖层
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                } else if (state.cameraBackground === 'color') {
                    // 纯色背景
                    ctx.fillStyle = state.backgroundColor;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                } else if (state.cameraBackground === 'transparent') {
                    // 透明背景 - 不绘制背景
                }
                
                // 绘制摄像头视频（带缩放）
                const scale = state.cameraSize / 100;
                const scaledWidth = canvas.width * scale;
                const scaledHeight = canvas.height * scale;
                const offsetX = (canvas.width - scaledWidth) / 2;
                const offsetY = (canvas.height - scaledHeight) / 2;
                
                // 应用圆角
                const radius = 15;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(offsetX + radius, offsetY);
                ctx.lineTo(offsetX + scaledWidth - radius, offsetY);
                ctx.quadraticCurveTo(offsetX + scaledWidth, offsetY, offsetX + scaledWidth, offsetY + radius);
                ctx.lineTo(offsetX + scaledWidth, offsetY + scaledHeight - radius);
                ctx.quadraticCurveTo(offsetX + scaledWidth, offsetY + scaledHeight, offsetX + scaledWidth - radius, offsetY + scaledHeight);
                ctx.lineTo(offsetX + radius, offsetY + scaledHeight);
                ctx.quadraticCurveTo(offsetX, offsetY + scaledHeight, offsetX, offsetY + scaledHeight - radius);
                ctx.lineTo(offsetX, offsetY + radius);
                ctx.quadraticCurveTo(offsetX, offsetY, offsetX + radius, offsetY);
                ctx.closePath();
                ctx.clip();
                
                // 绘制摄像头视频
                ctx.drawImage(cameraVideo, offsetX, offsetY, scaledWidth, scaledHeight);
                ctx.restore();
                
                // 添加边框
                if (state.showBorder) {
                    ctx.strokeStyle = state.borderColor;
                    ctx.lineWidth = state.borderWidth;
                    ctx.strokeRect(offsetX, offsetY, scaledWidth, scaledHeight);
                }
            }
            
            function drawBigCameraMode(ctx, screenVideo, cameraVideo) {
                // 绘制屏幕背景（模糊）
                ctx.filter = 'blur(10px)';
                ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none';
                
                // 绘制半透明覆盖层
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // 绘制大摄像头窗口
                const pipWidth = canvas.width * 0.6; // 60% 宽度
                const pipHeight = pipWidth * 0.75; // 保持 4:3 比例
                const pipX = (canvas.width - pipWidth) / 2;
                const pipY = (canvas.height - pipHeight) / 2;
                
                // 添加阴影
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetY = 10;
                
                // 绘制摄像头视频
                ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
                
                // 重置阴影
                ctx.shadowColor = 'transparent';
                
                // 添加边框
                if (state.showBorder) {
                    ctx.strokeStyle = state.borderColor;
                    ctx.lineWidth = state.borderWidth;
                    ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);
                }
            }
            
            function drawScreenWithCameraMode(ctx, screenVideo, cameraVideo) {
                // 绘制屏幕
                ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
                
                // 绘制摄像头画中画
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
                
                // 保存画布状态
                ctx.save();
                
                // 创建圆形/圆角裁剪路径
                if (state.pipStyle === 'circle') {
                    ctx.beginPath();
                    ctx.arc(
                        pipX + pipWidth/2,
                        pipY + pipHeight/2,
                        Math.min(pipWidth, pipHeight)/2,
                        0,
                        Math.PI * 2
                    );
                    ctx.clip();
                } else if (state.pipStyle === 'rounded') {
                    const radius = 10;
                    ctx.beginPath();
                    ctx.moveTo(pipX + radius, pipY);
                    ctx.lineTo(pipX + pipWidth - radius, pipY);
                    ctx.quadraticCurveTo(pipX + pipWidth, pipY, pipX + pipWidth, pipY + radius);
                    ctx.lineTo(pipX + pipWidth, pipY + pipHeight - radius);
                    ctx.quadraticCurveTo(pipX + pipWidth, pipY + pipHeight, pipX + pipWidth - radius, pipY + pipHeight);
                    ctx.lineTo(pipX + radius, pipY + pipHeight);
                    ctx.quadraticCurveTo(pipX, pipY + pipHeight, pipX, pipY + pipHeight - radius);
                    ctx.lineTo(pipX, pipY + radius);
                    ctx.quadraticCurveTo(pipX, pipY, pipX + radius, pipY);
                    ctx.closePath();
                    ctx.clip();
                }
                
                // 绘制摄像头视频
                ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
                
                // 恢复画布状态
                ctx.restore();
                
                // 根据样式添加边框
                if (state.showBorder) {
                    ctx.strokeStyle = state.borderColor;
                    ctx.lineWidth = state.borderWidth;
                    
                    if (state.pipStyle === 'circle') {
                        // 圆形边框
                        ctx.beginPath();
                        ctx.arc(
                            pipX + pipWidth/2,
                            pipY + pipHeight/2,
                            Math.min(pipWidth, pipHeight)/2,
                            0,
                            Math.PI * 2
                        );
                        ctx.stroke();
                    } else if (state.pipStyle === 'rounded') {
                        // 圆角矩形边框
                        const radius = 10;
                        ctx.beginPath();
                        ctx.moveTo(pipX + radius, pipY);
                        ctx.lineTo(pipX + pipWidth - radius, pipY);
                        ctx.quadraticCurveTo(pipX + pipWidth, pipY, pipX + pipWidth, pipY + radius);
                        ctx.lineTo(pipX + pipWidth, pipY + pipHeight - radius);
                        ctx.quadraticCurveTo(pipX + pipWidth, pipY + pipHeight, pipX + pipWidth - radius, pipY + pipHeight);
                        ctx.lineTo(pipX + radius, pipY + pipHeight);
                        ctx.quadraticCurveTo(pipX, pipY + pipHeight, pipX, pipY + pipHeight - radius);
                        ctx.lineTo(pipX, pipY + radius);
                        ctx.quadraticCurveTo(pipX, pipY, pipX + radius, pipY);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        // 方形边框
                        ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);
                    }
                }
            }
            
            // 添加录制指示器
            function addRecordingIndicator(ctx) {
                const indicatorSize = 20;
                const margin = 15;
                
                // 红色录制指示灯
                ctx.fillStyle = '#ff3b30';
                ctx.beginPath();
                ctx.arc(margin + indicatorSize/2, margin + indicatorSize/2, indicatorSize/2, 0, Math.PI * 2);
                ctx.fill();
                
                // 闪烁效果
                const flashOpacity = 0.3 + 0.4 * Math.sin(Date.now() / 500);
                ctx.fillStyle = `rgba(255, 59, 48, ${flashOpacity})`;
                ctx.beginPath();
                ctx.arc(margin + indicatorSize/2, margin + indicatorSize/2, indicatorSize, 0, Math.PI * 2);
                ctx.fill();
                
                // 录制中文字
                ctx.fillStyle = 'rgba(255, 59, 48, 0.9)';
                ctx.font = 'bold 16px Arial';
                ctx.fillText('录制中', margin + indicatorSize + 10, margin + indicatorSize/2 + 5);
                
                // 录制时间
                const elapsed = Date.now() - state.recordingStartTime;
                const totalSeconds = Math.floor(elapsed / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.font = 'bold 14px Arial';
                const timeWidth = ctx.measureText(timeText).width;
                ctx.fillRect(canvas.width - timeWidth - 20, margin, timeWidth + 10, 20);
                
                ctx.fillStyle = 'white';
                ctx.fillText(timeText, canvas.width - timeWidth - 15, margin + 15);
            }
            
            // 开始绘制
            drawFrame();
            
            // 从 Canvas 获取流
            finalStream = canvas.captureStream(30);
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
            
            // 停止计时器
            stopTimer();

            // 恢复窗口显示
            if (state.autoHideWindow) {
                showApplicationWindow();
                
                // 隐藏浮动画中画
                const floatingPIP = document.getElementById('floatingPIP');
                if (floatingPIP) {
                    floatingPIP.style.display = 'none';
                }
            }
            
            // 移除录制效果
            if (state.cameraEnabled) {
                removeRecordingEffects();
                // 重新启用拖拽功能
                if (state.cameraStream) {
                    setupCameraPipDrag();
                }
            }
            
            // 更新UI
            updateUIForStopped();
            updateStatus('录制完成', 'success');
        };
        
        // 开始录制
        state.mediaRecorder.start(1000); // 每1秒收集一次数据
        state.isRecording = true;
        
        // 开始计时器
        startTimer();

        // 如果设置了自动隐藏窗口，则隐藏应用窗口
        if (state.autoHideWindow) {
            await hideApplicationWindow();
            
            // 创建浮动画中画
            createAndShowFloatingPIP();
        }
        // 设置窗口属性
        if (window.electronAPI) {
            // 设置是否在任务栏显示
            // 注意：Electron 默认隐藏窗口后不在任务栏显示
            // 如果需要显示，需要更复杂的处理
            
            // 设置置顶
            if (state.alwaysOnTop) {
                await window.electronAPI.windowSetAlwaysOnTop(true);
            }
            
            // 设置点击穿透
            if (state.clickThrough) {
                await window.electronAPI.windowSetIgnoreMouseEvents(true, {
                    forward: true
                });
            }
        }
        
        // 添加录制效果
        if (state.cameraEnabled) {
            addRecordingEffects();
            // 禁用拖拽功能
            disableCameraPipDrag();
        }

        
        // 更新托盘提示
        updateTrayTooltip();
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
        
        // 如果录制失败，移除效果
        if (state.cameraEnabled) {
            removeRecordingEffects();
            if (state.cameraStream) {
                setupCameraPipDrag();
            }
        }
    }
}

// 创建并显示浮动画中画
function createAndShowFloatingPIP() {
    // 检查是否已存在浮动画中画
    let floatingPIP = document.getElementById('floatingPIP');
    if (!floatingPIP) {
        floatingPIP = createFloatingPIPWindow();
    }
    
    // 设置摄像头流
    const floatingVideo = document.getElementById('floatingPIPVideo');
    if (state.cameraStream && floatingVideo) {
        floatingVideo.srcObject = state.cameraStream;
    }
    
    // 显示浮动画中画
    floatingPIP.style.display = 'block';
    
    // 加载保存的位置
    loadFloatingPIPPosition(floatingPIP);
    
    return floatingPIP;
}

// 绿幕抠图函数
function applyGreenScreenFilter(ctx, cameraVideo, x, y, width, height) {
    if (!state.useGreenScreen) {
        ctx.drawImage(cameraVideo, x, y, width, height);
        return;
    }
    
    // 创建临时Canvas处理绿幕
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = width;
    tempCanvas.height = height;
    
    // 绘制摄像头视频到临时Canvas
    tempCtx.drawImage(cameraVideo, 0, 0, width, height);
    
    // 获取图像数据
    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // 将绿幕颜色转换为RGB
    const greenR = parseInt(state.greenScreenColor.substr(1, 2), 16);
    const greenG = parseInt(state.greenScreenColor.substr(3, 2), 16);
    const greenB = parseInt(state.greenScreenColor.substr(5, 2), 16);
    
    // 阈值
    const threshold = state.greenScreenThreshold * 255;
    
    // 处理每个像素
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 计算与绿幕颜色的差异
        const diff = Math.abs(r - greenR) + Math.abs(g - greenG) + Math.abs(b - greenB);
        
        // 如果接近绿幕颜色，设置为透明
        if (diff < threshold) {
            data[i + 3] = 0; // 设置alpha为0（透明）
        }
    }
    
    // 将处理后的图像数据放回
    tempCtx.putImageData(imageData, 0, 0);
    
    // 绘制处理后的图像到主Canvas
    ctx.drawImage(tempCanvas, x, y, width, height);
}

// 停止录制
function stopRecording() {
    if (!state.isRecording || !state.mediaRecorder) {
        return;
    }
    
    console.log('停止录制...');
    
    if (state.mediaRecorder.state === 'recording') {
        state.mediaRecorder.stop();
    }
    // 停止录制后显示窗口
    if (state.autoHideWindow) {
        showApplicationWindow();
        
        // 隐藏浮动画中画
        const floatingPIP = document.getElementById('floatingPIP');
        if (floatingPIP) {
            floatingPIP.style.display = 'none';
        }
    }
    // 恢复窗口属性
    if (window.electronAPI) {
        // 取消置顶
        if (state.alwaysOnTop) {
            window.electronAPI.windowSetAlwaysOnTop(false);
        }
        
        // 取消点击穿透
        if (state.clickThrough) {
            window.electronAPI.windowSetIgnoreMouseEvents(false);
        }
    }
    // 关闭全屏预览
    closeFullscreenCamera();
    // 更新托盘提示
    updateTrayTooltip();
    
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
    
    // 禁用所有设置
    document.querySelectorAll('.source-item').forEach(item => {
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.6';
    });
    
    // 禁用摄像头控制
    elements.cameraToggle.disabled = true;
    document.getElementById('showBorder').disabled = true;
    document.getElementById('showShadow').disabled = true;
    document.getElementById('borderColor').disabled = true;
    document.getElementById('borderWidth').disabled = true;
    document.getElementById('shadowIntensity').disabled = true;
    document.getElementById('opacity').disabled = true;
    document.getElementById('enableRecordingOpacity').disabled = true;
    document.getElementById('recordingOpacity').disabled = true;
    
    // 禁用模式设置
    document.querySelectorAll('input[name="recordingMode"]').forEach(radio => {
        radio.disabled = true;
    });
    document.getElementById('cameraBackground').disabled = true;
    document.getElementById('backgroundColor').disabled = true;
    document.getElementById('cameraSize').disabled = true;
    
    document.querySelectorAll('.style-option').forEach(option => {
        option.style.pointerEvents = 'none';
        option.style.opacity = '0.6';
    });
    document.querySelectorAll('.pip-option').forEach(option => {
        option.style.pointerEvents = 'none';
        option.style.opacity = '0.6';
    });
    elements.pipSizeSlider.disabled = true;
    
    // 根据模式更新状态文本
    let modeText = '';
    switch (state.recordingMode) {
        case 'camera-only':
            modeText = '仅摄像头模式';
            break;
        case 'camera-pip-big':
            modeText = '大窗口摄像头模式';
            break;
        default:
            modeText = '屏幕+摄像头模式';
    }
    
    elements.previewPlaceholder.innerHTML = `
        <i class="fas fa-circle" style="color: #ff3b30; animation: pulse 1.5s infinite;"></i>
        <p>录制中 - ${modeText}</p>
        <p style="font-size: 12px; color: #999;">点击停止录制按钮结束录制</p>
    `;
}

function updateUIForStopped() {
    elements.startBtn.disabled = !state.selectedSourceId;
    elements.startBtn.style.display = 'block';
    elements.stopBtn.style.display = 'none';
    elements.status.className = 'status-bar status-ready';
    
    // 启用所有设置
    document.querySelectorAll('.source-item').forEach(item => {
        item.style.pointerEvents = 'auto';
        item.style.opacity = '1';
    });
    
    // 启用摄像头控制
    elements.cameraToggle.disabled = false;
    document.getElementById('showBorder').disabled = false;
    document.getElementById('showShadow').disabled = false;
    document.getElementById('borderColor').disabled = false;
    document.getElementById('borderWidth').disabled = false;
    document.getElementById('shadowIntensity').disabled = false;
    document.getElementById('opacity').disabled = false;
    document.getElementById('enableRecordingOpacity').disabled = false;
    document.getElementById('recordingOpacity').disabled = false;
    
    // 启用模式设置
    document.querySelectorAll('input[name="recordingMode"]').forEach(radio => {
        radio.disabled = false;
    });
    document.getElementById('cameraBackground').disabled = false;
    document.getElementById('backgroundColor').disabled = false;
    document.getElementById('cameraSize').disabled = false;
    
    document.querySelectorAll('.style-option').forEach(option => {
        option.style.pointerEvents = 'auto';
        option.style.opacity = '1';
    });
    document.querySelectorAll('.pip-option').forEach(option => {
        option.style.pointerEvents = 'auto';
        option.style.opacity = '1';
    });
    elements.pipSizeSlider.disabled = false;
    
    if (state.selectedSourceId) {
        elements.previewPlaceholder.innerHTML = `
            <i class="fas fa-check-circle" style="color: #28a745;"></i>
            <p>准备就绪</p>
            <p style="font-size: 12px; color: #999;">可以开始新的录制</p>
        `;
    }
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
    document.getElementById('borderWidth').disabled = false;
    document.getElementById('shadowIntensity').disabled = false;
    document.getElementById('opacity').disabled = false;
    document.getElementById('enableRecordingOpacity').disabled = false;
    document.getElementById('recordingOpacity').disabled = false;
    document.querySelectorAll('.style-option').forEach(option => {
        option.style.pointerEvents = 'auto';
        option.style.opacity = '1';
    });
    document.querySelectorAll('.pip-option').forEach(option => {
        option.style.pointerEvents = 'auto';
        option.style.opacity = '1';
    });
    elements.pipSizeSlider.disabled = false;
    
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
        
        // 基础样式设置
        pipStyle: state.pipStyle,
        showBorder: state.showBorder,
        showShadow: state.showShadow,
        borderColor: state.borderColor,
        
        // 高级样式设置
        borderWidth: state.borderWidth,
        shadowIntensity: state.shadowIntensity,
        opacity: state.opacity,
        enableRecordingOpacity: state.enableRecordingOpacity,
        recordingOpacity: state.recordingOpacity,

        // 录制模式设置
        recordingMode: state.recordingMode,
        cameraBackground: state.cameraBackground,
        backgroundColor: state.backgroundColor,
        cameraSize: state.cameraSize,
        useGreenScreen: state.useGreenScreen,
        greenScreenColor: state.greenScreenColor,
        greenScreenThreshold: state.greenScreenThreshold
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
            
            // 加载基础样式设置
            state.pipStyle = settings.pipStyle || 'rounded';
            state.showBorder = settings.showBorder !== false; // 默认true
            state.showShadow = settings.showShadow !== false; // 默认true
            state.borderColor = settings.borderColor || '#667eea';
            
            // 加载高级样式设置
            state.borderWidth = settings.borderWidth || 3;
            state.shadowIntensity = settings.shadowIntensity || 20;
            state.opacity = settings.opacity || 100;
            state.enableRecordingOpacity = settings.enableRecordingOpacity || false;
            state.recordingOpacity = settings.recordingOpacity || 70;
            
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
            
            // 应用基础样式设置
            elements.styleOptions.forEach(option => {
                if (option.dataset.style === state.pipStyle) {
                    option.classList.add('selected');
                }
            });
            
            elements.showBorderCheckbox.checked = state.showBorder;
            elements.showShadowCheckbox.checked = state.showShadow;
            elements.borderColorPicker.value = state.borderColor;
            elements.borderColorPickerContainer.style.display = 
                state.showBorder ? 'block' : 'none';
            
            // 应用高级样式设置
            elements.borderWidthSlider.value = state.borderWidth;
            elements.borderWidthValue.textContent = state.borderWidth;
            elements.shadowIntensitySlider.value = state.shadowIntensity;
            elements.shadowIntensityValue.textContent = state.shadowIntensity;
            elements.opacitySlider.value = state.opacity;
            elements.opacityValue.textContent = state.opacity;
            elements.enableRecordingOpacityCheckbox.checked = state.enableRecordingOpacity;
            elements.recordingOpacitySlider.value = state.recordingOpacity;
            elements.recordingOpacityValue.textContent = state.recordingOpacity;
            elements.recordingOpacityContainer.style.display = 
                state.enableRecordingOpacity ? 'block' : 'none';
            
            // 如果摄像头启用且有权限，初始化摄像头
            if (state.cameraEnabled && state.permissions.camera === 'granted') {
                setTimeout(() => initCamera(), 1000); // 延迟初始化
            }

            // 加载录制模式设置
            state.recordingMode = settings.recordingMode || 'screen+camera';
            state.cameraBackground = settings.cameraBackground || 'blur';
            state.backgroundColor = settings.backgroundColor || '#1a1a1a';
            state.cameraSize = settings.cameraSize || 100;
            state.useGreenScreen = settings.useGreenScreen || false;
            state.greenScreenColor = settings.greenScreenColor || '#00ff00';
            state.greenScreenThreshold = settings.greenScreenThreshold || 0.3;
            
            // 应用录制模式设置
            document.querySelector(`input[name="recordingMode"][value="${state.recordingMode}"]`).checked = true;
            document.getElementById('cameraBackground').value = state.cameraBackground;
            document.getElementById('backgroundColor').value = state.backgroundColor;
            document.getElementById('cameraSize').value = state.cameraSize;
            document.getElementById('cameraSizeValue').textContent = state.cameraSize;
            
            document.getElementById('cameraOnlySettings').style.display = 
                state.recordingMode === 'camera-only' ? 'block' : 'none';
            document.getElementById('backgroundColorPicker').style.display = 
                state.cameraBackground === 'color' ? 'block' : 'none';
            
            // 如果摄像头启用，应用模式
            if (state.cameraEnabled && state.permissions.camera === 'granted') {
                updateCameraModePreview();
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