import { SheetConfig } from './types';

// ============================================================================
// KONFIGURASI GLOBAL (BAKU)
// ============================================================================
// Masukkan ID Google Sheet Anda di sini agar aplikasi otomatis terhubung.
// ============================================================================

export const GLOBAL_CONFIG: SheetConfig = {
  // GANTI DENGAN ID SHEET ANDA
  spreadsheetId: "1_WUgnl_JPHKRyzdEwjqufPMkwmZ1zDTgvQ1kVcWIDq0", 
  
  // Nama Tab Data Nasabah
  sheetName: "Data",
  
  // Nama Tab Template (Akan dibuat otomatis oleh script jika belum ada)
  templateSheetName: "Templates",

  // URL Web App Google Apps Script (Wajib untuk fitur Global Admin & Edit No HP)
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbx8WXSSX9zdfSlYLv2xw7NUc9913NyIYmindb6pocJx8VdBrfABxnaa8dbe-nKsEqmGFw/exec" 
};