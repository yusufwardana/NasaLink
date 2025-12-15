
import { Contact, MessageTemplate, DailyPlan } from '../types';

// --- UTILITIES ---

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Robust CSV Parser
 * Handles quotes, commas inside quotes, and newlines.
 */
const parseCSV = (text: string): string[][] => {
  const result: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let insideQuote = false;
  
  // Normalize line endings once
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const len = cleanText.length;

  for (let i = 0; i < len; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentVal += '"';
        i++; 
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push(currentVal.trim());
      currentVal = '';
    } else if (char === '\n' && !insideQuote) {
      row.push(currentVal.trim());
      if (row.length > 0 && row.some(c => c !== '')) result.push(row);
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  
  if (currentVal || row.length > 0) {
      row.push(currentVal.trim());
      if (row.length > 0 && row.some(c => c !== '')) result.push(row);
  }

  return result;
};

/**
 * Column Index Finder
 * Case-insensitive, supports exclusion keywords.
 */
const findColIndex = (headers: string[], keywords: string[], excludes: string[] = []): number => {
    return headers.findIndex(h => {
        if (!h) return false;
        const hClean = h; 
        
        if (excludes.length > 0 && excludes.some(ex => hClean.includes(ex))) return false;
        return keywords.some(k => hClean.includes(k));
    });
};

/**
 * Date Normalizer
 * Standardizes various sheet date formats to DD/MM/YYYY
 */
const normalizeSheetDate = (val: string): string => {
    if (!val) return '';
    let clean = val.trim().replace(/^'/, ''); // Remove leading quote
    
    // ISO YYYY-MM-DD
    if (clean.includes('-') && clean.length === 10 && clean.charAt(4) === '-') {
        const [y, m, d] = clean.split('-');
        return `${d}/${m}/${y}`;
    }

    // DD/MM/YYYY or DD/MM/YY
    if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length === 3) {
             const d = parts[0].padStart(2, '0');
             const m = parts[1].padStart(2, '0');
             let y = parts[2];
             if (y.length === 2) y = '20' + y;
             return `${d}/${m}/${y}`;
        }
    }
    
    return clean; // Return as-is if pattern doesn't match
};

/**
 * GENERIC SHEET FETCHER
 * Fetches CSV, parses it, and handles errors/retries.
 */
