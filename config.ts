import { SheetConfig } from './types';

// ============================================================================
// KONFIGURASI SUPABASE (DATABASE ADMIN & TEMPLATE)
// ============================================================================
// Isi dengan URL dan Anon Key dari Project Supabase Anda.
// ============================================================================
export const SUPABASE_CONFIG = {
  url: "https://bimnpfyhhhhmrjgziaod.supabase.co", 
  key: "sb_publishable_pI6yN-Hh9zdun7Ish6P_Yw_PFb7l8-8" 
};

// ============================================================================
// KONFIGURASI GEMINI AI
// ============================================================================
// API Key diambil dari Environment Variable (disuntikkan otomatis oleh sistem).
// Untuk development lokal, pastikan Anda membuat file .env berisi API_KEY=...
// ============================================================================
export const GEMINI_CONFIG = {
  apiKey: process.env.API_KEY || "" 
};

// ============================================================================
// KONFIGURASI GLOBAL (GOOGLE SHEETS - DATA NASABAH)
// ============================================================================
// Konfigurasi ini berfungsi sebagai FALLBACK jika Supabase belum disetting.
// ============================================================================

export const GLOBAL_CONFIG: SheetConfig = {
  // GANTI DENGAN ID SHEET ANDA
  spreadsheetId: "1_WUgnl_JPHKRyzdEwjqufPMkwmZ1zDTgvQ1kVcWIDq0", 
  
  // Nama Tab Data Nasabah
  sheetName: "Data",
  
  // URL Web App Google Apps Script (Wajib untuk Edit No HP ke Sheet)
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbx8WXSSX9zdfSlYLv2xw7NUc9913NyIYmindb6pocJx8VdBrfABxnaa8dbe-nKsEqmGFw/exec" 
};