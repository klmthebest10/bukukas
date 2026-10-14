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
        <tr><th colspan="2">PENDAPATAN</th></tr>${inc.map(([id, v]) => `<tr><td>${esc((cat(id) || {}).icon || '')} ${esc((cat(id) || {}).name || '-')}</td><td class="r num">${money(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">—</td></tr>'}
        <tr class="tot"><td>Total Pendapatan</td><td class="r num c-in">${money(T.inc)}</td></tr>
        <tr><th colspan="2" style="padding-top:18px">BEBAN / BIAYA</th></tr>${out.map(([id, v]) => `<tr><td>${esc((cat(id) || {}).icon || '')} ${esc((cat(id) || {}).name || '-')} <span class="xs muted">${pct(v, T.out).toFixed(0)}%</span></td><td class="r num">${money(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">—</td></tr>'}
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
          <div class="row between small" style="margin-top:8px;border-top:1px solid var(--line);padding-top:8px"><span>Kekayaan bersih usaha (kas + piutang + stok − hutang)</span><b class="num">${money(totalBalance() + sum(pi, debtLeft) + sum(S.d.products.filter(p => p.track_stock !== false), p => Math.max(0, N(p.stock)) * N(p.buy_price)) - sum(hu, debtLeft))}</b></div></div>
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
      return `<div class="li" onclick="budgetForm('${x.c.id}')"><div class="av" style="background:${x.c.color || '#888'}1f">${esc(x.c.icon || '🧾')}</div><div class="grow"><div class="row between"><b class="small">${esc(x.c.name)}</b><span class="small num">${money(x.sp)} ${x.amt ? `<span class="muted">/ ${money(x.amt)}</span>` : ''}</span></div>
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
    <div class="f-row"><label class="f"><span>Jenis</span><select class="inp" name="type">${['pelanggan', 'supplier', 'lainnya'].map(t => `<option ${c.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>No HP / WA</span><input class="inp" name="phone" inputmode="tel" value="${esc(c.phone || '')}"></label></div>
    <label class="f"><span>Alamat</span><input class="inp" name="address" value="${esc(c.address || '')}"></label><label class="f"><span>Catatan</span><input class="inp" name="note" value="${esc(c.note || '')}"></label></form>`,
    { foot: `${id ? `<button class="btn danger" onclick="confirmBox('Hapus kontak ini? Transaksinya tetap tersimpan.',async()=>{await safe(()=>del('contacts','${id}'),'Kontak dihapus');render()})">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="cfs">Simpan</button>`,
      onMount: m => m.querySelector('#cfs').onclick = async () => { const f = formObj($('#cf')); if (!f.name.trim()) return toast('Nama wajib diisi', true); const row = { name: f.name.trim(), type: f.type, phone: f.phone.trim(), address: f.address.trim(), note: f.note.trim() };
        const ok = await safe(async () => { if (id) await upd('contacts', id, row); else await add('contacts', row); return true; }, 'Kontak disimpan'); if (ok) { closeModal(); render(); } } });
}

/* ---------------- PENGATURAN ---------------- */
PAGES.pengaturan = {
  html() {
    const b = S.biz, st = b.settings, m = mods(), ns = notifSet(), th = LS.get('bk_theme', 'auto');
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const sw = (name, on, fn) => `<label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="${fn}('${name}',this.checked)"><i></i></label>`;
    return `<div class="grid g2" style="align-items:start">
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h3>🏪 Profil Usaha</h3></div><form id="bizF">
        <div class="f-row" style="grid-template-columns:80px 1fr"><label class="f"><span>Ikon</span><input class="inp" name="emoji" value="${esc(st.emoji || '')}" maxlength="4" style="text-align:center;font-size:20px"></label><label class="f"><span>Nama usaha</span><input class="inp" name="name" value="${esc(b.name)}" required></label></div>
        <div class="f-row"><label class="f"><span>Jenis usaha</span><select class="inp" name="type">${Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}" ${b.type === k ? 'selected' : ''}>${t.emoji} ${t.label}</option>`).join('')}</select></label><label class="f"><span>Zona waktu</span><select class="inp" name="tz">${Object.entries(TIMEZONES).map(([k, v]) => `<option value="${k}" ${(st.tz || 'Asia/Jakarta') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
        <div class="f-row"><label class="f"><span>No HP usaha</span><input class="inp" name="phone" value="${esc(b.phone || '')}"></label><label class="f"><span>Target omzet / bulan</span>${moneyInput('target', st.target)}</label></div>
        <label class="f"><span>Alamat (tampil di struk)</span><input class="inp" name="address" value="${esc(b.address || '')}"></label>
        <button type="button" class="btn primary" onclick="saveBiz()">Simpan Profil</button></form></div>

      <div class="card"><div class="card-h"><h3>🧩 Fitur yang Ditampilkan</h3></div>${Object.entries(MODULES).map(([k, [l, d]]) => `<div class="set-row"><div class="t grow"><b>${l}</b><small>${d}</small></div>${sw(k, m[k], 'setMod')}</div>`).join('')}</div>

      <div class="card" id="set-notif"><div class="card-h"><h3>🔔 Notifikasi & Pengingat</h3></div>
        <div class="set-row"><div class="t grow"><b>Notifikasi perangkat (pop-up HP/PC)</b><small>${perm === 'granted' ? 'Izin diberikan ✅' : perm === 'denied' ? 'Diblokir — buka pengaturan browser/HP untuk mengizinkan' : perm === 'unsupported' ? 'Tidak didukung browser ini — install aplikasi dulu' : 'Belum diizinkan'}</small></div>${ns.push && perm === 'granted' ? sw('push', true, 'setNotif') : `<button class="btn sm primary" onclick="enablePush()">Aktifkan</button>`}</div>
        <p class="xs muted" style="margin:10px 0 2px">Pilih pemberitahuan yang ingin ditampilkan:</p>
        ${[['stok', 'Stok menipis / habis', 'Saat stok ≤ batas minimum produk'], ['piutang', 'Piutang jatuh tempo', 'Tagihan pelanggan mendekati / lewat tempo'], ['hutang', 'Hutang jatuh tempo', 'Kewajiban bayar mendekati / lewat tempo'], ['anggaran', 'Anggaran hampir habis', 'Pengeluaran kategori ≥ 80% batas'], ['target', 'Target omzet tercapai', 'Kabar gembira saat target bulanan tercapai'], ['catat', 'Pengingat catat transaksi', 'Jika belum ada transaksi hari ini'], ['harian', 'Pengingat catatan harian', 'Jika data produksi hari ini belum diisi'], ['ringkasan', 'Ringkasan harian', 'Total masuk & keluar setiap hari']].map(([k, l, d]) => `<div class="set-row"><div class="t grow"><b>${l}</b><small>${d}</small></div>${sw(k, ns[k], 'setNotif')}</div>`).join('')}
        <div class="f-row mt"><label class="f"><span>Jam pengingat harian</span><input class="inp" type="time" value="${ns.jam}" onchange="setNotif('jam',this.value)"></label><label class="f"><span>Ingatkan jatuh tempo (hari sebelum)</span><input class="inp" type="number" min="0" max="30" value="${ns.hari_jatuh_tempo}" onchange="setNotif('hari_jatuh_tempo',Number(this.value))"></label></div>
        <button class="btn sm" onclick="testNotif()">🔔 Kirim notifikasi uji</button>
        <p class="xs muted">${serverPush() ? '☁️ Push server aktif: pengingat dikirim dari server setiap 15 menit dan tetap muncul walau aplikasi ditutup.' : S.mode === 'cloud' ? 'Setelah diaktifkan, pengingat dikirim dari server dan tetap muncul walau aplikasi ditutup.' : 'Mode lokal: notifikasi diperiksa saat aplikasi dibuka & setiap 5 menit selama aplikasi berjalan.'}</p></div>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card"><div class="card-h"><h3>💳 Akun Kas, Bank & E-Wallet</h3><button class="btn sm" onclick="accountForm()">${ic('plus')}</button></div>
        <div class="list">${S.d.accounts.map(a => `<div class="li" onclick="accountForm('${a.id}')"><div class="av" style="background:${a.color || '#0d9488'}22">${a.type === 'kas' ? '💵' : a.type === 'bank' ? '🏦' : '📱'}</div><div class="grow"><div class="t">${esc(a.name)}</div><div class="s">Saldo awal ${money(a.opening_balance)}</div></div><b class="num">${money(accBalance(a))}</b></div>`).join('')}</div></div>

      <div class="card"><div class="card-h"><h3>🏷️ Kategori</h3><button class="btn sm" onclick="catForm()">${ic('plus')}</button></div>
        ${['in', 'out'].map(t => `<p class="xs muted" style="margin:8px 0 6px;font-weight:700">${t === 'in' ? 'PEMASUKAN' : 'PENGELUARAN'}</p><div class="row wrap gap-s">${cats(t).map(c => `<button class="chip" onclick="catForm('${c.id}')" style="border-color:${c.color || 'var(--line)'}">${esc(c.icon || '')} ${esc(c.name)}</button>`).join('')}</div>`).join('')}</div>

      <div class="card"><div class="card-h"><h3>📋 Kolom Catatan Harian</h3><button class="btn sm" onclick="metricForm()">${ic('plus')}</button></div>
        ${metrics().length ? `<div class="list">${metrics().map((x, i) => `<div class="li" onclick="metricForm(${i})"><div class="av">📈</div><div class="grow"><div class="t">${esc(x.label)}</div><div class="s">Satuan: ${esc(x.unit)} • ${x.agg === 'last' ? 'nilai terakhir' : x.agg === 'avg' ? 'rata-rata' : 'dijumlahkan'}</div></div></div>`).join('')}</div>` : '<p class="muted small">Belum ada. Contoh: produksi telur, pakan, panen, porsi terjual.</p>'}</div>

      <div class="card"><div class="card-h"><h3>🎨 Tampilan</h3></div><div class="seg">${[['auto', '🌗 Otomatis'], ['light', '☀️ Terang'], ['dark', '🌙 Gelap']].map(([k, l]) => `<button class="${th === k ? 'on' : ''}" onclick="setTheme('${k}')">${l}</button>`).join('')}</div>
        <button class="btn block install-btn ${isStandalone() ? 'hidden' : ''}" onclick="installApp()">${ic('install')} Install aplikasi ke perangkat ini</button></div>

      <div class="card"><div class="card-h"><h3>🗄️ Data & Akun</h3></div>
        <div class="set-row"><div class="t grow"><b>${S.mode === 'cloud' ? '☁️ Tersimpan di Supabase' : '📱 Mode Lokal'}</b><small>${S.mode === 'cloud' ? esc(S.user && S.user.email) : 'Data hanya ada di perangkat ini. Rutin backup ya!'}</small></div>${S.mode === 'local' ? `<button class="btn sm" onclick="LS.del('bk_mode');location.reload()">Hubungkan Cloud</button>` : ''}</div>
        <div class="row wrap mt"><button class="btn sm" onclick="backup()">${ic('download')} Backup (JSON)</button><label class="btn sm">${ic('upload')} Pulihkan<input type="file" accept=".json,application/json" hidden onchange="restore(this.files[0])"></label><button class="btn sm" onclick="exportCSV(S.d.transactions.slice().sort(sortTx),'semua-transaksi')">${ic('download')} Semua transaksi (CSV)</button></div>
        <div class="row wrap mt"><button class="btn sm danger" onclick="clearData()">Kosongkan data transaksi</button><button class="btn sm danger" onclick="deleteBiz()">Hapus usaha ini</button><button class="btn sm" onclick="logout()">${ic('logout')} Keluar</button></div></div>
    </div></div>`;
  }
};
async function saveBiz() {
  const f = formObj($('#bizF')); if (!f.name.trim()) return toast('Nama wajib diisi', true);
  const st = S.biz.settings; st.emoji = f.emoji.trim() || (TEMPLATES[f.type] || TEMPLATES.umum).emoji; st.target = parseMoney(f.target); st.tz = f.tz || 'Asia/Jakarta'; APP_TZ = st.tz;
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
async function setMod(k, v) { S.biz.settings.mods = { ...mods(), [k]: v }; await safe(() => updBiz({ settings: S.biz.settings })); shell(); render(); }
async function setNotif(k, v) { S.biz.settings.notif = { ...notifSet(), [k]: v }; await safe(() => updBiz({ settings: S.biz.settings })); updateBell(); if (k === 'push') render(); }
async function testNotif() {
  if (!('Notification' in window) || Notification.permission !== 'granted') { const ok = await enablePush(); if (!ok) return; }
  if (S.mode === 'cloud' && (serverPush() || await subscribePush(false))) {
    const { data, error } = await S.sb.functions.invoke('send-reminders', { body: { test: true } });
    if (error || !data || !data.sent) return toast('Push server gagal' + (error ? ': ' + error.message : ' (perangkat belum terdaftar)'), true);
    return toast('Notifikasi uji dikirim dari server ke ' + data.sent + ' perangkat');
  }
  showSysNotif('🔔 ' + S.biz.name, 'Notifikasi BukuKas berfungsi dengan baik!', 'dashboard', 'test-' + Date.now()); toast('Notifikasi uji dikirim');
}
function accountForm(id) {
  const a = id ? acc(id) : { name: '', type: 'kas', opening_balance: '', color: PALETTE[S.d.accounts.length % 12] };
  modal(id ? 'Edit Akun' : 'Akun Baru', `<form id="af"><label class="f"><span>Nama akun</span><input class="inp" name="name" value="${esc(a.name)}" placeholder="cth: Kas Laci, BRI, DANA" required autofocus></label>
    <div class="f-row"><label class="f"><span>Jenis</span><select class="inp" name="type">${[['kas', 'Kas tunai'], ['bank', 'Bank'], ['ewallet', 'E-Wallet / QRIS']].map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="f"><span>Warna</span><input class="inp" type="color" name="color" value="${a.color || '#0d9488'}" style="height:46px;padding:4px"></label></div>
    <label class="f"><span>Saldo awal</span>${moneyInput('opening_balance', a.opening_balance)}</label></form>`,
    { foot: `${id ? `<button class="btn danger" onclick="deleteAccount('${id}')">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="afs">Simpan</button>`,
      onMount: m => m.querySelector('#afs').onclick = async () => { const f = formObj($('#af')); if (!f.name.trim()) return toast('Nama wajib diisi', true); const row = { name: f.name.trim(), type: f.type, color: f.color, opening_balance: parseMoney(f.opening_balance) };
        const ok = await safe(async () => { if (id) await upd('accounts', id, row); else await add('accounts', row); return true; }, 'Akun disimpan'); if (ok) { closeModal(); render(); } } });
}
function deleteAccount(id) { if (S.d.transactions.some(t => t.account_id === id || t.to_account_id === id)) return toast('Akun sudah punya transaksi, tidak bisa dihapus', true); if (S.d.accounts.length <= 1) return toast('Minimal harus ada 1 akun', true); confirmBox('Hapus akun ini?', async () => { await safe(() => del('accounts', id), 'Akun dihapus'); render(); }); }
function catForm(id) {
  const c = id ? cat(id) : { name: '', type: 'out', icon: '🧾', color: PALETTE[S.d.categories.length % 12] };
  modal(id ? 'Edit Kategori' : 'Kategori Baru', `<form id="kf"><div class="f-row" style="grid-template-columns:80px 1fr"><label class="f"><span>Ikon</span><input class="inp" name="icon" value="${esc(c.icon || '')}" maxlength="4" style="text-align:center;font-size:20px"></label><label class="f"><span>Nama</span><input class="inp" name="name" value="${esc(c.name)}" required autofocus></label></div>
    <div class="f-row"><label class="f"><span>Jenis</span><select class="inp" name="type" ${id ? 'disabled' : ''}><option value="in" ${c.type === 'in' ? 'selected' : ''}>Pemasukan</option><option value="out" ${c.type === 'out' ? 'selected' : ''}>Pengeluaran</option></select></label><label class="f"><span>Warna</span><input class="inp" type="color" name="color" value="${c.color || '#0d9488'}" style="height:46px;padding:4px"></label></div>
    <p class="xs muted">Ide ikon: 💰 🛒 📦 🥚 🌽 💊 🐔 🍊 🚚 💡 🏠 👷 🧾 📣 🔧 🎁</p></form>`,
    { foot: `${id ? `<button class="btn danger" onclick="deleteCat('${id}')">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="kfs">Simpan</button>`,
      onMount: m => m.querySelector('#kfs').onclick = async () => { const f = formObj($('#kf')); if (!f.name.trim()) return toast('Nama wajib diisi', true); const row = { name: f.name.trim(), icon: f.icon.trim(), color: f.color }; if (!id) row.type = f.type;
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
  confirmBox('Hapus <b>semua transaksi, hutang/piutang, catatan harian & riwayat stok</b> usaha ini? Akun, kategori, produk & kontak tetap ada. Tindakan ini tidak bisa dibatalkan.', async () => {
    await safe(async () => {
      const ts = ['transactions', 'stock_moves', 'debts', 'production_logs'];
      if (S.mode === 'cloud') { for (const t of ts) { const { error } = await S.sb.from(t).delete().eq('business_id', S.biz.id); if (error) throw error; } }
      else { const db = Local.db(); ts.forEach(t => db[t] = (db[t] || []).filter(r => r.business_id !== S.biz.id)); Local.save(db); }
      ts.forEach(t => S.d[t] = []);
    }, 'Data dikosongkan'); render();
  }, 'Ya, kosongkan');
}
function deleteBiz() {
  modal('Hapus Usaha', `<p>Ketik <b>${esc(S.biz.name)}</b> untuk menghapus usaha ini beserta <b>seluruh</b> datanya secara permanen.</p><input class="inp" id="delName" autocomplete="off">`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn danger" id="delGo">Hapus Permanen</button>`, onMount: m => m.querySelector('#delGo').onclick = async () => {
      if ($('#delName').value.trim() !== S.biz.name) return toast('Nama tidak cocok', true);
      const ok = await safe(() => B().removeBiz(S.biz.id).then(() => true)); if (!ok) return;
      LS.del('bk_biz'); location.reload(); } });
}

/* jalankan */
boot();
