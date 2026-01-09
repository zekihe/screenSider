const { ipcMain } = require('electron')

// IPC 事件处理 - 设置相关
// 导出一个函数，接收窗口变量和窗口创建函数作为参数
module.exports = (windowVars, windowFunctions) => {

// 显示设置窗口
ipcMain.on('show-settings-window', (event, selectedFormat) => {
    // 调用主进程的窗口创建函数
    windowFunctions.createSettingsWindow(selectedFormat)
})

// 关闭设置窗口
ipcMain.on('settings-window-close', (event) => {
    if (windowVars.settingsWindow && !windowVars.settingsWindow.isDestroyed()) {
        windowVars.settingsWindow.close()
    }
})

// 格式选择完成
ipcMain.on('format-selected', (event, selectedFormat) => {
    // 向主窗口发送选中的格式
    if (windowVars.mainWindow && !windowVars.mainWindow.isDestroyed()) {
        windowVars.mainWindow.webContents.send('format-selected', selectedFormat)
    }
})
}
