const { ipcMain } = require('electron')

// IPC 事件处理 - 窗口相关
// 导出一个函数，接收窗口变量和窗口创建函数作为参数
module.exports = (windowVars, windowFunctions) => {

// 显示错误提示
ipcMain.on('show-error', (event, { message, duration }) => {
    console.log('Creating error window22', windowVars.errorWindow)

    // 调用主进程的窗口创建函数
    windowFunctions.createErrorWindow({ message, duration })

    // 延迟关闭窗口
    // setTimeout(() => {
    //     if (windowVars.errorWindow && !windowVars.errorWindow.isDestroyed()) {
    //         windowVars.errorWindow.hide();
    //     }
    // }, duration || 3000);
})

// 关闭错误窗口
ipcMain.on('close-error-window', (event) => {
    console.log('Closing error window')
    if (windowVars.errorWindow && !windowVars.errorWindow.isDestroyed()) {
        windowVars.errorWindow.close()
    }
})

// 切换摄像头窗口
ipcMain.on('toggle-camera-window', (event, isEnabled) => {
    if (isEnabled) {
        // 调用主进程的窗口创建函数
        windowFunctions.createCameraWindow()
        console.log('first showCamera')
    } else {
        if (windowVars.cameraWindow && !windowVars.cameraWindow.isDestroyed()) {
            windowVars.cameraWindow.close()
        }
    }
})

// 显示屏幕选择器
ipcMain.on('show-screen-selector', (event) => {
    // 调用主进程的窗口创建函数
    windowFunctions.createScreenSelectorWindow()
})

// 屏幕选择完成
ipcMain.on('screen-selected', (event, selectedSource) => {
    if (windowVars.screenSelectorWindow && !windowVars.screenSelectorWindow.isDestroyed()) {
        windowVars.screenSelectorWindow.close()
    }

    // 向主窗口发送选中的源
    if (windowVars.mainWindow && !windowVars.mainWindow.isDestroyed()) {
        windowVars.mainWindow.webContents.send('screen-selected', selectedSource)
    }
})

// 关闭摄像头窗口
ipcMain.on('close-overlay', (event) => {
    if (windowVars.cameraWindow && !windowVars.cameraWindow.isDestroyed()) {
        windowVars.cameraWindow.close()
    }
})
}
