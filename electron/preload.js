const { contextBridge, ipcRenderer } = require('electron');

const api = {
  getState: () => ipcRenderer.invoke('activity:get-state'),
  toggleTracking: (enable) => ipcRenderer.invoke('activity:toggle', enable),
  updateConsent: (granted) => ipcRenderer.invoke('consent:update', granted),
  requestAccessibility: () => ipcRenderer.invoke('permissions:request-accessibility'),
  openAccessibilitySettings: () => ipcRenderer.invoke('help:open-accessibility-settings'),
  showWindow: () => ipcRenderer.invoke('app:show-window'),
  onStateUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('activity:update', listener);
    return () => ipcRenderer.removeListener('activity:update', listener);
  }
};

contextBridge.exposeInMainWorld('activityBridge', api);
contextBridge.exposeInMainWorld('permissionBridge', {
  ...api
});
