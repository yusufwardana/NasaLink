import { Contact, MessageTemplate, DailyPlan } from '../types';

// Robust CSV Parser that handles quotes and commas inside quotes
const parseCSV = (text: string): string[][] => {
  const result: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let insideQuote = false;
  
  // Normalize line endings
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        // Escaped quote ("") -> treat as single quote
        currentVal += '"';
        i++; // Skip next char
      } else {
        // Toggle quote state
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      // End of cell
      row.push(currentVal.trim());
      currentVal = '';
    } else if (char === '\n' && !insideQuote) {
      // End of row
      row.push(currentVal.trim());
      if (row.length > 0 && row.some(c => c !== '')) {
         result.push(row);
      }
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  
  // Push last value/row if exists
  if (currentVal || row.length > 0) {
      row.push(currentVal.trim());
      if (row.length > 0) result.push(row);
  }

  return result;
};

// Helper to find column index loosely
const findColIndex = (headers: string[], keywords: string[]): number => {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
};

// Helper to fetch CSV with retry mechanism
const fetchSheetCsv = async (spreadsheetId: string, sheetName: string, retries = 1): Promise<string> => {
    // Add aggressive cache busting
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 99999);
    
    // Using 'export' format is faster than visualization API
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}&single=true&_cb=${timestamp}${random}`;
    
    try {
        const response = await fetch(url, {
            cache: "no-store",
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch sheet ${sheetName} (${response.status})`);
        }
        return await response.text();
    } catch (error) {
        if (retries > 0) {
            // Wait 1 second before retry
            await new Promise(res => setTimeout(res, 1000));
            return fetchSheetCsv(spreadsheetId, sheetName, retries - 1);
        }
        throw error;
    }
};

// Helper delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const fetchContactsFromSheet = async (spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<Contact[]> => {
  try {
    const text = await fetchSheetCsv(spreadsheetId, sheetName);
    const rows = parseCSV(text);

    if (rows.length < 2) return [];

    // Header Mapping based on User Screenshot & New Request
    const headers = rows[0].map(h => h.toLowerCase());
    
    // Exact mapping prioritized
    const idxName = findColIndex(headers, ['nasabah', 'nama', 'name']);
    const idxPhone = findColIndex(headers, ['nomer telp', 'no telp', 'telp', 'phone', 'hp', 'wa']); 
    const idxFlag = findColIndex(headers, ['flag', 'segmen']);
    const idxStatus = findColIndex(headers, ['status', 'kondisi']);
    const idxSentra = findColIndex(headers, ['sentra', 'kelompok']);
    const idxCo = findColIndex(headers, ['co', 'petugas']);
    const idxPlafon = findColIndex(headers, ['plafon', 'limit']);
    const idxProduk = findColIndex(headers, ['produk', 'product']);
    const idxJatuhTempo = findColIndex(headers, ['tgl jatuh tempo', 'jatuh tempo']);
    const idxPrs = findColIndex(headers, ['tgl prs', 'prs']); 
    const idxNotes = findColIndex(headers, ['notes', 'catatan', 'keterangan']); 

    // NEW COLUMNS
    const idxAppId = findColIndex(headers, ['appid', 'app id']);
    const idxCif = findColIndex(headers, ['cif', 'no cif']);
    const idxOs = findColIndex(headers, ['os', 'outstanding', 'sisa']);
    const idxDpd = findColIndex(headers, ['dpd', 'days past due']);
    const idxSaldo = findColIndex(headers, ['saldo', 'tabungan', 'simpanan']);
    const idxTglLunas = findColIndex(headers, ['tgl lunas', 'tanggal lunas', 'lunas']);

    // COLLECTION UPDATE
    const idxAngsuran = findColIndex(headers, ['angsuran', 'besar angsuran', 'cicilan']);
    const idxTunggakan = findColIndex(headers, ['tunggakan', 'total tunggakan', 'amount due']);
    const idxFlagMenunggak = findColIndex(headers, ['flag menunggak', 'kolektabilitas', 'kolek', 'bucket']);

    // Map rows to Contact objects
    return rows.slice(1).map((row, index): Contact | null => {
        const getVal = (idx: number) => idx !== -1 && row[idx] ? row[idx] : '';

        const name = getVal(idxName);
        const rawPhone = getVal(idxPhone);
        
        // Validation: Must have at least a Name to be a valid contact
        if (!name || name === 'Tanpa Nama') return null;

        const phone = rawPhone ? rawPhone.replace(/'/g, '').replace(/[^0-9+]/g, '') : ''; 
        
        let flag = getVal(idxFlag);
        if (!flag) flag = 'Active'; 

        return {
            id: `sheet-${index}-${Date.now()}`,
            name: name,
            phone: phone, 
            flag: flag,
            sentra: getVal(idxSentra) || 'Pusat',
            
            co: getVal(idxCo),
            plafon: getVal(idxPlafon),
            produk: getVal(idxProduk),
            tglJatuhTempo: getVal(idxJatuhTempo),
            tglPrs: getVal(idxPrs),
            status: getVal(idxStatus), 
            
            // New Fields
            appId: getVal(idxAppId),
            cif: getVal(idxCif),
            os: getVal(idxOs),
            dpd: getVal(idxDpd),
            saldoTabungan: getVal(idxSaldo),
            tglLunas: getVal(idxTglLunas),
            
            // Collection Fields
            angsuran: getVal(idxAngsuran),
            tunggakan: getVal(idxTunggakan),
            flagMenunggak: getVal(idxFlagMenunggak),

            notes: getVal(idxNotes),
            lastInteraction: ''
        };
    }).filter((c): c is Contact => c !== null);
    
  } catch (error) {
    console.error("Sheet fetch error:", error);
    throw error;
  }
};

