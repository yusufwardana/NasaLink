
# B-Connect CRM

B-Connect CRM adalah aplikasi manajemen data nasabah (Direktori Nasabah) yang dirancang khusus untuk Community Officer (CO) BTPN Syariah. Aplikasi ini mengintegrasikan data dari **Google Sheets** (Live Data) dan **Supabase** (Pengaturan & Template) serta dilengkapi dengan **AI Generator** (Google Gemini) untuk membuat pesan WhatsApp yang personal.

## 🚀 Fitur Utama

- **Live Data Sync:** Terhubung langsung dengan Google Sheets. Edit di Sheet, update di Web.
- **Smart Filter:** Pencarian nasabah berdasarkan Nama, Sentra, dan CO.
- **AI Wording Generator:** Menggunakan **Gemini 3.0 Pro (Thinking Mode)** untuk membuat pesan penagihan/penawaran super cerdas & manusiawi.
- **Notifikasi Cerdas:** Peluang Refinancing & Jadwal PRS.
- **Input Rencana Harian:** CO bisa input target & realisasi harian yang tersinkronisasi ke Sheet 'Plan'.

## ⚙️ Setup & Instalasi

### 1. Konfigurasi Google Sheets (Data Nasabah)

1. **Sheet "Data"**: Kolom (Baris 1): `CO`, `SENTRA`, `NASABAH`, `PLAFON`, `PRODUK`, `FLAG`, `TGL JATUH TEMPO`, `TGL PRS`, `STATUS`, `NOMER TELP`, `CATATAN`...
2. **Sheet "Plan"**: (Biarkan kosong, script akan otomatis membuat header).
3. **Buka Extensions > Apps Script**, Copy kode di bawah ini:

```javascript
/**
 * B-CONNECT CRM BACKEND SCRIPT
 * Versi: 3.0 (Robust Date & Auto-Headers)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return ContentService.createTextOutput(JSON.stringify({ "result": "busy" }));

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    
    // --- FITUR 1: UPDATE NO HP ---
    if (payload.action === 'update_phone') {
      var sheet = doc.getSheetByName('Data'); 
      if (!sheet) return jsonResponse({ "result": "error", "msg": "Sheet Data not found" });
      
      var finder = sheet.createTextFinder(payload.name).matchEntireCell(true).findNext();
      if (finder) {
        var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
        var colIdx = headers.findIndex(function(h) { return String(h).toLowerCase().match(/telp|phone|wa/); });
        if (colIdx > -1) {
          sheet.getRange(finder.getRow(), colIdx + 1).setValue("'" + payload.phone);
          SpreadsheetApp.flush();
          return jsonResponse({ "result": "success" });
        }
      }
    }

    // --- FITUR 2: SAVE DAILY PLAN ---
    if (payload.action === 'save_plan') {
      var sheet = doc.getSheetByName('Plan');
      if (!sheet) { sheet = doc.insertSheet('Plan'); }

      // 1. Auto-Create Headers (24 Kolom Standar)
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
      var lastRow = sheet.getLastRow();
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var headersLower = headers.map(function(h) { return String(h).toLowerCase().trim(); });

      // Mapping Key Aplikasi -> Kata Kunci Header Sheet
      var map = {
        'id': ['id', 'key'],
        'date': ['tanggal', 'date', 'tgl'],
        'coName': ['co', 'petugas'],
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

      // 2. Logic Cari Baris: Update jika (Tanggal + CO) sama, Insert jika beda
      var rowIndex = -1;
      
      // Cari kolom kunci
      var idxTgl = headersLower.findIndex(function(h){ return h.indexOf('tanggal') > -1 || h.indexOf('date') > -1; });
      var idxCo = headersLower.findIndex(function(h){ return h.indexOf('co') > -1 || h.indexOf('petugas') > -1; });
      
      // Helper: Normalisasi Tanggal (dd/mm/yyyy)
      function normalizeDate(d) {
        if (!d) return "";
        if (d instanceof Date) {
           var day = ("0" + d.getDate()).slice(-2);
           var month = ("0" + (d.getMonth() + 1)).slice(-2);
           var year = d.getFullYear();
           return day + "/" + month + "/" + year;
        }
        return String(d).trim(); // Asumsi string sudah format benar atau string biasa
      }

      var inputDate = normalizeDate(p.date); // Format dari App biasanya dd/mm/yyyy

      if (idxTgl > -1 && idxCo > -1 && lastRow > 1) {
         // Ambil semua data Tanggal & CO sekaligus (Batch Read) untuk performa
         var columnData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
         
         for (var i = 0; i < columnData.length; i++) {
            var rowDateRaw = columnData[i][idxTgl];
            var rowCo = String(columnData[i][idxCo]).trim().toLowerCase();
            
            var rowDateStr = normalizeDate(rowDateRaw);
            
            // Cek Kesamaan (Loose Check)
            if (rowDateStr === inputDate && rowCo === String(p.coName).trim().toLowerCase()) {
               rowIndex = i + 2; // +2 karena array mulai 0 dan header baris 1
               break; 
            }
         }
      }

      // Jika tidak ketemu, Append baris baru
      if (rowIndex === -1) {
        // Buat array kosong, isi ID di kolom pertama (asumsi ID ada di map/header 1)
        // Kita gunakan ID dari payload
        sheet.appendRow([p.id]); 
        rowIndex = sheet.getLastRow();
      }

      // 3. Tulis Data (Looping Map)
      for (var key in map) {
        if (p[key] !== undefined && p[key] !== null) {
          var keywords = map[key];
          var colIndex = -1;
          
          // Cari kolom header yang cocok
          for (var c = 0; c < headersLower.length; c++) {
             if (keywords.some(function(k) { return headersLower[c].indexOf(k) > -1; })) {
                colIndex = c + 1; break;
             }
          }

          if (colIndex > -1) {
            // Tulis value
            // Jika ID/Tanggal/Phone, paksa string dengan '
            if (key === 'id' || key === 'date' || key === 'coName') {
               sheet.getRange(rowIndex, colIndex).setValue("'" + p[key]);
            } else {
               // Angka biarkan angka (agar bisa disum)
               sheet.getRange(rowIndex, colIndex).setValue(p[key]);
            }
          }
        }
      }
      
      // Update Timestamp
      var tsIdx = headersLower.findIndex(function(h) { return h.includes('timestamp'); });
      if (tsIdx > -1) {
         sheet.getRange(rowIndex, tsIdx + 1).setValue(new Date());
      }

      SpreadsheetApp.flush();
      return jsonResponse({ "result": "success", "row": rowIndex, "mode": (rowIndex === lastRow + 1 ? "insert" : "update") });
    }

    // --- FITUR 3: SAVE TEMPLATES ---
    if (payload.action === 'save_templates') {
       // ... existing logic ...
       return jsonResponse({ "result": "success" });
    }

    return jsonResponse({ "result": "error", "msg": "Unknown action" });

  } catch (e) {
    return jsonResponse({ "result": "error", "msg": e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
```
