
# B-Connect CRM

B-Connect CRM adalah aplikasi manajemen data nasabah (Direktori Nasabah) yang dirancang khusus untuk Community Officer (CO) BTPN Syariah. Aplikasi ini mengintegrasikan data dari **Google Sheets** (Live Data) dan **Supabase** (Pengaturan & Template) serta dilengkapi dengan **AI Generator** (Google Gemini) untuk membuat pesan WhatsApp yang personal.

## 🚀 Fitur Utama

- **Live Data Sync:** Terhubung langsung dengan Google Sheets. Edit di Sheet, update di Web.
- **Smart Filter:** Pencarian nasabah berdasarkan Nama, Sentra, dan CO.
- **AI Wording Generator:** Membuat pesan penagihan/penawaran/undangan otomatis menggunakan Google Gemini AI.
- **Notifikasi Cerdas:**
  - **Peluang Refinancing (M+1):** Mendeteksi nasabah jatuh tempo bulan ini & depan.
  - **Jadwal PRS (H-1):** Pengingat kumpulan.
- **Admin Panel (Supabase):** Manajemen template pesan yang tersinkronisasi global ke semua perangkat.
- **Google Apps Script Bridge:** Memungkinkan update nomor HP & Input Rencana Harian langsung dari aplikasi ke Google Sheets.

## 🛠️ Teknologi

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Database (Config & Templates):** Supabase (PostgreSQL)
- **Database (Customer Data):** Google Sheets
- **AI:** Google Gemini (GenAI SDK)
- **Icons:** Lucide React

## ⚙️ Setup & Instalasi

### 1. Konfigurasi Google Sheets (Data Nasabah)

1. **Sheet "Data"**: Kolom (Baris 1): `CO`, `SENTRA`, `NASABAH`, `PLAFON`, `PRODUK`, `FLAG`, `TGL JATUH TEMPO`, `TGL PRS`, `STATUS`, `NOMER TELP`, `CATATAN`... (dan kolom lainnya).
2. **Sheet "Plan"**: Kolom (Baris 1): `ID`, `Tanggal`, `CO`... (Plan & Aktual).
3. **Sheet "Templates"**: (Akan dibuat otomatis oleh script jika belum ada).

4. Buka **Extensions** > **Apps Script**.
5. Copy-Paste kode berikut untuk mengaktifkan fitur update No HP, Save Plan, & Save Templates:

