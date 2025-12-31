const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');

let mainWindow;
let errorWindow;
let cameraWindow;

// 创建错误提示窗口
function createErrorWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    errorWindow = new BrowserWindow({
        width: Math.floor(screenWidth * 0.8), // 宽度为屏幕的80%
        height: 60,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        show: false,
        x: Math.floor((screenWidth - (screenWidth * 0.8)) / 2), // 屏幕水平居中
        y: 40, // 屏幕顶部40px位置
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    errorWindow.loadFile('error.html');
    
    // 开发时可启用调试工具
    // errorWindow.webContents.openDevTools();
    
    errorWindow.on('closed', () => {
        errorWindow = null;
    });
}

// 创建摄像头画中画窗口
function createCameraWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    // 摄像头窗口配置
    const cameraWidth = 200;
    const cameraHeight = 200;
    
    cameraWindow = new BrowserWindow({
        width: cameraWidth,
        height: cameraHeight,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        movable: true, // 用于决定窗口是否可被用户移动
        show: false,
        x: Math.floor(screenWidth - cameraWidth - 20), // 右下角，距右边缘20px
        y: Math.floor(screenHeight - cameraHeight - 20), // 右下角，距下边缘20px
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    cameraWindow.loadFile('camera-overlay.html');
    
    // 开发时可启用调试工具
    // cameraWindow.webContents.openDevTools();
    
    cameraWindow.on('closed', () => {
        cameraWindow = null;
    });
}

// 显示错误提示
function showError(message, duration = 3000) {
    if (!errorWindow) {
        createErrorWindow();
    }
    
    // 显示窗口并发送错误信息
    errorWindow.show();
    errorWindow.webContents.send('show-error', { message, duration });
}

function createWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    mainWindow = new BrowserWindow({
        // width: 1200,
        // height: 400,
        width: 500,
        height: 80,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false, // 允许变化窗口
        movable: true,
        x: Math.floor((screenWidth - 500) / 2), // 水平居中
        y: Math.floor(screenHeight - 120), // 底部120px位置（窗口高度80px + 底部边距40px）
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    mainWindow.loadFile('index.html');
  
    // Open DevTools
    // mainWindow.webContents.openDevTools();
  
    // 允许窗口被拖动
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('window-controls', {
            isMaximized: mainWindow.isMaximized()
        });
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// 处理录制请求
ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 1920, height: 1080 },
        audio: true // 启用音频捕获
    });
    return sources;
});

// 监听渲染进程的错误提示请求
ipcMain.on('show-error', (event, { message, duration }) => {
    showError(message, duration);
});

// 监听错误窗口关闭请求
ipcMain.on('close-error-window', () => {
    if (errorWindow) {
        errorWindow.hide();
    }
});

// 切换摄像头窗口显示/隐藏
ipcMain.on('toggle-camera-window', (event, isEnabled) => {
    console.log('toggle-camera-window status', isEnabled)
    if (isEnabled) {
        showCameraWindow();
    } else {
        hideCameraWindow();
    }
});

// 显示摄像头窗口
function showCameraWindow() {
    if (!cameraWindow) {
        createCameraWindow();
        console.log('first showCamera')
        // 监听窗口内容加载完成事件，确保DOM加载后再发送消息
        cameraWindow.webContents.once('did-finish-load', () => {
            console.log('Camera window loaded, sending toggle-camera');
            cameraWindow.show()
            cameraWindow.webContents.send('toggle-camera', true);
        });
    } else {
        cameraWindow.show();
        console.log('2 showCamera')
        // 通知摄像头窗口启动摄像头流
        cameraWindow.webContents.send('toggle-camera', true);
    }
}

// 隐藏摄像头窗口
function hideCameraWindow() {
    console.log('first hideCameraWindow')
    if (cameraWindow) {
        console.log('2 hideCamera')
        // 通知摄像头窗口停止摄像头流
        cameraWindow.webContents.send('toggle-camera', false);
        // 添加延迟确保流停止后再隐藏窗口
        setTimeout(() => {
            cameraWindow.hide();
        }, 500);
    }
}

// 监听摄像头窗口错误
ipcMain.on('camera-error', (event, errorMessage) => {
    showError(`摄像头错误: ${errorMessage}`);
    // 发送错误信息到主窗口
    if (mainWindow) {
        mainWindow.webContents.send('camera-error', errorMessage);
    }
});

// 监听摄像头窗口准备就绪
ipcMain.on('camera-ready', () => {
    // 发送准备就绪信息到主窗口
    if (mainWindow) {
        mainWindow.webContents.send('camera-ready');
    }
});

// 监听摄像头窗口停止
ipcMain.on('camera-stopped', () => {
    // 发送停止信息到主窗口
    if (mainWindow) {
        mainWindow.webContents.send('camera-stopped');
    }
});
