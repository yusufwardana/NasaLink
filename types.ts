export interface Contact {
  id: string;
  name: string;       // Map from 'NASABAH'
  phone: string;      // Map from 'NOMER TELP'
  segment: 'Gold' | 'Silver' | 'Platinum' | 'Prospect'; // Internal app logic or mapped from FLAG/STATUS
  sentra?: string;    // Map from 'SENTRA'
  lastInteraction?: string;
  notes?: string;
  
  // New Fields based on BTPN Sheet
  co?: string;             // Map from 'CO'
  plafon?: string;         // Map from 'PLAFON'
  produk?: string;         // Map from 'PRODUK'
  flag?: string;           // Map from 'FLAG'
  tglJatuhTempo?: string;  // Map from 'TGL JATUH TEMPO'
  statusAsli?: string;     // Map from 'STATUS' (to keep original status text like 'Lancar', 'Macet')
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