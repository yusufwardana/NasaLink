import { SheetConfig } from './types';

// ============================================================================
// KONFIGURASI SUPABASE (DATABASE ADMIN & TEMPLATE)
// ============================================================================
// Isi dengan URL dan Anon Key dari Project Supabase Anda.
// ============================================================================
export const SUPABASE_CONFIG = {
  url: "https://bimnpfyhhhhmrjgziaod.supabase.co", // Masukkan Project URL Supabase (https://xyz.supabase.co)
  key: "sb_publishable_pI6yN-Hh9zdun7Ish6P_Yw_PFb7l8-8"  // Masukkan API Key (public/anon)
};

// ============================================================================
// KONFIGURASI GEMINI AI
// ============================================================================
// API Key diambil dari Environment Variable (disuntikkan otomatis oleh sistem).
// Jangan hardcode key di sini untuk keamanan.
// ============================================================================
export const GEMINI_CONFIG = {
  apiKey: process.env.API_KEY || "" 
};

// ============================================================================
// KONFIGURASI GLOBAL (GOOGLE SHEETS - DATA NASABAH)
// ============================================================================
// Konfigurasi ini sekarang bisa dioverride oleh data dari Supabase (Table app_settings)
// Namun ini tetap digunakan sebagai fallback/default.
// ============================================================================

export const GLOBAL_CONFIG: SheetConfig = {
  // GANTI DENGAN ID SHEET ANDA
  spreadsheetId: "1_WUgnl_JPHKRyzdEwjqufPMkwmZ1zDTgvQ1kVcWIDq0", 
  
  // Nama Tab Data Nasabah
  sheetName: "Data",
  
  // URL Web App Google Apps Script (Wajib untuk Edit No HP ke Sheet)
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbx8WXSSX9zdfSlYLv2xw7NUc9913NyIYmindb6pocJx8VdBrfABxnaa8dbe-nKsEqmGFw/exec" 
};