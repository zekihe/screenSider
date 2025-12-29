const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.resolve(__dirname, './index.html'));
    
    // if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    // }
}

// IPC 处理器
ipcMain.handle('get-sources', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 200, height: 200 }
        });
        
        return sources.map(source => ({
            id: source.id,
            name: source.name,
            thumbnail: source.thumbnail.toDataURL()
        }));
    } catch (error) {
        console.error('获取屏幕源失败:', error);
        return [];
    }
});

ipcMain.handle('check-permissions', () => {
    if (process.platform === 'darwin') {
        return {
            screen: systemPreferences.getMediaAccessStatus('screen'),
            camera: systemPreferences.getMediaAccessStatus('camera'),
            microphone: systemPreferences.getMediaAccessStatus('microphone')
        };
    }
    return { 
        screen: 'granted', 
        camera: 'granted', 
        microphone: 'granted' 
    };
});

ipcMain.handle('request-permission', async (event, permissionType) => {
    if (process.platform === 'darwin') {
        const result = await systemPreferences.askForMediaAccess(permissionType);
        return result;
    }
    return true;
});

// 应用生命周期
app.whenReady().then(() => {
    createWindow();
    
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