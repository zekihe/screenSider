// src/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            permissions: ['camera', 'microphone']
        }
    });

    // 加载src目录下的index.html（用path.resolve拼接绝对路径）
    mainWindow.loadFile(path.resolve(__dirname, 'index.html'));
    
    mainWindow.webContents.openDevTools();
}

// 其余代码保持不变...

app.whenReady().then(createWindow);

// 关闭窗口逻辑
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});