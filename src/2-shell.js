/* =====================================================================
   BOOT, LOGIN, WIZARD USAHA, KERANGKA APLIKASI
   ===================================================================== */
function getCfg() { if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) return { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_ANON_KEY, fixed: true }; return LS.get('bk_cfg', {}); }
function screen(html) { $('#app').classList.add('hidden'); const s = $('#screen'); s.classList.remove('hidden'); s.innerHTML = html; }
const brandHTML = (sub = 'Pembukuan usaha modern & praktis') => `<div class="brand"><div class="brand-logo">B</div><div><h1>${CONFIG.APP_NAME}</h1><p>${sub}</p></div></div>`;

async function boot() {
  applyTheme(); registerSW();
  const qp = new URLSearchParams(location.search); if (qp.get('page')) S.page = qp.get('page');
  const mode = LS.get('bk_mode', null), cfg = getCfg();
  if (mode === 'local') { S.mode = 'local'; return afterAuth(); }
  if (cfg.url && cfg.key) {
    if (!window.supabase && LS.get('bk_last_user', null)) { S.mode = 'cloud'; S.offline = true; S.user = LS.get('bk_last_user'); return afterAuth(); }
    if (!window.supabase) { screen(`<div class="auth-card">${brandHTML()}<p>Tidak bisa memuat pustaka Supabase. Periksa koneksi internet lalu muat ulang.</p><button class="btn primary block" onclick="location.reload()">Muat ulang</button><button class="btn block mt" onclick="useLocal()">Pakai Mode Lokal</button></div>`); return; }
    try { S.sb = supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { fetch: fetchRetry } }); } catch (e) { LS.del('bk_cfg'); return showSetup('URL/kunci Supabase tidak valid.'); }
    S.mode = 'cloud';
    S.sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') setTimeout(() => changePass(true), 400); });
    let session = null, serr = null;
    try { const r = await S.sb.auth.getSession(); session = r.data && r.data.session; serr = r.error; } catch (e) { serr = e; }
    if (session) { S.user = session.user; return afterAuth(); }
    /* offline / sinyal putus: buka dengan data tersimpan di perangkat */
    const lu = LS.get('bk_last_user', null);
    if (lu && (isOffline() || (serr && isNetErr(serr)))) { S.user = lu; S.offline = true; return afterAuth(); }
    if (isOffline()) { screen(`<div class="auth-card">${brandHTML()}<p><b>Anda sedang offline.</b><br><span class="muted small">Masuk pertama kali membutuhkan internet. Setelah itu aplikasi bisa dipakai offline.</span></p><button class="btn primary block" onclick="location.reload()">Coba lagi</button></div>`); return; }
    return showAuth();
  }
  showSetup();
}

function showSetup(err) {
  screen(`<div class="auth-card">${brandHTML()}
    <h3 style="margin:0 0 4px">Mulai menggunakan</h3>
    <p class="muted small" style="margin:0 0 16px">Hubungkan ke database Supabase agar data tersimpan aman di cloud & bisa dibuka dari banyak perangkat.</p>
    ${err ? `<div class="pill out mb">${esc(err)}</div>` : ''}
    <form onsubmit="return saveCfg(event)">
      <label class="f"><span>Supabase Project URL</span><input class="inp" name="url" placeholder="https://xxxx.supabase.co" required></label>
      <label class="f"><span>Supabase anon / publishable key</span><input class="inp" name="key" placeholder="eyJhbGciOi..." required></label>
      <button class="btn primary block">Hubungkan Supabase</button>
    </form>
    <div class="row mt" style="gap:10px"><div style="flex:1;height:1px;background:var(--line)"></div><span class="muted xs">atau</span><div style="flex:1;height:1px;background:var(--line)"></div></div>
    <button class="btn block mt" onclick="useLocal()">📱 Pakai Mode Lokal (tanpa akun)</button>
    <p class="muted xs" style="margin-top:12px">Mode lokal menyimpan data hanya di perangkat/browser ini. Cocok untuk mencoba. Data bisa dibackup & dipindahkan kapan saja.</p></div>`);
}
function saveCfg(e) { e.preventDefault(); const f = formObj(e.target); LS.set('bk_cfg', { url: f.url.trim(), key: f.key.trim() }); LS.del('bk_mode'); location.reload(); return false; }
function useLocal() { LS.set('bk_mode', 'local'); location.reload(); }

