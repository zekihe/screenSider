// IPC 事件处理入口文件

// 导出所有 IPC 处理程序
module.exports = {
    initIPC: (windowVars, windowFunctions) => {
        // 初始化所有 IPC 处理程序，并传递窗口变量和窗口创建函数
        require('./recording')()
        require('./window')(windowVars, windowFunctions)
        require('./media')(windowVars, windowFunctions)
        require('./settings')(windowVars, windowFunctions)
    }
}
