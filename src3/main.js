const { app, BrowserWindow, desktopCapturer } = require('electron');
const { initialize, enable } = require('@electron/remote/main');
const path = require('path');

initialize(); // 初始化 @electron/remote

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true, // 启用 remote 模块
            permissions: ['camera', 'microphone', 'filesystem'] 
        }
    });

    enable(mainWindow.webContents); // 为当前窗口启用 @electron/remote
    mainWindow.loadFile(path.resolve(__dirname, 'index.html'));
    
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            window.desktopCapturer = require('electron').desktopCapturer;
        `);
    });
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform!== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});