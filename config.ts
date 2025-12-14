import { SheetConfig } from './types';

// ============================================================================
// KONFIGURASI SUPABASE (DATABASE ADMIN & TEMPLATE)
// ============================================================================
// Isi dengan URL dan Key project Supabase Anda untuk fitur Admin Sync
export const SUPABASE_CONFIG = {
  url: "https://bimnpfyhhhhmrjgziaod.supabase.co", 
  key: "sb_publishable_pI6yN-Hh9zdun7Ish6P_Yw_PFb7l8-8" 
};

// ============================================================================
// KONFIGURASI GEMINI AI
// ============================================================================
// API Key diambil dari Environment Variable (.env)
export const GEMINI_CONFIG = {
  apiKey: process.env.API_KEY || "" 
};

// ============================================================================
// KONFIGURASI GLOBAL DEFAULT
// ============================================================================
export const GLOBAL_CONFIG: SheetConfig = {
  // GANTI DENGAN ID SHEET ANDA YANG BENAR
  spreadsheetId: "1_WUgnl_JPHKRyzdEwjqufPMkwmZ1zDTgvQ1kVcWIDq0", 
  sheetName: "Data",
  
  // URL Deployment Web App Google Apps Script
  // Pastikan script sudah di-update dengan kode terbaru dari README.md dan di-deploy sebagai 'New Version'
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbyAnnIAWyy1YItAvFXJ2bTq8_qxx6DqQNxo9uNTDzjgwKG8a-IAjc4AOaIuJPtMuQxT/exec",
  
  // Pengaturan Logika Notifikasi Default
  prsThresholdDays: 1, // Alert muncul H-1 sebelum kumpulan
  refinancingLookaheadMonths: 1, // Alert muncul untuk nasabah jatuh tempo bulan ini & depan
  
  // Pengaturan Tampilan
  showHeroSection: true,
  showStatsCards: true
};