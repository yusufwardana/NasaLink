export interface Contact {
  id: string;
  name: string;
  phone: string;
  segment: 'Gold' | 'Silver' | 'Platinum' | 'Prospect';
  sentra?: string; // New field for Branch/Center
  lastInteraction?: string;
  notes?: string;
}

export interface MessageTemplate {
  id: string;
  label: string;
  promptContext: string;
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