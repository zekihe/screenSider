const {
    app,
    BrowserWindow,
    ipcMain,
    desktopCapturer,
    screen,
    systemPreferences
} = require('electron')
const path = require('path')
const url = require('url')

// 检查当前是否为开发环境
const isDev = () => {
    return process.env.NODE_ENV === 'development'
}

let mainWindow
let errorWindow
let cameraWindow
let screenSelectorWindow
let settingsWindow
let screenSelectorCallback = null

// 创建主窗口
function createMainWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

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
            preload: isDev()
                ? path.join(__dirname, '../../dist/preload/index.js')
                : path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            enableRemoteModule: false
        }
    })

    // 加载应用
    if (isDev()) {
        mainWindow.loadURL('http://localhost:5173')

        // mainWindow.setBounds({ width: 1200, height: 400, resizable: true });
        mainWindow.setBounds({ resizable: true })
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
    }

    // 允许窗口被拖动
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('window-controls', {
            isMaximized: mainWindow.isMaximized()
        })
    })
    // 点击穿透
    // mainWindow.setIgnoreMouseEvents(true);

    mainWindow.on('closed', () => {
        try {
            const session = mainWindow.webContents.session
            // 清除session的HTTP缓存
            session.defaultSession.clearCache()
        } catch (error) {
            console.error('Failed to clear cache:', error)
        }
        mainWindow = null
    })
}

// 创建错误提示窗口
function createErrorWindow({ message, duration }) {
    if (errorWindow && !errorWindow.isDestroyed()) {
        errorWindow.focus()
        errorWindow.webContents.send('show-error-message', { message, duration })
        return
    }
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    errorWindow = new BrowserWindow({
        width: Math.floor(screenWidth * 0.8), // 宽度为屏幕的80%
        height: 60,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        movable: true,
        // show: false,
        x: Math.floor((screenWidth - screenWidth * 0.8) / 2), // 屏幕水平居中
        y: 40, // 屏幕顶部40px位置
        webPreferences: {
            preload: isDev()
                ? path.join(__dirname, '../../dist/preload/index.js')
                : path.join(__dirname, '../preload/index.js'),
            // nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: false
        }
    })

    // 加载摄像头页面
    if (isDev()) {
        errorWindow.loadURL('http://localhost:5173/#/error')
        // mainWindow.setBounds({ resizable: true });
        // errorWindow.webContents.openDevTools();
    } else {
        errorWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'), {
            hash: '/error'
        })
    }

    // 监听窗口内容加载完成事件，确保DOM加载后再发送消息
    errorWindow.webContents.on('did-finish-load', () => {
        console.log('Error window loaded, sending show-error-message', message, duration)
        // 发送错误信息到错误窗口
        errorWindow.webContents.send('show-error-message', { message, duration })
    })

    errorWindow.on('closed', () => {
        errorWindow = null
    })
}

// 创建摄像头窗口
function createCameraWindow() {
    // 检查是否已经存在摄像头窗口
    if (cameraWindow && !cameraWindow.isDestroyed()) {
        console.log('Camera window already exists, focusing and showing it.')
        cameraWindow.focus()
        // 通知摄像头窗口启动摄像头流
        cameraWindow.webContents.send('toggle-camera', true)
        return
    }

    const CAMERA_SIZE = 200
    const { workAreaSize } = screen.getPrimaryDisplay()

    cameraWindow = new BrowserWindow({
        width: CAMERA_SIZE,
        height: CAMERA_SIZE,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        movable: true, // 用于决定窗口是否可被用户移动
        // show: false,
        webPreferences: {
            preload: isDev()
                ? path.join(__dirname, '../../dist/preload/index.js')
                : path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            enableRemoteModule: false
        }
    })

    // 设置窗口位置（右下角）
    cameraWindow.setPosition(
        workAreaSize.width - CAMERA_SIZE - 20,
        workAreaSize.height - CAMERA_SIZE - 20
    )

    // 加载摄像头页面
    if (isDev()) {
        cameraWindow.loadURL('http://localhost:5173/#/camera-overlay')
        // mainWindow.setBounds({ resizable: true });
        cameraWindow.webContents.openDevTools()
    } else {
        cameraWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'), {
            hash: '/camera-overlay'
        })
    }

    // 监听窗口内容加载完成事件，确保DOM加载后再发送消息
    cameraWindow.webContents.once('did-finish-load', () => {
        console.log('Camera window loaded, sending toggle-camera')
        // cameraWindow.show()
        cameraWindow.webContents.send('toggle-camera', true)
    })

    cameraWindow.on('closed', () => {
        cameraWindow = null
    })
}

// 创建设置窗口
function createSettingsWindow(selectedFormat) {
    // 检查是否已经存在设置窗口
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus()
        return
    }

    settingsWindow = new BrowserWindow({
        width: 300,
        height: 200,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        webPreferences: {
            preload: isDev()
                ? path.join(__dirname, '../../dist/preload/index.js')
                : path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            enableRemoteModule: false
        }
    })

    // 加载设置页面
    if (isDev()) {
        settingsWindow.loadURL('http://localhost:5173/#/settings')
    } else {
        settingsWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'), {
            hash: '/settings'
        })
    }

    // 向设置窗口发送当前选中的格式
    settingsWindow.once('ready-to-show', () => {
        settingsWindow.webContents.send('set-selected-format', selectedFormat)
    })

    settingsWindow.on('closed', () => {
        settingsWindow = null
    })
}

