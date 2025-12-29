const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises; // 使用Promise版fs，避免回调嵌套

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            permissions: ['camera', 'microphone', 'filesystem'] // 请求文件系统权限
        }
    });

    // 加载src目录下的index.html
    mainWindow.loadFile(path.resolve(__dirname, 'index.html'));
    mainWindow.webContents.openDevTools();
}

// 监听渲染进程的保存请求
ipcMain.on('save-video', async (event, buffer) => {
    // 显示保存对话框
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: '保存录制视频',
        defaultPath: path.join(app.getPath('documents'), `recording-${Date.now()}.mp4`), // 默认保存到文档目录
        filters: [
            { name: 'MP4视频', extensions: ['mp4'] },
            { name: '所有文件', extensions: ['*'] }
        ]
    });

    if (!canceled && filePath) {
        try {
            // 写入文件
            await fs.writeFile(filePath, buffer);
            // 提示保存成功
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '保存成功',
                message: `视频已保存到：\n${filePath}`
            });
        } catch (err) {
            dialog.showErrorBox('保存失败', `无法写入文件：${err.message}`);
            console.error('保存错误：', err);
        }
    }
});

// 应用生命周期管理
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});