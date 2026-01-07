import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    // Recording APIs
    toggleRecording: () => ipcRenderer.invoke('toggle-recording'),
    sysPermission: (type) => ipcRenderer.invoke('ask-permissions', type),
    getSources: () => ipcRenderer.invoke('get-sources'),
    onStatusChange: (callback) =>
        ipcRenderer.on('status-change', (event, status) => callback(status)),

    // Camera Window APIs
    toggleCameraWindow: (isEnabled) => ipcRenderer.send('toggle-camera-window', isEnabled),
    onToggleCamera: (callback) =>
        ipcRenderer.on('toggle-camera', (event, isEnabled) => callback(isEnabled)),
    onCloseOverlay: (callback) => ipcRenderer.on('close-overlay', () => callback()),
    cameraReady: () => ipcRenderer.send('camera-ready'),
    cameraStopped: () => ipcRenderer.send('camera-stopped'),
    cameraError: (error) => ipcRenderer.send('camera-error', error),

    // Screen Selector APIs
    showScreenSelector: () => ipcRenderer.send('show-screen-selector'),
    onScreenSelected: (callback) =>
        ipcRenderer.on('screen-selected', (event, source) => callback(source)),

    // Settings Window APIs
    showSettingsWindow: (format) => ipcRenderer.send('show-settings-window', format),
    closeSettingsWindow: () => ipcRenderer.send('settings-window-close'),
    onSetSelectedFormat: (callback) =>
        ipcRenderer.on('set-selected-format', (event, format) => callback(format)),
    setFormat: (format) => ipcRenderer.send('format-selected', format),

    // Error Window APIs
    showError: (data) => ipcRenderer.send('show-error', data),
    onShowError: (callback) =>
        ipcRenderer.on('show-error-message', (event, data) => callback(event, data)),
    closeErrorWindow: () => ipcRenderer.send('close-error-window'),

    // Screen Selector Window APIs
    requestSources: () => ipcRenderer.send('request-sources'),
    onScreenSources: (callback) =>
        ipcRenderer.on('screen-sources', (event, sources) => callback(event, sources)),
    confirmScreenSelect: (source) => ipcRenderer.send('screen-select-confirm', source),
    cancelScreenSelect: () => ipcRenderer.send('screen-select-cancel')
})
