const { app, BrowserWindow, ipcMain, desktopCapturer, session, clipboard, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const page = pathToFileURL(path.join(__dirname, 'renderer/index.html')).href;
let win, pendingCapture, invitation;
const roomPattern = /^glup-[a-z0-9]{6,32}$/;
const PIX = '00020126360014br.gov.bcb.pix0114+55169940941255204000053039865802BR5910F3D_STUDIO6009Sao Paulo610901227-20062240520daqr11985267866003686304367B';
function readInvite(value) {
  const match = /^glupstreamxd:\/\/(glup-[a-z0-9]{6,32})\/?$/i.exec(value || '');
  return match ? match[1].toLowerCase() : null;
}
function receiveInvite(argv) {
  const id = argv.map(readInvite).find(Boolean);
  if (!id) return;
  invitation = id;
  if (win && !win.webContents.isLoading()) win.webContents.send('invite', id);
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
}
function trusted(event) {
  return win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === page;
}
function finishCapture(id) {
  if (!pendingCapture) return;
  const { callback, sources, audio, timer } = pendingCapture;
  pendingCapture = null;
  clearTimeout(timer);
  const source = sources.find(s => s.id === id);
  // O usuário escolhe a fonte; nunca capturamos uma tela automaticamente.
  try { callback(source ? { video: source, ...(audio ? { audio: 'loopback' } : {}) } : {}); } catch { /* Janela encerrada. */ }
}
// Em desenvolvimento permitimos duas instâncias para testar host e convidado.
if (app.isPackaged && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_, argv) => receiveInvite(argv));
  app.on('open-url', (event, url) => { event.preventDefault(); receiveInvite([url]); });
  app.whenReady().then(() => {
    if (app.isPackaged) app.setAsDefaultProtocolClient('glupstreamxd');
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
      // Electron também solicita "media" sem câmera/microfone para display capture.
      const display = permission === 'media' && details.isMainFrame && Array.isArray(details.mediaTypes) && details.mediaTypes.length === 0;
      callback(wc === win?.webContents && wc.getURL() === page && (display || ['display-capture', 'fullscreen'].includes(permission)));
    });
    session.defaultSession.setPermissionCheckHandler((wc, permission) => wc === win?.webContents && wc.getURL() === page && ['display-capture', 'fullscreen'].includes(permission));
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      if (request.frame !== win?.webContents.mainFrame || request.frame?.url !== page || pendingCapture) return callback({});
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 280, height: 158 } });
        pendingCapture = { callback, sources, audio: request.audioRequested, timer: setTimeout(() => { finishCapture(); win?.webContents.send('capture-expired'); }, 60000) };
        win.webContents.send('capture-sources', sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() })));
      } catch { callback({}); }
    });
    ipcMain.handle('copy', (event, value) => {
      if (!trusted(event) || typeof value !== 'string' || !(roomPattern.test(value) || readInvite(value) || value === PIX)) throw new Error('Conteúdo inválido.');
      clipboard.writeText(value);
    });
    ipcMain.handle('open-livepix', event => { if (!trusted(event)) throw new Error('Origem inválida.'); return shell.openExternal('https://livepix.gg/xdflaviooo'); });
    ipcMain.handle('save-apk', async event => {
      if (!trusted(event)) throw new Error('Origem inválida.');
      const source = app.isPackaged ? path.join(process.resourcesPath, 'GlupStreamXD-Android.apk') : path.join(__dirname, 'android', 'GlupStreamXD-Android-2.0.1.apk');
      const result = await dialog.showSaveDialog(win, { title: 'Salvar APK para instalar no celular', defaultPath: path.join(app.getPath('downloads'), 'GlupStreamXD-Android-2.0.1.apk'), filters: [{ name: 'Aplicativo Android', extensions: ['apk'] }] });
      if (result.canceled || !result.filePath) return null;
      await fs.copyFile(source, result.filePath); return true;
    });
    ipcMain.handle('initial-invite', event => trusted(event) ? invitation : null);
    ipcMain.on('capture-choice', (event, id) => { if (trusted(event)) finishCapture(typeof id === 'string' ? id : undefined); });
    win = new BrowserWindow({ width: 1100, height: 720, minWidth: 820, minHeight: 600, backgroundColor: '#121212', title: 'GlupStreamXD', icon: path.join(__dirname, 'assets/icon.ico'), autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.on('closed', () => { finishCapture(); win = null; });
    receiveInvite(process.argv);
    win.loadURL(page);
  });
  app.on('window-all-closed', () => app.quit());
}
