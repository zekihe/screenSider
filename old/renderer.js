const { ipcRenderer } = require('electron');

// DOM Elements
const recBtn = document.getElementById('rec-btn');
const micBtn = document.getElementById('mic-btn');
// const systemAudioBtn = document.getElementById('system-audio-btn'); // 系统音频按钮已移除
const cameraBtn = document.getElementById('camera-btn');
const windowSwitchBtn = document.getElementById('window-switch-btn');
const settingsBtn = document.getElementById('settings-btn');
// const formatSelect = document.getElementById('format-select'); // 格式选择已移到设置窗口
const statusText = document.querySelector('.status-text');
const recIndicator = document.querySelector('.rec-indicator');
const statusIndicator = document.querySelector('.status-indicator');
const testBtn = document.querySelector('.test-error-btn')

// State
let isRecording = false;
let isMicEnabled = false;
// let isSystemAudioEnabled = true; // 系统音频功能已移除
let isCameraEnabled = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null; // Track the recording stream
let audioStream = null; // Track the microphone audio stream
// let systemAudioStream = null; // 系统音频流已移除
let cameraStream = null; // Track the camera stream separately
let currentRecordingSource = null; // 当前选择的录制源，用于直接录制
let supportedFormats = []; // 支持的视频格式
let selectedFormat = 'mp4'; // 默认选择的格式

// Initialize
async function init() {
  // Detect supported video formats
  detectSupportedFormats();
  
  // Set up event listeners
  recBtn.addEventListener('click', toggleRecording);
  micBtn.addEventListener('click', toggleMic);
  cameraBtn.addEventListener('click', toggleCamera);
  windowSwitchBtn && windowSwitchBtn.addEventListener('click', showScreenSelector);
  settingsBtn && settingsBtn.addEventListener('click', openSettings);
  testBtn && testBtn.addEventListener('click', testFunction);
  // formatSelect && formatSelect.addEventListener('change', handleFormatChange); // 格式选择已移到设置窗口
  
  // Set up IPC listeners for format selection from settings window
  ipcRenderer.on('format-selected', (event, format) => {
    selectedFormat = format;
    console.log('Selected format changed to:', selectedFormat);
  });
  
  // Set initial button states
  micBtn.classList.toggle('active', isMicEnabled);
  cameraBtn.classList.toggle('active', isCameraEnabled);
  
  // Format options will be updated in settings window
}

// Detect supported video formats
function detectSupportedFormats() {
  // Check for common video formats
  const formatsToCheck = [
    { name: 'webm', mimeType: 'video/webm;codecs=vp9' },
    { name: 'webm', mimeType: 'video/webm;codecs=vp8' },
    { name: 'mp4', mimeType: 'video/mp4;codecs=h264' },
    { name: 'mp4', mimeType: 'video/mp4;codecs=avc1' },
    { name: 'webm', mimeType: 'video/webm' },
    { name: 'mp4', mimeType: 'video/mp4' }
  ];
  
  supportedFormats = formatsToCheck.filter(format => {
    return MediaRecorder.isTypeSupported(format.mimeType);
  });
  
  console.log('Supported video formats:', supportedFormats);
  
  // Update selectedFormat if default is not supported
  if (!supportedFormats.some(format => format.name === selectedFormat)) {
    selectedFormat = supportedFormats[0]?.name || 'webm';
  }
}

// Update format options function is now handled in settings window

// Handle format selection change is now handled in settings window

