import { app } from 'electron'
import path from 'path'
import url from 'url'

// 确定应用是处于开发模式还是生产模式
const isDev = () => {
    return process.env.NODE_ENV === 'development'
}

// 加载主进程代码
if (isDev()) {
    // 开发模式下，electron-vite 会自动处理
    import('./src/main/index.js')
} else {
    // 生产模式下，加载构建后的代码
    import('./dist/main/index.js')
}
