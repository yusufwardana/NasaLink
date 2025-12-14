
import { SheetConfig } from './types';

// ============================================================================
// KONFIGURASI SUPABASE (DATABASE ADMIN & TEMPLATE)
// ============================================================================
export const SUPABASE_CONFIG = {
  url: "https://bimnpfyhhhhmrjgziaod.supabase.co", 
  key: "sb_publishable_pI6yN-Hh9zdun7Ish6P_Yw_PFb7l8-8" 
};

// ============================================================================
// KONFIGURASI GEMINI AI
// ============================================================================
export const GEMINI_CONFIG = {
  apiKey: process.env.API_KEY || "" 
};

// ============================================================================
// KONFIGURASI GLOBAL DEFAULT
// ============================================================================

export const GLOBAL_CONFIG: SheetConfig = {
  // GANTI DENGAN ID SHEET ANDA
  spreadsheetId: "1_WUgnl_JPHKRyzdEwjqufPMkwmZ1zDTgvQ1kVcWIDq0", 
  sheetName: "Data",
  planSheetName: "Plan", // Default Name for Plan Sheet
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbx8WXSSX9zdfSlYLv2xw7NUc9913NyIYmindb6pocJx8VdBrfABxnaa8dbe-nKsEqmGFw/exec",
  
  // Default Logic Settings
  prsThresholdDays: 1, // H-1
  refinancingLookaheadMonths: 1, // Sampai Bulan Depan
  showHeroSection: true,
  showStatsCards: true
};
