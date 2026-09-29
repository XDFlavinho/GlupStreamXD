/* Inicialização compartilhada. No Android, somente o modo espectador aparece. */
const $ = selector => document.querySelector(selector);
const room = new Glup.Room();
function showError(message) { $('#error-text').textContent = message; $('#error').hidden = false; }
const extras = new Glup.Extras(room, showError);
const chat = new Glup.Chat(room, showError);
const stream = new Glup.Stream(room, showError);
const stats = new Glup.Stats(room, stream);
const labels = { offline: 'Desconectado', connecting: 'Conectando…', waiting: 'Aguardando espectadores', connected: 'Conectado', reconnecting: 'Reconectando…' };
let roomId = null;
$('#close-error').onclick = () => { $('#error').hidden = true; };
function start(role, id) { $('#error').hidden = true; chat.reset(); $('#chat-empty').hidden = false; roomId = id || null; room.start(role, id); chat.system('Você entrou na sala. O histórico é temporário.'); }
$('#create').onclick = () => start('host');
$('#join-form').onsubmit = event => { event.preventDefault(); const id = Glup.parseRoom($('#room-input').value); if (!id) return showError('Cole um ID válido, como glup-a8f3k2, ou um link de convite.'); if (!window.RTCPeerConnection || !crypto.randomUUID) return showError('Atualize o Android System WebView para usar este aplicativo.'); $('#room-input').blur(); start('guest', id); };
window.disconnectRoom = () => { room.leave(true); chat.reset(); $('#chat-empty').hidden = false; };
window.hasRoom = () => room.state !== 'offline';
$('#disconnect').onclick = window.disconnectRoom;
room.addEventListener('state', ({ detail: state }) => {
  $('#status').textContent = labels[state]; $('#status').dataset.state = state;
  $('#create').disabled = state !== 'offline'; $('#join').disabled = state !== 'offline'; $('#room-input').disabled = state !== 'offline';
  $('#disconnect').disabled = state === 'offline'; $('#room-card').hidden = state === 'offline'; $('.connect-card').hidden = state !== 'offline';
  document.body.classList.toggle('in-room', state !== 'offline'); window.GlupAndroid?.keepAwake(state === 'connected');
  if (state === 'offline') { roomId = null; $('#room-id').textContent = '—'; $('#room-role').textContent = ''; }
  if (state !== 'connected') { $('#ping').textContent = '— ms'; $('#quality').className = 'quality'; }
});
room.addEventListener('room', ({ detail: id }) => { roomId = id; $('#room-id').textContent = id; $('#room-role').textContent = room.role === 'host' ? 'VOCÊ É O HOST' : 'VOCÊ É ESPECTADOR'; });
room.addEventListener('connected', () => { if (room.role === 'guest') chat.system('Conectado ao host.'); });
room.addEventListener('member-joined', ({ detail }) => chat.system(detail.name + ' entrou na sala.'));
room.addEventListener('member-left', ({ detail }) => { if (room.role === 'host') chat.system(detail.name + ' saiu da sala.'); });
room.addEventListener('members', ({ detail }) => { $('#peer-label').textContent = detail.length ? detail.length + ' pessoas na sala' : 'Até 10 espectadores'; });
room.addEventListener('interrupted', () => chat.system('Conexão interrompida. Tentando reconectar por 10 segundos…'));
room.addEventListener('ended', ({ detail }) => { chat.reset(); showError(detail); });
room.addEventListener('error', ({ detail }) => showError(detail));
room.addEventListener('ping', ({ detail: ping }) => { $('#ping').textContent = ping + ' ms'; $('#quality').className = 'quality ' + (ping < 80 ? 'excellent' : ping < 180 ? 'good' : 'poor'); $('#quality').title = room.role === 'host' ? 'Maior ping entre os espectadores' : 'Ping até o host'; });
async function copy(button, link) { if (!roomId) return; try { await desktop.copy(link ? 'glupstreamxd://' + roomId : roomId); const old = button.textContent; button.textContent = 'Copiado!'; setTimeout(() => button.textContent = old, 1600); } catch { showError('Não foi possível copiar o convite.'); } }
$('#copy-id').onclick = event => copy(event.currentTarget, false); $('#copy-link').onclick = event => copy(event.currentTarget, true);
for (const tab of document.querySelectorAll('[data-tab]')) tab.onclick = () => {
  for (const other of document.querySelectorAll('[data-tab]')) { const active = other === tab; other.classList.toggle('active', active); other.setAttribute('aria-selected', active); }
  $('#chat-panel').hidden = tab.dataset.tab !== 'chat'; $('#stream-panel').hidden = tab.dataset.tab !== 'stream';
  if (tab.dataset.tab === 'chat') { $('#unread').hidden = true; $('#unread').textContent = '0'; }
};
function invitation(value) { const id = Glup.parseRoom(value); if (!id) return; if (room.state !== 'offline') return showError('Saia da sala atual antes de abrir outro convite.'); $('#room-input').value = id; $('#room-input').focus(); }
desktop.onInvite(invitation); desktop.initialInvite().then(id => { if (id) invitation(id); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && room.role === 'guest' && room.state === 'connected') { const link = room.links.get(room.target); if (!link || Date.now() - link.lastSeen > 8500) room.recover(); if (stream.video.srcObject) stream.play(); } });
window.addEventListener('beforeunload', () => { stream.stop(); room.leave(true); });
lucide.createIcons();
