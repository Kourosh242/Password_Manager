'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveTextFile: (payload) => ipcRenderer.invoke('save-text-file', payload),
  getAppInfo: () => ipcRenderer.invoke('app-info'),
  onAppHidden: (callback) => {
    const listener = () => {
      try { callback(); } catch { /* ignore */ }
    };
    ipcRenderer.on('app-hidden', listener);
    return () => ipcRenderer.removeListener('app-hidden', listener);
  }
});