export const fetchTemplatesFromSheet = async (spreadsheetId: string, sheetName: string = 'Templates'): Promise<MessageTemplate[]> => {
    try {
        const text = await fetchSheetCsv(spreadsheetId, sheetName, 2); // Retry twice
        const rows = parseCSV(text);
        if (rows.length < 2) return [];

        const headers = rows[0].map(h => h.toLowerCase());
        const idxId = findColIndex(headers, ['id']);
        const idxLabel = findColIndex(headers, ['label', 'judul']);
        const idxType = findColIndex(headers, ['type', 'tipe']);
        const idxPrompt = findColIndex(headers, ['prompt', 'instruksi']);
        const idxContent = findColIndex(headers, ['content', 'isi']);
        const idxIcon = findColIndex(headers, ['icon', 'ikon']);

        return rows.slice(1).map((row): MessageTemplate | null => {
            const getVal = (idx: number) => idx !== -1 && row[idx] ? row[idx] : '';
            if (!getVal(idxLabel)) return null;

            return {
                id: getVal(idxId) || Date.now().toString(),
                label: getVal(idxLabel),
                type: (getVal(idxType) === 'manual' ? 'manual' : 'ai'),
                promptContext: getVal(idxPrompt),
                content: getVal(idxContent),
                icon: getVal(idxIcon) || '📝'
            };
        }).filter((t): t is MessageTemplate => t !== null);

    } catch (error) {
        console.warn("Templates sheet not found or empty, using defaults.", error);
        return []; // Return empty to fallback to defaults
    }
};

