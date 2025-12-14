
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
2. **Sheet "Plan"**: Pastikan urutan kolom (24 Kolom) sebagai berikut:
   1. `ID`
   2. `Tanggal`
   3. `CO`
   4. `SW Cur NOA`
   5. `SW Cur Disb`
   6. `SW Next NOA`
   7. `SW Next Disb`
   8. `CTX NOA`
   9. `CTX OS`
   10. `Lantakur NOA`
   11. `Lantakur OS`
   12. `FPPB`
   13. `Biometrik`
   14. `Timestamp`
   15. `Aktual SW Cur NOA`
   16. `Aktual SW Cur Disb`
   17. `Aktual SW Next NOA`
   18. `Aktual SW Next Disb`
   19. `Aktual CTX NOA`
   20. `Aktual CTX OS`
   21. `Aktual Lantakur NOA`
   22. `Aktual Lantakur OS`
   23. `Aktual FPPB`
   24. `Aktual Biometrik`

3. **Sheet "Templates"**: (Akan dibuat otomatis oleh script jika belum ada).

4. Buka **Extensions** > **Apps Script**.
5. Copy-Paste kode berikut (Updated for 24 Columns Layout):

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
      var headersLower = headers.map(function(h) { return String(h).toLowerCase().trim(); });
      
      // MAPPING 24 KOLOM (Based on User Request)
      // Kolom Aktual ditandai dengan awalan 'aktual'
      var map = {
        // IDENTITAS
        'id': ['id', 'key'],
        'date': ['tanggal', 'date', 'tgl'],
        'coName': ['co', 'petugas', 'nama co'],
        
        // RENCANA / PLAN (Kolom 4-13)
        'swCurrentNoa': ['sw cur noa', 'plan sw cur noa'],
        'swCurrentDisb': ['sw cur disb', 'plan sw cur disb'],
        'swNextNoa': ['sw next noa', 'plan sw next noa'],
        'swNextDisb': ['sw next disb', 'plan sw next disb'],
        'colCtxNoa': ['ctx noa', 'plan ctx noa'],
        'colCtxOs': ['ctx os', 'plan ctx os'],
        'colLantakurNoa': ['lantakur noa', 'plan lantakur noa'],
        'colLantakurOs': ['lantakur os', 'plan lantakur os'],
        'fppbNoa': ['fppb', 'plan fppb'],
        'biometrikNoa': ['biometrik', 'plan biometrik'],

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
        var idxTgl = headersLower.indexOf('tanggal'); 
        var idxCo = headersLower.indexOf('co');
        
        // Fallback search header manual jika index di atas -1
        if (idxTgl === -1) idxTgl = headersLower.findIndex(function(h){ return h.indexOf('tanggal') > -1 || h.indexOf('date') > -1; });
        if (idxCo === -1) idxCo = headersLower.findIndex(function(h){ return h.indexOf('co') > -1 || h.indexOf('petugas') > -1; });

        if (idxTgl > -1 && idxCo > -1) {
           for (var i = 1; i < data.length; i++) {
              var rowDate = String(data[i][idxTgl]); 
              var rowCo = String(data[i][idxCo]);
              // Loose comparison
              if (rowDate.indexOf(p.date) > -1 && rowCo.indexOf(p.coName) > -1) { rowIndex = i + 1; break; }
           }
        }
      }

      // Buat baris baru jika tidak ketemu
      if (rowIndex === -1) {
        sheet.appendRow([p.id]); 
        rowIndex = sheet.getLastRow();
      }

      // 2. Tulis Data ke Kolom
      for (var key in map) {
        // Cek apakah ada data yang dikirim untuk key ini (agar tidak menimpa data existing dengan kosong jika payload partial)
        if (p[key] !== undefined && p[key] !== null && p[key] !== '') {
          var keywords = map[key];
          var colIndex = -1;
          
          // Cari kolom header yang COCOK
          for (var c = 0; c < headersLower.length; c++) {
             var headerCell = headersLower[c];
             // Exact match check first for better precision with "Aktual" vs non-Aktual
             if (keywords.indexOf(headerCell) > -1) {
                 colIndex = c + 1;
                 break;
             }
             // Fuzzy match fallback
             for (var k = 0; k < keywords.length; k++) {
                if (headerCell.indexOf(keywords[k]) > -1) {
                   colIndex = c + 1; 
                   break;
                }
             }
             if (colIndex > -1) break;
          }

          if (colIndex > -1) {
            sheet.getRange(rowIndex, colIndex).setValue(p[key]);
          }
        }
      }
      
      // Update Timestamp (Kolom 14 / cari header Timestamp)
      var tsIdx = headersLower.indexOf('timestamp');
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
