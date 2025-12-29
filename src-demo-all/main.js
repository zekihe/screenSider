const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  systemPreferences,
  shell,
  Tray,
  Menu
} = require('electron');
const remote = require("@electron/remote/main")
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let recordingProcess = null;
let isRecording = false;
let currentOutputPath = '';


remote.initialize() // 初始化 @electron/remote

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a'
  });

  mainWindow.loadFile(path.resolve(__dirname, 'index.html'));
  console.log('>>>process.env.NODE_ENV：', process.env)
  // 开发工具
  // if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  // }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  remote.enable(mainWindow.webContents) // 为当前窗口启用 @electron/remote
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(__dirname, 'assets/icons/tray-icon.png');
  
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '开始录制',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('start-recording-from-tray');
        }
      }
    },
    {
      label: '停止录制',
      click: () => {
        if (mainWindow && isRecording) {
          mainWindow.webContents.send('stop-recording-from-tray');
        }
      },
      enabled: isRecording
    },
    { type: 'separator' },
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('屏幕录制工具');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// IPC 处理器
ipcMain.handle('check-permissions', async () => {
  if (process.platform === 'darwin') {
    return {
      screen: systemPreferences.getMediaAccessStatus('screen'),
      camera: systemPreferences.getMediaAccessStatus('camera'),
      microphone: systemPreferences.getMediaAccessStatus('microphone')
    };
  }
  return { screen: 'granted', camera: 'granted', microphone: 'granted' };
});

ipcMain.handle('request-permission', async (event, permissionType) => {
  if (process.platform === 'darwin') {
    const result = await systemPreferences.askForMediaAccess(permissionType);
    return result;
  }
  return true;
});

ipcMain.handle('get-sources', async () => {
  const { desktopCapturer } = require('electron');
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 150, height: 150 }
  });
  
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

ipcMain.handle('start-recording', async (event, options) => {
  if (isRecording) {
    throw new Error('已经在录制中');
  }

  const videosDir = app.getPath('videos');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  currentOutputPath = path.join(videosDir, `recording_${timestamp}.mp4`);
  
  // 构建 FFmpeg 命令
  const ffmpegArgs = [
    '-f', 'avfoundation',
    '-i', `${options.screenId}:${options.audioDeviceId || 'default'}`,
    '-vf', `crop=${options.width}:${options.height}:${options.x}:${options.y}`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-pix_fmt', 'yuv420p',
    currentOutputPath
  ];

  console.log('开始录制，输出路径:', currentOutputPath);
  console.log('FFmpeg 参数:', ffmpegArgs);

  recordingProcess = spawn('ffmpeg', ffmpegArgs);
  
  recordingProcess.stdout.on('data', (data) => {
    console.log(`FFmpeg stdout: ${data}`);
  });
  
  recordingProcess.stderr.on('data', (data) => {
    console.log(`FFmpeg stderr: ${data}`);
  });
  
  recordingProcess.on('close', (code) => {
    console.log(`FFmpeg 进程退出，代码: ${code}`);
    isRecording = false;
    recordingProcess = null;
    
    if (mainWindow) {
      mainWindow.webContents.send('recording-stopped', { 
        outputPath: currentOutputPath,
        exitCode: code 
      });
    }
  });
  
  recordingProcess.on('error', (err) => {
    console.error('FFmpeg 启动失败:', err);
    isRecording = false;
    recordingProcess = null;
    throw new Error(`录制启动失败: ${err.message}`);
  });

  isRecording = true;
  
  // 更新托盘菜单
  updateTrayMenu();
  
  return { 
    success: true, 
    outputPath: currentOutputPath,
    pid: recordingProcess.pid 
  };
});

ipcMain.handle('stop-recording', async () => {
  if (recordingProcess && isRecording) {
    recordingProcess.kill('SIGINT');
    isRecording = false;
    recordingProcess = null;
    
    updateTrayMenu();
    return { success: true, message: '录制已停止' };
  }
  return { success: false, message: '没有正在进行的录制' };
});

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '视频文件', extensions: ['mp4', 'mov', 'avi', 'mkv'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('show-in-folder', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('get-is-recording', () => {
  return isRecording;
});

// 更新托盘菜单
function updateTrayMenu() {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isRecording ? '停止录制' : '开始录制',
      click: () => {
        if (mainWindow) {
          if (isRecording) {
            mainWindow.webContents.send('stop-recording-from-tray');
          } else {
            mainWindow.webContents.send('start-recording-from-tray');
          }
        }
      }
    },
    {
      label: '最近录制',
      enabled: currentOutputPath && fs.existsSync(currentOutputPath),
      click: () => {
        if (currentOutputPath && fs.existsSync(currentOutputPath)) {
          shell.showItemInFolder(currentOutputPath);
        }
      }
    },
    { type: 'separator' },
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// 应用生命周期
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 清理录制进程
app.on('before-quit', () => {
  if (recordingProcess && isRecording) {
    recordingProcess.kill('SIGTERM');
  }
});

// 在 IPC 处理器部分添加以下代码
ipcMain.handle('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.minimize();
    return true;
  }
  return false;
});

ipcMain.handle('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return true;
  }
  return false;
});

ipcMain.handle('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

ipcMain.handle('window-is-maximized', () => {
  const win = BrowserWindow.getFocusedWindow();
  return win ? win.isMaximized() : false;
});

// 
ipcMain.handle('window-control', (event, action) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return false;
  
  switch (action) {
    case 'minimize':
      win.minimize();
      return true;
      
    case 'maximize':
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      return true;
      
    case 'close':
      win.close();
      return true;
      
    case 'is-maximized':
      return win.isMaximized();
      
    default:
      return false;
  }
});