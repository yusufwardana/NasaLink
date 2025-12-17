
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
3. **Buka Extensions > Apps Script**, Copy kode di bawah ini (Versi 3.8 - Support Clear Data & Mapping):

```javascript
/**
 * B-CONNECT CRM BACKEND SCRIPT
 * Version: 3.8 (Fix: Support Clearing Data & Robust Mapping)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return ContentService.createTextOutput(JSON.stringify({ "result": "busy" }));

  // --- LOGGER HELPER ---
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
  // ---------------------

  try {
    if (!e.postData || !e.postData.contents) {
       return jsonResponse({ "result": "error", "msg": "No payload found" });
    }

    var payload = JSON.parse(e.postData.contents);
    
    // 1. Check Debug Flag from Frontend
    if (payload.debug) {
       isDebug = true;
       logToSheet("Incoming Request: " + payload.action);
    }
    
    // --- ACTION: SAVE PLAN (TARGET & REALISASI) ---
    if (payload.action === 'save_plan') {
      var sheet = doc.getSheetByName('Plan');
      if (!sheet) {
        sheet = doc.insertSheet('Plan');
        // 24 Columns Standard Header
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
        logToSheet("Created new Plan sheet with headers");
      }

      var p = payload.plan;
      var lastRow = sheet.getLastRow();
      
      var headers = [];
      if (lastRow > 0) {
         headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
      }

      // Mapping Frontend Keys to Sheet Headers (Flexible matching)
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
        // Actuals
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
      
      // Strategy 1: Try Find by ID
      var idxId = headers.indexOf('id');
      if (idxId === -1) idxId = 0; // Assume col 1 is ID if not found

      if (p.id && lastRow > 1) {
         var idData = sheet.getRange(2, idxId + 1, lastRow - 1, 1).getValues();
         for (var i = 0; i < idData.length; i++) {
            if (String(idData[i][0]) === String(p.id)) {
               rowIndex = i + 2;
               logToSheet("Found Row by ID at: " + rowIndex);
               break;
            }
         }
      }

      // Strategy 2: Fallback Find by Date + CO
      if (rowIndex === -1 && lastRow > 1) {
         var idxTgl = headers.findIndex(function(h){ return h.indexOf('tanggal') > -1 || h.indexOf('date') > -1; });
         var idxCo = headers.findIndex(function(h){ return h.indexOf('co') > -1 || h.indexOf('petugas') > -1; });
         
         if (idxTgl > -1 && idxCo > -1) {
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
                  logToSheet("Found Row by Date+CO at: " + rowIndex);
                  break;
               }
            }
         }
      }

      // Strategy 3: Create New Row
      if (rowIndex === -1) {
         sheet.appendRow([p.id]); 
         rowIndex = sheet.getLastRow();
         logToSheet("Created New Row at: " + rowIndex);
      }

      // WRITE DATA LOOP
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
               // Force string for ID/CO to prevent auto-formatting
               if (key === 'id' || key === 'coName') {
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
      logToSheet("Success saving plan.");
      return jsonResponse({ "result": "success", "row": rowIndex });
    }

    // --- ACTION: UPDATE CONTACT (PHONE, NOTES, MAPPING) ---
    if (payload.action === 'update_contact' || payload.action === 'update_phone') {
        var sheet = doc.getSheetByName('Data');
        if (!sheet) {
             logToSheet("Sheet 'Data' not found!");
             return jsonResponse({ "result": "error", "msg": "Sheet Data missing" });
        }
        
        var finder = sheet.createTextFinder(payload.name).matchEntireCell(true).findNext();
        if (finder) {
             var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
             var rowIdx = finder.getRow();
             
             // 1. Update Phone (Support Clearing: Check undefined)
             if (payload.phone !== undefined) {
                 var colIdx = headers.findIndex(function(h) { return String(h).toLowerCase().match(/telp|phone|wa/); });
                 if (colIdx > -1) {
                   sheet.getRange(rowIdx, colIdx + 1).setValue("'" + payload.phone); // Force string
                   logToSheet("Updated phone for " + payload.name);
                 }
             }
             
             // 2. Update Notes
             if (payload.notes !== undefined) {
                 var noteIdx = headers.findIndex(function(h) { return String(h).toLowerCase().match(/catatan|note|keterangan/); });
                 if (noteIdx > -1) {
                   sheet.getRange(rowIdx, noteIdx + 1).setValue(payload.notes);
                   logToSheet("Updated notes for " + payload.name);
                 }
             }

             // 3. Update Mapping
             if (payload.mapping !== undefined) {
                 var mapIdx = headers.findIndex(function(h) { return String(h).toLowerCase().match(/mapping|keputusan|lanjut/); });
                 if (mapIdx > -1) {
                   sheet.getRange(rowIdx, mapIdx + 1).setValue(payload.mapping);
                   logToSheet("Updated mapping for " + payload.name + " to " + payload.mapping);
                 } else {
                   logToSheet("Mapping column not found in headers");
                 }
             }

        } else {
             logToSheet("Name not found for update: " + payload.name);
        }
        return jsonResponse({ "result": "success" });
    }

    // --- ACTION: SAVE TEMPLATES (BACKUP) ---
    if (payload.action === 'save_templates') {
       var tSheet = doc.getSheetByName('Templates');
       if (!tSheet) {
          tSheet = doc.insertSheet('Templates');
          tSheet.appendRow(['ID', 'Label', 'Type', 'Prompt', 'Content', 'Icon']);
       } else {
          tSheet.clearContents();
          tSheet.appendRow(['ID', 'Label', 'Type', 'Prompt', 'Content', 'Icon']);
       }
       
       var templates = payload.templates || [];
       var rows = templates.map(function(t) {
          return [t.id, t.label, t.type, t.promptContext || '', t.content || '', t.icon || ''];
       });
       
       if (rows.length > 0) {
          tSheet.getRange(2, 1, rows.length, 6).setValues(rows);
       }
       logToSheet("Templates backed up: " + rows.length);
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
