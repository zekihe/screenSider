const { ipcRenderer } = require('electron');

// State
let cameraStream = null;
let cameraPreview;

// Initialize camera overlay
async function init() {
  // 获取video元素
  cameraPreview = document.getElementById('camera-preview');
  // 只设置事件监听器，不自动启动摄像头

  // Listen for messages from main process
  ipcRenderer.on('toggle-camera', (event, isEnabled) => {
    if (isEnabled) {
      startCameraPreview();
    } else {
      stopCameraPreview();
    }
  });

  ipcRenderer.on('close-overlay', () => {
    stopCameraPreview();
  });
}

// Start camera preview
async function startCameraPreview() {
  try {
    // Stop existing stream if any
    if (cameraStream) {
      await stopCameraPreview();
    }

    // Get camera stream with permission check
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 320 }, 
        height: { ideal: 320 },
        facingMode: 'user'
      } 
    });
    console.log('cameraPreview async', cameraPreview)
    // Set stream to video element
    cameraPreview.srcObject = cameraStream;

    // Send ready signal to main process
    ipcRenderer.send('camera-ready');
  } catch (error) {
    console.error('Failed to start camera preview:', error);
    
    // Provide user-friendly error messages based on error type
    let errorMessage = '无法访问摄像头';
    if (error.name === 'NotAllowedError') {
      errorMessage = '摄像头权限被拒绝，请在系统设置中允许访问';
    } else if (error.name === 'NotFoundError') {
      errorMessage = '未检测到摄像头设备';
    } else if (error.name === 'NotReadableError') {
      errorMessage = '摄像头正在被其他应用使用';
    }
    
    // Send detailed error message to main process
    ipcRenderer.send('camera-error', errorMessage);
    throw error;
  }
}

// Stop camera preview
async function stopCameraPreview() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (cameraPreview.srcObject) {
    cameraPreview.srcObject = null;
  }

  ipcRenderer.send('camera-stopped');
}

// Handle window close
window.addEventListener('beforeunload', () => {
  stopCameraPreview();
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);