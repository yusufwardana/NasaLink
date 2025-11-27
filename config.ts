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
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbwhNRiSPB-jte6QTCX9wz57J_qH4US_ttjGYKaEiYxCkBl7AaYXBgVf9rr0jf0VHo-3rg/exec" 
};