// 创建屏幕选择窗口
function createScreenSelectorWindow() {
    // 检查是否已经存在屏幕选择窗口
    if (screenSelectorWindow && !screenSelectorWindow.isDestroyed()) {
        screenSelectorWindow.focus()
        return
    }

    const { workAreaSize } = screen.getPrimaryDisplay()

    screenSelectorWindow = new BrowserWindow({
        width: workAreaSize.width,
        height: workAreaSize.height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        fullscreen: true,
        webPreferences: {
            preload: isDev()
                ? path.join(__dirname, '../../dist/preload/index.js')
                : path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    screenSelectorWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL + '/#/screen-selector')

    // 如果是生产环境
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        screenSelectorWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
            hash: '/screen-selector'
        })
    }

    screenSelectorWindow.on('closed', () => {
        screenSelectorWindow = null
    })
}

// IPC 事件处理
ipcMain.handle('toggle-recording', async () => {
    // 请求屏幕录制权限
    if (process.platform === 'darwin') {
        const hasPermission = systemPreferences.getMediaAccessStatus('screen') === 'granted'
        if (!hasPermission) {
            systemPreferences.askForMediaAccess('screen')
            // 权限请求后需要重新检查
            setTimeout(() => {
                return systemPreferences.getMediaAccessStatus('screen') === 'granted'
            }, 1000)
        }
        return hasPermission
    }
    return true
})

// 检查并请求系统权限
ipcMain.handle('ask-permissions', async (event, type) => {
    console.log('ask-permissions', type)
    if (!type) return false
    if (process.platform === 'darwin') {
        // camera  microphone
        const hasPermission = systemPreferences.getMediaAccessStatus(type) === 'granted'

        console.log('ask-permissions hasPermission', hasPermission)
        if (!hasPermission) {
            const isAuthorized = await systemPreferences.askForMediaAccess(type)
            // 权限请求后需要重新检查
            if (isAuthorized) {
                console.log(type + '权限已授权')
            } else {
                console.log(`用户拒绝了${type}权限`)
            }
            return isAuthorized
        }
        return hasPermission
    }
    return true
})

ipcMain.handle('get-sources', async () => {
    // 获取屏幕和窗口源
    const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: {
            width: 1920,
            height: 1080
        }
    })
    return sources
})

// 显示错误提示
ipcMain.on('show-error', (event, { message, duration }) => {
    console.log('Creating error window22', errorWindow)

    createErrorWindow({ message, duration })

    // 延迟关闭窗口
    // setTimeout(() => {
    //     if (errorWindow && !errorWindow.isDestroyed()) {
    //         errorWindow.hide();
    //     }
    // }, duration || 3000);
})

ipcMain.on('close-error-window', (event) => {
    console.log('Closing error window')
    if (errorWindow && !errorWindow.isDestroyed()) {
        errorWindow.close()
    }
})

// 切换摄像头窗口
ipcMain.on('toggle-camera-window', (event, isEnabled) => {
    if (isEnabled) {
        createCameraWindow()
        console.log('first showCamera')
    } else {
        if (cameraWindow && !cameraWindow.isDestroyed()) {
            cameraWindow.close()
        }
    }
})

// 显示屏幕选择器
ipcMain.on('show-screen-selector', (event) => {
    createScreenSelectorWindow()
})

// 屏幕选择完成
ipcMain.on('screen-selected', (event, selectedSource) => {
    if (screenSelectorWindow && !screenSelectorWindow.isDestroyed()) {
        screenSelectorWindow.close()
    }

    // 向主窗口发送选中的源
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('screen-selected', selectedSource)
    }
})

// 显示设置窗口
ipcMain.on('show-settings-window', (event, selectedFormat) => {
    createSettingsWindow(selectedFormat)
})

// 关闭设置窗口
ipcMain.on('settings-window-close', (event) => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.close()
    }
})

// 格式选择完成
ipcMain.on('format-selected', (event, selectedFormat) => {
    // 向主窗口发送选中的格式
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('format-selected', selectedFormat)
    }
})

// 摄像头准备就绪
ipcMain.on('camera-ready', (event) => {
    console.log('Camera is ready')
})

// 摄像头停止
ipcMain.on('camera-stopped', (event) => {
    console.log('Camera has stopped')
})

// 摄像头错误
ipcMain.on('camera-error', (event, error) => {
    console.error('Camera error:', error)
    showErrorNotification(error)
})

// 切换摄像头
function toggleCamera(isEnabled) {
    if (cameraWindow && !cameraWindow.isDestroyed()) {
        cameraWindow.webContents.send('toggle-camera', isEnabled)
    }
}

// 关闭摄像头窗口
ipcMain.on('close-overlay', (event) => {
    if (cameraWindow && !cameraWindow.isDestroyed()) {
        cameraWindow.close()
    }
})

// 显示错误提示
function showErrorNotification(message) {
    ipcMain.emit('show-error', null, { message, duration: 3000 })
}

// 应用生命周期事件
app.whenReady().then(() => {
    createMainWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    // 清理资源
    if (cameraWindow && !cameraWindow.isDestroyed()) {
        cameraWindow.close()
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.close()
    }
    if (screenSelectorWindow && !screenSelectorWindow.isDestroyed()) {
        screenSelectorWindow.close()
    }
    if (errorWindow && !errorWindow.isDestroyed()) {
        errorWindow.close()
    }
})
