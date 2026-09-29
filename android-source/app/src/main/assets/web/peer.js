/* Sala em estrela: o host autentica a origem e encaminha mensagens para até 10 espectadores. */
(() => {
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:80?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }];
  const MAX_VIEWERS = 10;
  const imageOK = (value, max = 50000) => typeof value === 'string' && value.length <= max && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  const cleanProfile = value => ({ name: typeof value?.name === 'string' ? value.name.trim().slice(0, 32) || 'Visitante' : 'Visitante', photo: imageOK(value?.photo, 5000) ? value.photo : '' });
  const parseRoom = value => { const id = String(value || '').trim().toLowerCase().replace(/^glupstreamxd:\/\//, '').replace(/\/$/, ''); return /^glup-[a-z0-9]{6,32}$/.test(id) ? id : null; };
  class Room extends EventTarget {
    constructor() { super(); this.links = new Map(); this.members = new Map(); this.profile = cleanProfile({ name: 'Visitante' }); this.state = 'offline'; this.generation = 0; this.role = null; this.peer = null; this.payload = { sent: 0, received: 0 }; }
    emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
    status(state) { this.state = state; this.emit('state', state); }
    get conn() { return this.role === 'guest' ? this.links.get(this.target)?.conn : [...this.links.values()].find(link => link.ready)?.conn; }
    get remote() { return this.role === 'guest' ? this.target : this.conn?.peer; }
    get viewerCount() { return [...this.links.values()].filter(link => link.ready).length; }
    list() { return [...this.members.values()]; }
    setProfile(profile) { this.profile = cleanProfile(profile); if (this.role === 'host' && this.peer?.id) { this.members.set(this.peer.id, { id: this.peer.id, ...this.profile, host: true }); this.roster(); } else if (this.state === 'connected') this.send({ type: 'profile', profile: this.profile }); }
    start(role, target) {
      this.leave(); this.role = role; this.target = target; this.payload = { sent: 0, received: 0 }; this.startedAt = Date.now(); this.status('connecting');
      const epoch = this.generation;
      const id = role === 'host' ? 'glup-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('') : undefined;
      const peer = this.peer = new Peer(id, { host: '0.peerjs.com', port: 443, secure: true, path: '/', config: { iceServers: ICE, iceTransportPolicy: 'all' }, debug: 0 });
      this.initialTimer = setTimeout(() => { if (epoch === this.generation && this.state === 'connecting') this.fail('Não foi possível conectar ao servidor. Verifique sua internet.'); }, 20000);
      peer.on('open', peerId => {
        if (epoch !== this.generation) return;
        clearTimeout(this.initialTimer); clearInterval(this.brokerRetry); this.brokerRetry = null; clearTimeout(this.brokerDeadline);
        this.emit('room', role === 'host' ? peerId : target);
        if (role === 'host') { this.members.set(peerId, { id: peerId, ...this.profile, host: true }); this.roster(); this.status(this.viewerCount ? 'connected' : 'waiting'); }
        else if (!this.links.has(target)) this.dial();
      });
      peer.on('connection', conn => {
        if (epoch !== this.generation || role !== 'host') return conn.close();
        let reason;
        if (conn.metadata?.protocol !== 2 || conn.serialization !== 'binary') reason = 'Atualize o PC e o APK para GlupStreamXD 2.0.1 para enviar imagens com segurança.';
        else if (this.links.has(conn.peer) || this.links.size >= MAX_VIEWERS) reason = 'Sala cheia: o limite é de 10 espectadores.';
        if (reason) { const timer = setTimeout(() => conn.close(), 3000); conn.on('open', () => { this.rawSend(conn, { type: 'rejected', message: reason }); setTimeout(() => { clearTimeout(timer); conn.close(); }, 300); }); return; }
        this.bind(conn);
      });
      peer.on('call', call => { if (epoch !== this.generation || role !== 'guest' || !this.links.get(call.peer)?.ready || call.peer !== this.target) return call.close(); this.emit('call', call); });
      peer.on('disconnected', () => { if (epoch === this.generation) this.reconnectBroker(); });
      peer.on('error', e => {
        if (epoch !== this.generation || this.recovery) return;
        const active = [...this.links.values()].some(link => link.ready);
        if (active && ['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) return this.reconnectBroker();
        if (active) return this.emit('error', 'Falha em uma conexão. Os demais participantes continuam na sala.');
        this.fail(e.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código com o host.' : e.type === 'unavailable-id' ? 'Código já está em uso. Crie outra sala.' : 'Não foi possível conectar ao servidor. Verifique sua internet.');
      });
      this.heartbeat = setInterval(() => {
        for (const [id, link] of [...this.links]) {
          if (!link.ready) continue;
          if (Date.now() - link.lastSeen > 8500) { this.drop(id, true); continue; }
          link.pingId = crypto.randomUUID(); link.pingAt = performance.now(); this.rawSend(link.conn, { type: 'ping', id: link.pingId });
        }
      }, 2000);
    }
    // BinaryPack fragmenta mensagens grandes automaticamente; JSON no PeerJS 1.5.5 limita a 16.300 bytes.
    dial() { if (!this.peer?.open || this.links.has(this.target)) return; this.bind(this.peer.connect(this.target, { reliable: true, serialization: 'binary', metadata: { protocol: 2 } })); }
    bind(conn) {
      const epoch = this.generation;
      const link = { conn, ready: false, lastSeen: Date.now(), profile: cleanProfile(null), rate: [], lastSticker: 0, lastProfile: 0 };
      this.links.set(conn.peer, link);
      const current = () => epoch === this.generation && this.links.get(conn.peer) === link;
      link.timer = setTimeout(() => { if (current() && !link.ready) { this.drop(conn.peer, true); if (this.role === 'guest' && !this.recovery) this.fail('A sala não respondeu. Verifique a rede ou atualize o host para 2.0.'); } }, this.recovery ? 2500 : 18000);
      conn.on('open', () => { if (!current()) return; if (this.role === 'guest') this.rawSend(conn, { type: 'hello', protocol: 2, profile: this.profile }); });
      conn.on('data', data => { if (!current() || !data || typeof data !== 'object' || typeof data.type !== 'string') return; let size; try { size = JSON.stringify(data).length; } catch { return; } if (size > 300000) return; this.payload.received += new TextEncoder().encode(JSON.stringify(data)).length; link.lastSeen = Date.now(); this.handle(link, data); });
      conn.on('close', () => { if (current()) this.drop(conn.peer, true); });
      conn.on('error', error => {
        if (!current()) return;
        // Erro de uma mensagem não significa falha da conexão nem exige fechar o vídeo.
        if (error?.type === 'message-too-big') { this.emit('error', 'Esta imagem não pôde ser enviada. A sala continua conectada; tente uma imagem menor.'); return; }
        this.drop(conn.peer, true);
      });
    }
    handle(link, data) {
      const id = link.conn.peer;
      if (data.type === 'rejected' && this.role === 'guest') return this.fail(typeof data.message === 'string' ? data.message.slice(0, 180) : 'A sala recusou a conexão.');
      if (data.type === 'hello' && this.role === 'host' && !link.ready) {
        if (data.protocol !== 2) return this.drop(id, false);
        link.profile = cleanProfile(data.profile); link.ready = true; clearTimeout(link.timer);
        this.members.set(id, { id, ...link.profile, host: false });
        this.rawSend(link.conn, { type: 'welcome', members: this.list(), hostId: this.peer.id, protocol: 2 });
        this.roster(); this.status('connected'); this.emit('member-joined', this.members.get(id)); this.emit('connected', { id }); return;
      }
      if (data.type === 'welcome' && this.role === 'guest' && data.protocol === 2 && !link.ready) {
        link.ready = true; clearTimeout(link.timer); this.stopRecovery(); this.acceptRoster(data.members); this.status('connected'); this.emit('connected', { id }); return;
      }
      if (!link.ready) return;
      if (data.type === 'ping' && typeof data.id === 'string' && data.id.length < 100) return this.rawSend(link.conn, { type: 'pong', id: data.id });
      if (data.type === 'pong' && data.id === link.pingId) { link.rtt = Math.round(performance.now() - link.pingAt); this.emit('ping', this.role === 'host' ? Math.max(...[...this.links.values()].map(l => l.rtt || 0)) : link.rtt); return; }
      if (data.type === 'bye') { if (this.role === 'guest') { this.leave(); this.emit('ended', 'O host encerrou a sala.'); } else this.drop(id, false); return; }
      if (this.role === 'guest') {
        if (data.type === 'roster') return this.acceptRoster(data.members);
        if (['chat', 'sticker', 'typing', 'stream-stop'].includes(data.type) && this.validMessage(data)) this.emit('data', data);
        return;
      }
      // O host substitui qualquer identidade recebida; convidados não podem se passar por outra pessoa.
      if (data.type === 'profile') { if (Date.now() - link.lastProfile < 1000) return; link.lastProfile = Date.now(); link.profile = cleanProfile(data.profile); this.members.set(id, { id, ...link.profile, host: false }); this.roster(); return; }
      if (data.type === 'stream-request') { if (Date.now() - (link.lastRequest || 0) < 1000) return; link.lastRequest = Date.now(); this.emit('data', { type: 'stream-request', from: id }); return; }
      if (!['chat', 'sticker', 'typing'].includes(data.type) || !this.validMessage(data)) return;
      const now = Date.now(); link.rate = link.rate.filter(time => now - time < 1000); if (link.rate.length >= 12) return;
      if (data.type === 'sticker' && now - link.lastSticker < 800) return;
      if (data.type === 'sticker') link.lastSticker = now;
      link.rate.push(now); this.publish(data, id);
    }
    validMessage(data) {
      if (data.type === 'chat') return typeof data.text === 'string' && !!data.text.trim() && data.text.length <= 4000;
      if (data.type === 'sticker') return (typeof data.sticker === 'string' && /^(wave|love|laugh|wow|gg|party|coffee|clap)$/.test(data.sticker)) || imageOK(data.image);
      return ['typing', 'stream-stop'].includes(data.type);
    }
    publish(data, sender) {
      const packet = { type: data.type, sender, time: Date.now() };
      if (data.type === 'chat') packet.text = data.text;
      if (data.type === 'sticker') { if (imageOK(data.image)) packet.image = data.image; else packet.sticker = data.sticker; }
      if (data.type === 'typing') packet.active = data.active === true;
      let delivered = true;
      for (const link of this.links.values()) if (link.ready && !this.rawSend(link.conn, packet)) delivered = false;
      this.emit('data', packet);
      return delivered;
    }
    rawSend(conn, data) {
      if (!conn?.open || (conn.dataChannel?.bufferedAmount || 0) > 512000) return false;
      try {
        const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
        // Defesa para conexões antigas: não dispare o erro síncrono do serializador JSON.
        if (conn.serialization === 'json' && bytes >= 16300) { this.emit('error', 'Um participante está com transporte antigo. Atualize todos para 2.0.1; a sala foi mantida aberta.'); return false; }
        conn.send(data); if (!conn.open) return false;
        this.payload.sent += bytes; return true;
      } catch { return false; }
    }
    send(data) {
      if (this.role === 'host') {
        if (['chat', 'sticker', 'typing'].includes(data.type) && this.validMessage(data)) return this.publish(data, this.peer.id);
        if (data.type === 'stream-stop' || data.type === 'bye') { for (const link of this.links.values()) if (link.ready) this.rawSend(link.conn, data); return true; }
        return false;
      }
      return this.rawSend(this.conn, data);
    }
    roster() { if (this.role !== 'host') return; const members = this.list(); for (const link of this.links.values()) if (link.ready) this.rawSend(link.conn, { type: 'roster', members }); this.emit('members', members); }
    acceptRoster(values) { if (!Array.isArray(values) || values.length > 11) return; this.members.clear(); for (const value of values) if (typeof value?.id === 'string' && value.id.length < 100) this.members.set(value.id, { id: value.id, ...cleanProfile(value), host: value.id === this.target }); this.emit('members', this.list()); }
    drop(id, unexpected) {
      const link = this.links.get(id); if (!link) return;
      this.links.delete(id); clearTimeout(link.timer); link.conn.close();
      const member = this.members.get(id); this.members.delete(id); this.emit('member-left', { id, name: member?.name || 'Visitante' });
      if (this.role === 'host') { this.roster(); this.status(this.viewerCount ? 'connected' : 'waiting'); }
      else if (unexpected) this.recover();
    }
    recover() {
      if (!this.peer || this.role !== 'guest' || this.recovery) return;
      const link = this.links.get(this.target); this.links.delete(this.target); if (link) { clearTimeout(link.timer); link.conn.close(); }
      this.status('reconnecting'); this.emit('interrupted');
      this.recovery = setTimeout(() => this.fail('A conexão caiu. Não foi possível reconectar em 10 segundos.'), 10000);
      const attempt = () => { try { if (this.peer?.disconnected) this.peer.reconnect(); else this.dial(); } catch {} };
      this.retry = setInterval(attempt, 1000); attempt();
    }
    reconnectBroker() {
      if (!this.peer || this.brokerRetry) return;
      const attempt = () => { try { if (this.peer?.disconnected && !this.peer.destroyed) this.peer.reconnect(); } catch {} };
      this.brokerRetry = setInterval(attempt, 1000); attempt();
      this.brokerDeadline = setTimeout(() => { clearInterval(this.brokerRetry); this.brokerRetry = null; if (this.viewerCount) this.emit('error', 'O servidor de sinalização não respondeu. As conexões abertas continuam, mas novas entradas podem falhar.'); else this.fail('Não foi possível conectar ao servidor. Verifique sua internet.'); }, 10000);
    }
    stopRecovery() { clearTimeout(this.recovery); clearInterval(this.retry); this.recovery = null; }
    fail(message) { this.leave(); this.emit('error', message); }
    leave(notify = false) {
      if (notify) this.send({ type: 'bye' });
      this.generation++; clearTimeout(this.initialTimer); clearInterval(this.heartbeat); clearInterval(this.brokerRetry); clearTimeout(this.brokerDeadline); this.brokerRetry = null; this.stopRecovery();
      const peer = this.peer; this.peer = null; for (const link of this.links.values()) clearTimeout(link.timer); this.links.clear(); this.members.clear(); this.role = null; peer?.destroy(); this.status('offline'); this.emit('members', []);
    }
  }
  window.Glup = { Room, parseRoom, ICE, MAX_VIEWERS, cleanProfile, imageOK };
})();

