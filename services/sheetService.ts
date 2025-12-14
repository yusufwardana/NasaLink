
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
      // Only push non-empty rows (check if at least one cell has content)
      if (row.length > 0 && row.some(c => c.trim() !== '')) {
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
      if (row.length > 0 && row.some(c => c.trim() !== '')) result.push(row);
  }

  return result;
};

// Helper to find column index loosely
const findColIndex = (headers: string[], keywords: string[]): number => {
    return headers.findIndex(h => {
        const hClean = h.toLowerCase().trim();
        return keywords.some(k => hClean.includes(k.toLowerCase().trim()));
    });
};

// Helper key generator for consistent lookups (Plan vs Actual)
const generateLookupKey = (date: string, co: string): string => {
    if (!date || !co) return '';
    // Normalize: remove extra spaces, lowercase.
    const d = date.trim().toLowerCase().replace(/\s+/g, '');
    const c = co.trim().toLowerCase().replace(/\s+/g, ' ');
    return `${d}_${c}`;
};

// Helper to check if a value string represents a non-zero number
const isNonZero = (val?: string): boolean => {
    if (!val) return false;
    // Remove non-numeric (keep digits)
    const clean = val.replace(/[^0-9]/g, '');
    const num = parseInt(clean || '0', 10);
    return num > 0;
};

// Helper: Normalize Date from Sheet to DD/MM/YYYY
const normalizeSheetDate = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();
    
    // Check YYYY-MM-DD (ISO Format - common in Sheets CSV export)
    if (clean.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        const [y, m, d] = clean.split('-');
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    // Check DD/MM/YYYY or MM/DD/YYYY
    if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length === 3) {
             // Basic padding ensure 1/1/2025 -> 01/01/2025
             return parts.map(p => p.padStart(2, '0')).join('/');
        }
    }
    
    return clean;
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

    // Header Mapping
    const headers = rows[0].map(h => h.toLowerCase().trim());
    
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
    const idxFlagLantakur = findColIndex(headers, ['flag lantakur', 'lantakur', 'status lantakur', 'tabungan kurang']);

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
            tglJatuhTempo: normalizeSheetDate(getVal(idxJatuhTempo)), // Apply Normalize
            tglPrs: getVal(idxPrs), // Keep as is (usually 1-31 or date)
            status: getVal(idxStatus), 
            
            // New Fields
            appId: getVal(idxAppId),
            cif: getVal(idxCif),
            os: getVal(idxOs),
            dpd: getVal(idxDpd),
            saldoTabungan: getVal(idxSaldo),
            tglLunas: normalizeSheetDate(getVal(idxTglLunas)), // Apply Normalize
            
            // Collection Fields
            angsuran: getVal(idxAngsuran),
            tunggakan: getVal(idxTunggakan),
            flagMenunggak: getVal(idxFlagMenunggak),
            flagLantakur: getVal(idxFlagLantakur),

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
        const text = await fetchSheetCsv(spreadsheetId, sheetName, 2); 
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
        return []; 
    }
};

