import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Contact, MessageTemplate, SheetConfig } from './types';
import { ContactCard } from './components/ContactCard';
import { MessageGeneratorModal } from './components/MessageGeneratorModal';
import { EditContactModal } from './components/EditContactModal';
import { AdminModal } from './components/AdminModal';
import { NotificationPanel, NotificationItem } from './components/NotificationPanel';
import { Button } from './components/Button';
import { fetchContactsFromSheet } from './services/sheetService';
import { fetchTemplatesFromSupabase, fetchSettingsFromSupabase, isSupabaseConfigured } from './services/supabaseService';
import { GLOBAL_CONFIG } from './config';
import { Search, Users, Settings, Shield, RefreshCw, Sparkles, Bell, Globe, Briefcase, MapPin, HeartHandshake, Database, ChevronDown, Server, AlertTriangle, Home } from 'lucide-react';

// Fallback templates updated to reflect NEW logic (Refinancing focus)
const INITIAL_TEMPLATES_FALLBACK: MessageTemplate[] = [
  { id: '1', label: 'Pengingat PRS', type: 'ai', promptContext: 'Ingatkan Ibu nasabah untuk hadir di Pertemuan Rutin Sentra (PRS) besok. Sampaikan pentingnya kehadiran untuk tepat waktu.', icon: '👥' },
  { id: '2', label: 'Tawaran Lanjut (Cair)', type: 'ai', promptContext: 'Ucapkan selamat karena angsuran nasabah akan segera lunas (Jatuh Tempo). Tawarkan kesempatan untuk pengajuan pembiayaan kembali (tambah modal) untuk pengembangan usaha.', icon: '💰' },
  { id: '3', label: 'Undangan (Manual)', type: 'manual', content: 'Assalamualaikum Ibu {name}, besok ada kunjungan dari pusat di sentra {sentra}. Diharapkan kehadirannya ya Bu. Terima kasih.', icon: '📩' },
  { id: '4', label: 'Penawaran Modal', type: 'ai', promptContext: 'Tawarkan penambahan modal usaha untuk nasabah dengan rekam jejak baik. Fokus pada pengembangan usaha Ibu.', icon: '📈' },
  { id: '5', label: 'Sapaan Silaturahmi', type: 'manual', content: 'Assalamualaikum Ibu {name}, semoga usaha Ibu di sentra {sentra} semakin lancar ya. Jika ada kendala, jangan sungkan hubungi saya.', icon: '🤝' },
];

