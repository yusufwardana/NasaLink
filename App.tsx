import React, { useState, useEffect } from 'react';
import { Contact, MessageTemplate, SheetConfig } from './types';
import { ContactCard } from './components/ContactCard';
import { MessageGeneratorModal } from './components/MessageGeneratorModal';
import { ImportModal } from './components/ImportModal';
import { EditContactModal } from './components/EditContactModal';
import { AdminModal } from './components/AdminModal';
import { Button } from './components/Button';
import { fetchContactsFromSheet } from './services/sheetService';
import { Search, Plus, Users, Settings, Shield, RefreshCw, Filter } from 'lucide-react';

// Initial dummy data
const INITIAL_DATA: Contact[] = [
  { id: '1', name: 'Pak Wijaya', phone: '081299998888', segment: 'Platinum', sentra: 'Jakarta Pusat', lastInteraction: '12 Okt 2023', notes: 'VIP Client' },
  { id: '2', name: 'Ibu Ratna', phone: '081377776666', segment: 'Gold', sentra: 'Surabaya', lastInteraction: '20 Okt 2023', notes: 'Interested in education plan' },
  { id: '3', name: 'Mas Dimas', phone: '085655554444', segment: 'Prospect', sentra: 'Bandung', lastInteraction: 'Kemarin', notes: 'Cold lead' },
];

const INITIAL_TEMPLATES: MessageTemplate[] = [
  { id: '1', label: 'Sapaan Rutin', promptContext: 'Menanyakan kabar dan menjaga hubungan baik, tidak berjualan hard selling.', icon: '👋' },
  { id: '2', label: 'Ulang Tahun', promptContext: 'Mengucapkan selamat ulang tahun dan mendoakan kesehatan.', icon: '🎂' },
  { id: '3', label: 'Penawaran Promo', promptContext: 'Menginformasikan promo terbatas bulan ini untuk asuransi kesehatan.', icon: '🏷️' },
  { id: '4', label: 'Jatuh Tempo', promptContext: 'Mengingatkan pembayaran premi yang akan jatuh tempo minggu depan dengan sopan.', icon: '📅' },
  { id: '5', label: 'Follow Up', promptContext: 'Follow up setelah pertemuan pertama kemarin, menanyakan apakah ada pertanyaan lanjutan.', icon: '🤝' },
];