function showAuth(tab = 'login', msg = '') {
  const cfg = getCfg();
  screen(`<div class="auth-card">${brandHTML()}
    <div class="seg"><button class="${tab === 'login' ? 'on' : ''}" onclick="showAuth('login')">Masuk</button><button class="${tab === 'reg' ? 'on' : ''}" onclick="showAuth('reg')">Daftar</button></div>
    ${msg ? `<div class="card mb" style="padding:12px;background:var(--surface-2)">${msg}</div>` : ''}
    <form onsubmit="return doAuth(event,'${tab}')">
      ${tab === 'reg' ? `<label class="f"><span>Nama lengkap</span><input class="inp" name="name" required></label>` : ''}
      <label class="f"><span>Email</span><input class="inp" type="email" name="email" autocomplete="email" required></label>
      <label class="f"><span>Kata sandi</span><input class="inp" type="password" name="pass" minlength="6" autocomplete="${tab === 'reg' ? 'new-password' : 'current-password'}" required></label>
      <button class="btn primary block" id="authBtn">${tab === 'reg' ? 'Buat Akun' : 'Masuk'}</button>
    </form>
    ${tab === 'login' ? `<button class="btn ghost block mt small" onclick="forgotPass()">Lupa kata sandi?</button>` : ''}
    <div class="secure-note">${ic('shield')}<span>Koneksi terenkripsi (HTTPS). Data usaha Anda hanya bisa diakses oleh akun Anda.</span></div>
    <div class="row between mt"><button class="btn ghost sm" onclick="useLocal()">Mode Lokal</button>${!cfg.fixed ? `<button class="btn ghost sm" onclick="LS.del('bk_cfg');location.reload()">Ganti database</button>` : ''}</div></div>`);
}
async function doAuth(e, tab) {
  e.preventDefault(); const f = formObj(e.target); const b = $('#authBtn'); busy(b, true);
  try {
    if (tab === 'reg') {
      const { data, error } = await S.sb.auth.signUp({ email: f.email, password: f.pass, options: { data: { name: f.name }, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw new Error('User already registered');
      if (!data.session) { LS.set('bk_pending_email', f.email); showAuth('login', `✅ <b>Akun dibuat.</b> Buka email <b>${esc(f.email)}</b> dan klik link konfirmasi, lalu kembali ke sini dan masuk.<br><button class="btn sm mt" onclick="resendConfirm()">Kirim ulang email konfirmasi</button>`); return false; }
      S.user = data.user;
    } else {
      const { data, error } = await S.sb.auth.signInWithPassword({ email: f.email, password: f.pass });
      if (error) throw error; S.user = data.user;
    }
    await afterAuth();
  } catch (err) { busy(b, false); const msg = humanErr(err); toast(msg, true); if (/belum dikonfirmasi/.test(msg)) { LS.set('bk_pending_email', f.email); showAuth('login', `⚠️ Email <b>${esc(f.email)}</b> belum dikonfirmasi. Cek kotak masuk / folder spam.<br><button class="btn sm mt" onclick="resendConfirm()">Kirim ulang email konfirmasi</button>`); } }
  return false;
}
function forgotPass() {
  modal('Lupa Kata Sandi', `<form id="fpf"><p class="small muted" style="margin-top:0">Masukkan email akun Anda. Kami kirimkan link untuk membuat kata sandi baru.</p><label class="f"><span>Email</span><input class="inp" type="email" name="email" required autofocus></label><button class="btn primary block" id="fpb">Kirim Link Reset</button></form>`,
    { onMount: m => m.querySelector('#fpf').onsubmit = async e => { e.preventDefault(); const email = formObj(e.target).email.trim(); if (!email) return; const b = $('#fpb'); busy(b, true);
      const { error } = await S.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); busy(b, false);
      if (error) return toast(error.message, true); closeModal(); toast('Link reset kata sandi dikirim ke ' + email); } });
}
async function resendConfirm() {
  const email = LS.get('bk_pending_email', ''); if (!email) return toast('Isi email lalu tekan Daftar lagi', true);
  const { error } = await S.sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + location.pathname } });
  toast(error ? humanErr(error) : 'Email konfirmasi dikirim ulang ke ' + email, !!error);
}
function changePass(recovery) {
  modal(recovery ? 'Buat Kata Sandi Baru' : 'Ubah Kata Sandi', `<form id="cpf">${recovery ? '<p class="small muted" style="margin-top:0">Silakan buat kata sandi baru untuk akun Anda.</p>' : ''}<label class="f"><span>Kata sandi baru</span><input class="inp" type="password" name="p1" minlength="6" autocomplete="new-password" required autofocus></label><label class="f"><span>Ulangi kata sandi baru</span><input class="inp" type="password" name="p2" minlength="6" autocomplete="new-password" required></label><button class="btn primary block" id="cpb">Simpan Kata Sandi</button></form>`,
    { onMount: m => m.querySelector('#cpf').onsubmit = async e => { e.preventDefault(); const f = formObj(e.target);
      if (f.p1.length < 6) return toast('Minimal 6 karakter', true); if (f.p1 !== f.p2) return toast('Kata sandi tidak sama', true);
      const b = $('#cpb'); busy(b, true); const { error } = await S.sb.auth.updateUser({ password: f.p1 }); busy(b, false);
      if (error) return toast(error.message, true); closeModal(); toast('Kata sandi berhasil diperbarui 🔐'); } });
}
async function logout(all) {
  const pend = S.mode === 'cloud' ? Sync.q.length : 0;
  if (pend && !isOffline()) { await Sync.flush(); }
  const left = S.mode === 'cloud' ? Sync.q.length : 0;
  confirmBox((all ? 'Keluar dari <b>semua perangkat</b>? Semua sesi login akun ini akan diakhiri.' : 'Keluar dari akun ini?') + (left ? `<div class="alert-item lv-danger mt" style="cursor:default"><div class="ai">⚠️</div><div><b>${left} perubahan belum tersinkron</b><small>Jika keluar sekarang, perubahan offline itu akan hilang. Sebaiknya sambungkan internet dulu.</small></div></div>` : ''), async () => {
    LS.del('bk_pin');
    if (S.mode === 'cloud') { const uid = S.user && S.user.id; LS.del('bk_last_user'); if (uid) await IDB.clearUser(uid); try { if (S.sb) await S.sb.auth.signOut(all ? { scope: 'global' } : undefined); } catch (e) {} } else LS.del('bk_mode');
    location.reload();
  }, 'Keluar');
}

