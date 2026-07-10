const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  setMinimizeToTray: (val) => ipcRenderer.send('set-minimize-to-tray', val),
  updateTray: (status) => ipcRenderer.send('update-tray', status),
  setAutostart: (val) => ipcRenderer.invoke('set-autostart', val),
  getAutostart: () => ipcRenderer.invoke('get-autostart'),
  onTrayAction: (callback) => {
    const listener = (event, action, data) => callback(action, data);
    ipcRenderer.on('tray-action', listener);
    return () => ipcRenderer.removeListener('tray-action', listener);
  },
  syncTrayData: (data) => ipcRenderer.send('sync-tray-data', data),
  testArcaConnection: (settings) => ipcRenderer.invoke('arca-test-connection', settings),
  generateArcaCSR: (data) => ipcRenderer.invoke('arca-generate-csr', data),
  generateArcaInvoice: (data) => ipcRenderer.invoke('arca-generate-invoice', data),
  generateArcaCreditNote: (data) => ipcRenderer.invoke('arca-generate-credit-note', data),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  shareFile: (data) => ipcRenderer.invoke('share-file', data),
  getArcaInvoiceInfo: (data) => ipcRenderer.invoke('get-arca-invoice-info', data),
  getPublicIp: () => ipcRenderer.invoke('get-public-ip'),
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  regenerateArcaPDF: (data) => ipcRenderer.invoke('arca-regenerate-pdf', data),
  writePdfFile: (data) => ipcRenderer.invoke('write-pdf-file', data),
  sendInvoiceEmail: (data) => ipcRenderer.invoke('send-invoice-email', data),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
    return () => ipcRenderer.removeListener('update-available', callback);
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', callback);
    return () => ipcRenderer.removeListener('update-downloaded', callback);
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', callback);
    return () => ipcRenderer.removeListener('update-not-available', callback);
  },
  onCheckingForUpdate: (callback) => {
    ipcRenderer.on('checking-for-update', callback);
    return () => ipcRenderer.removeListener('checking-for-update', callback);
  },
  onUpdateError: (callback) => {
    const listener = (event, err) => callback(err);
    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  },
  syncMonitoringData: (data) => ipcRenderer.send('sync-monitoring-data', data),
  closeToast: () => ipcRenderer.send('close-toast'),
  onStartSessionFromToast: (callback) => {
    const listener = (event, client) => callback(client);
    ipcRenderer.on('start-session-from-toast', listener);
    return () => ipcRenderer.removeListener('start-session-from-toast', listener);
  },
  toastActionStart: (client) => ipcRenderer.send('toast-action-start', client),
  openWidget: (mode) => ipcRenderer.send('open-widget', mode),
  closeWidget: () => ipcRenderer.send('close-widget'),
  requestSync: () => ipcRenderer.send('request-sync'),
  openBackupsFolder: () => ipcRenderer.invoke('open-backups-folder'),
  deepScanData: () => ipcRenderer.invoke('deep-scan-data'),
  importDataFromPath: (path) => ipcRenderer.invoke('import-data-from-path', path),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  onMonitoringDataUpdate: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('monitoring-data-update', listener);
    return () => ipcRenderer.removeListener('monitoring-data-update', listener);
  },
  onRequestSyncFromMain: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('request-sync-from-main', listener);
    return () => ipcRenderer.removeListener('request-sync-from-main', listener);
  }
});
