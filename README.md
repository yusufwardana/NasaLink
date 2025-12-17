
# B-Connect CRM (Supabase Edition)

B-Connect CRM kini berjalan sepenuhnya menggunakan **Supabase** sebagai backend database, menggantikan Google Sheets untuk performa dan stabilitas yang lebih baik.

## 🚀 Fitur Utama

- **Supabase Database:** Data Nasabah, Template, dan Rencana Harian tersimpan aman di Cloud Database.
- **Smart Filter:** Pencarian nasabah berdasarkan Nama, Sentra, dan CO.
- **AI Wording Generator:** Menggunakan **Gemini 2.5 Flash** untuk membuat pesan WhatsApp.
- **Mapping & Realisasi:** Fitur manajemen nasabah lanjut/istirahat dan monitoring kinerja harian.

## ⚙️ Setup Database (Supabase)

Karena aplikasi sekarang "Full Supabase", Anda perlu membuat tabel `contacts` untuk menampung data nasabah.

1. Buka Dashboard Supabase > **SQL Editor**.
2. Copy dan Paste script berikut, lalu klik **Run**:

```sql
-- 1. Tabel Contacts (Data Nasabah)
create table if not exists contacts (
  id text primary key,
  name text not null,
  phone text,
  flag text,
  sentra text,
  co text,
  plafon text,
  produk text,
  tgl_jatuh_tempo text, -- Disimpan sebagai text DD/MM/YYYY sesuai format aplikasi
  tgl_prs text,
  status text,
  notes text,
  app_id text,
  cif text,
  os text,
  dpd text,
  saldo_tabungan text,
  tgl_lunas text,
  angsuran text,
  tunggakan text,
  flag_menunggak text,
  flag_lantakur text,
  mapping text,
  last_interaction text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Tabel Daily Plans (Rencana Harian)
create table if not exists daily_plans (
  id text primary key,
  date date not null,
  co_name text not null,
  sw_current_noa int default 0,
  sw_current_disb bigint default 0,
  sw_next_noa int default 0,
  sw_next_disb bigint default 0,
  col_ctx_noa int default 0,
  col_ctx_os bigint default 0,
  col_lantakur_noa int default 0,
  col_lantakur_os bigint default 0,
  fppb_noa int default 0,
  biometrik_noa int default 0,
  actual_sw_noa int default 0,
  actual_sw_disb bigint default 0,
  actual_sw_next_noa int default 0,
  actual_sw_next_disb bigint default 0,
  actual_ctx_noa int default 0,
  actual_ctx_os bigint default 0,
  actual_lantakur_noa int default 0,
  actual_lantakur_os bigint default 0,
  actual_fppb_noa int default 0,
  actual_biometrik_noa int default 0,
  notes text
);

-- 3. Tabel Templates (Wording)
create table if not exists templates (
  id text primary key,
  label text not null,
  type text,
  prompt_context text,
  content text,
  icon text
);

-- 4. Tabel App Settings
create table if not exists app_settings (
  key text primary key,
  value jsonb
);
```

### 3. Import Data Nasabah (CSV)

Untuk memindahkan data dari Google Sheet ke Supabase:
1. Di Google Sheet, **File > Download > Comma Separated Values (.csv)**.
2. Di Supabase > **Table Editor** > Buka tabel `contacts`.
3. Klik **Import Data** (tombol CSV).
4. Upload file CSV. **PENTING:** Pastikan header kolom di CSV sesuai dengan nama kolom di database (snake_case).
   - Mapping Kolom Google Sheet -> Supabase:
     - `NASABAH` -> `name`
     - `NOMER TELP` -> `phone`
     - `FLAG` -> `flag`
     - `SENTRA` -> `sentra`
     - `CO` -> `co`
     - `TGL JATUH TEMPO` -> `tgl_jatuh_tempo`
     - ...dan seterusnya. Anda mungkin perlu rename header di CSV sebelum upload.