async function afterAuth() {
  screen('<div class="loader"></div>');
  if (S.mode === 'cloud' && S.user) { LS.set('bk_last_user', { id: S.user.id, email: S.user.email }); await Sync.init(S.user.id); }
  try { S.businesses = (await B().listBiz()).map(normalizeBiz); }
  catch (e) { screen(`<div class="auth-card">${brandHTML()}<p><b>Gagal memuat data.</b><br><span class="muted small">${esc(humanErr(e))}</span></p><p class="small muted">${isNetErr(e) ? 'Data usaha belum pernah tersimpan di perangkat ini. Buka sekali saat online agar bisa dipakai offline.' : 'Pastikan file <b>schema.sql</b> sudah dijalankan di Supabase SQL Editor.'}</p><button class="btn primary block" onclick="location.reload()">Coba lagi</button><button class="btn block mt" onclick="S.sb.auth.signOut().then(()=>location.reload())">Keluar</button></div>`); return; }
  if (!S.businesses.length) return showWizard();
  const last = LS.get('bk_biz'); await openBiz(S.businesses.find(b => b.id === last) || S.businesses[0]);
}
async function openBiz(b) {
  S.biz = normalizeBiz(b); APP_TZ = S.biz.settings.tz || 'Asia/Jakarta'; LS.set('bk_biz', b.id); S.cart = []; screen('<div class="loader"></div>');
  try { S.d = await B().load(b.id); } catch (e) { screen(`<div class="auth-card">${brandHTML()}<p><b>Gagal memuat data usaha.</b><br><span class="muted small">${esc(humanErr(e))}</span></p><button class="btn primary block" onclick="openBiz(S.businesses.find(x=>x.id==='${b.id}')||S.biz)">Coba lagi</button></div>`); return; }
  $('#screen').classList.add('hidden'); $('#app').classList.remove('hidden'); window.scrollTo(0, 0);
  await migrateStock();
  shell(); if (!navAllowed(S.page)) S.page = 'dashboard'; render(); checkAlerts(true); Lock.check(true);
  if (S.mode === 'cloud') { Sync.ui(); if (S.offline) toast('📴 Mode offline — data dari perangkat ini. Perubahan dikirim otomatis saat online.'); else setTimeout(() => Sync.flush(), 1200); }
  if (S.mode === 'cloud' && notifSet().push && 'Notification' in window && Notification.permission === 'granted') subscribePush(true);
}

/* sekali jalan: produk lama tanpa stock_base → hitung dari stok tercatat dikurangi riwayat */
async function migrateStock() {
  invalidateStock();
  const legacy = S.d.products.filter(p => p.stock_base == null); if (!legacy.length) return;
  for (const p of legacy) { const base = N(p.stock) - movesSum(p.id); try { await B().update('products', p.id, { stock_base: base }); } catch (e) { /* dicoba lagi lain kali */ } p.stock_base = base; }
  invalidateStock(); Snap.save();
}