const fetchAndParseSheet = async (spreadsheetId: string, sheetName: string, retries = 1): Promise<{ headers: string[], rows: string[][] }> => {
    const timestamp = Date.now();
    // Cache busting
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}&single=true&_cb=${timestamp}`;
    
    try {
        const response = await fetch(url, {
            cache: "no-store",
            headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        
        const text = await response.text();
        const rows = parseCSV(text);
        
        if (rows.length < 1) return { headers: [], rows: [] };

        // Headers: lowercase and trim once for performance
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const dataRows = rows.slice(1);

        return { headers, rows: dataRows };

    } catch (error) {
        if (retries > 0) {
            await delay(1000);
            return fetchAndParseSheet(spreadsheetId, sheetName, retries - 1);
        }
        console.warn(`Failed to fetch ${sheetName}:`, error);
        return { headers: [], rows: [] };
    }
};

// --- PUBLIC FUNCTIONS ---

export const fetchContactsFromSheet = async (spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<Contact[]> => {
  const { headers, rows } = await fetchAndParseSheet(spreadsheetId, sheetName);
  if (rows.length === 0) return [];

  // 1. Map Indices
  const map = {
      name: findColIndex(headers, ['nasabah', 'nama', 'name']),
      phone: findColIndex(headers, ['nomer telp', 'no telp', 'telp', 'phone', 'wa']),
      flag: findColIndex(headers, ['flag', 'segmen']),
      status: findColIndex(headers, ['status', 'kondisi']),
      sentra: findColIndex(headers, ['sentra', 'kelompok']),
      co: findColIndex(headers, ['co', 'petugas']),
      plafon: findColIndex(headers, ['plafon', 'limit']),
      produk: findColIndex(headers, ['produk', 'product']),
      jatuhTempo: findColIndex(headers, ['tgl jatuh tempo', 'jatuh tempo']),
      prs: findColIndex(headers, ['tgl prs', 'prs']),
      notes: findColIndex(headers, ['notes', 'catatan', 'keterangan']),
      // Extended
      appId: findColIndex(headers, ['appid', 'app id']),
      cif: findColIndex(headers, ['cif', 'no cif']),
      os: findColIndex(headers, ['os', 'outstanding']),
      dpd: findColIndex(headers, ['dpd', 'days past due']),
      saldo: findColIndex(headers, ['saldo', 'tabungan']),
      lunas: findColIndex(headers, ['tgl lunas', 'tanggal lunas']),
      // Collection
      angsuran: findColIndex(headers, ['angsuran', 'besar angsuran']),
      tunggakan: findColIndex(headers, ['tunggakan', 'total tunggakan']),
      flagMenunggak: findColIndex(headers, ['flag menunggak', 'kolektabilitas', 'bucket']),
      flagLantakur: findColIndex(headers, ['flag lantakur', 'lantakur', 'tabungan kurang']),
  };

  const contacts: Contact[] = [];

  // 2. Iterate Rows
  for (const row of rows) {
      const getVal = (idx: number) => (idx !== -1 && row[idx]) ? row[idx] : '';
      const name = getVal(map.name);
      
      // Strict Filter: Valid Name required
      if (!name || name === 'Tanpa Nama') continue;

      const rawPhone = getVal(map.phone);
      const phone = rawPhone ? rawPhone.replace(/'/g, '').replace(/[^0-9+]/g, '') : '';
      const sentra = getVal(map.sentra) || 'Pusat';

      // Optimized ID Generation
      const uniqueString = `${name}-${phone}-${sentra}`.replace(/\s+/g, '').toLowerCase();
      // Simple hash to avoid btoa overhead if not needed
      const stableId = `c-${btoa(uniqueString).substring(0, 16)}`;

      contacts.push({
          id: stableId,
          name,
          phone,
          flag: getVal(map.flag) || 'Active',
          sentra,
          co: getVal(map.co),
          plafon: getVal(map.plafon),
          produk: getVal(map.produk),
          tglJatuhTempo: normalizeSheetDate(getVal(map.jatuhTempo)),
          tglPrs: getVal(map.prs),
          status: getVal(map.status),
          notes: getVal(map.notes),
          // Details
          appId: getVal(map.appId),
          cif: getVal(map.cif),
          os: getVal(map.os),
          dpd: getVal(map.dpd),
          saldoTabungan: getVal(map.saldo),
          tglLunas: normalizeSheetDate(getVal(map.lunas)),
          // Collection
          angsuran: getVal(map.angsuran),
          tunggakan: getVal(map.tunggakan),
          flagMenunggak: getVal(map.flagMenunggak),
          flagLantakur: getVal(map.flagLantakur),
          lastInteraction: ''
      });
  }

  return contacts;
};

export const fetchTemplatesFromSheet = async (spreadsheetId: string, sheetName: string = 'Templates'): Promise<MessageTemplate[]> => {
    const { headers, rows } = await fetchAndParseSheet(spreadsheetId, sheetName, 2);
    if (rows.length === 0) return [];

    const idxId = findColIndex(headers, ['id']);
    const idxLabel = findColIndex(headers, ['label', 'judul']);
    const idxType = findColIndex(headers, ['type', 'tipe']);
    const idxPrompt = findColIndex(headers, ['prompt', 'instruksi']);
    const idxContent = findColIndex(headers, ['content', 'isi']);
    const idxIcon = findColIndex(headers, ['icon', 'ikon']);

    return rows.map((row): MessageTemplate | null => {
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
};

// --- WRITE OPERATIONS (NO-CORS, FIRE & FORGET) ---

const postToScript = async (url: string, payload: any): Promise<void> => {
    if (!url) throw new Error("URL Script tidak ditemukan");
    try {
        await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' },
            mode: 'no-cors'
        });
        // Small delay to allow script execution on Google side
        await delay(1000); 
    } catch (e) {
        console.error("Script Post Error:", e);
    }
};

export const submitPlanToSheet = async (scriptUrl: string, plan: DailyPlan, isDebug: boolean = false): Promise<void> => {
    await postToScript(scriptUrl, {
        action: 'save_plan',
        plan: plan,
        debug: isDebug
    });
};

export const saveTemplatesToSheet = async (scriptUrl: string, templates: MessageTemplate[], isDebug: boolean = false): Promise<void> => {
    await postToScript(scriptUrl, {
        action: 'save_templates',
        templates: templates,
        debug: isDebug
    });
};

export const updateContactData = async (scriptUrl: string, name: string, newPhone: string, newNotes: string, isDebug: boolean = false): Promise<void> => {
    await postToScript(scriptUrl, {
        action: 'update_contact',
        name: name,
        phone: newPhone,
        notes: newNotes,
        debug: isDebug
    });
};

export const updatePhoneInSheet = updateContactData;