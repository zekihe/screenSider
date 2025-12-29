const { 
    app,
    BrowserWindow,
    ipcMain,
    desktopCapturer,
    systemPreferences,
    Tray,
    Menu,
    nativeImage,
    globalShortcut
} = require('electron');
const path = require('path');

const winCanvas = require('canvas');

let mainWindow = null;
let cameraWindow = null;
let tray = null;

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
        // mainWindow.webContents.openDevTools();
    // }
}

function createCameraWindow() {
    cameraWindow = new BrowserWindow({
        width: 400,
        height: 300,
        x: 100,
        y: 100,
        frame: false, // 无边框
        transparent: true, // 透明背景
        alwaysOnTop: true, // 始终置顶
        skipTaskbar: true, // 不在任务栏显示
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        show: false, // 初始不显示
        webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'camera-preload.js')
        }
    });
    
    cameraWindow.loadFile('camera-window.html');
    
    // 窗口关闭时清理
    cameraWindow.on('closed', () => {
        cameraWindow = null;
    });
    
    return cameraWindow;
}

// 创建系统托盘
function createTray() {
    // 创建托盘图标（可以使用默认图标或自定义图标）
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    let trayIcon;
    
    try {
        trayIcon = nativeImage.createFromPath(iconPath);
    } catch (error) {
        // 如果图标文件不存在，创建一个简单的图标
        trayIcon = nativeImage.createEmpty();
    }
    
    if (trayIcon.isEmpty()) {
        // 创建一个简单的红色圆形作为托盘图标
        const canvas = winCanvas.createCanvas(16, 16);
        const ctx = canvas.getContext('2d');
        
        // 红色圆形
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(8, 8, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // 白色录制图标
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(6, 4, 4, 8);
        
        trayIcon = nativeImage.createFromBuffer(canvas.toBuffer());
    }
    
    tray = new Tray(trayIcon);
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                }
            }
        },
        {
            label: '开始录制',
            click: () => {
                if (mainWindow) {
                    mainWindow.webContents.send('tray-start-recording');
                }
            }
        },
        {
            label: '停止录制',
            click: () => {
                if (mainWindow) {
                    mainWindow.webContents.send('tray-stop-recording');
                }
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.quit();
            }
        }
    ]);
    
    tray.setToolTip('屏幕录制工具');
    tray.setContextMenu(contextMenu);
    
    // 点击托盘图标显示/隐藏窗口
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
    
    return tray;
}

// 销毁系统托盘
function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}