const App: React.FC = () => {
  // State: Contacts
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem('nasalink_contacts');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });

  // State: Templates
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => {
    const saved = localStorage.getItem('nasalink_templates');
    return saved ? JSON.parse(saved) : INITIAL_TEMPLATES;
  });
  
  // State: UI & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSentra, setSelectedSentra] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // State: Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('nasalink_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem('nasalink_templates', JSON.stringify(templates));
  }, [templates]);

  // Get Unique Sentras
  const sentraOptions = Array.from(new Set(contacts.map(c => c.sentra).filter(Boolean))).sort();

  // Handlers
  const handleImport = (newContacts: Contact[]) => {
    setContacts(prev => [...newContacts, ...prev]);
  };

  const handleUpdateContact = (updated: Contact) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };
  
  const handleResetData = () => {
    setContacts(INITIAL_DATA);
    setTemplates(INITIAL_TEMPLATES);
    localStorage.removeItem('nasalink_contacts');
    localStorage.removeItem('nasalink_templates');
  };

  const handleSyncSheet = async () => {
    const configStr = localStorage.getItem('nasalink_sheet_config');
    if (!configStr) {
        alert("Konfigurasi Google Sheet belum diatur. Silakan ke Menu Admin.");
        setIsAdminModalOpen(true);
        return;
    }

    const config: SheetConfig = JSON.parse(configStr);
    if (!config.spreadsheetId) {
         alert("Spreadsheet ID belum diisi di Menu Admin.");
         return;
    }

    if (window.confirm("Sync akan menggabungkan data dari Google Sheet. Lanjutkan?")) {
        setIsSyncing(true);
        try {
            const sheetContacts = await fetchContactsFromSheet(config.spreadsheetId, config.sheetName);
            
            // Merge Strategy: Overwrite if phone matches, else add
            setContacts(prev => {
                // Explicitly type the map to avoid type inference issues
                const phoneMap = new Map<string, Contact>();
                prev.forEach(c => phoneMap.set(c.phone, c));
                
                sheetContacts.forEach(sc => {
                    // If exists, update details but keep ID (unless you want full overwrite)
                    // Here we prioritize Sheet data
                    const existing = phoneMap.get(sc.phone);
                    if (existing) {
                        phoneMap.set(sc.phone, { ...existing, ...sc, id: existing.id });
                    } else {
                        phoneMap.set(sc.phone, sc);
                    }
                });
                return Array.from(phoneMap.values());
            });
            alert(`Berhasil sync! ${sheetContacts.length} data diambil dari Sheet.`);
        } catch (e: any) {
            alert(`Gagal sync: ${e.message}`);
        } finally {
            setIsSyncing(false);
        }
    }
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.segment.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.sentra && c.sentra.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSentra = selectedSentra ? c.sentra === selectedSentra : true;

    return matchesSearch && matchesSentra;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 text-white p-2 rounded-lg">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">NasaLink</h1>
                        <p className="text-xs text-gray-500">Direktori Nasabah Cerdas</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleSyncSheet}
                        isLoading={isSyncing}
                        className="hidden sm:flex"
                        icon={<RefreshCw className="w-4 h-4"/>}
                    >
                        Sync Sheet
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAdminModalOpen(true)}
                        className="hidden sm:flex"
                        icon={<Shield className="w-4 h-4" />}
                    >
                        Menu Admin
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Cari nama, sentra, atau segmen..." 
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-2">
                     {/* Sentra Filter */}
                    <div className="relative min-w-[140px]">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <select
                            value={selectedSentra}
                            onChange={(e) => setSelectedSentra(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-white appearance-none text-sm"
                        >
                            <option value="">Semua Sentra</option>
                            {sentraOptions.map(s => (
                                <option key={s} value={String(s)}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <Button 
                        onClick={handleSyncSheet}
                        variant="secondary"
                        className="sm:hidden px-3"
                        isLoading={isSyncing}
                    >
                        <RefreshCw className="w-5 h-5" />
                    </Button>

                    <Button 
                        onClick={() => setIsAdminModalOpen(true)}
                        variant="secondary"
                        className="sm:hidden px-3"
                    >
                        <Settings className="w-5 h-5" />
                    </Button>

                    <Button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="whitespace-nowrap"
                        icon={<Plus className="w-5 h-5" />}
                    >
                        <span className="hidden sm:inline">Tambah</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-4">
            <div className="flex justify-between items-end px-1">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Daftar Nasabah {selectedSentra ? `- ${selectedSentra}` : ''} ({filteredContacts.length})
                </h2>
            </div>
            
            {filteredContacts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500 mb-4">Tidak ada nasabah ditemukan.</p>
                    <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                        Import Kontak Baru
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredContacts.map(contact => (
                        <ContactCard 
                            key={contact.id} 
                            contact={contact} 
                            onGenerateClick={setSelectedContact}
                            onEditClick={setContactToEdit}
                        />
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Modals */}
      {selectedContact && (
        <MessageGeneratorModal 
            contact={selectedContact} 
            isOpen={!!selectedContact} 
            onClose={() => setSelectedContact(null)} 
            templates={templates}
        />
      )}

      <EditContactModal
        isOpen={!!contactToEdit}
        contact={contactToEdit}
        onClose={() => setContactToEdit(null)}
        onSave={handleUpdateContact}
        onDelete={handleDeleteContact}
      />

      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        templates={templates}
        onUpdateTemplates={setTemplates}
        onResetData={handleResetData}
      />

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImport}
      />

    </div>
  );
};

export default App;