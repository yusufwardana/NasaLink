import React, { useState, useEffect, useMemo } from 'react';
import { Contact, MessageTemplate, SheetConfig } from './types';
import { ContactCard } from './components/ContactCard';
import { MessageGeneratorModal } from './components/MessageGeneratorModal';
import { EditContactModal } from './components/EditContactModal';
import { AdminModal } from './components/AdminModal';
import { NotificationPanel, NotificationItem } from './components/NotificationPanel';
import { BroadcastPanel } from './components/BroadcastPanel';
import { Button } from './components/Button';
import { fetchContactsFromSheet } from './services/sheetService';
import { fetchTemplatesFromSupabase, fetchSettingsFromSupabase, isSupabaseConfigured } from './services/supabaseService';
import { GLOBAL_CONFIG } from './config';
import { Search, Users, Settings, RefreshCw, Bell, Briefcase, MapPin, HeartHandshake, ChevronDown, AlertTriangle, Home, Loader2, Download, X, Radio } from 'lucide-react';

// Fallback templates updated to reflect NEW logic (Refinancing focus)
const INITIAL_TEMPLATES_FALLBACK: MessageTemplate[] = [
  { id: '1', label: 'Pengingat PRS', type: 'ai', promptContext: 'Ingatkan Ibu nasabah untuk hadir di Pertemuan Rutin Sentra (PRS) besok. Sampaikan pentingnya kehadiran untuk tepat waktu.', icon: '👥' },
  { id: '2', label: 'Tawaran Lanjut (Cair)', type: 'ai', promptContext: 'Ucapkan selamat karena angsuran nasabah akan segera lunas (Jatuh Tempo). Tawarkan kesempatan untuk pengajuan pembiayaan kembali (tambah modal) untuk pengembangan usaha.', icon: '💰' },
  { id: '3', label: 'Undangan (Manual)', type: 'manual', content: 'Assalamualaikum Ibu {name}, besok ada kunjungan dari pusat di sentra {sentra}. Diharapkan kehadirannya ya Bu. Terima kasih.', icon: '📩' },
  { id: '4', label: 'Penawaran Modal', type: 'ai', promptContext: 'Tawarkan penambahan modal usaha untuk nasabah dengan rekam jejak baik. Fokus pada pengembangan usaha Ibu.', icon: '📈' },
  { id: '5', label: 'Sapaan Silaturahmi', type: 'manual', content: 'Assalamualaikum Ibu {name}, semoga usaha Ibu di sentra {sentra} semakin lancar ya. Jika ada kendala, jangan sungkan hubungi saya.', icon: '🤝' },
];

type AppView = 'home' | 'notifications' | 'broadcast' | 'settings';