// --- NEW UPDATED FUNCTION: Fetch Daily Plans & Merge with Actuals ---
export const fetchPlansFromSheet = async (spreadsheetId: string, sheetName: string = 'Plan'): Promise<DailyPlan[]> => {
    try {
        const planText = await fetchSheetCsv(spreadsheetId, sheetName, 1).catch(() => "");
        if (!planText) return [];

        const planRows = parseCSV(planText);
        if (planRows.length < 2) return [];

        // --- PREPARE HEADERS & INDICES ---
        const pHeaders = planRows[0].map(h => h.toLowerCase().trim().replace(/[\r\n]+/g, ' '));
        
        // Plan Columns (Targets)
        const pIdxId = findColIndex(pHeaders, ['id', 'plan id', 'plan_id', 'key']);
        const pIdxDate = findColIndex(pHeaders, ['tanggal', 'date', 'tgl']);
        const pIdxCo = findColIndex(pHeaders, ['co', 'petugas', 'nama co']);
        
        const pIdxSwCurNoa = findColIndex(pHeaders, ['plan sw cur noa', 'sw cur noa', 'sw bulan ini noa']);
        const pIdxSwCurDisb = findColIndex(pHeaders, ['plan sw cur disb', 'sw cur disb', 'sw bulan ini disb']);
        const pIdxSwNextNoa = findColIndex(pHeaders, ['plan sw next noa', 'sw next noa', 'sw bulan depan noa']);
        const pIdxSwNextDisb = findColIndex(pHeaders, ['plan sw next disb', 'sw next disb', 'sw bulan depan disb']);
        const pIdxCtxNoa = findColIndex(pHeaders, ['plan ctx noa', 'col ctx noa', 'ctx noa']);
        const pIdxCtxOs = findColIndex(pHeaders, ['plan ctx os', 'col ctx os', 'ctx os']);
        const pIdxLantakurNoa = findColIndex(pHeaders, ['plan lantakur noa', 'col lantakur noa', 'lantakur noa']);
        const pIdxLantakurOs = findColIndex(pHeaders, ['plan lantakur os', 'col lantakur os', 'lantakur os']);
        const pIdxFppb = findColIndex(pHeaders, ['plan fppb', 'fppb', 'fppb noa']);
        const pIdxBiometrik = findColIndex(pHeaders, ['plan biometrik', 'biometrik', 'bio']);

        // Plan Columns (Actuals)
        const pIdxActSwNoa = findColIndex(pHeaders, ['aktual sw cur noa', 'actual sw cur noa', 'realisasi sw cur noa']);
        const pIdxActSwDisb = findColIndex(pHeaders, ['aktual sw cur disb', 'actual sw cur disb']);
        const pIdxActSwNextNoa = findColIndex(pHeaders, ['aktual sw next noa', 'actual sw next noa']);
        const pIdxActSwNextDisb = findColIndex(pHeaders, ['aktual sw next disb', 'actual sw next disb']);
        const pIdxActCtxNoa = findColIndex(pHeaders, ['aktual ctx noa', 'actual ctx noa']);
        const pIdxActCtxOs = findColIndex(pHeaders, ['aktual ctx os', 'actual ctx os']);
        const pIdxActLantakurNoa = findColIndex(pHeaders, ['aktual lantakur noa', 'actual lantakur noa']);
        const pIdxActLantakurOs = findColIndex(pHeaders, ['aktual lantakur os', 'actual lantakur os']);
        const pIdxActFppb = findColIndex(pHeaders, ['aktual fppb', 'actual fppb']);
        const pIdxActBiometrik = findColIndex(pHeaders, ['aktual biometrik', 'actual biometrik']);

        // --- PARSE PLANS ---
        const uniquePlansMap = new Map<string, DailyPlan>();

        planRows.slice(1).forEach((row, index) => {
            const getVal = (idx: number) => idx !== -1 && row[idx] ? row[idx] : '0';
            
            // Normalize Date
            const rawDate = (pIdxDate !== -1 && row[pIdxDate]) ? row[pIdxDate].trim() : '';
            const date = normalizeSheetDate(rawDate); // Use Helper!

            const co = (pIdxCo !== -1 && row[pIdxCo]) ? row[pIdxCo].trim() : '';
            
            let uniqueKey = '';
            if (pIdxId !== -1 && row[pIdxId]) uniqueKey = row[pIdxId].trim();
            if (!uniqueKey && date && co) uniqueKey = generateLookupKey(date, co);
            
            if (!uniqueKey) return; 

            const plan: DailyPlan = {
                id: uniqueKey,
                date: date,
                coName: co,
                
                // Targets
                swCurrentNoa: getVal(pIdxSwCurNoa),
                swCurrentDisb: getVal(pIdxSwCurDisb),
                swNextNoa: getVal(pIdxSwNextNoa),
                swNextDisb: getVal(pIdxSwNextDisb),
                colCtxNoa: getVal(pIdxCtxNoa),
                colCtxOs: getVal(pIdxCtxOs),
                colLantakurNoa: getVal(pIdxLantakurNoa),
                colLantakurOs: getVal(pIdxLantakurOs),
                fppbNoa: getVal(pIdxFppb),
                biometrikNoa: getVal(pIdxBiometrik),

                // Actuals
                actualSwNoa: getVal(pIdxActSwNoa),
                actualSwDisb: getVal(pIdxActSwDisb),
                actualSwNextNoa: getVal(pIdxActSwNextNoa),
                actualSwNextDisb: getVal(pIdxActSwNextDisb),
                actualCtxNoa: getVal(pIdxActCtxNoa),
                actualCtxOs: getVal(pIdxActCtxOs),
                actualLantakurNoa: getVal(pIdxActLantakurNoa),
                actualLantakurOs: getVal(pIdxActLantakurOs),
                actualFppbNoa: getVal(pIdxActFppb),
                actualBiometrikNoa: getVal(pIdxActBiometrik)
            };

            uniquePlansMap.set(uniqueKey, plan);
        });

        return Array.from(uniquePlansMap.values());

    } catch (error) {
        console.warn("Plan sheet fetch error (likely sheet doesn't exist yet):", error);
        return [];
    }
};

export const submitPlanToSheet = async (scriptUrl: string, plan: DailyPlan, isDebug: boolean = false): Promise<void> => {
    if (!scriptUrl) throw new Error("URL Script tidak ditemukan");

    const payload = {
        action: 'save_plan',
        plan: plan,
        debug: isDebug
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

export const saveTemplatesToSheet = async (scriptUrl: string, templates: MessageTemplate[], isDebug: boolean = false): Promise<void> => {
    if (!scriptUrl) throw new Error("URL Script tidak ditemukan");

    const payload = {
        action: 'save_templates',
        templates: templates,
        debug: isDebug
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

export const updatePhoneInSheet = async (scriptUrl: string, name: string, newPhone: string, isDebug: boolean = false): Promise<void> => {
  if (!scriptUrl) {
    throw new Error("URL Google Apps Script belum dikonfigurasi.");
  }

  const payload = {
    action: 'update_phone',
    name: name,
    phone: newPhone,
    debug: isDebug
  };

  await fetch(scriptUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain' },
    mode: 'no-cors'
  });
  
  await delay(500);
};
