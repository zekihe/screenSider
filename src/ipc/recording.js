const { ipcMain, systemPreferences } = require('electron')

// IPC 事件处理 - 录制相关
// 导出一个函数，用于初始化录制相关的 IPC 处理程序
module.exports = () => {
    // 切换录制状态
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
}
