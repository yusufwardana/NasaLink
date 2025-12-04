export interface Contact {
  id: string;
  name: string;       // Map from 'NASABAH'
  phone: string;      // Map from 'NOMER TELP'
  flag: string;       // Map from 'FLAG'
  sentra?: string;    // Map from 'SENTRA'
  lastInteraction?: string;
  notes?: string;
  
  // New Fields based on BTPN Sheet
  co?: string;             // Map from 'CO'
  plafon?: string;         // Map from 'PLAFON'
  produk?: string;         // Map from 'PRODUK'
  tglJatuhTempo?: string;  // Map from 'TGL JATUH TEMPO'
  tglPrs?: string;         // Map from 'TGL PRS'
  status?: string;         // Map from 'STATUS'

  // Additional Banking Data
  appId?: string;          // Map from 'APPID'
  cif?: string;            // Map from 'CIF'
  os?: string;             // Map from 'OS' (Outstanding)
  dpd?: string;            // Map from 'DPD'
  saldoTabungan?: string;  // Map from 'SALDO TABUNGAN'
}

export interface MessageTemplate {
  id: string;
  label: string;
  type: 'ai' | 'manual';
  promptContext?: string; // For AI
  content?: string;       // For Manual
  icon: string;
}

export interface GeneratedMessage {
  text: string;
  timestamp: number;
}

export interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
  templateSheetName?: string;
  googleScriptUrl?: string;
  geminiApiKey?: string;
  
  // --- New Flexible Settings ---
  // Follow Up Logic
  prsThresholdDays?: number; // Default 1 (H-1)
  refinancingLookaheadMonths?: number; // Default 1 (M+1)
  
  // UI Settings
  showHeroSection?: boolean; // Toggle Welcome Banner
  showStatsCards?: boolean; // Toggle Top Stats
}