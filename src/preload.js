const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    checkPermissions: () => ipcRenderer.invoke('check-permissions'),
    requestPermission: (permissionType) => ipcRenderer.invoke('request-permission', permissionType),

    // 窗口控制
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowHide: () => ipcRenderer.invoke('window-hide'),
    windowShow: () => ipcRenderer.invoke('window-show'),
    windowIsVisible: () => ipcRenderer.invoke('window-is-visible'),
    windowSetAlwaysOnTop: (flag) => ipcRenderer.invoke('window-set-always-on-top', flag),
    windowSetIgnoreMouseEvents: (ignore, options) => 
        ipcRenderer.invoke('window-set-ignore-mouse-events', ignore, options),
    
    // 系统托盘相关
    createTray: () => ipcRenderer.invoke('create-tray'),
    destroyTray: () => ipcRenderer.invoke('destroy-tray'),
    setTrayTooltip: (tooltip) => ipcRenderer.invoke('set-tray-tooltip', tooltip),

    // 全局快捷键事件
    onGlobalShortcutToggleRecording: (callback) => 
        ipcRenderer.on('global-shortcut-toggle-recording', () => callback()),
    onGlobalShortcutAction: (callback) => 
        ipcRenderer.on('global-shortcut-action', (event, action) => callback(action)),
    
    // 全局快捷键控制
    registerGlobalShortcut: (shortcut, action) => 
        ipcRenderer.invoke('register-global-shortcut', shortcut, action),
    unregisterGlobalShortcut: (shortcut) => 
        ipcRenderer.invoke('unregister-global-shortcut', shortcut),
});