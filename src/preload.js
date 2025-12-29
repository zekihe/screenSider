const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    checkPermissions: () => ipcRenderer.invoke('check-permissions'),
    requestPermission: (permissionType) => ipcRenderer.invoke('request-permission', permissionType)
});