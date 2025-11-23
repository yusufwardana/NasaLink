import { Contact } from '../types';

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

export const fetchContactsFromSheet = async (spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<Contact[]> => {
  try {
    // Construct URL for CSV export
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Gagal mengambil data. Pastikan Spreadsheet ID benar dan File di-set "Anyone with the link" atau "Published to Web".');
    }

    const text = await response.text();
    const rows = parseCSV(text);

    if (rows.length < 2) return [];

    // Header Mapping with User Specific Columns
    // Header format: CO, SENTRA, NASABAH, PLAFON, PRODUK, FLAG, TGL JATUH TEMPO, TGL PRS, STATUS, NO TELP
    const headers = rows[0].map(h => h.toLowerCase());
    
    const idxName = findColIndex(headers, ['nasabah', 'nama', 'name', 'client']);
    const idxPhone = findColIndex(headers, ['no telp', 'no. telp', 'telp', 'hp', 'phone', 'wa', 'mobile']);
    
    // Separate Flag (Segment) and Status (Lancar/Macet)
    const idxFlag = findColIndex(headers, ['flag', 'segmen', 'kategori', 'class']); 
    const idxStatus = findColIndex(headers, ['status', 'kondisi', 'kol', 'kolek']);
    
    const idxSentra = findColIndex(headers, ['sentra', 'kelompok', 'area', 'group']);
    const idxCo = findColIndex(headers, ['co', 'petugas', 'ao', 'marketing']);
    const idxPlafon = findColIndex(headers, ['plafon', 'limit', 'pinjaman', 'amount']);
    const idxProduk = findColIndex(headers, ['produk', 'product']);
    const idxJatuhTempo = findColIndex(headers, ['tgl jatuh tempo', 'jatuh tempo', 'due date', 'tempo']);
    const idxNotes = findColIndex(headers, ['notes', 'catatan', 'keterangan']);

    // Map rows to Contact objects
    return rows.slice(1).map((row, index): Contact | null => {
        // Safe access helper
        const getVal = (idx: number) => idx !== -1 && row[idx] ? row[idx] : '';

        const name = getVal(idxName);
        const rawPhone = getVal(idxPhone);
        
        // Skip invalid rows
        if ((!name || name === 'Tanpa Nama') && !rawPhone) return null;

        const phone = rawPhone.replace(/'/g, '').replace(/[^0-9+]/g, ''); // Clean phone
        
        // Skip if phone is too short
        if (phone.length < 6) return null;

        // Determine segment from FLAG or fallback to searching the row
        let segment: Contact['segment'] = 'Prospect';
        const flagVal = getVal(idxFlag);
        const rawSegInfo = (flagVal + ' ' + (idxFlag === -1 ? row.join(' ') : '')).toLowerCase();
        
        if (rawSegInfo.includes('gold')) segment = 'Gold';
        else if (rawSegInfo.includes('platinum')) segment = 'Platinum';
        else if (rawSegInfo.includes('silver')) segment = 'Silver';
        
        // Store the original flag text if available
        const originalFlag = flagVal || segment;

        return {
            id: `sheet-${index}-${Date.now()}`,
            name: name || 'Tanpa Nama',
            phone: phone,
            segment: segment,
            sentra: getVal(idxSentra) || 'Pusat',
            
            co: getVal(idxCo),
            plafon: getVal(idxPlafon),
            produk: getVal(idxProduk),
            flag: originalFlag,
            tglJatuhTempo: getVal(idxJatuhTempo),
            statusAsli: getVal(idxStatus), 
            
            notes: getVal(idxNotes),
            lastInteraction: ''
        };
    }).filter((c): c is Contact => c !== null);
    
  } catch (error) {
    console.error("Sheet fetch error:", error);
    throw error;
  }
};