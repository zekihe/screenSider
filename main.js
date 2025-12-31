const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    mainWindow = new BrowserWindow({
        // width: 1200, // 500
        // height: 800, // 80
        width: 500, // 500
        height: 80, // 80
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true, // 允许变化窗口
        movable: true,
        center: true,
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
