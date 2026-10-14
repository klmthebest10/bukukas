/* =====================================================================
   MODE ONLINE + OFFLINE untuk akun cloud
   - Data usaha disimpan juga di perangkat (IndexedDB) → aplikasi tetap
     terbuka & bisa dipakai tanpa internet.
   - Perubahan saat offline masuk ANTREAN dan otomatis dikirim ke server
     ketika internet kembali (urutan tetap terjaga).
   ===================================================================== */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('no idb'));
      const r = indexedDB.open('bukukas', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async get(k) {
    try { const db = await this.open(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
    catch (e) { return LS.get('idb_' + k, undefined); }
  },
  async set(k, v) {
    try { const db = await this.open(); await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
    catch (e) { LS.set('idb_' + k, v); }
  },
  async del(k) {
    try { const db = await this.open(); await new Promise((res) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch (e) {}
    LS.del('idb_' + k);
  },
  async clearUser(uid) {
    try { const db = await this.open(); await new Promise((res) => { const tx = db.transaction('kv', 'readwrite'); const st = tx.objectStore('kv'); const q = st.openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return; if (String(c.key).includes(uid)) c.delete(); c.continue(); }; tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch (e) {}
  }
};

/* salinan data di perangkat (snapshot) */
const Snap = {
  k(id) { return 'snap:' + (S.user && S.user.id) + ':' + id; },
  async get(id) { return IDB.get(this.k(id)); },
  async put(id, v) { if (S.mode === 'cloud' && S.user) await IDB.set(this.k(id), v); },
  _t: null,
  save() { if (S.mode !== 'cloud' || !S.user) return; clearTimeout(this._t); this._t = setTimeout(() => { if (S.biz) this.put(S.biz.id, JSON.parse(JSON.stringify(S.d))); this.put('biz', JSON.parse(JSON.stringify(S.businesses))); }, 300); }
};

const isOffline = () => navigator.onLine === false;
const isNetErr = e => { const m = String((e && (e.message || e.details)) || e || ''); return isOffline() || /load failed|failed to fetch|networkerror|network request failed|fetch failed|timed? ?out|aborted|err_internet|err_network/i.test(m); };

/* antrean perubahan yang belum terkirim */
const Sync = {
  q: [], busy: false, uid: null, failed: [],
  key() { return 'outbox:' + this.uid; },
  async init(uid) { this.uid = uid; this.q = (await IDB.get(this.key())) || []; this.failed = (await IDB.get('failed:' + uid)) || []; this.ui(); },
  async save() { if (this.uid) { await IDB.set(this.key(), this.q); await IDB.set('failed:' + this.uid, this.failed); } this.ui(); },
  /* gabungkan perubahan berulang pada data yang sama agar antrean tetap ringkas */
  async push(op) {
    const same = (o, t, id) => o.t === t && ((o.op === 'update' || o.op === 'delete') ? o.id === id : (o.rows || []).some(r => r.id === id));
    if (op.op === 'update') {
      for (let i = this.q.length - 1; i >= 0; i--) {
        const o = this.q[i]; if (!same(o, op.t, op.id)) continue;
        if (o.op === 'delete') break;
        if (o.op === 'upsert') { const r = o.rows.find(r => r.id === op.id); Object.assign(r, strip(op.patch)); return this.save(); }
        if (o.op === 'update') { Object.assign(o.patch, op.patch); return this.save(); }
      }
    }
    if (op.op === 'delete') {
      this.q = this.q.filter(o => !(o.op === 'update' && o.t === op.t && o.id === op.id)).map(o => (o.op === 'upsert' && o.t === op.t) ? { ...o, rows: o.rows.filter(r => r.id !== op.id) } : o).filter(o => o.op !== 'upsert' || o.rows.length);
    }
    if (op.op === 'upsert') op = { ...op, rows: op.rows.map(strip) };
    this.q.push({ ...op, ts: Date.now() }); await this.save();
  },
  run(op) {
    if (op.op === 'upsert') return Cloud.insert(op.t, op.rows);
    if (op.op === 'update') return Cloud.update(op.t, op.id, op.patch);
    if (op.op === 'delete') return Cloud.remove(op.t, op.id);
  },
  /* dipanggil setiap ada perubahan data: kirim langsung bila online, antre bila offline */
  async exec(op) {
    if (this.q.length || isOffline() || !S.sb) { await this.push(op); this.flushSoon(); return null; }
    try { return await this.run(op); }
    catch (e) { if (isNetErr(e)) { await this.push(op); this.flushSoon(); return null; } throw e; }
  },
  flushSoon(ms = 1500) { clearTimeout(this._t); this._t = setTimeout(() => this.flush(), ms); },
  async flush(manual) {
    if (this.busy || S.mode !== 'cloud' || !S.sb) return;
    if (!this.q.length) { if (manual) toast('Semua data sudah tersinkron ✅'); return; }
    if (isOffline()) { if (manual) toast('Masih offline — antrean akan dikirim saat internet kembali', true); return; }
    this.busy = true; this.ui(); let n = 0, stopped = false;
    try {
      const { data } = await S.sb.auth.getSession();
      if (!data || !data.session) { this.needLogin = true; if (manual) toast('Sesi login berakhir. Masuk lagi untuk menyinkronkan (data antrean tetap aman).', true); return; }
      this.needLogin = false;
      while (this.q.length) {
        const op = this.q[0];
        try { await this.run(op); }
        catch (e) {
          if (isNetErr(e)) { stopped = true; break; }
          console.error('sync gagal', op, e); this.failed.push({ ...op, err: humanErr(e) });
        }
        this.q.shift(); n++; await this.save();
      }
      if (n) LS.set('bk_last_sync', Date.now());
    } finally {
      this.busy = false; this.ui();
      if (n) toast('☁️ ' + n + ' perubahan tersinkron ke server');
      if (stopped) this.flushSoon(15000);
      else if (n && !this.q.length) setTimeout(() => this.refresh(), 800);
    }
  },
  /* ambil data terbaru dari server (perubahan dari perangkat lain) */
  async refresh(force) {
    if (S.mode !== 'cloud' || !S.sb || !S.biz || isOffline() || this.q.length || this.busy) return;
    if (!force && ($('#modal').classList.contains('open') || $('#lock').classList.contains('on') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)))) return;
    try {
      const [d, bl] = await Promise.all([Cloud.load(S.biz.id), Cloud.listBiz()]);
      if (this.q.length) return;
      const changed = JSON.stringify(d) !== JSON.stringify(S.d);
      S.d = d; S.businesses = bl.map(normalizeBiz); const nb = S.businesses.find(b => b.id === S.biz.id); if (nb) { S.biz = nb; APP_TZ = nb.settings.tz || APP_TZ; }
      await Snap.put(S.biz.id, d); await Snap.put('biz', S.businesses); LS.set('bk_last_sync', Date.now());
      if (changed && !$('#modal').classList.contains('open')) render();
      this.ui();
    } catch (e) { /* abaikan: dicoba lagi nanti */ }
  },
  /* sambung ulang setelah mode offline (mis. sinyal kembali tanpa event 'online') */
  async reconnect() {
    if (S.mode !== 'cloud' || !S.offline || isOffline()) return;
    if (!S.sb) { return; }
    try {
      const { data } = await S.sb.auth.getSession();
      if (!data || !data.session) { this.needLogin = true; this.ui(); return; }
      await Cloud.listBiz(); S.offline = false; this.needLogin = false; this.ui(); toast('✅ Tersambung kembali — menyinkronkan data…');
      await this.flush(); await this.refresh();
    } catch (e) { /* masih offline */ }
  },
  state() { if (S.mode !== 'cloud') return 'local'; if (isOffline() || S.offline) return 'offline'; if (this.busy) return 'syncing'; if (this.q.length) return 'pending'; return 'ok'; },
  ui() {
    const b = $('#syncBtn'); if (!b) return; const st = this.state(), n = this.q.length;
    const map = { ok: ['cloud', 'Tersinkron', 'ok'], pending: ['clock', n + ' menunggu', 'pend'], syncing: ['refresh', 'Menyinkron…', 'pend'], offline: ['cloudoff', 'Offline' + (n ? ' • ' + n : ''), 'off'], local: ['phone', 'Lokal', 'ok'] };
    const [icon, label, cls] = map[st];
    b.className = 'sync-pill ' + cls + (st === 'syncing' ? ' spin' : ''); b.innerHTML = ic(icon) + '<span>' + label + '</span>';
    b.title = st === 'ok' ? 'Semua data tersimpan di server' : st === 'offline' ? 'Mode offline: perubahan disimpan di perangkat & dikirim otomatis saat online' : 'Ada perubahan yang belum terkirim';
    const sb = $('.side .sec-badge'); if (sb) sb.outerHTML = secBadge();
  }
};

/* lapisan data cloud: tulis lewat antrean, baca dengan cadangan salinan perangkat */
const CloudSync = {
  async listBiz() {
    if (isOffline() || S.offline) { const c = await Snap.get('biz'); if (c) return c; }
    try { const bl = await Cloud.listBiz(); await Snap.put('biz', bl); return bl; }
    catch (e) { if (isNetErr(e)) { const c = await Snap.get('biz'); if (c) { S.offline = true; return c; } } throw e; }
  },
  async load(bizId) {
    if (Sync.q.length && !isOffline() && !S.offline) await Sync.flush();
    if (isOffline() || S.offline || Sync.q.length) { const c = await Snap.get(bizId); if (c) return c; }
    try { const d = await Cloud.load(bizId); await Snap.put(bizId, d); return d; }
    catch (e) { if (isNetErr(e)) { const c = await Snap.get(bizId); if (c) { S.offline = true; return c; } } throw e; }
  },
  insert(t, rows) { return Sync.exec({ op: 'upsert', t, rows }); },
  update(t, id, patch) { return Sync.exec({ op: 'update', t, id, patch }); },
  remove(t, id) { return Sync.exec({ op: 'delete', t, id }); },
  async clearBiz(bizId) { needOnline(); await Sync.flush(); return Cloud.clearBiz(bizId); },
  async removeBiz(bizId) { needOnline(); await Sync.flush(); await Cloud.removeBiz(bizId); await IDB.del(Snap.k(bizId)); }
};
function needOnline(what) { if (isOffline() || S.offline || !S.sb) throw new Error((what || 'Fitur ini') + ' membutuhkan koneksi internet.'); if (Sync.q.length) throw new Error('Tunggu sampai semua perubahan tersinkron dulu, lalu coba lagi.'); }

/* info sinkronisasi */
function syncInfo() {
  const st = Sync.state(), last = LS.get('bk_last_sync', 0), byT = {};
  Sync.q.forEach(o => { const n = o.op === 'upsert' ? o.rows.length : 1; byT[o.t] = (byT[o.t] || 0) + n; });
  const TN = { transactions: 'Transaksi', products: 'Produk', stock_moves: 'Riwayat stok', debts: 'Hutang/piutang', contacts: 'Kontak', categories: 'Kategori', accounts: 'Akun', production_logs: 'Catatan harian', budgets: 'Anggaran', businesses: 'Pengaturan usaha' };
  modal('Sinkronisasi Data', `<div class="alert-item ${st === 'ok' ? 'lv-info' : st === 'offline' ? 'lv-warn' : 'lv-warn'}" style="cursor:default"><div class="ai">${st === 'ok' ? '☁️' : st === 'offline' ? '📴' : '⏳'}</div><div><b>${st === 'ok' ? 'Semua data tersimpan di server' : st === 'offline' ? 'Sedang offline' : 'Ada perubahan menunggu dikirim'}</b><small>${st === 'offline' ? 'Tetap catat seperti biasa. Perubahan disimpan aman di perangkat ini dan otomatis dikirim saat internet kembali.' : st === 'ok' ? 'Aplikasi juga menyimpan salinan di perangkat ini, jadi tetap bisa dibuka & dipakai saat offline.' : 'Perubahan akan dikirim otomatis. Anda juga bisa menekan Sinkronkan sekarang.'}</small></div></div>
    ${Sync.q.length ? `<h4 style="margin:12px 0 6px">Antrean (${Sync.q.length})</h4>${Object.entries(byT).map(([t, n]) => `<div class="row between small" style="padding:4px 0"><span>${TN[t] || t}</span><b>${n}</b></div>`).join('')}` : ''}
    ${Sync.failed.length ? `<h4 style="margin:12px 0 6px;color:var(--out)">Gagal disimpan server (${Sync.failed.length})</h4>${Sync.failed.slice(-5).map(f => `<div class="xs muted">${TN[f.t] || f.t}: ${esc(f.err)}</div>`).join('')}<button class="btn sm mt" onclick="Sync.failed=[];Sync.save();closeModal();toast('Daftar dibersihkan')">Bersihkan daftar</button>` : ''}
    ${Sync.needLogin ? `<div class="alert-item lv-danger" style="cursor:default"><div class="ai">🔑</div><div><b>Perlu masuk lagi</b><small>Sesi login sudah berakhir. Masuk lagi untuk mengirim antrean — data di perangkat tetap aman.</small><div><button class="btn sm primary mt" onclick="closeModal();showAuth('login')">Masuk</button></div></div></div>` : ''}
    ${S.mode === 'cloud' && !S.sb ? '<p class="xs muted">Muat ulang aplikasi saat online untuk mulai menyinkronkan.</p>' : ''}
    <p class="xs muted">Sinkron terakhir: ${last ? new Date(last).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p>`,
    { foot: `<button class="btn" onclick="closeModal()">Tutup</button><button class="btn primary" onclick="closeModal();Sync.flush(true).then(()=>Sync.refresh(true))">${ic('refresh')} Sinkronkan sekarang</button>` });
}

window.addEventListener('online', () => { S.offline = false; Sync.ui(); toast('✅ Kembali online — menyinkronkan data…'); Sync.flush().then(() => Sync.refresh()); });
window.addEventListener('offline', () => { Sync.ui(); if (S.mode === 'cloud') toast('📴 Offline — tetap bisa mencatat, data akan dikirim saat online'); else toast('📴 Offline'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.mode === 'cloud') { if (S.offline) Sync.reconnect(); else { Sync.flush(); Sync.refresh(); } } });
setInterval(() => { if (document.hidden || S.mode !== 'cloud') return; if (S.offline) Sync.reconnect(); else if (Sync.q.length) Sync.flush(); else Sync.refresh(); }, 60000);

/* jalankan */
boot();