type AppView = 'home' | 'notifications';

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
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialTemplateId, setInitialTemplateId] = useState<string | undefined>(undefined);
  
  // State: Pagination / Lazy Load
  const [visibleCount, setVisibleCount] = useState(50); // Hanya tampilkan 50 awal
  
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
                    console.log("Using Supabase Config");
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
    // Normalize today
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
        
        // Try format DD/MM/YYYY or DD-MM-YYYY
        const partsIndo = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (partsIndo) {
            const day = parseInt(partsIndo[1], 10);
            const month = parseInt(partsIndo[2], 10) - 1; // JS months 0-11
            const year = parseInt(partsIndo[3], 10);
            const d = new Date(year, month, day);
            if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
                return d;
            }
        }

        const parsed = Date.parse(clean);
        if (!isNaN(parsed)) {
            return new Date(parsed);
        }
        return null;
    };

    // Helper for PRS diff days
    const getDiffDays = (target: Date, base: Date): number => {
        const diffTime = target.getTime() - base.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const events: NotificationItem[] = [];

    contacts.forEach(c => {
        // 1. Check Jatuh Tempo (REFINANCING)
        // Logic: This Month or Next Month (M+1)
        if (c.tglJatuhTempo) {
            const targetDate = parseFullDate(c.tglJatuhTempo);
            
            if (targetDate) {
                const tMonth = targetDate.getMonth();
                const tYear = targetDate.getFullYear();

                // Check Current Month
                if (tMonth === currentMonth && tYear === currentYear) {
                     events.push({ 
                         contact: c, 
                         type: 'payment', 
                         status: 'this_month', 
                         daysLeft: 0 // Not relevant for monthly view
                     });
                } 
                // Check Next Month
                else if (tMonth === nextMonth && tYear === nextMonthYear) {
                    events.push({ 
                        contact: c, 
                        type: 'payment', 
                        status: 'next_month', 
                        daysLeft: 30 // Approximate
                    });
                }
            }
        }

        // 2. Check PRS (Logic: H-1 or Today)
        if (c.tglPrs) {
            let diff = -999;
            const fullDatePrs = parseFullDate(c.tglPrs);
            
            if (fullDatePrs) {
                 fullDatePrs.setHours(0,0,0,0);
                 diff = getDiffDays(fullDatePrs, today);
            } else {
                 // Logic for recurring day (e.g., "15" or "20")
                 const dayStr = c.tglPrs.trim();
                 if (/^\d{1,2}$/.test(dayStr)) {
                     const day = parseInt(dayStr, 10);
                     const currentDay = today.getDate();
                     
                     // Create PRS date for current month
                     const prsThisMonth = new Date(currentYear, currentMonth, day);
                     const diffThisMonth = getDiffDays(prsThisMonth, today);

                     // If PRS day hasn't passed or is today/tomorrow
                     if (diffThisMonth >= 0) {
                         diff = diffThisMonth;
                     } else {
                         // Check next month just in case today is 31st and PRS is 1st
                         const prsNextMonth = new Date(currentYear, currentMonth + 1, day);
                         diff = getDiffDays(prsNextMonth, today);
                     }
                 }
            }

            if (diff !== -999) {
                if (diff === 0) {
                    // Hari Ini (PRS Sedang Berlangsung)
                    events.push({ contact: c, type: 'prs', status: 'today', daysLeft: 0 });
                } else if (diff === 1) {
                    // H-1 (Besok PRS)
                    events.push({ contact: c, type: 'prs', status: 'soon', daysLeft: 1 });
                }
            }
        }
    });

    // Sort: Today first, then Soon, then This Month, then Next Month
    return events.sort((a, b) => {
        const score = (status: string) => {
            if (status === 'today') return 1;
            if (status === 'soon') return 2;
            if (status === 'this_month') return 3;
            if (status === 'next_month') return 4;
            return 5;
        };
        return score(a.status) - score(b.status);
    });
  }, [contacts]);


  const coOptions = useMemo(() => {
      return Array.from(new Set(contacts.map(c => c.co).filter(Boolean))).sort();
  }, [contacts]);

  const sentraOptions = useMemo(() => {
      const sourceContacts = selectedCo 
        ? contacts.filter(c => c.co === selectedCo)
        : contacts;
      return Array.from(new Set(sourceContacts.map(c => c.sentra).filter(Boolean))).sort();
  }, [contacts, selectedCo]);

  const handleCoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCo = e.target.value;
      setSelectedCo(newCo);
      setSelectedSentra('');
  };

  const handleOpenAdmin = () => {
      const pin = prompt("Masukkan PIN Admin untuk mengakses pengaturan:");
      if (pin === "123456") {
          setIsAdminModalOpen(true);
      } else {
          alert("Akses ditolak. PIN salah.");
      }
  };

  const handleUpdateContact = useCallback(async (updated: Contact) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  }, []);

  const handleDeleteContact = useCallback(async (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);
  
  const handleResetData = async () => {
    // Only fetch fresh data
    loadData();
    alert("Data di-refresh.");
  };

  const handleUpdateTemplates = async (newTemplates: MessageTemplate[]) => {
      // Optimistic update
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
    if (!activeConfig || !activeConfig.spreadsheetId) {
        alert("Konfigurasi Google Sheet belum diatur.");
        return;
    }

    setIsSyncing(true);
    setContacts([]); 
    try {
        const liveContacts = await fetchContactsFromSheet(activeConfig.spreadsheetId, activeConfig.sheetName);
        setContacts(liveContacts);
        
        // Refresh templates from Supabase
        if (isSupabaseConfigured()) {
            const sbTemplates = await fetchTemplatesFromSupabase();
            if (sbTemplates.length > 0) setTemplates(sbTemplates);
        }

        setConfigError(false);
    } catch (e: any) {
        console.error(e);
        alert(`Gagal mengambil data terbaru: ${e.message}`);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleHomeClick = () => {
      setActiveView('home');
      setSearchTerm('');
      setDebouncedSearchTerm('');
      setSelectedCo('');
      setSelectedSentra('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleNotificationClick = () => {
      setActiveView('notifications');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isFilterActive = debouncedSearchTerm.trim() !== '' || selectedSentra !== '' || selectedCo !== '';

  const filteredContacts = useMemo(() => {
      if (!isFilterActive) return [];
      
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

  const displayedContacts = useMemo(() => {
      return filteredContacts.slice(0, visibleCount);
  }, [filteredContacts, visibleCount]);

  const handleLoadMore = () => {
      setVisibleCount(prev => prev + 50);
  };

  return (
    <div className="min-h-screen pb-24 text-slate-800">
      
      {/* Floating Glass Header */}
      <div className="sticky top-4 z-30 px-4 mb-8">
        <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl rounded-3xl p-4 sm:p-5 relative transition-all">
            
            {/* Top Bar: Logo & Actions */}
            <div className={`flex justify-between items-center ${activeView === 'home' ? 'mb-6 border-b border-slate-100 pb-4' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="relative bg-gradient-to-br from-orange-500 to-amber-600 text-white p-2.5 rounded-xl shadow-lg shadow-orange-500/20">
                        <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">NasaLink CRM</h1>
                        <div className="flex items-center gap-2">
                             <div className="flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                                <Globe className="w-3 h-3 text-orange-600" />
                                <p className="text-xs text-orange-700 font-bold tracking-wide uppercase">Live Sheet</p>
                            </div>
                            {isSupabaseConfigured() ? (
                                <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                                    <Server className="w-3 h-3 text-green-600" />
                                    <p className="text-[10px] text-green-700 font-bold tracking-wide uppercase">Supabase On</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                                    <AlertTriangle className="w-3 h-3 text-red-600" />
                                    <p className="text-[10px] text-red-700 font-bold tracking-wide uppercase">Supabase Off</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Desktop Buttons (Hidden on Mobile) */}
                    <div className="hidden sm:flex items-center gap-2">
                        <button 
                            onClick={handleNotificationClick}
                            className={`relative p-2.5 rounded-xl transition-all ${
                                activeView === 'notifications' ? 'bg-orange-50 text-orange-600 shadow-inner' : 'bg-transparent text-slate-500 hover:text-orange-600 hover:bg-slate-100'
                            }`}
                            title="Notifikasi"
                        >
                            <Bell className="w-5 h-5" />
                            {upcomingEvents.length > 0 && (
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
                            )}
                        </button>

                        <Button 
                            size="sm" 
                            variant="glass" 
                            onClick={handleRefreshSheet}
                            isLoading={isSyncing}
                            className="text-orange-700 font-semibold"
                            icon={<RefreshCw className="w-4 h-4"/>}
                        >
                            Sinkron Data
                        </Button>
                        <Button
                            size="sm"
                            variant="glass"
                            onClick={handleOpenAdmin}
                            icon={<Shield className="w-4 h-4" />}
                        >
                            Menu Admin
                        </Button>
                    </div>
                </div>
            </div>

            {/* Filter Controls (Only shown on Home View) */}
            {activeView === 'home' && (
                <div className="flex flex-col md:flex-row gap-3 animate-fade-in-up">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-orange-600 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Cari nama Ibu, sentra, atau flag..." 
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 focus:bg-white transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2 flex-col sm:flex-row">
                        <div className="relative min-w-[160px] group flex-1 sm:flex-none">
                            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-orange-600 transition-colors" />
                            <select
                                value={selectedCo}
                                onChange={handleCoChange}
                                className="w-full pl-9 pr-8 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 appearance-none text-sm focus:ring-2 focus:ring-orange-500/30 focus:bg-white transition-all cursor-pointer outline-none font-medium truncate"
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

                        <div className="relative min-w-[160px] group flex-1 sm:flex-none">
                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-orange-600 transition-colors" />
                            <select
                                value={selectedSentra}
                                onChange={(e) => setSelectedSentra(e.target.value)}
                                className="w-full pl-9 pr-8 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 appearance-none text-sm focus:ring-2 focus:ring-orange-500/30 focus:bg-white transition-all cursor-pointer outline-none font-medium truncate"
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
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {activeView === 'notifications' ? (
        // NOTIFICATIONS VIEW
        <NotificationPanel 
            items={upcomingEvents}
            onBack={handleHomeClick}
            onRemind={(c, type) => {
                setSelectedContact(c);
                if (type === 'prs') {
                    const prsTemplate = templates.find(t => t.label.toLowerCase().includes('prs') || t.label.toLowerCase().includes('kumpulan'));
                    if (prsTemplate) setInitialTemplateId(prsTemplate.id);
                    else if (templates.length > 0) setInitialTemplateId(templates[0].id);
                } else {
                    const modalTemplate = templates.find(t => 
                        t.label.toLowerCase().includes('cair') || 
                        t.label.toLowerCase().includes('modal') || 
                        t.label.toLowerCase().includes('lanjut')
                    );
                    if (modalTemplate) setInitialTemplateId(modalTemplate.id);
                    else if (templates.length > 0) setInitialTemplateId(templates[0].id);
                }
            }}
        />
      ) : (
        // HOME VIEW (Search results & Hero)
        <div className="max-w-4xl mx-auto px-4">
            
            {!isFilterActive && contacts.length > 0 && (
                <div className="mb-8 animate-fade-in-up">
                    <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-400/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                        
                        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex-1 text-center sm:text-left">
                                <h2 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">Selamat Datang di NasaLink CRM</h2>
                                <p className="text-orange-50 text-sm sm:text-base leading-relaxed max-w-xl">
                                    Aplikasi pendamping Community Officer (CO) BTPN Syariah untuk memanajemen data nasabah sentra, 
                                    memantau jadwal jatuh tempo (peluang cair), dan membuat pesan WhatsApp personal otomatis dengan bantuan AI.
                                </p>
                                
                                <div className="mt-6 flex flex-wrap gap-4 justify-center sm:justify-start">
                                    <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2 border border-white/20">
                                        <Users className="w-5 h-5 text-orange-200" />
                                        <div>
                                            <p className="text-xs text-orange-100 font-medium uppercase">Total Nasabah</p>
                                            <p className="font-bold text-lg">{contacts.length}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2 border border-white/20">
                                        <MapPin className="w-5 h-5 text-orange-200" />
                                        <div>
                                            <p className="text-xs text-orange-100 font-medium uppercase">Total Sentra</p>
                                            <p className="font-bold text-lg">{new Set(contacts.map(c=>c.sentra).filter(Boolean)).size}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2 border border-white/20">
                                        <Briefcase className="w-5 h-5 text-orange-200" />
                                        <div>
                                            <p className="text-xs text-orange-100 font-medium uppercase">Petugas CO</p>
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
                {isLoadingData ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                        <p className="text-slate-500 animate-pulse">Mengambil data Global dari Google Sheets & Supabase...</p>
                    </div>
                ) : configError ? (
                    <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 border-dashed">
                        <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                            <Database className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Belum Terhubung</h3>
                        <p className="text-slate-500 mb-6 font-medium px-6">Hubungkan aplikasi dengan Google Sheet Anda di menu Admin untuk melihat data secara Live.</p>
                        <Button variant="primary" onClick={handleOpenAdmin}>
                            Buka Pengaturan
                        </Button>
                    </div>
                ) : (
                    !isFilterActive ? (
                        <div className="text-center py-12 px-6 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200/60 border-dashed animate-fade-in-up">
                            <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-orange-100 to-amber-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <Search className="w-10 h-10 text-orange-500 opacity-80" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Mulai Pencarian</h3>
                            <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                                Untuk menjaga performa aplikasi karena banyaknya data nasabah (3000+), daftar disembunyikan secara default.
                            </p>
                            <p className="text-sm font-semibold text-orange-600 mt-2">
                                Silakan ketik Nama Nasabah, pilih Sentra, atau pilih CO pada kolom di atas untuk menampilkan data.
                            </p>
                        </div>
                    ) : filteredContacts.length === 0 ? (
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
                        <>
                            <div className="flex justify-between items-end px-2 animate-fade-in-up">
                                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-50 animate-pulse"></span>
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
      )}

      {/* MOBILE BOTTOM NAVIGATION FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] sm:hidden">
          <div className="grid grid-cols-4 h-[72px]">
              <button 
                onClick={handleHomeClick}
                className="flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-orange-600 active:scale-95 transition-all"
              >
                  <div className={`p-1.5 rounded-xl ${activeView === 'home' ? 'bg-orange-50 text-orange-600' : ''}`}>
                    <Home className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-medium">Beranda</span>
              </button>

              <button 
                onClick={handleRefreshSheet}
                className="flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-orange-600 active:scale-95 transition-all"
              >
                  <div className={`p-1.5 rounded-xl ${isSyncing ? 'animate-spin text-orange-600' : ''}`}>
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-medium">Sinkron</span>
              </button>

              <button 
                onClick={handleNotificationClick}
                className="flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-orange-600 active:scale-95 transition-all relative"
              >
                  <div className={`p-1.5 rounded-xl ${activeView === 'notifications' ? 'bg-orange-50 text-orange-600' : ''}`}>
                    <Bell className="w-6 h-6" />
                    {upcomingEvents.length > 0 && (
                        <span className="absolute top-2 right-[25%] w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">Notifikasi</span>
              </button>

              <button 
                onClick={handleOpenAdmin}
                className="flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-orange-600 active:scale-95 transition-all"
              >
                  <div className={`p-1.5 rounded-xl ${isAdminModalOpen ? 'bg-orange-50 text-orange-600' : ''}`}>
                    <Settings className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-medium">Setting</span>
              </button>
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

    </div>
  );
};

export default App;