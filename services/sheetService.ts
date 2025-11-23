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
    // Construct URL for CSV export (Must be "Published to Web" or publicly accessible via link)
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Gagal mengambil data. Pastikan Spreadsheet ID benar dan File di-set "Anyone with the link" atau "Published to Web".');
    }

    const text = await response.text();
    const rawData = parseCSV(text);

    // Map CSV columns to Contact interface
    // Expected CSV headers (case insensitive): Name, Phone, Segment, Sentra, Notes
    return rawData.map((row, index) => ({
      id: `sheet-${index}-${Date.now()}`,
      name: row.name || row.nama || 'Tanpa Nama',
      phone: (row.phone || row.telepon || row.hp || '').replace(/'/g, ''), // Remove excel ' prefix if any
      segment: ['Gold', 'Silver', 'Platinum', 'Prospect'].includes(row.segment) ? row.segment : 'Prospect',
      sentra: row.sentra || row.cabang || 'Pusat',
      notes: row.notes || row.catatan || '',
      lastInteraction: ''
    })).filter(c => c.name !== 'Tanpa Nama' && c.phone !== ''); // Filter empty rows
  } catch (error) {
    console.error("Sheet fetch error:", error);
    throw error;
  }
};