// --- NEW FUNCTION: Fetch Daily Plans ---
export const fetchPlansFromSheet = async (spreadsheetId: string, sheetName: string = 'Plan'): Promise<DailyPlan[]> => {
    try {
        // Try to fetch, if fails (sheet doesn't exist), return empty
        const text = await fetchSheetCsv(spreadsheetId, sheetName, 1).catch(() => "");
        if (!text) return [];

        const rows = parseCSV(text);
        if (rows.length < 2) return [];

        const headers = rows[0].map(h => h.toLowerCase());
        
        // Map Columns
        const idxDate = findColIndex(headers, ['tanggal', 'date']);
        const idxCo = findColIndex(headers, ['co', 'petugas']);
        
        const idxSwCurNoa = findColIndex(headers, ['sw cur noa', 'sw bulan ini noa']);
        const idxSwCurDisb = findColIndex(headers, ['sw cur disb', 'sw bulan ini disb']);
        
        const idxSwNextNoa = findColIndex(headers, ['sw next noa', 'sw bulan depan noa']);
        const idxSwNextDisb = findColIndex(headers, ['sw next disb', 'sw bulan depan disb']);
        
        const idxCtxNoa = findColIndex(headers, ['ctx noa', 'col ctx noa']);
        const idxCtxOs = findColIndex(headers, ['ctx os', 'col ctx os']);
        
        const idxLantakurNoa = findColIndex(headers, ['lantakur noa']);
        const idxLantakurOs = findColIndex(headers, ['lantakur os']);
        
        const idxFppb = findColIndex(headers, ['fppb', 'fppb noa']);
        const idxBiometrik = findColIndex(headers, ['biometrik', 'bio']);

        return rows.slice(1).map((row, index): DailyPlan | null => {
            const getVal = (idx: number) => idx !== -1 && row[idx] ? row[idx] : '0';
            
            // Must have date and CO
            if (idxDate === -1 || idxCo === -1) return null;
            if (!row[idxDate] || !row[idxCo]) return null;

            return {
                id: `plan-${index}-${Date.now()}`,
                date: row[idxDate],
                coName: row[idxCo],
                swCurrentNoa: getVal(idxSwCurNoa),
                swCurrentDisb: getVal(idxSwCurDisb),
                swNextNoa: getVal(idxSwNextNoa),
                swNextDisb: getVal(idxSwNextDisb),
                colCtxNoa: getVal(idxCtxNoa),
                colCtxOs: getVal(idxCtxOs),
                colLantakurNoa: getVal(idxLantakurNoa),
                colLantakurOs: getVal(idxLantakurOs),
                fppbNoa: getVal(idxFppb),
                biometrikNoa: getVal(idxBiometrik)
            };
        }).filter((p): p is DailyPlan => p !== null);

    } catch (error) {
        console.warn("Plan sheet fetch error (likely sheet doesn't exist yet):", error);
        return [];
    }
};

// --- NEW FUNCTION: Submit Daily Plan ---
export const submitPlanToSheet = async (scriptUrl: string, plan: DailyPlan): Promise<void> => {
    if (!scriptUrl) throw new Error("URL Script tidak ditemukan");

    const payload = {
        action: 'save_plan',
        plan: plan
    };

    // Fire and forget (No Cors)
    try {
        await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' },
            mode: 'no-cors'
        });
        
        // Artificial delay to ensure Google Script writes data
        await delay(2000); 
    } catch (e) {
        console.error("Save plan error", e);
        throw e;
    }
};

export const saveTemplatesToSheet = async (scriptUrl: string, templates: MessageTemplate[]): Promise<void> => {
    if (!scriptUrl) throw new Error("URL Script tidak ditemukan");

    const payload = {
        action: 'save_templates',
        templates: templates
    };

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' },
            mode: 'no-cors'
        });
        await delay(3000); 
    } catch (e) {
        console.error("Save template error", e);
        throw e;
    }
};

export const updatePhoneInSheet = async (scriptUrl: string, name: string, newPhone: string): Promise<void> => {
  if (!scriptUrl) {
    throw new Error("URL Google Apps Script belum dikonfigurasi.");
  }

  const payload = {
    action: 'update_phone',
    name: name,
    phone: newPhone
  };

  await fetch(scriptUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain' },
    mode: 'no-cors'
  });
  
  await delay(500);
};