/* ---------------- wizard usaha baru ---------------- */
let WZ = { type: 'warung' };
function showWizard(cancelable) {
  screen(`<div class="auth-card wide">${brandHTML('Buat buku usaha Anda')}
    <form onsubmit="return createBiz(event)">
      <label class="f"><span>Nama usaha</span><input class="inp" name="name" placeholder="cth: Warung Berkah, Kandang Ayam Jaya" required></label>
      <label class="f"><span>Jenis usaha <small class="muted">(kategori, fitur & catatan harian menyesuaikan otomatis — tetap bisa diubah)</small></span></label>
      <div class="type-grid" id="wzTypes">${Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="type-card ${k === WZ.type ? 'on' : ''}" onclick="WZ.type='${k}';$$('#wzTypes .type-card').forEach(x=>x.classList.remove('on'));this.classList.add('on')"><div class="e">${t.emoji}</div><b>${t.label}</b><span>${t.desc}</span></button>`).join('')}</div>
      <div class="f-row mt"><label class="f"><span>Saldo kas awal</span>${moneyInput('cash', 0)}</label>
      <label class="f"><span>Zona waktu</span><select class="inp" name="tz">${Object.entries(TIMEZONES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
      <label class="row" style="margin:4px 0 16px;cursor:pointer"><label class="switch"><input type="checkbox" name="sample"><i></i></label><span><b>Isi data contoh</b><br><small class="muted">Biar langsung terlihat grafik & laporan (bisa dihapus nanti)</small></span></label>
      <div class="row"><button class="btn primary grow" id="wzBtn">Buat Usaha</button>${cancelable ? `<button type="button" class="btn" onclick="openBiz(S.biz)">Batal</button>` : ''}</div>
    </form></div>`);
}
async function createBiz(e) {
  e.preventDefault(); const f = formObj(e.target); const b = $('#wzBtn'); busy(b, true);
  const T = TEMPLATES[WZ.type]; APP_TZ = f.tz || 'Asia/Jakarta';
  const biz = { id: uid(), name: f.name.trim(), type: WZ.type, currency: 'IDR', created_at: new Date().toISOString(),
    settings: { tz: f.tz || 'Asia/Jakarta', emoji: T.emoji, mods: { ...T.mods }, metrics: T.metrics.map(({ s, ...m }) => m), notif: { ...DEFAULT_NOTIF }, target: 0 } };
  try {
    const res = await B().insert('businesses', [biz]); const saved = normalizeBiz((res && res[0]) || biz);
    S.businesses.push(saved); S.biz = saved; S.d = {}; TABLES.forEach(t => S.d[t] = []);
    try { await seedBiz(T, parseMoney(f.cash), !!f.sample); }
    catch (se) { try { await B().removeBiz(saved.id); } catch (_) {} S.businesses = S.businesses.filter(x => x.id !== saved.id); throw se; }
    await openBiz(saved); toast('Usaha "' + saved.name + '" siap digunakan 🎉');
  } catch (err) { busy(b, false); toast('Gagal membuat usaha: ' + humanErr(err), true); }
  return false;
}
async function seedBiz(T, cash, sample) {
  const accs = await addMany('accounts', [{ name: 'Kas Tunai', type: 'kas', opening_balance: cash, color: '#0d9488' }, { name: 'Rekening Bank', type: 'bank', opening_balance: 0, color: '#4f46e5' }, { name: 'E-Wallet / QRIS', type: 'ewallet', opening_balance: 0, color: '#d97706' }]);
  let i = 0;
  const cs = await addMany('categories', [...T.inc.map(([n, e]) => ({ name: n, type: 'in', icon: e, color: PALETTE[i++ % 12] })), ...T.out.map(([n, e]) => ({ name: n, type: 'out', icon: e, color: PALETTE[i++ % 12] }))]);
  const prods = await addMany('products', T.products.map(p => ({ name: p[0], unit: p[1], buy_price: p[2], sell_price: p[3], stock: sample ? p[4] : 0, stock_base: sample ? p[4] : 0, min_stock: p[5], track_stock: p[6] !== false, active: true })));
  if (!sample) return;
  const R = (a, b) => a + Math.random() * (b - a), RI = (a, b) => Math.round(R(a, b));
  const inC = cs.filter(c => c.type === 'in'), outC = cs.filter(c => c.type === 'out');
  const [i1, i2, o1, o2] = T.scale; const tx = [], logs = [];
  const roundTo = v => Math.round(v / 500) * 500;
  for (let k = 75; k >= 0; k--) {
    const d = addDays(today(), -k);
    const n = RI(1, 3);
    for (let j = 0; j < n; j++) { const c = j === 0 ? inC[0] : inC[RI(0, inC.length - 1)]; const amt = roundTo(R(i1, i2) * (c === inC[0] ? 1 : .35)); const sold = prods.filter(p => p.sell_price > 0); const items = (j === 0 && sold.length) ? [{ pid: sold[0].id, name: sold[0].name, qty: Math.max(1, Math.round(amt / sold[0].sell_price)), price: sold[0].sell_price, cost: sold[0].buy_price }] : null; tx.push({ date: d, type: 'in', amount: items ? items[0].qty * items[0].price : amt, category_id: c.id, account_id: accs[RI(0, 2) > 1 ? 2 : 0].id, ref: items ? 'sale' : null, items, cost: items ? items[0].qty * items[0].cost : 0, note: '' }); }
    tx.push({ date: d, type: 'out', amount: roundTo(R(o1, o2)), category_id: outC[0].id, account_id: accs[0].id, note: '' });
    if (Math.random() < .35) { const c = outC[RI(1, Math.min(2, outC.length - 1))]; tx.push({ date: d, type: 'out', amount: roundTo(R(o1, o2) * .3), category_id: c.id, account_id: accs[0].id, note: '' }); }
    if (k % 30 === 3) outC.slice(3, 6).forEach(c => tx.push({ date: d, type: 'out', amount: roundTo(R(o1, o2) * .8), category_id: c.id, account_id: accs[1].id, note: 'Bulanan' }));
    if (k % 14 === 0) tx.push({ date: d, type: 'transfer', amount: roundTo(R(i1, i2) * 2), account_id: accs[0].id, to_account_id: accs[1].id, note: 'Setor ke bank' });
    if (T.metrics.length) { const v = {}; T.metrics.forEach(m => v[m.key] = m.agg === 'last' ? RI(m.s[0], m.s[1]) : +R(m.s[0], m.s[1]).toFixed(m.unit === 'kg' ? 1 : 0)); if (v.kg && v.butir) v.kg = +(v.butir * 0.0625).toFixed(1); logs.push({ date: d, vals: v, note: '' }); }
  }
  await addMany('transactions', tx); await addMany('production_logs', logs);
  const ct = await addMany('contacts', [{ name: 'Bu Siti', type: 'pelanggan', phone: '081234567890' }, { name: 'Pak Budi', type: 'pelanggan', phone: '' }, { name: 'CV Sumber Rejeki', type: 'supplier', phone: '' }]);
  await addMany('debts', [{ kind: 'piutang', contact_id: ct[0].id, amount: roundTo(i2 * .6), paid: 0, date: addDays(today(), -12), due_date: addDays(today(), 2), category_id: inC[0].id, source: 'sale', note: 'Bon belanja' },
    { kind: 'hutang', contact_id: ct[2].id, amount: roundTo(o2 * 3), paid: roundTo(o2), date: addDays(today(), -20), due_date: addDays(today(), 10), category_id: outC[0].id, source: 'purchase', note: 'Ambil barang tempo' }]);
  await addMany('budgets', outC.slice(0, 3).map(c => ({ category_id: c.id, amount: roundTo(o2 * 20) })));
  S.biz.settings.target = roundTo(i2 * 45); await updBiz({ settings: S.biz.settings });
}

/* ---------------- kerangka (sidebar, topbar, bottom nav) ---------------- */
const NAV = [
  { id: 'dashboard', label: 'Beranda', icon: 'home' },
  { id: 'transaksi', label: 'Transaksi', icon: 'list' },
  { id: 'kasir', label: 'Kasir', icon: 'cart', mod: 'kasir' },
  { id: 'stok', label: 'Produk & Stok', icon: 'box', mod: 'stok' },
  { id: 'hutang', label: 'Hutang & Piutang', icon: 'book', mod: 'hutang' },
  { id: 'harian', label: 'Catatan Harian', icon: 'clip', mod: 'harian' },
  { id: 'laporan', label: 'Laporan', icon: 'chart' },
  { id: 'anggaran', label: 'Anggaran', icon: 'target', mod: 'anggaran' },
  { id: 'kontak', label: 'Kontak', icon: 'users' },
  { id: 'usaha', label: 'Usaha & Buku Saya', icon: 'store' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'gear' }
];
const navAllowed = id => { const n = NAV.find(x => x.id === id); return n && (!n.mod || mods()[n.mod]); };
function shell() {
  const st = S.biz.settings, T = TEMPLATES[S.biz.type] || TEMPLATES.umum, m = mods();
  const items = NAV.filter(n => !n.mod || m[n.mod]);
  const third = m.kasir ? { id: 'kasir', label: 'Kasir', icon: 'cart' } : { id: 'laporan', label: 'Laporan', icon: 'chart' };
  $('#app').innerHTML = `
  <aside class="side">
    <button class="biz-switch" onclick="bizMenu()"><span class="e">${iconH(st.emoji, T.emoji)}</span><span class="grow"><b class="ell">${esc(S.biz.name)}</b><small class="ell">${esc(bizTypeLabel(S.biz))}</small></span>${ic('chev')}</button>
    <nav class="nav">${items.map(n => `${n.id === 'laporan' || n.id === 'usaha' ? '<div class="sep"></div>' : ''}<button type="button" data-nav="${n.id}" onclick="go('${n.id}')">${ic(n.icon)}<span>${n.label}</span></button>`).join('')}</nav>
    <div class="side-foot">
      ${secBadge()}
      <button class="btn sm install-btn ${S.installEvt ? '' : (isStandalone() ? 'hidden' : '')}" onclick="installApp()">${ic('install')} Install Aplikasi</button>
      <div class="row small muted" style="padding:2px 4px"><span class="grow ell">${S.mode === 'cloud' ? esc(S.user && S.user.email) : 'Data di perangkat ini'}</span>${Lock.enabled() ? `<button class="icon-btn" style="width:36px;height:36px" title="Kunci sekarang" onclick="Lock.show()">${ic('lock')}</button>` : ''}<button class="icon-btn" style="width:36px;height:36px" title="Keluar" onclick="logout()">${ic('logout')}</button></div>
    </div>
  </aside>
  <main class="main">
    <header class="topbar">
      <button class="icon-btn mob-only" onclick="openSide()" aria-label="Menu">${ic('menu')}</button>
      <div class="grow"><h2 id="pgTitle"></h2><div class="sub" id="pgSub"></div></div>
      <div id="topExtra" class="row desk-only"></div>
      ${S.mode === 'cloud' ? '<button class="sync-pill" id="syncBtn" onclick="syncInfo()" aria-label="Status sinkronisasi"></button>' : ''}
      <button class="icon-btn ${LS.get('bk_privacy', false) ? 'on' : ''}" id="privBtn" onclick="togglePrivacy()" title="Sembunyikan / tampilkan nominal" aria-label="Sembunyikan nominal">${ic(LS.get('bk_privacy', false) ? 'eyeoff' : 'eye')}</button>
      <button class="icon-btn" onclick="openAlerts()" aria-label="Notifikasi">${ic('bell')}<span class="badge hidden" id="bellBadge"></span></button>
      <button class="btn primary desk-only" onclick="quickAdd()">${ic('plus')} Catat</button>
    </header>
    <section class="content" id="content"></section>
  </main>
  <nav class="bnav">
    <button data-nav="dashboard" onclick="go('dashboard')">${ic('home')}Beranda</button>
    <button data-nav="transaksi" onclick="go('transaksi')">${ic('list')}Transaksi</button>
    <button onclick="quickAdd()" aria-label="Catat"><span class="fab">${ic('plus')}</span></button>
    <button data-nav="${third.id}" onclick="go('${third.id}')">${ic(third.icon)}${third.label}</button>
    <button onclick="openSide()">${ic('menu')}Lainnya</button>
  </nav>`;
}
const PAGES = {};
function go(p) { if (!navAllowed(p)) p = 'dashboard'; if (p === 'pengaturan' && !S._keepSec) S.setSec = null; S._keepSec = false; S.page = p; closeOverlays(); closeModal(); render(); window.scrollTo({ top: 0 }); try { history.replaceState(null, '', location.pathname + (p !== 'dashboard' ? '?page=' + p : '')); } catch (e) {} }
function render() {
  if (!S.biz || !$('#content')) return;
  invalidateStock();
  S.charts.forEach(c => { try { c.destroy(); } catch (e) {} }); S.charts = [];
  $$('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === S.page));
  const pg = PAGES[S.page] || PAGES.dashboard; const n = NAV.find(x => x.id === S.page);
  $('#pgTitle').textContent = n ? n.label : '';
  $('#pgSub').textContent = S.page === 'dashboard' ? sapa() : S.biz.name;
  $('#topExtra').innerHTML = '';
  $('#content').innerHTML = pg.html();
  pg.mount && pg.mount();
  updateBell(); cacheBizSummary(); Sync.ui();
}
function sapa() { const h = nowTZ().h; return (h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam') + ' 👋 ' + fmtDay(today()); }
let _dc; function dataChanged() { invalidateStock(); Snap.save(); clearTimeout(_dc); _dc = setTimeout(() => { updateBell(); checkAlerts(false); }, 400); }

function bizMenu() {
  modal('Pilih Usaha', `<div class="list">${S.businesses.map(b => { const T = TEMPLATES[b.type] || TEMPLATES.umum; return `<div class="li" onclick="closeModal();openBiz(S.businesses.find(x=>x.id==='${b.id}'))"><div class="av">${iconH(b.settings && b.settings.emoji, T.emoji)}</div><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${esc(bizTypeLabel(b))}</div></div>${b.id === S.biz.id ? `<span class="pill in">Aktif</span>` : ''}</div>`; }).join('')}</div>
  <button class="btn primary block mt" onclick="closeModal();closeOverlays();WZ.type='warung';showWizard(true)">${ic('plus')} Tambah Usaha Baru</button>
  <button class="btn block mt" onclick="closeModal();go('usaha')">${ic('store')} Kelola Semua Usaha & Buku</button>
  <p class="muted xs" style="margin-bottom:0">Setiap usaha punya pembukuan, kategori, stok & laporan sendiri.</p>`);
}

/* ---------------- tambah cepat ---------------- */
function quickAdd() {
  const m = mods();
  const opts = [['💰', 'Pemasukan', "txForm(null,'in')"], ['💸', 'Pengeluaran', "txForm(null,'out')"], ['🔁', 'Transfer Saldo', "txForm(null,'transfer')"]];
  if (m.kasir) opts.push(['🛒', 'Penjualan (Kasir)', "go('kasir')"]);
  if (m.stok) opts.push(['📦', 'Stok Masuk / Beli', 'stockInPick()']);
  if (m.harian) opts.push(['📋', 'Catatan Harian', 'logForm()']);
  if (m.hutang) opts.push(['🤝', 'Hutang / Piutang', 'debtForm()']);
  modal('Catat Apa Hari Ini?', `<div class="type-grid">${opts.map(o => `<button class="type-card" onclick="closeModal();${o[2]}"><div class="e">${o[0]}</div><b>${o[1]}</b></button>`).join('')}</div>`);
}

/* =====================================================================
   NOTIFIKASI & PENGINGAT
   ===================================================================== */
function computeAlerts() {
  if (!S.biz) return [];
  const ns = notifSet(), m = mods(), A = [], now = nowTZ(), t = now.date;
  const [hh, mm] = (ns.jam || '19:00').split(':').map(Number); const pastJam = now.h * 60 + now.m >= hh * 60 + (mm || 0);
  if (ns.stok && m.stok) S.d.products.filter(p => p.active !== false && p.track_stock !== false && N(p.min_stock) > 0 && stockOf(p) <= N(p.min_stock)).forEach(p =>
    A.push({ id: 'stok-' + p.id + '-' + stockOf(p), lv: stockOf(p) <= 0 ? 'danger' : 'warn', e: '📦', t: (stockOf(p) <= 0 ? 'Stok habis: ' : 'Stok menipis: ') + p.name, b: 'Sisa ' + numf(stockOf(p), 2) + ' ' + (p.unit || '') + ' (minimum ' + numf(p.min_stock) + ')', page: 'stok' }));
  const H = N(ns.hari_jatuh_tempo) || 3;
  ['piutang', 'hutang'].forEach(k => { if (!ns[k] || !m.hutang) return; openDebts(k).filter(d => d.due_date && d.due_date <= addDays(t, H)).forEach(d => {
    const late = d.due_date < t, dd = diffDays(t, d.due_date);
    A.push({ id: k + '-' + d.id + '-' + d.due_date, lv: late ? 'danger' : 'warn', e: k === 'piutang' ? '📥' : '📤', t: (k === 'piutang' ? 'Piutang ' : 'Hutang ke ') + contactName(d.contact_id, d.contact_name) + (late ? ' terlambat ' + (-dd) + ' hari' : dd === 0 ? ' jatuh tempo hari ini' : ' jatuh tempo ' + dd + ' hari lagi'), b: 'Sisa ' + money(debtLeft(d)) + ' • tempo ' + fmtDate(d.due_date), page: 'hutang' }); }); });
  if (ns.anggaran && m.anggaran) { const mr = monthRange(0); S.d.budgets.forEach(b => { const c = cat(b.category_id); if (!c || !N(b.amount)) return; const sp = catSpend(c.id, mr.from, mr.to), p = pct(sp, b.amount);
    if (p >= 80) A.push({ id: 'ang-' + b.id + '-' + (p >= 100 ? 'x' : 'w') + mr.from, lv: p >= 100 ? 'danger' : 'warn', e: '🎯', t: 'Anggaran ' + c.name + (p >= 100 ? ' terlampaui' : ' hampir habis'), b: 'Terpakai ' + money(sp) + ' dari ' + money(b.amount) + ' (' + Math.round(p) + '%)', page: 'anggaran' }); }); }
  if (ns.target && N(S.biz.settings.target)) { const mr = monthRange(0); const inc = totals(mr.from, mr.to).inc; if (inc >= N(S.biz.settings.target)) A.push({ id: 'target-' + mr.from, lv: 'info', e: '🏆', t: 'Target omzet bulan ini tercapai!', b: money(inc) + ' dari target ' + money(S.biz.settings.target), page: 'dashboard' }); }
  if (pastJam) {
    if (ns.catat && !S.d.transactions.some(x => x.date === t)) A.push({ id: 'catat-' + t, lv: 'info', e: '✍️', t: 'Belum ada transaksi hari ini', b: 'Jangan lupa catat pemasukan & pengeluaran hari ini.', page: 'transaksi' });
    if (ns.harian && m.harian && metrics().length && !S.d.production_logs.some(x => x.date === t)) A.push({ id: 'harian-' + t, lv: 'info', e: '📋', t: 'Catatan harian belum diisi', b: 'Isi data ' + metrics().slice(0, 2).map(x => x.label.toLowerCase()).join(', ') + ' hari ini.', page: 'harian' });
    if (ns.ringkasan) { const tt = totals(t, t); A.push({ id: 'ring-' + t, lv: 'info', e: '📊', t: 'Ringkasan hari ini', b: 'Masuk ' + money(tt.cin) + ' • Keluar ' + money(tt.cout), page: 'dashboard' }); }
  }
  return A;
}
function updateBell() { const n = computeAlerts().filter(a => a.lv !== 'info' || !LS.get('bk_read', []).includes(a.id)).length; const b = $('#bellBadge'); if (!b) return; b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n); }
function openAlerts() {
  const A = computeAlerts(); const ns = notifSet();
  LS.set('bk_read', A.map(a => a.id)); updateBell();
  const dr = $('#drawer');
  dr.innerHTML = `<div class="sheet-h"><h3>Notifikasi</h3><div class="row"><button class="btn sm" onclick="closeOverlays();openSet('notif')">${ic('gear')} Atur</button><button class="icon-btn" onclick="closeOverlays()">${ic('x')}</button></div></div>
  <div class="sheet-b" style="flex:1">${A.length ? A.map(alertHTML).join('') : `<div class="empty"><div class="e">🔔</div><b>Semua aman</b><p class="small">Tidak ada pemberitahuan saat ini.</p></div>`}
  ${!ns.push ? `<div class="card mt" style="background:var(--surface-2)"><b class="small">Ingin notifikasi muncul di HP/PC?</b><p class="xs muted" style="margin:4px 0 10px">Aktifkan notifikasi perangkat agar pengingat muncul seperti aplikasi biasa.</p><button class="btn sm primary" onclick="enablePush()">Aktifkan</button></div>` : ''}</div>`;
  dr.classList.add('on'); $('#scrim').classList.add('on');
}
const alertHTML = a => `<div class="alert-item lv-${a.lv}" onclick="closeOverlays();go('${a.page}')"><div class="ai">${a.e}</div><div class="grow"><b>${esc(a.t)}</b><small>${esc(a.b)}</small></div></div>`;
async function enablePush() {
  if (!('Notification' in window)) { toast('Browser ini tidak mendukung notifikasi. Install aplikasi terlebih dahulu (iPhone: iOS 16.4+ via Tambah ke Layar Utama).', true); return false; }
  const p = await Notification.requestPermission();
  if (p !== 'granted') { toast('Izin notifikasi ditolak. Aktifkan lewat pengaturan browser/HP.', true); return false; }
  const ns = notifSet(); ns.push = true; S.biz.settings.notif = ns; await safe(() => updBiz({ settings: S.biz.settings }));
  const server = await subscribePush(false);
  toast(server ? 'Notifikasi aktif ✅ — tetap muncul walau aplikasi ditutup' : 'Notifikasi perangkat aktif ✅'); closeOverlays(); if (S.page === 'pengaturan') render(); checkAlerts(true); return true;
}
async function showSysNotif(title, body, page, tag) {
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    const opt = { body, tag: tag || title, icon: 'icons/icon-192.png', badge: 'icons/badge-72.png', data: { page }, renotify: false };
    if (reg) await reg.showNotification(title, opt); else new Notification(title, opt);
  } catch (e) { console.warn(e); }
}
/* Push dari server (Supabase Edge Function) — notifikasi tetap sampai walau aplikasi ditutup */
const serverPush = () => S.mode === 'cloud' && LS.get('bk_server_push', false);
const b64u = s => { const r = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
async function subscribePush(silent) {
  if (S.mode !== 'cloud' || isOffline() || S.offline || !S.sb || !CONFIG.VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(CONFIG.VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const { error } = await S.sb.from('push_subscriptions').upsert({ user_id: S.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, tz: APP_TZ, ua: navigator.userAgent.slice(0, 200) }, { onConflict: 'user_id,endpoint' });
    if (error) throw error;
    LS.set('bk_server_push', true); return true;
  } catch (e) { console.warn('push', e); LS.set('bk_server_push', false); if (!silent) toast('Push server belum aktif: ' + e.message, true); return false; }
}
function checkAlerts(force) {
  if (serverPush()) return; // server yang mengirim, hindari notifikasi dobel
  const ns = notifSet(); if (!ns.push || !('Notification' in window) || Notification.permission !== 'granted') return;
  const key = 'bk_pushed_' + S.biz.id; const st = LS.get(key, { d: '', ids: [] }); if (st.d !== today()) { st.d = today(); st.ids = []; }
  const fresh = computeAlerts().filter(a => !st.ids.includes(a.id));
  fresh.slice(0, 4).forEach((a, i) => setTimeout(() => showSysNotif(a.e + ' ' + a.t, a.b + ' — ' + S.biz.name, a.page, a.id), i * 700));
  if (fresh.length > 4) setTimeout(() => showSysNotif('🔔 ' + (fresh.length - 4) + ' pemberitahuan lain', 'Buka aplikasi untuk melihat semua.', 'dashboard', 'more'), 3200);
  st.ids.push(...fresh.map(a => a.id)); LS.set(key, st);
}
setInterval(() => { if (S.biz) { updateBell(); checkAlerts(false); } }, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.biz) { updateBell(); checkAlerts(false); } });