// 注册全局快捷键
function registerGlobalShortcuts() {
    // 开始/停止录制快捷键 (Cmd/Ctrl+Shift+R)
    const ret = globalShortcut.register('CommandOrControl+Shift+R', () => {
        if (mainWindow) {
            mainWindow.webContents.send('global-shortcut-toggle-recording');
        }
    });
    
    if (!ret) {
        console.log('全局快捷键注册失败');
    }
    
    // 显示/隐藏窗口快捷键 (Cmd/Ctrl+Shift+H)
    const ret2 = globalShortcut.register('CommandOrControl+Shift+H', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
    
    console.log('全局快捷键已注册');
}

// 取消注册全局快捷键
function unregisterGlobalShortcuts() {
    globalShortcut.unregisterAll();
}

// 在 main.js 中添加画中画窗口
let pipWindow = null;

function createPIPWindow() {
    pipWindow = new BrowserWindow({
        width: 300,
        height: 200,
        x: 100,
        y: 100,
        frame: false, // 无边框
        transparent: true, // 透明背景
        alwaysOnTop: true, // 始终置顶
        skipTaskbar: true, // 不在任务栏显示
        resizable: true,
        movable: true,
        minimizable: true,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    
    pipWindow.loadFile('pip-window.html');
    
    // 禁止最大化
    pipWindow.setMaximizable(false);
    
    // 监听窗口事件
    pipWindow.on('closed', () => {
        pipWindow = null;
    });
    
    // 监听来自画中画窗口的消息
    pipWindow.webContents.on('ipc-message', (event, channel, ...args) => {
        if (channel === 'pip-window-close') {
            pipWindow.close();
        } else if (channel === 'pip-window-minimize') {
            pipWindow.minimize();
        } else if (channel === 'pip-window-toggle-always-on-top') {
            const isAlwaysOnTop = pipWindow.isAlwaysOnTop();
            pipWindow.setAlwaysOnTop(!isAlwaysOnTop);
        } else if (channel === 'pip-window-move') {
            const [dx, dy] = args;
            const [x, y] = pipWindow.getPosition();
            pipWindow.setPosition(x + dx, y + dy);
        } else if (channel === 'pip-timer-update') {
            // 转发给主窗口
            if (mainWindow) {
                mainWindow.webContents.send('pip-timer-update', args[0]);
            }
        }
    });
    
    return pipWindow;
}

// 新的IPC处理器 - 只录制摄像头
ipcMain.handle('record-camera-only', async (event, options) => {
    if (isRecording) {
        throw new Error('已经在录制中');
    }

    // 隐藏主窗口
    if (mainWindow) {
        mainWindow.hide();
    }
    
    // 创建或显示摄像头窗口
    if (!cameraWindow) {
        cameraWindow = createCameraWindow();
    }
    cameraWindow.show();
    
    const videosDir = app.getPath('videos');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    currentOutputPath = path.join(videosDir, `camera-only-${timestamp}.mp4`);
    
    // 使用FFmpeg直接录制摄像头
    const ffmpegArgs = [
        '-f', 'avfoundation',
        '-i', `0:${options.audioDeviceId || 'default'}`, // 0 通常是摄像头
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        currentOutputPath
    ];
    
    console.log('开始仅摄像头录制:', currentOutputPath);
    
    const ffmpegPath = require('ffmpeg-static');
    recordingProcess = spawn(ffmpegPath, ffmpegArgs);
    
    recordingProcess.on('close', (code) => {
        console.log('摄像头录制完成，退出代码:', code);
        isRecording = false;
        recordingProcess = null;
        
        // 恢复主窗口
        if (mainWindow) {
            mainWindow.show();
        }
        
        // 关闭摄像头窗口
        if (cameraWindow) {
            cameraWindow.close();
        }
        
        if (mainWindow) {
            mainWindow.webContents.send('camera-recording-stopped', { 
                outputPath: currentOutputPath,
                exitCode: code 
            });
        }
    });
    
    isRecording = true;
    return { success: true, outputPath: currentOutputPath };
});

// 添加IPC处理器
ipcMain.handle('create-pip-window', () => {
    if (!pipWindow) {
        createPIPWindow();
    }
    return true;
});

ipcMain.handle('close-pip-window', () => {
    if (pipWindow) {
        pipWindow.close();
    }
    return true;
});

ipcMain.handle('send-to-pip-window', (event, channel, ...args) => {
    if (pipWindow) {
        pipWindow.webContents.send(channel, ...args);
    }
    return true;
});

// 在录制开始时创建画中画窗口
// 在录制结束时关闭画中画窗口

// 添加IPC处理器
ipcMain.handle('create-tray', () => {
    createTray();
    return true;
});

ipcMain.handle('destroy-tray', () => {
    destroyTray();
    return true;
});

ipcMain.handle('set-tray-tooltip', (event, tooltip) => {
    if (tray) {
        tray.setToolTip(tooltip);
    }
    return true;
});

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

ipcMain.handle('window-minimize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.minimize();
        return true;
    }
    return false;
});

ipcMain.handle('window-hide', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.hide();
        return true;
    }
    return false;
});

ipcMain.handle('window-show', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.show();
        win.focus();
        return true;
    }
    return false;
});

ipcMain.handle('window-is-visible', () => {
    const win = BrowserWindow.getFocusedWindow();
    return win ? win.isVisible() : false;
});

ipcMain.handle('window-set-always-on-top', (event, flag) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.setAlwaysOnTop(flag, 'screen-saver');
        return true;
    }
    return false;
});

ipcMain.handle('window-set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.setIgnoreMouseEvents(ignore, options);
        return true;
    }
    return false;
});

// 添加IPC处理器
ipcMain.handle('register-global-shortcut', (event, shortcut, action) => {
    const ret = globalShortcut.register(shortcut, () => {
        if (mainWindow) {
            mainWindow.webContents.send('global-shortcut-action', action);
        }
    });
    return ret;
});

ipcMain.handle('unregister-global-shortcut', (event, shortcut) => {
    globalShortcut.unregister(shortcut);
    return true;
});

// 应用生命周期
app.whenReady().then(() => {
    createWindow();
    createTray(); // 创建系统托盘
    registerGlobalShortcuts(); // 注册全局快捷键
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 应用退出时取消快捷键
app.on('will-quit', () => {
    unregisterGlobalShortcuts();
});


app.on('window-all-closed', () => {
    // 不退出应用，保持托盘运行
    if (process.platform !== 'darwin') {
        // 可以在这里隐藏窗口而不是退出
        // 用户可以通过托盘图标重新打开窗口
        // app.quit();
    }
});