import { Contact } from '../types';

// Helper to parse CSV text
const parseCSV = (text: string): any[] => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  
  return lines.slice(1).map(line => {
    // Regex to handle commas inside quotes
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const cleanValues = values.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    
    const entry: any = {};
    headers.forEach((header, index) => {
      entry[header] = cleanValues[index] || '';
    });
    return entry;
  });
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
    const rawData = parseCSV(text);

    // Map CSV columns to Contact interface based on user provided columns:
    // CO, SENTRA, NASABAH, PLAFON, PRODUK, FLAG, TGL JATUH TEMPO, STATUS, NOMER TELP
    return rawData.map((row, index) => {
        const name = row.nasabah || row.nama || 'Tanpa Nama';
        const phone = (row['nomer telp'] || row.telepon || row.hp || row.phone || '').replace(/'/g, '');
        
        // Determine segment based on FLAG or STATUS if available, otherwise default
        let segment: any = 'Prospect';
        const rawStatus = (row.status || '').toLowerCase();
        const rawFlag = (row.flag || '').toLowerCase();
        
        if (rawFlag.includes('gold') || rawStatus.includes('gold')) segment = 'Gold';
        else if (rawFlag.includes('platinum') || rawStatus.includes('platinum')) segment = 'Platinum';
        else if (rawFlag.includes('silver') || rawStatus.includes('silver')) segment = 'Silver';

        return {
            id: `sheet-${index}-${Date.now()}`,
            name: name,
            phone: phone,
            segment: segment,
            sentra: row.sentra || 'Pusat',
            
            // New mapped fields
            co: row.co || '',
            plafon: row.plafon || '',
            produk: row.produk || '',
            flag: row.flag || '',
            tglJatuhTempo: row['tgl jatuh tempo'] || '',
            statusAsli: row.status || '',
            
            notes: row.notes || '', // Fallback if 'notes' column exists
            lastInteraction: ''
        };
    }).filter(c => c.name !== 'Tanpa Nama' && c.phone !== ''); 
  } catch (error) {
    console.error("Sheet fetch error:", error);
    throw error;
  }
};