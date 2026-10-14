/* =====================================================================
   PENGATURAN, DAFTAR PILIHAN, USAHA & BUKU, KEAMANAN (PIN & PRIVASI)
   ===================================================================== */
const bizTypeLabel = b => (b && b.settings && b.settings.typeLabel) || (TEMPLATES[b && b.type] || TEMPLATES.umum).label;
const secBadge = () => `<div class="sec-badge ${S.mode === 'cloud' ? '' : 'local'}" title="${S.mode === 'cloud' ? 'Koneksi HTTPS terenkripsi; data dilindungi Row Level Security (hanya akun Anda yang bisa membaca)' : 'Data hanya tersimpan di browser perangkat ini'}">${ic('shield')}<span>${S.mode === 'cloud' ? 'Tersinkron & terenkripsi' : 'Tersimpan di perangkat ini'}</span>${Lock.enabled() ? ic('lock') : ''}</div>`;
function cacheBizSummary() { if (!S.biz) return; const mr = monthRange(0); LS.set('bk_sum_' + S.biz.id, { bal: totalBalance(), profit: totals(mr.from, mr.to).profit, at: Date.now() }); }
window.addEventListener('scroll', () => { const t = $('.topbar'); if (t) t.classList.toggle('scrolled', window.scrollY > 8); }, { passive: true });

