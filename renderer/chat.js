(() => {
  class Chat {
    constructor(room, error) {
      this.room = room; this.error = error; this.list = document.querySelector('#messages'); this.input = document.querySelector('#message'); this.typing = document.querySelector('#typing'); this.typers = new Map();
      document.querySelector('#chat-form').onsubmit = event => { event.preventDefault(); this.send(); };
      this.input.oninput = () => { if (Date.now() - (this.lastTyped || 0) > 700) { room.send({ type: 'typing', active: true }); this.lastTyped = Date.now(); } clearTimeout(this.localTyping); this.localTyping = setTimeout(() => room.send({ type: 'typing', active: false }), 1000); };
      room.addEventListener('data', ({ detail }) => {
        if (detail.type === 'chat' || detail.type === 'sticker') { this.add(detail); this.typers.delete(detail.sender); this.renderTyping(); }
        if (detail.type === 'typing' && detail.sender !== room.peer?.id) { if (detail.active) this.typers.set(detail.sender, Date.now()); else this.typers.delete(detail.sender); this.renderTyping(); }
      });
      this.typingInterval = setInterval(() => this.renderTyping(), 1000);
      room.addEventListener('state', ({ detail }) => { const enabled = detail === 'connected' || (room.role === 'host' && detail === 'waiting'); this.input.disabled = !enabled; document.querySelector('#send').disabled = !enabled; document.querySelector('#stickers-button').disabled = !enabled; if (!enabled) { this.typers.clear(); this.renderTyping(); } });
      const dialog = document.querySelector('#stickers-dialog');
      document.querySelector('#stickers-button').onclick = () => dialog.showModal();
      for (const [key, [emoji, label]] of Object.entries(Glup.STICKERS)) { const button = document.createElement('button'); button.className = 'sticker-choice'; const face = document.createElement('span'); face.textContent = emoji; const text = document.createElement('small'); text.textContent = label; button.append(face, text); button.onclick = () => { this.sendSticker({ sticker: key }); dialog.close(); }; document.querySelector('#sticker-grid').append(button); }
      document.querySelector('#sticker-file').onchange = async event => { try { const image = await Glup.imageFile(event.target.files[0], 256, 50000); this.sendSticker({ image }); dialog.close(); } catch (e) { error(e.message); } event.target.value = ''; };
    }
    renderTyping() { const now = Date.now(); for (const [id, time] of this.typers) if (now - time > 2500) this.typers.delete(id); const names = [...this.typers.keys()].map(id => this.room.members.get(id)?.name || 'Alguém'); this.typing.textContent = names.length ? names.slice(0, 2).join(', ') + (names.length > 2 ? ' e outros estão digitando…' : names.length === 1 ? ' está digitando…' : ' estão digitando…') : ''; }
    reset() { this.list.replaceChildren(); this.input.value = ''; this.typers.clear(); this.renderTyping(); clearTimeout(this.localTyping); }
    trim() { while (this.list.children.length > 200) this.list.firstElementChild.remove(); }
    system(text) { const line = document.createElement('p'); line.className = 'system'; line.textContent = text; this.list.append(line); this.trim(); this.list.scrollTop = this.list.scrollHeight; }
    add(data) {
      document.querySelector('#chat-empty').hidden = true;
      const own = data.sender === this.room.peer?.id; const profile = this.room.members.get(data.sender) || { name: 'Participante' };
      const row = document.createElement('article'); row.className = 'message ' + (own ? 'own' : ''); row.append(Glup.avatar(profile));
      const body = document.createElement('div'), meta = document.createElement('div'); meta.className = 'message-meta';
      const name = document.createElement('strong'); name.textContent = profile.name + (own ? ' · Você' : '');
      const time = document.createElement('time'); time.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); meta.append(name, time); body.append(meta);
      if (data.type === 'sticker') {
        if (Glup.imageOK(data.image)) { const img = document.createElement('img'); img.className = 'chat-sticker'; img.src = data.image; img.alt = 'Figurinha de ' + profile.name; img.loading = 'lazy'; body.append(img); }
        else if (Glup.STICKERS[data.sticker]) { const sticker = document.createElement('div'); sticker.className = 'emoji-sticker'; const face = document.createElement('span'); face.textContent = Glup.STICKERS[data.sticker][0]; const label = document.createElement('small'); label.textContent = Glup.STICKERS[data.sticker][1]; sticker.append(face, label); body.append(sticker); }
      } else { const text = document.createElement('p'); text.textContent = data.text; body.append(text); }
      row.append(body); this.list.append(row); this.trim(); this.list.scrollTop = this.list.scrollHeight;
      if (!own && document.querySelector('#chat-panel').hidden) { const badge = document.querySelector('#unread'); badge.textContent = String(Math.min(99, Number(badge.textContent || 0) + 1)); badge.hidden = false; }
    }
    sendSticker(content) { if (Date.now() - (this.lastSticker || 0) < 850) return; if (this.room.send({ type: 'sticker', ...content })) this.lastSticker = Date.now(); else this.error('Não foi possível enviar a figurinha a todos. Confira a conexão e se todos estão na versão 2.0.1.'); }
    send() { const text = this.input.value.trim(); if (!text || text.length > 4000) return; if (this.room.send({ type: 'chat', text })) { this.input.value = ''; this.room.send({ type: 'typing', active: false }); this.input.focus(); } else this.error('A conexão está ocupada. Tente enviar novamente.'); }
  }
  window.Glup.Chat = Chat;
})();
