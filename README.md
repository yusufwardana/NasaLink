
# B-Connect CRM

B-Connect CRM adalah aplikasi manajemen data nasabah (Direktori Nasabah) yang dirancang khusus untuk Community Officer (CO) BTPN Syariah. Aplikasi ini mengintegrasikan data dari **Google Sheets** (Live Data) dan **Supabase** (Pengaturan & Template) serta dilengkapi dengan **AI Generator** (Google Gemini) untuk membuat pesan WhatsApp yang personal.

## 🚀 Fitur Utama

- **Live Data Sync:** Terhubung langsung dengan Google Sheets. Edit di Sheet, update di Web.
- **Smart Filter:** Pencarian nasabah berdasarkan Nama, Sentra, dan CO.
- **AI Wording Generator:** Menggunakan **Gemini 2.5 Flash** untuk membuat pesan penagihan/penawaran super cerdas & manusiawi.
- **Notifikasi Cerdas:** Peluang Refinancing & Jadwal PRS.
- **Input Rencana Harian:** CO bisa input target & realisasi harian yang tersinkronisasi ke Sheet 'Plan'.
- **Mapping Nasabah:** (New) Fitur untuk memetakan nasabah lanjut/tidak lanjut langsung ke sheet.
- **System Debugging:** Fitur pencatatan log error ke sheet 'SystemLogs' untuk mempermudah perbaikan.
- **Update Data:** Edit nomor HP, Catatan (Notes), dan Mapping langsung dari aplikasi.

## ⚙️ Setup & Instalasi

### 1. Konfigurasi Google Sheets (Data Nasabah)

1. **Sheet "Data"**: Kolom Wajib (Baris 1): `CO`, `SENTRA`, `NASABAH`, `FLAG`, `TGL JATUH TEMPO`, `NOMER TELP`, `CATATAN`, **`MAPPING`**.
2. **Sheet "Plan"**: (Biarkan kosong, script akan otomatis membuat header).
3. **Buka Extensions > Apps Script**, Copy kode di bawah ini (Versi 3.9.1 - Case Insensitive Batch Update):

