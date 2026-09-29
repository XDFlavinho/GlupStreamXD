/* Recursos comuns ao PC e ao Android. Somente o perfil é persistido. */
(() => {
  const mobile = document.documentElement.dataset.mobile === 'true';
  if (!window.desktop) {
    let invitation;
    window.desktop = { mobile: true, copy: async value => { if (window.GlupAndroid) GlupAndroid.copy(value); else await navigator.clipboard.writeText(value); },
      initialInvite: async () => null, onInvite: callback => { invitation = callback; }, onSources: () => {}, onCaptureExpired: () => {}, chooseSource: () => {},
      openLivePix: async () => { if (window.GlupAndroid) GlupAndroid.openLivePix(); else window.open('https://livepix.gg/xdflaviooo', '_blank', 'noopener'); }, saveApk: async () => null };
    window.receiveInvite = value => invitation?.(value);
  }
  const PIX = '00020126360014br.gov.bcb.pix0114+55169940941255204000053039865802BR5910F3D_STUDIO6009Sao Paulo610901227-20062240520daqr11985267866003686304367B';
  const STICKERS = { wave: ['👋', 'Oi!'], love: ['💜', 'Amei'], laugh: ['😂', 'KKKK'], wow: ['😮', 'Uau!'], gg: ['🎮', 'GG!'], party: ['🎉', 'Bora!'], coffee: ['☕', 'Pausa'], clap: ['👏', 'Mandou bem!'] };
  function avatar(profile) { const span = document.createElement('span'); span.className = 'avatar'; if (Glup.imageOK(profile?.photo, 5000)) { const img = document.createElement('img'); img.src = profile.photo; img.alt = ''; span.append(img); } else span.textContent = (profile?.name || 'V').slice(0, 1).toUpperCase(); return span; }
  async function imageFile(file, size, limit) {
    if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Escolha uma imagem PNG, JPG ou WebP de até 5 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      let edge = size;
      for (let attempt = 0; attempt < 4; attempt++) {
        const canvas = document.createElement('canvas'); const ratio = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const value = canvas.toDataURL('image/webp', 0.78 - attempt * 0.12);
        if (value.length <= limit) return value; edge = Math.round(edge * 0.75);
      }
      throw new Error('A imagem é muito complexa. Escolha outra.');
    } finally { bitmap.close(); }
  }
  class Extras {
    constructor(room, error) {
      this.room = room; this.error = error;
      try { this.profile = Glup.cleanProfile(JSON.parse(localStorage.getItem('glup-profile-v2') || '{}')); } catch { this.profile = Glup.cleanProfile(null); }
      room.setProfile(this.profile); this.renderProfile();
      const $ = id => document.getElementById(id);
      for (const [button, dialog] of [['profile-button','profile-dialog'], ['help-button','help-dialog'], ['stats-button','stats-dialog'], ['people-button','people-dialog']]) $(button).onclick = () => $(dialog).showModal();
      document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
      $('profile-name').value = this.profile.name;
      $('profile-photo').onchange = async () => { try { this.draftPhoto = await imageFile($('profile-photo').files[0], 96, 5000); this.preview(this.draftPhoto); } catch (e) { error(e.message); } $('profile-photo').value = ''; };
      $('remove-photo').onclick = () => { this.draftPhoto = ''; this.preview(''); };
      $('profile-form').onsubmit = event => {
        event.preventDefault(); const profile = Glup.cleanProfile({ name: $('profile-name').value, photo: this.draftPhoto ?? this.profile.photo });
        try { localStorage.setItem('glup-profile-v2', JSON.stringify(profile)); this.profile = profile; room.setProfile(profile); this.renderProfile(); $('profile-dialog').close(); }
        catch { error('Não foi possível salvar seu perfil neste dispositivo.'); }
      };
      $('pix-code').value = PIX;
      $('copy-pix').onclick = async () => { try { await desktop.copy(PIX); $('copy-pix').textContent = 'Pix copiado!'; setTimeout(() => $('copy-pix').textContent = 'Copiar Pix', 1800); } catch { error('Não foi possível copiar o Pix.'); } };
      $('livepix').onclick = () => desktop.openLivePix().catch(() => error('Não foi possível abrir o LivePix.'));
      $('save-apk').onclick = async () => { try { const result = await desktop.saveApk(); if (result) $('apk-feedback').textContent = 'APK salvo. Transfira esse arquivo para o celular.'; } catch { error('Não foi possível salvar o APK. Verifique a instalação do GlupStreamXD.'); } };
      if (mobile) $('android-download').hidden = true;
      room.addEventListener('members', ({ detail }) => this.members(detail));
      this.preview(this.profile.photo);
    }
    preview(photo) { const target = document.getElementById('profile-preview'); target.replaceChildren(avatar({ name: document.getElementById('profile-name').value, photo })); }
    renderProfile() { const button = document.getElementById('profile-button'); button.replaceChildren(avatar(this.profile)); const span = document.createElement('span'); span.textContent = this.profile.name; button.append(span); }
    members(members) {
      document.getElementById('people-count').textContent = String(members.length);
      const list = document.getElementById('people-list'); list.replaceChildren();
      for (const person of members) { const row = document.createElement('div'); row.className = 'person'; row.append(avatar(person)); const name = document.createElement('span'); name.textContent = person.name + (person.host ? ' · Host' : ''); row.append(name); list.append(row); }
    }
  }
  Object.assign(Glup, { Extras, PIX, STICKERS, avatar, imageFile, mobile });
})();
