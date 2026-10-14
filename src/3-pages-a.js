/* =====================================================================
   HALAMAN: BERANDA, TRANSAKSI, KASIR
   ===================================================================== */
function mkChart(id, cfg) {
  const el = document.getElementById(id); if (!el) return;
  if (!window.Chart) { el.parentElement.innerHTML = '<div class="empty small">Grafik memerlukan koneksi internet saat pertama dibuka.</div>'; return; }
  Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif'; Chart.defaults.font.size = 12.5; Chart.defaults.color = cssVar('--text-2'); Chart.defaults.borderColor = cssVar('--line');
  const tt = Chart.defaults.plugins.tooltip; if (tt) { tt.backgroundColor = 'rgba(10,17,32,.92)'; tt.titleColor = '#fff'; tt.bodyColor = '#e5ecf7'; tt.padding = 12; tt.cornerRadius = 12; tt.titleFont = { weight: '700', size: 13 }; tt.bodyFont = { size: 13 }; tt.boxPadding = 6; tt.usePointStyle = true; }
  const c = new Chart(el, cfg); S.charts.push(c); return c;
}
const moneyTip = { callbacks: { label: c => ' ' + c.dataset.label + ': ' + money(c.parsed.y ?? c.parsed) } };
function buckets(r, filterFn = isPL) {
  const daily = r.len <= 62, keys = [];
  if (daily) for (let i = 0; i < r.len; i++) keys.push(addDays(r.from, i));
  else { const d = new Date(r.from + 'T00:00:00'); d.setDate(1); while (dstr(d) <= r.to) { keys.push(dstr(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); } }
  const inc = {}, out = {}; keys.forEach(k => { inc[k] = 0; out[k] = 0; });
  S.d.transactions.forEach(t => { if (!inR(t.date, r.from, r.to) || !filterFn(t)) return; const k = daily ? t.date : t.date.slice(0, 7); if (!(k in inc)) return; if (t.type === 'in') inc[k] += N(t.amount); else if (t.type === 'out') out[k] += N(t.amount); });
  const labels = daily ? keys.map(k => new Date(k + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })) : keys.map(k => BULAN[+k.slice(5, 7) - 1].slice(0, 3) + ' ' + k.slice(2, 4));
  return { keys, labels, inc: keys.map(k => inc[k]), out: keys.map(k => out[k]) };
}
function flowChart(id, r) {
  const b = buckets(r);
  mkChart(id, { type: 'bar', data: { labels: b.labels, datasets: [
    { label: 'Pemasukan', data: b.inc, backgroundColor: cssVar('--c-in'), borderRadius: 7, maxBarThickness: 22, order: 2 },
    { label: 'Pengeluaran', data: b.out, backgroundColor: cssVar('--c-out'), borderRadius: 7, maxBarThickness: 22, order: 2 },
    { label: 'Laba bersih', type: 'line', data: b.inc.map((v, i) => v - b.out[i]), borderColor: cssVar('--c-line'), backgroundColor: cssVar('--c-line'), tension: .35, pointRadius: b.labels.length > 31 ? 0 : 3, pointHoverRadius: 6, borderWidth: 2.5, order: 1 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, padding: 16, font: { weight: '600' } } }, tooltip: moneyTip },
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { border: { display: false }, grid: { color: cssVar('--line') }, ticks: { callback: v => short(v), maxTicksLimit: 6 } } } } });
}
function donut(id, type, r) {
  const m = {}; S.d.transactions.forEach(t => { if (t.type === type && isPL(t) && inR(t.date, r.from, r.to)) m[t.category_id] = (m[t.category_id] || 0) + N(t.amount); });
  const rows = Object.entries(m).sort((a, b) => b[1] - a[1]); if (!rows.length) return false;
  const total = sum(rows, x => x[1]); const top = rows.slice(0, 6); if (rows.length > 6) top.push(['_other', sum(rows.slice(6), x => x[1])]);
  const center = { id: 'center', afterDraw(ch) { const { ctx, chartArea: a } = ch; if (!a) return; const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2; ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = cssVar('--muted'); ctx.font = '600 11px "Plus Jakarta Sans",sans-serif'; ctx.fillText('Total', x, y - 9); ctx.fillStyle = cssVar('--text'); ctx.font = '800 15px "Plus Jakarta Sans",sans-serif'; ctx.fillText(document.body.classList.contains('privacy') ? '•••' : 'Rp ' + short(total), x, y + 10); ctx.restore(); } };
  mkChart(id, { type: 'doughnut', plugins: [center], data: { labels: top.map(x => x[0] === '_other' ? 'Lainnya' : ((cat(x[0]) || {}).name || '-')), datasets: [{ data: top.map(x => x[1]), backgroundColor: top.map((x, i) => x[0] === '_other' ? '#94a3b8' : ((cat(x[0]) || {}).color || PALETTE[i % 12])), borderWidth: 3, borderColor: cssVar('--surface'), hoverOffset: 8 }] },
    options: { maintainAspectRatio: false, cutout: '66%', plugins: { legend: { position: window.innerWidth < 640 ? 'bottom' : 'right', labels: { usePointStyle: true, boxWidth: 10, padding: 12, font: { size: 12.5, weight: '600' }, generateLabels: ch => ch.data.labels.map((l, i) => ({ text: l + '  ' + Math.round(ch.data.datasets[0].data[i] / total * 100) + '%', fillStyle: ch.data.datasets[0].backgroundColor[i], strokeStyle: 'transparent', pointStyle: 'circle', index: i, fontColor: cssVar('--text-2') })) } }, tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + money(c.parsed) + ' (' + Math.round(c.parsed / total * 100) + '%)' } } } } });
  return true;
}
function trendHTML(cur, prev, invert) {
  if (!prev) return '<span class="trend muted">—</span>';
  const ch = (cur - prev) / Math.abs(prev) * 100, up = ch >= 0, good = invert ? !up : up;
  return `<span class="trend ${good ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(ch).toFixed(Math.abs(ch) < 10 ? 1 : 0)}%</span>`;
}
const periodChips = (key, set) => `<div class="chips">${[['today', 'Hari ini'], ['7d', '7 Hari'], ['month', 'Bulan ini'], ['lastmonth', 'Bulan lalu'], ['year', 'Tahun ini'], ['all', 'Semua'], ['custom', 'Pilih tanggal']].map(([k, l]) => `<button class="chip ${key === k ? 'on' : ''}" onclick="${set}('${k}')">${l}</button>`).join('')}</div>`;
function setPeriod(k) { if (k === 'custom') return customRange(() => { S.period = 'custom'; render(); }); S.period = k; render(); }
function customRange(cb) {
  modal('Pilih Rentang Tanggal', `<form id="crf"><div class="f-row"><label class="f"><span>Dari</span><input class="inp" type="date" name="from" value="${S.custom.from}" required></label><label class="f"><span>Sampai</span><input class="inp" type="date" name="to" value="${S.custom.to}" required></label></div><button class="btn primary block">Terapkan</button></form>`,
    { onMount: m => m.querySelector('#crf').onsubmit = e => { e.preventDefault(); const f = formObj(e.target); if (f.from > f.to) return toast('Tanggal awal harus sebelum tanggal akhir', true); S.custom = f; closeModal(); cb(); } });
}
function txRow(t) {
  const c = cat(t.category_id), col = (c && c.color) || (t.type === 'in' ? '#059669' : t.type === 'out' ? '#dc2626' : '#4f46e5');
  const sub = [t.type === 'transfer' ? ((acc(t.account_id) || {}).name || '?') + ' → ' + ((acc(t.to_account_id) || {}).name || '?') : (acc(t.account_id) || {}).name, t.contact_id ? contactName(t.contact_id) : '', t.ref === 'sale' && t.items ? t.items.length + ' item' : '', t.note].filter(Boolean).map(esc).join(' • ');
  return `<div class="li" onclick="txForm('${t.id}')"><div class="av" style="background:${col}1f">${txIcon(t)}</div><div class="grow"><div class="t ell">${esc(txTitle(t))}</div><div class="s ell">${sub || '&nbsp;'}</div></div><div class="amt num ${t.type === 'in' ? 'c-in' : t.type === 'out' ? 'c-out' : ''}">${t.type === 'in' ? '+' : t.type === 'out' ? '−' : ''}${money(t.amount)}</div></div>`;
}
const sortTx = (a, b) => a.date === b.date ? String(b.created_at || '').localeCompare(String(a.created_at || '')) : (a.date < b.date ? 1 : -1);

