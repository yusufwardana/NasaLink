import { Contact, MessageTemplate } from '../types';

// Robust CSV Parser that handles quotes and commas inside quotekjmmpps
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

// Helper to fetch CSV
const fetchSheetCsv = async (spreadsheetId: string, sheetName: string) => {
    const timestamp = new Date().getTime();
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}&single=true&t=${timestamp}`;
    
    const response = await fetch(url, {
        cache: "no-store",
        headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch sheet ${sheetName}`);
    }
    return await response.text();
};

export const fetchContactsFromSheet = async (spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<Contact[]> => {
  try {
    const text = await fetchSheetCsv(spreadsheetId, sheetName);
    const rows = parseCSV(text);

    if (rows.length < 2) return [];

    // Header Mapping based on User Screenshot
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
        const text = await fetchSheetCsv(spreadsheetId, sheetName);
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

export const saveTemplatesToSheet = async (scriptUrl: string, templates: MessageTemplate[]): Promise<void> => {
    if (!scriptUrl) throw new Error("URL Script tidak ditemukan");

    const payload = {
        action: 'save_templates',
        templates: templates
    };

    await fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' },
        mode: 'no-cors'
    });
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
};