// Recording Functions 开始录制桌面
async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  console.log(`
    isRecording: ${isRecording}\n
    isMicEnabled: ${isMicEnabled}\n
    isCameraEnabled: ${isCameraEnabled}\n
  `)
  try {
    
    const permission = await ipcRenderer.invoke('get-permissions', 'screen');
    if (!permission) {
      showErrorNotification('申请桌面录制权限失败');
      return;
    }
  } catch (error) {
    console.log('get-permissions screen', error)
    showErrorNotification('申请桌面录制权限失败');
    return
  }

  try {
    let screenSource;
    
    // 如果已经有选择的录制源，直接使用
    if (currentRecordingSource) {
      screenSource = currentRecordingSource;
    } else {
      // 否则获取默认录制源（优先获取屏幕，其次是窗口）
      const sources = await ipcRenderer.invoke('get-sources');
      if (sources.length === 0) {
        showErrorNotification('未找到可用的录制源');
        return;
      }
      
      // 优先选择屏幕作为默认录制源
      screenSource = sources.find(source => 
        source.type === 'screen' || source.id.startsWith('screen')
      );
      
      // 如果没有屏幕源，选择第一个窗口源
      if (!screenSource) {
        screenSource = sources.find(source => 
          source.type === 'window' || source.id.startsWith('window')
        );
      }
      
      // 如果还是没有找到源，使用第一个可用源
      if (!screenSource) {
        screenSource = sources[0];
      }
      
      // 保存当前选择的录制源
      currentRecordingSource = screenSource;
    }
    
    if (!screenSource) {
      // 没有找到可用的录制源
      showErrorNotification('未找到可用的录制源');
      return;
    }
    
    // Create media stream with screen recording permission check
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080
          }
        }
      });
    } catch (screenError) {
      console.error('Error accessing screen:', screenError);
      
      // 提供更具体的屏幕录制权限错误提示
      let errorMessage = '无法访问屏幕录制功能';
      if (screenError.name === 'NotAllowedError') {
        errorMessage = '屏幕录制权限被拒绝，请在系统设置中允许访问';
      } else if (screenError.name === 'NotFoundError') {
        errorMessage = '未找到可用的屏幕录制设备';
      }
      
      showErrorNotification(errorMessage);
      return;
    }
    
    // Store the recording stream
    recordingStream = stream;

    
    // Always create microphone audio stream and add to recording stream at start
    // but disable it if mic is not enabled initially
    if (isMicEnabled) {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        // Set initial enabled state based on mic setting
        audioTrack.enabled = isMicEnabled;
        stream.addTrack(audioTrack);
      } catch (audioError) {
        console.error('Error adding audio stream:', audioError);
        // Continue recording without audio
        audioStream = null;
        isMicEnabled = false;
        micBtn.classList.remove('active');
        
        // 提供更具体的麦克风权限错误提示
        let errorMessage = '无法访问麦克风';
        if (audioError.name === 'NotAllowedError') {
          errorMessage = '麦克风权限被拒绝，请在系统设置中允许访问';
        } else if (audioError.name === 'NotFoundError') {
          errorMessage = '未检测到麦克风设备';
        }
        
        showErrorNotification(errorMessage);
        return
      }
    }
    
    // Add camera stream if enabled
    if (isCameraEnabled) {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const cameraTrack = cameraStream.getVideoTracks()[0];
        stream.addTrack(cameraTrack);
      } catch (cameraError) {
        console.error('Error adding camera stream:', cameraError);
        // Continue recording without camera
        cameraStream = null;
        
        // 提供更具体的摄像头权限错误提示
        let errorMessage = '无法访问摄像头';
        if (cameraError.name === 'NotAllowedError') {
          errorMessage = '摄像头权限被拒绝，请在系统设置中允许访问';
        } else if (cameraError.name === 'NotFoundError') {
          errorMessage = '未检测到摄像头设备';
        }
        
        showErrorNotification(errorMessage);
        return
      }
    }
    
    // Start recording
    // Find the best MIME type for the selected format
    const formatMimeTypes = supportedFormats.filter(format => format.name === selectedFormat);
    const mimeType = formatMimeTypes[0]?.mimeType || 'video/webm;codecs=vp9';
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      saveRecording(recordedChunks);
      recordedChunks = [];
      // Stream cleanup is handled in stopRecording function
    };
    
    mediaRecorder.start();
    isRecording = true;
    updateUI();
    
  } catch (error) {
      console.error('Error starting recording:', error);
      statusText.textContent = 'Error';
      
      // 提供更具体的录制错误提示
      let errorMessage = '无法开始录制';
      if (error.name === 'NotAllowedError') {
        errorMessage = '录制权限被拒绝，请检查系统权限设置';
      }
      
      showErrorNotification(errorMessage);
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    updateUI();
    
    // Stop and clean up all streams
    if (recordingStream) {
      recordingStream.getTracks().forEach(track => track.stop());
      recordingStream = null;
    }
    
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
    
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
  }
}

