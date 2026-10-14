-- Ikon akun (emoji atau gambar kecil hasil kompres, disimpan sebagai data URL)
alter table public.accounts add column if not exists icon text;
