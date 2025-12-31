const { ipcRenderer } = require('electron');

// DOM Elements
const recBtn = document.getElementById('rec-btn');
const micBtn = document.getElementById('mic-btn');
const cameraBtn = document.getElementById('camera-btn');
const settingsBtn = document.getElementById('settings-btn');
const statusText = document.querySelector('.status-text');
const recIndicator = document.querySelector('.rec-indicator');
const statusIndicator = document.querySelector('.status-indicator');

// State
let isRecording = false;
let isMicEnabled = false;
let isCameraEnabled = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null; // Track the recording stream
let audioStream = null; // Track the audio stream separately
let cameraStream = null; // Track the camera stream separately

// Initialize
async function init() {
  // Set up event listeners
  recBtn.addEventListener('click', toggleRecording);
  micBtn.addEventListener('click', toggleMic);
  cameraBtn.addEventListener('click', toggleCamera);
  settingsBtn.addEventListener('click', openSettings);
  
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
    
    // Always create audio stream and add to recording stream at start
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
function toggleMic() {
  // 记录当前麦克风状态
  const wasEnabled = isMicEnabled;
  
  // 切换麦克风启用状态
  isMicEnabled = !isMicEnabled;
  
  // 更新按钮的视觉状态
  micBtn.classList.toggle('active', isMicEnabled);
  
  console.log(`
    isRecording: ${isRecording} \n
    recordingStream: ${recordingStream}\n
    isMicEnabled: ${isMicEnabled}\n
    wasEnabled: ${wasEnabled}\n
    audioStream: ${audioStream}
  `)

  // 如果正在录制，动态处理音频轨道的启用/禁用
  if (isRecording && recordingStream && audioStream) {
    // 控制音频轨道的启用状态，而不是添加/移除轨道
    audioStream.getTracks().forEach(track => {
      track.enabled = isMicEnabled;
    });
  }
}

function toggleCamera() {
  const wasEnabled = isCameraEnabled;
  isCameraEnabled = !isCameraEnabled;
  cameraBtn.classList.toggle('active', isCameraEnabled);
  
  // If recording, dynamically enable/disable camera track
  if (isRecording && recordingStream) {
    if (isCameraEnabled && !wasEnabled) {
      // Enable camera during recording
      if (cameraStream) {
        // If we already have a camera stream, just enable it
        cameraStream.getTracks().forEach(track => {
          track.enabled = true;
        });
      } else {
        // Otherwise create a new camera stream
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            cameraStream = stream;
            const cameraTrack = stream.getVideoTracks()[0];
            recordingStream.addTrack(cameraTrack);
          })
          .catch(error => {
            console.error('Error enabling camera during recording:', error);
            // Revert the state if we couldn't enable camera
            isCameraEnabled = false;
            cameraBtn.classList.remove('active');
          });
      }
    } else if (!isCameraEnabled && wasEnabled) {
      // Disable camera during recording
      if (cameraStream) {
        // Instead of removing tracks from recording stream or stopping the stream,
        // just disable the camera tracks
        cameraStream.getTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }
  }
}

function openSettings() {
  console.log('Settings clicked');
  // Implement settings dialog
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

// Window Controls
ipcRenderer.on('window-controls', (event, args) => {
  // Handle window control events
});

// Initialize app
init();
