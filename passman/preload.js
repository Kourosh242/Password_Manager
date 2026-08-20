'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveTextFile: (payload) => ipcRenderer.invoke('save-text-file', payload),
  getAppInfo: () => ipcRenderer.invoke('app-info'),
  onAppHidden: (callback) => {
    ipcRenderer.on('app-hidden', () => {
      try { callback(); } catch { /* ignore */ }
    });
  }
});
