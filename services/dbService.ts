import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Contact, MessageTemplate, SheetConfig } from '../types';

interface NasaLinkDB extends DBSchema {
  contacts: {
    key: string;
    value: Contact;
  };
  templates: {
    key: string;
    value: MessageTemplate;
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'nasalink-db';
const DB_VERSION = 7; // Bumped to 7 to ensure stability

let dbPromise: Promise<IDBPDatabase<NasaLinkDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<NasaLinkDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        
        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
           db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
};

// --- Contacts Operations ---

export const getAllContacts = async (): Promise<Contact[]> => {
  const db = await getDB();
  return db.getAll('contacts');
};

export const saveContact = async (contact: Contact): Promise<string> => {
  const db = await getDB();
  await db.put('contacts', contact);
  return contact.id;
};

export const saveBulkContacts = async (contacts: Contact[]): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction('contacts', 'readwrite');
  await Promise.all(contacts.map(c => tx.store.put(c)));
  await tx.done;
};

export const deleteContact = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete('contacts', id);
};

export const clearContacts = async (): Promise<void> => {
    const db = await getDB();
    await db.clear('contacts');
}

// --- Templates Operations ---

export const getAllTemplates = async (): Promise<MessageTemplate[]> => {
  const db = await getDB();
  return db.getAll('templates');
};

export const saveTemplate = async (template: MessageTemplate): Promise<string> => {
  const db = await getDB();
  await db.put('templates', template);
  return template.id;
};

export const saveBulkTemplates = async (templates: MessageTemplate[]): Promise<void> => {
    const db = await getDB();
    const tx = db.transaction('templates', 'readwrite');
    await Promise.all(templates.map(t => tx.store.put(t)));
    await tx.done;
};

export const deleteTemplate = async (id: string): Promise<void> => {
    const db = await getDB();
    await db.delete('templates', id);
};

export const clearTemplates = async (): Promise<void> => {
    const db = await getDB();
    await db.clear('templates');
};

// --- Settings Operations (Now Persistent/Baku) ---

const STORAGE_KEY_CONFIG = 'nasalink_sheet_config_v1';

export const getSheetConfig = async (): Promise<SheetConfig | null> => {
  // 1. Try LocalStorage first (Fastest & Most Persistent)
  try {
    const localConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (localConfig) {
        return JSON.parse(localConfig);
    }
  } catch (e) {
    console.warn("LocalStorage read failed", e);
  }

  // 2. Fallback to IDB
  const db = await getDB();
  return db.get('settings', 'sheet_config') as Promise<SheetConfig | null>;
};

export const saveSheetConfig = async (config: SheetConfig): Promise<void> => {
  // 1. Save to LocalStorage (Make it baku)
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error("LocalStorage write failed", e);
  }

  // 2. Save to IDB (Backup)
  const db = await getDB();
  await db.put('settings', config, 'sheet_config');
};

export const clearAllData = async (): Promise<void> => {
    const db = await getDB();
    await db.clear('contacts');
    // We do NOT clear templates or settings here to prevent accidental configuration loss
    // await db.clear('templates'); 
    // await db.clear('settings');
};