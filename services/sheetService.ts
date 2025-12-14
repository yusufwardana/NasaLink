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

// --- NEW UPDATED FUNCTION: Fetch Daily Plans & Merge with Actuals ---
export const fetchPlansFromSheet = async (spreadsheetId: string, sheetName: string = 'Plan'): Promise<DailyPlan[]> => {
    try {
        // 1. Fetch PLAN & ACTUAL Sheet concurrently
        const [planText, actualText] = await Promise.all([
            fetchSheetCsv(spreadsheetId, sheetName, 1).catch(() => ""),
            fetchSheetCsv(spreadsheetId, "Aktual", 1).catch(() => "")
        ]);

        if (!planText) return [];
        const planRows = parseCSV(planText);
        if (planRows.length < 2) return [];

        // --- PREPARE HEADERS & INDICES ---
        const pHeaders = planRows[0].map(h => h.toLowerCase().trim().replace(/[\r\n]+/g, ' '));
        
        // Plan Columns
        const pIdxId = findColIndex(pHeaders, ['id', 'plan id', 'plan_id', 'key']);
        const pIdxDate = findColIndex(pHeaders, ['tanggal', 'date', 'tgl']);
        const pIdxCo = findColIndex(pHeaders, ['co', 'petugas', 'nama co']);
        
        const pIdxSwCurNoa = findColIndex(pHeaders, ['sw cur noa', 'sw bulan ini noa', 'sw noa']);
        const pIdxSwCurDisb = findColIndex(pHeaders, ['sw cur disb', 'sw bulan ini disb', 'sw disb']);
        const pIdxSwNextNoa = findColIndex(pHeaders, ['sw next noa', 'sw bulan depan noa']);
        const pIdxSwNextDisb = findColIndex(pHeaders, ['sw next disb', 'sw bulan depan disb']);
        const pIdxCtxNoa = findColIndex(pHeaders, ['col ctx noa', 'ctx noa']);
        const pIdxCtxOs = findColIndex(pHeaders, ['col ctx os', 'ctx os']);
        const pIdxLantakurNoa = findColIndex(pHeaders, ['col lantakur noa', 'lantakur noa']);
        const pIdxLantakurOs = findColIndex(pHeaders, ['col lantakur os', 'lantakur os']);
        const pIdxFppb = findColIndex(pHeaders, ['fppb', 'fppb noa', 'input fppb']);
        const pIdxBiometrik = findColIndex(pHeaders, ['biometrik', 'bio', 'biometrik noa']);

        // Actual Columns Preparation
        let actRows: string[][] = [];
        let aHeaders: string[] = [];
        let aIdxId = -1;
        let aIdxDate = -1; 
        let aIdxCo = -1;
        
        // Metric Indices for Actuals
        let aIdxSwNoa = -1, aIdxSwDisb = -1, aIdxSwNextNoa = -1, aIdxSwNextDisb = -1;
        let aIdxCtxNoa = -1, aIdxCtxOs = -1, aIdxLantakurNoa = -1, aIdxLantakurOs = -1;
        let aIdxFppb = -1, aIdxBiometrik = -1;

        if (actualText) {
            actRows = parseCSV(actualText);
            if (actRows.length >= 2) {
                aHeaders = actRows[0].map(h => h.toLowerCase().trim().replace(/[\r\n]+/g, ' '));
                aIdxId = findColIndex(aHeaders, ['id', 'plan id', 'plan_id', 'key']);
                aIdxDate = findColIndex(aHeaders, ['tanggal', 'date', 'tgl']);
                aIdxCo = findColIndex(aHeaders, ['co', 'petugas', 'nama co']);

                aIdxSwNoa = findColIndex(aHeaders, ['sw cur noa', 'sw noa', 'sw (noa)', 'sw bulan ini noa', 'sw bln ini noa']);
                aIdxSwDisb = findColIndex(aHeaders, ['sw cur disb', 'sw disb', 'sw (disb)', 'sw bulan ini disb', 'sw bln ini disb']);
                aIdxSwNextNoa = findColIndex(aHeaders, ['sw next noa', 'sw bulan depan noa', 'sw bln depan noa']);
                aIdxSwNextDisb = findColIndex(aHeaders, ['sw next disb', 'sw bulan depan disb', 'sw bln depan disb']);
                aIdxCtxNoa = findColIndex(aHeaders, ['col ctx noa', 'ctx noa', 'ctx (noa)']);
                aIdxCtxOs = findColIndex(aHeaders, ['col ctx os', 'ctx os', 'ctx (os)']);
                aIdxLantakurNoa = findColIndex(aHeaders, ['col lantakur noa', 'lantakur noa', 'lantakur (noa)']);
                aIdxLantakurOs = findColIndex(aHeaders, ['col lantakur os', 'lantakur os', 'lantakur (os)']);
                aIdxFppb = findColIndex(aHeaders, ['fppb', 'fppb noa', 'input fppb']);
                aIdxBiometrik = findColIndex(aHeaders, ['biometrik', 'bio', 'biometrik noa']);
            }
        }

        // --- DETERMINE MATCHING STRATEGY ---
        // Priority: Use ID if available in both sheets. Fallback to Date+CO.
        const useIdMatching = (pIdxId !== -1 && aIdxId !== -1);

        // --- PARSE ACTUALS INTO LOOKUP MAP ---
        const actualsMap = new Map<string, any>();
        
        if (actRows.length >= 2) {
            actRows.slice(1).forEach(row => {
                let key = '';
                
                // Strategy 1: Match by ID
                if (useIdMatching && row[aIdxId]) {
                    key = row[aIdxId].trim();
                } 
                
                // Strategy 2: Match by Date+CO (Fallback if ID missing or Strategy 1 disabled)
                if (!key && aIdxDate !== -1 && aIdxCo !== -1 && row[aIdxDate] && row[aIdxCo]) {
                    key = generateLookupKey(row[aIdxDate], row[aIdxCo]);
                }

                if (key) {
                     actualsMap.set(key, {
                         swNoa: row[aIdxSwNoa] || '0',
                         swDisb: row[aIdxSwDisb] || '0',
                         swNextNoa: row[aIdxSwNextNoa] || '0',
                         swNextDisb: row[aIdxSwNextDisb] || '0',
                         ctxNoa: row[aIdxCtxNoa] || '0',
                         ctxOs: row[aIdxCtxOs] || '0',
                         lantakurNoa: row[aIdxLantakurNoa] || '0',
                         lantakurOs: row[aIdxLantakurOs] || '0',
                         fppbNoa: row[aIdxFppb] || '0',
                         biometrikNoa: row[aIdxBiometrik] || '0'
                     });
                }
            });
        }

        // --- PARSE PLANS ---
        const uniquePlansMap = new Map<string, DailyPlan>();

        planRows.slice(1).forEach((row, index) => {
            const getVal = (idx: number) => idx !== -1 && row[idx] ? row[idx] : '0';
            
            // Basic Checks
            const date = (pIdxDate !== -1 && row[pIdxDate]) ? row[pIdxDate].trim() : '';
            const co = (pIdxCo !== -1 && row[pIdxCo]) ? row[pIdxCo].trim() : '';
            
            // Determine Lookup Key
            let lookupKey = '';
            
            if (useIdMatching && row[pIdxId]) {
                lookupKey = row[pIdxId].trim();
            }
            
            if (!lookupKey && date && co) {
                lookupKey = generateLookupKey(date, co);
            }

            // Retrieve Actuals
            const actualData = actualsMap.get(lookupKey) || {};

            // Determine uniqueKey for deduplication map
            // If using ID matching, ID is uniqueKey. If not, Date+CO is uniqueKey.
            // If ID is missing on a row, fallback to Date+CO.
            let uniqueKey = lookupKey;
            if (!uniqueKey) {
                 // Fallback if row has absolutely no identifier but we still want to list it?
                 // We require at least Date & CO to be valid Plan.
                 if (date && co) uniqueKey = generateLookupKey(date, co);
                 else return; // Skip invalid row
            }

            const plan: DailyPlan = {
                // If Plan has ID column, prefer that as object ID. Else synthetic.
                id: (pIdxId !== -1 && row[pIdxId]) ? row[pIdxId].trim() : `plan-${index}-${Date.now()}`,
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

                // Actuals (Merged)
                actualSwNoa: actualData.swNoa || '0',
                actualSwDisb: actualData.swDisb || '0',
                actualSwNextNoa: actualData.swNextNoa || '0',
                actualSwNextDisb: actualData.swNextDisb || '0',
                actualCtxNoa: actualData.ctxNoa || '0',
                actualCtxOs: actualData.ctxOs || '0',
                actualLantakurNoa: actualData.lantakurNoa || '0',
                actualLantakurOs: actualData.lantakurOs || '0',
                actualFppbNoa: actualData.fppbNoa || '0',
                actualBiometrikNoa: actualData.biometrikNoa || '0'
            };

            // INTELLIGENT FILTERING:
            // Only add if there is meaningful data (Target > 0 OR Actual > 0)
            const hasTargets = 
                isNonZero(plan.swCurrentNoa) || isNonZero(plan.swCurrentDisb) ||
                isNonZero(plan.swNextNoa) || isNonZero(plan.swNextDisb) ||
                isNonZero(plan.colCtxNoa) || isNonZero(plan.colLantakurNoa) ||
                isNonZero(plan.fppbNoa) || isNonZero(plan.biometrikNoa);

            const hasActuals = 
                isNonZero(plan.actualSwNoa) || isNonZero(plan.actualSwDisb) ||
                isNonZero(plan.actualSwNextNoa) || isNonZero(plan.actualSwNextDisb) ||
                isNonZero(plan.actualCtxNoa) || isNonZero(plan.actualLantakurNoa) ||
                isNonZero(plan.actualFppbNoa) || isNonZero(plan.actualBiometrikNoa);

            if (hasTargets || hasActuals) {
                 // Add to Map (Overwrites previous entry if same key -> effectively getting the latest)
                 uniquePlansMap.set(uniqueKey, plan);
            }
        });

        return Array.from(uniquePlansMap.values());

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