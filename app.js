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
/* input nominal Rupiah: otomatis titik ribuan. `after` = kode JS tambahan yang dijalankan setiap kali diketik */
const moneyInput = (name, val, extra = '', after = '') => `<input class="inp num" name="${name}" inputmode="numeric" autocomplete="off" oninput="mfmt(this);${after}" value="${mval(val)}" placeholder="0" ${extra}>`;
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
  cloud: '<path d="M17.5 19H7a5 5 0 1 1 1.1-9.9A6 6 0 0 1 19.6 11 4 4 0 0 1 17.5 19z"/><path d="m9.5 14 2 2 3.5-3.5"/>',
  cloudoff: '<path d="M3 3l18 18M8.1 9.1A5 5 0 0 0 7 19h10.5c.6 0 1.2-.1 1.7-.4M21.6 15.4A4 4 0 0 0 19.6 11a6 6 0 0 0-8.9-4.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>',
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
    /* upsert by id: aman bila permintaan diulang otomatis saat sinyal putus (tidak dobel) */
    for (let i = 0; i < rows.length; i += 500) { const { data, error } = await S.sb.from(t).upsert(rows.slice(i, i + 500).map(strip), { onConflict: 'id' }).select(); if (error) throw error; out.push(...(data || [])); }
    return out;
  },
  async update(t, id, patch) { const { data, error } = await S.sb.from(t).update(strip(patch)).eq('id', id).select(); if (error) throw error; return data && data[0]; },
  async remove(t, id) { const { error } = await S.sb.from(t).delete().eq('id', id); if (error) throw error; },
  async clearBiz(bizId) { for (const t of [...TABLES].reverse()) { const { error } = await S.sb.from(t).delete().eq('business_id', bizId); if (error) throw error; } },
  async removeBiz(bizId) { const { error } = await S.sb.from('businesses').delete().eq('id', bizId); if (error) throw error; }
};
const B = () => S.mode === 'cloud' ? CloudSync : Local; /* CloudSync: lihat 7-sync.js (online + offline) */

