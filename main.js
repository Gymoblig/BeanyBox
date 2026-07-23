const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const googleAuth = require('./google-auth');
const { GmailClient } = require('./gmail');
const ai = require('./ai');

const MIME_TYPES = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain',
  '.csv': 'text/csv', '.json': 'application/json', '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.heic': 'image/heic',
};
function guessMime(filename) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

let mainWindow = null;
let mailClient = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    frame: false,
    backgroundColor: '#0b0b0c',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', 'maximized'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', 'normal'));

  // Email bodies render as real HTML in a sandboxed iframe. Any link click
  // in there (or anywhere else) should open in the system browser, never
  // navigate this window — both for normal links and for anything a
  // malicious email might try to pull off.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(async () => {
  const restored = await googleAuth.restoreSession().catch(() => null);
  if (restored) mailClient = new GmailClient(restored);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- window controls ---
ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow && mainWindow.close());

// --- auth ---
ipcMain.handle('auth:status', async () => {
  if (mailClient) {
    try {
      const profile = await mailClient.getProfile();
      return { signedIn: true, email: profile.emailAddress };
    } catch (e) {
      mailClient = null;
    }
  }
  return { signedIn: false };
});

ipcMain.handle('auth:login', async () => {
  try {
    const client = await googleAuth.login();
    mailClient = new GmailClient(client);
    const profile = await mailClient.getProfile();
    return { ok: true, email: profile.emailAddress };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  googleAuth.logout();
  mailClient = null;
  return { ok: true };
});

// --- Google OAuth client config (bring-your-own client_id/client_secret,
// entered on the login screen or in Settings so the built app never bundles
// real credentials) ---
ipcMain.handle('google:getConfig', () => googleAuth.publicConfig());
ipcMain.handle('google:saveConfig', (e, cfg) => { googleAuth.saveConfig(cfg); return { ok: true }; });
ipcMain.handle('google:clearConfig', () => { googleAuth.clearConfig(); return { ok: true }; });

// --- mail ---
function requireClient() {
  if (!mailClient) throw new Error('Not signed in');
  return mailClient;
}

ipcMain.handle('gmail:listLabels', async () => requireClient().listLabels());
ipcMain.handle('gmail:listMessages', async (e, { labelId, maxResults, pageToken }) =>
  requireClient().listMessages(labelId, maxResults, pageToken));
ipcMain.handle('gmail:searchMessages', async (e, { query, maxResults, pageToken }) =>
  requireClient().searchMessages(query, maxResults, pageToken));
ipcMain.handle('gmail:getMessage', async (e, id) => requireClient().getMessage(id));
ipcMain.handle('gmail:markRead', async (e, id) => requireClient().markRead(id));
ipcMain.handle('gmail:archive', async (e, id) => requireClient().archive(id));
ipcMain.handle('gmail:trash', async (e, id) => requireClient().trash(id));
ipcMain.handle('gmail:untrash', async (e, id) => requireClient().untrash(id));
ipcMain.handle('gmail:emptyTrash', async () => requireClient().emptyTrash());
ipcMain.handle('gmail:listAllLabels', async () => requireClient().listAllLabelsRaw());
ipcMain.handle('gmail:createLabel', async (e, name) => requireClient().createLabel(name));
ipcMain.handle('gmail:modifyLabels', async (e, { id, add, remove }) => requireClient().modifyLabels(id, add, remove));
ipcMain.handle('gmail:markAllRead', async (e, labelId) => requireClient().markAllRead(labelId));

ipcMain.handle('gmail:send', async (e, payload) => {
  let attachments;
  if (payload.attachments && payload.attachments.length) {
    attachments = payload.attachments.map((a) => ({
      filename: a.name,
      mimeType: guessMime(a.name),
      data: fs.readFileSync(a.path).toString('base64'),
    }));
  }
  return requireClient().send({ ...payload, attachments });
});

// --- files ---
ipcMain.handle('dialog:pickFiles', async () => {
  if (!mainWindow) return [];
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'] });
  if (res.canceled) return [];
  return res.filePaths.map((p) => ({ path: p, name: path.basename(p), size: fs.statSync(p).size }));
});

ipcMain.handle('gmail:downloadAttachment', async (e, { messageId, attachmentId, inlineData, filename }) => {
  if (!mainWindow) return { ok: false };
  const res = await dialog.showSaveDialog(mainWindow, { defaultPath: filename });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  const data = attachmentId
    ? await requireClient().getAttachmentData(messageId, attachmentId)
    : inlineData;
  const buf = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  fs.writeFileSync(res.filePath, buf);
  return { ok: true, path: res.filePath };
});

// --- AI draft assist ---
ipcMain.handle('ai:status', () => ai.status());
ipcMain.handle('ai:getConfig', () => ai.publicConfig());
ipcMain.handle('ai:saveConfig', (e, cfg) => { ai.saveConfig(cfg); return { ok: true }; });
ipcMain.handle('ai:clearConfig', () => { ai.clearConfig(); return { ok: true }; });
ipcMain.handle('ai:draft', async (e, { subject, context }) => {
  try {
    const text = await ai.draftFromSubject({ subject, context });
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
