const { contextBridge, ipcRenderer } = require('electron');

/**
 * Secure Preload Context Bridge for Sara AI Admin
 * Exposes guarded API methods to the renderer window.
 */
contextBridge.exposeInMainWorld('adminApi', {
  // Window Management
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onWindowStateChange: (callback) => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on('window:stateChange', handler);
      return () => ipcRenderer.removeListener('window:stateChange', handler);
    },
  },

  // AI Models Management (Firebase Realtime Database & Storage)
  models: {
    list: () => ipcRenderer.invoke('models:list'),
    add: (modelData) => ipcRenderer.invoke('models:add', modelData),
    update: (modelData) => ipcRenderer.invoke('models:update', modelData),
    delete: (modelId, deleteFile = false) => ipcRenderer.invoke('models:delete', { modelId, deleteFile }),
    seedFirebase: () => ipcRenderer.invoke('models:seedFirebase'),
    download: (modelId) => ipcRenderer.invoke('models:download', modelId),
    cancelDownload: (modelId) => ipcRenderer.invoke('models:cancelDownload', modelId),
    verifySha256: (modelId) => ipcRenderer.invoke('models:verifySha256', modelId),
    fetchHeaders: (url) => ipcRenderer.invoke('models:fetchHeaders', url),
    importLocalFile: () => ipcRenderer.invoke('models:importLocalFile'),
    selectLocalModel: () => ipcRenderer.invoke('models:selectLocalModel'),
    onDownloadProgress: (callback) => {
      const handler = (_event, progressData) => callback(progressData);
      ipcRenderer.on('models:downloadProgress', handler);
      return () => ipcRenderer.removeListener('models:downloadProgress', handler);
    },
  },

  // Backblaze B2 Cloud Storage API
  b2: {
    getConfig: () => ipcRenderer.invoke('b2:getConfig'),
    saveConfig: (config) => ipcRenderer.invoke('b2:saveConfig', config),
    testConnection: (customConfig) => ipcRenderer.invoke('b2:testConnection', customConfig),
    uploadModel: (params) => ipcRenderer.invoke('b2:uploadModel', params),
    cancelUpload: (uploadId) => ipcRenderer.invoke('b2:cancelUpload', uploadId),
    onUploadProgress: (callback) => {
      const handler = (_event, progressData) => callback(progressData);
      ipcRenderer.on('b2:uploadProgress', handler);
      return () => ipcRenderer.removeListener('b2:uploadProgress', handler);
    },
  },

  // Firebase Realtime Database
  firebase: {
    checkStatus: () => ipcRenderer.invoke('firebase:checkStatus'),
    seedModels: () => ipcRenderer.invoke('models:seedFirebase'),
  },

  // Voice Packs Management
  voicePacks: {
    list: () => ipcRenderer.invoke('voicepacks:list'),
    add: (packData) => ipcRenderer.invoke('voicepacks:add', packData),
    delete: (packId, deleteFile = false) => ipcRenderer.invoke('voicepacks:delete', { packId, deleteFile }),
    seedFirebase: () => ipcRenderer.invoke('voicepacks:seedFirebase'),
    selectLocalPack: () => ipcRenderer.invoke('voicepacks:selectLocalPack'),
  },

  // Server & Cloud Explorer
  server: {
    checkHealth: () => ipcRenderer.invoke('server:checkHealth'),
    testEndpoint: (endpoint, method = 'GET') => ipcRenderer.invoke('server:testEndpoint', { endpoint, method }),
    getNetworkIps: () => ipcRenderer.invoke('server:getNetworkIps'),
    readConfig: () => ipcRenderer.invoke('server:readConfig'),
    saveConfig: (config) => ipcRenderer.invoke('server:saveConfig', config),
    runAdbReverse: (port) => ipcRenderer.invoke('server:runAdbReverse', port),
  },

  // System & Utilities
  system: {
    getStats: () => ipcRenderer.invoke('system:getStats'),
    openFolder: (target) => ipcRenderer.invoke('system:openFolder', target),
    copyToClipboard: (text) => ipcRenderer.invoke('system:copyToClipboard', text),
    exportCatalog: () => ipcRenderer.invoke('system:exportCatalog'),
    importCatalog: () => ipcRenderer.invoke('system:importCatalog'),
  },

  // Firebase Admin SDK & User Management (Server-Side Authentication Claims)
  adminUsers: {
    getStatus: () => ipcRenderer.invoke('adminUsers:getStatus'),
    selectServiceAccountFile: () => ipcRenderer.invoke('adminUsers:selectServiceAccountFile'),
    setServiceAccountPath: (filePath) => ipcRenderer.invoke('adminUsers:setServiceAccountPath', filePath),
    unloadServiceAccount: () => ipcRenderer.invoke('adminUsers:unloadServiceAccount'),
    getUser: (uid) => ipcRenderer.invoke('adminUsers:getUser', uid),
    promoteToAdmin: (uid) => ipcRenderer.invoke('adminUsers:promoteToAdmin', uid),
    revokeAdmin: (uid) => ipcRenderer.invoke('adminUsers:revokeAdmin', uid),
    fetchAdminUsers: () => ipcRenderer.invoke('adminUsers:fetchAdminUsers'),
    getAuditLog: () => ipcRenderer.invoke('adminUsers:getAuditLog'),
    clearAuditLog: () => ipcRenderer.invoke('adminUsers:clearAuditLog'),
  },

  // Admin User Authentication (Email & Password)
  auth: {
    login: (email, password) => ipcRenderer.invoke('auth:login', { email, password }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  },
});
