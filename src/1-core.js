/* =====================================================================
   BukuKas Pro — Aplikasi Pembukuan Usaha (PWA + Supabase)
   ---------------------------------------------------------------------
   ISI 2 BARIS DI BAWAH INI dengan data project Supabase Anda
   (Supabase Dashboard → Project Settings → API).
   Jika dikosongkan, aplikasi akan menanyakannya saat pertama dibuka,
   atau bisa dipakai dalam "Mode Lokal" (data tersimpan di perangkat).
   ===================================================================== */
const CONFIG = {
  SUPABASE_URL: 'https://fftmmdyvrxzrbrhdvucq.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_5NEAM1_TavJaqTG8YAUgEg_g1sd-tiE',
  VAPID_PUBLIC_KEY: 'BCggAHqd6OQZNZ4y0igN4whrWzcykSIl-G8GCSrxt3U-TRIRhdHMsokfu2ktb59lK6Aq7nkdbUN_TJ2lV39L5Vw', // kunci publik notifikasi push (pasangan kunci privat ada di Supabase Vault)
  APP_NAME: 'BukuKas Pro'
};
/* Zona waktu Indonesia — dipakai untuk tanggal transaksi & jam pengingat */
const TIMEZONES = { 'Asia/Jakarta': 'WIB (Jawa, Sumatera, Kalbar, Kalteng)', 'Asia/Makassar': 'WITA (Bali, NTB, NTT, Sulawesi, Kalsel, Kaltim)', 'Asia/Jayapura': 'WIT (Maluku, Papua)' };
let APP_TZ = 'Asia/Jakarta';

