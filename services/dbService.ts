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
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NasaLinkDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<NasaLinkDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
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
    // Clear old templates first to ensure sync, or just put (upsert)
    // For templates, usually we want to replace the list or update. 
    // Here we upsert.
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

// --- Settings Operations ---

export const getSheetConfig = async (): Promise<SheetConfig | null> => {
  const db = await getDB();
  return db.get('settings', 'sheet_config') as Promise<SheetConfig | null>;
};

export const saveSheetConfig = async (config: SheetConfig): Promise<void> => {
  const db = await getDB();
  await db.put('settings', config, 'sheet_config');
};

export const clearAllData = async (): Promise<void> => {
    const db = await getDB();
    await db.clear('contacts');
    await db.clear('templates');
    await db.clear('settings');
};
