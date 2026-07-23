const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onWindowState: (cb) => ipcRenderer.on('window:state', (e, state) => cb(state)),

  authStatus: () => ipcRenderer.invoke('auth:status'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  googleGetConfig: () => ipcRenderer.invoke('google:getConfig'),
  googleSaveConfig: (cfg) => ipcRenderer.invoke('google:saveConfig', cfg),
  googleClearConfig: () => ipcRenderer.invoke('google:clearConfig'),

  listLabels: () => ipcRenderer.invoke('gmail:listLabels'),
  listMessages: (labelId, maxResults, pageToken) =>
    ipcRenderer.invoke('gmail:listMessages', { labelId, maxResults, pageToken }),
  searchMessages: (query, maxResults, pageToken) =>
    ipcRenderer.invoke('gmail:searchMessages', { query, maxResults, pageToken }),
  getMessage: (id) => ipcRenderer.invoke('gmail:getMessage', id),
  markRead: (id) => ipcRenderer.invoke('gmail:markRead', id),
  archive: (id) => ipcRenderer.invoke('gmail:archive', id),
  trash: (id) => ipcRenderer.invoke('gmail:trash', id),
  untrash: (id) => ipcRenderer.invoke('gmail:untrash', id),
  emptyTrash: () => ipcRenderer.invoke('gmail:emptyTrash'),
  send: (payload) => ipcRenderer.invoke('gmail:send', payload),

  pickAttachments: () => ipcRenderer.invoke('dialog:pickFiles'),
  downloadAttachment: (messageId, attachmentId, inlineData, filename) =>
    ipcRenderer.invoke('gmail:downloadAttachment', { messageId, attachmentId, inlineData, filename }),

  listAllLabels: () => ipcRenderer.invoke('gmail:listAllLabels'),
  createLabel: (name) => ipcRenderer.invoke('gmail:createLabel', name),
  modifyLabels: (id, add, remove) => ipcRenderer.invoke('gmail:modifyLabels', { id, add, remove }),
  markAllRead: (labelId) => ipcRenderer.invoke('gmail:markAllRead', labelId),

  aiStatus: () => ipcRenderer.invoke('ai:status'),
  aiGetConfig: () => ipcRenderer.invoke('ai:getConfig'),
  aiSaveConfig: (cfg) => ipcRenderer.invoke('ai:saveConfig', cfg),
  aiClearConfig: () => ipcRenderer.invoke('ai:clearConfig'),
  aiDraft: (payload) => ipcRenderer.invoke('ai:draft', payload),
});
