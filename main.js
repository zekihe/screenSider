const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');

// 检查当前是否为开发环境
const isDev = () => {
    return process.env.NODE_ENV === 'development';
};

let mainWindow;
let errorWindow;
let cameraWindow;
let screenSelectorWindow;
let screenSelectorCallback = null;

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
    
    // Open DevTools in development environment only
    if (isDev()) {
        errorWindow.webContents.openDevTools();
    }
    
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
    
    // Open DevTools in development environment only
    if (isDev()) {
        cameraWindow.webContents.openDevTools();
    }
    
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
  
    // Open DevTools in development environment only
    if (isDev()) {
        mainWindow.setBounds({ width: 1200, height: 400 })
        mainWindow.webContents.openDevTools();
    }
  
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

// 创建屏幕选择窗口
function createScreenSelectorWindow(callback) {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    
    screenSelectorWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        resizable: true,
        movable: true,
        show: false,
        x: Math.floor((screenWidth - 800) / 2),
        y: Math.floor((screenHeight - 600) / 2),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });
    
    screenSelectorWindow.loadFile('screen-selector.html');
    
    // Open DevTools in development environment only
    if (isDev()) {
        screenSelectorWindow.webContents.openDevTools();
    }
    
    // Store callback
    screenSelectorCallback = callback;
    
    screenSelectorWindow.on('closed', () => {
        screenSelectorWindow = null;
        screenSelectorCallback = null;
    });
}

// 显示屏幕选择窗口
function showScreenSelectorWindow(callback) {
    if (!screenSelectorWindow) {
        createScreenSelectorWindow(callback);
    } else {
        screenSelectorCallback = callback;
    }
    
    screenSelectorWindow.show();
}

// 监听屏幕选择请求
ipcMain.on('show-screen-selector', (event) => {
    showScreenSelectorWindow((selectedSource) => {
        if (selectedSource) {
            event.sender.send('screen-selected', selectedSource);
        }
    });
});

// 监听屏幕选择窗口请求屏幕源
ipcMain.on('request-sources', async (event) => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['window', 'screen'],
            thumbnailSize: { width: 1920, height: 1080 },
            audio: true
        });
        event.sender.send('screen-sources', sources);
    } catch (error) {
        console.error('Error getting screen sources:', error);
        event.sender.send('screen-sources', []);
    }
});

// 监听屏幕选择窗口确认选择
ipcMain.on('screen-select-confirm', (event, selectedSource) => {
    if (screenSelectorCallback) {
        screenSelectorCallback(selectedSource);
        screenSelectorCallback = null;
    }
    // console.log('screen-select-confirm', selectedSource)
    // 先保存选择的窗口信息
    const isWindowSource = selectedSource.type === 'window' || 
        (selectedSource.id && selectedSource.id.startsWith('window'));
    const selectedWindowName = isWindowSource ? selectedSource.name : null;
    
    // 先关闭屏幕选择器窗口，释放焦点
    if (screenSelectorWindow) {
        screenSelectorWindow.close();
    }
    
    // 等待屏幕选择器窗口关闭后，再尝试激活目标窗口
    if (isWindowSource && selectedWindowName) {
        // 添加一个短暂的延迟，确保屏幕选择器窗口完全关闭
        setTimeout(() => {
            try {
                const { exec } = require('child_process');
                
                // 使用独立的AppleScript文件来激活窗口
                // 这比通过命令行传递复杂脚本更可靠
                const scriptPath = path.join(__dirname, 'activate-window.scpt');
                const escapedWindowName = selectedWindowName.replace(/"/g, '\\"'); // 转义双引号
                
                // 执行独立的AppleScript文件，传递窗口名称作为参数
                const appleScriptCommand = `osascript "${scriptPath}" "${escapedWindowName}"`;
                
                // 执行AppleScript并添加详细调试信息
                exec(appleScriptCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('Error activating window:', error);
                        console.error('AppleScript stderr:', stderr);
                        console.error('Executed AppleScript command:', appleScriptCommand);
                    } else {
                        console.log('Window activation result:', stdout.trim());
                    }
                });
            } catch (error) {
                console.error('Error in window activation logic:', error);
            }
        }, 100); // 100ms延迟，确保屏幕选择器窗口完全关闭
    }
});

// 监听屏幕选择窗口取消选择
ipcMain.on('screen-select-cancel', () => {
    if (screenSelectorCallback) {
        screenSelectorCallback(null);
        screenSelectorCallback = null;
    }
    
    // Close the screen selector window
    if (screenSelectorWindow) {
        screenSelectorWindow.close();
    }
});