```javascript
function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return ContentService.createTextOutput(JSON.stringify({ "result": "busy" }));

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    
    // --- FITUR 1: UPDATE NO HP NASABAH ---
    if (payload.action === 'update_phone') {
      var sheet = doc.getSheetByName('Data'); 
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ "result": "error", "msg": "Sheet Data not found" }));
      
      var finder = sheet.createTextFinder(payload.name).matchEntireCell(true).findNext();
      if (finder) {
        var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
        var colIdx = headers.findIndex(function(h) { return h.toLowerCase().match(/telp|phone|wa/); });
        if (colIdx > -1) {
          sheet.getRange(finder.getRow(), colIdx + 1).setValue("'" + payload.phone);
          SpreadsheetApp.flush();
          return ContentService.createTextOutput(JSON.stringify({ "result": "success" }));
        }
      }
    }

    // --- FITUR 2: SAVE DAILY PLAN (RENCANA & REALISASI) ---
    if (payload.action === 'save_plan') {
      var sheet = doc.getSheetByName('Plan');
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ "result": "error", "msg": "Sheet Plan not found" }));

      var p = payload.plan;
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var headersLower = headers.map(function(h) { return h.toLowerCase().trim(); });
      
      var map = {
        'id': ['id', 'key'],
        'date': ['tanggal', 'date', 'tgl'],
        'coName': ['co', 'petugas'],
        'swCurrentNoa': ['plan sw cur noa'],
        'swCurrentDisb': ['plan sw cur disb'],
        'swNextNoa': ['plan sw next noa'],
        'swNextDisb': ['plan sw next disb'],
        'colCtxNoa': ['plan ctx noa', 'plan col ctx noa'],
        'colCtxOs': ['plan ctx os', 'plan col ctx os'],
        'colLantakurNoa': ['plan lantakur noa', 'plan col lantakur noa'],
        'colLantakurOs': ['plan lantakur os', 'plan col lantakur os'],
        'fppbNoa': ['plan fppb'],
        'biometrikNoa': ['plan biometrik']
      };

      var rowIndex = -1;
      var data = sheet.getDataRange().getValues();
      
      if (p.id) {
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]) == String(p.id)) { rowIndex = i + 1; break; }
        }
      }
      
      if (rowIndex === -1) {
        for (var i = 1; i < data.length; i++) {
          var rowDate = String(data[i][headersLower.indexOf('tanggal')]); 
          var rowCo = String(data[i][headersLower.indexOf('co')]);
          if (rowDate === p.date && rowCo === p.coName) { rowIndex = i + 1; break; }
        }
      }

      if (rowIndex === -1) {
        sheet.appendRow([p.id]); 
        rowIndex = sheet.getLastRow();
      }

      for (var key in map) {
        if (p[key] !== undefined) {
          var possibleHeaders = map[key];
          var colIndex = -1;
          for (var h = 0; h < possibleHeaders.length; h++) {
             var idx = headersLower.indexOf(possibleHeaders[h]);
             if (idx > -1) { colIndex = idx + 1; break; }
          }
          if (colIndex > -1) {
            sheet.getRange(rowIndex, colIndex).setValue(p[key]);
          }
        }
      }
      
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ "result": "success", "row": rowIndex }));
    }

    // --- FITUR 3: BACKUP TEMPLATES TO SHEET ---
    if (payload.action === 'save_templates') {
      var sheetName = 'Templates';
      var sheet = doc.getSheetByName(sheetName);
      if (!sheet) {
        sheet = doc.insertSheet(sheetName);
      }
      
      // Clear existing to avoid duplicates/mess
      sheet.clear();
      
      var templates = payload.templates;
      if (!templates || templates.length === 0) return ContentService.createTextOutput(JSON.stringify({ "result": "empty" }));

      // Set Header
      var headers = [['ID', 'Label', 'Type', 'Prompt', 'Content', 'Icon']];
      
      // Map Data
      var rows = templates.map(function(t) {
        return [
          t.id || '',
          t.label || '',
          t.type || 'ai',
          t.promptContext || '',
          t.content || '',
          t.icon || '📝'
        ];
      });
      
      var allData = headers.concat(rows);
      
      // Write All
      sheet.getRange(1, 1, allData.length, 6).setValues(allData);
      
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ "result": "success", "count": rows.length }));
    }

    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "msg": "Unknown action" }));

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "msg": e.toString() }));
  } finally {
    lock.releaseLock();
  }
}
```
6. **Deploy** ulang sebagai "Web App" -> **New Version** -> Access: "Anyone".

### 2. Konfigurasi Supabase (Admin Settings)

1. Buat project baru di [Supabase](https://supabase.com).
2. Masuk ke **SQL Editor** dan jalankan perintah berikut:

```sql
-- Tabel Template Pesan
create table public.templates (
  id text primary key,
  label text not null,
  type text not null, -- 'ai' atau 'manual'
  prompt_context text,
  content text,
  icon text
);

-- Tabel Pengaturan Aplikasi
create table public.app_settings (
  key text primary key,
  value jsonb
);

-- Buka Akses Publik (RLS)
alter table public.templates enable row level security;
create policy "Public Access Templates" on public.templates for all using (true);

alter table public.app_settings enable row level security;
create policy "Public Access Settings" on public.app_settings for all using (true);
```

### 3. Konfigurasi Aplikasi (`config.ts`)

Edit file `config.ts` dan masukkan kredensial Anda:

```typescript
export const SUPABASE_CONFIG = {
  url: "https://your-project.supabase.co", 
  key: "your-anon-key" 
};

export const GLOBAL_CONFIG = {
  spreadsheetId: "ID_GOOGLE_SHEET_ANDA", 
  sheetName: "Data",
  googleScriptUrl: "URL_WEB_APP_APPS_SCRIPT_ANDA" 
};
```

## 📱 Penggunaan

1. Buka aplikasi.
2. Klik menu **Setting** (Footer) -> Masukkan PIN Default: `123456`.
3. Di tab **Data & Config**, pastikan ID Sheet dan URL Script sudah tersimpan (jika menggunakan Supabase).
4. Di tab **Template Pesan**, buat template prompt untuk AI.
5. Selesai! Aplikasi siap digunakan oleh tim lapangan.

---
Created with ❤️ for BTPN Syariah Community.
