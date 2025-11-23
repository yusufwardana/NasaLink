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

    // Header Mapping (Fuzzy Match)
    const headers = rows[0].map(h => h.toLowerCase());
    
    const idxName = findColIndex(headers, ['nama', 'nasabah', 'name']);
    const idxPhone = findColIndex(headers, ['telp', 'hp', 'phone', 'wa', 'nomer']);
    const idxSegment = findColIndex(headers, ['status', 'segmen', 'flag', 'kategori']); // Often mixed
    const idxSentra = findColIndex(headers, ['sentra', 'kelompok', 'area']);
    const idxCo = findColIndex(headers, ['co', 'petugas', 'ao']);
    const idxPlafon = findColIndex(headers, ['plafon', 'limit', 'pinjaman']);
    const idxProduk = findColIndex(headers, ['produk']);
    const idxJatuhTempo = findColIndex(headers, ['jatuh tempo', 'tgl', 'tanggal']);
    const idxNotes = findColIndex(headers, ['notes', 'catatan', 'keterangan']);

    // Map rows to Contact objects
    return rows.slice(1).map((row, index): Contact | null => {
        // Safe access helper
        const getVal = (idx: number) => idx !== -1 && row[idx] ? row[idx] : '';

        const name = getVal(idxName) || 'Tanpa Nama';
        const rawPhone = getVal(idxPhone);
        
        // Skip empty rows
        if (name === 'Tanpa Nama' && !rawPhone) return null;

        const phone = rawPhone.replace(/'/g, '').replace(/[^0-9+]/g, ''); // Clean phone
        
        // Determine segment smarter
        let segment: Contact['segment'] = 'Prospect';
        const rawSegInfo = (getVal(idxSegment) + ' ' + (row.length > idxSegment + 1 ? row.join(' ') : '')).toLowerCase();
        
        if (rawSegInfo.includes('gold')) segment = 'Gold';
        else if (rawSegInfo.includes('platinum')) segment = 'Platinum';
        else if (rawSegInfo.includes('silver')) segment = 'Silver';

        return {
            id: `sheet-${index}-${Date.now()}`,
            name: name,
            phone: phone,
            segment: segment,
            sentra: getVal(idxSentra) || 'Pusat',
            
            co: getVal(idxCo),
            plafon: getVal(idxPlafon),
            produk: getVal(idxProduk),
            flag: '', // usually part of segment logic now
            tglJatuhTempo: getVal(idxJatuhTempo),
            statusAsli: getVal(idxSegment), // Keep original status text
            
            notes: getVal(idxNotes),
            lastInteraction: ''
        };
    }).filter((c): c is Contact => c !== null && c.phone.length > 5); // Filter invalid
    
  } catch (error) {
    console.error("Sheet fetch error:", error);
    throw error;
  }
};