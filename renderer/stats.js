/* Estatísticas das conexões WebRTC deste app; não lê tráfego de outros programas. */
(() => {
  const mb = bytes => (bytes / 1048576).toFixed(2) + ' MB';
  const rate = value => (value * 8 / 1000000).toFixed(2) + ' Mb/s';
  const number = value => Number.isFinite(value) ? value.toFixed(1) : '—';
  class Stats {
    constructor(room, stream) {
      this.room = room; this.stream = stream; this.reset(); this.endedAt = this.since;
      room.addEventListener('state', ({ detail }) => { if (detail === 'connecting') { this.reset(); this.endedAt = null; } else if (detail === 'offline') this.endedAt = Date.now(); });
      this.timer = setInterval(() => this.tick(), 2000);
      document.getElementById('stats-button').addEventListener('click', () => this.render());
    }
    reset() { this.previous = new WeakMap(); this.totalTx = 0; this.totalRx = 0; this.history = []; this.rows = []; this.tx = 0; this.rx = 0; this.since = Date.now(); this.epoch = (this.epoch || 0) + 1; }
    async sample(pc, id, kind) {
      const reports = await pc.getStats(); const now = performance.now();
      let state = this.previous.get(pc); if (!state) { state = { pairs: new Map(), time: now - 2000 }; this.previous.set(pc, state); }
      const elapsed = Math.max(0.001, (now - state.time) / 1000); state.time = now;
      let pair;
      reports.forEach(r => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = reports.get(r.selectedCandidatePairId); });
      if (!pair) reports.forEach(r => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) pair = r; });
      let tx = 0, rx = 0;
      if (pair) {
        const old = state.pairs.get(pair.id) || { tx: 0, rx: 0 };
        const sent = pair.bytesSent || 0, received = pair.bytesReceived || 0;
        tx = Math.max(0, sent - old.tx); rx = Math.max(0, received - old.rx); state.pairs.set(pair.id, { tx: sent, rx: received });
      }
      const row = { id, kind, name: this.room.members.get(id)?.name || 'Participante', tx: tx / elapsed, rx: rx / elapsed, deltaTx: tx, deltaRx: rx, rtt: pair?.currentRoundTripTime == null ? null : pair.currentRoundTripTime * 1000, route: '—', codec: '—', state: pc.connectionState, resolution: '—', fps: null, loss: null, jitter: null, dropped: null, frames: null, quality: '—', encodeMs: null, audio: false };
      if (pair) { const local = reports.get(pair.localCandidateId), remote = reports.get(pair.remoteCandidateId); row.route = [local?.candidateType, remote?.candidateType].includes('relay') ? 'TURN' : 'Direta'; row.route += ' · ' + (local?.protocol || '—').toUpperCase(); }
      let videoOutbound;
      reports.forEach(r => {
        if (r.type === 'outbound-rtp' && r.kind === 'video') videoOutbound = r;
        if (['inbound-rtp','outbound-rtp'].includes(r.type) && r.kind === 'audio') row.audio = true;
        if (['inbound-rtp','outbound-rtp'].includes(r.type) && (r.kind === 'video' || r.mediaType === 'video')) {
          row.resolution = r.frameWidth && r.frameHeight ? `${r.frameWidth} × ${r.frameHeight}` : '—'; row.fps = r.framesPerSecond;
          row.codec = reports.get(r.codecId)?.mimeType?.replace('video/', '') || '—'; row.quality = r.qualityLimitationReason || '—';
          if (r.packetsLost != null) row.loss = 100 * Math.max(0, r.packetsLost) / Math.max(1, (r.packetsReceived || 0) + Math.max(0, r.packetsLost));
          if (r.jitter != null) row.jitter = r.jitter * 1000;
          row.dropped = r.framesDropped ?? null; row.frames = r.framesEncoded ?? r.framesDecoded ?? null;
          const totalTime = r.totalEncodeTime ?? r.totalDecodeTime; if (totalTime != null && row.frames) row.encodeMs = totalTime * 1000 / row.frames;
        }
      });
      if (videoOutbound) reports.forEach(r => { if (r.type === 'remote-inbound-rtp' && r.localId === videoOutbound.id) { row.loss = r.fractionLost != null ? Math.max(0, r.fractionLost * 100) : r.packetsLost != null ? Math.max(0, r.packetsLost) / Math.max(1, videoOutbound.packetsSent) * 100 : null; if (r.jitter != null) row.jitter = r.jitter * 1000; } });
      return row;
    }
    async tick() {
      if (this.busy) return; this.busy = true; const epoch = this.epoch;
      try {
        const jobs = [];
        for (const [id, link] of this.room.links) if (link.ready && link.conn.peerConnection) jobs.push(this.sample(link.conn.peerConnection, id, 'Dados'));
        for (const [id, record] of this.stream.calls) if (record.media.peerConnection) jobs.push(this.sample(record.media.peerConnection, id, 'Mídia'));
        const settled = await Promise.allSettled(jobs); if (epoch !== this.epoch) return;
        this.rows = settled.filter(item => item.status === 'fulfilled').map(item => item.value);
        this.tx = 0; this.rx = 0;
        for (const row of this.rows) { this.tx += row.tx; this.rx += row.rx; this.totalTx += row.deltaTx; this.totalRx += row.deltaRx; }
        this.history.push([this.tx, this.rx]); if (this.history.length > 60) this.history.shift();
        if (!this.stream.local) { const received = this.rows.find(row => row.kind === 'Mídia'); if (received) document.getElementById('stream-stats').textContent = `${received.resolution} · ${number(received.fps)} FPS · ${rate(received.rx)} recebidos`; }
        document.getElementById('traffic-mini').textContent = '↑ ' + rate(this.tx) + '  ↓ ' + rate(this.rx);
        if (document.getElementById('stats-dialog').open) this.render();
      } finally { this.busy = false; }
    }
    render() {
      const $ = id => document.getElementById(id);
      $('stat-upload').textContent = rate(this.tx); $('stat-download').textContent = rate(this.rx);
      $('stat-sent').textContent = mb(this.totalTx); $('stat-received').textContent = mb(this.totalRx);
      $('stat-duration').textContent = Math.floor(((this.endedAt ?? Date.now()) - this.since) / 60000) + ' min';
      $('stat-participants').textContent = this.room.members.size + ' / 11';
      $('stat-chat').textContent = `Tamanho lógico do chat, perfis e controle (JSON equivalente): ↑ ${mb(this.room.payload.sent)} / ↓ ${mb(this.room.payload.received)}. Diagnóstico antes da serialização binária; não corresponde byte a byte ao transporte e não deve ser somado aos totais acima.`;
      const list = $('stats-rows'); list.replaceChildren();
      for (const row of this.rows) {
        const tr = document.createElement('tr');
        const values = [row.name + ' · ' + row.kind, rate(row.tx), rate(row.rx), number(row.rtt) + ' ms', row.route, row.resolution, number(row.fps), row.loss == null ? '—' : number(row.loss) + '%', row.jitter == null ? '—' : number(row.jitter) + ' ms', row.codec + (row.audio ? ' + áudio' : ''), row.frames ?? '—', row.dropped ?? '—', row.encodeMs == null ? '—' : number(row.encodeMs) + ' ms', row.quality, row.state];
        for (const value of values) { const td = document.createElement('td'); td.textContent = String(value); tr.append(td); } list.append(tr);
      }
      const canvas = $('traffic-chart'), ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#151515'; ctx.fillRect(0,0,w,h);
      const max = Math.max(125000, ...this.history.flat());
      for (const [column, color] of [[0,'#a78bfa'],[1,'#22c55e']]) { ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; this.history.forEach((point, index) => { const x = index / 59 * w, y = h - 8 - point[column] / max * (h - 16); if (index === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); }
      $('chart-scale').textContent = 'Últimos 2 minutos · escala até ' + rate(max) + ' · roxo: envio / verde: recebimento';
    }
  }
  Glup.Stats = Stats;
})();