/* ---------------- utilitas ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = v => Number(v) || 0;
const sum = (arr, f) => arr.reduce((a, x) => a + N(f ? f(x) : x), 0);
const dstr = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
function nowTZ() {
  try { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return { date: p.year + '-' + p.month + '-' + p.day, h: Number(p.hour) % 24, m: Number(p.minute) }; }
  catch (e) { const d = new Date(); return { date: dstr(d), h: d.getHours(), m: d.getMinutes() }; }
}
const today = () => nowTZ().date;
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return dstr(d); };
const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtDay = s => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function cur() { return 'IDR'; } // aplikasi khusus Indonesia: semua nominal dalam Rupiah
function money(n) {
  const c = cur(); const dec = (c === 'IDR' || c === 'KRW') ? 0 : 2;
  try { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: c, maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(N(n)); }
  catch (e) { return 'Rp ' + Math.round(N(n)).toLocaleString('id-ID'); }
}
function short(n) {
  n = N(n); const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e12) return s + (a / 1e12).toFixed(1).replace('.0', '') + 'T';
  if (a >= 1e9) return s + (a / 1e9).toFixed(1).replace('.0', '') + 'M';
  if (a >= 1e6) return s + (a / 1e6).toFixed(1).replace('.0', '') + 'jt';
  if (a >= 1e3) return s + (a / 1e3).toFixed(0) + 'rb';
  return s + a.toLocaleString('id-ID');
}
const numf = (n, d = 0) => N(n).toLocaleString('id-ID', { maximumFractionDigits: d });
const parseMoney = v => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
const mval = n => N(n) ? Math.round(N(n)).toLocaleString('id-ID') : '';
function mfmt(el) { const v = el.value.replace(/\D/g, ''); el.value = v ? Number(v).toLocaleString('id-ID') : ''; }
const moneyInput = (name, val, extra = '') => `<input class="inp num" name="${name}" inputmode="numeric" autocomplete="off" oninput="mfmt(this)" value="${mval(val)}" placeholder="0" ${extra}>`;
const formObj = f => Object.fromEntries(new FormData(f));
const pct = (a, b) => b ? (a / b * 100) : 0;
const initials = s => (String(s || '?').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '•').toUpperCase();

/* ---------------- ikon ---------------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  book: '<path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h11"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5"/><path d="M16 14h.01"/>',
  up: '<path d="M7 17 17 7M8 7h9v9"/>', down: '<path d="M17 7 7 17M16 17H7V8"/>',
  swap: '<path d="m7 4-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  chev: '<path d="m6 9 6 6 6-6"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  install: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/>',
  store: '<path d="M3 9 4.5 4h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8M10 21v-5h4v5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1.1M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

/* ---------------- template jenis usaha ---------------- */
const TEMPLATES = {
  warung: { label: 'Toko / Warung Kelontong', emoji: '🏪', desc: 'Kasir, stok barang, hutang pelanggan',
    inc: [['Penjualan', '🛒'], ['Pendapatan Lain', '💰']],
    out: [['Belanja Stok', '📦'], ['Listrik & Air', '💡'], ['Sewa Tempat', '🏠'], ['Gaji Karyawan', '👷'], ['Transportasi', '🛵'], ['Operasional Lain', '🧾']],
    metrics: [{ key: 'pembeli', label: 'Jumlah Pembeli', unit: 'orang', agg: 'sum', s: [25, 70] }],
    mods: { kasir: true, stok: true, hutang: true, harian: false, anggaran: true },
    products: [['Beras 5 kg', 'karung', 68000, 75000, 12, 3], ['Minyak Goreng 1 L', 'botol', 15500, 18000, 24, 6], ['Gula Pasir 1 kg', 'kg', 15000, 17500, 20, 5], ['Telur Ayam', 'kg', 26000, 29000, 8, 3], ['Kopi Sachet', 'renceng', 11000, 13000, 15, 4], ['Mie Instan', 'pcs', 2700, 3500, 80, 20], ['Air Mineral 600ml', 'botol', 2500, 4000, 48, 12], ['Gas LPG 3 kg', 'tabung', 18000, 22000, 6, 3]],
    scale: [250000, 900000, 30000, 350000] },
  telur: { label: 'Peternakan Ayam Petelur', emoji: '🥚', desc: 'Produksi telur, pakan, HDP & FCR',
    inc: [['Penjualan Telur', '🥚'], ['Penjualan Ayam Afkir', '🐔'], ['Penjualan Kotoran/Pupuk', '🌱']],
    out: [['Pakan', '🌽'], ['Vitamin & Obat', '💊'], ['Bibit (DOC/Pullet)', '🐣'], ['Gaji Anak Kandang', '👷'], ['Listrik & Air', '💡'], ['Peralatan Kandang', '🧰'], ['Egg Tray / Kemasan', '📦']],
    metrics: [{ key: 'populasi', label: 'Populasi Ayam', unit: 'ekor', agg: 'last', s: [990, 1000] }, { key: 'butir', label: 'Produksi Telur', unit: 'butir', agg: 'sum', s: [850, 930] }, { key: 'kg', label: 'Berat Telur', unit: 'kg', agg: 'sum', s: [53, 58] }, { key: 'pakan', label: 'Pakan Habis', unit: 'kg', agg: 'sum', s: [112, 120] }, { key: 'mati', label: 'Ayam Mati', unit: 'ekor', agg: 'sum', s: [0, 2] }],
    mods: { kasir: true, stok: true, hutang: true, harian: true, anggaran: true },
    products: [['Telur (kg)', 'kg', 21000, 26500, 120, 30], ['Telur (peti 15 kg)', 'peti', 315000, 390000, 6, 2], ['Pakan Layer', 'sak', 380000, 380000, 10, 4]],
    scale: [1200000, 2600000, 100000, 1500000] },
  buah: { label: 'Jual Beli Buah / Sayur', emoji: '🍊', desc: 'Stok kiloan, susut, grosir & eceran',
    inc: [['Penjualan Eceran', '🍎'], ['Penjualan Grosir', '🚚']],
    out: [['Pembelian Buah', '🧺'], ['Transportasi', '🛻'], ['Kemasan', '🛍️'], ['Sewa Lapak', '🏠'], ['Retribusi', '🧾'], ['Gaji', '👷']],
    metrics: [{ key: 'masuk', label: 'Barang Masuk', unit: 'kg', agg: 'sum', s: [40, 120] }, { key: 'terjual', label: 'Barang Terjual', unit: 'kg', agg: 'sum', s: [35, 110] }, { key: 'susut', label: 'Susut / Busuk', unit: 'kg', agg: 'sum', s: [1, 6] }],
    mods: { kasir: true, stok: true, hutang: true, harian: true, anggaran: true },
    products: [['Jeruk Medan', 'kg', 18000, 25000, 40, 10], ['Apel Fuji', 'kg', 32000, 42000, 25, 8], ['Pisang Cavendish', 'sisir', 18000, 25000, 30, 8], ['Semangka', 'kg', 6000, 9000, 60, 15], ['Mangga Harum Manis', 'kg', 20000, 28000, 35, 10]],
    scale: [400000, 1500000, 50000, 900000] },
  kuliner: { label: 'Kuliner / Warung Makan', emoji: '🍜', desc: 'Menu, bahan baku, porsi terjual',
    inc: [['Penjualan Makanan', '🍛'], ['Penjualan Minuman', '🥤'], ['Pesanan Katering', '🍱']],
    out: [['Bahan Baku', '🥬'], ['Gas & Bahan Bakar', '🔥'], ['Kemasan', '📦'], ['Gaji', '👷'], ['Sewa', '🏠'], ['Listrik & Air', '💡']],
    metrics: [{ key: 'porsi', label: 'Porsi Terjual', unit: 'porsi', agg: 'sum', s: [60, 160] }, { key: 'buang', label: 'Bahan Terbuang', unit: 'kg', agg: 'sum', s: [0, 3] }],
    mods: { kasir: true, stok: true, hutang: false, harian: true, anggaran: true },
    products: [['Nasi Goreng', 'porsi', 9000, 18000, 0, 0, false], ['Mie Ayam', 'porsi', 7000, 15000, 0, 0, false], ['Es Teh', 'gelas', 1500, 5000, 0, 0, false], ['Ayam Geprek', 'porsi', 10000, 20000, 0, 0, false]],
    scale: [500000, 2000000, 50000, 700000] },
  tani: { label: 'Pertanian / Perkebunan', emoji: '🌾', desc: 'Musim tanam, pupuk, hasil panen',
    inc: [['Hasil Panen', '🌾'], ['Penjualan Bibit', '🌱']],
    out: [['Bibit', '🌱'], ['Pupuk', '🧪'], ['Pestisida', '🐛'], ['Upah Tenaga Kerja', '👷'], ['Sewa Lahan', '🏞️'], ['Irigasi / Air', '💧'], ['Alat & Mesin', '🚜']],
    metrics: [{ key: 'panen', label: 'Hasil Panen', unit: 'kg', agg: 'sum', s: [0, 300] }, { key: 'tk', label: 'Tenaga Kerja', unit: 'orang', agg: 'avg', s: [2, 6] }],
    mods: { kasir: false, stok: true, hutang: true, harian: true, anggaran: true },
    products: [['Gabah Kering', 'kg', 0, 6500, 500, 0], ['Cabai Rawit', 'kg', 0, 35000, 40, 0]],
    scale: [300000, 3000000, 50000, 800000] },
  ternak: { label: 'Peternakan (Sapi/Kambing/Ikan)', emoji: '🐄', desc: 'Populasi, pakan, kematian, penjualan',
    inc: [['Penjualan Ternak', '🐄'], ['Penjualan Susu / Hasil', '🥛'], ['Penjualan Pupuk', '🌱']],
    out: [['Pakan', '🌾'], ['Obat & Vaksin', '💊'], ['Bibit Ternak', '🐣'], ['Upah Kandang', '👷'], ['Listrik & Air', '💡'], ['Peralatan', '🧰']],
    metrics: [{ key: 'populasi', label: 'Populasi', unit: 'ekor', agg: 'last', s: [40, 42] }, { key: 'pakan', label: 'Pakan Habis', unit: 'kg', agg: 'sum', s: [180, 220] }, { key: 'mati', label: 'Mati', unit: 'ekor', agg: 'sum', s: [0, 1] }],
    mods: { kasir: false, stok: true, hutang: true, harian: true, anggaran: true },
    products: [['Kambing Jantan', 'ekor', 2200000, 3200000, 15, 3], ['Konsentrat', 'sak', 210000, 210000, 8, 3]],
    scale: [500000, 4000000, 80000, 900000] },
  jasa: { label: 'Usaha Jasa (Bengkel, Laundry, Salon…)', emoji: '🛠️', desc: 'Order jasa, bahan, pelanggan',
    inc: [['Pendapatan Jasa', '🛠️'], ['Penjualan Produk / Sparepart', '🔩']],
    out: [['Bahan & Sparepart', '🧴'], ['Gaji', '👷'], ['Sewa', '🏠'], ['Listrik & Air', '💡'], ['Peralatan', '🧰'], ['Promosi', '📣']],
    metrics: [{ key: 'order', label: 'Jumlah Order', unit: 'order', agg: 'sum', s: [5, 20] }],
    mods: { kasir: true, stok: true, hutang: true, harian: true, anggaran: true },
    products: [['Jasa Servis Ringan', 'jasa', 0, 50000, 0, 0, false], ['Cuci Kiloan', 'kg', 2500, 7000, 0, 0, false], ['Oli Mesin', 'botol', 42000, 55000, 20, 5]],
    scale: [200000, 1200000, 30000, 400000] },
  online: { label: 'Toko Online / Reseller', emoji: '🛍️', desc: 'Marketplace, ongkir, iklan, retur',
    inc: [['Penjualan Marketplace', '🛍️'], ['Penjualan Langsung', '🤝']],
    out: [['Pembelian Barang', '📦'], ['Ongkos Kirim', '🚚'], ['Iklan', '📣'], ['Kemasan', '🎁'], ['Biaya Admin Marketplace', '🏷️']],
    metrics: [{ key: 'order', label: 'Pesanan', unit: 'order', agg: 'sum', s: [3, 25] }, { key: 'retur', label: 'Retur', unit: 'pcs', agg: 'sum', s: [0, 2] }],
    mods: { kasir: true, stok: true, hutang: false, harian: true, anggaran: true },
    products: [['Kaos Polos', 'pcs', 35000, 59000, 40, 10], ['Hijab Segi Empat', 'pcs', 28000, 45000, 30, 8], ['Tumbler 500ml', 'pcs', 30000, 55000, 18, 5]],
    scale: [300000, 1500000, 30000, 500000] },
  umum: { label: 'Usaha Lainnya', emoji: '💼', desc: 'Pembukuan umum yang fleksibel',
    inc: [['Pendapatan Usaha', '💼'], ['Pendapatan Lain', '💰']],
    out: [['Bahan / Barang', '📦'], ['Gaji', '👷'], ['Sewa', '🏠'], ['Listrik & Air', '💡'], ['Transportasi', '🚗'], ['Operasional Lain', '🧾']],
    metrics: [],
    mods: { kasir: true, stok: true, hutang: true, harian: false, anggaran: true },
    products: [], scale: [200000, 1000000, 30000, 400000] }
};
const PALETTE = ['#0d9488', '#4f46e5', '#d97706', '#db2777', '#0284c7', '#65a30d', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#475569', '#16a34a'];
const DEFAULT_NOTIF = { stok: true, piutang: true, hutang: true, anggaran: true, catat: true, harian: true, ringkasan: false, target: true, push: false, jam: '19:00', hari_jatuh_tempo: 3 };
const MODULES = { kasir: ['Kasir / Penjualan', 'Jual cepat dari daftar produk, struk & piutang'], stok: ['Produk & Stok', 'Data barang, stok masuk, opname, stok menipis'], hutang: ['Hutang & Piutang', 'Catat pinjaman, kasbon pelanggan & cicilan'], harian: ['Catatan Harian / Produksi', 'Data produksi harian: telur, panen, porsi, dll'], anggaran: ['Anggaran Biaya', 'Batas pengeluaran bulanan per kategori'] };

/* ---------------- state ---------------- */
const TABLES = ['accounts', 'categories', 'contacts', 'products', 'debts', 'transactions', 'stock_moves', 'production_logs', 'budgets'];
const S = { mode: null, sb: null, user: null, businesses: [], biz: null, d: {}, page: 'dashboard', period: 'month', custom: { from: addDays(today(), -29), to: today() },
  charts: [], cart: [], tx: { q: '', type: 'all', cat: '', acc: '', period: 'month' }, installEvt: null };
TABLES.forEach(t => S.d[t] = []);

/* ---------------- backend: Lokal & Supabase ---------------- */
const Local = {
  db() { return LS.get('bk_db', { businesses: [] }); },
  save(db) { LS.set('bk_db', db); },
  async listBiz() { return this.db().businesses || []; },
  async load(bizId) { const db = this.db(); const o = {}; TABLES.forEach(t => o[t] = (db[t] || []).filter(r => r.business_id === bizId)); return o; },
  async insert(t, rows) { const db = this.db(); db[t] = db[t] || []; rows.forEach(r => db[t].push(r)); this.save(db); return rows; },
  async update(t, id, patch) { const db = this.db(); const r = (db[t] || []).find(x => x.id === id); if (r) Object.assign(r, patch); this.save(db); return r; },
  async remove(t, id) { const db = this.db(); db[t] = (db[t] || []).filter(x => x.id !== id); this.save(db); },
  async clearBiz(bizId) { const db = this.db(); TABLES.forEach(t => db[t] = (db[t] || []).filter(r => r.business_id !== bizId)); this.save(db); },
  async removeBiz(bizId) { await this.clearBiz(bizId); const db = this.db(); db.businesses = db.businesses.filter(b => b.id !== bizId); this.save(db); }
};
const strip = r => { const o = { ...r }; delete o.user_id; return o; };
const Cloud = {
  async listBiz() { const { data, error } = await S.sb.from('businesses').select('*').order('created_at'); if (error) throw error; return data || []; },
  async fetchAll(t, bizId) {
    let out = [], from = 0; const step = 1000;
    for (;;) { const { data, error } = await S.sb.from(t).select('*').eq('business_id', bizId).range(from, from + step - 1); if (error) throw error; out = out.concat(data || []); if (!data || data.length < step) break; from += step; }
    return out;
  },
  async load(bizId) { const res = await Promise.all(TABLES.map(t => this.fetchAll(t, bizId))); const o = {}; TABLES.forEach((t, i) => o[t] = res[i]); return o; },
  async insert(t, rows) {
    const out = [];
    for (let i = 0; i < rows.length; i += 500) { const { data, error } = await S.sb.from(t).insert(rows.slice(i, i + 500).map(strip)).select(); if (error) throw error; out.push(...(data || [])); }
    return out;
  },
  async update(t, id, patch) { const { data, error } = await S.sb.from(t).update(strip(patch)).eq('id', id).select(); if (error) throw error; return data && data[0]; },
  async remove(t, id) { const { error } = await S.sb.from(t).delete().eq('id', id); if (error) throw error; },
  async clearBiz(bizId) { for (const t of [...TABLES].reverse()) { const { error } = await S.sb.from(t).delete().eq('business_id', bizId); if (error) throw error; } },
  async removeBiz(bizId) { const { error } = await S.sb.from('businesses').delete().eq('id', bizId); if (error) throw error; }
};
const B = () => S.mode === 'cloud' ? Cloud : Local;

/* operasi data (tulis ke backend + memori) */
function stamp(row) { return { id: uid(), business_id: S.biz.id, created_at: new Date().toISOString(), ...row }; }
async function add(t, row) { const r = stamp(row); const res = await B().insert(t, [r]); const saved = (res && res[0]) || r; S.d[t].push(saved); dataChanged(); return saved; }
async function addMany(t, rows) { if (!rows.length) return []; const rs = rows.map(stamp); const res = await B().insert(t, rs); const saved = (res && res.length) ? res : rs; S.d[t].push(...saved); dataChanged(); return saved; }
async function upd(t, id, patch) { await B().update(t, id, patch); const r = S.d[t].find(x => x.id === id); if (r) Object.assign(r, patch); dataChanged(); return r; }
async function del(t, id) { await B().remove(t, id); S.d[t] = S.d[t].filter(x => x.id !== id); dataChanged(); }
async function updBiz(patch) { await B().update('businesses', S.biz.id, patch); Object.assign(S.biz, patch); }
async function safe(fn, okMsg) { try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { console.error(e); toast('Gagal: ' + (e.message || e), true); return false; } }

/* lookups */
const byId = (t, id) => S.d[t].find(x => x.id === id);
const cat = id => byId('categories', id);
const acc = id => byId('accounts', id);
const prod = id => byId('products', id);
const contact = id => byId('contacts', id);
const cats = type => S.d.categories.filter(c => c.type === type);
const mods = () => ({ ...TEMPLATES.umum.mods, ...(S.biz.settings.mods || {}) });
const notifSet = () => ({ ...DEFAULT_NOTIF, ...(S.biz.settings.notif || {}) });
const metrics = () => S.biz.settings.metrics || [];
function normalizeBiz(b) { b.settings = b.settings || {}; if (typeof b.settings === 'string') try { b.settings = JSON.parse(b.settings); } catch (e) { b.settings = {}; } return b; }
function contactName(id, fallback) { const c = contact(id); return c ? c.name : (fallback || '-'); }

/* ---------------- perhitungan ---------------- */
function range(p, custom) {
  const t = today(), y = +t.slice(0, 4), m = +t.slice(5, 7) - 1; let from, to = t, label;
  switch (p) {
    case 'today': from = t; label = 'Hari ini'; break;
    case '7d': from = addDays(t, -6); label = '7 hari terakhir'; break;
    case '30d': from = addDays(t, -29); label = '30 hari terakhir'; break;
    case 'lastmonth': from = dstr(new Date(y, m - 1, 1)); to = dstr(new Date(y, m, 0)); label = BULAN[(m + 11) % 12] + ' ' + (m ? y : y - 1); break;
    case 'year': from = y + '-01-01'; label = 'Tahun ' + y; break;
    case 'all': { const ds = S.d.transactions.map(x => x.date).sort(); from = ds[0] || t; label = 'Semua waktu'; break; }
    case 'custom': { const c = custom || S.custom; from = c.from; to = c.to; label = fmtDate(from) + ' – ' + fmtDate(to); break; }
    default: from = dstr(new Date(y, m, 1)); label = BULAN[m] + ' ' + y;
  }
  const len = diffDays(from, to) + 1;
  return { from, to, label, len, prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
}
const inR = (date, from, to) => date >= from && date <= to;
const isPL = t => t.type !== 'transfer' && !!t.category_id;
function totals(from, to) {
  let inc = 0, out = 0, cin = 0, cout = 0, omzet = 0, hpp = 0;
  for (const t of S.d.transactions) {
    if (!inR(t.date, from, to)) continue;
    if (t.type === 'in') { cin += N(t.amount); if (isPL(t)) inc += N(t.amount); }
    else if (t.type === 'out') { cout += N(t.amount); if (isPL(t)) out += N(t.amount); }
    if (t.ref === 'sale') { omzet += N(t.amount); hpp += N(t.cost); }
  }
  return { inc, out, profit: inc - out, cin, cout, omzet, hpp, gross: omzet - hpp };
}
function accBalance(a, upto) {
  let b = N(a.opening_balance);
  for (const t of S.d.transactions) {
    if (upto && t.date > upto) continue;
    if (t.type === 'in' && t.account_id === a.id) b += N(t.amount);
    else if (t.type === 'out' && t.account_id === a.id) b -= N(t.amount);
    else if (t.type === 'transfer') { if (t.account_id === a.id) b -= N(t.amount); if (t.to_account_id === a.id) b += N(t.amount); }
  }
  return b;
}
const totalBalance = () => sum(S.d.accounts, a => accBalance(a));
const debtLeft = d => Math.max(0, N(d.amount) - N(d.paid));
const openDebts = kind => S.d.debts.filter(d => d.kind === kind && debtLeft(d) > 0.5);
function txTitle(t) {
  if (t.type === 'transfer') return 'Transfer Saldo';
  const c = cat(t.category_id);
  if (t.ref === 'debt') { const d = byId('debts', t.debt_id); return (t.type === 'in' ? 'Terima ' : 'Bayar ') + (d ? (d.kind === 'piutang' ? 'Piutang' : 'Hutang') : 'Hutang/Piutang'); }
  if (t.ref === 'sale') return c ? c.name : 'Penjualan';
  if (t.ref === 'purchase') return c ? c.name : 'Pembelian Stok';
  return c ? c.name : (t.type === 'in' ? 'Pemasukan' : 'Pengeluaran');
}
function txIcon(t) { if (t.type === 'transfer') return '🔁'; if (t.ref === 'debt') return '🤝'; const c = cat(t.category_id); return (c && c.icon) || (t.type === 'in' ? '💰' : '🧾'); }
function catSpend(catId, from, to) { return sum(S.d.transactions.filter(t => t.category_id === catId && t.type === 'out' && inR(t.date, from, to)), t => t.amount); }
function monthRange(offset = 0) { const d = new Date(today() + 'T00:00:00'); const a = new Date(d.getFullYear(), d.getMonth() + offset, 1), b = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0); return { from: dstr(a), to: dstr(b) }; }
function metricAgg(m, logs) {
  const vals = logs.map(l => l.vals && l.vals[m.key]).filter(v => v !== undefined && v !== null && v !== '').map(Number);
  if (!vals.length) return null;
  if (m.agg === 'last') { const s = logs.filter(l => l.vals && l.vals[m.key] !== undefined && l.vals[m.key] !== '').sort((a, b) => a.date < b.date ? 1 : -1); return Number(s[0].vals[m.key]); }
  if (m.agg === 'avg') return sum(vals) / vals.length;
  return sum(vals);
}

/* ---------------- UI dasar: toast, modal, drawer ---------------- */
function toast(msg, err) { const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg; $('#toast').appendChild(el); setTimeout(() => el.remove(), err ? 4500 : 2600); }
function modal(title, body, opt = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet ${opt.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="sheet-h"><h3>${title}</h3><button class="icon-btn" onclick="closeModal()" aria-label="Tutup">${ic('x')}</button></div><div class="sheet-b">${body}</div>${opt.foot ? `<div class="sheet-f">${opt.foot}</div>` : ''}</div>`;
  m.classList.add('open'); document.body.style.overflow = 'hidden';
  const first = m.querySelector('[autofocus]'); if (first && window.innerWidth > 640) setTimeout(() => first.focus(), 60);
  opt.onMount && opt.onMount(m);
}
function closeModal() { $('#modal').classList.remove('open'); $('#modal').innerHTML = ''; document.body.style.overflow = ''; }
function confirmBox(msg, onYes, yesLabel = 'Ya, hapus') {
  modal('Konfirmasi', `<p style="margin:0 0 6px">${msg}</p>`, { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="cfy">${yesLabel}</button>`,
    onMount: m => m.querySelector('#cfy').onclick = async () => { const b = m.querySelector('#cfy'); b.disabled = true; await onYes(); closeModal(); } });
}
function closeOverlays() { $('.side') && $('.side').classList.remove('on'); $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); }
function openSide() { $('.side').classList.add('on'); $('#scrim').classList.add('on'); }
function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.t = btn.innerHTML; btn.innerHTML = '<span class="loader" style="width:18px;height:18px;border-width:3px"></span>'; } else if (btn.dataset.t) btn.innerHTML = btn.dataset.t; }

