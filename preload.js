const { contextBridge, ipcRenderer } = require('electron');
// A ponte expõe somente ações específicas, sem acesso genérico ao Node ou IPC.
function listen(channel, callback) {
  const handler = (_, value) => callback(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
contextBridge.exposeInMainWorld('desktop', {
  copy: value => ipcRenderer.invoke('copy', value),
  openLivePix: () => ipcRenderer.invoke('open-livepix'),
  saveApk: () => ipcRenderer.invoke('save-apk'),
  initialInvite: () => ipcRenderer.invoke('initial-invite'),
  onInvite: callback => listen('invite', callback),
  onSources: callback => listen('capture-sources', callback),
  onCaptureExpired: callback => listen('capture-expired', callback),
  chooseSource: id => ipcRenderer.send('capture-choice', id)
});
