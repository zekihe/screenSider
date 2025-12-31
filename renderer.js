const { ipcRenderer } = require('electron');

// DOM Elements
const recBtn = document.getElementById('rec-btn');
const micBtn = document.getElementById('mic-btn');
// const systemAudioBtn = document.getElementById('system-audio-btn'); // 系统音频按钮已移除
const cameraBtn = document.getElementById('camera-btn');
const settingsBtn = document.getElementById('settings-btn');
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

// Initialize
async function init() {
  // Set up event listeners
  recBtn.addEventListener('click', toggleRecording);
  micBtn.addEventListener('click', toggleMic);
  cameraBtn.addEventListener('click', toggleCamera);
  settingsBtn.addEventListener('click', openSettings);
  testBtn && testBtn.addEventListener('click', testFunction)
  
  // Set initial button states
  micBtn.classList.toggle('active', isMicEnabled);
  cameraBtn.classList.toggle('active', isCameraEnabled);
}

// Recording Functions 开始录制桌面
async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    
    // Get screen sources
    const sources = await ipcRenderer.invoke('get-sources');
    
    // Select the first screen source
    let screenSource = sources.find(source => source.name === 'Entire Screen');
    
    // If not found, try to find any screen source
    if (!screenSource) {
      screenSource = sources.find(source => source.name === 'Screen 1');
    }
    
    // If still not found, try to find any source with type 'screen'
    if (!screenSource) {
      screenSource = sources.find(source => source.type === 'screen');
    }
    
    // If still not found, use the first source available
    if (!screenSource && sources.length > 0) {
      screenSource = sources[0];
    }
    
    if (!screenSource) {
      throw new Error('No screen source found');
    }
    // Create media stream
    const stream = await navigator.mediaDevices.getUserMedia({
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
    
    // Store the recording stream
    recordingStream = stream;

    
    // Always create microphone audio stream and add to recording stream at start
    // but disable it if mic is not enabled initially
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
      showErrorNotification('无法访问麦克风，请检查权限设置');
      return
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
        showErrorNotification('无法访问摄像头，请检查权限设置');
        return
      }
    }
    
    // Start recording
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
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
      showErrorNotification('无法开始录制，请确保授予权限');
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
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording-${Date.now()}.webm`;
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
      console.error('无法访问麦克风，请检查权限设置:', error);
      showErrorNotification('无法访问麦克风，请检查权限设置');
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
  const wasEnabled = isCameraEnabled;
  console.log('toggleCamera--1')
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
            isCameraEnabled = false;
            cameraBtn.classList.remove('active');
            showErrorNotification('无法启用摄像头，请检查权限设置');
          }
        }
      } else {
        // 如果没有录制，确保有摄像头流
        if (!cameraStream) {
          try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (error) {
            console.error('启用摄像头出错:', error);
            isCameraEnabled = false;
            cameraBtn.classList.remove('active');
            showErrorNotification('无法启用摄像头，请检查权限设置');
          }
        }
      }
    } catch (error) {
      console.error('无法访问摄像头，请检查权限设置:', error);
      showErrorNotification('无法访问摄像头，请检查权限设置');
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

  showErrorNotification('此功能建设中...');
  // Implement settings dialog
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

// Initialize app
init();