/* operasi data (tulis ke backend + memori) */
function stamp(row) { return { id: uid(), business_id: S.biz.id, created_at: new Date().toISOString(), ...row }; }
async function add(t, row) { if (t === 'stock_moves') invalidateStock(); const r = stamp(row); const res = await B().insert(t, [r]); const saved = (res && res[0]) || r; S.d[t].push(saved); dataChanged(); return saved; }
async function addMany(t, rows) { if (!rows.length) return []; const rs = rows.map(stamp); const res = await B().insert(t, rs); const saved = (res && res.length) ? res : rs; S.d[t].push(...saved); dataChanged(); return saved; }
async function upd(t, id, patch) { await B().update(t, id, patch); const r = S.d[t].find(x => x.id === id); if (r) Object.assign(r, patch); dataChanged(); return r; }
async function del(t, id) { await B().remove(t, id); S.d[t] = S.d[t].filter(x => x.id !== id); dataChanged(); }
/* simpan pengaturan usaha berurutan (tidak saling menimpa) */
let _bizQ = Promise.resolve();
function updBiz(patch) { const id = S.biz.id; Object.assign(S.biz, patch); if (typeof Snap !== 'undefined') Snap.save(); const p = _bizQ.then(() => B().update('businesses', id, patch)); _bizQ = p.catch(() => {}); return p; }
/* terjemahkan pesan error teknis menjadi bahasa yang mudah dipahami */
function humanErr(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/load failed|failed to fetch|networkerror|network request failed|fetch failed|timeout/i.test(m) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 'Koneksi internet terputus. Periksa sinyal / WiFi lalu coba lagi.';
  if (/jwt expired|invalid jwt|not authenticated|refresh token/i.test(m)) return 'Sesi login berakhir. Silakan keluar lalu masuk lagi.';
  if (/row-level security|permission denied/i.test(m)) return 'Akses ditolak. Coba keluar lalu masuk lagi.';
  if (/duplicate key/i.test(m)) return 'Data ini sudah tersimpan.';
  if (/invalid login credentials/i.test(m)) return 'Email atau kata sandi salah.';
  if (/email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Buka email Anda dan klik link konfirmasi dulu.';
  if (/user already registered|already been registered/i.test(m)) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (/rate limit|only request this after|too many/i.test(m)) return 'Terlalu sering mencoba. Tunggu sekitar 1 menit lalu coba lagi.';
  if (/password should be at least|weak password/i.test(m)) return 'Kata sandi minimal 6 karakter.';
  if (/unable to validate email|invalid email/i.test(m)) return 'Format email tidak valid.';
  return m || 'Terjadi kesalahan';
}
async function safe(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { console.error(e); toast('Gagal: ' + humanErr(e), true); return false; }
}
/* fetch dengan percobaan ulang otomatis saat sinyal putus sesaat */
async function fetchRetry(input, init) {
  for (let i = 0; ; i++) {
    try { return await fetch(input, init); }
    catch (e) { if (i >= 3 || (init && init.signal && init.signal.aborted)) throw e; await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
}


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
/* STOK dihitung dari riwayat pergerakan: stok_awal (stock_base) + jumlah semua stock_moves.
   Penjualan/stok masuk dari beberapa HP (termasuk saat offline) hanya MENAMBAH riwayat, tidak saling menimpa. */
let _mv = null;
function movesSum(pid) { if (!_mv) { _mv = {}; S.d.stock_moves.forEach(m => { if (m.product_id) _mv[m.product_id] = (_mv[m.product_id] || 0) + N(m.qty); }); } return _mv[pid] || 0; }
function stockOf(p) { if (!p) return 0; return p.stock_base == null ? N(p.stock) : Math.round((N(p.stock_base) + movesSum(p.id)) * 1000) / 1000; }
const invalidateStock = () => { _mv = null; };
const debtLeft = d => Math.max(0, N(d.amount) - N(d.paid));
/* transaksi pembayaran hutang/piutang (bukan transaksi pencairan pinjaman) */
const isDebtPay = t => { if (t.ref !== 'debt') return false; const d = byId('debts', t.debt_id); return !d || (d.kind === 'piutang' ? t.type === 'in' : t.type === 'out'); };
const openDebts = kind => S.d.debts.filter(d => d.kind === kind && debtLeft(d) > 0.5);
function txTitle(t) {
  if (t.type === 'transfer') return 'Transfer Saldo';
  const c = cat(t.category_id);
  if (t.ref === 'adjust') return 'Penyesuaian Saldo';
  if (t.ref === 'debt') { const d = byId('debts', t.debt_id); if (!isDebtPay(t)) return d && d.kind === 'hutang' ? 'Pinjaman Diterima' : 'Pinjaman Diberikan'; return (t.type === 'in' ? 'Terima ' : 'Bayar ') + (d ? (d.kind === 'piutang' ? 'Piutang' : 'Hutang') : 'Hutang/Piutang'); }
  if (t.ref === 'sale') return c ? c.name : 'Penjualan';
  if (t.ref === 'purchase') return c ? c.name : 'Pembelian Stok';
  return c ? c.name : (t.type === 'in' ? 'Pemasukan' : 'Pengeluaran');
}
function txIcon(t) { if (t.type === 'transfer') return '🔁'; if (t.ref === 'adjust') return '⚖️'; if (t.ref === 'debt') return '🤝'; const c = cat(t.category_id); return (c && c.icon) || (t.type === 'in' ? '💰' : '🧾'); }
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
    <button class="biz-switch" onclick="bizMenu()"><span class="e">${esc(st.emoji || T.emoji)}</span><span class="grow"><b class="ell">${esc(S.biz.name)}</b><small class="ell">${esc(bizTypeLabel(S.biz))}</small></span>${ic('chev')}</button>
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
function go(p) { if (!navAllowed(p)) p = 'dashboard'; S.page = p; closeOverlays(); closeModal(); render(); window.scrollTo({ top: 0 }); try { history.replaceState(null, '', location.pathname + (p !== 'dashboard' ? '?page=' + p : '')); } catch (e) {} }
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
  modal('Pilih Usaha', `<div class="list">${S.businesses.map(b => { const T = TEMPLATES[b.type] || TEMPLATES.umum; return `<div class="li" onclick="closeModal();openBiz(S.businesses.find(x=>x.id==='${b.id}'))"><div class="av">${esc((b.settings && b.settings.emoji) || T.emoji)}</div><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${esc(bizTypeLabel(b))}</div></div>${b.id === S.biz.id ? `<span class="pill in">Aktif</span>` : ''}</div>`; }).join('')}</div>
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
  dr.innerHTML = `<div class="sheet-h"><h3>Notifikasi</h3><div class="row"><button class="btn sm" onclick="closeOverlays();go('pengaturan');setTimeout(()=>{const x=document.getElementById('set-notif');x&&x.scrollIntoView({behavior:'smooth'})},100)">${ic('gear')} Atur</button><button class="icon-btn" onclick="closeOverlays()">${ic('x')}</button></div></div>
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
/* =====================================================================
   HALAMAN: PRODUK & STOK, HUTANG PIUTANG, CATATAN HARIAN
   ===================================================================== */
S.stok = { q: '', f: 'all' };
PAGES.stok = {
  html() {
    const ps = S.d.products, tr = ps.filter(p => p.track_stock !== false && p.active !== false);
    const low = tr.filter(p => N(p.min_stock) > 0 && stockOf(p) <= N(p.min_stock));
    return `<div class="grid g4 mb">
      <div class="card kpi"><span class="k-lbl">Produk Aktif</span><div class="k-val">${ps.filter(p => p.active !== false).length}</div><span class="xs muted">${ps.length} total</span></div>
      <div class="card kpi"><span class="k-lbl">Nilai Stok (Modal)</span><div class="k-val num">${money(sum(tr, p => Math.max(0, stockOf(p)) * N(p.buy_price)))}</div><span class="xs muted">harga beli × stok</span></div>
      <div class="card kpi"><span class="k-lbl">Potensi Penjualan</span><div class="k-val num c-in">${money(sum(tr, p => Math.max(0, stockOf(p)) * N(p.sell_price)))}</div><span class="xs muted">harga jual × stok</span></div>
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
    (f === 'all' ? p.active !== false : f === 'low' ? (p.active !== false && p.track_stock !== false && stockOf(p) <= N(p.min_stock)) : f === 'notrack' ? p.track_stock === false : p.active === false)).sort((a, b) => a.name.localeCompare(b.name));
  $('#stokList').innerHTML = ps.length ? ps.map(p => { const low = p.track_stock !== false && stockOf(p) <= N(p.min_stock), mg = N(p.sell_price) - N(p.buy_price);
    return `<div class="li" onclick="productMenu('${p.id}')"><div class="av" style="background:var(--primary-soft);color:var(--primary);font-weight:800;font-size:15px">${esc(initials(p.name))}</div>
    <div class="grow"><div class="t ell">${esc(p.name)} ${p.active === false ? '<span class="pill neutral">nonaktif</span>' : ''}</div><div class="s ell">${[p.group_name, p.sku, 'Beli ' + money(p.buy_price), 'Jual ' + money(p.sell_price), N(p.buy_price) ? 'Margin ' + pct(mg, p.sell_price).toFixed(0) + '%' : ''].filter(Boolean).map(esc).join(' • ')}</div></div>
    <div style="text-align:right">${p.track_stock !== false ? `<div class="amt num ${low ? 'c-out' : ''}">${numf(stockOf(p), 2)} <small class="muted">${esc(p.unit || '')}</small></div>${low ? `<span class="pill ${stockOf(p) <= 0 ? 'out' : 'warn'}">${stockOf(p) <= 0 ? 'Habis' : 'Menipis'}</span>` : ''}` : '<span class="pill neutral">tanpa stok</span>'}</div></div>`; }).join('')
    : `<div class="empty"><div class="e">📦</div><p>${S.d.products.length ? 'Tidak ada produk di filter ini.' : 'Belum ada produk. Tambahkan barang yang Anda jual / simpan.'}</p><button class="btn primary sm" onclick="productForm()">${ic('plus')} Tambah Produk</button></div>`;
}
function productMenu(id) {
  const p = prod(id); if (!p) return;
  const moves = S.d.stock_moves.filter(m => m.product_id === id).sort((a, b) => a.date === b.date ? String(b.created_at).localeCompare(String(a.created_at)) : a.date < b.date ? 1 : -1).slice(0, 30);
  modal(esc(p.name), `<div class="grid g3 mb"><div><div class="xs muted">Stok</div><b class="num" style="font-size:18px">${p.track_stock !== false ? numf(stockOf(p), 2) + ' ' + esc(p.unit || '') : '—'}</b></div><div><div class="xs muted">Harga beli</div><b class="num">${money(p.buy_price)}</b></div><div><div class="xs muted">Harga jual</div><b class="num c-in">${money(p.sell_price)}</b></div></div>
    <div class="row wrap mb">${p.track_stock !== false ? `<button class="btn sm" onclick="stockIn('${id}')">${ic('download')} Stok Masuk</button><button class="btn sm" onclick="opname('${id}')">${ic('check')} Opname / Sesuaikan</button>` : ''}<button class="btn sm" onclick="productForm('${id}')">${ic('edit')} Edit</button><button class="btn sm danger" onclick="deleteProduct('${id}')">${ic('trash')} Hapus</button></div>
    <h4 style="margin:6px 0">Riwayat stok</h4>${moves.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Tanggal</th><th>Jenis</th><th class="r">Jumlah</th><th>Catatan</th></tr>${moves.map(m => `<tr><td>${fmtDate(m.date)}</td><td>${{ in: '📥 Masuk', sale: '🛒 Terjual', adjust: '⚖️ Penyesuaian', out: '📤 Keluar' }[m.kind] || m.kind}</td><td class="r num ${N(m.qty) < 0 ? 'c-out' : 'c-in'}">${N(m.qty) > 0 ? '+' : ''}${numf(m.qty, 2)}</td><td class="xs muted">${esc(m.note || '')}</td></tr>`).join('')}</table></div>` : '<p class="muted small">Belum ada pergerakan stok.</p>'}`, { wide: true });
}
function productForm(id) {
  const p = id ? prod(id) : { name: '', unit: 'pcs', buy_price: '', sell_price: '', stock: '', min_stock: '', track_stock: true, active: true, group_name: '', sku: '' };
  modal(id ? 'Edit Produk' : 'Produk Baru', `<form id="pf">
    <label class="f"><span>Nama produk / jasa</span><input class="inp" name="name" value="${esc(p.name)}" required autofocus></label>
    <div class="f-row"><div class="f"><span>Kelompok</span>${listPick('group_name', 'groups', p.group_name || '', { empty: 'Tanpa kelompok' })}</div>
      <div class="f"><span>Satuan</span>${listPick('unit', 'units', p.unit || 'pcs')}</div></div>
    <div class="f-row"><label class="f"><span>Harga beli / modal</span>${moneyInput('buy_price', p.buy_price)}</label><label class="f"><span>Harga jual</span>${moneyInput('sell_price', p.sell_price)}</label></div>
    <div class="f-row"><label class="f"><span>${id ? 'Stok saat ini' : 'Stok awal'}</span><input class="inp" type="number" step="any" name="stock" value="${id ? stockOf(p) : ''}" ${id ? 'readonly title="Ubah lewat Stok Masuk / Opname"' : ''}></label><label class="f"><span>Stok minimum (peringatan)</span><input class="inp" type="number" step="any" name="min_stock" value="${p.min_stock === '' ? '' : N(p.min_stock)}"></label></div>
    <label class="f"><span>Kode / SKU (opsional)</span><input class="inp" name="sku" value="${esc(p.sku || '')}"></label>
    <div class="set-row"><div class="t grow"><b>Lacak stok</b><small>Matikan untuk jasa / menu masakan</small></div><label class="switch"><input type="checkbox" name="track_stock" ${p.track_stock !== false ? 'checked' : ''}><i></i></label></div>
    <div class="set-row"><div class="t grow"><b>Aktif</b><small>Produk nonaktif tidak tampil di kasir</small></div><label class="switch"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><i></i></label></div>
  </form>`, { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="pfs">Simpan</button>`, onMount: m => m.querySelector('#pfs').onclick = async () => {
    const f = formObj($('#pf')); if (!f.name.trim()) return toast('Nama wajib diisi', true);
    if (S.d.products.some(x => x.id !== id && x.name.trim().toLowerCase() === f.name.trim().toLowerCase())) return toast('Produk dengan nama ini sudah ada', true);
    if (N(f.min_stock) < 0 || (!id && N(f.stock) < 0)) return toast('Stok tidak boleh minus', true);
    const row = { name: f.name.trim(), group_name: f.group_name.trim() || null, unit: f.unit.trim() || 'pcs', buy_price: parseMoney(f.buy_price), sell_price: parseMoney(f.sell_price), min_stock: N(f.min_stock), sku: f.sku.trim() || null, track_stock: !!f.track_stock, active: !!f.active };
    const ok = await safe(async () => { if (id) await upd('products', id, row); else { const np = await add('products', { ...row, stock: N(f.stock), stock_base: 0 }); if (N(f.stock)) await add('stock_moves', { product_id: np.id, date: today(), qty: N(f.stock), kind: 'adjust', note: 'Stok awal' }); } return true; }, 'Produk disimpan');
    if (ok) { closeModal(); render(); } } });
}
function deleteProduct(id) { const p = prod(id); confirmBox('Hapus produk <b>' + esc(p.name) + '</b>? Riwayat stoknya ikut terhapus (transaksi tetap ada). Tip: nonaktifkan saja jika masih ingin menyimpan datanya.', async () => { await safe(async () => { for (const m of S.d.stock_moves.filter(x => x.product_id === id)) S.d.stock_moves = S.d.stock_moves.filter(x => x.id !== m.id); if (S.mode === 'local') { const db = Local.db(); db.stock_moves = (db.stock_moves || []).filter(x => x.product_id !== id); Local.save(db); } await del('products', id); }, 'Produk dihapus'); render(); }); }
function stockInPick() {
  const ps = S.d.products.filter(p => p.active !== false && p.track_stock !== false);
  if (!ps.length) return productForm();
  modal('Pilih Produk', `<input class="inp mb" placeholder="Cari…" oninput="$$('#spl .li').forEach(x=>x.style.display=x.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none')"><div class="list" id="spl">${ps.map(p => `<div class="li" onclick="stockIn('${p.id}')"><div class="av">📦</div><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">Stok ${numf(stockOf(p), 2)} ${esc(p.unit || '')}</div></div></div>`).join('')}</div>
    <button class="btn block mt" onclick="productForm()">${ic('plus')} Produk baru</button>`);
}
function stockIn(pid) {
  if (!S.d.accounts.length) return toast('Tambahkan akun kas/bank dulu di Pengaturan', true);
  const p = prod(pid), outs = cats('out'); const guess = outs.find(c => /stok|beli|pembelian|bahan|barang|pakan|bibit/i.test(c.name)) || outs[0];
  modal('Stok Masuk — ' + esc(p.name), `<form id="sif">
    <div class="f-row"><label class="f"><span>Jumlah (${esc(p.unit || '')})</span><input class="inp" type="number" step="any" name="qty" required autofocus oninput="siCalc()"></label><label class="f"><span>Harga beli / ${esc(p.unit || 'unit')}</span>${moneyInput('price', p.buy_price, '', 'siCalc()')}</label></div>
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
  if (f.pay === 'credit' && !(total > 0)) return toast('Isi harga beli untuk mencatat hutang', true);
  if (f.pay !== 'none' && total > 0 && !f.cat) return toast('Pilih kategori biaya (tambah di Pengaturan bila kosong)', true);
  if (!f.date) return toast('Isi tanggal', true);
  const btn = $('#sis'); busy(btn, true);
  const ok = await safe(async () => {
    let txId = null; const items = [{ pid, name: p.name, qty, price, cost: price, unit: p.unit }];
    if (f.pay === 'credit') await add('debts', { kind: 'hutang', contact_id: f.contact_id || null, amount: total, paid: 0, date: f.date, due_date: f.due || null, category_id: f.cat, source: 'purchase', note: 'Pembelian ' + p.name + ' ' + qty + ' ' + (p.unit || '') });
    else if (f.pay !== 'none' && total > 0) txId = (await add('transactions', { date: f.date, type: 'out', amount: total, category_id: f.cat, account_id: f.pay, contact_id: f.contact_id || null, ref: 'purchase', items, note: f.note || ('Beli ' + p.name) })).id;
    if (price && f.pay !== 'none' && price !== N(p.buy_price)) await upd('products', pid, { buy_price: price });
    await add('stock_moves', { product_id: pid, date: f.date, qty, kind: 'in', note: f.pay === 'none' ? (f.note || 'Hasil produksi') : (f.note || 'Pembelian'), transaction_id: txId });
    return true;
  }, 'Stok ' + p.name + ' bertambah ' + numf(qty, 2));
  busy(btn, false); if (ok) { closeModal(); render(); }
}
function opname(pid) {
  const p = prod(pid);
  modal('Sesuaikan Stok — ' + esc(p.name), `<form id="opf"><p class="muted small" style="margin-top:0">Stok tercatat: <b>${numf(stockOf(p), 2)} ${esc(p.unit || '')}</b>. Masukkan jumlah stok fisik sebenarnya.</p>
    <label class="f"><span>Stok fisik</span><input class="inp big" type="number" step="any" name="real" value="${stockOf(p)}" autofocus></label>
    <div class="f"><span>Alasan</span>${listPick('note', 'reasons', listGet('reasons')[0] || '')}</div></form>`,
    { foot: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn primary" id="ops">Simpan</button>`, onMount: m => m.querySelector('#ops').onclick = async () => {
      const f = formObj($('#opf')); if (f.real === '' || N(f.real) < 0) return toast('Isi stok fisik (tidak boleh minus)', true); const real = N(f.real), diff = real - stockOf(p); if (!diff) { closeModal(); return toast('Stok sudah sesuai'); }
      const ok = await safe(async () => { await add('stock_moves', { product_id: pid, date: today(), qty: diff, kind: 'adjust', note: f.note }); return true; }, 'Stok disesuaikan (' + (diff > 0 ? '+' : '') + numf(diff, 2) + ')');
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
    if (id && amount < N(d.paid)) return toast('Jumlah tidak boleh lebih kecil dari yang sudah dibayar (' + money(d.paid) + ')', true);
    if (f.due_date && f.due_date < f.date) return toast('Jatuh tempo tidak boleh sebelum tanggal', true);
    if (!id && f.cash && !f.account_id) return toast('Pilih akun kas', true);
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
  if (!d) return;
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
        if (!f.date) return toast('Isi tanggal', true);
        if (!Object.keys(vals).length && !f.note.trim()) return toast('Isi minimal satu data atau catatan', true);
        const ok = await safe(async () => { const ex = l || S.d.production_logs.find(x => x.date === f.date); if (ex) await upd('production_logs', ex.id, { date: f.date, vals, note: f.note }); else await add('production_logs', { date: f.date, vals, note: f.note }); return true; }, 'Catatan tersimpan ✅');
        if (ok) { closeModal(); render(); } } });
}
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
    ${S.d.accounts.map(a => `<div class="opt-row" style="flex-wrap:wrap"><div class="av" style="width:38px;height:38px;font-size:16px">${a.type === 'kas' ? '💵' : a.type === 'bank' ? '🏦' : '📱'}</div><div class="grow" style="min-width:120px"><b style="font-size:14px">${esc(a.name)}</b><div class="xs muted">Tercatat <span class="num">${money(accBalance(a))}</span></div></div><input class="inp num" style="max-width:170px" name="b_${a.id}" inputmode="numeric" autocomplete="off" value="${mval(Math.max(0, accBalance(a)))}" oninput="mfmt(this);baCalc()" aria-label="Saldo ${esc(a.name)}"></div>`).join('')}
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
    <div class="f-row"><label class="f"><span>Jenis</span><select class="inp" name="type">${[['kas', 'Kas tunai'], ['bank', 'Bank'], ['ewallet', 'E-Wallet / QRIS']].map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="f"><span>Warna</span><input class="inp" type="color" name="color" value="${a.color || '#0d9488'}" style="height:46px;padding:4px"></label></div>
    ${id ? `<div class="card mb" style="padding:12px;background:var(--surface-2)"><div class="row between"><div><div class="xs muted">Saldo saat ini</div><b class="num" style="font-size:18px">${money(accBalance(a))}</b></div><button type="button" class="btn sm primary" onclick="balanceForm('${id}')">${ic('edit')} Ubah saldo</button></div></div>` : ''}
    <label class="f"><span>Saldo awal${id ? ' (saldo saat akun dibuat)' : ''}</span>${moneyInput('opening_balance', a.opening_balance)}</label>${id ? '<p class="xs muted" style="margin-top:-6px">Mengubah saldo awal ikut menggeser saldo di semua periode laporan.</p>' : ''}</form>`,
    { foot: `${id ? `<button class="btn danger" onclick="deleteAccount('${id}')">${ic('trash')}</button>` : '<button class="btn" onclick="closeModal()">Batal</button>'}<button class="btn primary" id="afs">Simpan</button>`,
      onMount: m => m.querySelector('#afs').onclick = async () => { const f = formObj($('#af')); if (!f.name.trim()) return toast('Nama wajib diisi', true); const row = { name: f.name.trim(), type: f.type, color: f.color, opening_balance: parseMoney(f.opening_balance) };
        const ok = await safe(async () => { if (id) await upd('accounts', id, row); else await add('accounts', row); return true; }, 'Akun disimpan'); if (ok) { closeModal(); render(); } } });
}
function deleteAccount(id) { if (S.d.transactions.some(t => t.account_id === id || t.to_account_id === id)) return toast('Akun sudah punya transaksi, tidak bisa dihapus', true); if (S.d.accounts.length <= 1) return toast('Minimal harus ada 1 akun', true); confirmBox('Hapus akun ini?', async () => { await safe(() => del('accounts', id), 'Akun dihapus'); render(); }); }
function catForm(id, type) {
  const c = id ? cat(id) : { name: '', type: type || 'out', icon: '🧾', color: PALETTE[S.d.categories.length % 12] };
  modal(id ? 'Edit Kategori' : 'Kategori Baru', `<form id="kf"><div class="f-row" style="grid-template-columns:80px 1fr"><label class="f"><span>Ikon</span><input class="inp" name="icon" value="${esc(c.icon || '')}" maxlength="4" style="text-align:center;font-size:20px"></label><label class="f"><span>Nama</span><input class="inp" name="name" value="${esc(c.name)}" required autofocus></label></div>
    <div class="f-row"><label class="f"><span>Jenis</span><select class="inp" name="type"><option value="in" ${c.type === 'in' ? 'selected' : ''}>Pemasukan</option><option value="out" ${c.type === 'out' ? 'selected' : ''}>Pengeluaran</option></select></label><label class="f"><span>Warna</span><input class="inp" type="color" name="color" value="${c.color || '#0d9488'}" style="height:46px;padding:4px"></label></div>
    <p class="xs muted">Ide ikon: 💰 🛒 📦 🥚 🌽 💊 🐔 🍊 🚚 💡 🏠 👷 🧾 📣 🔧 🎁</p></form>`,
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
/* =====================================================================
   PENGATURAN, DAFTAR PILIHAN, USAHA & BUKU, KEAMANAN (PIN & PRIVASI)
   ===================================================================== */
const bizTypeLabel = b => (b && b.settings && b.settings.typeLabel) || (TEMPLATES[b && b.type] || TEMPLATES.umum).label;
const secBadge = () => S.mode === 'cloud' && (isOffline() || S.offline) ? `<div class="sec-badge local" title="Perubahan disimpan di perangkat & dikirim otomatis saat online">${ic('cloudoff')}<span>Offline • data aman di perangkat</span></div>` : `<div class="sec-badge ${S.mode === 'cloud' ? '' : 'local'}" title="${S.mode === 'cloud' ? 'Koneksi HTTPS terenkripsi; data dilindungi Row Level Security (hanya akun Anda yang bisa membaca)' : 'Data hanya tersimpan di browser perangkat ini'}">${ic('shield')}<span>${S.mode === 'cloud' ? 'Tersinkron & terenkripsi' : 'Tersimpan di perangkat ini'}</span>${Lock.enabled() ? ic('lock') : ''}</div>`;
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
/* Dropdown pilihan dari daftar + "Tambah baru" (langsung masuk ke daftar & tersimpan, juga saat offline) */
function listPick(name, k, value, opt = {}) {
  value = value == null ? '' : String(value);
  const items = listItems(k), all = value && !items.includes(value) ? [...items, value] : items, id = 'lp_' + name;
  return `<div class="lpick" id="${id}"><select class="inp" name="${esc(name)}" data-k="${k}" data-prev="${esc(value)}" onchange="lpChange(this)">
    ${opt.empty ? `<option value="" ${!value ? 'selected' : ''}>${esc(opt.empty)}</option>` : ''}
    ${all.map(v => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(v)}</option>`).join('')}
    <option value="__new">➕ Tambah ${esc(LIST_META[k][2])} baru…</option></select>
    <div class="lp-new" hidden><input class="inp" maxlength="40" placeholder="Nama ${esc(LIST_META[k][2])} baru" onkeydown="if(event.key==='Enter'){event.preventDefault();lpAdd('${id}')}else if(event.key==='Escape'){event.preventDefault();lpCancel('${id}')}">
    <button type="button" class="btn primary sm" onclick="lpAdd('${id}')">Tambah</button><button type="button" class="icon-btn" title="Batal" aria-label="Batal" onclick="lpCancel('${id}')">${ic('x')}</button></div></div>`;
}
function lpChange(sel) {
  if (sel.value !== '__new') { sel.dataset.prev = sel.value; return; }
  const box = sel.parentElement, nw = box.querySelector('.lp-new');
  sel.value = sel.dataset.prev; nw.hidden = false; const i = nw.querySelector('input'); i.value = ''; setTimeout(() => i.focus(), 30);
}
function lpCancel(id) { const box = document.getElementById(id); if (box) box.querySelector('.lp-new').hidden = true; }
async function lpAdd(id) {
  const box = document.getElementById(id); if (!box) return;
  const sel = box.querySelector('select'), inp = box.querySelector('.lp-new input'), k = sel.dataset.k, v = inp.value.trim().replace(/\s+/g, ' ');
  if (!v) { toast('Isi nama ' + LIST_META[k][2] + ' baru', true); return inp.focus(); }
  const l = listItems(k), hit = l.find(x => x.toLowerCase() === v.toLowerCase());
  const pick = val => {
    let o = [...sel.options].find(o => o.value === val);
    if (!o) { o = new Option(val, val); sel.insertBefore(o, sel.querySelector('option[value="__new"]')); }
    sel.value = val; sel.dataset.prev = val; box.querySelector('.lp-new').hidden = true;
  };
  if (hit) { pick(hit); return toast('"' + hit + '" sudah ada di daftar — dipilih'); }
  const ok = await safe(async () => { await listSave(k, [...l, v]); return true; }, '"' + v + '" ditambahkan ke daftar ' + LIST_META[k][2]);
  if (ok) pick(v);
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
        await B().insert('products', copy(data.products, { stock: 0, stock_base: 0 }));
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
        ${S.mode === 'cloud' ? `<div class="set-row"><div class="t grow"><b>Kata sandi akun</b><small>Ganti kata sandi login</small></div><button class="btn sm" onclick="changePass()">${ic('lock')} Ubah</button></div>` : ''}${S.mode === 'cloud' ? `<div class="set-row"><div class="t grow"><b>Keluar dari semua perangkat</b><small>Akhiri semua sesi login akun ini</small></div><button class="btn sm danger" onclick="logout(true)">${ic('logout')} Keluar semua</button></div>` : ''}</div>

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

      <div class="card"><div class="card-h"><h3>💳 Akun Kas, Bank & E-Wallet</h3><div class="row gap-s"><button class="btn sm" onclick="balanceAll()">${ic('edit')} Ubah saldo</button><button class="btn sm primary" onclick="accountForm()">${ic('plus')} Akun</button></div></div>
        ${S.d.accounts.map(a => `<div class="opt-row"><div class="av" style="width:38px;height:38px;font-size:16px">${a.type === 'kas' ? '💵' : a.type === 'bank' ? '🏦' : '📱'}</div><div class="grow" style="min-width:0"><b class="ell" style="display:block;font-size:14px">${esc(a.name)}</b><button type="button" class="xs" style="background:none;border:0;padding:0;color:var(--primary);font-weight:700;cursor:pointer" onclick="balanceForm('${a.id}')">Saldo <span class="num">${money(accBalance(a))}</span> ✎</button></div>${rowBtns(`accountForm('${a.id}')`, `deleteAccount('${a.id}')`)}</div>`).join('')}</div>

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