function saveRecording(chunks) {
  // Get the MIME type for the selected format
  const formatMimeTypes = supportedFormats.filter(format => format.name === selectedFormat);
  const mimeType = formatMimeTypes[0]?.mimeType || 'video/webm';
  
  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording-${Date.now()}.${selectedFormat}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Control Functions
/**
 * 切换麦克风的启用/禁用状态
 * 在录制过程中动态管理音频流，避免因音频轨道变化导致录制中断
 */
async function toggleMic() {
  try {
    
    const flagPermiss = await ipcRenderer.invoke('ask-permissions', 'microphone');
    if (!flagPermiss) {
      showErrorNotification('用户拒绝了麦克风访问权限');
      return;
    }
  } catch (error) {}
  // 记录当前麦克风状态
  const wasEnabled = isMicEnabled;
  
  // 如果要启用麦克风，先检查权限
  if (!isMicEnabled) {
    try {
      // 检查麦克风权限
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 权限检查通过，切换麦克风启用状态
      isMicEnabled = true;
      
      // 更新按钮的视觉状态
      micBtn.classList.add('active');
      
      // 如果正在录制，动态处理音频轨道
      if (isRecording && recordingStream && audioStream) {
        // 控制音频轨道的启用状态
        audioStream.getTracks().forEach(track => {
          track.enabled = true;
        });
      }
    } catch (error) {
      console.error('无法访问麦克风:', error);
      
      // 提供更具体的错误提示
      let errorMessage = '无法访问麦克风，请检查权限设置';
      if (error.name === 'NotAllowedError') {
        errorMessage = '麦克风权限被拒绝，请在系统设置中允许访问';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未检测到麦克风设备';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '麦克风正在被其他应用使用';
      }
      
      showErrorNotification(errorMessage);
      // 保持禁用状态
      isMicEnabled = false;
      micBtn.classList.remove('active');
      return;
    }
  } else {
    // 禁用麦克风
    isMicEnabled = false;
    micBtn.classList.remove('active');
    
    // 如果正在录制，动态禁用音频轨道
    if (isRecording && recordingStream && audioStream) {
      audioStream.getTracks().forEach(track => {
        track.enabled = false;
      });
    }
  }
  
  console.log(`
    isRecording: ${isRecording} 
    
    recordingStream: ${recordingStream}
    
    isMicEnabled: ${isMicEnabled}
    
    wasEnabled: ${wasEnabled}
    
    audioStream: ${audioStream}
  `)
}

// 系统音频录制功能已移除

// 开启摄像头
async function toggleCamera() {
  try {
    
    const flagPermiss = await ipcRenderer.invoke('ask-permissions', 'camera');
    console.log('flagPermiss', flagPermiss)
    if (!flagPermiss) {
      showErrorNotification('用户拒绝了摄像头访问权限');
      return;
    }
  } catch (error) {}
  const wasEnabled = isCameraEnabled;
  // 如果要启用摄像头，先检查权限
  if (!isCameraEnabled) {
    console.log('toggleCamera--2')
    try {
      // 检查摄像头权限
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // 权限检查通过，切换摄像头启用状态
      isCameraEnabled = true;
      cameraBtn.classList.add('active');
      
      // 显示摄像头窗口
      ipcRenderer.send('toggle-camera-window', true);
      console.log('toggleCamera--3')
      
      // 如果正在录制，动态处理摄像头轨道
      if (isRecording && recordingStream) {
        if (cameraStream) {
          // 如果已经有摄像头流，直接启用
          cameraStream.getTracks().forEach(track => {
            track.enabled = true;
          });
        } else {
          // 否则创建新的摄像头流
          try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const cameraTrack = cameraStream.getVideoTracks()[0];
            recordingStream.addTrack(cameraTrack);
          } catch (error) {
            console.error('录制过程中启用摄像头出错:', error);
            
            // 提供更具体的错误提示
            let errorMessage = '无法启用摄像头，请检查权限设置';
            if (error.name === 'NotAllowedError') {
              errorMessage = '摄像头权限被拒绝，请在系统设置中允许访问';
            } else if (error.name === 'NotFoundError') {
              errorMessage = '未检测到摄像头设备';
            } else if (error.name === 'NotReadableError') {
              errorMessage = '摄像头正在被其他应用使用';
            }
            
            isCameraEnabled = false;
            cameraBtn.classList.remove('active');
            showErrorNotification(errorMessage);
          }
        }
      } else {
        // 如果没有录制，确保有摄像头流
        if (!cameraStream) {
          try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (error) {
            console.error('启用摄像头出错:', error);
            
            // 提供更具体的错误提示
            let errorMessage = '无法启用摄像头，请检查权限设置';
            if (error.name === 'NotAllowedError') {
              errorMessage = '摄像头权限被拒绝，请在系统设置中允许访问';
            } else if (error.name === 'NotFoundError') {
              errorMessage = '未检测到摄像头设备';
            } else if (error.name === 'NotReadableError') {
              errorMessage = '摄像头正在被其他应用使用';
            }
            
            isCameraEnabled = false;
            cameraBtn.classList.remove('active');
            showErrorNotification(errorMessage);
          }
        }
      }
    } catch (error) {
      console.error('无法访问摄像头:', error);
      
      // 提供更具体的错误提示
      let errorMessage = '无法访问摄像头，请检查权限设置';
      if (error.name === 'NotAllowedError') {
        errorMessage = '摄像头权限被拒绝，请在系统设置中允许访问';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未检测到摄像头设备';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '摄像头正在被其他应用使用';
      }
      
      showErrorNotification(errorMessage);
      // 保持禁用状态
      isCameraEnabled = false;
      cameraBtn.classList.remove('active');
      return;
    }
  } else {
    // 禁用摄像头
    isCameraEnabled = false;
    cameraBtn.classList.remove('active');
    
    // 隐藏摄像头窗口
    ipcRenderer.send('toggle-camera-window', false);
    
    // 处理摄像头流
    if (cameraStream) {
      // 如果正在录制，只是禁用摄像头轨道，而不是停止它们
      if (isRecording) {
        cameraStream.getTracks().forEach(track => {
          track.enabled = false;
        });
      } else {
        // 如果没有录制，完全停止摄像头流
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
      }
    }
  }
}

