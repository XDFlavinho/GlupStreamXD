/* Uma captura compartilhada; um emissor WebRTC por espectador, com orçamento total de banda. */
(() => {
  const el = id => document.getElementById(id);
  class Stream {
    constructor(room, error) {
      this.room = room; this.error = error; this.video = el('video'); this.epoch = 0; this.calls = new Map();
      el('start-stream').onclick = () => this.start(); el('stop-stream').onclick = () => this.stop();
      el('mute').onclick = () => { this.video.muted = !this.video.muted; el('mute-label').textContent = this.video.muted ? 'Ativar som' : 'Mudo'; this.play(); };
      el('resume-video').onclick = () => this.play();
      el('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await el('player').requestFullscreen(); } catch { error('Não foi possível abrir a tela cheia.'); } };
      desktop.onSources(sources => {
        const list = el('sources'); list.replaceChildren();
        for (const source of sources) { const button = document.createElement('button'); const image = document.createElement('img'); image.src = source.thumbnail; image.alt = ''; const name = document.createElement('span'); name.textContent = source.name; button.append(image, name); button.onclick = () => { desktop.chooseSource(source.id); el('source-dialog').close(); }; list.append(button); }
        el('audio-warning').hidden = !el('system-audio').checked; if (!el('source-dialog').open) el('source-dialog').showModal();
      });
      const cancel = () => { this.captureCancelled = true; desktop.chooseSource(null); el('source-dialog').close(); };
      el('cancel-source').onclick = cancel; el('source-dialog').addEventListener('cancel', cancel); desktop.onCaptureExpired(() => el('source-dialog').close());
      room.addEventListener('call', ({ detail }) => this.receive(detail));
      room.addEventListener('connected', () => { this.update(); if (room.role === 'guest') room.send({ type: 'stream-request' }); });
      room.addEventListener('member-left', ({ detail }) => { this.closeCall(detail.id); if (room.role === 'host') this.tune(); });
      room.addEventListener('interrupted', () => { this.closeAll(); if (!this.local) this.clearVideo(); });
      room.addEventListener('state', ({ detail }) => { if (detail === 'offline') this.stop(); this.update(); });
      room.addEventListener('members', () => this.tune());
      room.addEventListener('data', ({ detail }) => {
        if (detail.type === 'stream-stop' && room.role === 'guest') { this.closeAll(); this.clearVideo(); }
        if (detail.type === 'stream-request' && room.role === 'host' && this.local && !this.calls.has(detail.from)) this.call(detail.from);
      });
      el('bandwidth').onchange = () => this.tune(); el('auto-quality').onchange = () => this.tune();
      this.previewTimer = setInterval(() => {
        if (this.local) { const settings = this.local.getVideoTracks()[0]?.getSettings(); el('stream-stats').textContent = `Captura: ${settings.width} × ${settings.height} · até ${Math.round(settings.frameRate || 0)} FPS · ${this.calls.size} espectadores`; }
      }, 2000);
    }
    update() {
      const host = this.room.role === 'host', active = !!this.local;
      el('host-controls').hidden = !host;
      el('start-stream').disabled = !host || !['waiting', 'connected'].includes(this.room.state) || this.starting;
      el('start-stream').hidden = active; el('stop-stream').hidden = !active;
      for (const id of ['resolution','fps','system-audio']) el(id).disabled = active || this.starting;
      el('stream-hint').textContent = host ? 'Escolha a tela. Até 10 espectadores podem acompanhar.' : this.room.role === 'guest' ? 'Aguardando o host compartilhar a tela…' : 'Crie ou entre em uma sala para começar.';
    }
    async start() {
      if (this.starting || this.local || this.room.role !== 'host') return;
      const epoch = ++this.epoch; this.captureCancelled = false; this.starting = true; this.update(); let captured;
      try {
        const height = Number(el('resolution').value), fps = Number(el('fps').value);
        captured = await navigator.mediaDevices.getDisplayMedia({ video: { height: { ideal: height }, width: { ideal: Math.round(height * 16 / 9) }, frameRate: { ideal: fps } }, audio: el('system-audio').checked });
        if (epoch !== this.epoch) { captured.getTracks().forEach(t => t.stop()); return; }
        this.local = captured; captured.getVideoTracks()[0].contentHint = 'detail';
        captured.getVideoTracks()[0].addEventListener('ended', () => this.stop());
        this.showVideo(captured, true); await this.tune();
        for (const [id, link] of this.room.links) if (link.ready) this.call(id);
      } catch (e) { captured?.getTracks().forEach(t => t.stop()); this.local = null; if (epoch === this.epoch) this.error(this.captureCancelled || e.name === 'NotAllowedError' ? 'Você precisa permitir o compartilhamento de tela.' : 'Não foi possível capturar a tela. Tente outra fonte ou desative o áudio do sistema.'); }
      finally { if (epoch === this.epoch) { this.starting = false; this.update(); } }
    }
    limits() {
      const viewers = Math.max(1, this.room.viewerCount), budget = Number(el('bandwidth').value) * 1000000;
      const bitrate = Math.max(150000, Math.floor(budget * 0.85 / viewers - 64000));
      const auto = el('auto-quality').checked, selected = Number(el('resolution').value);
      const height = auto ? Math.min(selected, bitrate < 500000 ? 360 : bitrate < 1100000 ? 480 : viewers >= 4 ? 720 : selected) : selected;
      const fps = auto && viewers >= 4 ? Math.min(24, Number(el('fps').value)) : Number(el('fps').value);
      return { bitrate, height, fps, viewers, budget };
    }
    async tune() {
      if (!this.local) return;
      if (this.tuning) { this.tuneAgain = true; return; } this.tuning = true;
      const stream = this.local, limits = this.limits();
      try {
        await stream.getVideoTracks()[0].applyConstraints({ height: { max: limits.height }, width: { max: Math.round(limits.height * 16 / 9) }, frameRate: { max: limits.fps } });
        for (const { media } of this.calls.values()) {
          for (const sender of media.peerConnection?.getSenders() || []) {
            if (!sender.track) continue; const params = sender.getParameters(); if (!params.encodings?.length) continue;
            params.encodings[0].maxBitrate = sender.track.kind === 'video' ? limits.bitrate : 64000;
            if (sender.track.kind === 'video') { params.encodings[0].maxFramerate = limits.fps; params.degradationPreference = 'balanced'; }
            try { await sender.setParameters(params); } catch { /* Renegociação em andamento: o evento connected tenta de novo. */ }
          }
        }
        el('budget-info').textContent = `Até ${(limits.bitrate / 1000000).toFixed(2)} Mb/s de vídeo por espectador · ${limits.height}p / ${limits.fps} FPS. Reserva de 15% para variações. O teto é uma meta, não um medidor do upload da operadora.`;
      } catch { if (this.local === stream) this.error('A fonte não aceitou o limite de qualidade. Pare e escolha outra resolução.'); }
      finally { this.tuning = false; if (this.tuneAgain) { this.tuneAgain = false; this.tune(); } }
    }
    call(id) { if (!this.local || !this.room.links.get(id)?.ready || this.calls.has(id)) return; const media = this.room.peer.call(id, this.local); if (!media) return; this.bind(media); }
    receive(media) { this.closeAll(); this.bind(media); media.on('stream', stream => { if (this.calls.get(media.peer)?.media === media) { this.showVideo(stream, false); el('stream-tab').click(); el('message').blur(); } }); media.answer(); }
    bind(media) {
      const record = { media }; this.calls.set(media.peer, record);
      record.timer = setTimeout(() => { if (this.calls.get(media.peer) === record && media.peerConnection?.connectionState !== 'connected') { this.closeCall(media.peer); if (!this.local) this.clearVideo(); this.error('Um vídeo não conectou. O participante pode sair e entrar novamente sem interromper os demais.'); } }, 20000);
      media.peerConnection?.addEventListener('connectionstatechange', () => { if (media.peerConnection.connectionState === 'connected') { clearTimeout(record.timer); this.tune(); } });
      media.on('close', () => { if (this.calls.get(media.peer) === record) { this.closeCall(media.peer); if (!this.local) this.clearVideo(); } });
      media.on('error', () => { if (this.calls.get(media.peer) === record) { this.closeCall(media.peer); if (!this.local) this.clearVideo(); this.error('A transmissão de um participante foi interrompida. Entre novamente para reconectar esse vídeo.'); } });
      this.tune();
    }
    async play() { try { await this.video.play(); el('resume-video').hidden = true; } catch { this.video.muted = true; el('mute-label').textContent = 'Ativar som'; try { await this.video.play(); } catch { el('resume-video').hidden = false; } } }
    showVideo(stream, own) { this.video.srcObject = stream; this.video.muted = own; el('mute').hidden = own; el('mute-label').textContent = 'Mudo'; el('player').hidden = false; el('stream-empty').hidden = true; this.play(); }
    closeCall(id) { const record = this.calls.get(id); if (!record) return; this.calls.delete(id); clearTimeout(record.timer); record.media.close(); }
    closeAll() { for (const id of [...this.calls.keys()]) this.closeCall(id); }
    clearVideo() { this.video.pause(); this.video.srcObject = null; el('player').hidden = true; el('stream-empty').hidden = false; el('stream-stats').textContent = 'Aguardando vídeo…'; }
    stop() { this.epoch++; this.starting = false; if (el('source-dialog').open) { desktop.chooseSource(null); el('source-dialog').close(); } if (this.local) this.room.send({ type: 'stream-stop' }); this.closeAll(); const stream = this.local; this.local = null; stream?.getTracks().forEach(track => track.stop()); this.clearVideo(); this.update(); }
  }
  window.Glup.Stream = Stream;
})();
