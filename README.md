# BukuKas Pro — Aplikasi Pembukuan Usaha (PWA + Supabase)

Aplikasi pembukuan untuk **semua jenis usaha** (warung, peternakan ayam petelur, jual beli buah, kuliner, pertanian, jasa, toko online, dll). Bisa dipakai banyak orang — setiap pengguna mendaftar sendiri dan hanya melihat datanya sendiri. Bisa di-install di HP, tablet, dan PC seperti aplikasi biasa.

## Isi folder

| File | Fungsi |
|---|---|
| `index.html` | Tampilan & gaya aplikasi |
| `app.js` | Seluruh logika aplikasi (isi URL & kunci Supabase di baris paling atas) |
| `schema.sql` | Tabel database + keamanan (RLS) untuk Supabase |
| `sw.js` | Service worker: offline cache & klik notifikasi |
| `manifest.json`, `icons/` | Agar bisa di-install sebagai aplikasi |
| `src/` | Kode sumber `app.js` yang dipecah per bagian (opsional, untuk diedit) |

## Fitur

- **Multi usaha** dalam satu akun, dengan template otomatis per jenis usaha (kategori, fitur, kolom catatan harian).
- **Beranda**: total saldo semua akun, pemasukan/pengeluaran/laba + tren vs periode lalu, grafik arus kas, komposisi biaya, target omzet bulanan, wawasan otomatis, produk terlaris.
- **Transaksi**: pemasukan, pengeluaran, transfer antar akun (Kas, Bank, E-Wallet), filter & pencarian, ekspor CSV (bisa dibuka di Excel).
- **Kasir**: jual cepat dari daftar produk, item manual, diskon, uang kembalian, bayar tunai/bank/QRIS/bayar nanti (piutang), struk cetak & kirim WhatsApp. Laba kotor (omzet − modal) dihitung otomatis.
- **Produk & Stok**: stok masuk (beli tunai / hutang ke supplier / hasil produksi sendiri), opname, riwayat stok, peringatan stok menipis, nilai stok.
- **Hutang & Piutang**: cicilan, jatuh tempo, tagih via WhatsApp, riwayat pembayaran.
- **Catatan Harian / Produksi**: kolom bebas (telur, pakan, panen, porsi, dll). Untuk ayam petelur otomatis menghitung **HDP, FCR, berat rata-rata telur, mortalitas**; untuk buah menghitung **tingkat susut**.
- **Laporan**: laba rugi, arus kas per akun, kekayaan bersih usaha, tren 12 bulan, penjualan per produk, cetak/simpan PDF.
- **Anggaran** biaya bulanan per kategori, **Kontak** pelanggan & supplier.
- **Notifikasi**: pilih sendiri mana yang tampil — stok menipis, piutang/hutang jatuh tempo, anggaran hampir habis, target tercapai, pengingat catat transaksi & catatan harian, ringkasan harian; jam pengingat bisa diatur.
- Mode gelap/terang, responsif dari HP kecil sampai layar PC, backup & pulihkan data (JSON).

## Langkah pemasangan

### 1. Siapkan Supabase
1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor → New query**, tempel seluruh isi `schema.sql`, klik **Run**.
3. Buka **Project Settings → API**, salin **Project URL** dan **anon / publishable key**.
4. (Opsional) **Authentication → Sign In / Providers → Email**: matikan *Confirm email* jika ingin pengguna bisa langsung masuk tanpa verifikasi email. Jika tetap aktif, isi **Authentication → URL Configuration → Site URL** dengan alamat aplikasi Anda.

### 2. Isi konfigurasi
Buka `app.js`, isi 2 baris paling atas:
```js
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...',
```
Kunci *anon* memang aman ditaruh di aplikasi web — data tetap terlindungi oleh RLS di `schema.sql`. (Jika dikosongkan, aplikasi akan menanyakan URL & kunci saat pertama dibuka.)

### 3. Online-kan (wajib HTTPS agar bisa di-install & notifikasi)
Contoh dengan **GitHub Pages**: buat repo, unggah semua file (termasuk folder `icons`), lalu **Settings → Pages → Deploy from branch → main / root**. Bisa juga Netlify, Vercel, Cloudflare Pages, atau hosting biasa.

### 4. Install di perangkat
- **Android / PC (Chrome, Edge)**: buka alamat aplikasi → tombol **Install Aplikasi** di menu samping, atau menu browser ⋮ → *Install aplikasi*.
- **iPhone / iPad**: buka di Safari → tombol Bagikan → **Tambah ke Layar Utama**.

## Catatan tentang notifikasi
- Aktifkan di **Pengaturan → Notifikasi & Pengingat → Aktifkan**, lalu pilih jenis pemberitahuan yang diinginkan.
- Pemeriksaan berjalan saat aplikasi dibuka, saat kembali ke aplikasi, dan setiap 5 menit selama aplikasi masih berjalan (termasuk di-minimize). Notifikasi yang sama tidak diulang di hari yang sama.
- Di iPhone, notifikasi hanya bekerja jika aplikasi sudah di-install ke Layar Utama (iOS 16.4 ke atas).
- Notifikasi saat aplikasi benar-benar tertutup total membutuhkan server push (mis. Supabase Edge Function + Web Push). Itu bisa ditambahkan sebagai pengembangan berikutnya.

## Mode Lokal
Tanpa Supabase pun aplikasi bisa dipakai (**Pakai Mode Lokal**). Data tersimpan di browser perangkat tersebut saja — rutin lakukan **Backup** di Pengaturan. Backup bisa dipulihkan ke akun cloud kapan saja.

## Mengubah kode
Edit file di folder `src/`, lalu gabungkan kembali:
```bash
cat src/1-core.js src/2-shell.js src/3-pages-a.js src/4-pages-b.js src/5-pages-c.js > app.js
```
Setelah update, naikkan `VERSION` di `sw.js` (misal `bukukas-v1.0.1`) agar perangkat pengguna mengambil versi terbaru.

## Notifikasi push dari server (Supabase Edge Function)
- `supabase/migrations/001_schema.sql` — tabel aplikasi (sama dengan `schema.sql`).
- `supabase/migrations/002_push.sql` — tabel langganan push, log, fungsi pembaca kunci dari Vault, ekstensi pg_cron & pg_net.
- `supabase/functions/send-reminders/index.ts` — Edge Function yang dijalankan pg_cron tiap 15 menit; deploy dengan **Verify JWT = OFF** (fungsi memakai kode pengaman sendiri).
- File `003_secrets_cron.sql` (berisi kunci rahasia, TIDAK disertakan di repo) — menyimpan kunci VAPID ke Vault & membuat jadwal cron.

Aplikasi khusus Indonesia: semua nominal dalam **Rupiah**, zona waktu per usaha bisa dipilih **WIB / WITA / WIT** (dipakai untuk tanggal transaksi & jam pengingat). Database: project Supabase **bukukas** di region **Singapura (ap-southeast-1)**, region Supabase terdekat dari Indonesia. Aplikasi online di https://klmthebest10.github.io/bukukas/
