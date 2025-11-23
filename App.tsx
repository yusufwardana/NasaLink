import React, { useState, useEffect, useMemo } from 'react';
import { Contact, MessageTemplate, SheetConfig } from './types';
import { ContactCard } from './components/ContactCard';
import { MessageGeneratorModal } from './components/MessageGeneratorModal';
import { ImportModal } from './components/ImportModal';
import { EditContactModal } from './components/EditContactModal';
import { AdminModal } from './components/AdminModal';
import { NotificationPanel } from './components/NotificationPanel';
import { Button } from './components/Button';
import { fetchContactsFromSheet } from './services/sheetService';
import { 
    getAllContacts, saveContact, deleteContact, saveBulkContacts, 
    getAllTemplates, saveBulkTemplates, clearAllData, getSheetConfig, clearContacts 
} from './services/dbService';
import { Search, Plus, Users, Settings, Shield, RefreshCw, Filter, Sparkles, Database, Bell } from 'lucide-react';

// Initial dummy data (Fallback if DB is empty)
const INITIAL_DATA_FALLBACK: Contact[] = [
  { id: '1', name: 'Ibu Siti Aminah', phone: '081299998888', segment: 'Platinum', sentra: 'Mawar Indah', lastInteraction: '12 Okt 2023', notes: 'Ketua Sentra', tglJatuhTempo: '25' },
  { id: '2', name: 'Ibu Ratna', phone: '081377776666', segment: 'Gold', sentra: 'Melati Putih', lastInteraction: '20 Okt 2023', notes: 'Rajin hadir PRS', tglJatuhTempo: '5' },
  { id: '3', name: 'Ibu Yanti', phone: '085655554444', segment: 'Prospect', sentra: 'Anggrek', lastInteraction: 'Kemarin', notes: 'Baru tanya pembiayaan' },
];

const INITIAL_TEMPLATES_FALLBACK: MessageTemplate[] = [
  { id: '1', label: 'Pengingat PRS', type: 'ai', promptContext: 'Ingatkan Ibu nasabah untuk hadir di Pertemuan Rutin Sentra (PRS) besok. Sampaikan pentingnya kehadiran untuk tepat waktu.', icon: '👥' },
  { id: '2', label: 'Info Angsuran', type: 'ai', promptContext: 'Ingatkan dengan sopan mengenai angsuran yang akan jatuh tempo. Tekankan prinsip "Tepat Jumlah, Tepat Waktu" dengan bahasa yang mengayomi.', icon: '💰' },
  { id: '3', label: 'Undangan (Manual)', type: 'manual', content: 'Assalamualaikum Ibu {name}, besok ada kunjungan dari pusat di sentra {sentra}. Diharapkan kehadirannya ya Bu. Terima kasih.', icon: '📩' },
  { id: '4', label: 'Penawaran Modal', type: 'ai', promptContext: 'Tawarkan penambahan modal usaha untuk nasabah dengan rekam jejak baik. Fokus pada pengembangan usaha Ibu.', icon: '📈' },
  { id: '5', label: 'Sapaan Silaturahmi', type: 'manual', content: 'Assalamualaikum Ibu {name}, semoga usaha Ibu di sentra {sentra} semakin lancar ya. Jika ada kendala, jangan sungkan hubungi saya.', icon: '🤝' },
];

