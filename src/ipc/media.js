const { ipcMain, desktopCapturer } = require('electron')

// IPC 事件处理 - 媒体相关
// 导出一个函数，接收窗口变量和窗口创建函数作为参数
module.exports = (windowVars, windowFunctions) => {
    // 获取屏幕和窗口源
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

    // 显示错误提示
    function showErrorNotification(message) {
        windowFunctions.createErrorWindow({ message, duration: 3000 })
    }
}