/* ---------------- tema ---------------- */
function applyTheme() {
  const t = LS.get('bk_theme', 'auto'), a = LS.get('bk_accent', 'blue'), el = document.documentElement;
  if (t === 'auto') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', t);
  el.setAttribute('data-accent', a);
  const m = document.querySelector('meta[name=theme-color]'); if (m) setTimeout(() => m.setAttribute('content', cssVar('--primary')), 0);
  document.body && document.body.classList.toggle('privacy', !!LS.get('bk_privacy', false));
}
function setTheme(t) { LS.set('bk_theme', t); applyTheme(); render(); }
function setAccent(a) { LS.set('bk_accent', a); applyTheme(); render(); }
function togglePrivacy() { LS.set('bk_privacy', !LS.get('bk_privacy', false)); applyTheme(); const b = $('#privBtn'); if (b) { b.innerHTML = ic(LS.get('bk_privacy', false) ? 'eyeoff' : 'eye'); b.classList.toggle('on', LS.get('bk_privacy', false)); } toast(LS.get('bk_privacy', false) ? 'Nominal disembunyikan 🙈' : 'Nominal ditampilkan'); }
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------------- PWA ---------------- */
function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW gagal', e));
  navigator.serviceWorker.addEventListener && navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.page) go(e.data.page); });
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; $$('.install-btn').forEach(b => b.classList.remove('hidden')); });
window.addEventListener('appinstalled', () => { S.installEvt = null; toast('Aplikasi berhasil di-install 🎉'); $$('.install-btn').forEach(b => b.classList.add('hidden')); });
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
async function installApp() {
  if (S.installEvt) { S.installEvt.prompt(); await S.installEvt.userChoice; S.installEvt = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  modal('Install Aplikasi', ios ?
    `<ol style="padding-left:18px;margin:0;line-height:1.9"><li>Buka aplikasi ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li><li>Pilih <b>Tambah ke Layar Utama</b> → <b>Tambah</b>.</li></ol><p class="muted small">Setelah itu ikon BukuKas muncul di layar utama dan berjalan seperti aplikasi biasa.</p>` :
    `<ol style="padding-left:18px;margin:0;line-height:1.9"><li>Buka menu browser (⋮ di Chrome / Edge).</li><li>Pilih <b>Install aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li><li>Konfirmasi <b>Install</b>.</li></ol><p class="muted small">Di PC, ikon install juga muncul di ujung kanan kolom alamat. Pastikan aplikasi dibuka lewat alamat <b>https://</b>.</p>`);
}