/* ---------------- DAFTAR PILIHAN (bisa ditambah / diubah / dihapus) ---------------- */
const DEFAULT_LISTS = {
  units: ['pcs', 'kg', 'gram', 'liter', 'butir', 'ikat', 'pack', 'dus', 'karung', 'sak', 'peti', 'porsi', 'ekor', 'botol', 'jasa'],
  groups: [],
  ctypes: ['pelanggan', 'supplier', 'lainnya'],
  reasons: ['Stock opname', 'Barang rusak / busuk', 'Susut', 'Hilang', 'Dipakai sendiri', 'Koreksi salah input']
};
const LIST_META = { units: ['Satuan produk', '⚖️', 'satuan'], groups: ['Kelompok produk', '🗂️', 'kelompok'], ctypes: ['Jenis kontak', '👥', 'jenis kontak'], reasons: ['Alasan sesuaikan stok', '📝', 'alasan'] };
function listGet(k) { const l = ((S.biz && S.biz.settings.lists) || {})[k]; return Array.isArray(l) ? l : [...DEFAULT_LISTS[k]]; }
function listItems(k) { return k === 'groups' ? [...new Set([...listGet('groups'), ...S.d.products.map(p => p.group_name).filter(Boolean)])] : listGet(k); }
async function listSave(k, arr) { S.biz.settings.lists = { ...(S.biz.settings.lists || {}), [k]: arr }; await updBiz({ settings: S.biz.settings }); }
function listUsage(k, v) { return k === 'units' ? S.d.products.filter(p => p.unit === v).length : k === 'groups' ? S.d.products.filter(p => p.group_name === v).length : k === 'ctypes' ? S.d.contacts.filter(c => c.type === v).length : 0; }
const LIST_FIELD = { units: ['products', 'unit'], groups: ['products', 'group_name'], ctypes: ['contacts', 'type'] };
async function listAdd(k, v) { v = String(v || '').trim(); if (!v) return; const l = listItems(k); if (l.some(x => x.toLowerCase() === v.toLowerCase())) return toast('"' + v + '" sudah ada', true); await safe(() => listSave(k, [...l, v]), 'Ditambahkan'); render(); }
function listEdit(k, i) {
  const l = listItems(k), old = l[i];
  modal('Ubah ' + LIST_META[k][2], `<form id="lef"><label class="f"><span>Nama</span><input class="inp" name="v" value="${esc(old)}" required autofocus maxlength="40"></label>${listUsage(k, old) ? `<p class="xs muted">${listUsage(k, old)} data yang memakai "${esc(old)}" akan ikut diperbarui.</p>` : ''}</form>`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="lefs">Simpan</button>`, onMount: m => m.querySelector('#lefs').onclick = async () => {
      const v = formObj($('#lef')).v.trim(); if (!v || v === old) return closeModal();
      if (l.some((x, j) => j !== i && x.toLowerCase() === v.toLowerCase())) return toast('Nama sudah dipakai', true);
      const nl = [...l]; nl[i] = v;
      await safe(async () => { const fd = LIST_FIELD[k]; if (fd) for (const r of S.d[fd[0]].filter(r => r[fd[1]] === old)) await upd(fd[0], r.id, { [fd[1]]: v }); await listSave(k, nl); }, 'Diperbarui');
      closeModal(); render(); } });
}
function listDel(k, i) {
  const l = listItems(k), v = l[i], n = listUsage(k, v);
  confirmBox(`Hapus <b>${esc(v)}</b> dari daftar ${LIST_META[k][0].toLowerCase()}?` + (n ? (k === 'groups' ? ` <b>${n} produk</b> akan menjadi tanpa kelompok.` : ` ${n} data yang sudah memakainya tidak berubah.`) : ''), async () => {
    await safe(async () => { if (k === 'groups') for (const p of S.d.products.filter(p => p.group_name === v)) await upd('products', p.id, { group_name: null }); await listSave(k, l.filter((_, j) => j !== i)); }, 'Dihapus');
    render(); });
}
async function listReset(k) { confirmBox('Kembalikan daftar ' + LIST_META[k][0].toLowerCase() + ' ke bawaan?', async () => { await safe(() => listSave(k, [...DEFAULT_LISTS[k]]), 'Daftar dikembalikan'); render(); }, 'Kembalikan'); }

/* ---------------- KUNCI PIN ---------------- */
const Lock = {
  buf: '', mode: 'unlock', tmp: null, onDone: null, fails: 0, until: 0,
  enabled() { return !!LS.get('bk_pin', null); },
  async hash(p) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bukukas-pin:' + p)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); },
  check(boot) { if (boot && this.enabled() && !this._ok) this.show(); },
  show(mode = 'unlock', onDone) { if (mode === 'unlock' && !this.enabled()) return; this.mode = mode; this.buf = ''; this.tmp = null; this.onDone = onDone || null; this.render(); $('#lock').classList.add('on'); },
  hide() { $('#lock').classList.remove('on'); $('#lock').innerHTML = ''; },
  title() { return { unlock: 'Masukkan PIN', set: 'Buat PIN baru (4 digit)', confirm: 'Ulangi PIN baru', verify: 'Masukkan PIN saat ini' }[this.mode]; },
  render() {
    $('#lock').innerHTML = `<div class="lock-card glass" role="dialog" aria-label="Kunci aplikasi"><div class="brand-logo" style="margin:0 auto 12px">${ic('lock')}</div><h3 style="margin:0">${this.title()}</h3><p class="xs muted" style="margin:6px 0 0">${S.biz ? esc(S.biz.name) + ' • ' : ''}${CONFIG.APP_NAME}</p>
      <div class="pin-dots" id="pinDots">${[0, 1, 2, 3].map(i => `<i class="${i < this.buf.length ? 'f' : ''}"></i>`).join('')}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" onclick="Lock.key('${n}')">${n}</button>`).join('')}<button type="button" style="font-size:13px" onclick="${this.mode === 'unlock' ? 'Lock.forgot()' : 'Lock.hide()'}">${this.mode === 'unlock' ? 'Lupa?' : 'Batal'}</button><button type="button" onclick="Lock.key('0')">0</button><button type="button" onclick="Lock.key('del')" aria-label="Hapus">⌫</button></div>
      <div class="xs muted" id="pinMsg" style="min-height:18px;margin:14px 0 0"></div></div>`;
  },
  dots() { $$('#pinDots i').forEach((d, i) => d.classList.toggle('f', i < this.buf.length)); },
  key(k) { if (Date.now() < this.until) return; if (k === 'del') { this.buf = this.buf.slice(0, -1); return this.dots(); } if (this.buf.length >= 4) return; this.buf += k; this.dots(); if (this.buf.length === 4) setTimeout(() => this.submit(), 140); },
  err(msg) { const d = $('#pinDots'); if (d) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); } $('#pinMsg').textContent = msg; this.buf = ''; this.dots(); if (navigator.vibrate) navigator.vibrate(90); },
  async submit() {
    const p = this.buf;
    if (this.mode === 'unlock' || this.mode === 'verify') {
      if (await this.hash(p) === LS.get('bk_pin')) { this.fails = 0; this._ok = true; const cb = this.onDone; this.hide(); cb && cb(); }
      else { this.fails++; if (this.fails >= 5) { this.until = Date.now() + 30000; this.fails = 0; this.err('Terlalu banyak salah. Coba lagi dalam 30 detik.'); } else this.err('PIN salah — ' + (5 - this.fails) + ' kesempatan lagi'); }
    } else if (this.mode === 'set') { this.tmp = p; this.mode = 'confirm'; this.buf = ''; this.render(); }
    else if (this.mode === 'confirm') {
      if (p === this.tmp) { LS.set('bk_pin', await this.hash(p)); this._ok = true; this.hide(); toast('PIN aktif 🔒 aplikasi akan terkunci otomatis'); shell(); render(); }
      else { this.mode = 'set'; this.render(); this.err('PIN tidak sama, silakan ulangi'); }
    }
  },
  forgot() {
    const m = $('#pinMsg');
    if (S.mode !== 'cloud') { m.innerHTML = 'Mode lokal: PIN tidak bisa direset tanpa menghapus data browser.'; return; }
    m.innerHTML = `Untuk reset PIN, keluar lalu login ulang.<br><button class="btn sm danger" style="margin-top:8px" onclick="Lock.reset()">Keluar & reset PIN</button>`;
  },
  async reset() { LS.del('bk_pin'); try { await S.sb.auth.signOut(); } catch (e) {} location.reload(); }
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { LS.set('bk_hidden_at', Date.now()); return; }
  if (!Lock.enabled() || !S.biz || $('#lock').classList.contains('on')) return;
  const mins = Number(LS.get('bk_lock_after', 1)); if (mins < 0) return;
  if (Date.now() - LS.get('bk_hidden_at', Date.now()) >= mins * 60000) { Lock._ok = false; Lock.show(); }
});
function pinAction(a) {
  if (a === 'on') Lock.show('set');
  else if (a === 'change') Lock.show('verify', () => Lock.show('set'));
  else if (a === 'off') Lock.show('verify', () => { LS.del('bk_pin'); toast('PIN dimatikan'); shell(); render(); });
}

/* ---------------- USAHA & BUKU SAYA ---------------- */
PAGES.usaha = {
  html() {
    return `<div class="toolbar"><div class="grow"><b style="font-size:16px">${S.businesses.length} usaha / buku pembukuan</b><div class="xs muted">Setiap usaha punya kas, kategori, stok, hutang & laporan yang terpisah. Pindah usaha kapan saja.</div></div>
      <button class="btn primary" onclick="WZ.type='warung';showWizard(true)">${ic('plus')} Buat Usaha / Buku Baru</button></div>
    <div class="grid g3">${S.businesses.map(bizCard).join('')}</div>
    <div class="card mt"><div class="card-h"><h3>💡 Tips</h3></div><div class="small muted">Gunakan <b>Duplikat struktur</b> untuk membuat buku baru dengan kategori, akun, produk & kontak yang sama — misalnya buku per tahun, per cabang, atau per kandang — tanpa membawa transaksi lama.</div></div>`;
  }
};
function bizCard(b) {
  const T = TEMPLATES[b.type] || TEMPLATES.umum, s = LS.get('bk_sum_' + b.id, null), act = b.id === S.biz.id;
  return `<div class="card biz-card ${act ? 'active' : ''}"><div class="top"><div class="e">${esc((b.settings && b.settings.emoji) || T.emoji)}</div><div class="grow" style="min-width:0"><b class="ell" style="display:block;font-size:16px">${esc(b.name)}</b><span class="xs muted">${esc(bizTypeLabel(b))}</span></div>${act ? '<span class="pill in">Aktif</span>' : ''}</div>
    ${s ? `<div class="grid g2" style="gap:10px"><div><div class="xs muted">Saldo</div><b class="num">${money(s.bal)}</b></div><div><div class="xs muted">Laba bulan ini</div><b class="num ${s.profit < 0 ? 'c-out' : 'c-in'}">${money(s.profit)}</b></div></div><div class="xs muted">Diperbarui ${new Date(s.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div>` : '<div class="xs muted">Buka usaha ini untuk melihat ringkasannya.</div>'}
    <div class="row wrap">${act ? `<button class="btn sm" onclick="go('dashboard')">${ic('home')} Beranda</button>` : `<button class="btn sm primary" onclick="openBiz(S.businesses.find(x=>x.id==='${b.id}'))">Buka</button>`}<button class="btn sm" onclick="bizEdit('${b.id}')">${ic('edit')} Ubah</button><button class="btn sm" onclick="bizDuplicate('${b.id}')">${ic('copy')} Duplikat</button><button class="btn sm danger" title="Hapus usaha" onclick="deleteBiz('${b.id}')">${ic('trash')}</button></div></div>`;
}
function bizEdit(id) {
  const b = S.businesses.find(x => x.id === id), st = b.settings || {};
  modal('Ubah Usaha', `<form id="bef"><div class="f-row" style="grid-template-columns:80px 1fr"><label class="f"><span>Ikon</span><input class="inp" name="emoji" value="${esc(st.emoji || '')}" maxlength="4" style="text-align:center;font-size:20px"></label><label class="f"><span>Nama usaha / buku</span><input class="inp" name="name" value="${esc(b.name)}" required></label></div>
    <div class="f-row"><label class="f"><span>Template jenis usaha</span><select class="inp" name="type">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}" ${b.type === k ? 'selected' : ''}>${t.emoji} ${t.label}</option>`).join('')}</select></label>
    <label class="f"><span>Nama jenis usaha (bebas)</span><input class="inp" name="type_label" value="${esc(st.typeLabel || '')}" placeholder="cth: Ternak Bebek, Toko Bangunan"></label></div></form>`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="befs">Simpan</button>`, onMount: m => m.querySelector('#befs').onclick = async () => {
      const f = formObj($('#bef')); if (!f.name.trim()) return toast('Nama wajib diisi', true);
      const settings = { ...st, emoji: f.emoji.trim() || (TEMPLATES[f.type] || TEMPLATES.umum).emoji, typeLabel: f.type_label.trim() };
      const patch = { name: f.name.trim(), type: f.type, settings };
      const ok = await safe(async () => { if (id === S.biz.id) await updBiz(patch); else { await B().update('businesses', id, patch); Object.assign(b, patch); } return true; }, 'Usaha diperbarui');
      if (ok) { const sb = S.businesses.find(x => x.id === id); if (sb && sb !== S.biz && id === S.biz.id) Object.assign(sb, S.biz); closeModal(); shell(); render(); } } });
}
async function bizDuplicate(id) {
  const src = S.businesses.find(x => x.id === id);
  modal('Duplikat Struktur Usaha', `<form id="bdf"><p class="small muted" style="margin-top:0">Membuat buku baru dari <b>${esc(src.name)}</b>: kategori, akun (saldo awal 0), produk (stok 0), kontak, daftar pilihan & pengaturan ikut disalin. Transaksi tidak disalin.</p>
    <label class="f"><span>Nama usaha / buku baru</span><input class="inp" name="name" value="${esc(src.name)} ${new Date().getFullYear() + 1}" required autofocus></label></form>`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="bdfs">${ic('copy')} Buat</button>`, onMount: m => m.querySelector('#bdfs').onclick = async () => {
      const name = formObj($('#bdf')).name.trim(); if (!name) return; const btn = $('#bdfs'); busy(btn, true);
      const ok = await safe(async () => {
        const data = id === S.biz.id ? S.d : await B().load(id);
        const nb = { id: uid(), name, type: src.type, currency: 'IDR', created_at: new Date().toISOString(), settings: JSON.parse(JSON.stringify({ ...src.settings, sale_cat: null })) };
        const res = await B().insert('businesses', [nb]); const saved = normalizeBiz((res && res[0]) || nb); S.businesses.push(saved);
        const map = {};
        const copy = (rows, extra) => rows.map(r => { const o = { ...r, ...extra }; delete o.user_id; map[r.id] = o.id = uid(); o.business_id = saved.id; o.created_at = new Date().toISOString(); return o; });
        await B().insert('accounts', copy(data.accounts, { opening_balance: 0 }));
        await B().insert('categories', copy(data.categories, {}));
        await B().insert('products', copy(data.products, { stock: 0 }));
        await B().insert('contacts', copy(data.contacts, {}));
        await B().insert('budgets', copy(data.budgets, {}).map(b => ({ ...b, category_id: map[b.category_id] || null })).filter(b => b.category_id));
        closeModal(); await openBiz(saved); return true;
      }, 'Buku "' + name + '" siap dipakai 🎉');
      if (!ok) busy(btn, false); } });
}

/* ---------------- HALAMAN PENGATURAN ---------------- */
S.catTab = 'out';
PAGES.pengaturan = {
  html() {
    const b = S.biz, st = b.settings, m = mods(), ns = notifSet(), th = LS.get('bk_theme', 'auto'), ac = LS.get('bk_accent', 'blue');
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const sw = (name, on, fn) => `<label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="${fn}('${name}',this.checked)"><i></i></label>`;
    const rowBtns = (edit, del) => `<div class="acts"><button class="icon-btn" title="Ubah" onclick="${edit}">${ic('edit')}</button><button class="icon-btn" title="Hapus" style="color:var(--out)" onclick="${del}">${ic('trash')}</button></div>`;
    const catCount = id => S.d.transactions.filter(t => t.category_id === id).length;
    return `<div class="grid g2" style="align-items:start">
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h3>🏪 Profil Usaha</h3><button class="btn sm" onclick="go('usaha')">${ic('store')} Semua usaha</button></div><form id="bizF" onsubmit="event.preventDefault();saveBiz()">
        <div class="f-row" style="grid-template-columns:80px 1fr"><label class="f"><span>Ikon</span><input class="inp" name="emoji" value="${esc(st.emoji || '')}" maxlength="4" style="text-align:center;font-size:20px"></label><label class="f"><span>Nama usaha</span><input class="inp" name="name" value="${esc(b.name)}" required></label></div>
        <div class="f-row"><label class="f"><span>Template jenis usaha</span><select class="inp" name="type">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}" ${b.type === k ? 'selected' : ''}>${t.emoji} ${t.label}</option>`).join('')}</select></label>
          <label class="f"><span>Nama jenis usaha (bebas)</span><input class="inp" name="type_label" value="${esc(st.typeLabel || '')}" placeholder="cth: Ternak Bebek"></label></div>
        <div class="f-row"><label class="f"><span>Zona waktu</span><select class="inp" name="tz">${Object.entries(TIMEZONES).map(([k, v]) => `<option value="${k}" ${(st.tz || 'Asia/Jakarta') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="f"><span>Target omzet / bulan</span>${moneyInput('target', st.target)}</label></div>
        <div class="f-row"><label class="f"><span>No HP usaha</span><input class="inp" name="phone" value="${esc(b.phone || '')}"></label><label class="f"><span>Alamat (tampil di struk)</span><input class="inp" name="address" value="${esc(b.address || '')}"></label></div>
        <button class="btn primary">${ic('check')} Simpan Profil</button></form></div>

      <div class="card"><div class="card-h"><h3>🧩 Fitur yang Ditampilkan</h3></div>${Object.entries(MODULES).map(([k, [l, d]]) => `<div class="set-row"><div class="t grow"><b>${l}</b><small>${d}</small></div>${sw(k, m[k], 'setMod')}</div>`).join('')}</div>

      <div class="card" id="set-sec"><div class="card-h"><h3>🛡️ Keamanan & Privasi</h3></div>
        ${secBadge()}
        <p class="xs muted" style="margin:10px 0 4px">${S.mode === 'cloud' ? 'Data dikirim lewat koneksi HTTPS terenkripsi dan dilindungi Row Level Security di Supabase — hanya akun Anda yang bisa membaca & mengubah data usaha ini.' : 'Mode lokal: data hanya ada di browser perangkat ini. Lakukan backup rutin.'}</p>
        <div class="set-row"><div class="t grow"><b>Kunci aplikasi dengan PIN</b><small>${Lock.enabled() ? 'Aktif di perangkat ini 🔒' : 'Minta PIN 4 digit setiap aplikasi dibuka'}</small></div>${Lock.enabled() ? `<div class="row gap-s"><button class="btn sm" onclick="pinAction('change')">Ubah</button><button class="btn sm danger" onclick="pinAction('off')">Matikan</button></div>` : `<button class="btn sm primary" onclick="pinAction('on')">${ic('lock')} Aktifkan</button>`}</div>
        ${Lock.enabled() ? `<div class="set-row"><div class="t grow"><b>Kunci otomatis</b><small>Saat aplikasi ditinggalkan / di-minimize</small></div><select class="inp" style="width:auto" onchange="LS.set('bk_lock_after',Number(this.value));toast('Disimpan')">${[[0, 'Langsung'], [1, '1 menit'], [5, '5 menit'], [15, '15 menit'], [-1, 'Hanya saat dibuka']].map(([v, l]) => `<option value="${v}" ${Number(LS.get('bk_lock_after', 1)) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
        <div class="set-row"><div class="t grow"><b>Sembunyikan nominal</b><small>Saldo & angka diburamkan (tombol 👁 di atas)</small></div><label class="switch"><input type="checkbox" ${LS.get('bk_privacy', false) ? 'checked' : ''} onchange="togglePrivacy()"><i></i></label></div>
        ${S.mode === 'cloud' ? `<div class="set-row"><div class="t grow"><b>Keluar dari semua perangkat</b><small>Akhiri semua sesi login akun ini</small></div><button class="btn sm danger" onclick="logout(true)">${ic('logout')} Keluar semua</button></div>` : ''}</div>

      <div class="card" id="set-notif"><div class="card-h"><h3>🔔 Notifikasi & Pengingat</h3></div>
        <div class="set-row"><div class="t grow"><b>Notifikasi perangkat (pop-up HP/PC)</b><small>${perm === 'granted' ? 'Izin diberikan ✅' : perm === 'denied' ? 'Diblokir — buka pengaturan browser/HP untuk mengizinkan' : perm === 'unsupported' ? 'Tidak didukung browser ini — install aplikasi dulu' : 'Belum diizinkan'}</small></div>${ns.push && perm === 'granted' ? sw('push', true, 'setNotif') : `<button class="btn sm primary" onclick="enablePush()">Aktifkan</button>`}</div>
        <p class="xs muted" style="margin:10px 0 2px">Pilih pemberitahuan yang ingin ditampilkan:</p>
        ${[['stok', 'Stok menipis / habis', 'Saat stok ≤ batas minimum produk'], ['piutang', 'Piutang jatuh tempo', 'Tagihan pelanggan mendekati / lewat tempo'], ['hutang', 'Hutang jatuh tempo', 'Kewajiban bayar mendekati / lewat tempo'], ['anggaran', 'Anggaran hampir habis', 'Pengeluaran kategori ≥ 80% batas'], ['target', 'Target omzet tercapai', 'Kabar gembira saat target bulanan tercapai'], ['catat', 'Pengingat catat transaksi', 'Jika belum ada transaksi hari ini'], ['harian', 'Pengingat catatan harian', 'Jika data produksi hari ini belum diisi'], ['ringkasan', 'Ringkasan harian', 'Total masuk & keluar setiap hari']].map(([k, l, d]) => `<div class="set-row"><div class="t grow"><b>${l}</b><small>${d}</small></div>${sw(k, ns[k], 'setNotif')}</div>`).join('')}
        <div class="f-row mt"><label class="f"><span>Jam pengingat harian</span><input class="inp" type="time" value="${ns.jam}" onchange="setNotif('jam',this.value)"></label><label class="f"><span>Ingatkan jatuh tempo (hari sebelum)</span><input class="inp" type="number" min="0" max="30" value="${ns.hari_jatuh_tempo}" onchange="setNotif('hari_jatuh_tempo',Number(this.value))"></label></div>
        <button class="btn sm" onclick="testNotif()">🔔 Kirim notifikasi uji</button>
        <p class="xs muted">${serverPush() ? '☁️ Push server aktif: pengingat dikirim dari server setiap 15 menit dan tetap muncul walau aplikasi ditutup.' : S.mode === 'cloud' ? 'Setelah diaktifkan, pengingat dikirim dari server dan tetap muncul walau aplikasi ditutup.' : 'Mode lokal: notifikasi diperiksa saat aplikasi dibuka & setiap 5 menit selama aplikasi berjalan.'}</p></div>
    </div>

    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h3>🎨 Tampilan</h3></div>
        <p class="xs muted" style="margin:0 0 8px">Warna tema</p>
        <div class="swatches mb">${[['blue', 'Biru Profesional', 'linear-gradient(135deg,#1e3a8a,#1d4ed8 50%,#0ea5e9)'], ['green', 'Hijau Emerald', 'linear-gradient(135deg,#064e3b,#047857 50%,#14b8a6)'], ['gold', 'Dark Mewah', 'linear-gradient(135deg,#0c0a08,#2b2218 45%,#b8860b)']].map(([k, l, g]) => `<button class="swatch ${ac === k ? 'on' : ''}" style="background:${g}" onclick="setAccent('${k}')${k === 'gold' && th !== 'dark' ? ";setTheme('dark')" : ''}">${ac === k ? '✓ ' : ''}${l}</button>`).join('')}</div>
        <p class="xs muted" style="margin:0 0 8px">Mode</p>
        <div class="seg">${[['auto', '🌗 Otomatis'], ['light', '☀️ Terang'], ['dark', '🌙 Gelap']].map(([k, l]) => `<button class="${th === k ? 'on' : ''}" onclick="setTheme('${k}')">${l}</button>`).join('')}</div>
        <button class="btn block install-btn ${isStandalone() ? 'hidden' : ''}" onclick="installApp()">${ic('install')} Install aplikasi ke perangkat ini</button></div>

      <div class="card"><div class="card-h"><h3>💳 Akun Kas, Bank & E-Wallet</h3><button class="btn sm primary" onclick="accountForm()">${ic('plus')} Akun</button></div>
        ${S.d.accounts.map(a => `<div class="opt-row"><div class="av" style="width:38px;height:38px;font-size:16px">${a.type === 'kas' ? '💵' : a.type === 'bank' ? '🏦' : '📱'}</div><div class="grow" style="min-width:0"><b class="ell" style="display:block;font-size:14px">${esc(a.name)}</b><span class="xs muted">Saldo <span class="num">${money(accBalance(a))}</span></span></div>${rowBtns(`accountForm('${a.id}')`, `deleteAccount('${a.id}')`)}</div>`).join('')}</div>

      <div class="card"><div class="card-h"><h3>🏷️ Kategori</h3><button class="btn sm primary" onclick="catForm(null,S.catTab)">${ic('plus')} Kategori</button></div>
        <div class="seg"><button class="${S.catTab === 'in' ? 'on in' : ''}" onclick="S.catTab='in';render()">⬆ Pemasukan (${cats('in').length})</button><button class="${S.catTab === 'out' ? 'on out' : ''}" onclick="S.catTab='out';render()">⬇ Pengeluaran (${cats('out').length})</button></div>
        ${cats(S.catTab).map(c => `<div class="opt-row"><span class="av" style="width:38px;height:38px;font-size:17px;background:${c.color || '#888'}26">${esc(c.icon || '🏷️')}</span><div class="grow" style="min-width:0"><b class="ell" style="display:block;font-size:14px">${esc(c.name)}</b><span class="xs muted">${catCount(c.id)} transaksi</span></div>${rowBtns(`catForm('${c.id}')`, `deleteCat('${c.id}')`)}</div>`).join('') || '<p class="muted small">Belum ada kategori.</p>'}</div>

      ${listsCard()}

      <div class="card"><div class="card-h"><h3>📋 Kolom Catatan Harian</h3><button class="btn sm primary" onclick="metricForm()">${ic('plus')} Kolom</button></div>
        ${metrics().length ? metrics().map((x, i) => `<div class="opt-row"><span class="av" style="width:38px;height:38px;font-size:16px">📈</span><div class="grow" style="min-width:0"><b class="ell" style="display:block;font-size:14px">${esc(x.label)}</b><span class="xs muted">${esc(x.unit)} • ${x.agg === 'last' ? 'nilai terakhir' : x.agg === 'avg' ? 'rata-rata' : 'dijumlahkan'}</span></div>${rowBtns(`metricForm(${i})`, `delMetric(${i})`)}</div>`).join('') : '<p class="muted small">Belum ada. Contoh: produksi telur, pakan, panen, porsi terjual.</p>'}</div>

      <div class="card"><div class="card-h"><h3>🗄️ Data & Akun</h3></div>
        <div class="row wrap"><button class="btn sm" onclick="backup()">${ic('download')} Backup (JSON)</button><label class="btn sm">${ic('upload')} Pulihkan<input type="file" accept=".json,application/json" hidden onchange="restore(this.files[0])"></label><button class="btn sm" onclick="exportCSV(S.d.transactions.slice().sort(sortTx),'semua-transaksi')">${ic('download')} Semua transaksi (CSV)</button></div>
        ${S.mode === 'local' ? `<div class="set-row mt"><div class="t grow"><b>📱 Mode Lokal</b><small>Data hanya ada di perangkat ini</small></div><button class="btn sm" onclick="LS.del('bk_mode');location.reload()">Hubungkan Cloud</button></div>` : `<div class="set-row mt"><div class="t grow"><b>Akun</b><small>${esc(S.user && S.user.email)}</small></div><button class="btn sm" onclick="logout()">${ic('logout')} Keluar</button></div>`}
        <div class="alert-item lv-danger mt" style="cursor:default;flex-direction:column"><b>Zona berbahaya</b><small>Tindakan di bawah tidak bisa dibatalkan.</small><div class="row wrap" style="margin-top:8px"><button class="btn sm danger" onclick="clearData()">Kosongkan data transaksi</button><button class="btn sm danger solid" onclick="deleteBiz()">${ic('trash')} Hapus usaha ini</button></div></div></div>
    </div></div>`;
  }
};
function listsCard() {
  const k = S.setTab || 'units', items = listItems(k), [label, e, word] = LIST_META[k];
  return `<div class="card" id="set-lists"><div class="card-h"><h3>📝 Daftar Pilihan</h3><button class="btn sm ghost" onclick="listReset('${k}')">Kembalikan bawaan</button></div>
    <div class="chips mb">${Object.entries(LIST_META).map(([key, [l, em]]) => `<button class="chip ${k === key ? 'on' : ''}" onclick="S.setTab='${key}';render();setTimeout(()=>{const x=document.getElementById('set-lists');x&&x.scrollIntoView({block:'nearest'})},60)">${em} ${l}</button>`).join('')}</div>
    <form class="row mb" onsubmit="event.preventDefault();listAdd('${k}',this.v.value)"><input class="inp" name="v" placeholder="Tambah ${word} baru…" maxlength="40"><button class="btn primary" aria-label="Tambah">${ic('plus')}</button></form>
    ${items.length ? items.map((v, i) => { const n = listUsage(k, v); return `<div class="opt-row"><span class="grow ell" style="font-weight:600">${esc(v)}</span>${n ? `<span class="pill neutral">${n} dipakai</span>` : ''}<div class="acts"><button class="icon-btn" title="Ubah" onclick="listEdit('${k}',${i})">${ic('edit')}</button><button class="icon-btn" title="Hapus" style="color:var(--out)" onclick="listDel('${k}',${i})">${ic('trash')}</button></div></div>`; }).join('') : `<p class="muted small">Belum ada ${word}.</p>`}</div>`;
}

/* jalankan */
boot();
