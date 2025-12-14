
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
3. **Buka Extensions > Apps Script**, Copy kode di bawah ini (Versi Fix):

```javascript
/**
 * B-CONNECT CRM BACKEND SCRIPT
 * Version: 3.1 (Fix: ID Priority + Robust Date Matching)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return ContentService.createTextOutput(JSON.stringify({ "result": "busy" }));

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    
    // --- ACTION: SAVE PLAN ---
    if (payload.action === 'save_plan') {
      var sheet = doc.getSheetByName('Plan');
      if (!sheet) {
        sheet = doc.insertSheet('Plan');
        // Auto-Create Headers if new sheet
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
      
      // Get Headers
      var headers = [];
      if (lastRow > 0) {
         headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
      }

      // Column Mapping
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

      // --- LOGIC: FIND ROW ---
      var rowIndex = -1;
      
      // 1. Try Find by ID (Primary Key)
      var idxId = headers.indexOf('id');
      if (idxId === -1) idxId = 0; // Default to col 1 if header not found

      if (p.id && lastRow > 1) {
         var idData = sheet.getRange(2, idxId + 1, lastRow - 1, 1).getValues();
         for (var i = 0; i < idData.length; i++) {
            if (String(idData[i][0]) === String(p.id)) {
               rowIndex = i + 2; // +2 (1 for header, 1 for 0-index)
               break;
            }
         }
      }

      // 2. Fallback: Find by Date + CO (Prevent Duplicates for Same Day)
      if (rowIndex === -1 && lastRow > 1) {
         var idxTgl = headers.findIndex(function(h){ return h.indexOf('tanggal') > -1 || h.indexOf('date') > -1; });
         var idxCo = headers.findIndex(function(h){ return h.indexOf('co') > -1 || h.indexOf('petugas') > -1; });
         
         if (idxTgl > -1 && idxCo > -1) {
            // Helper to normalize sheet date
            function normDate(val) {
               if (val instanceof Date) {
                  return ("0" + val.getDate()).slice(-2) + "/" + ("0" + (val.getMonth()+1)).slice(-2) + "/" + val.getFullYear();
               }
               return String(val).trim();
            }
            
            var rowData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
            var targetDate = String(p.date).trim();
            var targetCo = String(p.coName).toLowerCase().trim();

            for (var i = 0; i < rowData.length; i++) {
               var rDate = normDate(rowData[i][idxTgl]);
               var rCo = String(rowData[i][idxCo]).toLowerCase().trim();
               
               if (rDate === targetDate && rCo === targetCo) {
                  rowIndex = i + 2;
                  break;
               }
            }
         }
      }

      // 3. Create New Row if Not Found
      if (rowIndex === -1) {
         sheet.appendRow([p.id]); // Append ID to first column
         rowIndex = sheet.getLastRow();
      }

      // --- ACTION: WRITE DATA ---
      for (var key in map) {
         if (p[key] !== undefined && p[key] !== null) {
            var keywords = map[key];
            var colIndex = -1;
            
            for (var c = 0; c < headers.length; c++) {
               if (keywords.some(function(k) { return headers[c].indexOf(k) > -1; })) {
                  colIndex = c + 1; break;
               }
            }

            if (colIndex > -1) {
               // Force string for IDs and Dates to prevent formatting issues
               var val = p[key];
               if (key === 'id' || key === 'date' || key === 'coName') {
                  val = "'" + val;
               }
               sheet.getRange(rowIndex, colIndex).setValue(val);
            }
         }
      }
      
      // Update Timestamp
      var tsIdx = headers.findIndex(function(h) { return h.includes('timestamp'); });
      if (tsIdx > -1) {
         sheet.getRange(rowIndex, tsIdx + 1).setValue(new Date());
      }

      SpreadsheetApp.flush();
      return jsonResponse({ "result": "success", "row": rowIndex });
    }

    // --- OTHER ACTIONS ---
    if (payload.action === 'update_phone') {
        var sheet = doc.getSheetByName('Data');
        var finder = sheet.createTextFinder(payload.name).matchEntireCell(true).findNext();
        if (finder) {
             var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
             var colIdx = headers.findIndex(function(h) { return String(h).toLowerCase().match(/telp|phone|wa/); });
             if (colIdx > -1) sheet.getRange(finder.getRow(), colIdx + 1).setValue("'" + payload.phone);
        }
        return jsonResponse({ "result": "success" });
    }

    if (payload.action === 'save_templates') {
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
