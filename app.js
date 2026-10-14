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
  install: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/>'
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
function applyTheme() { const t = LS.get('bk_theme', 'auto'); if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
function setTheme(t) { LS.set('bk_theme', t); applyTheme(); render(); }
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
    if (!window.supabase) { screen(`<div class="auth-card">${brandHTML()}<p>Tidak bisa memuat pustaka Supabase. Periksa koneksi internet lalu muat ulang.</p><button class="btn primary block" onclick="location.reload()">Muat ulang</button><button class="btn block mt" onclick="useLocal()">Pakai Mode Lokal</button></div>`); return; }
    try { S.sb = supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } }); } catch (e) { LS.del('bk_cfg'); return showSetup('URL/kunci Supabase tidak valid.'); }
    S.mode = 'cloud';
    const { data } = await S.sb.auth.getSession();
    if (data && data.session) { S.user = data.session.user; return afterAuth(); }
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
    <div class="row between mt"><button class="btn ghost sm" onclick="useLocal()">Mode Lokal</button>${!cfg.fixed ? `<button class="btn ghost sm" onclick="LS.del('bk_cfg');location.reload()">Ganti database</button>` : ''}</div></div>`);
}
async function doAuth(e, tab) {
  e.preventDefault(); const f = formObj(e.target); const b = $('#authBtn'); busy(b, true);
  try {
    if (tab === 'reg') {
      const { data, error } = await S.sb.auth.signUp({ email: f.email, password: f.pass, options: { data: { name: f.name }, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      if (!data.session) { showAuth('login', '✅ Akun dibuat. Silakan cek email Anda untuk konfirmasi, lalu masuk.'); return false; }
      S.user = data.user;
    } else {
      const { data, error } = await S.sb.auth.signInWithPassword({ email: f.email, password: f.pass });
      if (error) throw error; S.user = data.user;
    }
    await afterAuth();
  } catch (err) { busy(b, false); toast(err.message === 'Invalid login credentials' ? 'Email atau kata sandi salah' : err.message, true); }
  return false;
}
async function forgotPass() {
  const email = prompt('Masukkan email akun Anda:'); if (!email) return;
  const { error } = await S.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  toast(error ? error.message : 'Link reset kata sandi dikirim ke email', !!error);
}
async function logout() {
  confirmBox('Keluar dari akun ini?', async () => {
    if (S.mode === 'cloud') await S.sb.auth.signOut(); else LS.del('bk_mode');
    location.reload();
  }, 'Keluar');
}

async function afterAuth() {
  screen('<div class="loader"></div>');
  try { S.businesses = (await B().listBiz()).map(normalizeBiz); }
  catch (e) { screen(`<div class="auth-card">${brandHTML()}<p><b>Gagal memuat data.</b><br><span class="muted small">${esc(e.message)}</span></p><p class="small muted">Pastikan file <b>schema.sql</b> sudah dijalankan di Supabase SQL Editor.</p><button class="btn primary block" onclick="location.reload()">Coba lagi</button><button class="btn block mt" onclick="S.sb.auth.signOut().then(()=>location.reload())">Keluar</button></div>`); return; }
  if (!S.businesses.length) return showWizard();
  const last = LS.get('bk_biz'); await openBiz(S.businesses.find(b => b.id === last) || S.businesses[0]);
}
async function openBiz(b) {
  S.biz = normalizeBiz(b); APP_TZ = S.biz.settings.tz || 'Asia/Jakarta'; LS.set('bk_biz', b.id); S.cart = []; screen('<div class="loader"></div>');
  try { S.d = await B().load(b.id); } catch (e) { toast('Gagal memuat: ' + e.message, true); return; }
  $('#screen').classList.add('hidden'); $('#app').classList.remove('hidden'); window.scrollTo(0, 0);
  shell(); if (!navAllowed(S.page)) S.page = 'dashboard'; render(); checkAlerts(true);
  if (S.mode === 'cloud' && notifSet().push && 'Notification' in window && Notification.permission === 'granted') subscribePush(true);
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
    await seedBiz(T, parseMoney(f.cash), !!f.sample);
    await openBiz(saved); toast('Usaha "' + saved.name + '" siap digunakan 🎉');
  } catch (err) { busy(b, false); toast('Gagal membuat usaha: ' + err.message, true); }
  return false;
}
async function seedBiz(T, cash, sample) {
  const accs = await addMany('accounts', [{ name: 'Kas Tunai', type: 'kas', opening_balance: cash, color: '#0d9488' }, { name: 'Rekening Bank', type: 'bank', opening_balance: 0, color: '#4f46e5' }, { name: 'E-Wallet / QRIS', type: 'ewallet', opening_balance: 0, color: '#d97706' }]);
  let i = 0;
  const cs = await addMany('categories', [...T.inc.map(([n, e]) => ({ name: n, type: 'in', icon: e, color: PALETTE[i++ % 12] })), ...T.out.map(([n, e]) => ({ name: n, type: 'out', icon: e, color: PALETTE[i++ % 12] }))]);
  const prods = await addMany('products', T.products.map(p => ({ name: p[0], unit: p[1], buy_price: p[2], sell_price: p[3], stock: sample ? p[4] : 0, min_stock: p[5], track_stock: p[6] !== false, active: true })));
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
  { id: 'pengaturan', label: 'Pengaturan', icon: 'gear' }
];
const navAllowed = id => { const n = NAV.find(x => x.id === id); return n && (!n.mod || mods()[n.mod]); };
function shell() {
  const st = S.biz.settings, T = TEMPLATES[S.biz.type] || TEMPLATES.umum, m = mods();
  const items = NAV.filter(n => !n.mod || m[n.mod]);
  const third = m.kasir ? { id: 'kasir', label: 'Kasir', icon: 'cart' } : { id: 'laporan', label: 'Laporan', icon: 'chart' };
  $('#app').innerHTML = `
  <aside class="side">
    <button class="biz-switch" onclick="bizMenu()"><span class="e">${esc(st.emoji || T.emoji)}</span><span class="grow"><b class="ell">${esc(S.biz.name)}</b><small class="ell">${esc(T.label)}</small></span>${ic('chev')}</button>
    <nav class="nav">${items.map(n => `${n.id === 'laporan' || n.id === 'pengaturan' ? '<div class="sep"></div>' : ''}<button data-nav="${n.id}" onclick="go('${n.id}')">${ic(n.icon)}<span>${n.label}</span></button>`).join('')}</nav>
    <div class="side-foot">
      <button class="btn sm install-btn ${S.installEvt ? '' : (isStandalone() ? 'hidden' : '')}" onclick="installApp()">${ic('install')} Install Aplikasi</button>
      <div class="row small muted" style="padding:4px 6px"><span class="grow ell">${S.mode === 'cloud' ? '☁️ ' + esc(S.user && S.user.email) : '📱 Mode Lokal'}</span><button class="icon-btn" style="width:34px;height:34px" title="Keluar" onclick="logout()">${ic('logout')}</button></div>
    </div>
  </aside>
  <main class="main">
    <header class="topbar">
      <button class="icon-btn mob-only" onclick="openSide()" aria-label="Menu">${ic('menu')}</button>
      <div class="grow"><h2 id="pgTitle"></h2><div class="sub" id="pgSub"></div></div>
      <div id="topExtra" class="row desk-only"></div>
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
  S.charts.forEach(c => { try { c.destroy(); } catch (e) {} }); S.charts = [];
  $$('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === S.page));
  const pg = PAGES[S.page] || PAGES.dashboard; const n = NAV.find(x => x.id === S.page);
  $('#pgTitle').textContent = n ? n.label : '';
  $('#pgSub').textContent = S.page === 'dashboard' ? sapa() : S.biz.name;
  $('#topExtra').innerHTML = '';
  $('#content').innerHTML = pg.html();
  pg.mount && pg.mount();
  updateBell();
}
function sapa() { const h = nowTZ().h; return (h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam') + ' 👋 ' + fmtDay(today()); }
let _dc; function dataChanged() { clearTimeout(_dc); _dc = setTimeout(() => { updateBell(); checkAlerts(false); }, 400); }

function bizMenu() {
  modal('Pilih Usaha', `<div class="list">${S.businesses.map(b => { const T = TEMPLATES[b.type] || TEMPLATES.umum; return `<div class="li" onclick="closeModal();openBiz(S.businesses.find(x=>x.id==='${b.id}'))"><div class="av">${esc((b.settings && b.settings.emoji) || T.emoji)}</div><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${esc(T.label)}</div></div>${b.id === S.biz.id ? `<span class="pill in">Aktif</span>` : ''}</div>`; }).join('')}</div>
  <button class="btn primary block mt" onclick="closeModal();closeOverlays();WZ.type='warung';showWizard(true)">${ic('plus')} Tambah Usaha Baru</button>
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
  if (ns.stok && m.stok) S.d.products.filter(p => p.active !== false && p.track_stock !== false && N(p.min_stock) > 0 && N(p.stock) <= N(p.min_stock)).forEach(p =>
    A.push({ id: 'stok-' + p.id + '-' + N(p.stock), lv: N(p.stock) <= 0 ? 'danger' : 'warn', e: '📦', t: (N(p.stock) <= 0 ? 'Stok habis: ' : 'Stok menipis: ') + p.name, b: 'Sisa ' + numf(p.stock, 2) + ' ' + (p.unit || '') + ' (minimum ' + numf(p.min_stock) + ')', page: 'stok' }));
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
  if (S.mode !== 'cloud' || !CONFIG.VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
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
  Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif'; Chart.defaults.color = cssVar('--muted'); Chart.defaults.borderColor = cssVar('--line');
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
    { label: 'Pemasukan', data: b.inc, backgroundColor: cssVar('--in'), borderRadius: 6, maxBarThickness: 18 },
    { label: 'Pengeluaran', data: b.out, backgroundColor: cssVar('--out'), borderRadius: 6, maxBarThickness: 18 },
    { label: 'Laba', type: 'line', data: b.inc.map((v, i) => v - b.out[i]), borderColor: cssVar('--info'), backgroundColor: cssVar('--info'), tension: .35, pointRadius: 0, borderWidth: 2 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: moneyTip },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }, y: { ticks: { callback: v => short(v) } } } } });
}
function donut(id, type, r) {
  const m = {}; S.d.transactions.forEach(t => { if (t.type === type && isPL(t) && inR(t.date, r.from, r.to)) m[t.category_id] = (m[t.category_id] || 0) + N(t.amount); });
  const rows = Object.entries(m).sort((a, b) => b[1] - a[1]); if (!rows.length) return false;
  mkChart(id, { type: 'doughnut', data: { labels: rows.map(x => (cat(x[0]) || {}).name || '-'), datasets: [{ data: rows.map(x => x[1]), backgroundColor: rows.map((x, i) => (cat(x[0]) || {}).color || PALETTE[i % 12]), borderWidth: 2, borderColor: cssVar('--surface') }] },
    options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } }, tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + money(c.parsed) } } } } });
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
        <div class="lbl">Total Saldo Usaha</div>
        <div class="val num">${money(bal)}</div>
        <div class="acc-chips">${S.d.accounts.map(a => `<div class="acc-chip"><small>${esc(a.name)}</small><b class="num">${money(accBalance(a))}</b></div>`).join('')}</div>
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
  const low = S.d.products.filter(p => p.track_stock !== false && N(p.min_stock) > 0 && N(p.stock) <= N(p.min_stock)).length; if (low) out.push(['📦', `<b>${low} produk</b> stoknya menipis — segera belanja ulang.`]);
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
  const cl = cats(type === 'transfer' ? 'x' : type);
  const title = t ? 'Detail Transaksi' : type === 'in' ? 'Catat Pemasukan' : type === 'out' ? 'Catat Pengeluaran' : 'Transfer Saldo';
  const body = `<form id="txf">
    ${!t ? `<div class="seg"><button type="button" class="${type === 'in' ? 'on in' : ''}" onclick="txForm(null,'in')">⬆ Pemasukan</button><button type="button" class="${type === 'out' ? 'on out' : ''}" onclick="txForm(null,'out')">⬇ Pengeluaran</button><button type="button" class="${type === 'transfer' ? 'on' : ''}" onclick="txForm(null,'transfer')">🔁 Transfer</button></div>` : `<div class="row mb"><span class="pill ${type === 'in' ? 'in' : type === 'out' ? 'out' : 'info'}">${type === 'in' ? 'Pemasukan' : type === 'out' ? 'Pengeluaran' : 'Transfer'}</span>${t.ref ? `<span class="pill neutral">${t.ref === 'sale' ? 'Penjualan kasir' : t.ref === 'purchase' ? 'Pembelian stok' : 'Hutang/Piutang'}</span>` : ''}</div>`}
    ${t && t.items ? `<div class="card mb" style="background:var(--surface-2);padding:12px">${t.items.map(i => `<div class="row between small"><span>${esc(i.name)} × ${numf(i.qty, 2)}</span><b class="num">${money(N(i.qty) * N(i.price))}</b></div>`).join('')}${N(t.disc) ? `<div class="row between small muted"><span>Diskon</span><span>−${money(t.disc)}</span></div>` : ''}${t.ref === 'sale' ? `<div class="row between xs muted" style="margin-top:6px"><span>Modal (HPP)</span><span>${money(t.cost)} • laba ${money(N(t.amount) - N(t.cost))}</span></div>` : ''}</div>` : ''}
    <label class="f"><span>Jumlah</span><input class="inp big num ${type === 'in' ? 'c-in' : type === 'out' ? 'c-out' : ''}" name="amount" inputmode="numeric" oninput="mfmt(this)" value="${mval(v.amount)}" placeholder="0" ${lockAmt ? 'readonly' : ''} autofocus></label>
    ${type !== 'transfer' ? `<label class="f"><span>Kategori</span></label><input type="hidden" name="category_id" value="${v.category_id || ''}">
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
async function quickCat(type) {
  const name = prompt('Nama kategori ' + (type === 'in' ? 'pemasukan' : 'pengeluaran') + ' baru:'); if (!name || !name.trim()) return;
  const c = await safe(() => add('categories', { name: name.trim(), type, icon: type === 'in' ? '💰' : '🧾', color: PALETTE[S.d.categories.length % 12] })); if (!c) return;
  const g = $('#catGrid'); g.insertAdjacentHTML('afterbegin', catOpt(c)); pickCat(g.firstElementChild);
}
async function saveTx(id, type) {
  const f = formObj($('#txf')), t = id ? byId('transactions', id) : null, amount = parseMoney(f.amount);
  if (!amount) return toast('Isi jumlah transaksi', true);
  if (type !== 'transfer' && !f.category_id) return toast('Pilih kategori', true);
  if (type === 'transfer' && f.account_id === f.to_account_id) return toast('Akun asal dan tujuan harus berbeda', true);
  const row = { date: f.date, type, amount, account_id: f.account_id, note: f.note.trim(), category_id: type === 'transfer' ? null : f.category_id, to_account_id: type === 'transfer' ? f.to_account_id : null, contact_id: f.contact_id || null };
  const btn = $('#txSave'); busy(btn, true);
  const ok = await safe(async () => {
    if (t) {
      if (t.ref === 'sale' || t.ref === 'purchase') { delete row.amount; delete row.type; }
      if (t.ref === 'debt' && t.debt_id && amount !== N(t.amount)) { const d = byId('debts', t.debt_id); if (d) await upd('debts', d.id, { paid: Math.max(0, N(d.paid) + amount - N(t.amount)) }); }
      if (t.ref === 'debt') row.category_id = t.category_id;
      await upd('transactions', t.id, row);
    } else await add('transactions', row);
    return true;
  }, t ? 'Perubahan disimpan' : 'Transaksi tersimpan ✅');
  busy(btn, false); if (ok) { closeModal(); render(); }
}
function deleteTx(id) {
  const t = byId('transactions', id); if (!t) return;
  const note = t.ref === 'sale' ? ' Stok barang akan dikembalikan.' : t.ref === 'purchase' ? ' Stok barang akan dikurangi kembali.' : t.ref === 'debt' ? ' Sisa hutang/piutang akan bertambah lagi.' : '';
  confirmBox('Hapus transaksi <b>' + esc(txTitle(t)) + '</b> sebesar <b>' + money(t.amount) + '</b>?' + note, async () => {
    await safe(async () => {
      if ((t.ref === 'sale' || t.ref === 'purchase') && t.items) {
        for (const it of t.items) { const p = prod(it.pid); if (p && p.track_stock !== false) await upd('products', p.id, { stock: N(p.stock) + (t.ref === 'sale' ? 1 : -1) * N(it.qty) }); }
        for (const mv of S.d.stock_moves.filter(x => x.transaction_id === t.id)) await del('stock_moves', mv.id);
      }
      if (t.ref === 'debt' && t.debt_id) { const d = byId('debts', t.debt_id); if (d) await upd('debts', d.id, { paid: Math.max(0, N(d.paid) - N(t.amount)) }); }
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
      <div class="card cart"><div class="card-h"><h3>🛒 Keranjang</h3><button class="btn sm ghost" onclick="S.cart=[];renderCart()">Kosongkan</button></div><div id="cartBox"></div></div>
    </div>
    <div class="cart-bar" id="cartBar" onclick="checkoutForm()"></div>`;
  },
  mount() { renderPGrid(); renderCart(); }
};
function renderPGrid() {
  const q = S.kasir.q.trim().toLowerCase();
  const ps = S.d.products.filter(p => p.active !== false && (!S.kasir.grp || p.group_name === S.kasir.grp) && (!q || (p.name + ' ' + (p.sku || '')).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  const g = $('#pgrid'); if (!g) return;
  g.innerHTML = ps.length ? ps.map(p => { const inCart = S.cart.find(c => c.pid === p.id); const low = p.track_stock !== false && N(p.stock) <= N(p.min_stock);
    return `<div class="pcard ${low ? 'low' : ''}" onclick="cartAdd('${p.id}')">${inCart ? `<span class="q">${numf(inCart.qty, 2)}</span>` : ''}<div class="pe">${esc(initials(p.name))}</div><b>${esc(p.name)}</b><span class="ps">${p.track_stock !== false ? 'Stok ' + numf(p.stock, 2) + ' ' + esc(p.unit || '') : esc(p.unit || 'item')}</span><span class="pp num">${money(p.sell_price)}</span></div>`; }).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="e">📦</div><p>${S.d.products.length ? 'Produk tidak ditemukan.' : 'Belum ada produk.'}</p><button class="btn primary sm" onclick="productForm()">${ic('plus')} Tambah Produk</button></div>`;
}
const cartTotal = () => sum(S.cart, c => N(c.qty) * N(c.price));
function cartAdd(pid) {
  const p = prod(pid); if (!p) return; const c = S.cart.find(x => x.pid === pid);
  if (c) c.qty = N(c.qty) + 1; else S.cart.push({ pid, name: p.name, price: N(p.sell_price), cost: N(p.buy_price), qty: 1, unit: p.unit });
  const q = (c || S.cart[S.cart.length - 1]).qty;
  if (p.track_stock !== false && q > N(p.stock)) toast('⚠️ Stok ' + p.name + ' tidak mencukupi (sisa ' + numf(p.stock, 2) + ')', true);
  if (navigator.vibrate) navigator.vibrate(12);
  renderCart(); renderPGrid();
}
function cartSet(i, v) { v = Number(String(v).replace(',', '.')); if (!(v > 0)) S.cart.splice(i, 1); else S.cart[i].qty = v; renderCart(); renderPGrid(); }
function renderCart() {
  const box = $('#cartBox'), bar = $('#cartBar'), tot = cartTotal(), n = S.cart.length;
  if (box) box.innerHTML = n ? `<div class="cart-items">${S.cart.map((c, i) => `<div class="ci"><div class="grow"><div class="ell" style="font-weight:700;font-size:13.5px">${esc(c.name)}</div><div class="xs muted num">${money(c.price)} / ${esc(c.unit || 'item')}</div></div>
      <div class="qty"><button onclick="cartSet(${i},${N(c.qty) - 1})">−</button><input value="${c.qty}" inputmode="decimal" onchange="cartSet(${i},this.value)"><button onclick="cartSet(${i},${N(c.qty) + 1})">+</button></div>
      <b class="num" style="min-width:76px;text-align:right;font-size:13.5px">${money(N(c.qty) * N(c.price))}</b></div>`).join('')}</div>
      <div class="total-line"><span>Total</span><span class="num">${money(tot)}</span></div><button class="btn primary block" onclick="checkoutForm()">${ic('check')} Bayar</button>`
    : `<div class="empty"><div class="e">🛒</div><p class="small">Ketuk produk untuk menambah ke keranjang.</p></div>`;
  if (bar) { bar.style.display = n ? '' : 'none'; bar.innerHTML = `${ic('cart')}<span class="grow">${n} item</span><b class="num">${money(tot)}</b><span>Bayar ›</span>`; }
}
function manualItem() {
  modal('Item Manual', `<form id="mif"><label class="f"><span>Nama item / jasa</span><input class="inp" name="name" required autofocus></label><div class="f-row"><label class="f"><span>Harga</span>${moneyInput('price', '')}</label><label class="f"><span>Jumlah</span><input class="inp" name="qty" type="number" step="any" value="1"></label></div><button class="btn primary block">Tambah ke Keranjang</button></form>`,
    { onMount: m => m.querySelector('#mif').onsubmit = e => { e.preventDefault(); const f = formObj(e.target); S.cart.push({ pid: null, name: f.name, price: parseMoney(f.price), cost: 0, qty: N(f.qty) || 1, unit: 'item' }); closeModal(); renderCart(); } });
}
const saleCategory = () => cats('in').find(c => c.id === S.biz.settings.sale_cat) || cats('in')[0];
function checkoutForm() {
  if (!S.cart.length) return toast('Keranjang masih kosong', true);
  const tot = cartTotal(), m = mods(), sc = saleCategory();
  const body = `<form id="cof">
    <div class="card mb" style="background:var(--surface-2);padding:12px;max-height:160px;overflow:auto">${S.cart.map(c => `<div class="row between small"><span class="ell">${esc(c.name)} × ${numf(c.qty, 2)}</span><b class="num">${money(N(c.qty) * N(c.price))}</b></div>`).join('')}</div>
    <div class="f-row"><label class="f"><span>Subtotal</span><input class="inp num" value="${money(tot)}" readonly></label><label class="f"><span>Diskon</span>${moneyInput('disc', '', 'oninput="mfmt(this);coCalc()"')}</label></div>
    <div class="total-line" style="font-size:24px"><span>Total</span><span class="num c-in" id="coTotal">${money(tot)}</span></div>
    <label class="f"><span>Metode pembayaran</span></label><input type="hidden" name="method" value="${S.d.accounts[0] ? S.d.accounts[0].id : ''}">
    <div class="pay-opts">${S.d.accounts.map((a, i) => `<div class="pay-opt ${i === 0 ? 'on' : ''}" data-v="${a.id}" data-kas="${a.type === 'kas' ? 1 : 0}" onclick="coPay(this)">${a.type === 'kas' ? '💵' : a.type === 'bank' ? '🏦' : '📱'} ${esc(a.name)}</div>`).join('')}${m.hutang ? `<div class="pay-opt" data-v="credit" onclick="coPay(this)">📝 Bayar Nanti</div>` : ''}</div>
    <div id="coCash"><label class="f"><span>Uang diterima</span>${moneyInput('cash', '', 'oninput="mfmt(this);coCalc()"')}</label><div class="quick-cash" id="qcash"></div><div class="row between mb"><span class="muted">Kembalian</span><b class="num" id="coChange" style="font-size:18px">-</b></div></div>
    <div class="f-row"><label class="f"><span>Pelanggan</span><select class="inp" name="contact_id"><option value="">— Umum —</option>${S.d.contacts.filter(c => c.type !== 'supplier').map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f"><span>atau nama baru</span><input class="inp" name="new_contact" placeholder="Nama pelanggan"></label></div>
    <div id="coDue" class="hidden"><label class="f"><span>Jatuh tempo pembayaran</span><input class="inp" type="date" name="due" value="${addDays(today(), 7)}"></label></div>
    <div class="f-row"><label class="f"><span>Kategori</span><select class="inp" name="cat">${cats('in').map(c => `<option value="${c.id}" ${sc && c.id === sc.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f"><span>Tanggal</span><input class="inp" type="date" name="date" value="${today()}"></label></div>
    <label class="f"><span>Catatan</span><input class="inp" name="note"></label></form>`;
  modal('Pembayaran', body, { foot: `<button class="btn" onclick="closeModal()">Kembali</button><button class="btn primary" id="coBtn">${ic('check')} Selesaikan</button>`, onMount: m => { m.querySelector('#coBtn').onclick = doCheckout; coCalc(); } });
}
function coPay(el) {
  $$('.pay-opt').forEach(x => x.classList.remove('on')); el.classList.add('on'); $('#cof [name=method]').value = el.dataset.v;
  $('#coCash').classList.toggle('hidden', el.dataset.kas !== '1'); $('#coDue').classList.toggle('hidden', el.dataset.v !== 'credit');
}
function coCalc() {
  const f = formObj($('#cof')), tot = Math.max(0, cartTotal() - parseMoney(f.disc)), cash = parseMoney(f.cash);
  $('#coTotal').textContent = money(tot);
  $('#coChange').textContent = cash ? money(cash - tot) : '-'; $('#coChange').className = 'num ' + (cash && cash < tot ? 'c-out' : 'c-in');
  const sugg = [...new Set([tot, Math.ceil(tot / 5000) * 5000, Math.ceil(tot / 10000) * 10000, Math.ceil(tot / 50000) * 50000, Math.ceil(tot / 100000) * 100000])].filter(v => v >= tot && v > 0).slice(0, 5);
  $('#qcash').innerHTML = sugg.map((v, i) => `<button type="button" class="chip" onclick="const c=$('#cof [name=cash]');c.value='${mval(v)}';coCalc()">${i === 0 ? 'Uang pas' : short(v)}</button>`).join('');
}
async function doCheckout() {
  const f = formObj($('#cof')), sub = cartTotal(), disc = parseMoney(f.disc), total = Math.max(0, sub - disc), cash = parseMoney(f.cash), method = f.method;
  const credit = method === 'credit', a = acc(method);
  if (!credit && !a) return toast('Pilih metode pembayaran', true);
  if (a && a.type === 'kas' && cash && cash < total) return toast('Uang diterima kurang dari total', true);
  if (credit && !f.contact_id && !f.new_contact.trim()) return toast('Isi nama pelanggan untuk penjualan bayar nanti', true);
  const btn = $('#coBtn'); busy(btn, true);
  const items = S.cart.map(c => ({ pid: c.pid, name: c.name, qty: N(c.qty), price: N(c.price), cost: N(c.cost), unit: c.unit }));
  const cost = sum(items, i => i.qty * i.cost), date = f.date || today(), txId = uid();
  const ok = await safe(async () => {
    let cid = f.contact_id || null;
    if (!cid && f.new_contact.trim()) cid = (await add('contacts', { name: f.new_contact.trim(), type: 'pelanggan' })).id;
    if (credit) await add('debts', { kind: 'piutang', contact_id: cid, amount: total, paid: 0, date, due_date: f.due || null, category_id: f.cat, source: 'sale', note: 'Penjualan: ' + items.map(i => i.name + ' x' + i.qty).join(', ').slice(0, 300) });
    else await add('transactions', { id: txId, date, type: 'in', amount: total, category_id: f.cat, account_id: method, contact_id: cid, ref: 'sale', items, cost, note: f.note.trim() + (disc ? (f.note.trim() ? ' • ' : '') + 'Diskon ' + money(disc) : '') });
    for (const it of items) { const p = prod(it.pid); if (!p || p.track_stock === false) continue; await upd('products', p.id, { stock: N(p.stock) - it.qty }); await add('stock_moves', { product_id: p.id, date, qty: -it.qty, kind: 'sale', note: credit ? 'Penjualan (piutang)' : 'Penjualan', transaction_id: credit ? null : txId }); }
    if (f.cat !== S.biz.settings.sale_cat) { S.biz.settings.sale_cat = f.cat; updBiz({ settings: S.biz.settings }).catch(() => {}); }
    return { cid };
  });
  busy(btn, false); if (!ok) return;
  const rc = { items, sub, disc, total, cash, change: cash ? cash - total : 0, method: credit ? 'Bayar Nanti (Piutang)' : a.name, customer: ok.cid ? contactName(ok.cid) : 'Umum', date: new Date(), phone: ok.cid ? (contact(ok.cid) || {}).phone : '' };
  S.cart = []; render(); receipt(rc);
}
function receiptText(r) {
  const L = '--------------------------------', p = (a, b) => { a = String(a); b = String(b); return a + ' '.repeat(Math.max(1, 32 - a.length - b.length)) + b; };
  const nm = s => money(s).replace(/\s/g, ' ');
  return [S.biz.name.toUpperCase(), S.biz.address || '', S.biz.phone ? 'Telp ' + S.biz.phone : '', L, r.date.toLocaleString('id-ID'), 'Pelanggan: ' + r.customer, L,
    ...r.items.flatMap(i => [i.name, p('  ' + numf(i.qty, 2) + ' x ' + numf(i.price), nm(i.qty * i.price))]), L,
    p('Subtotal', nm(r.sub)), r.disc ? p('Diskon', '-' + nm(r.disc)) : '', p('TOTAL', nm(r.total)), p('Bayar', r.method), r.cash ? p('Tunai', nm(r.cash)) : '', r.cash ? p('Kembali', nm(r.change)) : '', L, 'Terima kasih atas kunjungan Anda 🙏'].filter(Boolean).join('\n');
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
    <div class="f-row"><label class="f"><span>Kelompok</span><input class="inp" name="group_name" list="grpL" value="${esc(p.group_name || '')}" placeholder="cth: Sembako"><datalist id="grpL">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
      <label class="f"><span>Satuan</span><input class="inp" name="unit" list="unitL" value="${esc(p.unit || '')}"><datalist id="unitL">${['pcs', 'kg', 'gram', 'liter', 'butir', 'ikat', 'pack', 'dus', 'karung', 'sak', 'peti', 'porsi', 'ekor', 'botol', 'jasa'].map(u => `<option value="${u}">`).join('')}</datalist></label></div>
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
    <label class="f"><span>Alasan</span><select class="inp" name="note"><option>Stock opname</option><option>Barang rusak / busuk</option><option>Susut</option><option>Hilang</option><option>Dipakai sendiri</option><option>Koreksi salah input</option></select></label></form>`,
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
