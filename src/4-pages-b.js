/* =====================================================================
   HALAMAN: PRODUK & STOK, HUTANG PIUTANG, CATATAN HARIAN
   ===================================================================== */
S.stok = { q: '', f: 'all' };
PAGES.stok = {
  html() {
    const ps = S.d.products, tr = ps.filter(p => p.track_stock !== false && p.active !== false);
    const low = tr.filter(p => N(p.min_stock) > 0 && N(p.stock) <= N(p.min_stock));
    return `<div class="grid g4 mb">
      <div class="card kpi"><span class="k-lbl">Produk Aktif</span><div class="k-val">${ps.filter(p => p.active !== false).length}</div><span class="xs muted">${ps.length} total</span></div>
      <div class="card kpi"><span class="k-lbl">Nilai Stok (Modal)</span><div class="k-val num">${money(sum(tr, p => Math.max(0, N(p.stock)) * N(p.buy_price)))}</div><span class="xs muted">harga beli × stok</span></div>
      <div class="card kpi"><span class="k-lbl">Potensi Penjualan</span><div class="k-val num c-in">${money(sum(tr, p => Math.max(0, N(p.stock)) * N(p.sell_price)))}</div><span class="xs muted">harga jual × stok</span></div>
      <div class="card kpi" style="cursor:pointer" onclick="S.stok.f='low';render()"><span class="k-lbl">Stok Menipis</span><div class="k-val ${low.length ? 'c-out' : ''}">${low.length}</div><span class="xs muted">produk perlu belanja</span></div></div>
    <div class="toolbar"><div class="search"><span>${ic('search')}</span><input class="inp" placeholder="Cari produk…" value="${esc(S.stok.q)}" oninput="S.stok.q=this.value;stokList()"></div>
      <button class="btn" onclick="stockInPick()">${ic('download')} Stok Masuk</button><button class="btn primary" onclick="productForm()">${ic('plus')} Produk</button></div>
    <div class="chips mb">${[['all', 'Semua'], ['low', 'Stok menipis'], ['notrack', 'Tanpa stok (jasa/menu)'], ['off', 'Nonaktif']].map(([k, l]) => `<button class="chip ${S.stok.f === k ? 'on' : ''}" onclick="S.stok.f='${k}';render()">${l}</button>`).join('')}</div>
    <div class="card"><div class="list" id="stokList"></div></div>`;
  },
  mount() { stokList(); }
};
function stokList() {
  const q = S.stok.q.trim().toLowerCase(), f = S.stok.f;
  const ps = S.d.products.filter(p => (!q || (p.name + ' ' + (p.sku || '') + ' ' + (p.group_name || '')).toLowerCase().includes(q)) &&
    (f === 'all' ? p.active !== false : f === 'low' ? (p.active !== false && p.track_stock !== false && N(p.stock) <= N(p.min_stock)) : f === 'notrack' ? p.track_stock === false : p.active === false)).sort((a, b) => a.name.localeCompare(b.name));
  $('#stokList').innerHTML = ps.length ? ps.map(p => { const low = p.track_stock !== false && N(p.stock) <= N(p.min_stock), mg = N(p.sell_price) - N(p.buy_price);
    return `<div class="li" onclick="productMenu('${p.id}')"><div class="av" style="background:var(--primary-soft);color:var(--primary);font-weight:800;font-size:15px">${esc(initials(p.name))}</div>
    <div class="grow"><div class="t ell">${esc(p.name)} ${p.active === false ? '<span class="pill neutral">nonaktif</span>' : ''}</div><div class="s ell">${[p.group_name, p.sku, 'Beli ' + money(p.buy_price), 'Jual ' + money(p.sell_price), N(p.buy_price) ? 'Margin ' + pct(mg, p.sell_price).toFixed(0) + '%' : ''].filter(Boolean).map(esc).join(' • ')}</div></div>
    <div style="text-align:right">${p.track_stock !== false ? `<div class="amt num ${low ? 'c-out' : ''}">${numf(p.stock, 2)} <small class="muted">${esc(p.unit || '')}</small></div>${low ? `<span class="pill ${N(p.stock) <= 0 ? 'out' : 'warn'}">${N(p.stock) <= 0 ? 'Habis' : 'Menipis'}</span>` : ''}` : '<span class="pill neutral">tanpa stok</span>'}</div></div>`; }).join('')
    : `<div class="empty"><div class="e">📦</div><p>${S.d.products.length ? 'Tidak ada produk di filter ini.' : 'Belum ada produk. Tambahkan barang yang Anda jual / simpan.'}</p><button class="btn primary sm" onclick="productForm()">${ic('plus')} Tambah Produk</button></div>`;
}
function productMenu(id) {
  const p = prod(id); if (!p) return;
  const moves = S.d.stock_moves.filter(m => m.product_id === id).sort((a, b) => a.date === b.date ? String(b.created_at).localeCompare(String(a.created_at)) : a.date < b.date ? 1 : -1).slice(0, 30);
  modal(esc(p.name), `<div class="grid g3 mb"><div><div class="xs muted">Stok</div><b class="num" style="font-size:18px">${p.track_stock !== false ? numf(p.stock, 2) + ' ' + esc(p.unit || '') : '—'}</b></div><div><div class="xs muted">Harga beli</div><b class="num">${money(p.buy_price)}</b></div><div><div class="xs muted">Harga jual</div><b class="num c-in">${money(p.sell_price)}</b></div></div>
    <div class="row wrap mb">${p.track_stock !== false ? `<button class="btn sm" onclick="stockIn('${id}')">${ic('download')} Stok Masuk</button><button class="btn sm" onclick="opname('${id}')">${ic('check')} Opname / Sesuaikan</button>` : ''}<button class="btn sm" onclick="productForm('${id}')">${ic('edit')} Edit</button><button class="btn sm danger" onclick="deleteProduct('${id}')">${ic('trash')} Hapus</button></div>
    <h4 style="margin:6px 0">Riwayat stok</h4>${moves.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Tanggal</th><th>Jenis</th><th class="r">Jumlah</th><th>Catatan</th></tr>${moves.map(m => `<tr><td>${fmtDate(m.date)}</td><td>${{ in: '📥 Masuk', sale: '🛒 Terjual', adjust: '⚖️ Penyesuaian', out: '📤 Keluar' }[m.kind] || m.kind}</td><td class="r num ${N(m.qty) < 0 ? 'c-out' : 'c-in'}">${N(m.qty) > 0 ? '+' : ''}${numf(m.qty, 2)}</td><td class="xs muted">${esc(m.note || '')}</td></tr>`).join('')}</table></div>` : '<p class="muted small">Belum ada pergerakan stok.</p>'}`, { wide: true });
}
function productForm(id) {
  const p = id ? prod(id) : { name: '', unit: 'pcs', buy_price: '', sell_price: '', stock: '', min_stock: '', track_stock: true, active: true, group_name: '', sku: '' };
  const groups = [...new Set(S.d.products.map(x => x.group_name).filter(Boolean))];
  modal(id ? 'Edit Produk' : 'Produk Baru', `<form id="pf">
    <label class="f"><span>Nama produk / jasa</span><input class="inp" name="name" value="${esc(p.name)}" required autofocus></label>
    <div class="f-row"><label class="f"><span>Kelompok</span><input class="inp" name="group_name" list="grpL" value="${esc(p.group_name || '')}" placeholder="cth: Sembako"><datalist id="grpL">${[...new Set([...listGet('groups'), ...groups])].map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
      <label class="f"><span>Satuan</span><input class="inp" name="unit" list="unitL" value="${esc(p.unit || '')}"><datalist id="unitL">${listGet('units').map(u => `<option value="${esc(u)}">`).join('')}</datalist></label></div>
    <div class="f-row"><label class="f"><span>Harga beli / modal</span>${moneyInput('buy_price', p.buy_price)}</label><label class="f"><span>Harga jual</span>${moneyInput('sell_price', p.sell_price)}</label></div>
    <div class="f-row"><label class="f"><span>${id ? 'Stok saat ini' : 'Stok awal'}</span><input class="inp" type="number" step="any" name="stock" value="${p.stock === '' ? '' : N(p.stock)}" ${id ? 'readonly title="Ubah lewat Stok Masuk / Opname"' : ''}></label><label class="f"><span>Stok minimum (peringatan)</span><input class="inp" type="number" step="any" name="min_stock" value="${p.min_stock === '' ? '' : N(p.min_stock)}"></label></div>
    <label class="f"><span>Kode / SKU (opsional)</span><input class="inp" name="sku" value="${esc(p.sku || '')}"></label>
    <div class="set-row"><div class="t grow"><b>Lacak stok</b><small>Matikan untuk jasa / menu masakan</small></div><label class="switch"><input type="checkbox" name="track_stock" ${p.track_stock !== false ? 'checked' : ''}><i></i></label></div>
    <div class="set-row"><div class="t grow"><b>Aktif</b><small>Produk nonaktif tidak tampil di kasir</small></div><label class="switch"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><i></i></label></div>
  </form>`, { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="pfs">Simpan</button>`, onMount: m => m.querySelector('#pfs').onclick = async () => {
    const f = formObj($('#pf')); if (!f.name.trim()) return toast('Nama wajib diisi', true);
    const row = { name: f.name.trim(), group_name: f.group_name.trim() || null, unit: f.unit.trim() || 'pcs', buy_price: parseMoney(f.buy_price), sell_price: parseMoney(f.sell_price), min_stock: N(f.min_stock), sku: f.sku.trim() || null, track_stock: !!f.track_stock, active: !!f.active };
    const ok = await safe(async () => { if (id) await upd('products', id, row); else { const np = await add('products', { ...row, stock: N(f.stock) }); if (N(f.stock)) await add('stock_moves', { product_id: np.id, date: today(), qty: N(f.stock), kind: 'adjust', note: 'Stok awal' }); } return true; }, 'Produk disimpan');
    if (ok) { closeModal(); render(); } } });
}
function deleteProduct(id) { const p = prod(id); confirmBox('Hapus produk <b>' + esc(p.name) + '</b>? Riwayat stoknya ikut terhapus (transaksi tetap ada). Tip: nonaktifkan saja jika masih ingin menyimpan datanya.', async () => { await safe(async () => { for (const m of S.d.stock_moves.filter(x => x.product_id === id)) S.d.stock_moves = S.d.stock_moves.filter(x => x.id !== m.id); if (S.mode === 'local') { const db = Local.db(); db.stock_moves = (db.stock_moves || []).filter(x => x.product_id !== id); Local.save(db); } await del('products', id); }, 'Produk dihapus'); render(); }); }
function stockInPick() {
  const ps = S.d.products.filter(p => p.active !== false && p.track_stock !== false);
  if (!ps.length) return productForm();
  modal('Pilih Produk', `<input class="inp mb" placeholder="Cari…" oninput="$$('#spl .li').forEach(x=>x.style.display=x.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none')"><div class="list" id="spl">${ps.map(p => `<div class="li" onclick="stockIn('${p.id}')"><div class="av">📦</div><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">Stok ${numf(p.stock, 2)} ${esc(p.unit || '')}</div></div></div>`).join('')}</div>
    <button class="btn block mt" onclick="productForm()">${ic('plus')} Produk baru</button>`);
}
function stockIn(pid) {
  const p = prod(pid), outs = cats('out'); const guess = outs.find(c => /stok|beli|pembelian|bahan|barang|pakan|bibit/i.test(c.name)) || outs[0];
  modal('Stok Masuk — ' + esc(p.name), `<form id="sif">
    <div class="f-row"><label class="f"><span>Jumlah (${esc(p.unit || '')})</span><input class="inp" type="number" step="any" name="qty" required autofocus oninput="siCalc()"></label><label class="f"><span>Harga beli / ${esc(p.unit || 'unit')}</span>${moneyInput('price', p.buy_price, 'oninput="mfmt(this);siCalc()"')}</label></div>
    <div class="total-line"><span>Total</span><span class="num" id="siTot">${money(0)}</span></div>
    <label class="f"><span>Pembayaran</span><select class="inp" name="pay" onchange="$('#siOpt').classList.toggle('hidden',this.value==='none');$('#siDue').classList.toggle('hidden',this.value!=='credit')">
      ${S.d.accounts.map(a => `<option value="${a.id}">Bayar dari ${esc(a.name)}</option>`).join('')}${mods().hutang ? '<option value="credit">Hutang ke supplier (bayar nanti)</option>' : ''}<option value="none">Hasil produksi sendiri / tanpa biaya</option></select></label>
    <div id="siOpt"><div class="f-row"><label class="f"><span>Kategori biaya</span><select class="inp" name="cat">${outs.map(c => `<option value="${c.id}" ${guess && c.id === guess.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f"><span>Supplier</span><select class="inp" name="contact_id"><option value="">—</option>${S.d.contacts.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label></div>
      <div id="siDue" class="hidden"><label class="f"><span>Jatuh tempo</span><input class="inp" type="date" name="due" value="${addDays(today(), 14)}"></label></div></div>
    <div class="f-row"><label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${today()}"></label><label class="f"><span>Catatan</span><input class="inp" name="note"></label></div>
  </form>`, { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="sis">Simpan</button>`, onMount: m => m.querySelector('#sis').onclick = () => saveStockIn(pid) });
}
function siCalc() { const f = formObj($('#sif')); $('#siTot').textContent = money(N(f.qty) * parseMoney(f.price)); }
async function saveStockIn(pid) {
  const p = prod(pid), f = formObj($('#sif')), qty = N(f.qty), price = parseMoney(f.price), total = Math.round(qty * price);
  if (!(qty > 0)) return toast('Isi jumlah stok masuk', true);
  const btn = $('#sis'); busy(btn, true);
  const ok = await safe(async () => {
    let txId = null; const items = [{ pid, name: p.name, qty, price, cost: price, unit: p.unit }];
    if (f.pay === 'credit') await add('debts', { kind: 'hutang', contact_id: f.contact_id || null, amount: total, paid: 0, date: f.date, due_date: f.due || null, category_id: f.cat, source: 'purchase', note: 'Pembelian ' + p.name + ' ' + qty + ' ' + (p.unit || '') });
    else if (f.pay !== 'none' && total > 0) txId = (await add('transactions', { date: f.date, type: 'out', amount: total, category_id: f.cat, account_id: f.pay, contact_id: f.contact_id || null, ref: 'purchase', items, note: f.note || ('Beli ' + p.name) })).id;
    const patch = { stock: N(p.stock) + qty }; if (price && f.pay !== 'none') patch.buy_price = price;
    await upd('products', pid, patch);
    await add('stock_moves', { product_id: pid, date: f.date, qty, kind: 'in', note: f.pay === 'none' ? (f.note || 'Hasil produksi') : (f.note || 'Pembelian'), transaction_id: txId });
    return true;
  }, 'Stok ' + p.name + ' bertambah ' + numf(qty, 2));
  busy(btn, false); if (ok) { closeModal(); render(); }
}
function opname(pid) {
  const p = prod(pid);
  modal('Sesuaikan Stok — ' + esc(p.name), `<form id="opf"><p class="muted small" style="margin-top:0">Stok tercatat: <b>${numf(p.stock, 2)} ${esc(p.unit || '')}</b>. Masukkan jumlah stok fisik sebenarnya.</p>
    <label class="f"><span>Stok fisik</span><input class="inp big" type="number" step="any" name="real" value="${N(p.stock)}" autofocus></label>
    <label class="f"><span>Alasan</span><select class="inp" name="note">${listGet('reasons').map(r => `<option>${esc(r)}</option>`).join('')}</select></label></form>`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="ops">Simpan</button>`, onMount: m => m.querySelector('#ops').onclick = async () => {
      const f = formObj($('#opf')), real = N(f.real), diff = real - N(p.stock); if (!diff) return closeModal();
      const ok = await safe(async () => { await upd('products', pid, { stock: real }); await add('stock_moves', { product_id: pid, date: today(), qty: diff, kind: 'adjust', note: f.note }); return true; }, 'Stok disesuaikan (' + (diff > 0 ? '+' : '') + numf(diff, 2) + ')');
      if (ok) { closeModal(); render(); } } });
}

/* ---------------- HUTANG & PIUTANG ---------------- */
S.debt = { tab: 'piutang', show: 'open', q: '' };
PAGES.hutang = {
  html() {
    const pi = openDebts('piutang'), hu = openDebts('hutang'), t = today();
    const late = [...pi, ...hu].filter(d => d.due_date && d.due_date < t).length;
    return `<div class="grid g3 mb">
      <div class="card kpi" style="cursor:pointer" onclick="S.debt.tab='piutang';render()"><div class="k-top"><span class="k-lbl">Piutang (uang di pelanggan)</span><span class="k-ic" style="background:var(--in-soft);color:var(--in)">📥</span></div><div class="k-val num c-in">${money(sum(pi, debtLeft))}</div><span class="xs muted">${pi.length} belum lunas</span></div>
      <div class="card kpi" style="cursor:pointer" onclick="S.debt.tab='hutang';render()"><div class="k-top"><span class="k-lbl">Hutang (wajib dibayar)</span><span class="k-ic" style="background:var(--out-soft);color:var(--out)">📤</span></div><div class="k-val num c-out">${money(sum(hu, debtLeft))}</div><span class="xs muted">${hu.length} belum lunas</span></div>
      <div class="card kpi"><div class="k-top"><span class="k-lbl">Lewat jatuh tempo</span><span class="k-ic" style="background:var(--warn-soft);color:var(--warn)">⏰</span></div><div class="k-val ${late ? 'c-out' : ''}">${late}</div><span class="xs muted">perlu ditindaklanjuti</span></div></div>
    <div class="seg" style="max-width:420px"><button class="${S.debt.tab === 'piutang' ? 'on in' : ''}" onclick="S.debt.tab='piutang';render()">📥 Piutang</button><button class="${S.debt.tab === 'hutang' ? 'on out' : ''}" onclick="S.debt.tab='hutang';render()">📤 Hutang</button></div>
    <div class="toolbar"><div class="search"><span>${ic('search')}</span><input class="inp" placeholder="Cari nama…" value="${esc(S.debt.q)}" oninput="S.debt.q=this.value;debtList()"></div><button class="btn primary" onclick="debtForm(null,S.debt.tab)">${ic('plus')} ${S.debt.tab === 'piutang' ? 'Piutang' : 'Hutang'}</button></div>
    <div class="chips mb">${[['open', 'Belum lunas'], ['done', 'Lunas'], ['all', 'Semua']].map(([k, l]) => `<button class="chip ${S.debt.show === k ? 'on' : ''}" onclick="S.debt.show='${k}';render()">${l}</button>`).join('')}</div>
    <div class="grid g2" id="debtList"></div>`;
  },
  mount() { debtList(); }
};
function dueBadge(d) {
  if (debtLeft(d) <= 0.5) return '<span class="pill in">✔ Lunas</span>'; if (!d.due_date) return '<span class="pill neutral">Tanpa tempo</span>';
  const dd = diffDays(today(), d.due_date); return dd < 0 ? `<span class="pill out">Terlambat ${-dd} hari</span>` : dd === 0 ? '<span class="pill warn">Jatuh tempo hari ini</span>' : dd <= 3 ? `<span class="pill warn">${dd} hari lagi</span>` : `<span class="pill neutral">Tempo ${fmtDate(d.due_date)}</span>`;
}
function debtList() {
  const q = S.debt.q.trim().toLowerCase();
  const ds = S.d.debts.filter(d => d.kind === S.debt.tab && (S.debt.show === 'all' || (S.debt.show === 'open' ? debtLeft(d) > 0.5 : debtLeft(d) <= 0.5)) && (!q || (contactName(d.contact_id, d.contact_name) + ' ' + (d.note || '')).toLowerCase().includes(q)))
    .sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1);
  $('#debtList').innerHTML = ds.length ? ds.map(d => { const p = pct(N(d.paid), N(d.amount)), c = contact(d.contact_id);
    return `<div class="card"><div class="row between mb"><div class="row" style="min-width:0"><div class="av">${d.kind === 'piutang' ? '📥' : '📤'}</div><div style="min-width:0"><b class="ell" style="display:block">${esc(contactName(d.contact_id, d.contact_name))}</b><span class="xs muted ell" style="display:block">${fmtDate(d.date)}${d.note ? ' • ' + esc(d.note) : ''}</span></div></div>${dueBadge(d)}</div>
    <div class="row between small"><span class="muted">Sisa</span><b class="num" style="font-size:18px">${money(debtLeft(d))}</b></div>
    <div class="prog" style="margin:8px 0"><i style="width:${p}%;background:${d.kind === 'piutang' ? 'var(--in)' : 'var(--out)'}"></i></div>
    <div class="row between xs muted"><span>Dibayar ${money(d.paid)}</span><span>dari ${money(d.amount)}</span></div>
    <div class="row mt wrap">${debtLeft(d) > 0.5 ? `<button class="btn sm primary" onclick="debtPay('${d.id}')">${d.kind === 'piutang' ? 'Terima Bayaran' : 'Bayar'}</button>` : ''}${d.kind === 'piutang' && c && c.phone && debtLeft(d) > 0.5 ? `<button class="btn sm" onclick="waRemind('${d.id}')">${ic('share')} Tagih via WA</button>` : ''}<button class="btn sm ghost" onclick="debtDetail('${d.id}')">Detail</button></div></div>`; }).join('')
    : `<div class="card empty" style="grid-column:1/-1"><div class="e">🤝</div><p>Tidak ada ${S.debt.tab} ${S.debt.show === 'open' ? 'yang belum lunas' : ''}.</p></div>`;
}
function debtForm(id, kind = 'piutang') {
  const d = id ? byId('debts', id) : { kind, amount: '', date: today(), due_date: addDays(today(), 14), note: '', contact_id: '' }; kind = d.kind;
  modal(id ? 'Edit ' + (kind === 'piutang' ? 'Piutang' : 'Hutang') : 'Catat Hutang / Piutang', `<form id="df">
    ${!id ? `<input type="hidden" name="kind" value="${kind}"><div class="seg"><button type="button" class="${kind === 'piutang' ? 'on in' : ''}" onclick="debtForm(null,'piutang')">📥 Piutang (orang berhutang ke saya)</button><button type="button" class="${kind === 'hutang' ? 'on out' : ''}" onclick="debtForm(null,'hutang')">📤 Hutang (saya berhutang)</button></div>` : `<input type="hidden" name="kind" value="${kind}">`}
    <div class="f-row"><label class="f"><span>${kind === 'piutang' ? 'Pelanggan / peminjam' : 'Pemberi pinjaman / supplier'}</span><select class="inp" name="contact_id"><option value="">— pilih —</option>${S.d.contacts.map(c => `<option value="${c.id}" ${d.contact_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f"><span>atau nama baru</span><input class="inp" name="new_contact" placeholder="Nama"></label></div>
    <label class="f"><span>Jumlah</span><input class="inp big num" name="amount" inputmode="numeric" oninput="mfmt(this)" value="${mval(d.amount)}" placeholder="0"></label>
    <div class="f-row"><label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${d.date}"></label><label class="f"><span>Jatuh tempo</span><input class="inp" type="date" name="due_date" value="${d.due_date || ''}"></label></div>
    <label class="f"><span>Keterangan</span><input class="inp" name="note" value="${esc(d.note || '')}" placeholder="cth: kasbon, pinjam modal, ambil barang"></label>
    ${!id ? `<div class="set-row"><div class="t grow"><b>Catat juga sebagai arus kas</b><small>${kind === 'piutang' ? 'Uang keluar dari kas karena dipinjamkan' : 'Uang pinjaman masuk ke kas'}</small></div><label class="switch"><input type="checkbox" name="cash" onchange="$('#dfAcc').classList.toggle('hidden',!this.checked)"><i></i></label></div>
    <div id="dfAcc" class="hidden"><label class="f mt"><span>Akun</span><select class="inp" name="account_id">${S.d.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label></div>` : ''}
  </form>`, { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="dfs">Simpan</button>`, onMount: m => m.querySelector('#dfs').onclick = async () => {
    const f = formObj($('#df')), amount = parseMoney(f.amount); if (!amount) return toast('Isi jumlah', true);
    if (!f.contact_id && !f.new_contact.trim()) return toast('Pilih atau isi nama', true);
    const ok = await safe(async () => {
      let cid = f.contact_id || null; if (!cid) cid = (await add('contacts', { name: f.new_contact.trim(), type: f.kind === 'piutang' ? 'pelanggan' : 'supplier' })).id;
      const row = { kind: f.kind, contact_id: cid, amount, date: f.date, due_date: f.due_date || null, note: f.note.trim() };
      if (id) await upd('debts', id, row);
      else { const nd = await add('debts', { ...row, paid: 0, source: 'manual' }); if (f.cash) await add('transactions', { date: f.date, type: f.kind === 'piutang' ? 'out' : 'in', amount, account_id: f.account_id, contact_id: cid, ref: 'debt', debt_id: nd.id, category_id: null, note: (f.kind === 'piutang' ? 'Memberi pinjaman' : 'Menerima pinjaman') + (f.note ? ' — ' + f.note : '') }); }
      return true;
    }, 'Tersimpan'); if (ok) { closeModal(); render(); } } });
}
function debtPay(id) {
  const d = byId('debts', id), left = debtLeft(d);
  modal((d.kind === 'piutang' ? 'Terima Pembayaran' : 'Bayar Hutang') + ' — ' + esc(contactName(d.contact_id, d.contact_name)), `<form id="dpf"><p class="muted small" style="margin-top:0">Sisa: <b>${money(left)}</b></p>
    <label class="f"><span>Jumlah dibayar</span><input class="inp big num" name="amount" inputmode="numeric" oninput="mfmt(this)" value="${mval(left)}" autofocus></label>
    <div class="chips mb"><button type="button" class="chip" onclick="$('#dpf [name=amount]').value='${mval(left)}'">Lunas</button><button type="button" class="chip" onclick="$('#dpf [name=amount]').value='${mval(Math.round(left / 2))}'">50%</button></div>
    <div class="f-row"><label class="f"><span>${d.kind === 'piutang' ? 'Masuk ke' : 'Dibayar dari'}</span><select class="inp" name="account_id">${S.d.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label><label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${today()}"></label></div>
    <label class="f"><span>Catatan</span><input class="inp" name="note" placeholder="cth: cicilan ke-2"></label></form>`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="dps">Simpan Pembayaran</button>`, onMount: m => m.querySelector('#dps').onclick = async () => {
      const f = formObj($('#dpf')), amt = parseMoney(f.amount); if (!amt) return toast('Isi jumlah', true); if (amt > left + 0.5) return toast('Melebihi sisa ' + money(left), true);
      const ok = await safe(async () => { await add('transactions', { date: f.date, type: d.kind === 'piutang' ? 'in' : 'out', amount: amt, account_id: f.account_id, contact_id: d.contact_id, ref: 'debt', debt_id: d.id, category_id: d.category_id || null, note: f.note || (d.kind === 'piutang' ? 'Pembayaran piutang' : 'Pembayaran hutang') }); await upd('debts', d.id, { paid: N(d.paid) + amt }); return true; }, amt >= left - 0.5 ? 'Lunas 🎉' : 'Pembayaran dicatat');
      if (ok) { closeModal(); render(); } } });
}
function debtDetail(id) {
  const d = byId('debts', id), pays = S.d.transactions.filter(t => t.debt_id === id).sort(sortTx);
  modal((d.kind === 'piutang' ? 'Piutang' : 'Hutang') + ' — ' + esc(contactName(d.contact_id, d.contact_name)), `<div class="grid g3 mb"><div><div class="xs muted">Total</div><b class="num">${money(d.amount)}</b></div><div><div class="xs muted">Dibayar</div><b class="num c-in">${money(d.paid)}</b></div><div><div class="xs muted">Sisa</div><b class="num c-out">${money(debtLeft(d))}</b></div></div>
    <p class="small"><span class="muted">Tanggal:</span> ${fmtDate(d.date)} &nbsp; ${dueBadge(d)}<br>${d.note ? '<span class="muted">Ket:</span> ' + esc(d.note) : ''}</p>
    <h4 style="margin:10px 0 4px">Riwayat pembayaran</h4><div class="list">${pays.length ? pays.map(txRow).join('') : '<p class="muted small">Belum ada pembayaran.</p>'}</div>`,
    { wide: true, foot: `<button class="btn danger" onclick="deleteDebt('${id}')">${ic('trash')}Hapus</button><button class="btn" onclick="debtForm('${id}')">${ic('edit')}Edit</button>${debtLeft(d) > .5 ? `<button class="btn primary" onclick="debtPay('${id}')">Bayar</button>` : ''}` });
}
function deleteDebt(id) { confirmBox('Hapus catatan ini beserta riwayat pembayarannya?', async () => { await safe(async () => { for (const t of S.d.transactions.filter(x => x.debt_id === id)) await del('transactions', t.id); await del('debts', id); }, 'Dihapus'); render(); }); }
function waRemind(id) {
  const d = byId('debts', id), c = contact(d.contact_id);
  const msg = `Assalamu'alaikum/Halo ${c.name}, kami dari ${S.biz.name} ingin mengingatkan tagihan sebesar ${money(debtLeft(d))}${d.due_date ? ' yang jatuh tempo ' + fmtDate(d.due_date) : ''}. ${d.note ? '(' + d.note + ') ' : ''}Terima kasih 🙏`;
  window.open('https://wa.me/' + c.phone.replace(/\D/g, '').replace(/^0/, '62') + '?text=' + encodeURIComponent(msg), '_blank');
}

/* ---------------- CATATAN HARIAN / PRODUKSI ---------------- */
S.hr = { period: '30d', metric: null };
PAGES.harian = {
  html() {
    const ms = metrics();
    if (!ms.length) return `<div class="card empty"><div class="e">📋</div><h3>Belum ada data yang dicatat harian</h3><p class="small">Tentukan apa saja yang ingin dicatat setiap hari, misalnya <b>produksi telur</b>, <b>pakan</b>, <b>hasil panen</b>, <b>porsi terjual</b>, dll.</p><button class="btn primary" onclick="metricForm()">${ic('plus')} Tambah Kolom Catatan</button></div>`;
    const r = range(S.hr.period), logs = S.d.production_logs.filter(l => inR(l.date, r.from, r.to)).sort((a, b) => a.date < b.date ? 1 : -1);
    const sel = ms.find(m => m.key === S.hr.metric) || ms.find(m => m.agg !== 'last') || ms[0]; S.hr.metric = sel.key;
    const sp = specialKPI(logs);
    return `<div class="toolbar"><div class="grow">${periodChips(S.hr.period, 'hrPeriod')}</div><button class="btn" onclick="metricForm()">${ic('gear')}<span class="hide-sm">Atur kolom</span></button><button class="btn primary" onclick="logForm()">${ic('plus')} Catat Hari Ini</button></div>
    <div class="grid g4 mb">${ms.map(m => { const v = metricAgg(m, logs); return `<div class="card kpi"><span class="k-lbl">${esc(m.label)} <small>(${m.agg === 'last' ? 'terakhir' : m.agg === 'avg' ? 'rata²' : 'total'})</small></span><div class="k-val num">${v === null ? '-' : numf(v, 1)} <small class="muted" style="font-size:13px">${esc(m.unit)}</small></div>${m.agg === 'sum' && v !== null && logs.length ? `<span class="xs muted">rata² ${numf(v / logs.length, 1)}/hari</span>` : ''}</div>`; }).join('')}${sp.map(x => `<div class="card kpi" style="border-color:var(--primary-2)"><span class="k-lbl">${x[0]}</span><div class="k-val num" style="color:var(--primary)">${x[1]}</div><span class="xs muted">${x[2]}</span></div>`).join('')}</div>
    <div class="card mb"><div class="card-h"><h3>Grafik</h3><div class="chips">${ms.map(m => `<button class="chip ${m.key === sel.key ? 'on' : ''}" onclick="S.hr.metric='${m.key}';render()">${esc(m.label)}</button>`).join('')}</div></div><div class="chart-box"><canvas id="cLog"></canvas></div></div>
    <div class="card"><div class="card-h"><h3>Riwayat Catatan</h3><span class="muted xs">${logs.length} hari</span></div>
    ${logs.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Tanggal</th>${ms.map(m => `<th class="r">${esc(m.label)}<br><small>${esc(m.unit)}</small></th>`).join('')}<th>Catatan</th></tr>
      ${logs.map(l => `<tr style="cursor:pointer" onclick="logForm('${l.id}')"><td style="white-space:nowrap">${fmtDate(l.date)}</td>${ms.map(m => `<td class="r num">${l.vals && l.vals[m.key] !== undefined && l.vals[m.key] !== '' ? numf(l.vals[m.key], 2) : '-'}</td>`).join('')}<td class="xs muted">${esc(l.note || '')}</td></tr>`).join('')}</table></div>`
      : `<div class="empty"><p>Belum ada catatan pada periode ini.</p></div>`}</div>`;
  },
  mount() {
    const ms = metrics(); if (!ms.length) return; const r = range(S.hr.period), m = ms.find(x => x.key === S.hr.metric);
    const logs = S.d.production_logs.filter(l => inR(l.date, r.from, r.to) && l.vals && l.vals[m.key] !== undefined && l.vals[m.key] !== '').sort((a, b) => a.date < b.date ? -1 : 1);
    const vals = logs.map(l => N(l.vals[m.key])), avg = vals.length ? sum(vals) / vals.length : 0;
    mkChart('cLog', { type: 'line', data: { labels: logs.map(l => fmtDate(l.date).replace(/ \d{4}$/, '')), datasets: [{ label: m.label + ' (' + m.unit + ')', data: vals, borderColor: cssVar('--primary'), backgroundColor: cssVar('--primary-soft'), fill: true, tension: .3, pointRadius: logs.length > 40 ? 0 : 3, borderWidth: 2 }, { label: 'Rata-rata', data: vals.map(() => avg), borderColor: cssVar('--warn'), borderDash: [6, 5], pointRadius: 0, borderWidth: 1.5 }] },
      options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } } } } });
  }
};
function hrPeriod(k) { if (k === 'custom') return customRange(() => { S.hr.period = 'custom'; render(); }); S.hr.period = k; render(); }
function specialKPI(logs) {
  const out = [], v = k => logs.filter(l => l.vals && l.vals[k] !== undefined && l.vals[k] !== '');
  const has = k => metrics().some(m => m.key === k);
  if (has('butir') && has('populasi')) { const L = v('butir').filter(l => N(l.vals.populasi)); if (L.length) out.push(['HDP (Hen Day Production)', (sum(L, l => N(l.vals.butir) / N(l.vals.populasi) * 100) / L.length).toFixed(1) + '%', 'rata-rata produksi / populasi']); }
  if (has('pakan') && has('kg')) { const pk = sum(v('pakan'), l => l.vals.pakan), kg = sum(v('kg'), l => l.vals.kg); if (kg) out.push(['FCR (Konversi Pakan)', (pk / kg).toFixed(2), 'kg pakan per kg telur']); }
  if (has('butir') && has('kg')) { const b = sum(v('butir'), l => l.vals.butir), kg = sum(v('kg'), l => l.vals.kg); if (b) out.push(['Berat rata-rata telur', numf(kg / b * 1000, 1) + ' g', 'per butir']); }
  if (has('mati') && has('populasi')) { const mt = sum(v('mati'), l => l.vals.mati), pp = v('populasi').sort((a, b) => a.date < b.date ? -1 : 1)[0]; if (pp && N(pp.vals.populasi)) out.push(['Mortalitas', (mt / N(pp.vals.populasi) * 100).toFixed(2) + '%', mt + ' ekor pada periode ini']); }
  if (has('susut') && has('masuk')) { const s = sum(v('susut'), l => l.vals.susut), mk = sum(v('masuk'), l => l.vals.masuk); if (mk) out.push(['Tingkat Susut', (s / mk * 100).toFixed(1) + '%', 'dari barang masuk']); }
  if (has('pakan') && has('populasi') && !has('kg')) { const L = v('pakan').filter(l => N(l.vals.populasi)); if (L.length) out.push(['Pakan per ekor', numf(sum(L, l => N(l.vals.pakan) / N(l.vals.populasi)) / L.length, 2) + ' kg', 'per hari']); }
  return out;
}
function logForm(id, date) {
  const ms = metrics(); if (!ms.length) return metricForm();
  let l = id ? byId('production_logs', id) : S.d.production_logs.find(x => x.date === (date || today()));
  const v = l || { date: date || today(), vals: {}, note: '' };
  const prev = [...S.d.production_logs].sort((a, b) => a.date < b.date ? 1 : -1).find(x => x.date < v.date);
  modal(l ? 'Edit Catatan ' + fmtDate(v.date) : 'Catatan Harian', `<form id="lf"><label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${v.date}" onchange="const x=S.d.production_logs.find(y=>y.date===this.value);if(x&&x.id!=='${l ? l.id : ''}'){logForm(x.id)}"></label>
    <div class="f-row" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${ms.map(m => `<label class="f"><span>${esc(m.label)} (${esc(m.unit)})</span><input class="inp num" type="number" step="any" inputmode="decimal" name="m_${m.key}" value="${v.vals && v.vals[m.key] !== undefined ? v.vals[m.key] : (m.agg === 'last' && prev && prev.vals ? (prev.vals[m.key] ?? '') : '')}"></label>`).join('')}</div>
    <label class="f"><span>Catatan / kejadian</span><textarea class="inp" name="note" placeholder="cth: cuaca panas, vaksin ND, harga naik">${esc(v.note || '')}</textarea></label></form>`,
    { foot: `${l ? `<button class="btn danger" onclick="confirmBox('Hapus catatan tanggal ${fmtDate(v.date)}?',async()=>{await safe(()=>del('production_logs','${l.id}'),'Dihapus');render()})">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="lfs">Simpan</button>`,
      onMount: m => m.querySelector('#lfs').onclick = async () => {
        const f = formObj($('#lf')), vals = {}; ms.forEach(x => { const s = f['m_' + x.key]; if (s !== '' && s !== undefined) vals[x.key] = Number(s); });
        const ok = await safe(async () => { const ex = l || S.d.production_logs.find(x => x.date === f.date); if (ex) await upd('production_logs', ex.id, { date: f.date, vals, note: f.note }); else await add('production_logs', { date: f.date, vals, note: f.note }); return true; }, 'Catatan tersimpan ✅');
        if (ok) { closeModal(); render(); } } });
}