function openSettings() {
  console.log('Settings clicked');
  // 打开设置窗口并传递当前选择的格式
  ipcRenderer.send('show-settings-window', selectedFormat);
}

function testFunction () {
  showErrorNotification('测试功能');
}

// UI Updates
function updateUI() {
  if (isRecording) {
    statusText.textContent = 'Recording';
    recBtn.classList.add('recording');
    recIndicator.classList.add('blinking');
    statusIndicator.classList.add('active');
  } else {
    statusText.textContent = 'Ready';
    recBtn.classList.remove('recording');
    recIndicator.classList.remove('blinking');
    statusIndicator.classList.remove('active');
  }
}

// Error Notification Functions
/**
 * 显示错误提示通知
 * @param {string} message - 错误消息内容
 * @param {number} duration - 显示持续时间（毫秒），默认3000ms
 */
function showErrorNotification(message, duration = 3000) {
  // 通过IPC发送错误消息到主进程
  ipcRenderer.send('show-error', { message, duration });
}

/**
 * 隐藏错误提示通知
 */
function hideErrorNotification() {
  // 通过IPC通知主进程关闭错误窗口
  ipcRenderer.send('close-error-window');
}

// 确保在全局作用域中可用
globalThis.showErrorNotification = showErrorNotification;
globalThis.hideErrorNotification = hideErrorNotification;

// Window Controls
ipcRenderer.on('window-controls', (event, args) => {
  // Handle window control events
});

// Show screen selector for window switching
function showScreenSelector() {
  try {
    // Show screen selector window
    ipcRenderer.send('show-screen-selector');
    
    // Wait for user to select a screen source
    ipcRenderer.once('screen-selected', (event, selectedSource) => {
      if (selectedSource) {
        console.log('Window switched to:', selectedSource.name);
        currentRecordingSource = selectedSource; // 更新当前录制源
        // statusText.textContent = `Selected: ${selectedSource.name}`;
      }
    });
  } catch (error) {
    console.error('Error showing screen selector:', error);
    showErrorNotification('无法显示屏幕选择器');
  }
}

// Initialize app
init();
