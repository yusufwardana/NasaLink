export interface Contact {
  id: string;
  name: string;       // Map from 'NASABAH'
  phone: string;      // Map from 'NOMER TELP'
  flag: string;       // Renamed from 'segment'. Map from 'FLAG'
  sentra?: string;    // Map from 'SENTRA'
  lastInteraction?: string;
  notes?: string;
  
  // New Fields based on BTPN Sheet
  co?: string;             // Map from 'CO'
  plafon?: string;         // Map from 'PLAFON'
  produk?: string;         // Map from 'PRODUK'
  tglJatuhTempo?: string;  // Map from 'TGL JATUH TEMPO'
  status?: string;         // Renamed from 'statusAsli'. Map from 'STATUS'
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
}