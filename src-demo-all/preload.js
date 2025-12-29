const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 权限相关
  checkPermissions: () => ipcRenderer.invoke('check-permissions'),
  requestPermission: (permissionType) => ipcRenderer.invoke('request-permission', permissionType),
  
  // 屏幕源
  getSources: () => ipcRenderer.invoke('get-sources'),
  
  // 录制控制
  startRecording: (options) => ipcRenderer.invoke('start-recording', options),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  getIsRecording: () => ipcRenderer.invoke('get-is-recording'),
  
  // 文件操作
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),

  // 窗口控制 - 使用统一的方法或分别的方法
  windowControl: (action) => ipcRenderer.invoke('window-control', action),

  // 添加窗口控制
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // 事件监听
  onRecordingStopped: (callback) => ipcRenderer.on('recording-stopped', (event, data) => callback(data)),
  onStartRecordingFromTray: (callback) => ipcRenderer.on('start-recording-from-tray', () => callback()),
  onStopRecordingFromTray: (callback) => ipcRenderer.on('stop-recording-from-tray', () => callback()),
  
  // 移除监听器
  removeRecordingStoppedListener: () => ipcRenderer.removeAllListeners('recording-stopped'),
  removeTrayListeners: () => {
    ipcRenderer.removeAllListeners('start-recording-from-tray');
    ipcRenderer.removeAllListeners('stop-recording-from-tray');
  },

});