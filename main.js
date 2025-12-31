const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');

let mainWindow;
let errorWindow;

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
        width: 500,
        height: 80,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true, // 允许变化窗口
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
        thumbnailSize: { width: 1920, height: 1080 }
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
