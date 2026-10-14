/* =====================================================================
   HALAMAN: LAPORAN, ANGGARAN, KONTAK, PENGATURAN
   ===================================================================== */
S.rep = { period: 'month' };
PAGES.laporan = {
  html() {
    const r = range(S.rep.period), T = totals(r.from, r.to), P = totals(r.prevFrom, r.prevTo);
    const byCat = type => { const m = {}; S.d.transactions.forEach(t => { if (t.type === type && isPL(t) && inR(t.date, r.from, r.to)) m[t.category_id] = (m[t.category_id] || 0) + N(t.amount); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const inc = byCat('in'), out = byCat('out'), ps = productSales(r);
    const nonOp = S.d.transactions.filter(t => inR(t.date, r.from, r.to) && t.type !== 'transfer' && !t.category_id);
    const pi = openDebts('piutang'), hu = openDebts('hutang');
    return `<div class="toolbar no-print"><div class="grow">${periodChips(S.rep.period, 'repPeriod')}</div><button class="btn" onclick="exportCSV(S.d.transactions.filter(t=>inR(t.date,range(S.rep.period).from,range(S.rep.period).to)).sort(sortTx),'laporan')">${ic('download')} CSV</button><button class="btn primary" onclick="window.print()">${ic('print')} Cetak / PDF</button></div>
    <div class="print-only" style="margin-bottom:12px"><h2 style="margin:0">${esc(S.biz.name)}</h2><div>Laporan Keuangan — ${esc(r.label)} (${fmtDate(r.from)} s/d ${fmtDate(r.to)})</div><div style="font-size:12px;color:#666">Dicetak ${new Date().toLocaleString('id-ID')}</div></div>
    <div class="grid g4 mb">
      ${kpi('Pendapatan', T.inc, P.inc, 'up', 'var(--in)', 'var(--in-soft)')}
      ${kpi('Beban / Biaya', T.out, P.out, 'down', 'var(--out)', 'var(--out-soft)', true)}
      ${kpi('Laba Bersih', T.profit, P.profit, 'chart', 'var(--info)', 'var(--info-soft)')}
      ${kpi('Margin Laba', null, null, 'target', 'var(--warn)', 'var(--warn-soft)', false, pct(T.profit, T.inc).toFixed(1) + '%')}
    </div>
    <div class="grid g2 mb">
      <div class="card"><div class="card-h"><h3>📑 Laporan Laba Rugi</h3><span class="muted xs">${esc(r.label)}</span></div><div class="tbl-wrap"><table class="tbl">
        <tr><th colspan="2">PENDAPATAN</th></tr>${inc.map(([id, v]) => `<tr><td>${iconH((cat(id) || {}).icon, '')} ${esc((cat(id) || {}).name || '-')}</td><td class="r num">${money(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">—</td></tr>'}
        <tr class="tot"><td>Total Pendapatan</td><td class="r num c-in">${money(T.inc)}</td></tr>
        <tr><th colspan="2" style="padding-top:18px">BEBAN / BIAYA</th></tr>${out.map(([id, v]) => `<tr><td>${iconH((cat(id) || {}).icon, '')} ${esc((cat(id) || {}).name || '-')} <span class="xs muted">${pct(v, T.out).toFixed(0)}%</span></td><td class="r num">${money(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">—</td></tr>'}
        <tr class="tot"><td>Total Beban</td><td class="r num c-out">${money(T.out)}</td></tr>
        <tr class="tot"><td style="font-size:16px">LABA (RUGI) BERSIH</td><td class="r num" style="font-size:16px;color:${T.profit >= 0 ? 'var(--in)' : 'var(--out)'}">${money(T.profit)}</td></tr>
      </table></div>${T.omzet ? `<div class="card mt" style="background:var(--surface-2);padding:12px"><b class="small">Analisa penjualan kasir</b><div class="row between small mt" style="margin-top:6px"><span>Omzet</span><b class="num">${money(T.omzet)}</b></div><div class="row between small"><span>Modal barang terjual (HPP)</span><b class="num">${money(T.hpp)}</b></div><div class="row between small"><span>Laba kotor (${pct(T.gross, T.omzet).toFixed(1)}%)</span><b class="num c-in">${money(T.gross)}</b></div></div>` : ''}
      ${nonOp.length ? `<p class="xs muted">* ${nonOp.length} transaksi pinjaman/pembayaran pinjaman tanpa kategori tidak dihitung sebagai laba rugi (hanya arus kas).</p>` : ''}</div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-h"><h3>💼 Arus Kas per Akun</h3></div><div class="tbl-wrap"><table class="tbl"><tr><th>Akun</th><th class="r">Awal</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Akhir</th></tr>
          ${S.d.accounts.map(a => { const st = accBalance(a, addDays(r.from, -1)), en = accBalance(a, r.to); let i = 0, o = 0; S.d.transactions.forEach(t => { if (!inR(t.date, r.from, r.to)) return; if (t.type === 'in' && t.account_id === a.id) i += N(t.amount); if (t.type === 'out' && t.account_id === a.id) o += N(t.amount); if (t.type === 'transfer') { if (t.to_account_id === a.id) i += N(t.amount); if (t.account_id === a.id) o += N(t.amount); } });
            return `<tr><td>${esc(a.name)}</td><td class="r num">${short(st)}</td><td class="r num c-in">${short(i)}</td><td class="r num c-out">${short(o)}</td><td class="r num"><b>${money(en)}</b></td></tr>`; }).join('')}
          <tr class="tot"><td>Total</td><td class="r num">${short(sum(S.d.accounts, a => accBalance(a, addDays(r.from, -1))))}</td><td class="r num c-in">${short(T.cin)}</td><td class="r num c-out">${short(T.cout)}</td><td class="r num">${money(sum(S.d.accounts, a => accBalance(a, r.to)))}</td></tr></table></div></div>
        <div class="card"><div class="card-h"><h3>🤝 Hutang & Piutang (saat ini)</h3></div><div class="row between small"><span>Piutang belum tertagih (${pi.length})</span><b class="num c-in">${money(sum(pi, debtLeft))}</b></div><div class="row between small mt" style="margin-top:8px"><span>Hutang belum dibayar (${hu.length})</span><b class="num c-out">${money(sum(hu, debtLeft))}</b></div>
          <div class="row between small" style="margin-top:8px;border-top:1px solid var(--line);padding-top:8px"><span>Kekayaan bersih usaha (kas + piutang + stok − hutang)</span><b class="num">${money(totalBalance() + sum(pi, debtLeft) + sum(S.d.products.filter(p => p.track_stock !== false), p => Math.max(0, stockOf(p)) * N(p.buy_price)) - sum(hu, debtLeft))}</b></div></div>
      </div>
    </div>
    <div class="card mb"><div class="card-h"><h3>📈 Tren 12 Bulan Terakhir</h3></div><div class="chart-box"><canvas id="cTrend"></canvas></div></div>
    <div class="grid g2 mb"><div class="card"><div class="card-h"><h3>Sumber Pendapatan</h3></div><div class="chart-box sm"><canvas id="cInc"></canvas></div></div><div class="card"><div class="card-h"><h3>Pos Pengeluaran</h3></div><div class="chart-box sm"><canvas id="cOut"></canvas></div></div></div>
    ${ps.length ? `<div class="card mb"><div class="card-h"><h3>🛒 Penjualan per Produk</h3></div><div class="tbl-wrap"><table class="tbl"><tr><th>Produk</th><th class="r">Terjual</th><th class="r">Omzet</th><th class="r hide-sm">Modal</th><th class="r">Laba</th></tr>${ps.map(x => `<tr><td>${esc(x.name)}</td><td class="r num">${numf(x.qty, 2)}</td><td class="r num">${money(x.rev)}</td><td class="r num hide-sm">${money(x.cost)}</td><td class="r num c-in">${money(x.rev - x.cost)}</td></tr>`).join('')}</table></div></div>` : ''}`;
  },
  mount() {
    const d = new Date(), r12 = { from: dstr(new Date(d.getFullYear(), d.getMonth() - 11, 1)), to: today() }; r12.len = diffDays(r12.from, r12.to) + 1;
    flowChart('cTrend', r12); const r = range(S.rep.period);
    if (!donut('cInc', 'in', r)) { const c = $('#cInc'); c && (c.parentElement.innerHTML = '<div class="empty small">Tidak ada data</div>'); }
    if (!donut('cOut', 'out', r)) { const c = $('#cOut'); c && (c.parentElement.innerHTML = '<div class="empty small">Tidak ada data</div>'); }
  }
};
function repPeriod(k) { if (k === 'custom') return customRange(() => { S.rep.period = 'custom'; render(); }); S.rep.period = k; render(); }

/* ---------------- ANGGARAN ---------------- */
S.bud = { off: 0 };
PAGES.anggaran = {
  html() {
    const mr = monthRange(S.bud.off), d = new Date(mr.from + 'T00:00:00'), outs = cats('out');
    const rows = outs.map(c => { const b = S.d.budgets.find(x => x.category_id === c.id); return { c, b, amt: b ? N(b.amount) : 0, sp: catSpend(c.id, mr.from, mr.to) }; });
    const tb = sum(rows, x => x.amt), ts = sum(rows.filter(x => x.amt), x => x.sp), all = sum(rows, x => x.sp);
    const dayPct = S.bud.off === 0 ? pct(new Date().getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) : 100;
    return `<div class="row between mb"><button class="btn sm" onclick="S.bud.off--;render()">‹</button><b>${BULAN[d.getMonth()]} ${d.getFullYear()}</b><button class="btn sm" onclick="S.bud.off=Math.min(0,S.bud.off+1);render()" ${S.bud.off >= 0 ? 'disabled' : ''}>›</button></div>
    <div class="grid g3 mb"><div class="card kpi"><span class="k-lbl">Total Anggaran</span><div class="k-val num">${money(tb)}</div></div><div class="card kpi"><span class="k-lbl">Terpakai (kategori beranggaran)</span><div class="k-val num ${ts > tb && tb ? 'c-out' : ''}">${money(ts)}</div><div class="prog"><i style="width:${Math.min(100, pct(ts, tb))}%;background:${ts > tb ? 'var(--out)' : 'var(--primary)'}"></i></div></div><div class="card kpi"><span class="k-lbl">Sisa Anggaran</span><div class="k-val num ${tb - ts < 0 ? 'c-out' : 'c-in'}">${money(tb - ts)}</div><span class="xs muted">Total semua pengeluaran: ${money(all)}</span></div></div>
    <div class="card"><div class="card-h"><h3>Anggaran per Kategori</h3><span class="xs muted">Ketuk kategori untuk mengatur batas</span></div>
    ${rows.map(x => { const p = x.amt ? pct(x.sp, x.amt) : 0, col = p >= 100 ? 'var(--out)' : p >= dayPct + 10 ? 'var(--warn)' : 'var(--in)';
      return `<div class="li" onclick="budgetForm('${x.c.id}')"><div class="av" style="background:${x.c.color || '#888'}1f">${iconH(x.c.icon, '🧾')}</div><div class="grow"><div class="row between"><b class="small">${esc(x.c.name)}</b><span class="small num">${money(x.sp)} ${x.amt ? `<span class="muted">/ ${money(x.amt)}</span>` : ''}</span></div>
      ${x.amt ? `<div class="prog" style="margin-top:7px"><i style="width:${Math.min(100, p)}%;background:${col}"></i></div><div class="row between xs muted" style="margin-top:4px"><span>${Math.round(p)}% terpakai</span><span>${x.amt - x.sp >= 0 ? 'sisa ' + money(x.amt - x.sp) : '<b class="c-out">lebih ' + money(x.sp - x.amt) + '</b>'}</span></div>` : '<div class="xs muted">Belum ada batas anggaran • ketuk untuk atur</div>'}</div></div>`; }).join('') || '<div class="empty">Belum ada kategori pengeluaran.</div>'}</div>
    ${S.bud.off === 0 ? `<p class="xs muted">Garis waktu bulan ini: ${Math.round(dayPct)}% hari telah berlalu. Warna kuning = pemakaian lebih cepat dari waktu berjalan.</p>` : ''}`;
  }
};
function budgetForm(cid) {
  const c = cat(cid), b = S.d.budgets.find(x => x.category_id === cid), avg3 = sum([1, 2, 3].map(i => { const m = monthRange(-i); return catSpend(cid, m.from, m.to); })) / 3;
  modal('Anggaran ' + esc(c.name), `<form id="bf"><label class="f"><span>Batas pengeluaran per bulan</span>${moneyInput('amount', b && b.amount, 'autofocus')}</label>${avg3 ? `<p class="xs muted">Rata-rata 3 bulan terakhir: <b>${money(avg3)}</b> <button type="button" class="chip" onclick="$('#bf [name=amount]').value='${mval(Math.round(avg3 / 1000) * 1000)}'">Pakai</button></p>` : ''}<p class="xs muted">Kosongkan / isi 0 untuk menghapus anggaran.</p></form>`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="bfs">Simpan</button>`, onMount: m => m.querySelector('#bfs').onclick = async () => {
      const amt = parseMoney(formObj($('#bf')).amount);
      const ok = await safe(async () => { if (b && !amt) await del('budgets', b.id); else if (b) await upd('budgets', b.id, { amount: amt }); else if (amt) await add('budgets', { category_id: cid, amount: amt }); return true; }, 'Anggaran disimpan'); if (ok) { closeModal(); render(); } } });
}

/* ---------------- KONTAK ---------------- */
S.ct = { q: '', type: 'all' };
PAGES.kontak = {
  html() {
    return `<div class="toolbar"><div class="search"><span>${ic('search')}</span><input class="inp" placeholder="Cari nama / no HP…" value="${esc(S.ct.q)}" oninput="S.ct.q=this.value;ctList()"></div><button class="btn primary" onclick="contactForm()">${ic('plus')} Kontak</button></div>
    <div class="chips mb">${[['all', 'Semua'], ['pelanggan', 'Pelanggan'], ['supplier', 'Supplier'], ['lainnya', 'Lainnya']].map(([k, l]) => `<button class="chip ${S.ct.type === k ? 'on' : ''}" onclick="S.ct.type='${k}';render()">${l}</button>`).join('')}</div>
    <div class="card"><div class="list" id="ctList"></div></div>`;
  },
  mount() { ctList(); }
};
function ctList() {
  const q = S.ct.q.trim().toLowerCase();
  const cs = S.d.contacts.filter(c => (S.ct.type === 'all' || c.type === S.ct.type) && (!q || (c.name + ' ' + (c.phone || '')).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  $('#ctList').innerHTML = cs.length ? cs.map(c => { const pi = sum(openDebts('piutang').filter(d => d.contact_id === c.id), debtLeft), hu = sum(openDebts('hutang').filter(d => d.contact_id === c.id), debtLeft), buy = sum(S.d.transactions.filter(t => t.contact_id === c.id && t.type === 'in' && t.ref !== 'debt'), t => t.amount);
    return `<div class="li" onclick="contactForm('${c.id}')"><div class="av" style="background:var(--info-soft);color:var(--info);font-weight:800;font-size:14px">${esc(initials(c.name))}</div><div class="grow"><div class="t ell">${esc(c.name)} <span class="pill neutral">${esc(c.type)}</span></div><div class="s ell">${esc(c.phone || 'Tanpa no HP')}${buy ? ' • total transaksi ' + money(buy) : ''}</div></div>
    <div style="text-align:right">${pi ? `<div class="small c-in num">Piutang ${money(pi)}</div>` : ''}${hu ? `<div class="small c-out num">Hutang ${money(hu)}</div>` : ''}${c.phone ? `<a class="btn sm ghost" href="https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '62')}" target="_blank" onclick="event.stopPropagation()">${ic('phone')}</a>` : ''}</div></div>`; }).join('')
    : `<div class="empty"><div class="e">👥</div><p>Belum ada kontak.</p></div>`;
}
function contactForm(id) {
  const c = id ? contact(id) : { name: '', type: S.ct.type === 'all' ? 'pelanggan' : S.ct.type, phone: '', address: '', note: '' };
  modal(id ? 'Edit Kontak' : 'Kontak Baru', `<form id="cf"><label class="f"><span>Nama</span><input class="inp" name="name" value="${esc(c.name)}" required autofocus></label>
    <div class="f-row"><div class="f"><span>Jenis</span>${listPick('type', 'ctypes', c.type || listGet('ctypes')[0] || '')}</div><label class="f"><span>No HP / WA</span><input class="inp" name="phone" inputmode="tel" value="${esc(c.phone || '')}"></label></div>
    <label class="f"><span>Alamat</span><input class="inp" name="address" value="${esc(c.address || '')}"></label><label class="f"><span>Catatan</span><input class="inp" name="note" value="${esc(c.note || '')}"></label></form>
    ${id ? contactHistory(id) : ''}`,
    { wide: !!id, foot: `${id ? `<button class="btn danger" onclick="confirmBox('Hapus kontak ini? Transaksinya tetap tersimpan.',async()=>{await safe(()=>del('contacts','${id}'),'Kontak dihapus');render()})">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="cfs">Simpan</button>`,
      onMount: m => m.querySelector('#cfs').onclick = async () => { const f = formObj($('#cf')); if (!f.name.trim()) return toast('Nama wajib diisi', true); const row = { name: f.name.trim(), type: f.type, phone: f.phone.trim(), address: f.address.trim(), note: f.note.trim() };
        const ok = await safe(async () => { if (id) await upd('contacts', id, row); else await add('contacts', row); return true; }, 'Kontak disimpan'); if (ok) { closeModal(); render(); } } });
}

function contactHistory(id) {
  const tx = S.d.transactions.filter(t => t.contact_id === id).sort(sortTx), ds = S.d.debts.filter(d => d.contact_id === id);
  const pi = sum(ds.filter(d => d.kind === 'piutang'), debtLeft), hu = sum(ds.filter(d => d.kind === 'hutang'), debtLeft);
  return `<div class="card mt" style="padding:14px"><div class="grid g3" style="gap:10px"><div><div class="xs muted">Transaksi</div><b>${tx.length}</b></div><div><div class="xs muted">Piutang</div><b class="num c-in">${money(pi)}</b></div><div><div class="xs muted">Hutang</div><b class="num c-out">${money(hu)}</b></div></div>
    ${tx.length ? `<div class="list mt">${tx.slice(0, 5).map(txRow).join('')}</div>${tx.length > 5 ? `<button type="button" class="btn sm block" onclick="S.tx.q=${esc(JSON.stringify(contactName(id)))};S.tx.period='all';go('transaksi')">Lihat semua transaksi</button>` : ''}` : '<p class="xs muted" style="margin-bottom:0">Belum ada transaksi dengan kontak ini.</p>'}</div>`;
}

/* ---------------- PENGATURAN: lihat 6-extras.js ---------------- */
async function saveBiz() {
  const f = formObj($('#bizF')); if (!f.name.trim()) return toast('Nama wajib diisi', true);
  const st = S.biz.settings; st.emoji = f.emoji.trim() || (TEMPLATES[f.type] || TEMPLATES.umum).emoji; st.typeLabel = (f.type_label || '').trim(); st.target = parseMoney(f.target); st.tz = f.tz || 'Asia/Jakarta'; APP_TZ = st.tz;
  const typeChanged = f.type !== S.biz.type;
  if (serverPush()) subscribePush(true);
  const ok = await safe(() => updBiz({ name: f.name.trim(), type: f.type, currency: 'IDR', phone: f.phone.trim(), address: f.address.trim(), settings: st }), 'Profil usaha disimpan');
  if (ok === false) return;
  const sb = S.businesses.find(x => x.id === S.biz.id); if (sb && sb !== S.biz) Object.assign(sb, S.biz);
  if (typeChanged) confirmBox('Jenis usaha diganti. Tambahkan juga kategori & kolom catatan harian bawaan untuk <b>' + TEMPLATES[f.type].label + '</b>? (data lama tidak dihapus)', async () => { await applyTemplateExtras(f.type); shell(); render(); }, 'Ya, tambahkan');
  shell(); render();
}
async function applyTemplateExtras(type) {
  const T = TEMPLATES[type], have = new Set(S.d.categories.map(c => c.type + '|' + c.name.toLowerCase())); let i = S.d.categories.length;
  await safe(async () => {
    await addMany('categories', [...T.inc.map(([n, e]) => ({ name: n, type: 'in', icon: e })), ...T.out.map(([n, e]) => ({ name: n, type: 'out', icon: e }))].filter(c => !have.has(c.type + '|' + c.name.toLowerCase())).map(c => ({ ...c, color: PALETTE[i++ % 12] })));
    const keys = new Set(metrics().map(m => m.key)); S.biz.settings.metrics = [...metrics(), ...T.metrics.filter(m => !keys.has(m.key)).map(({ s, ...m }) => m)]; S.biz.settings.mods = { ...mods(), ...Object.fromEntries(Object.entries(T.mods).filter(([, v]) => v)) };
    await updBiz({ settings: S.biz.settings });
  }, 'Template diterapkan');
}
async function setMod(k, v) { if (mods()[k] === v) return; S.biz.settings.mods = { ...mods(), [k]: v }; await safe(() => updBiz({ settings: S.biz.settings })); shell(); render(); }
async function setNotif(k, v) { if (notifSet()[k] === v) return; S.biz.settings.notif = { ...notifSet(), [k]: v }; await safe(() => updBiz({ settings: S.biz.settings })); updateBell(); if (k === 'push') render(); }
async function testNotif() {
  if (S.mode === 'cloud' && (isOffline() || S.offline)) return toast('Notifikasi uji membutuhkan koneksi internet', true);
  if (!('Notification' in window) || Notification.permission !== 'granted') { const ok = await enablePush(); if (!ok) return; }
  if (S.mode === 'cloud' && (serverPush() || await subscribePush(false))) {
    const { data, error } = await S.sb.functions.invoke('send-reminders', { body: { test: true } });
    if (error || !data || !data.sent) return toast('Push server gagal' + (error ? ': ' + error.message : ' (perangkat belum terdaftar)'), true);
    return toast('Notifikasi uji dikirim dari server ke ' + data.sent + ' perangkat');
  }
  showSysNotif('🔔 ' + S.biz.name, 'Notifikasi BukuKas berfungsi dengan baik!', 'dashboard', 'test-' + Date.now()); toast('Notifikasi uji dikirim');
}
/* ---------- ubah nominal saldo akun ---------- */
function balanceForm(id) {
  const a = acc(id); if (!a) return; const cur = accBalance(a);
  modal('Ubah Saldo — ' + esc(a.name), `<form id="blf" onsubmit="event.preventDefault()">
    <div class="row between mb"><span class="muted small">Saldo tercatat saat ini</span><b class="num">${money(cur)}</b></div>
    <label class="f"><span>Saldo sebenarnya sekarang</span><input class="inp big num" name="bal" inputmode="numeric" autocomplete="off" value="${mval(Math.max(0, cur))}" oninput="mfmt(this);blCalc(${cur})" autofocus></label>
    <div class="chips" style="margin-top:-6px"><button type="button" class="chip" onclick="const b=$('#blf [name=bal]');b.value='';blCalc(${cur});b.focus()">Kosongkan</button><button type="button" class="chip" onclick="$('#blf [name=bal]').value='0';blCalc(${cur})">Rp 0</button></div>
    <div class="row between mb"><span class="muted small">Selisih</span><b class="num" id="blDiff">-</b></div>
    <label class="f"><span>Cara menyimpan</span></label><input type="hidden" name="mode" value="adjust">
    <div class="pay-opts" style="grid-template-columns:1fr 1fr"><div class="pay-opt on" data-m="adjust" onclick="blMode(this)">⚖️ Transaksi penyesuaian<br><small class="muted" style="font-weight:500">Disarankan — tercatat di riwayat</small></div><div class="pay-opt" data-m="opening" onclick="blMode(this)">🧮 Ubah saldo awal<br><small class="muted" style="font-weight:500">Tanpa transaksi baru</small></div></div>
    <div id="blAdj"><div class="f-row"><label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${today()}" max="${addDays(today(), 1)}"></label><label class="f"><span>Keterangan</span><input class="inp" name="note" value="Penyesuaian saldo" maxlength="100"></label></div></div>
    <p class="xs muted" style="margin:0">Penyesuaian saldo tidak dihitung sebagai pemasukan/pengeluaran di Laba Rugi, hanya mengubah saldo akun & arus kas.</p></form>`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="bls">${ic('check')} Simpan Saldo</button>`, onMount: m => { m.querySelector('#bls').onclick = () => saveBalance(id); blCalc(cur); } });
}
function blMode(el) { $$('#blf .pay-opt').forEach(x => x.classList.toggle('on', x === el)); $('#blf [name=mode]').value = el.dataset.m; $('#blAdj').classList.toggle('hidden', el.dataset.m !== 'adjust'); }
function blCalc(cur) { const f = formObj($('#blf')), d = parseMoney(f.bal) - cur, el = $('#blDiff'); el.textContent = f.bal === '' ? '-' : d === 0 ? 'Tidak berubah' : (d > 0 ? '+' : '−') + money(Math.abs(d)); el.className = 'num ' + (d > 0 ? 'c-in' : d < 0 ? 'c-out' : ''); }
async function setBalance(a, target, mode, date, note) {
  const diff = Math.round(target - accBalance(a)); if (!diff) return false;
  if (mode === 'opening') await upd('accounts', a.id, { opening_balance: N(a.opening_balance) + diff });
  else await add('transactions', { date: date || today(), type: diff > 0 ? 'in' : 'out', amount: Math.abs(diff), account_id: a.id, category_id: null, ref: 'adjust', note: note || 'Penyesuaian saldo' });
  return true;
}
async function saveBalance(id) {
  const a = acc(id), f = formObj($('#blf'));
  if (f.bal === '') return toast('Isi saldo sebenarnya', true);
  if (f.mode === 'adjust' && !f.date) return toast('Isi tanggal', true);
  const target = parseMoney(f.bal); if (target === Math.round(accBalance(a))) { closeModal(); return toast('Saldo tidak berubah'); }
  const btn = $('#bls'); busy(btn, true);
  const ok = await safe(() => setBalance(a, target, f.mode, f.date, f.note.trim()), 'Saldo ' + a.name + ' menjadi ' + money(target));
  busy(btn, false); if (ok !== false) { closeModal(); render(); }
}
function balanceAll() {
  if (!S.d.accounts.length) return toast('Belum ada akun. Tambahkan di Pengaturan.', true);
  modal('Ubah Saldo Semua Akun', `<form id="baf" onsubmit="event.preventDefault()"><p class="small muted" style="margin-top:0">Isi saldo sebenarnya di setiap akun. Akun yang tidak diubah dibiarkan.</p>
    ${S.d.accounts.map(a => `<div class="opt-row" style="flex-wrap:wrap"><div class="av" style="width:38px;height:38px;font-size:16px">${iconH(accIcon(a))}</div><div class="grow" style="min-width:120px"><b style="font-size:14px">${esc(a.name)}</b><div class="xs muted">Tercatat <span class="num">${money(accBalance(a))}</span></div></div><input class="inp num" style="max-width:170px" name="b_${a.id}" inputmode="numeric" autocomplete="off" value="${mval(Math.max(0, accBalance(a)))}" oninput="mfmt(this);baCalc()" aria-label="Saldo ${esc(a.name)}"></div>`).join('')}
    <div class="row between mt"><b>Total saldo baru</b><b class="num" id="baTot"></b></div>
    <div class="f-row mt"><label class="f"><span>Tanggal penyesuaian</span><input class="inp" type="date" name="date" value="${today()}" max="${addDays(today(), 1)}"></label><label class="f"><span>Keterangan</span><input class="inp" name="note" value="Penyesuaian saldo" maxlength="100"></label></div>
    <p class="xs muted" style="margin:0">Disimpan sebagai transaksi penyesuaian (tidak dihitung laba/rugi).</p></form>`,
    { wide: true, foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="bas">${ic('check')} Simpan Semua</button>`, onMount: m => { baCalc(); m.querySelector('#bas').onclick = async () => {
      const f = formObj($('#baf')); if (!f.date) return toast('Isi tanggal', true);
      const changes = S.d.accounts.filter(a => f['b_' + a.id] !== '' && parseMoney(f['b_' + a.id]) !== Math.round(accBalance(a)));
      if (!changes.length) { closeModal(); return toast('Tidak ada saldo yang berubah'); }
      const btn = $('#bas'); busy(btn, true);
      const ok = await safe(async () => { for (const a of changes) await setBalance(a, parseMoney(f['b_' + a.id]), 'adjust', f.date, f.note.trim()); return true; }, changes.length + ' saldo akun diperbarui');
      busy(btn, false); if (ok) { closeModal(); render(); } }; } });
}
function baCalc() { const f = formObj($('#baf')); $('#baTot').textContent = money(sum(S.d.accounts, a => f['b_' + a.id] === '' ? accBalance(a) : parseMoney(f['b_' + a.id]))); }
function accountForm(id) {
  const a = id ? acc(id) : { name: '', type: 'kas', opening_balance: '', color: PALETTE[S.d.accounts.length % 12] };
  modal(id ? 'Edit Akun' : 'Akun Baru', `<form id="af"><label class="f"><span>Nama akun</span><input class="inp" name="name" value="${esc(a.name)}" placeholder="cth: Kas Laci, BRI, DANA" required autofocus></label>
    <div class="f"><span>Ikon / logo (opsional)</span>${iconField('icon', a.icon, accIcon({ type: a.type }))}</div>
    <div class="f-row"><label class="f"><span>Jenis</span><select class="inp" name="type">${[['kas', 'Kas tunai'], ['bank', 'Bank'], ['ewallet', 'E-Wallet / QRIS']].map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="f"><span>Warna</span><input class="inp" type="color" name="color" value="${a.color || '#0d9488'}" style="height:46px;padding:4px"></label></div>
    ${id ? `<div class="card mb" style="padding:12px;background:var(--surface-2)"><div class="row between"><div><div class="xs muted">Saldo saat ini</div><b class="num" style="font-size:18px">${money(accBalance(a))}</b></div><button type="button" class="btn sm primary" onclick="balanceForm('${id}')">${ic('edit')} Ubah saldo</button></div></div>` : ''}
    <label class="f"><span>Saldo awal${id ? ' (saldo saat akun dibuat)' : ''}</span>${moneyInput('opening_balance', a.opening_balance)}</label>${id ? '<p class="xs muted" style="margin-top:-6px">Mengubah saldo awal ikut menggeser saldo di semua periode laporan.</p>' : ''}</form>`,
    { foot: `${id ? `<button class="btn danger" onclick="deleteAccount('${id}')">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="afs">Simpan</button>`,
      onMount: m => m.querySelector('#afs').onclick = async () => { const f = formObj($('#af')); if (!f.name.trim()) return toast('Nama wajib diisi', true); const row = { name: f.name.trim(), type: f.type, color: f.color, icon: (f.icon || '').trim() || null, opening_balance: parseMoney(f.opening_balance) };
        const ok = await safe(async () => { if (id) await upd('accounts', id, row); else await add('accounts', row); return true; }, 'Akun disimpan'); if (ok) { closeModal(); render(); } } });
}
function deleteAccount(id) { if (S.d.transactions.some(t => t.account_id === id || t.to_account_id === id)) return toast('Akun sudah punya transaksi, tidak bisa dihapus', true); if (S.d.accounts.length <= 1) return toast('Minimal harus ada 1 akun', true); confirmBox('Hapus akun ini?', async () => { await safe(() => del('accounts', id), 'Akun dihapus'); render(); }); }
function catForm(id, type) {
  const c = id ? cat(id) : { name: '', type: type || 'out', icon: '🧾', color: PALETTE[S.d.categories.length % 12] };
  modal(id ? 'Edit Kategori' : 'Kategori Baru', `<form id="kf"><label class="f"><span>Nama kategori</span><input class="inp" name="name" value="${esc(c.name)}" required autofocus></label>
    <div class="f"><span>Ikon</span>${iconField('icon', c.icon, '🧾')}</div>
    <div class="f-row"><label class="f"><span>Jenis</span><select class="inp" name="type"><option value="in" ${c.type === 'in' ? 'selected' : ''}>Pemasukan</option><option value="out" ${c.type === 'out' ? 'selected' : ''}>Pengeluaran</option></select></label><label class="f"><span>Warna</span><input class="inp" type="color" name="color" value="${c.color || '#0d9488'}" style="height:46px;padding:4px"></label></div>
    <p class="xs muted">Ide emoji: ${'💰 🛒 📦 🥚 🌽 💊 🐔 🍊 🚚 💡 🏠 👷 🧾 📣 🔧 🎁'.split(' ').map(e => `<button type="button" class="emo-pick" onclick="const b=$('#kf .ico-field');b.querySelector('.ico-emoji').value='${e}';icoSet(b,'${e}')">${e}</button>`).join('')}<br>Atau unggah foto/logo dari perangkat — otomatis dikecilkan.</p></form>`,
    { foot: `${id ? `<button class="btn danger" onclick="deleteCat('${id}')">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="kfs">Simpan</button>`,
      onMount: m => m.querySelector('#kfs').onclick = async () => { const f = formObj($('#kf')); if (!f.name.trim()) return toast('Nama wajib diisi', true); const row = { name: f.name.trim(), icon: f.icon.trim(), color: f.color, type: f.type };
        if (id && f.type !== c.type && S.d.transactions.some(t => t.category_id === id)) return toast('Jenis tidak bisa diubah: kategori ini sudah dipakai transaksi', true);
        const ok = await safe(async () => { if (id) await upd('categories', id, row); else await add('categories', row); return true; }, 'Kategori disimpan'); if (ok) { closeModal(); render(); } } });
}
function deleteCat(id) {
  const n = S.d.transactions.filter(t => t.category_id === id).length;
  confirmBox('Hapus kategori ini?' + (n ? ` <b>${n} transaksi</b> akan menjadi tanpa kategori (tidak dihitung di laba rugi).` : ''), async () => { await safe(async () => { for (const b of S.d.budgets.filter(x => x.category_id === id)) await del('budgets', b.id); await del('categories', id); S.d.transactions.forEach(t => { if (t.category_id === id) t.category_id = null; }); if (S.mode === 'local' && n) { const db = Local.db(); db.transactions.forEach(t => { if (t.category_id === id) t.category_id = null; }); Local.save(db); } }, 'Kategori dihapus'); render(); });
}
function metricForm(idx) {
  const ms = metrics(), m = idx !== undefined ? ms[idx] : { label: '', unit: '', agg: 'sum' };
  modal(idx !== undefined ? 'Edit Kolom' : 'Kolom Catatan Harian Baru', `<form id="mf"><label class="f"><span>Nama data</span><input class="inp" name="label" value="${esc(m.label)}" placeholder="cth: Produksi telur, Pakan, Hasil panen" required autofocus></label>
    <div class="f-row"><label class="f"><span>Satuan</span><input class="inp" name="unit" value="${esc(m.unit)}" placeholder="butir, kg, ekor…"></label><label class="f"><span>Cara menghitung</span><select class="inp" name="agg"><option value="sum" ${m.agg === 'sum' ? 'selected' : ''}>Dijumlahkan (produksi, pakan)</option><option value="avg" ${m.agg === 'avg' ? 'selected' : ''}>Rata-rata (suhu, harga)</option><option value="last" ${m.agg === 'last' ? 'selected' : ''}>Nilai terakhir (populasi)</option></select></label></div>
    ${!ms.length ? `<p class="xs muted">Atau pakai paket siap pakai:</p><div class="row wrap gap-s">${Object.entries(TEMPLATES).filter(([, t]) => t.metrics.length).map(([k, t]) => `<button type="button" class="chip" onclick="applyMetricPreset('${k}')">${t.emoji} ${t.label}</button>`).join('')}</div>` : ''}</form>`,
    { foot: `${idx !== undefined ? `<button class="btn danger" onclick="delMetric(${idx})">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="mfs">Simpan</button>`,
      onMount: md => md.querySelector('#mfs').onclick = async () => { const f = formObj($('#mf')); if (!f.label.trim()) return toast('Nama wajib diisi', true);
        const row = { key: m.key || (f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'm') + (m.key ? '' : '_' + Math.random().toString(36).slice(2, 5)), label: f.label.trim(), unit: f.unit.trim(), agg: f.agg };
        const list = [...ms]; if (idx !== undefined) list[idx] = row; else list.push(row); S.biz.settings.metrics = list; S.biz.settings.mods = { ...mods(), harian: true };
        await safe(() => updBiz({ settings: S.biz.settings }), 'Kolom disimpan'); closeModal(); shell(); render(); } });
}
async function applyMetricPreset(k) { S.biz.settings.metrics = TEMPLATES[k].metrics.map(({ s, ...m }) => m); S.biz.settings.mods = { ...mods(), harian: true }; await safe(() => updBiz({ settings: S.biz.settings }), 'Kolom catatan ditambahkan'); closeModal(); shell(); render(); }
function delMetric(i) { confirmBox('Hapus kolom ini? Data lama tetap tersimpan namun tidak ditampilkan.', async () => { const l = [...metrics()]; l.splice(i, 1); S.biz.settings.metrics = l; await safe(() => updBiz({ settings: S.biz.settings }), 'Kolom dihapus'); render(); }); }

/* backup & restore */
function backup() { download('backup-' + S.biz.name.replace(/\W+/g, '_') + '-' + today() + '.json', JSON.stringify({ app: 'bukukas', v: 1, at: new Date().toISOString(), business: S.biz, data: S.d }), 'application/json'); toast('Backup diunduh'); }
async function restore(file) {
  if (!file) return; let j; try { j = JSON.parse(await file.text()); } catch (e) { return toast('File backup tidak valid', true); }
  if (j.app !== 'bukukas' || !j.data) return toast('Bukan file backup BukuKas', true);
  if (S.mode === 'cloud') { try { needOnline('Pulihkan backup'); } catch (e) { return toast(e.message, true); } }
  confirmBox(`Pulihkan backup <b>${esc(j.business && j.business.name)}</b> (${fmtDate(String(j.at).slice(0, 10))})? <br>Semua data usaha <b>${esc(S.biz.name)}</b> saat ini akan <b>diganti</b>.`, async () => {
    screen('<div class="loader"></div>');
    try {
      await B().clearBiz(S.biz.id); TABLES.forEach(t => S.d[t] = []);
      const map = {}; TABLES.forEach(t => (j.data[t] || []).forEach(r => map[r.id] = uid()));
      const fk = ['account_id', 'to_account_id', 'category_id', 'contact_id', 'debt_id', 'product_id', 'transaction_id'];
      for (const t of TABLES) { const rows = (j.data[t] || []).map(r => { const o = { ...r, id: map[r.id], business_id: S.biz.id }; delete o.user_id; fk.forEach(k => { if (o[k]) o[k] = map[o[k]] || null; }); if (o.items) o.items = o.items.map(i => ({ ...i, pid: i.pid ? (map[i.pid] || null) : null })); return o; }); await addMany(t, rows); }
      if (j.business && j.business.settings) { const s = { ...j.business.settings }; if (s.sale_cat) s.sale_cat = map[s.sale_cat]; await updBiz({ settings: s }); }
      toast('Data berhasil dipulihkan ✅');
    } catch (e) { toast('Gagal memulihkan: ' + e.message, true); }
    await openBiz(S.biz);
  }, 'Pulihkan');
}
function clearData() {
  if (S.mode === 'cloud') { try { needOnline('Kosongkan data'); } catch (e) { return toast(e.message, true); } }
  confirmBox('Hapus <b>semua transaksi, hutang/piutang, catatan harian & riwayat stok</b> usaha ini? Akun, kategori, produk & kontak tetap ada. Tindakan ini tidak bisa dibatalkan.', async () => {
    await safe(async () => {
      const ts = ['transactions', 'stock_moves', 'debts', 'production_logs'];
      if (S.mode === 'cloud') { for (const t of ts) { const { error } = await S.sb.from(t).delete().eq('business_id', S.biz.id); if (error) throw error; } }
      else { const db = Local.db(); ts.forEach(t => db[t] = (db[t] || []).filter(r => r.business_id !== S.biz.id)); Local.save(db); }
      ts.forEach(t => S.d[t] = []);
    }, 'Data dikosongkan'); render();
  }, 'Ya, kosongkan');
}
function deleteBiz(id) {
  const b = S.businesses.find(x => x.id === (id || S.biz.id)); if (!b) return;
  modal('Hapus Usaha', `<div class="alert-item lv-danger" style="cursor:default"><div class="ai">⚠️</div><div><b>Tindakan permanen</b><small>Seluruh transaksi, stok, hutang/piutang & laporan usaha ini akan terhapus dan tidak bisa dikembalikan. Sebaiknya Backup dulu.</small></div></div><p>Ketik <b>${esc(b.name)}</b> untuk konfirmasi:</p><input class="inp" id="delName" autocomplete="off">`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn danger solid" id="delGo">${ic('trash')} Hapus Permanen</button>`, onMount: m => m.querySelector('#delGo').onclick = async () => {
      if ($('#delName').value.trim() !== b.name) return toast('Nama tidak cocok', true);
      const ok = await safe(() => B().removeBiz(b.id).then(() => true)); if (!ok) return;
      LS.del('bk_sum_' + b.id); S.businesses = S.businesses.filter(x => x.id !== b.id); closeModal(); toast('Usaha "' + b.name + '" dihapus');
      if (b.id === S.biz.id) { LS.del('bk_biz'); if (S.businesses.length) openBiz(S.businesses[0]); else showWizard(); } else render(); } });
}
