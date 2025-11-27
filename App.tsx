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
    getAllTemplates, saveBulkTemplates, clearAllData, getSheetConfig 
} from './services/dbService';
import { GLOBAL_CONFIG } from './config';
import { Search, Plus, Users, Settings, Shield, RefreshCw, Filter, Sparkles, Bell, CloudLightning, Globe } from 'lucide-react';

// Fallback templates only
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
  const [configError, setConfigError] = useState<boolean>(false);
  const [isGlobalMode, setIsGlobalMode] = useState(false);

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

  // --- 1. Load Data on Mount (Direct from Sheet) ---
  const loadData = async () => {
    setIsLoadingData(true);
    setConfigError(false);
    try {
        // A. Load Templates from Local DB (User preferences)
        const dbTemplates = await getAllTemplates();
        if (dbTemplates.length === 0) {
            await saveBulkTemplates(INITIAL_TEMPLATES_FALLBACK);
            setTemplates(INITIAL_TEMPLATES_FALLBACK);
        } else {
            setTemplates(dbTemplates);
        }

        // B. Determine Configuration (Global Hardcoded vs Local DB)
        let config: SheetConfig | null = null;

        // 1. Check Global Config first
        if (GLOBAL_CONFIG.spreadsheetId && GLOBAL_CONFIG.spreadsheetId.trim() !== '') {
            config = GLOBAL_CONFIG;
            setIsGlobalMode(true);
        } else {
            // 2. Fallback to Local DB
            config = await getSheetConfig();
            setIsGlobalMode(false);
        }
        
        if (config && config.spreadsheetId) {
            // Fetch LIVE data
            try {
                const liveContacts = await fetchContactsFromSheet(config.spreadsheetId, config.sheetName);
                setContacts(liveContacts);
            } catch (err) {
                console.error("Error fetching live data:", err);
                alert("Gagal mengambil data Live dari Google Sheets. Periksa koneksi internet atau ID Spreadsheet.");
            }
        } else {
            setConfigError(true);
        }
    } catch (e) {
        console.error("Failed to initialize:", e);
    } finally {
        setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Notification Logic ---
  const dueContacts = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();

    const getDaysUntilDayOfMonth = (targetDay: number) => {
        if (targetDay === currentDay) return 0;
        let targetDate = new Date(currentYear, currentMonth, targetDay);
        if (targetDay < currentDay) {
             targetDate = new Date(currentYear, currentMonth + 1, targetDay);
        }
        const diffTime = targetDate.getTime() - today.setHours(0,0,0,0);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    };

    const upcoming: Array<{ contact: Contact; status: 'today' | 'soon'; daysLeft: number }> = [];

    contacts.forEach(c => {
        if (!c.tglJatuhTempo) return;
        let targetDay: number | null = null;
        const cleanDate = c.tglJatuhTempo.trim();
        
        if (/^\d{1,2}$/.test(cleanDate)) {
            const day = parseInt(cleanDate, 10);
            if (day >= 1 && day <= 31) targetDay = day;
        } else {
            const parsed = Date.parse(cleanDate);
            if (!isNaN(parsed)) {
                const d = new Date(parsed);
                targetDay = d.getDate();
            } else {
                const match = cleanDate.match(/(\d+)/);
                if (match) {
                     const day = parseInt(match[0], 10);
                     if (day >= 1 && day <= 31) targetDay = day;
                }
            }
        }

        if (targetDay !== null) {
            const diff = getDaysUntilDayOfMonth(targetDay);
            if (diff === 0) {
                upcoming.push({ contact: c, status: 'today', daysLeft: 0 });
            } else if (diff > 0 && diff <= 3) {
                upcoming.push({ contact: c, status: 'soon', daysLeft: diff });
            }
        }
    });

    return upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [contacts]);


  // Get Unique Sentras
  const sentraOptions = Array.from(new Set(contacts.map(c => c.sentra).filter(Boolean))).sort();

  // Handlers
  const handleImport = async (newContacts: Contact[]) => {
    // In Live Mode, Import only adds to temporary state
    alert("Dalam mode Live Sheet, data import manual hanya bersifat sementara. Harap masukkan data ke Google Sheets agar permanen.");
    setContacts(prev => [...newContacts, ...prev]);
  };

  const handleUpdateContact = async (updated: Contact) => {
    // In Live Mode, we only update React State
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleDeleteContact = async (id: string) => {
    // In Live Mode, we only update React State
    setContacts(prev => prev.filter(c => c.id !== id));
  };
  
  const handleResetData = async () => {
    await clearAllData();
    // Re-seed templates
    await saveBulkTemplates(INITIAL_TEMPLATES_FALLBACK);
    
    // If Global Config is active, we don't clear contacts, just refresh
    if (isGlobalMode) {
        alert("Data lokal direset. Mengambil ulang data dari Konfigurasi Global...");
        loadData();
    } else {
        setContacts([]);
        setTemplates(INITIAL_TEMPLATES_FALLBACK);
        setConfigError(true);
        alert("Aplikasi di-reset. Silakan masukkan ID Spreadsheet kembali.");
    }
  };

  const handleUpdateTemplates = async (newTemplates: MessageTemplate[]) => {
      await saveBulkTemplates(newTemplates); 
      setTemplates(newTemplates);
  };
  
  const handleTestTemplate = (templateId: string) => {
      let sampleContact: Contact;
      if (contacts.length > 0) {
          sampleContact = contacts[0];
      } else {
          sampleContact = {
            id: 'test',
            name: 'Ibu Siti (Contoh)',
            phone: '08123456789',
            flag: 'Gold',
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

  const handleRefreshSheet = async () => {
    let config: SheetConfig | null = isGlobalMode ? GLOBAL_CONFIG : await getSheetConfig();
    
    if (!config || !config.spreadsheetId) {
        alert("Konfigurasi Google Sheet belum diatur. Silakan ke Menu Admin.");
        setIsAdminModalOpen(true);
        return;
    }

    setIsSyncing(true);
    try {
        const liveContacts = await fetchContactsFromSheet(config.spreadsheetId, config.sheetName);
        setContacts(liveContacts);
        setConfigError(false);
        // We do NOT save to DB anymore. Live only.
    } catch (e: any) {
        console.error(e);
        alert(`Gagal mengambil data terbaru: ${e.message}`);
    } finally {
        setIsSyncing(false);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        (c.flag && c.flag.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.sentra && c.sentra.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSentra = selectedSentra ? c.sentra === selectedSentra : true;

    return matchesSearch && matchesSentra;
  });

  return (
    <div className="min-h-screen pb-20 text-slate-800">
      
      {/* Floating Glass Header */}
      <div className="sticky top-4 z-30 px-4 mb-8">
        <div className="max-w-3xl mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-4 sm:p-5 relative">
            
            {/* Notification Panel Component */}
            <NotificationPanel 
                isOpen={isNotificationOpen} 
                onClose={() => setIsNotificationOpen(false)}
                dueContacts={dueContacts}
                onRemind={(c) => {
                    const template = templates.find(t => t.label.toLowerCase().includes('angsuran')) || templates[0];
                    setSelectedContact(c);
                    if(template) setInitialTemplateId(template.id);
                }}
            />

            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-cyan-500/20">
                        <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">NasaLink</h1>
                        <div className="flex items-center gap-2">
                            {isGlobalMode ? (
                                <div className="flex items-center gap-1 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100">
                                    <Globe className="w-3 h-3 text-cyan-600" />
                                    <p className="text-[10px] text-cyan-700 font-bold tracking-wide uppercase">Global Mode</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <CloudLightning className="w-3 h-3 text-green-600" />
                                    <p className="text-[10px] text-green-700 font-bold tracking-wide uppercase">Live Sheet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Notification Bell */}
                    <button 
                        onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                        className={`relative p-2.5 rounded-xl transition-all ${
                            isNotificationOpen ? 'bg-cyan-50 text-cyan-600' : 'bg-transparent text-slate-500 hover:text-cyan-600 hover:bg-slate-100'
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
                        onClick={handleRefreshSheet}
                        isLoading={isSyncing}
                        className="hidden sm:flex"
                        icon={<RefreshCw className="w-4 h-4"/>}
                    >
                        Refresh
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-cyan-600 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Cari nama Ibu, sentra, atau flag..." 
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 focus:bg-white transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-2">
                     {/* Sentra Filter */}
                    <div className="relative min-w-[140px] group">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-cyan-600 transition-colors" />
                        <select
                            value={selectedSentra}
                            onChange={(e) => setSelectedSentra(e.target.value)}
                            className="w-full pl-9 pr-8 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 appearance-none text-sm focus:ring-2 focus:ring-cyan-500/30 focus:bg-white transition-all cursor-pointer outline-none"
                        >
                            <option value="" className="bg-white text-slate-800">Semua Sentra</option>
                            {sentraOptions.map(s => (
                                <option key={s} value={String(s)} className="bg-white text-slate-800">{s}</option>
                            ))}
                        </select>
                        {/* Custom arrow */}
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-400">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <Button 
                        onClick={handleRefreshSheet}
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

                    {/* Hide "Add Manual" on Mobile mostly, prioritized sheet */}
                    <Button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="whitespace-nowrap shadow-lg shadow-cyan-500/20"
                        variant='secondary'
                        icon={<Plus className="w-5 h-5" />}
                    >
                        <span className="hidden sm:inline">Tambah</span>
                        <span className="sm:hidden">+</span>
                    </Button>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live Data {selectedSentra ? `- ${selectedSentra}` : ''} ({filteredContacts.length})
                </h2>
            </div>
            
            {isLoadingData ? (
                 <div className="text-center py-20">
                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                     <p className="text-slate-500 animate-pulse">Mengambil data dari Google Sheets...</p>
                 </div>
            ) : filteredContacts.length === 0 ? (
                <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                        <Users className="w-8 h-8" />
                    </div>
                    {configError ? (
                         <>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Belum Terhubung</h3>
                            <p className="text-slate-500 mb-6 font-medium px-6">Hubungkan aplikasi dengan Google Sheet Anda di menu Admin untuk melihat data secara Live.</p>
                            <Button variant="primary" onClick={() => setIsAdminModalOpen(true)}>
                                Buka Pengaturan
                            </Button>
                         </>
                    ) : (
                        <>
                            <p className="text-slate-500 mb-2 font-medium">Tidak ada nasabah ditemukan di Sheet ini.</p>
                            <p className="text-xs text-slate-400">Pastikan format kolom di Sheet sudah sesuai.</p>
                        </>
                    )}
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