import { SheetConfig } from './types';

// ============================================================================
// KONFIGURASI GLOBAL (BAKU)
// ============================================================================
// Masukkan ID Google Sheet Anda di sini agar aplikasi otomatis terhubung
// di semua perangkat tanpa perlu setting manual satu per satu.
//
// Cara ambil ID: 
// Buka Sheet > Lihat URL > Copy bagian acak antara '/d/' dan '/edit'
// Contoh URL: docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKbBdBdB/edit
// ID nya adalah: 1BxiMVs0XRA5nFMdKbBdBdB
// ============================================================================

export const GLOBAL_CONFIG: SheetConfig = {
  // GANTI BAGIAN DALAM KUTIP DI BAWAH INI DENGAN ID SHEET ANDA
  spreadsheetId: "", 
  
  // Nama Tab di bawah (default: Sheet1)
  sheetName: "Sheet1" 
};
