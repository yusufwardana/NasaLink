import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Search, Plus, Users, Settings, Shield, RefreshCw, Filter, Sparkles, Bell, CloudLightning, Globe, Briefcase, MapPin, HeartHandshake, Database, ChevronDown } from 'lucide-react';

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
  const [activeConfig, setActiveConfig] = useState<SheetConfig | null>(null);

  // State: UI & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // Optimasi: Debounce
  const [selectedSentra, setSelectedSentra] = useState<string>('');
  const [selectedCo, setSelectedCo] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialTemplateId, setInitialTemplateId] = useState<string | undefined>(undefined);
  
  // State: Pagination / Lazy Load
  const [visibleCount, setVisibleCount] = useState(50); // Hanya tampilkan 50 awal
  
  // State: Modals & Panels
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // --- 0. Debounce Logic for Search ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // Wait 300ms after user stops typing
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset pagination when filters change
  useEffect(() => {
      setVisibleCount(50);
  }, [debouncedSearchTerm, selectedSentra, selectedCo]);


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
        
        setActiveConfig(config);

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


  // 1. Get Unique COs (Primary Filter)
  const coOptions = useMemo(() => {
      return Array.from(new Set(contacts.map(c => c.co).filter(Boolean))).sort();
  }, [contacts]);

  // 2. Get Sentra Options (Dependent on CO)
  const sentraOptions = useMemo(() => {
      // Filter contacts based on selected CO first
      const sourceContacts = selectedCo 
        ? contacts.filter(c => c.co === selectedCo)
        : contacts;
      
      return Array.from(new Set(sourceContacts.map(c => c.sentra).filter(Boolean))).sort();
  }, [contacts, selectedCo]);

  // Handlers
  const handleCoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCo = e.target.value;
      setSelectedCo(newCo);
      setSelectedSentra(''); // Reset Sentra when CO changes to avoid mismatch
  };

  const handleImport = async (newContacts: Contact[]) => {
    alert("Dalam mode Live Sheet, data import manual hanya bersifat sementara. Harap masukkan data ke Google Sheets agar permanen.");
    setContacts(prev => [...newContacts, ...prev]);
  };

  // useCallback to prevent re-creation on every render
  const handleUpdateContact = useCallback(async (updated: Contact) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  }, []);

  const handleDeleteContact = useCallback(async (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);
  
  const handleResetData = async () => {
    await clearAllData();
    await saveBulkTemplates(INITIAL_TEMPLATES_FALLBACK);
    
    if (isGlobalMode) {
        alert("Data lokal direset. Mengambil ulang data dari Konfigurasi Global...");
        loadData();
    } else {
        setContacts([]);
        setTemplates(INITIAL_TEMPLATES_FALLBACK);
        setConfigError(true);
        setActiveConfig(null);
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
    setActiveConfig(config);

    if (!config || !config.spreadsheetId) {
        alert("Konfigurasi Google Sheet belum diatur. Silakan ke Menu Admin.");
        setIsAdminModalOpen(true);
        return;
    }

    setIsSyncing(true);
    setContacts([]); // Clear data briefly to show fresh load
    try {
        const liveContacts = await fetchContactsFromSheet(config.spreadsheetId, config.sheetName);
        setContacts(liveContacts);
        setConfigError(false);
    } catch (e: any) {
        console.error(e);
        alert(`Gagal mengambil data terbaru: ${e.message}`);
    } finally {
        setIsSyncing(false);
    }
  };

  // Check if filtering is active
  const isFilterActive = debouncedSearchTerm.trim() !== '' || selectedSentra !== '' || selectedCo !== '';

  const filteredContacts = useMemo(() => {
      if (!isFilterActive) return []; // Don't filter/show if no filter active
      
      const term = debouncedSearchTerm.toLowerCase();

      return contacts.filter(c => {
        const matchesSearch = 
            (c.name && c.name.toLowerCase().includes(term)) ||
            (c.phone && c.phone.includes(term)) ||
            (c.flag && c.flag.toLowerCase().includes(term)) ||
            (c.sentra && c.sentra.toLowerCase().includes(term));
        
        const matchesSentra = selectedSentra ? c.sentra === selectedSentra : true;
        const matchesCo = selectedCo ? c.co === selectedCo : true;

        return matchesSearch && matchesSentra && matchesCo;
      });
  }, [contacts, debouncedSearchTerm, selectedSentra, selectedCo, isFilterActive]);

  // PAGINATION SLICE
  const displayedContacts = useMemo(() => {
      return filteredContacts.slice(0, visibleCount);
  }, [filteredContacts, visibleCount]);

  const handleLoadMore = () => {
      setVisibleCount(prev => prev + 50);
  };

  return (
    <div className="min-h-screen pb-20 text-slate-800">
      
      {/* Floating Glass Header */}
      <div className="sticky top-4 z-30 px-4 mb-8">
        <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-4 sm:p-5 relative transition-all">
            
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

            {/* Top Bar: Logo & Actions */}
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-cyan-500/20">
                        <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">NasaLink CRM</h1>
                        <div className="flex items-center gap-2">
                            {isGlobalMode ? (
                                <div className="flex items-center gap-1 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-100">
                                    <Globe className="w-3 h-3 text-cyan-600" />
                                    <p className="text-xs text-cyan-700 font-bold tracking-wide uppercase">Global Mode</p>
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
                    <button 
                        onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                        className={`relative p-2.5 rounded-xl transition-all ${
                            isNotificationOpen ? 'bg-cyan-50 text-cyan-600' : 'bg-transparent text-slate-500 hover:text-cyan-600 hover:bg-slate-100'
                        }`}
                        title="Notifikasi Jatuh Tempo"
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
                        className="hidden sm:flex text-cyan-700 font-semibold"
                        icon={<RefreshCw className="w-4 h-4"/>}
                    >
                        Sinkron Data
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
                    {/* Mobile Menu Buttons */}
                     <Button 
                        onClick={handleRefreshSheet}
                        variant="glass"
                        className="sm:hidden px-3"
                        isLoading={isSyncing}
                        title="Sinkron Data Terbaru"
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
                </div>
            </div>

            {/* Filter Controls Row */}
            <div className="flex flex-col md:flex-row gap-3">
                {/* Search Input */}
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
                
                <div className="flex gap-2 flex-col sm:flex-row">
                    {/* CO Filter (First Priority) */}
                    <div className="relative min-w-[160px] group flex-1 sm:flex-none">
                        <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-cyan-600 transition-colors" />
                        <select
                            value={selectedCo}
                            onChange={handleCoChange}
                            className="w-full pl-9 pr-8 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 appearance-none text-sm focus:ring-2 focus:ring-cyan-500/30 focus:bg-white transition-all cursor-pointer outline-none font-medium truncate"
                        >
                            <option value="" className="bg-white text-slate-500">Semua CO</option>
                            {coOptions.map(co => (
                                <option key={co} value={String(co)} className="bg-white text-slate-800">{co}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-400">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    {/* Sentra Filter (Dependent on CO) */}
                    <div className="relative min-w-[160px] group flex-1 sm:flex-none">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-cyan-600 transition-colors" />
                        <select
                            value={selectedSentra}
                            onChange={(e) => setSelectedSentra(e.target.value)}
                            className="w-full pl-9 pr-8 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 appearance-none text-sm focus:ring-2 focus:ring-cyan-500/30 focus:bg-white transition-all cursor-pointer outline-none font-medium truncate"
                        >
                            <option value="" className="bg-white text-slate-500">Semua Sentra</option>
                            {sentraOptions.map(s => (
                                <option key={s} value={String(s)} className="bg-white text-slate-800">{s}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-400">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <Button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="whitespace-nowrap shadow-lg shadow-cyan-500/20 hidden sm:flex"
                        variant='secondary'
                        icon={<Plus className="w-5 h-5" />}
                    >
                        Tambah
                    </Button>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4">
        
        {/* HERO SECTION / DESCRIPTION (Visible if no filter active or if searching) */}
        {!isFilterActive && contacts.length > 0 && (
            <div className="mb-8 animate-fade-in-up">
                <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
                    {/* Decorative Circles */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-400/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                    
                    <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">Selamat Datang di NasaLink CRM</h2>
                            <p className="text-cyan-50 text-sm sm:text-base leading-relaxed max-w-xl">
                                Aplikasi pendamping Community Officer (CO) BTPN Syariah untuk memanajemen data nasabah sentra, 
                                memantau jadwal jatuh tempo, dan membuat pesan WhatsApp personal otomatis dengan bantuan AI.
                            </p>
                            
                            <div className="mt-6 flex flex-wrap gap-4 justify-center sm:justify-start">
                                <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2 border border-white/20">
                                    <Users className="w-5 h-5 text-cyan-200" />
                                    <div>
                                        <p className="text-xs text-cyan-100 font-medium uppercase">Total Nasabah</p>
                                        <p className="font-bold text-lg">{contacts.length}</p>
                                    </div>
                                </div>
                                <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2 border border-white/20">
                                    <MapPin className="w-5 h-5 text-cyan-200" />
                                    <div>
                                        <p className="text-xs text-cyan-100 font-medium uppercase">Total Sentra</p>
                                        {/* Show ALL sentras here, unrelated to filter */}
                                        <p className="font-bold text-lg">{new Set(contacts.map(c=>c.sentra).filter(Boolean)).size}</p>
                                    </div>
                                </div>
                                <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2 border border-white/20">
                                    <Briefcase className="w-5 h-5 text-cyan-200" />
                                    <div>
                                        <p className="text-xs text-cyan-100 font-medium uppercase">Petugas CO</p>
                                        <p className="font-bold text-lg">{coOptions.length}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="hidden sm:block">
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/20 rotate-3 transform shadow-lg">
                                <HeartHandshake className="w-16 h-16 text-white/90" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="space-y-4">
            
            {/* Loading State */}
            {isLoadingData ? (
                 <div className="text-center py-20">
                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                     <p className="text-slate-500 animate-pulse">Mengambil data dari Google Sheets...</p>
                 </div>
            ) : configError ? (
                 <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                        <Database className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Belum Terhubung</h3>
                    <p className="text-slate-500 mb-6 font-medium px-6">Hubungkan aplikasi dengan Google Sheet Anda di menu Admin untuk melihat data secara Live.</p>
                    <Button variant="primary" onClick={() => setIsAdminModalOpen(true)}>
                        Buka Pengaturan
                    </Button>
                 </div>
            ) : (
                /* CONDITIONAL RENDERING BASED ON FILTER */
                !isFilterActive ? (
                    /* EMPTY STATE (Waiting for input) */
                    <div className="text-center py-12 px-6 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200/60 border-dashed animate-fade-in-up">
                         <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-cyan-100 to-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                             <Search className="w-10 h-10 text-cyan-500 opacity-80" />
                         </div>
                         <h3 className="text-xl font-bold text-slate-800 mb-2">Mulai Pencarian</h3>
                         <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                             Untuk menjaga performa aplikasi karena banyaknya data nasabah (3000+), daftar disembunyikan secara default.
                         </p>
                         <p className="text-sm font-semibold text-cyan-600 mt-2">
                             Silakan ketik Nama Nasabah, pilih Sentra, atau pilih CO pada kolom di atas untuk menampilkan data.
                         </p>
                    </div>
                ) : filteredContacts.length === 0 ? (
                    /* NOT FOUND STATE */
                    <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 border-dashed">
                        <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                            <Users className="w-8 h-8" />
                        </div>
                        <p className="text-slate-500 mb-2 font-medium">Tidak ada nasabah ditemukan sesuai pencarian.</p>
                        <Button variant="outline" onClick={handleRefreshSheet} isLoading={isSyncing} icon={<RefreshCw className="w-4 h-4"/>} className="mt-4">
                            Coba Sinkron Ulang
                        </Button>
                    </div>
                ) : (
                    /* LIST STATE (Results) */
                    <>
                        <div className="flex justify-between items-end px-2 animate-fade-in-up">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Hasil Pencarian 
                                {selectedCo ? ` • CO ${selectedCo}` : ''}
                                {selectedSentra ? ` • ${selectedSentra}` : ''} 
                                <span className="ml-1 bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                                    {filteredContacts.length}
                                </span>
                            </h2>
                        </div>
                        <div className="grid gap-4 animate-fade-in-up">
                            {displayedContacts.map(contact => (
                                <ContactCard 
                                    key={contact.id} 
                                    contact={contact} 
                                    onEditClick={setContactToEdit}
                                    onGenerateClick={setSelectedContact}
                                />
                            ))}
                        </div>
                        
                        {/* LOAD MORE BUTTON */}
                        {visibleCount < filteredContacts.length && (
                            <div className="flex justify-center mt-6 pb-10">
                                <Button 
                                    variant="secondary" 
                                    onClick={handleLoadMore}
                                    className="w-full sm:w-auto shadow-md"
                                    icon={<ChevronDown className="w-4 h-4" />}
                                >
                                    Tampilkan Lebih Banyak ({filteredContacts.length - visibleCount} tersisa)
                                </Button>
                            </div>
                        )}
                    </>
                )
            )}
        </div>
      </div>

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
        sheetConfig={activeConfig}
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