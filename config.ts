import { SheetConfig } from './types';

// ============================================================================
// KONFIGURASI GLOBAL (BAKU)
// ============================================================================
// Masukkan ID Google Sheet Anda di sini agar aplikasi otomatis terhubung.
// ============================================================================

export const GLOBAL_CONFIG: SheetConfig = {
  // GANTI DENGAN ID SHEET ANDA
  spreadsheetId: "1_WUgnl_JPHKRyzdEwjqufPMkwmZ1zDTgvQ1kVcWIDq0", 
  
  // Nama Tab (default: Sheet1)
  sheetName: "Data",

  // URL Web App Google Apps Script (Untuk fitur Edit No HP)
  // Kosongkan jika belum deploy script
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbyO1OIdkFaj-179wrMDFhRGy6jfxAzP5Grg5WHvK8oUiLpaM9-tsSsRn1zaGvOONHq0ug/exec" 
};