/* ---------------- BERANDA ---------------- */
PAGES.dashboard = {
  html() {
    const r = range(S.period), T = totals(r.from, r.to), P = totals(r.prevFrom, r.prevTo), m = mods();
    const margin = pct(T.profit, T.inc), bal = totalBalance();
    const recent = [...S.d.transactions].sort(sortTx).slice(0, 7);
    const mr = monthRange(0), mInc = totals(mr.from, mr.to).inc, target = N(S.biz.settings.target), tp = target ? Math.min(100, pct(mInc, target)) : 0;
    const alerts = computeAlerts().filter(a => a.lv !== 'info').slice(0, 4);
    const ins = insights(r, T, P);
    return `
    <div class="mb">${periodChips(S.period, 'setPeriod')}</div>
    <div class="grid g-dash mb">
      <div class="hero">
        <div class="lbl" style="justify-content:space-between">Total Saldo Usaha<button type="button" onclick="balanceAll()" style="background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:10px;padding:4px 10px;font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">${ic('edit')} Ubah saldo</button></div>
        <div class="val num">${money(bal)}</div>
        <div class="acc-chips">${S.d.accounts.map(a => `<div class="acc-chip" role="button" tabindex="0" style="cursor:pointer" title="Ubah saldo ${esc(a.name)}" onclick="balanceForm('${a.id}')"><small>${esc(a.name)} ✎</small><b class="num">${money(accBalance(a))}</b></div>`).join('')}</div>
        <div class="hero-actions">
          <button onclick="txForm(null,'in')">${ic('up')}Pemasukan</button>
          <button onclick="txForm(null,'out')">${ic('down')}Pengeluaran</button>
          ${m.kasir ? `<button onclick="go('kasir')">${ic('cart')}Kasir</button>` : `<button onclick="txForm(null,'transfer')">${ic('swap')}Transfer</button>`}
          <button onclick="go('laporan')">${ic('chart')}Laporan</button>
        </div>
      </div>
      <div class="card"><div class="card-h"><h3>Target Omzet ${BULAN[+today().slice(5, 7) - 1]}</h3><button class="btn sm ghost" onclick="targetForm()">${ic('edit')}</button></div>
        ${target ? `<div class="row" style="gap:16px"><div class="ring" style="--p:${tp}"><div>${Math.round(tp)}%</div></div><div><div class="muted small">Tercapai</div><div style="font-weight:800;font-size:18px" class="num">${money(mInc)}</div><div class="muted small">dari ${money(target)}</div>${mInc < target ? `<div class="xs muted" style="margin-top:4px">Kurang ${money(target - mInc)} • ${Math.max(1, diffDays(today(), mr.to) + 1)} hari lagi</div>` : '<span class="pill in" style="margin-top:6px">🏆 Target tercapai</span>'}</div></div>`
          : `<div class="empty" style="padding:14px"><div class="e">🎯</div><p class="small" style="margin:4px 0 10px">Tetapkan target omzet bulanan untuk memantau progres usaha.</p><button class="btn sm primary" onclick="targetForm()">Atur Target</button></div>`}
      </div>
    </div>
    <div class="grid g4 mb">
      ${kpi('Pemasukan', T.inc, P.inc, 'up', 'var(--in)', 'var(--in-soft)')}
      ${kpi('Pengeluaran', T.out, P.out, 'down', 'var(--out)', 'var(--out-soft)', true)}
      ${kpi('Laba Bersih', T.profit, P.profit, 'chart', 'var(--info)', 'var(--info-soft)')}
      ${m.kasir && T.omzet ? kpi('Laba Kotor Penjualan', T.gross, P.gross, 'cart', 'var(--warn)', 'var(--warn-soft)', false, 'Margin ' + pct(T.gross, T.omzet).toFixed(1) + '%') : kpi('Margin Laba', null, null, 'target', 'var(--warn)', 'var(--warn-soft)', false, margin.toFixed(1) + '%')}
    </div>
    <div class="grid g-dash mb">
      <div class="card"><div class="card-h"><h3>Arus Kas — ${esc(r.label)}</h3><span class="muted xs">${r.len > 62 ? 'per bulan' : 'per hari'}</span></div><div class="chart-box"><canvas id="cFlow"></canvas></div></div>
      <div class="card"><div class="card-h"><h3>💡 Wawasan Usaha</h3></div>${ins.map(i => `<div class="insight"><span>${i[0]}</span><span>${i[1]}</span></div>`).join('') || '<p class="muted small">Belum cukup data. Mulai catat transaksi.</p>'}</div>
    </div>
    <div class="grid g-dash mb">
      <div class="card"><div class="card-h"><h3>Transaksi Terbaru</h3><button class="btn sm" onclick="go('transaksi')">Lihat semua</button></div>
        <div class="list">${recent.length ? recent.map(txRow).join('') : `<div class="empty"><div class="e">🧾</div><p>Belum ada transaksi.</p><button class="btn primary sm" onclick="quickAdd()">${ic('plus')} Catat sekarang</button></div>`}</div></div>
      <div class="grid" style="align-content:start">
        <div class="card"><div class="card-h"><h3>Komposisi Pengeluaran</h3></div><div class="chart-box sm"><canvas id="cDonut"></canvas></div></div>
        ${alerts.length ? `<div class="card"><div class="card-h"><h3>⚠️ Perlu Perhatian</h3><button class="btn sm ghost" onclick="openAlerts()">Semua</button></div>${alerts.map(alertHTML).join('')}</div>` : ''}
      </div>
    </div>
    ${m.harian && metrics().length ? prodSummaryCard(r) : ''}
    ${m.kasir ? topProductsCard(r) : ''}`;
  },
  mount() {
    const r = range(S.period); flowChart('cFlow', r);
    if (!donut('cDonut', 'out', r)) { const c = $('#cDonut'); if (c) c.parentElement.innerHTML = '<div class="empty small">Belum ada pengeluaran pada periode ini.</div>'; }
    const m0 = metrics()[0] && (metrics().find(x => x.key === 'butir') || metrics().find(x => x.agg !== 'last') || metrics()[0]);
    if (m0 && $('#cProd')) { const logs = S.d.production_logs.filter(l => inR(l.date, r.from, r.to)).sort((a, b) => a.date < b.date ? -1 : 1);
      mkChart('cProd', { type: 'line', data: { labels: logs.map(l => fmtDate(l.date).replace(/ \d{4}$/, '')), datasets: [{ label: m0.label, data: logs.map(l => N(l.vals && l.vals[m0.key])), borderColor: cssVar('--primary'), backgroundColor: cssVar('--primary-soft'), fill: true, tension: .35, pointRadius: 0, borderWidth: 2 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0 } } } } }); }
  }
};
function kpi(label, val, prev, icon, col, bg, invert, alt) {
  return `<div class="card kpi"><div class="k-top"><span class="k-lbl">${label}</span><span class="k-ic" style="background:${bg};color:${col}">${ic(icon)}</span></div>
  <div class="k-val num" ${label === 'Laba Bersih' && val < 0 ? 'style="color:var(--out)"' : ''}>${val === null ? alt : money(val)}</div>
  <div class="row between">${val === null ? '<span class="xs muted">dari total pemasukan</span>' : trendHTML(val, prev, invert)}<span class="xs muted">${val === null ? '' : alt || 'vs periode lalu'}</span></div></div>`;
}
function insights(r, T, P) {
  const out = [];
  const exp = {}; S.d.transactions.forEach(t => { if (t.type === 'out' && isPL(t) && inR(t.date, r.from, r.to)) exp[t.category_id] = (exp[t.category_id] || 0) + N(t.amount); });
  const top = Object.entries(exp).sort((a, b) => b[1] - a[1])[0];
  if (top) out.push(['🧾', `Pengeluaran terbesar: <b>${esc((cat(top[0]) || {}).name)}</b> (${pct(top[1], T.out).toFixed(0)}% dari total biaya).`]);
  if (T.inc) out.push(['📅', `Rata-rata pemasukan <b>${money(T.inc / r.len)}</b> per hari.`]);
  const byDay = {}; S.d.transactions.forEach(t => { if (t.type === 'in' && isPL(t) && inR(t.date, r.from, r.to)) byDay[t.date] = (byDay[t.date] || 0) + N(t.amount); });
  const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  if (best && r.len > 1) out.push(['🏅', `Hari terbaik: <b>${fmtDate(best[0])}</b> dengan pemasukan ${money(best[1])}.`]);
  if (P.profit && T.profit !== P.profit) { const up = T.profit > P.profit; out.push([up ? '📈' : '📉', `Laba ${up ? 'naik' : 'turun'} <b>${money(Math.abs(T.profit - P.profit))}</b> dibanding periode sebelumnya.`]); }
  if (T.profit < 0) out.push(['⚠️', 'Pengeluaran lebih besar dari pemasukan. Tinjau biaya terbesar Anda.']);
  const pi = sum(openDebts('piutang'), debtLeft); if (pi) out.push(['📥', `Uang di pelanggan (piutang) belum tertagih: <b>${money(pi)}</b>.`]);
  const low = S.d.products.filter(p => p.track_stock !== false && N(p.min_stock) > 0 && stockOf(p) <= N(p.min_stock)).length; if (low) out.push(['📦', `<b>${low} produk</b> stoknya menipis — segera belanja ulang.`]);
  return out.slice(0, 6);
}
function prodSummaryCard(r) {
  const logs = S.d.production_logs.filter(l => inR(l.date, r.from, r.to));
  return `<div class="card mb"><div class="card-h"><h3>📋 Catatan Harian — ${esc(r.label)}</h3><button class="btn sm" onclick="go('harian')">Detail</button></div>
  <div class="grid g4 mb">${metrics().slice(0, 4).map(m => { const v = metricAgg(m, logs); return `<div><div class="muted xs">${esc(m.label)} ${m.agg === 'last' ? '(terakhir)' : m.agg === 'avg' ? '(rata-rata)' : '(total)'}</div><div style="font-weight:800;font-size:18px" class="num">${v === null ? '-' : numf(v, 1)} <small class="muted">${esc(m.unit)}</small></div></div>`; }).join('')}</div>
  <div class="chart-box sm"><canvas id="cProd"></canvas></div></div>`;
}
function topProductsCard(r) {
  const rows = productSales(r).slice(0, 5); if (!rows.length) return '';
  const max = rows[0].rev || 1;
  return `<div class="card mb"><div class="card-h"><h3>🔥 Produk Terlaris</h3><span class="muted xs">${esc(r.label)}</span></div>${rows.map(x => `<div style="margin-bottom:12px"><div class="row between small"><b class="ell">${esc(x.name)}</b><span class="num">${numf(x.qty, 2)} terjual • ${money(x.rev)}</span></div><div class="prog mt" style="margin-top:6px"><i style="width:${pct(x.rev, max)}%"></i></div></div>`).join('')}</div>`;
}
function productSales(r) {
  const m = {}; S.d.transactions.forEach(t => { if (t.ref !== 'sale' || !t.items || !inR(t.date, r.from, r.to)) return; t.items.forEach(it => { const k = it.pid || it.name; m[k] = m[k] || { name: it.name, qty: 0, rev: 0, cost: 0 }; m[k].qty += N(it.qty); m[k].rev += N(it.qty) * N(it.price); m[k].cost += N(it.qty) * N(it.cost); }); });
  return Object.values(m).sort((a, b) => b.rev - a.rev);
}
function targetForm() {
  modal('Target Omzet Bulanan', `<form id="tf"><label class="f"><span>Target pemasukan per bulan</span>${moneyInput('target', S.biz.settings.target, 'autofocus')}</label><p class="muted xs">Kosongkan untuk menonaktifkan target.</p><button class="btn primary block">Simpan</button></form>`,
    { onMount: m => m.querySelector('#tf').onsubmit = async e => { e.preventDefault(); S.biz.settings.target = parseMoney(formObj(e.target).target); await safe(() => updBiz({ settings: S.biz.settings }), 'Target disimpan'); closeModal(); render(); } });
}