```javascript
/**
 * B-CONNECT CRM BACKEND SCRIPT
 * Version: 3.9.1 (Fix: Case Insensitive Matching & Batch Stability)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait longer for lock (30s) to handle batch processing
  if (!lock.tryLock(30000)) return ContentService.createTextOutput(JSON.stringify({ "result": "busy" }));

  var isDebug = false;
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  
  function logToSheet(msg) {
    if (!isDebug) return;
    try {
      var logSheet = doc.getSheetByName('SystemLogs');
      if (!logSheet) {
        logSheet = doc.insertSheet('SystemLogs');
        logSheet.appendRow(['Timestamp', 'Message']);
      }
      logSheet.appendRow([new Date(), msg]);
    } catch(err) {}
  }

  try {
    if (!e.postData || !e.postData.contents) {
       return jsonResponse({ "result": "error", "msg": "No payload found" });
    }

    var payload = JSON.parse(e.postData.contents);
    if (payload.debug) {
       isDebug = true;
       logToSheet("Incoming Request: " + payload.action);
    }
    
    // --- ACTION: BATCH UPDATE MAPPING (NEW v3.9.1) ---
    // Update banyak baris sekaligus dalam satu request (Lebih cepat & stabil)
    if (payload.action === 'batch_update_mapping') {
        var sheet = doc.getSheetByName('Data');
        if (!sheet) return jsonResponse({ "result": "error", "msg": "Sheet Data missing" });

        var updates = payload.updates; // Array of { name: "...", mapping: "..." }
        if (!updates || updates.length === 0) return jsonResponse({ "result": "success", "count": 0 });

        // 1. Get Headers & Data
        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();
        if (lastRow < 2) return jsonResponse({ "result": "error", "msg": "Sheet empty" });

        var range = sheet.getRange(1, 1, lastRow, lastCol);
        var values = range.getValues();
        var headers = values[0].map(function(h) { return String(h).toLowerCase(); });

        // 2. Find Columns
        var nameIdx = headers.findIndex(function(h) { return h.indexOf('nasabah') > -1 || h.indexOf('nama') > -1; });
        var mapIdx = headers.findIndex(function(h) { return h.indexOf('mapping') > -1 || h.indexOf('keputusan') > -1; });

        if (nameIdx === -1 || mapIdx === -1) {
            logToSheet("Column Nasabah or Mapping not found.");
            return jsonResponse({ "result": "error", "msg": "Columns missing" });
        }

        // 3. Map Rows for O(1) Lookup (Case Insensitive)
        var rowMap = {};
        for (var i = 1; i < values.length; i++) {
            var rawName = String(values[i][nameIdx]);
            var rowName = rawName ? rawName.trim().toLowerCase() : "";
            if (rowName) {
                // Simpan index baris (0-based relative to values array)
                // Jika duplikat, akan ambil yang terakhir (standar vlookup)
                rowMap[rowName] = i; 
            }
        }

        // 4. Process Updates
        var successCount = 0;
        updates.forEach(function(u) {
            if (u.name) {
                var searchName = String(u.name).trim().toLowerCase();
                var targetRowIdx = rowMap[searchName];
                
                if (targetRowIdx !== undefined) {
                    // Update Cell Directly
                    // targetRowIdx is index in 'values'. Row in sheet is +1 because values starts at row 1.
                    sheet.getRange(targetRowIdx + 1, mapIdx + 1).setValue(u.mapping);
                    successCount++;
                }
            }
        });

        SpreadsheetApp.flush();
        logToSheet("Batch update processed: " + successCount + "/" + updates.length);
        return jsonResponse({ "result": "success", "processed": successCount });
    }

    // --- ACTION: SAVE PLAN ---
    if (payload.action === 'save_plan') {
      var sheet = doc.getSheetByName('Plan');
      if (!sheet) {
        sheet = doc.insertSheet('Plan');
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
      var headers = [];
      if (lastRow > 0) {
         headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
      }

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
        'actualSwNoa': ['aktual sw cur noa', 'aktual sw cur disb', 'aktual sw cur noa'],
        'actualSwDisb': ['aktual sw cur disb', 'actual sw cur disb'],
        'actualSwNextNoa': ['aktual sw next noa', 'actual sw next noa'],
        'actualSwNextDisb': ['aktual sw next disb', 'actual sw next disb'],
        'actualCtxNoa': ['aktual ctx noa', 'actual ctx noa'],
        'actualCtxOs': ['aktual ctx os', 'actual ctx os'],
        'actualLantakurNoa': ['aktual lantakur noa', 'actual lantakur noa'],
        'actualLantakurOs': ['aktual lantakur os', 'actual lantakur os'],
        'actualFppbNoa': ['aktual fppb', 'actual fppb'],
        'actualBiometrikNoa': ['aktual biometrik', 'actual biometrik']
      };

      var rowIndex = -1;
      var idxId = headers.indexOf('id');
      if (idxId === -1) idxId = 0; 

      if (p.id && lastRow > 1) {
         var idData = sheet.getRange(2, idxId + 1, lastRow - 1, 1).getValues();
         for (var i = 0; i < idData.length; i++) {
            if (String(idData[i][0]) === String(p.id)) {
               rowIndex = i + 2;
               break;
            }
         }
      }

      if (rowIndex === -1 && lastRow > 1) {
         var idxTgl = headers.findIndex(function(h){ return h.indexOf('tanggal') > -1 || h.indexOf('date') > -1; });
         var idxCo = headers.findIndex(function(h){ return h.indexOf('co') > -1 || h.indexOf('petugas') > -1; });
         if (idxTgl > -1 && idxCo > -1) {
            var rowData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
            var targetDate = String(p.date).trim();
            var targetCo = String(p.coName).toLowerCase().trim();
            for (var i = 0; i < rowData.length; i++) {
               // Simple check logic
               if (String(rowData[i][idxTgl]).includes(targetDate) && String(rowData[i][idxCo]).toLowerCase() === targetCo) {
                  rowIndex = i + 2;
                  break;
               }
            }
         }
      }

      if (rowIndex === -1) {
         sheet.appendRow([p.id]); 
         rowIndex = sheet.getLastRow();
      }

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
               var val = p[key];
               if (key === 'id' || key === 'coName') val = "'" + val;
               sheet.getRange(rowIndex, colIndex).setValue(val);
            }
         }
      }
      return jsonResponse({ "result": "success", "row": rowIndex });
    }

    // --- ACTION: UPDATE SINGLE CONTACT ---
    if (payload.action === 'update_contact') {
        var sheet = doc.getSheetByName('Data');
        if (!sheet) return jsonResponse({ "result": "error", "msg": "Sheet Data missing" });
        
        var finder = sheet.createTextFinder(payload.name).matchEntireCell(true).findNext();
        if (finder) {
             var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
             var rowIdx = finder.getRow();
             
             if (payload.phone !== undefined) {
                 var colIdx = headers.findIndex(function(h) { return String(h).toLowerCase().match(/telp|phone|wa/); });
                 if (colIdx > -1) sheet.getRange(rowIdx, colIdx + 1).setValue("'" + payload.phone);
             }
             if (payload.notes !== undefined) {
                 var noteIdx = headers.findIndex(function(h) { return String(h).toLowerCase().match(/catatan|note|keterangan/); });
                 if (noteIdx > -1) sheet.getRange(rowIdx, noteIdx + 1).setValue(payload.notes);
             }
             if (payload.mapping !== undefined) {
                 var mapIdx = headers.findIndex(function(h) { return String(h).toLowerCase().match(/mapping|keputusan|lanjut/); });
                 if (mapIdx > -1) sheet.getRange(rowIdx, mapIdx + 1).setValue(payload.mapping);
             }
        }
        return jsonResponse({ "result": "success" });
    }

    // --- ACTION: SAVE TEMPLATES ---
    if (payload.action === 'save_templates') {
       var tSheet = doc.getSheetByName('Templates');
       if (!tSheet) tSheet = doc.insertSheet('Templates');
       else tSheet.clearContents();
       
       tSheet.appendRow(['ID', 'Label', 'Type', 'Prompt', 'Content', 'Icon']);
       var rows = (payload.templates || []).map(function(t) {
          return [t.id, t.label, t.type, t.promptContext || '', t.content || '', t.icon || ''];
       });
       if (rows.length > 0) tSheet.getRange(2, 1, rows.length, 6).setValues(rows);
       return jsonResponse({ "result": "success" }); 
    }

    return jsonResponse({ "result": "error", "msg": "Unknown action" });

  } catch (e) {
    logToSheet("FATAL ERROR: " + e.toString());
    return jsonResponse({ "result": "error", "msg": e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
```