const App: React.FC = () => {
  // State: Data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [configError, setConfigError] = useState<boolean>(false);
  const [activeConfig, setActiveConfig] = useState<SheetConfig | null>(null);

  // State: UI & Navigation
  const [activeView, setActiveView] = useState<AppView>('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // Optimasi: Debounce
  const [selectedSentra, setSelectedSentra] = useState<string>('');
  const [selectedCo, setSelectedCo] = useState<string>('');
  
  // State: Modals
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialTemplateId, setInitialTemplateId] = useState<string | undefined>(undefined);
  
  // State: Pagination / Lazy Load
  const [visibleCount, setVisibleCount] = useState(50); // Hanya tampilkan 50 awal

  // State: PWA Install
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  // Derived State for UI Feedback
  const isFiltering = searchTerm !== debouncedSearchTerm;

  // --- 0. Debounce Logic for Search ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // Wait 500ms after user stops typing to reduce lag
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset pagination when filters change
  useEffect(() => {
      setVisibleCount(50);
  }, [debouncedSearchTerm, selectedSentra, selectedCo]);

  // --- 0.1 PWA Install Prompt Listener ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Check if not already in standalone mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!isStandalone) {
          setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };


  // --- 1. Load Data on Mount ---
  const loadData = async () => {
    setIsLoadingData(true);
    setConfigError(false);
    try {
        // 1. Fetch Config from Supabase OR Fallback to config.ts
        let finalConfig: SheetConfig = { ...GLOBAL_CONFIG };
        
        if (isSupabaseConfigured()) {
            try {
                const supabaseSettings = await fetchSettingsFromSupabase();
                if (supabaseSettings && supabaseSettings.spreadsheetId) {
                    finalConfig = { ...finalConfig, ...supabaseSettings };
                }
            } catch (err) {
                console.warn("Failed to load settings from Supabase, using local config.", err);
            }
        }
        
        setActiveConfig(finalConfig);

        if (finalConfig.spreadsheetId) {
            // Fetch LIVE Contacts from Google Sheet
            try {
                const liveContacts = await fetchContactsFromSheet(finalConfig.spreadsheetId, finalConfig.sheetName);
                setContacts(liveContacts);
            } catch (err) {
                console.error("Error fetching live contacts from Sheet:", err);
            }

            // Fetch LIVE Templates from SUPABASE
            try {
                if (isSupabaseConfigured()) {
                    const sbTemplates = await fetchTemplatesFromSupabase();
                    if (sbTemplates.length > 0) {
                        setTemplates(sbTemplates);
                    } else {
                         setTemplates(INITIAL_TEMPLATES_FALLBACK);
                    }
                } else {
                    setTemplates(INITIAL_TEMPLATES_FALLBACK);
                }
            } catch (err) {
                console.warn("Failed to load templates from Supabase, using fallback.", err);
                setTemplates(INITIAL_TEMPLATES_FALLBACK);
            }
        } else {
            setConfigError(true);
            setTemplates(INITIAL_TEMPLATES_FALLBACK);
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

  // --- Notification Logic (Refinancing M+1 & PRS H-1) ---
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Calculate Next Month Date
    const nextMonthDate = new Date(today);
    nextMonthDate.setMonth(currentMonth + 1);
    const nextMonth = nextMonthDate.getMonth();
    const nextMonthYear = nextMonthDate.getFullYear();

    // Helper: Parse DD/MM/YYYY or YYYY-MM-DD
    const parseFullDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        const clean = dateStr.trim();
        const partsIndo = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (partsIndo) {
            const day = parseInt(partsIndo[1], 10);
            const month = parseInt(partsIndo[2], 10) - 1; 
            const year = parseInt(partsIndo[3], 10);
            const d = new Date(year, month, day);
            if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
                return d;
            }
        }
        const parsed = Date.parse(clean);
        if (!isNaN(parsed)) return new Date(parsed);
        return null;
    };

    return contacts.reduce<NotificationItem[]>((acc, contact) => {
        // 1. Check Jatuh Tempo (Payment/Refinancing)
        if (contact.tglJatuhTempo) {
            const dueDate = parseFullDate(contact.tglJatuhTempo);
            
            if (dueDate) {
                const dueMonth = dueDate.getMonth();
                const dueYear = dueDate.getFullYear();
                let status: 'today' | 'soon' | 'this_month' | 'next_month' | null = null;
                
                if (dueYear === currentYear && dueMonth === currentMonth) {
                     if (dueDate.getDate() === today.getDate()) status = 'today';
                     else if (dueDate > today) status = 'this_month';
                } else if ((dueYear === nextMonthYear && dueMonth === nextMonth)) {
                    status = 'next_month';
                }

                if (status) {
                     const diffTime = dueDate.getTime() - today.getTime();
                     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                     acc.push({ contact, type: 'payment', status: status, daysLeft: diffDays });
                }
            }
        }

        // 2. Check PRS (Meeting)
        if (contact.tglPrs) {
             let prsDate: Date | null = null;
             if (contact.tglPrs.match(/^\d{1,2}$/)) {
                 const day = parseInt(contact.tglPrs);
                 prsDate = new Date(today.getFullYear(), today.getMonth(), day);
             } else {
                 prsDate = parseFullDate(contact.tglPrs);
             }

             if (prsDate) {
                 const diffTime = prsDate.getTime() - today.getTime();
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                 if (diffDays === 0) {
                     acc.push({ contact, type: 'prs', status: 'today', daysLeft: 0 });
                 } else if (diffDays === 1) {
                     acc.push({ contact, type: 'prs', status: 'soon', daysLeft: 1 });
                 }
             }
        }
        return acc;
    }, []).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [contacts]);


  // --- Filtering Logic ---
  const uniqueSentras = useMemo(() => {
    let sourceContacts = contacts;
    if (selectedCo) {
        sourceContacts = contacts.filter(c => (c.co || 'Unassigned') === selectedCo);
    }
    const sentras = new Set(sourceContacts.map(c => c.sentra || 'Unknown'));
    return Array.from(sentras).sort();
  }, [contacts, selectedCo]);

  const uniqueCos = useMemo(() => {
      const cos = new Set(contacts.map(c => c.co || 'Unassigned'));
      return Array.from(cos).sort();
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    if (!debouncedSearchTerm && !selectedSentra && !selectedCo) return [];
    return contacts.filter(contact => {
      const matchesSearch = 
        !debouncedSearchTerm || 
        contact.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        contact.phone.includes(debouncedSearchTerm);
      const matchesSentra = !selectedSentra || (contact.sentra || 'Unknown') === selectedSentra;
      const matchesCo = !selectedCo || (contact.co || 'Unassigned') === selectedCo;
      return matchesSearch && matchesSentra && matchesCo;
    });
  }, [contacts, debouncedSearchTerm, selectedSentra, selectedCo]);

  const visibleContacts = useMemo(() => {
      return filteredContacts.slice(0, visibleCount);
  }, [filteredContacts, visibleCount]);


  // --- Handlers ---
  const handleSyncSheet = async () => {
    setIsSyncing(true);
    setContacts([]); 
    try {
        await loadData();
    } catch (e) {
        alert("Gagal sinkronisasi. Cek koneksi internet.");
    } finally {
        setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
  };

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleAdminAuth = () => {
      const pin = prompt("Masukkan PIN Admin:");
      if (pin === '123456') {
          setActiveView('settings');
      } else if (pin !== null) {
          alert("PIN Salah");
      }
  };

  // --- Render Navigation ---
  const renderBottomNav = () => (
    <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 z-40 pb-safe">
        <div className="flex justify-around items-center p-2 max-w-md mx-auto">
            <button onClick={() => setActiveView('home')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'home' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <Home className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">Beranda</span>
            </button>
            <div className="relative">
                <button onClick={() => setActiveView('notifications')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'notifications' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                    <Bell className="w-5 h-5 mb-0.5" />
                    <span className="text-[10px] font-medium">Follow Up</span>
                </button>
                {upcomingEvents.length > 0 && (
                    <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </div>
            <button onClick={() => setActiveView('broadcast')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'broadcast' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <Radio className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">Siaran</span>
            </button>
            <button onClick={handleAdminAuth} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'settings' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <Settings className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">Setting</span>
            </button>
        </div>
    </div>
  );


  // --- Render Views ---

  // 1. Settings View (Admin)
  if (activeView === 'settings') {
      return (
          <>
            <AdminModal
                isOpen={true}
                onClose={() => setActiveView('home')}
                templates={templates}
                onUpdateTemplates={setTemplates}
                onResetData={async () => {
                    await loadData();
                    setActiveView('home');
                }}
            />
            {renderBottomNav()}
          </>
      );
  }

  // 2. Notification View
  if (activeView === 'notifications') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
            <NotificationPanel 
                items={upcomingEvents}
                onBack={() => setActiveView('home')}
                onRemind={(contact, type) => {
                    const templateName = type === 'payment' ? 'Tawaran Lanjut (Cair)' : 'Pengingat PRS';
                    const found = templates.find(t => t.label.toLowerCase().includes(templateName.toLowerCase()));
                    setInitialTemplateId(found?.id || templates[0]?.id);
                    setSelectedContact(contact);
                }}
            />
            {selectedContact && (
                <MessageGeneratorModal
                    contact={selectedContact}
                    isOpen={!!selectedContact}
                    onClose={() => setSelectedContact(null)}
                    templates={templates}
                    initialTemplateId={initialTemplateId}
                    apiKey={activeConfig?.geminiApiKey}
                />
            )}
            {renderBottomNav()}
        </div>
      );
  }

  // 3. Broadcast View
  if (activeView === 'broadcast') {
      return (
          <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
              <BroadcastPanel 
                contacts={contacts}
                templates={templates}
                onBack={() => setActiveView('home')}
                apiKey={activeConfig?.geminiApiKey}
              />
              {renderBottomNav()}
          </div>
      );
  }

  // 4. Home View
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 pb-24 relative">
      
      {/* PWA INSTALL BANNER */}
      {showInstallBanner && (
        <div className="bg-orange-600 text-white p-3 shadow-md relative z-50 animate-fade-in-up">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Download className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">Install B-Connect CRM</p>
                        <p className="text-xs text-orange-100">Lebih cepat & hemat kuota</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleInstallClick}
                        className="px-3 py-1.5 bg-white text-orange-700 rounded-lg text-xs font-bold shadow-sm hover:bg-orange-50 transition-colors"
                    >
                        Install
                    </button>
                    <button 
                        onClick={() => setShowInstallBanner(false)}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white/80" />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-2 rounded-xl shadow-lg shadow-orange-500/20 text-white">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">
                B-Connect <span className="text-orange-600">CRM</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Direktori Nasabah</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <Button 
                onClick={handleSyncSheet}
                size="sm"
                variant="outline"
                className="h-8 border-orange-200 text-orange-600 hover:bg-orange-50"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
            >
                {isSyncing ? 'Syncing' : 'Sync'}
            </Button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <div className="bg-gradient-to-b from-white to-orange-50 border-b border-orange-100">
          <div className="max-w-4xl mx-auto px-6 py-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  Assalamualaikum, <span className="text-orange-600">Pejuang Syariah</span>
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 max-w-lg">
                  Kelola data nasabah sentra dengan mudah. Gunakan filter di bawah untuk menemukan nasabah dan kirim pesan personalisasi.
              </p>
              
              <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Nasabah</p>
                      <p className="text-xl font-bold text-slate-800">{contacts.length}</p>
                  </div>
                   <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Sentra</p>
                      <p className="text-xl font-bold text-slate-800">{uniqueSentras.length}</p>
                  </div>
                   <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total CO</p>
                      <p className="text-xl font-bold text-slate-800">{uniqueCos.length}</p>
                  </div>
              </div>
          </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Filters */}
        <div className="sticky top-[68px] z-30 space-y-3 bg-white/50 backdrop-blur-xl p-3 rounded-2xl border border-white/40 shadow-sm">
           <div className="relative">
              <input
                type="text"
                placeholder="Cari nama nasabah atau no HP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm text-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
           </div>

           <div className="flex gap-2">
              <div className="relative flex-1">
                 <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                 <select
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:border-orange-500 appearance-none shadow-sm"
                    value={selectedCo}
                    onChange={(e) => {
                        setSelectedCo(e.target.value);
                        setSelectedSentra(''); // Reset Sentra when CO changes
                    }}
                 >
                    <option value="">Semua Petugas (CO)</option>
                    {uniqueCos.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
              </div>

              <div className="relative flex-1">
                 <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                 <select
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:border-orange-500 appearance-none shadow-sm"
                    value={selectedSentra}
                    onChange={(e) => setSelectedSentra(e.target.value)}
                 >
                    <option value="">Semua Sentra</option>
                    {uniqueSentras.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
              </div>
           </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[300px]">
            {isLoadingData || isSyncing ? (
                // Loading State
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 animate-fade-in-up">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
                    <p className="font-medium text-slate-600">Sedang menyinkronkan data...</p>
                    <p className="text-xs mt-1">Mengambil data terbaru dari BTPN Sheets</p>
                </div>
            ) : configError ? (
                // Error State
                <div className="text-center py-16 px-4 bg-white rounded-3xl border border-red-100 shadow-sm">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Konfigurasi Belum Sesuai</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
                        ID Spreadsheet belum diatur atau tidak valid. Silakan hubungi admin untuk melakukan setup awal.
                    </p>
                    <Button onClick={handleAdminAuth} variant="secondary">Buka Menu Admin</Button>
                </div>
            ) : filteredContacts.length > 0 ? (
                // List State
                <div className="space-y-4 animate-fade-in-up">
                    {/* Visual Loading Indicator for Filter */}
                    {isFiltering && (
                        <div className="flex items-center justify-center py-4 bg-orange-50/50 rounded-xl border border-orange-100 mb-4">
                            <Loader2 className="w-4 h-4 animate-spin text-orange-600 mr-2" />
                            <span className="text-xs font-bold text-orange-700">Memproses pencarian...</span>
                        </div>
                    )}

                    {visibleContacts.map(contact => (
                    <ContactCard
                        key={contact.id}
                        contact={contact}
                        onEditClick={setContactToEdit}
                        onGenerateClick={(c) => {
                            setSelectedContact(c);
                            setInitialTemplateId(undefined); // Reset specific template
                        }}
                    />
                    ))}

                    {/* Pagination Button */}
                    {visibleCount < filteredContacts.length && (
                        <div className="flex justify-center pt-4 pb-12">
                            <Button 
                                variant="secondary" 
                                onClick={() => setVisibleCount(prev => prev + 50)}
                                className="w-full shadow-sm"
                                icon={<ChevronDown className="w-4 h-4" />}
                            >
                                Tampilkan Lebih Banyak ({filteredContacts.length - visibleCount})
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                // Empty State with Filters
                <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-slate-300" />
                    </div>
                    {debouncedSearchTerm || selectedSentra || selectedCo ? (
                         <>
                            <h3 className="text-lg font-bold text-slate-600">Tidak ada nasabah ditemukan</h3>
                            <p className="text-slate-400 text-sm">Coba sesuaikan filter pencarian Anda.</p>
                         </>
                    ) : (
                         <>
                            <h3 className="text-lg font-bold text-slate-600">Siap Mencari?</h3>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                Ketik nama, pilih Sentra, atau pilih CO di atas untuk menampilkan data nasabah.
                            </p>
                         </>
                    )}
                     <div className="mt-6">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleSyncSheet}
                            icon={<RefreshCw className="w-3.5 h-3.5" />}
                        >
                            Coba Sinkron Ulang
                        </Button>
                    </div>
                </div>
            )}
        </div>
      </main>

      {/* Modals */}
      {selectedContact && (
        <MessageGeneratorModal
          contact={selectedContact}
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          templates={templates}
          initialTemplateId={initialTemplateId}
          apiKey={activeConfig?.geminiApiKey}
        />
      )}

      <EditContactModal
        contact={contactToEdit}
        isOpen={!!contactToEdit}
        onClose={() => setContactToEdit(null)}
        onSave={handleUpdateContact}
        onDelete={handleDeleteContact}
        sheetConfig={activeConfig}
      />

      {renderBottomNav()}
    </div>
  );
};

export default App;