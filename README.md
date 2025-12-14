
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

1. **Sheet "Data"**: Kolom (Baris 1): `CO`, `SENTRA`, `NASABAH`, `PLAFON`, `PRODUK`, `FLAG`, `TGL JATUH TEMPO`, `TGL PRS`, `STATUS`, `NOMER TELP`, `CATATAN`...
2. **Sheet "Plan"**: (Biarkan kosong, script akan otomatis membuat header 24 kolom jika belum ada).
3. **Sheet "Templates"**: (Akan dibuat otomatis oleh script jika belum ada).

4. Buka **Extensions** > **Apps Script**.
5. Copy-Paste kode berikut (Versi Final - Auto Header Creator):

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
      if (!sheet) {
        sheet = doc.insertSheet('Plan');
      }

      // --- AUTO-CREATE HEADERS (Jika Sheet Kosong) ---
      if (sheet.getLastRow() === 0) {
        var headers24 = [
          "ID", "Tanggal", "CO", 
          "Plan SW Cur NOA", "Plan SW Cur Disb", "Plan SW Next NOA", "Plan SW Next Disb", 
          "Plan CTX NOA", "Plan CTX OS", "Plan Lantakur NOA", "Plan Lantakur OS", 
          "Plan FPPB", "Plan Biometrik", "Timestamp",
          "Aktual SW Cur NOA", "Aktual SW Cur Disb", "Aktual SW Next NOA", "Aktual SW Next Disb",
          "Aktual CTX NOA", "Aktual CTX OS", "Aktual Lantakur NOA", "Aktual Lantakur OS",
          "Aktual FPPB", "Aktual Biometrik"
        ];
        sheet.appendRow(headers24);
      }

      var p = payload.plan;
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var headersLower = headers.map(function(h) { return String(h).toLowerCase().trim(); });
      
      // MAPPING 24 KOLOM (Based on User Request)
      // Kuncinya harus cocok dengan header yang dibuat otomatis di atas
      var map = {
        // IDENTITAS
        'id': ['id', 'key'],
        'date': ['tanggal', 'date', 'tgl'],
        'coName': ['co', 'petugas', 'nama co'],
        
        // RENCANA / PLAN (Kolom 4-13)
        'swCurrentNoa': ['plan sw cur noa', 'sw cur noa'],
        'swCurrentDisb': ['plan sw cur disb', 'sw cur disb'],
        'swNextNoa': ['plan sw next noa', 'sw next noa'],
        'swNextDisb': ['plan sw next disb', 'sw next disb'],
        'colCtxNoa': ['plan ctx noa', 'plan col ctx noa'],
        'colCtxOs': ['plan ctx os', 'plan col ctx os'],
        'colLantakurNoa': ['plan lantakur noa', 'plan col lantakur noa'],
        'colLantakurOs': ['plan lantakur os', 'plan col lantakur os'],
        'fppbNoa': ['plan fppb', 'target fppb'],
        'biometrikNoa': ['plan biometrik', 'target biometrik'],

        // AKTUAL / REALISASI (Kolom 15-24)
        'actualSwNoa': ['aktual sw cur noa'],
        'actualSwDisb': ['aktual sw cur disb'],
        'actualSwNextNoa': ['aktual sw next noa'],
        'actualSwNextDisb': ['aktual sw next disb'],
        'actualCtxNoa': ['aktual ctx noa'],
        'actualCtxOs': ['aktual ctx os'],
        'actualLantakurNoa': ['aktual lantakur noa'],
        'actualLantakurOs': ['aktual lantakur os'],
        'actualFppbNoa': ['aktual fppb'],
        'actualBiometrikNoa': ['aktual biometrik']
      };

      // 1. Cari Baris (Row) berdasarkan ID atau (Tanggal + CO)
      var rowIndex = -1;
      var data = sheet.getDataRange().getValues();
      
      if (p.id) {
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]) == String(p.id)) { rowIndex = i + 1; break; }
        }
      }
      
      if (rowIndex === -1) {
        // Fallback: Cari tanggal & CO
        var idxTgl = headersLower.findIndex(function(h){ return h.indexOf('tanggal') > -1 || h.indexOf('date') > -1; });
        var idxCo = headersLower.findIndex(function(h){ return h.indexOf('co') > -1 || h.indexOf('petugas') > -1; });

        if (idxTgl > -1 && idxCo > -1) {
           for (var i = 1; i < data.length; i++) {
              var rowDate = String(data[i][idxTgl]); 
              var rowCo = String(data[i][idxCo]);
              if (rowDate.indexOf(p.date) > -1 && rowCo.indexOf(p.coName) > -1) { rowIndex = i + 1; break; }
           }
        }
      }

      // Buat baris baru jika tidak ketemu
      if (rowIndex === -1) {
        // Buat array kosong sepanjang header, isi ID di kolom pertama (asumsi ID kolom 1)
        var newRow = new Array(headers.length).fill("");
        newRow[0] = p.id;
        sheet.appendRow(newRow); 
        rowIndex = sheet.getLastRow();
      }

      // 2. Tulis Data ke Kolom
      for (var key in map) {
        if (p[key] !== undefined && p[key] !== null) {
          var keywords = map[key];
          var colIndex = -1;
          
          // Cari kolom header yang COCOK
          for (var c = 0; c < headersLower.length; c++) {
             var headerCell = headersLower[c];
             // Prioritize Exact Match
             if (keywords.indexOf(headerCell) > -1) { colIndex = c + 1; break; }
             // Fuzzy match fallback
             for (var k = 0; k < keywords.length; k++) {
                if (headerCell.indexOf(keywords[k]) > -1) { colIndex = c + 1; break; }
             }
             if (colIndex > -1) break;
          }

          if (colIndex > -1) {
            // Force string untuk angka agar format terjaga
            sheet.getRange(rowIndex, colIndex).setValue("'" + p[key]);
          }
        }
      }
      
      // Update Timestamp (Cari kolom timestamp)
      var tsIdx = headersLower.findIndex(function(h) { return h.includes('timestamp'); });
      if (tsIdx > -1) {
         sheet.getRange(rowIndex, tsIdx + 1).setValue(new Date());
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
      
      sheet.clear();
      var templates = payload.templates;
      if (!templates || templates.length === 0) return ContentService.createTextOutput(JSON.stringify({ "result": "empty" }));

      var headers = [['ID', 'Label', 'Type', 'Prompt', 'Content', 'Icon']];
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

// GLOBAL_CONFIG.googleScriptUrl dibiarkan kosong, nanti akan diisi via Admin Panel (disimpan di Supabase)
export const GLOBAL_CONFIG = {
  spreadsheetId: "", 
  sheetName: "Data",
  googleScriptUrl: "" 
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