const App: React.FC = () => {
  // State: Data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // State: UI & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSentra, setSelectedSentra] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialTemplateId, setInitialTemplateId] = useState<string | undefined>(undefined);
  
  // State: Modals & Panels
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Load Data on Mount
  useEffect(() => {
    const loadData = async () => {
        setIsLoadingData(true);
        try {
            const [dbContacts, dbTemplates] = await Promise.all([
                getAllContacts(),
                getAllTemplates()
            ]);

            // If empty, initialize with fallbacks and save to DB
            if (dbContacts.length === 0) {
                await saveBulkContacts(INITIAL_DATA_FALLBACK);
                setContacts(INITIAL_DATA_FALLBACK);
            } else {
                setContacts(dbContacts);
            }

            if (dbTemplates.length === 0) {
                await saveBulkTemplates(INITIAL_TEMPLATES_FALLBACK);
                setTemplates(INITIAL_TEMPLATES_FALLBACK);
            } else {
                setTemplates(dbTemplates);
            }
        } catch (e) {
            console.error("Failed to load DB:", e);
        } finally {
            setIsLoadingData(false);
        }
    };
    loadData();
  }, []);

  // --- Notification Logic ---
  const dueContacts = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();

    // Helper to calculate days difference accurately handling month overflow
    const getDaysDiff = (targetDay: number) => {
        let targetDate = new Date(currentYear, currentMonth, targetDay);
        
        // If target day is less than today, assume it refers to next month? 
        // Or if strictly tracking strictly within 'this month'?
        // Context: 'Jatuh Tempo' usually implies a recurring monthly date.
        // If today is 28th and due date is 2nd, that means it's coming up in ~4 days.
        
        if (targetDate.getTime() < today.setHours(0,0,0,0)) {
             // If date has passed this month, check if it's coming soon next month
             targetDate = new Date(currentYear, currentMonth + 1, targetDay);
        }

        const diffTime = targetDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    };

    const upcoming: Array<{ contact: Contact; status: 'today' | 'soon'; daysLeft: number }> = [];

    contacts.forEach(c => {
        if (!c.tglJatuhTempo) return;
        
        // Extract number from string (e.g., "25" or "tgl 25")
        const match = c.tglJatuhTempo.match(/\d+/);
        if (!match) return;
        
        const dueDay = parseInt(match[0], 10);
        if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) return;

        const diff = getDaysDiff(dueDay);

        if (diff === 0) {
            upcoming.push({ contact: c, status: 'today', daysLeft: 0 });
        } else if (diff > 0 && diff <= 3) {
            upcoming.push({ contact: c, status: 'soon', daysLeft: diff });
        }
    });

    return upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [contacts]);


  // Get Unique Sentras
  const sentraOptions = Array.from(new Set(contacts.map(c => c.sentra).filter(Boolean))).sort();

  // Handlers
  const handleImport = async (newContacts: Contact[]) => {
    await saveBulkContacts(newContacts);
    // Refresh local state by appending (optimization: instead of refetching all)
    setContacts(prev => [...newContacts, ...prev]);
  };

  const handleUpdateContact = async (updated: Contact) => {
    await saveContact(updated);
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleDeleteContact = async (id: string) => {
    await deleteContact(id);
    setContacts(prev => prev.filter(c => c.id !== id));
  };
  
  const handleResetData = async () => {
    await clearAllData();
    // Re-seed
    await saveBulkContacts(INITIAL_DATA_FALLBACK);
    await saveBulkTemplates(INITIAL_TEMPLATES_FALLBACK);
    
    setContacts(INITIAL_DATA_FALLBACK);
    setTemplates(INITIAL_TEMPLATES_FALLBACK);
    
    // Clear config
    alert("Data berhasil di-reset ke pengaturan awal.");
  };

  const handleUpdateTemplates = async (newTemplates: MessageTemplate[]) => {
      await saveBulkTemplates(newTemplates); 
      setTemplates(newTemplates);
  };
  
  useEffect(() => {
      if (!isLoadingData && templates.length > 0) {
          saveBulkTemplates(templates);
      }
  }, [templates, isLoadingData]);

  const handleTestTemplate = (templateId: string) => {
      let sampleContact: Contact;
      if (contacts.length > 0) {
          sampleContact = contacts[0];
      } else {
          sampleContact = {
            id: 'test',
            name: 'Ibu Siti (Contoh)',
            phone: '08123456789',
            segment: 'Gold',
            sentra: 'Pusat'
          };
      }
      setSelectedContact(sampleContact);
      setInitialTemplateId(templateId);
  };

  const handleBulkTemplateUpdate = (mode: 'ai' | 'manual') => {
      setTemplates(prev => {
          const updated = prev.map(t => ({
            ...t,
            type: mode,
            promptContext: mode === 'ai' && !t.promptContext ? 'Buat pesan ramah untuk nasabah.' : t.promptContext,
            content: mode === 'manual' && !t.content ? 'Halo {name}, apa kabar?' : t.content
          }));
          return updated;
      });
  };

  const handleSyncSheet = async () => {
    const config = await getSheetConfig();
    
    if (!config || !config.spreadsheetId) {
        alert("Konfigurasi Google Sheet belum diatur. Silakan ke Menu Admin.");
        setIsAdminModalOpen(true);
        return;
    }

    if (window.confirm("Sync akan mengambil data dari Google Sheet dan menggabungkan dengan database lokal. Lanjutkan?")) {
        setIsSyncing(true);
        try {
            const sheetContacts = await fetchContactsFromSheet(config.spreadsheetId, config.sheetName);
            
            // Normalize phone number for comparison
            const normalizePhone = (p: string) => p.replace(/[^0-9]/g, '');

            const currentContacts = await getAllContacts();
            const phoneMap = new Map<string, Contact>();
            
            // Map existing
            currentContacts.forEach(c => phoneMap.set(normalizePhone(c.phone), c));
            
            let newCount = 0;
            let updatedCount = 0;

            // Merge logic
            sheetContacts.forEach(sc => {
                const cleanPhone = normalizePhone(sc.phone);
                if (!cleanPhone) return;

                const existing = phoneMap.get(cleanPhone);
                if (existing) {
                    phoneMap.set(cleanPhone, { ...existing, ...sc, id: existing.id });
                    updatedCount++;
                } else {
                    phoneMap.set(cleanPhone, sc);
                    newCount++;
                }
            });
            
            const mergedList = Array.from(phoneMap.values());
            
            await saveBulkContacts(mergedList);
            setContacts(mergedList);
            
            alert(`Sync Selesai!\nTotal: ${mergedList.length}\nBaru: ${newCount}\nUpdate: ${updatedCount}`);
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
    <div className="min-h-screen pb-20 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-900 to-black text-white">
      
      {/* Floating Glass Header */}
      <div className="sticky top-4 z-30 px-4 mb-8">
        <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-4 sm:p-5 relative">
            
            {/* Notification Panel Component */}
            <NotificationPanel 
                isOpen={isNotificationOpen} 
                onClose={() => setIsNotificationOpen(false)}
                dueContacts={dueContacts}
                onRemind={(c) => {
                    // Find 'Info Angsuran' template or use first available
                    const template = templates.find(t => t.label.toLowerCase().includes('angsuran')) || templates[0];
                    setSelectedContact(c);
                    if(template) setInitialTemplateId(template.id);
                }}
            />

            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-cyan-500/30">
                        <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">NasaLink</h1>
                        <p className="text-xs text-cyan-200 font-medium tracking-wide uppercase">Database: IndexedDB</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Notification Bell */}
                    <button 
                        onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                        className={`relative p-2.5 rounded-xl transition-all ${
                            isNotificationOpen ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <Bell className="w-5 h-5" />
                        {dueContacts.length > 0 && (
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
                        )}
                    </button>

                    <Button 
                        size="sm" 
                        variant="glass" 
                        onClick={handleSyncSheet}
                        isLoading={isSyncing}
                        className="hidden sm:flex"
                        icon={<RefreshCw className="w-4 h-4"/>}
                    >
                        Sync
                    </Button>
                    <Button
                        size="sm"
                        variant="glass"
                        onClick={() => setIsAdminModalOpen(true)}
                        className="hidden sm:flex"
                        icon={<Shield className="w-4 h-4" />}
                    >
                        Menu Admin
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-5 h-5 group-focus-within:text-cyan-400 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Cari nama Ibu, sentra, atau segmen..." 
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-black/20 text-white placeholder-white/30 focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent focus:bg-black/40 transition-all backdrop-blur-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-2">
                     {/* Sentra Filter */}
                    <div className="relative min-w-[140px] group">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4 group-focus-within:text-cyan-400 transition-colors" />
                        <select
                            value={selectedSentra}
                            onChange={(e) => setSelectedSentra(e.target.value)}
                            className="w-full pl-9 pr-8 py-3 rounded-xl border border-white/10 bg-black/20 text-white appearance-none text-sm focus:ring-2 focus:ring-cyan-400/50 focus:bg-black/40 transition-all backdrop-blur-sm cursor-pointer"
                        >
                            <option value="" className="bg-slate-800 text-white">Semua Sentra</option>
                            {sentraOptions.map(s => (
                                <option key={s} value={String(s)} className="bg-slate-800 text-white">{s}</option>
                            ))}
                        </select>
                        {/* Custom arrow */}
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-white/40">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <Button 
                        onClick={handleSyncSheet}
                        variant="glass"
                        className="sm:hidden px-3"
                        isLoading={isSyncing}
                    >
                        <RefreshCw className="w-5 h-5" />
                    </Button>

                    <Button 
                        onClick={() => setIsAdminModalOpen(true)}
                        variant="glass"
                        className="sm:hidden px-3"
                    >
                        <Settings className="w-5 h-5" />
                    </Button>

                    <Button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="whitespace-nowrap shadow-[0_0_15px_rgba(6,182,212,0.3)]"
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
      <div className="max-w-3xl mx-auto px-4">
        <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
                <h2 className="text-xs font-bold text-cyan-200/70 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    Daftar Nasabah {selectedSentra ? `- ${selectedSentra}` : ''} ({filteredContacts.length})
                </h2>
            </div>
            
            {isLoadingData ? (
                 <div className="text-center py-20">
                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                     <p className="text-white/50 animate-pulse">Memuat Database...</p>
                 </div>
            ) : filteredContacts.length === 0 ? (
                <div className="text-center py-16 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 border-dashed">
                    <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-4 text-white/30">
                        <Users className="w-8 h-8" />
                    </div>
                    <p className="text-white/50 mb-6 font-medium">Tidak ada nasabah ditemukan.</p>
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
                            onEditClick={setContactToEdit}
                            onGenerateClick={setSelectedContact}
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
            onClose={() => {
                setSelectedContact(null);
                setInitialTemplateId(undefined);
            }}
            templates={templates}
            initialTemplateId={initialTemplateId}
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
        onUpdateTemplates={handleUpdateTemplates}
        onResetData={handleResetData}
        onTestTemplate={handleTestTemplate}
        onBulkUpdateMode={handleBulkTemplateUpdate}
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