/* ---------------- TRANSAKSI ---------------- */
PAGES.transaksi = {
  html() {
    const f = S.tx;
    return `<div class="toolbar">
      <div class="search"><span>${ic('search')}</span><input class="inp" placeholder="Cari catatan, kategori, kontak…" value="${esc(f.q)}" oninput="S.tx.q=this.value;S.tx.limit=150;txList()"></div>
      <select class="inp" style="width:auto" onchange="S.tx.cat=this.value;txList()"><option value="">Semua kategori</option>${S.d.categories.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.type === 'in' ? '⬆' : '⬇'} ${esc(c.name)}</option>`).join('')}</select>
      <select class="inp" style="width:auto" onchange="S.tx.acc=this.value;txList()"><option value="">Semua akun</option>${S.d.accounts.map(a => `<option value="${a.id}" ${f.acc === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      <button class="btn" onclick="exportCSV()">${ic('download')}<span class="hide-sm">CSV</span></button>
      <button class="btn primary desk-only" onclick="txForm(null,'in')">${ic('plus')} Transaksi</button>
    </div>
    <div class="mb">${periodChips(f.period, 'txPeriod')}</div>
    <div class="chips mb">${[['all', 'Semua'], ['in', 'Pemasukan'], ['out', 'Pengeluaran'], ['transfer', 'Transfer'], ['sale', 'Penjualan Kasir']].map(([k, l]) => `<button class="chip ${f.type === k ? 'on' : ''}" onclick="S.tx.type='${k}';render()">${l}</button>`).join('')}</div>
    <div class="grid g3 mb" id="txSum"></div>
    <div class="card"><div class="list" id="txList"></div></div>`;
  },
  mount() { txList(); }
};
function txPeriod(k) { if (k === 'custom') return customRange(() => { S.tx.period = 'custom'; render(); }); S.tx.period = k; render(); }
function txFiltered() {
  const f = S.tx, r = range(f.period), q = f.q.trim().toLowerCase();
  return S.d.transactions.filter(t => {
    if (!inR(t.date, r.from, r.to)) return false;
    if (f.type === 'sale' ? t.ref !== 'sale' : (f.type !== 'all' && t.type !== f.type)) return false;
    if (f.cat && t.category_id !== f.cat) return false;
    if (f.acc && t.account_id !== f.acc && t.to_account_id !== f.acc) return false;
    if (q) { const s = [txTitle(t), t.note, contactName(t.contact_id, ''), (acc(t.account_id) || {}).name, t.items ? t.items.map(i => i.name).join(' ') : ''].join(' ').toLowerCase(); if (!s.includes(q)) return false; }
    return true;
  }).sort(sortTx);
}
function txList() {
  const rows = txFiltered(), lim = S.tx.limit || 150;
  const ti = sum(rows.filter(t => t.type === 'in'), t => t.amount), to = sum(rows.filter(t => t.type === 'out'), t => t.amount);
  $('#txSum').innerHTML = `<div class="card kpi"><span class="k-lbl">Total Masuk</span><div class="k-val c-in num">${money(ti)}</div></div><div class="card kpi"><span class="k-lbl">Total Keluar</span><div class="k-val c-out num">${money(to)}</div></div><div class="card kpi"><span class="k-lbl">Selisih • ${rows.length} transaksi</span><div class="k-val num">${money(ti - to)}</div></div>`;
  if (!rows.length) { $('#txList').innerHTML = `<div class="empty"><div class="e">🔍</div><p>Tidak ada transaksi yang cocok.</p><button class="btn primary sm" onclick="txForm(null,'in')">${ic('plus')} Tambah transaksi</button></div>`; return; }
  let html = '', cur = null; const byDate = {};
  rows.forEach(t => { byDate[t.date] = byDate[t.date] || 0; byDate[t.date] += t.type === 'in' ? N(t.amount) : t.type === 'out' ? -N(t.amount) : 0; });
  rows.slice(0, lim).forEach(t => { if (t.date !== cur) { cur = t.date; html += `<div class="day-h"><span>${fmtDay(t.date)}</span><span class="num ${byDate[cur] >= 0 ? 'c-in' : 'c-out'}">${byDate[cur] >= 0 ? '+' : '−'}${money(Math.abs(byDate[cur]))}</span></div>`; } html += txRow(t); });
  if (rows.length > lim) html += `<button class="btn block mt" onclick="S.tx.limit=${lim + 300};txList()">Tampilkan lebih banyak (${rows.length - lim} lagi)</button>`;
  $('#txList').innerHTML = html;
}
function exportCSV(rows = txFiltered(), name = 'transaksi') {
  const head = ['Tanggal', 'Jenis', 'Kategori', 'Akun', 'Ke Akun', 'Kontak', 'Jumlah', 'HPP', 'Rincian', 'Catatan'];
  const lines = [head].concat(rows.map(t => [t.date, t.type === 'in' ? 'Pemasukan' : t.type === 'out' ? 'Pengeluaran' : 'Transfer', txTitle(t), (acc(t.account_id) || {}).name || '', (acc(t.to_account_id) || {}).name || '', contactName(t.contact_id, ''), N(t.amount), N(t.cost), t.items ? t.items.map(i => `${i.name} x${i.qty}`).join('; ') : '', t.note || '']));
  download(name + '-' + S.biz.name.replace(/\W+/g, '_') + '-' + today() + '.csv', '\ufeff' + lines.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\n'), 'text/csv');
}
function download(name, content, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

function txForm(id, type = 'in', preset = {}) {
  const t = id ? byId('transactions', id) : null; if (t) type = t.type;
  if (!S.d.accounts.length) return toast('Tambahkan akun kas/bank dulu di Pengaturan', true);
  const lockAmt = t && (t.ref === 'sale' || t.ref === 'purchase');
  const v = t || { date: today(), amount: preset.amount || '', category_id: preset.category_id || '', account_id: S.d.accounts[0].id, to_account_id: (S.d.accounts[1] || {}).id, note: '', contact_id: '' };
  const cl = cats(type === 'transfer' ? 'x' : type), noCat = t && (t.ref === 'adjust' || (t.ref === 'debt' && !t.category_id));
  const title = t ? 'Detail Transaksi' : type === 'in' ? 'Catat Pemasukan' : type === 'out' ? 'Catat Pengeluaran' : 'Transfer Saldo';
  const body = `<form id="txf">
    ${!t ? `<div class="seg"><button type="button" class="${type === 'in' ? 'on in' : ''}" onclick="txForm(null,'in')">⬆ Pemasukan</button><button type="button" class="${type === 'out' ? 'on out' : ''}" onclick="txForm(null,'out')">⬇ Pengeluaran</button><button type="button" class="${type === 'transfer' ? 'on' : ''}" onclick="txForm(null,'transfer')">🔁 Transfer</button></div>` : `<div class="row mb"><span class="pill ${type === 'in' ? 'in' : type === 'out' ? 'out' : 'info'}">${type === 'in' ? 'Pemasukan' : type === 'out' ? 'Pengeluaran' : 'Transfer'}</span>${t.ref ? `<span class="pill neutral">${t.ref === 'sale' ? 'Penjualan kasir' : t.ref === 'purchase' ? 'Pembelian stok' : t.ref === 'adjust' ? 'Penyesuaian saldo — tidak dihitung laba/rugi' : 'Hutang/Piutang'}</span>` : ''}</div>`}
    ${t && t.items ? `<div class="card mb" style="background:var(--surface-2);padding:12px">${t.items.map(i => `<div class="row between small"><span>${esc(i.name)} × ${numf(i.qty, 2)}</span><b class="num">${money(N(i.qty) * N(i.price))}</b></div>`).join('')}${sum(t.items, i => N(i.qty) * N(i.price)) - N(t.amount) > 0 ? `<div class="row between small muted"><span>Diskon</span><span>−${money(sum(t.items, i => N(i.qty) * N(i.price)) - N(t.amount))}</span></div>` : ''}${t.ref === 'sale' ? `<div class="row between xs muted" style="margin-top:6px"><span>Modal (HPP)</span><span>${money(t.cost)} • laba ${money(N(t.amount) - N(t.cost))}</span></div>` : ''}</div>` : ''}
    <label class="f"><span>Jumlah</span><input class="inp big num ${type === 'in' ? 'c-in' : type === 'out' ? 'c-out' : ''}" name="amount" inputmode="numeric" oninput="mfmt(this)" value="${mval(v.amount)}" placeholder="0" ${lockAmt ? 'readonly' : ''} autofocus></label>
    ${type !== 'transfer' && !noCat ? `<label class="f"><span>Kategori</span></label><input type="hidden" name="category_id" value="${v.category_id || ''}">
      <div class="cat-grid" id="catGrid">${cl.map(c => catOpt(c, v.category_id)).join('')}<div class="cat-opt" onclick="quickCat('${type}')"><span class="e">➕</span>Baru</div></div>` : ''}
    <div class="f-row">
      <label class="f"><span>${type === 'transfer' ? 'Dari akun' : type === 'in' ? 'Masuk ke' : 'Dibayar dari'}</span><select class="inp" name="account_id">${S.d.accounts.map(a => `<option value="${a.id}" ${v.account_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      ${type === 'transfer' ? `<label class="f"><span>Ke akun</span><select class="inp" name="to_account_id">${S.d.accounts.map(a => `<option value="${a.id}" ${v.to_account_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>` :
      `<label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${v.date}" required></label>`}
    </div>
    ${type === 'transfer' ? `<label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${v.date}" required></label>` :
    `<label class="f"><span>Kontak (opsional)</span><select class="inp" name="contact_id"><option value="">— tidak ada —</option>${S.d.contacts.map(c => `<option value="${c.id}" ${v.contact_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`}
    <label class="f"><span>Catatan</span><input class="inp" name="note" value="${esc(v.note)}" placeholder="cth: belanja pakan 5 sak"></label>
  </form>`;
  modal(title, body, { foot: `${t ? `<button class="btn danger" onclick="deleteTx('${t.id}')">${ic('trash')}Hapus</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="txSave">${ic('check')}Simpan</button>`,
    onMount: m => { m.querySelector('#txSave').onclick = () => saveTx(id, type); m.querySelector('#txf').onsubmit = e => { e.preventDefault(); saveTx(id, type); }; } });
}
const catOpt = (c, sel) => `<div class="cat-opt ${sel === c.id ? 'on' : ''}" data-id="${c.id}" onclick="pickCat(this)"><span class="e">${esc(c.icon || '🏷️')}</span><span class="ell" style="display:block">${esc(c.name)}</span></div>`;
function pickCat(el) { $$('#catGrid .cat-opt').forEach(x => x.classList.remove('on')); el.classList.add('on'); $('#txf [name=category_id]').value = el.dataset.id; }
function quickCat(type) {
  const g = $('#catGrid'); if (!g || $('#qcBox')) return $('#qcBox input') && $('#qcBox input').focus();
  g.insertAdjacentHTML('beforebegin', `<div class="row mb" id="qcBox"><input class="inp" placeholder="Nama kategori ${type === 'in' ? 'pemasukan' : 'pengeluaran'} baru" maxlength="40" onkeydown="if(event.key==='Enter'){event.preventDefault();quickCatSave('${type}')}"><button type="button" class="btn primary" onclick="quickCatSave('${type}')">${ic('check')}</button><button type="button" class="btn" onclick="$('#qcBox').remove()">${ic('x')}</button></div>`);
  $('#qcBox input').focus();
}
async function quickCatSave(type) {
  const inp = $('#qcBox input'), name = inp.value.trim(); if (!name) return inp.focus();
  if (cats(type).some(c => c.name.toLowerCase() === name.toLowerCase())) return toast('Kategori "' + name + '" sudah ada', true);
  const c = await safe(() => add('categories', { name, type, icon: type === 'in' ? '💰' : '🧾', color: PALETTE[S.d.categories.length % 12] })); if (!c) return;
  $('#qcBox').remove(); const g = $('#catGrid'); g.insertAdjacentHTML('afterbegin', catOpt(c)); pickCat(g.firstElementChild); toast('Kategori ditambahkan');
}
async function saveTx(id, type) {
  const f = formObj($('#txf')), t = id ? byId('transactions', id) : null, amount = parseMoney(f.amount);
  if (!amount) return toast('Isi jumlah transaksi', true);
  if (!f.date) return toast('Isi tanggal transaksi', true);
  if (!f.account_id) return toast('Pilih akun', true);
  if (t && t.ref === 'debt' && t.debt_id && isDebtPay(t)) { const d = byId('debts', t.debt_id); if (d && N(d.paid) + amount - N(t.amount) > N(d.amount) + 0.5) return toast('Melebihi total ' + (d.kind === 'piutang' ? 'piutang' : 'hutang') + ' (' + money(d.amount) + ')', true); }
  const noCat = t && (t.ref === 'adjust' || (t.ref === 'debt' && !t.category_id));
  if (type !== 'transfer' && !noCat && !f.category_id) return toast('Pilih kategori', true);
  if (type === 'transfer' && f.account_id === f.to_account_id) return toast('Akun asal dan tujuan harus berbeda', true);
  const row = { date: f.date, type, amount, account_id: f.account_id, note: f.note.trim(), category_id: type === 'transfer' ? null : f.category_id, to_account_id: type === 'transfer' ? f.to_account_id : null, contact_id: f.contact_id || null };
  const btn = $('#txSave'); busy(btn, true);
  const ok = await safe(async () => {
    if (t) {
      if (t.ref === 'sale' || t.ref === 'purchase') { delete row.amount; delete row.type; }
      if (t.ref === 'debt' && t.debt_id && amount !== N(t.amount)) { const d = byId('debts', t.debt_id); if (d && isDebtPay(t)) await upd('debts', d.id, { paid: Math.max(0, N(d.paid) + amount - N(t.amount)) }); }
      if (t.ref === 'debt' || t.ref === 'adjust') row.category_id = t.category_id || null;
      await upd('transactions', t.id, row);
    } else await add('transactions', row);
    return true;
  }, t ? 'Perubahan disimpan' : 'Transaksi tersimpan ✅');
  busy(btn, false); if (ok) { closeModal(); render(); }
}
function deleteTx(id) {
  const t = byId('transactions', id); if (!t) return;
  const note = t.ref === 'sale' ? ' Stok barang akan dikembalikan.' : t.ref === 'purchase' ? ' Stok barang akan dikurangi kembali.' : t.ref === 'debt' && isDebtPay(t) ? ' Sisa hutang/piutang akan bertambah lagi.' : '';
  confirmBox('Hapus transaksi <b>' + esc(txTitle(t)) + '</b> sebesar <b>' + money(t.amount) + '</b>?' + note, async () => {
    await safe(async () => {
      if ((t.ref === 'sale' || t.ref === 'purchase') && t.items) {
        for (const mv of S.d.stock_moves.filter(x => x.transaction_id === t.id)) await del('stock_moves', mv.id);
      }
      if (t.ref === 'debt' && t.debt_id && isDebtPay(t)) { const d = byId('debts', t.debt_id); if (d) await upd('debts', d.id, { paid: Math.max(0, N(d.paid) - N(t.amount)) }); }
      await del('transactions', id);
    }, 'Transaksi dihapus');
    render();
  });
}

/* ---------------- KASIR ---------------- */
S.kasir = { q: '', grp: '' };
PAGES.kasir = {
  html() {
    const groups = [...new Set(S.d.products.filter(p => p.active !== false).map(p => p.group_name).filter(Boolean))];
    return `<div class="pos">
      <div>
        <div class="toolbar"><div class="search"><span>${ic('search')}</span><input class="inp" id="posQ" placeholder="Cari produk / kode…" value="${esc(S.kasir.q)}" oninput="S.kasir.q=this.value;renderPGrid()"></div>
          <button class="btn" onclick="manualItem()">${ic('plus')} Item manual</button></div>
        ${groups.length ? `<div class="chips mb"><button class="chip ${!S.kasir.grp ? 'on' : ''}" onclick="S.kasir.grp='';render()">Semua</button>${groups.map(g => `<button class="chip ${S.kasir.grp === g ? 'on' : ''}" data-g="${esc(g)}" onclick="S.kasir.grp=this.dataset.g;render()">${esc(g)}</button>`).join('')}</div>` : ''}
        <div class="pgrid" id="pgrid"></div>
      </div>
      <div class="card cart"><div class="card-h"><h3>🛒 Keranjang</h3><button class="btn sm danger" id="cartClear" onclick="cartClear()">${ic('trash')} Batalkan</button></div><div id="cartBox"></div></div>
    </div>
    <div class="cart-bar" id="cartBar" onclick="checkoutForm()"></div>`;
  },
  mount() { renderPGrid(); renderCart(); }
};
function renderPGrid() {
  const q = S.kasir.q.trim().toLowerCase();
  const ps = S.d.products.filter(p => p.active !== false && (!S.kasir.grp || p.group_name === S.kasir.grp) && (!q || (p.name + ' ' + (p.sku || '')).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  const g = $('#pgrid'); if (!g) return;
  g.innerHTML = ps.length ? ps.map(p => { const inCart = S.cart.find(c => c.pid === p.id); const low = p.track_stock !== false && stockOf(p) <= N(p.min_stock);
    return `<div class="pcard ${low ? 'low' : ''}" role="button" tabindex="0" onclick="cartAdd('${p.id}')" onkeydown="if(event.key==='Enter')cartAdd('${p.id}')">${inCart ? `<span class="q">${numf(inCart.qty, 2)}</span>` : ''}<div class="pe">${esc(initials(p.name))}</div><b>${esc(p.name)}</b><span class="ps">${p.track_stock !== false ? (stockOf(p) <= 0 ? 'Stok habis' : 'Stok ' + numf(stockOf(p), 2) + ' ' + esc(p.unit || '')) : esc(p.unit || 'item')}</span><span class="pp num">${money(p.sell_price)}</span></div>`; }).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="e">📦</div><p>${S.d.products.length ? 'Produk tidak ditemukan.' : 'Belum ada produk.'}</p><button class="btn primary sm" onclick="productForm()">${ic('plus')} Tambah Produk</button></div>`;
}
const cartTotal = () => sum(S.cart, c => N(c.qty) * N(c.price));
function cartChanged() { renderCart(); renderPGrid(); if ($('#coItems')) { if (!S.cart.length) { closeModal(); toast('Keranjang dikosongkan'); } else { $('#coItems').innerHTML = coItemsHTML(); coCalc(); } } }
function cartAdd(pid) {
  const p = prod(pid); if (!p) return; const c = S.cart.find(x => x.pid === pid);
  if (c) c.qty = N(c.qty) + 1; else S.cart.push({ pid, name: p.name, price: N(p.sell_price), cost: N(p.buy_price), qty: 1, unit: p.unit });
  const q = (c || S.cart[S.cart.length - 1]).qty;
  if (p.track_stock !== false && q > stockOf(p)) toast('⚠️ Stok ' + p.name + ' tidak mencukupi (sisa ' + numf(stockOf(p), 2) + ')', true);
  if (navigator.vibrate) navigator.vibrate(12);
  cartChanged();
}
function cartSet(i, v) { if (!S.cart[i]) return; v = Number(String(v).replace(',', '.')); if (!(v > 0)) S.cart.splice(i, 1); else S.cart[i].qty = Math.round(v * 1000) / 1000; cartChanged(); }
function cartStep(i, d) { if (!S.cart[i]) return; cartSet(i, N(S.cart[i].qty) + d); }
function cartDel(i) { if (!S.cart[i]) return; const n = S.cart[i].name; S.cart.splice(i, 1); cartChanged(); toast('"' + n + '" dihapus dari keranjang'); }
function cartPrice(i, v) { if (!S.cart[i]) return; S.cart[i].price = parseMoney(v); renderCart(); if ($('#coItems')) { const el = $('#coSub' + i); if (el) el.textContent = money(N(S.cart[i].qty) * N(S.cart[i].price)); coCalc(); } }
function cartClear() { if (!S.cart.length) return toast('Keranjang sudah kosong'); confirmBox('Batalkan transaksi ini dan kosongkan keranjang (' + S.cart.length + ' item)?', () => { S.cart = []; cartChanged(); }, 'Ya, batalkan'); }
function renderCart() {
  const box = $('#cartBox'), bar = $('#cartBar'), tot = cartTotal(), n = S.cart.length;
  if (box) box.innerHTML = n ? `<div class="cart-items">${S.cart.map((c, i) => `<div class="ci"><button class="icon-btn" style="width:30px;height:30px;color:var(--out)" title="Hapus item" aria-label="Hapus ${esc(c.name)}" onclick="cartDel(${i})">${ic('x')}</button><div class="grow" style="min-width:0"><div class="ell" style="font-weight:700;font-size:13.5px">${esc(c.name)}</div><div class="xs muted num">${money(c.price)} / ${esc(c.unit || 'item')}</div></div>
      <div class="qty"><button type="button" onclick="cartStep(${i},-1)" aria-label="Kurangi">−</button><input value="${c.qty}" inputmode="decimal" aria-label="Jumlah" onchange="cartSet(${i},this.value)"><button type="button" onclick="cartStep(${i},1)" aria-label="Tambah">+</button></div>
      <b class="num" style="min-width:72px;text-align:right;font-size:13px">${money(N(c.qty) * N(c.price))}</b></div>`).join('')}</div>
      <div class="total-line"><span>Total</span><span class="num">${money(tot)}</span></div><button class="btn primary block" onclick="checkoutForm()">${ic('check')} Bayar</button>`
    : `<div class="empty"><div class="e">🛒</div><p class="small">Ketuk produk untuk menambah ke keranjang.</p></div>`;
  const cb = $('#cartClear'); if (cb) cb.disabled = !n;
  if (bar) { bar.style.display = n ? '' : 'none'; bar.innerHTML = `${ic('cart')}<span class="grow">${n} item</span><b class="num">${money(tot)}</b><span>Bayar ›</span>`; }
}
function manualItem() {
  modal('Item Manual', `<form id="mif"><label class="f"><span>Nama item / jasa</span><input class="inp" name="name" required autofocus></label><div class="f-row"><label class="f"><span>Harga</span>${moneyInput('price', '')}</label><label class="f"><span>Jumlah</span><input class="inp" name="qty" type="number" step="any" min="0" value="1"></label></div><button class="btn primary block">Tambah ke Keranjang</button></form>`,
    { onMount: m => m.querySelector('#mif').onsubmit = e => { e.preventDefault(); const f = formObj(e.target); if (!f.name.trim()) return toast('Isi nama item', true); if (!parseMoney(f.price)) return toast('Isi harga item', true); S.cart.push({ pid: null, name: f.name.trim(), price: parseMoney(f.price), cost: 0, qty: N(f.qty) > 0 ? N(f.qty) : 1, unit: 'item' }); closeModal(); cartChanged(); } });
}
const saleCategory = () => cats('in').find(c => c.id === S.biz.settings.sale_cat) || cats('in')[0];
function coItemsHTML() {
  return S.cart.map((c, i) => `<div class="ci"><button type="button" class="icon-btn" style="width:30px;height:30px;color:var(--out)" title="Hapus item" aria-label="Hapus ${esc(c.name)}" onclick="cartDel(${i})">${ic('x')}</button>
    <div class="grow" style="min-width:0"><div class="ell" style="font-weight:700;font-size:13.5px">${esc(c.name)}</div><input class="inp num" style="padding:5px 8px;font-size:13px;margin-top:4px;max-width:130px" inputmode="numeric" value="${mval(c.price)}" aria-label="Harga" oninput="mfmt(this);cartPrice(${i},this.value)"></div>
    <div class="qty"><button type="button" onclick="cartStep(${i},-1)">−</button><input value="${c.qty}" inputmode="decimal" onchange="cartSet(${i},this.value)"><button type="button" onclick="cartStep(${i},1)">+</button></div>
    <b class="num" id="coSub${i}" style="min-width:70px;text-align:right;font-size:13px">${money(N(c.qty) * N(c.price))}</b></div>`).join('');
}
function checkoutForm() {
  if (!S.cart.length) return toast('Keranjang masih kosong', true);
  if (!S.d.accounts.length) return toast('Tambahkan akun kas/bank dulu di Pengaturan', true);
  if (!cats('in').length) return toast('Tambahkan kategori pemasukan dulu di Pengaturan', true);
  const m = mods(), sc = saleCategory(), first = S.d.accounts.find(a => a.type === 'kas') || S.d.accounts[0];
  const body = `<form id="cof" onsubmit="event.preventDefault()">
    <div class="row between mb"><b class="small">Rincian pesanan</b><button type="button" class="btn sm ghost" onclick="closeModal();manualItem()">${ic('plus')} Item</button></div>
    <div id="coItems" class="mb" style="max-height:240px;overflow:auto">${coItemsHTML()}</div>
    <div class="row between small"><span class="muted">Subtotal</span><b class="num" id="coSubtotal"></b></div>
    <label class="f mt"><span>Diskon</span></label><input type="hidden" name="disc_mode" value="rp">
    <div class="row mb" style="gap:8px"><div class="seg" style="margin:0;flex:none;width:110px"><button type="button" class="on" data-m="rp" onclick="coDiscMode(this)">Rp</button><button type="button" data-m="pct" onclick="coDiscMode(this)">%</button></div>${moneyInput('disc', '', 'aria-label="Diskon"', 'coCalc()')}</div>
    <div class="chips" style="margin-top:-6px">${[5, 10, 15, 20].map(p => `<button type="button" class="chip" onclick="coDiscQuick(${p})">${p}%</button>`).join('')}<button type="button" class="chip" onclick="coDiscQuick(0)">Tanpa diskon</button></div>
    <div class="row between small"><span class="muted">Potongan</span><b class="num c-out" id="coDiscAmt">-</b></div>
    <div class="total-line" style="font-size:24px"><span>Total</span><span class="num c-in" id="coTotal"></span></div>
    <label class="f"><span>Metode pembayaran</span></label><input type="hidden" name="method" value="${first.id}">
    <div class="pay-opts">${S.d.accounts.map(a => `<div class="pay-opt ${a.id === first.id ? 'on' : ''}" role="button" tabindex="0" data-v="${a.id}" data-kas="${a.type === 'kas' ? 1 : 0}" onclick="coPay(this)">${a.type === 'kas' ? '💵' : a.type === 'bank' ? '🏦' : '📱'} ${esc(a.name)}</div>`).join('')}${m.hutang ? `<div class="pay-opt" role="button" tabindex="0" data-v="credit" onclick="coPay(this)">📝 Bayar Nanti</div>` : ''}</div>
    <div id="coCash" class="${first.type === 'kas' ? '' : 'hidden'}"><label class="f"><span>Uang diterima</span>${moneyInput('cash', '', 'aria-label="Uang diterima"', 'coCalc()')}</label><div class="quick-cash" id="qcash"></div><div class="row between mb"><span class="muted">Kembalian</span><b class="num" id="coChange" style="font-size:18px">-</b></div></div>
    <div class="f-row"><label class="f"><span>Pelanggan</span><select class="inp" name="contact_id"><option value="">— Umum —</option>${S.d.contacts.filter(c => c.type !== 'supplier').map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f"><span>atau nama baru</span><input class="inp" name="new_contact" placeholder="Nama pelanggan"></label></div>
    <div id="coDue" class="hidden"><div class="f-row"><label class="f"><span>Uang muka / DP (opsional)</span>${moneyInput('dp', '', '', 'coCalc()')}</label><label class="f"><span>Jatuh tempo</span><input class="inp" type="date" name="due" value="${addDays(today(), 7)}"></label></div>
      <div class="f-row"><label class="f"><span>DP masuk ke</span><select class="inp" name="dp_acc">${S.d.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label><div class="f"><span class="xs muted" style="display:block;margin-bottom:7px;font-weight:700">Sisa jadi piutang</span><b class="num c-out" id="coLeft">-</b></div></div></div>
    <div class="f-row"><label class="f"><span>Kategori</span><select class="inp" name="cat">${cats('in').map(c => `<option value="${c.id}" ${sc && c.id === sc.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${today()}" max="${addDays(today(), 1)}"></label></div>
    <label class="f"><span>Catatan</span><input class="inp" name="note" placeholder="opsional"></label></form>`;
  modal('Pembayaran', body, { wide: true, foot: `<button class="btn danger" onclick="cartClear()">${ic('x')} Batalkan</button><button class="btn" onclick="closeModal()">Kembali</button><button class="btn primary" id="coBtn">${ic('check')} Selesaikan</button>`, onMount: m => { m.querySelector('#coBtn').onclick = doCheckout; coCalc(); } });
}
function coDiscMode(el) { $$('#cof .seg button').forEach(b => b.classList.toggle('on', b === el)); $('#cof [name=disc_mode]').value = el.dataset.m; const d = $('#cof [name=disc]'); d.value = ''; d.placeholder = el.dataset.m === 'pct' ? '0 %' : '0'; d.focus(); coCalc(); }
function coDiscQuick(p) { const btn = $$('#cof .seg button')[p ? 1 : 0]; $$('#cof .seg button').forEach(b => b.classList.toggle('on', b === btn)); $('#cof [name=disc_mode]').value = p ? 'pct' : 'rp'; $('#cof [name=disc]').value = p ? String(p) : ''; coCalc(); }
function coDisc(f, sub) { const v = parseMoney(f.disc); return Math.min(sub, f.disc_mode === 'pct' ? Math.round(sub * Math.min(100, v) / 100) : v); }
function coPay(el) {
  $$('#cof .pay-opt').forEach(x => x.classList.remove('on')); el.classList.add('on'); $('#cof [name=method]').value = el.dataset.v;
  $('#coCash').classList.toggle('hidden', el.dataset.kas !== '1'); $('#coDue').classList.toggle('hidden', el.dataset.v !== 'credit'); coCalc();
}
function coCalc() {
  const fm = $('#cof'); if (!fm) return;
  const f = formObj(fm), sub = cartTotal(), disc = coDisc(f, sub), tot = Math.max(0, sub - disc), cash = parseMoney(f.cash), dp = Math.min(parseMoney(f.dp), tot);
  $('#coSubtotal').textContent = money(sub); $('#coDiscAmt').textContent = disc ? '−' + money(disc) + (f.disc_mode === 'pct' && parseMoney(f.disc) ? ' (' + Math.min(100, parseMoney(f.disc)) + '%)' : '') : '-';
  $('#coTotal').textContent = money(tot);
  $('#coChange').textContent = cash ? (cash >= tot ? money(cash - tot) : 'Kurang ' + money(tot - cash)) : '-'; $('#coChange').className = 'num ' + (cash && cash < tot ? 'c-out' : 'c-in');
  if ($('#coLeft')) $('#coLeft').textContent = money(tot - dp);
  const sugg = [...new Set([tot, Math.ceil(tot / 5000) * 5000, Math.ceil(tot / 10000) * 10000, Math.ceil(tot / 50000) * 50000, Math.ceil(tot / 100000) * 100000])].filter(v => v >= tot && v > 0).slice(0, 5);
  $('#qcash').innerHTML = sugg.map((v, i) => `<button type="button" class="chip" onclick="const c=$('#cof [name=cash]');c.value='${mval(v)}';coCalc()">${i === 0 ? 'Uang pas' : short(v)}</button>`).join('');
}
async function doCheckout() {
  if (!S.cart.length) return toast('Keranjang kosong', true);
  const f = formObj($('#cof')), sub = cartTotal(), disc = coDisc(f, sub), total = Math.max(0, sub - disc), cash = parseMoney(f.cash), method = f.method;
  const credit = method === 'credit', a = acc(method), dp = credit ? Math.min(parseMoney(f.dp), total) : 0;
  if (S.cart.some(c => !(N(c.qty) > 0))) return toast('Jumlah item harus lebih dari 0', true);
  if (!credit && !a) return toast('Pilih metode pembayaran', true);
  if (!f.cat) return toast('Pilih kategori pemasukan', true);
  if (a && a.type === 'kas' && cash && cash < total) return toast('Uang diterima kurang ' + money(total - cash), true);
  if (credit && !f.contact_id && !f.new_contact.trim()) return toast('Isi nama pelanggan untuk penjualan bayar nanti', true);
  if (credit && dp >= total) return toast('DP sama dengan total — pilih metode bayar tunai/transfer saja', true);
  const btn = $('#coBtn'); busy(btn, true);
  const items = S.cart.map(c => ({ pid: c.pid, name: c.name, qty: N(c.qty), price: N(c.price), cost: N(c.cost), unit: c.unit }));
  const cost = sum(items, i => i.qty * i.cost), date = f.date || today(), txId = uid();
  const ok = await safe(async () => {
    let cid = f.contact_id || null;
    if (!cid && f.new_contact.trim()) cid = (await add('contacts', { name: f.new_contact.trim(), type: listGet('ctypes')[0] || 'pelanggan' })).id;
    const discNote = disc ? 'Diskon ' + money(disc) : '';
    if (credit) {
      const d = await add('debts', { kind: 'piutang', contact_id: cid, amount: total, paid: dp, date, due_date: f.due || null, category_id: f.cat, source: 'sale', note: ('Penjualan: ' + items.map(i => i.name + ' x' + i.qty).join(', ')).slice(0, 280) + (discNote ? ' • ' + discNote : '') });
      if (dp) await add('transactions', { date, type: 'in', amount: dp, account_id: f.dp_acc, contact_id: cid, ref: 'debt', debt_id: d.id, category_id: f.cat, note: 'Uang muka penjualan' });
    } else await add('transactions', { id: txId, date, type: 'in', amount: total, category_id: f.cat, account_id: method, contact_id: cid, ref: 'sale', items, cost, note: [f.note.trim(), discNote].filter(Boolean).join(' • ') });
    for (const it of items) { const p = prod(it.pid); if (!p || p.track_stock === false) continue; await add('stock_moves', { product_id: p.id, date, qty: -it.qty, kind: 'sale', note: credit ? 'Penjualan (piutang)' : 'Penjualan', transaction_id: credit ? null : txId }); }
    if (f.cat !== S.biz.settings.sale_cat) { S.biz.settings.sale_cat = f.cat; updBiz({ settings: S.biz.settings }).catch(() => {}); }
    return { cid };
  });
  busy(btn, false); if (!ok) return;
  const rc = { items, sub, disc, total, cash: credit ? 0 : cash, change: !credit && cash ? cash - total : 0, dp, method: credit ? 'Bayar Nanti (Piutang)' : a.name, customer: ok.cid ? contactName(ok.cid) : 'Umum', date: new Date(), phone: ok.cid ? (contact(ok.cid) || {}).phone : '' };
  S.cart = []; render(); receipt(rc);
}
function receiptText(r) {
  const L = '--------------------------------', p = (a, b) => { a = String(a); b = String(b); return a + ' '.repeat(Math.max(1, 32 - a.length - b.length)) + b; };
  const nm = s => money(s).replace(/\s/g, ' ');
  return [S.biz.name.toUpperCase(), S.biz.address || '', S.biz.phone ? 'Telp ' + S.biz.phone : '', L, r.date.toLocaleString('id-ID'), 'Pelanggan: ' + r.customer, L,
    ...r.items.flatMap(i => [i.name, p('  ' + numf(i.qty, 2) + ' x ' + numf(i.price), nm(i.qty * i.price))]), L,
    p('Subtotal', nm(r.sub)), r.disc ? p('Diskon', '-' + nm(r.disc)) : '', p('TOTAL', nm(r.total)), p('Bayar', r.method), r.cash ? p('Tunai', nm(r.cash)) : '', r.cash ? p('Kembali', nm(r.change)) : '', r.dp ? p('Uang muka', nm(r.dp)) : '', r.method.startsWith('Bayar Nanti') ? p('Sisa tagihan', nm(r.total - (r.dp || 0))) : '', L, 'Terima kasih atas kunjungan Anda 🙏'].filter(Boolean).join('\n');
}
function receipt(r) {
  const txt = receiptText(r); S._rc = txt;
  modal('✅ Transaksi Berhasil', `<div class="receipt">${esc(txt)}</div>`, { foot: `<button class="btn" onclick="printReceipt()">${ic('print')}Cetak</button><button class="btn" onclick="window.open('https://wa.me/${(r.phone || '').replace(/\D/g, '').replace(/^0/, '62')}?text='+encodeURIComponent(S._rc),'_blank')">${ic('share')}WhatsApp</button><button class="btn primary" onclick="closeModal()">Baru</button>` });
}
function printReceipt() {
  const w = window.open('', '_blank', 'width=380,height=600'); if (!w) return toast('Izinkan pop-up untuk mencetak', true);
  w.document.write(`<html><head><title>Struk</title><style>body{font-family:monospace;font-size:12px;white-space:pre-wrap;margin:8px;width:58mm}@page{margin:4mm}</style></head><body>${esc(S._rc)}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),400)}<\/script></body></html>`); w.document.close();
}
