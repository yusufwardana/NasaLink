import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { Contact, MessageTemplate, SheetConfig, DailyPlan } from './types';
import { ContactCard } from './components/ContactCard';
import { MessageGeneratorModal } from './components/MessageGeneratorModal';
import { EditContactModal } from './components/EditContactModal';
// UPDATED IMPORT: Use AdminPanel logic (file name remains AdminModal.tsx for now to minimize file ops)
import { AdminPanel } from './components/AdminModal';
import { AdminLoginPanel } from './components/AdminLoginModal';
import { NotificationPanel, NotificationItem } from './components/NotificationPanel';
import { BroadcastPanel } from './components/BroadcastPanel';
import { DashboardPanel } from './components/DashboardPanel';
import { ContactManagementPanel } from './components/ContactManagementPanel';
import { TodoInputModal } from './components/TodoInputModal'; // New Import
import { Button } from './components/Button';
import { fetchContactsFromSheet, fetchPlansFromSheet, submitPlanToSheet } from './services/sheetService';
import { fetchTemplatesFromSupabase, fetchSettingsFromSupabase, isSupabaseConfigured, saveTemplatesToSupabase } from './services/supabaseService';
import { getSheetConfig } from './services/dbService';
import { GLOBAL_CONFIG } from './config';
import { Search, Users, Settings, Shield, RefreshCw, Sparkles, Bell, Globe, Briefcase, MapPin, HeartHandshake, Database, ChevronDown, Server, AlertTriangle, Home, Loader2, Download, X, Radio, Activity, TrendingUp, Contact as ContactIcon, ChevronRight, Calendar, AlertOctagon, Trophy, ClipboardList, PenTool } from 'lucide-react';

// REKOMENDASI TEMPLATE LENGKAP (CO BTPN SYARIAH KIT)
const INITIAL_TEMPLATES_FALLBACK: MessageTemplate[] = [
  // --- KATEGORI 1: OPERASIONAL RUTIN ---
  { 
    id: '1', 
    label: 'Pengingat PRS (Besok)', 
    type: 'ai', 
    promptContext: 'Ingatkan Ibu nasabah untuk hadir di Pertemuan Rutin Sentra (PRS) BESOK. Sampaikan pentingnya kehadiran untuk tepat waktu dan bawa angsuran.', icon: '👥' 
  },
  { 
    id: 'manual-1', 
    label: 'Konfirmasi Hadir (Cek)', 
    type: 'manual', 
    content: 'Assalamualaikum Ibu {name}, besok hadir di kumpulan sentra {sentra} kan Bu? Ditunggu kehadirannya tepat waktu ya. Sehat selalu Bu.', 
    icon: '🗓️' 
  },
  { 
    id: 'manual-2', 
    label: 'Reminder Angsuran H-1', 
    type: 'manual', 
    content: 'Assalamualaikum Bu {name}. Sekadar mengingatkan besok jadwal angsuran di sentra {sentra}. Semoga rezekinya lancar dan dimudahkan ya Bu.', 
    icon: '⏰' 
  },

  // --- KATEGORI 2: BISNIS & PENCAIRAN (REFINANCING) ---
  { 
    id: '2', 
    label: 'Tawaran Lanjut (Cair)', 
    type: 'ai', 
    promptContext: 'Nasabah ini sebentar lagi lunas (Jatuh Tempo). Berikan ucapan selamat atas kedisiplinannya. Tawarkan kesempatan untuk pengajuan pembiayaan kembali (tambah modal) untuk pengembangan usaha.', icon: '💰' 
  },
  { 
    id: 'ai-winback', 
    label: 'Ajak Gabung Kembali (Winback)', 
    type: 'ai', 
    promptContext: 'Nasabah ini sudah pernah lunas/berhenti beberapa bulan hingga setahun yang lalu. Sapa dengan hangat, tanyakan kabar usahanya. Ajak untuk bergabung kembali dengan BTPN Syariah karena mungkin beliau butuh tambahan modal sekarang.', icon: '🔄' 
  },
  { 
    id: 'ai-prospek', 
    label: 'Sapaan Prospek Baru', 
    type: 'ai', 
    promptContext: 'Buat pesan sapaan hangat untuk calon nasabah (Prospek). Tanyakan kabar usaha ibunya. Jelaskan sedikit keuntungan bergabung dengan komunitas BTPN Syariah (modal usaha & pendampingan). Ajak untuk ikut melihat kegiatan sentra terdekat.', 
    icon: '🤝' 
  },

  // --- KATEGORI 3: PENANGANAN MASALAH (COLLECTION) ---
  { 
    id: '6', 
    label: 'Penagihan Menunggak (CTX)', 
    type: 'ai', 
    promptContext: 'Buat pesan penagihan yang tegas dan profesional untuk nasabah menunggak (CTX). Tekankan urgensi pembayaran SEGERA hari ini. Sebutkan konsekuensi jika tidak kooperatif (seperti catatan pembiayaan buruk). Minta nasabah segera konfirmasi pembayaran.', icon: '⚠️' 
  },

  // --- KATEGORI 4: HUBUNGAN & PERSONAL ---
  { 
    id: 'ai-doa', 
    label: 'Doa & Motivasi Usaha', 
    type: 'ai', 
    promptContext: 'Buat pesan singkat yang berisi doa tulus untuk kelancaran usaha ibu nasabah dan kesehatan keluarganya. Jangan jualan, fokus pada menjalin hubungan emosional (bonding).', 
    icon: '🎂' 
  },
  { 
    id: '5', 
    label: 'Sapaan Silaturahmi', 
    type: 'manual', 
    content: 'Assalamualaikum Ibu {name}, semoga usaha Ibu di sentra {sentra} semakin lancar ya. Jika ada kendala, jangan sungkan hubungi saya.', icon: '🤝' 
  },

  // --- KATEGORI 5: INFORMASI ---
  { 
    id: '3', 
    label: 'Undangan Resmi', 
    type: 'manual', 
    content: 'Assalamualaikum Ibu {name}, diinfokan besok akan ada kunjungan dari pusat di sentra {sentra}. Mohon dipastikan hadir lengkap dan buku angsuran dibawa ya Bu. Terima kasih.', 
    icon: '📩' 
  },
];

// Add 'contacts' and 'login' to View Type
type AppView = 'home' | 'notifications' | 'broadcast' | 'settings' | 'dashboard' | 'contacts' | 'login';

const App: React.FC = () => {
  // ... (State logic same as before) ...
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]); // New State for Plans
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [configError, setConfigError] = useState<boolean>(false);
  const [activeConfig, setActiveConfig] = useState<SheetConfig | null>(null);

  const [activeView, setActiveView] = useState<AppView>('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Filters
  const [selectedSentra, setSelectedSentra] = useState<string>('');
  const [selectedCo, setSelectedCo] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  
  // --- PERFORMANCE OPTIMIZATION: Deferred Values ---
  const deferredSentra = useDeferredValue(selectedSentra);
  const deferredCo = useDeferredValue(selectedCo);
  const deferredStatus = useDeferredValue(selectedStatus);
  const deferredSearchTerm = useDeferredValue(debouncedSearchTerm);
  
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false); // New Modal State
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialTemplateId, setInitialTemplateId] = useState<string | undefined>(undefined);
  // Removed showLoginModal state
  
  const [visibleCount, setVisibleCount] = useState(50);
  
  // Update indicator to show loading when ANY deferred value is lagging behind
  const isFiltering = (searchTerm !== debouncedSearchTerm) || 
                      (selectedSentra !== deferredSentra) || 
                      (selectedCo !== deferredCo) || 
                      (selectedStatus !== deferredStatus);

  // ... (Effects same as before) ...
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset pagination when filters change (using immediate values for responsiveness)
  useEffect(() => {
      setVisibleCount(50);
  }, [debouncedSearchTerm, selectedSentra, selectedCo, selectedStatus]);

  const loadData = async () => {
    setIsLoadingData(true);
    setConfigError(false);
    try {
        let finalConfig: SheetConfig = { ...GLOBAL_CONFIG };
        
        // 1. Try to load Local Config (User overrides)
        try {
            const localConfig = await getSheetConfig();
            if (localConfig) {
                 finalConfig = { ...finalConfig, ...localConfig };
            }
        } catch (e) {
            console.warn("Failed to load local config", e);
        }

        // 2. Try to load Supabase Config (Server overrides, if exists)
        if (isSupabaseConfigured()) {
            try {
                const supabaseSettings = await fetchSettingsFromSupabase();
                if (supabaseSettings && supabaseSettings.spreadsheetId) {
                    finalConfig = { ...finalConfig, ...supabaseSettings };
                }
            } catch (err) {
                console.warn("Failed to load settings from Supabase, using local/global config.", err);
            }
        }
        
        setActiveConfig(finalConfig);

        if (finalConfig.spreadsheetId) {
            // Fetch Contacts
            try {
                const liveContacts = await fetchContactsFromSheet(finalConfig.spreadsheetId, finalConfig.sheetName);
                setContacts(liveContacts);
            } catch (err) {
                console.error("Error fetching live contacts from Sheet:", err);
            }
            
            // Fetch Plans (NEW)
            try {
                const livePlans = await fetchPlansFromSheet(finalConfig.spreadsheetId, 'Plan');
                setDailyPlans(livePlans);
            } catch (err) {
                console.error("Error fetching daily plans:", err);
            }

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

  // --- LOGIC NOTIFIKASI BARU (PRS H-1, REFINANCING & COLLECTION) ---
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const nextMonthDate = new Date(today);
    nextMonthDate.setMonth(currentMonth + 1);
    const nextMonth = nextMonthDate.getMonth();
    const nextMonthYear = nextMonthDate.getFullYear();

    const parseFullDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        const clean = dateStr.trim();
        // Try parsing Indo format DD/MM/YYYY or DD-MM-YYYY
        const partsIndo = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (partsIndo) {
            const day = parseInt(partsIndo[1], 10);
            const month = parseInt(partsIndo[2], 10) - 1; 
            const year = parseInt(partsIndo[3], 10);
            const d = new Date(year, month, day);
            if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d;
        }
        const parsed = Date.parse(clean);
        if (!isNaN(parsed)) return new Date(parsed);
        return null;
    };

    return contacts.reduce<NotificationItem[]>((acc, contact) => {
        const flag = (contact.flag || '').toLowerCase();
        const status = (contact.status || '').toLowerCase();
        // Robust Parsing of DPD
        const dpd = parseInt(contact.dpd || '0', 10) || 0;
        
        const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
        const isTrouble = dpd > 0 || status.includes('macet') || status.includes('menunggak');
        
        // Date parsing helper
        const dueDate = contact.tglJatuhTempo ? parseFullDate(contact.tglJatuhTempo) : null;
        const lunasDate = contact.tglLunas ? parseFullDate(contact.tglLunas) : null;

        // 1. COLLECTION LOGIC (Priority High)
        // Jika bermasalah dan bukan DO/Lunas (Status aktif tapi nunggak)
        if (isTrouble && !isInactive) {
             acc.push({ contact, type: 'payment', status: 'collection', daysLeft: dpd });
        }
        
        // 2. REFINANCING / WINBACK LOGIC
        else if (dueDate || lunasDate) {
            
            if (!isInactive && dueDate) {
                 // GROUP A: NASABAH LANCAR (Jatuh Tempo Bulan Ini & Bulan Depan)
                 const dm = dueDate.getMonth();
                 const dy = dueDate.getFullYear();
                 let notifStatus: any = null;
                 if (dy === currentYear && dm === currentMonth) {
                        notifStatus = (dueDate.getDate() === today.getDate()) ? 'today' : 'this_month';
                 } else if ((dy === nextMonthYear && dm === nextMonth)) {
                    notifStatus = 'next_month';
                 }
                 if (notifStatus) acc.push({ contact, type: 'payment', status: notifStatus, daysLeft: 0 });
            } 
            else if (isInactive) {
                // GROUP B: NASABAH DO/LUNAS (Winback 1-12 Bulan ke belakang)
                // Criteria: Based on TGL LUNAS (Primary). Fallback to TGL JATUH TEMPO.
                const referenceDate = lunasDate || dueDate;

                if (referenceDate) {
                    // Logic: referenceDate is in the past
                    const monthsAgo = (today.getFullYear() - referenceDate.getFullYear()) * 12 + (today.getMonth() - referenceDate.getMonth());
                    
                    if (monthsAgo >= 1 && monthsAgo <= 12) {
                        // Split Winback: < 3 months vs > 3 months
                        if (monthsAgo < 3) {
                             acc.push({ contact, type: 'payment', status: 'winback_recent', daysLeft: 0 });
                        } else {
                             acc.push({ contact, type: 'payment', status: 'winback_old', daysLeft: 0 });
                        }
                    }
                }
            }
        }

        // 3. PRS LOGIC (H-1)
        if (contact.tglPrs && !isInactive && !isTrouble) {
             let prsDate: Date | null = null;
             if (contact.tglPrs.match(/^\d{1,2}$/)) {
                 // Format tanggal tok (misal "15") -> Asumsi bulan ini
                 let targetDay = parseInt(contact.tglPrs);
                 prsDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
                 // Jika hari ini tgl 30 dan PRS tgl 1, berarti PRS bulan depan
                 if (prsDate < today) {
                     prsDate.setMonth(prsDate.getMonth() + 1);
                 }
             } else {
                 prsDate = parseFullDate(contact.tglPrs);
             }

             if (prsDate) {
                 const diff = Math.ceil((prsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                 // Hanya H-1 (Besok) atau Hari Ini
                 if (diff === 0) acc.push({ contact, type: 'prs', status: 'today', daysLeft: 0 });
                 else if (diff === 1) acc.push({ contact, type: 'prs', status: 'soon', daysLeft: 1 }); // "BESOK"
             }
        }
        return acc;
    }, []).sort((a, b) => {
        // Sort Priority: Collection > Today > Tomorrow > This Month > Next Month > Winback Recent > Winback Old
        const score = (s: string) => {
            if (s === 'collection') return 0; // Highest Priority
            if (s === 'today') return 1;
            if (s === 'soon') return 2;
            if (s === 'this_month') return 3;
            if (s === 'next_month') return 4;
            if (s === 'winback_recent') return 5;
            if (s === 'winback_old') return 6;
            return 99;
        }

        const scoreA = score(a.status);
        const scoreB = score(b.status);
        
        if (scoreA !== scoreB) {
            return scoreA - scoreB;
        }

        // --- SECONDARY SORT: PRIORITAS DPD TERKECIL UNTUK COLLECTION ---
        if (a.status === 'collection' && b.status === 'collection') {
            let dpdA = parseInt(a.contact.dpd || '0', 10);
            let dpdB = parseInt(b.contact.dpd || '0', 10);
            
            // Handle NaN or 0: Push to bottom (Assume 0/Empty DPD is less urgent than DPD 1)
            // Or prioritize explicit DPDs.
            if (isNaN(dpdA) || dpdA <= 0) dpdA = 999999;
            if (isNaN(dpdB) || dpdB <= 0) dpdB = 999999;

            return dpdA - dpdB; // Ascending (1, 2, 3 ... 999999)
        }
        
        return 0;
    });
  }, [contacts]);

  const uniqueSentras = useMemo(() => {
    // Only count active sentras if possible, but for general overview, all sentras is fine.
    // However, to align with "Active Customers", let's leave this broad or filter active too.
    // For now, let's keep it broad as user asked for "Total Nasabah" definition mainly.
    // But logically, uniqueSentras should probably reflect the active portfolio.
    
    // Let's filter active contacts first for consistency
    const activeContacts = contacts.filter(c => {
         const flag = (c.flag || '').toLowerCase();
         return !flag.includes('do') && !flag.includes('drop') && !flag.includes('lunas') && !flag.includes('tutup') && !flag.includes('inactive');
    });

    let source = selectedCo ? activeContacts.filter(c => (c.co || 'Unassigned') === selectedCo) : activeContacts;
    return Array.from(new Set(source.map(c => c.sentra || 'Unknown'))).sort();
  }, [contacts, selectedCo]);

  const uniqueCos = useMemo(() => {
      return Array.from(new Set(contacts.map(c => c.co || 'Unassigned'))).sort();
  }, [contacts]);

  // --- FILTER LOGIC (OPTIMIZED & FIXED) ---
  const filteredContacts = useMemo(() => {
    // Privacy: Return empty if no filters are active
    if (!deferredSearchTerm && !deferredSentra && !deferredCo && deferredStatus === 'All') return [];
    
    return contacts.filter(contact => {
      // 1. Search
      if (deferredSearchTerm) {
          const term = deferredSearchTerm.toLowerCase();
          const matchName = contact.name.toLowerCase().includes(term);
          const matchPhone = contact.phone.includes(term);
          if (!matchName && !matchPhone) return false;
      }
      
      // 2. Sentra
      if (deferredSentra && (contact.sentra || 'Unknown') !== deferredSentra) return false;
      
      // 3. CO
      if (deferredCo && (contact.co || 'Unassigned') !== deferredCo) return false;
      
      // 4. Status (FIXED)
      if (deferredStatus !== 'All') {
          const cStatus = (contact.status || '').toLowerCase();
          const cFlag = (contact.flag || '').toLowerCase();
          
          // Defines "Trouble" / Inactive criteria
          const isTrouble = cStatus.includes('macet') || 
                            cStatus.includes('menunggak') || 
                            cStatus.includes('tutup') || 
                            cFlag.includes('do') || 
                            cFlag.includes('drop');
          
          if (deferredStatus === 'Active') {
             if (isTrouble) return false;
          } else if (deferredStatus === 'Inactive') {
             if (!isTrouble) return false;
          }
      }

      return true;
    });
  }, [contacts, deferredSearchTerm, deferredSentra, deferredCo, deferredStatus]);

  const visibleContacts = useMemo(() => {
      return filteredContacts.slice(0, visibleCount);
  }, [filteredContacts, visibleCount]);

  // --- STATS HELPER FOR HOME ---
  const totalActiveContacts = useMemo(() => {
      return contacts.filter(c => {
        const flag = (c.flag || '').toLowerCase();
        return !flag.includes('do') && !flag.includes('drop') && !flag.includes('lunas') && !flag.includes('tutup') && !flag.includes('inactive');
      }).length;
  }, [contacts]);
  
  // --- DAILY PLAN LOGIC ---
  const todaysPlan = useMemo(() => {
      // Get most recent plan or plan for today
      // For now, let's just show the last entry as "Latest Plan"
      if (dailyPlans.length === 0) return null;
      return dailyPlans[dailyPlans.length - 1];
  }, [dailyPlans]);

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

  const handleSavePlan = async (plan: DailyPlan) => {
     if (activeConfig?.googleScriptUrl) {
         // UI Optimistic Update
         setDailyPlans(prev => [...prev, plan]);
         // Background Save
         await submitPlanToSheet(activeConfig.googleScriptUrl, plan);
     } else {
         alert("Script URL belum disetting di Admin panel. Data tidak akan tersimpan ke Sheet.");
     }
  };

  const handleAdminAuth = () => {
      setActiveView('login');
  };

  // --- BULK UPDATE LOGIC FOR ADMIN ---
  const handleBulkUpdateMode = async (mode: 'ai' | 'manual') => {
      const updatedTemplates = templates.map(t => ({ ...t, type: mode }));
      setTemplates(updatedTemplates);
      
      if (isSupabaseConfigured()) {
          try {
              await saveTemplatesToSupabase(updatedTemplates);
          } catch (e) {
              console.error("Failed to bulk update templates", e);
              alert("Gagal menyimpan perubahan ke server.");
          }
      }
  };

  // --- Render Navigation ---
  const renderBottomNav = () => (
    <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 z-40 pb-safe">
        <div className="flex justify-between items-center px-4 py-2 max-w-md mx-auto">
            <button onClick={() => setActiveView('home')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'home' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <Home className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-medium">Beranda</span>
            </button>
            
            <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'dashboard' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <TrendingUp className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-medium">Kinerja</span>
            </button>

            <button onClick={() => setActiveView('contacts')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'contacts' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <ContactIcon className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-medium">Kontak</span>
            </button>

            <div className="relative">
                <button onClick={() => setActiveView('notifications')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'notifications' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                    <Bell className="w-5 h-5 mb-0.5" />
                    <span className="text-[9px] font-medium">Follow Up</span>
                </button>
                {upcomingEvents.length > 0 && (
                    <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                )}
            </div>
            
            <button onClick={() => setActiveView('broadcast')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'broadcast' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <Radio className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-medium">Siaran</span>
            </button>
            
            <button onClick={handleAdminAuth} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'settings' || activeView === 'login' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <Settings className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-medium">Admin</span>
            </button>
        </div>
    </div>
  );


  // --- Render Views ---

  if (activeView === 'login') {
      return (
          <AdminLoginPanel 
              onBack={() => setActiveView('home')}
              onLogin={() => setActiveView('settings')}
          />
      );
  }

  if (activeView === 'settings') {
      return (
          <>
            <AdminPanel
                onBack={() => setActiveView('home')}
                templates={templates}
                onUpdateTemplates={setTemplates}
                onResetData={async () => {
                    await loadData();
                    setActiveView('home');
                }}
                defaultTemplates={INITIAL_TEMPLATES_FALLBACK}
                onBulkUpdateMode={handleBulkUpdateMode}
            />
            {renderBottomNav()}
          </>
      );
  }

  if (activeView === 'notifications') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
            <NotificationPanel 
                items={upcomingEvents}
                onBack={() => setActiveView('home')}
                onRemind={(contact, type) => {
                    // Smart Template Selection Logic
                    let keywords: string[] = [];

                    if (type === 'prs') {
                        keywords = ['prs', 'kumpulan', 'besok'];
                    } else if (type === 'payment') {
                        const flag = (contact.flag || '').toLowerCase();
                        const status = (contact.status || '').toLowerCase();
                        const dpd = parseInt(contact.dpd || '0', 10);
                        const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
                        const isTrouble = dpd > 0 || status.includes('macet') || status.includes('menunggak');

                        if (isTrouble) {
                            // 1. Collection
                            keywords = ['tagih', 'ctx', 'tunggak', 'bayar'];
                        } else if (isInactive) {
                            // 2. Winback
                            // Menambahkan 'tawar' dan 'cair' agar template refinancing juga bisa terpilih untuk nasabah lunas
                            keywords = ['winback', 'gabung', 'tawar', 'cair'];
                        } else {
                            // 3. Refinancing / Lancar
                            keywords = ['tawar', 'lanjut', 'cair', 'modal'];
                        }
                    }
                    
                    // Find matched template by keywords
                    const found = templates.find(t => 
                        keywords.some(k => t.label.toLowerCase().includes(k))
                    );

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

  if (activeView === 'dashboard') {
      return (
          <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
              <DashboardPanel 
                contacts={contacts} 
                onBack={() => setActiveView('home')} 
              />
              {renderBottomNav()}
          </div>
      );
  }

  // NEW CONTACT MANAGEMENT VIEW
  if (activeView === 'contacts') {
      return (
          <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
              <ContactManagementPanel 
                contacts={contacts} 
                onEdit={setContactToEdit}
                onDelete={handleDeleteContact}
                onBack={() => setActiveView('home')} 
              />
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
  }

  // --- HOME VIEW: SMART DASHBOARD / DAILY HUB ---
  
  // Greeting Helper
  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 11) return "Selamat Pagi";
      if (hour < 15) return "Selamat Siang";
      if (hour < 18) return "Selamat Sore";
      return "Selamat Malam";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 pb-24 relative">
      
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-2 rounded-xl shadow-lg shadow-orange-500/20 text-white">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">
                Borobudur <span className="text-orange-600">Berprestasi</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mobile CRM System</p>
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

      {/* NEW: DASHBOARD CONTENT */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
          
          {/* 1. Smart Greeting (HERO UPDATED) */}
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-3xl p-6 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
                {/* Decor */}
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-orange-500/30 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <Trophy className="w-5 h-5 text-yellow-300" />
                        <span className="text-xs font-bold uppercase tracking-widest text-yellow-100">Team Borobudur</span>
                    </div>
                    <h2 className="text-2xl font-black mb-1">{getGreeting()}, CO!</h2>
                    <p className="text-orange-50 text-sm leading-relaxed max-w-[90%]">
                         Aplikasi CRM Digital untuk memonitor nasabah, sentra, dan kinerja tim BTPN Syariah secara real-time & presisi.
                    </p>
                    
                    {/* Stats Row */}
                    <div className="flex gap-4 mt-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex-1 border border-white/20 hover:bg-white/20 transition-colors">
                            <p className="text-xs text-orange-100 uppercase font-bold mb-1 flex items-center gap-1">
                                <Users className="w-3 h-3" /> Total Nasabah
                            </p>
                            <p className="text-2xl font-black">{totalActiveContacts}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex-1 border border-white/20 hover:bg-white/20 transition-colors">
                            <p className="text-xs text-orange-100 uppercase font-bold mb-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Sentra Aktif
                            </p>
                            <p className="text-2xl font-black">{uniqueSentras.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. DAILY PLAN / TODOLIST CARD (NEW) */}
            <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm shadow-blue-100/50">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-blue-500" />
                            Rencana Harian CO
                        </h3>
                        <p className="text-xs text-slate-500">Target SW, Collection & Admin.</p>
                    </div>
                    <button 
                        onClick={() => setIsTodoModalOpen(true)}
                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 shadow-sm flex items-center gap-1.5"
                    >
                        <PenTool className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">Input Plan</span>
                    </button>
                </div>

                {todaysPlan ? (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                            <span className="text-xs font-bold text-slate-400 uppercase">{todaysPlan.coName} • {todaysPlan.date}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Target SW (Noa)</p>
                                <p className="text-sm font-black text-slate-700">{todaysPlan.swCurrentNoa} <span className="text-[9px] font-normal text-slate-400">Cur</span> / {todaysPlan.swNextNoa} <span className="text-[9px] font-normal text-slate-400">Nxt</span></p>
                            </div>
                             <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                <p className="text-[9px] font-bold text-red-400 uppercase mb-1">Collect CTX</p>
                                <p className="text-sm font-black text-red-700">{todaysPlan.colCtxNoa} <span className="text-[9px] font-normal text-red-400">NOA</span></p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                             <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-100">Lantakur: {todaysPlan.colLantakurNoa}</span>
                             <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">FPPB: {todaysPlan.fppbNoa}</span>
                             <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">Bio: {todaysPlan.biometrikNoa}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                        <p className="text-sm font-bold text-slate-400">Belum ada rencana hari ini</p>
                        <button 
                            onClick={() => setIsTodoModalOpen(true)} 
                            className="text-xs text-blue-500 font-bold hover:underline mt-1"
                        >
                            + Buat Rencana Baru
                        </button>
                    </div>
                )}
            </div>

          {/* 3. Priority Agenda (Horizontal Scroll) */}
          <div>
              <div className="flex justify-between items-end mb-3 px-1">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <AlertOctagon className="w-5 h-5 text-red-500" />
                    Agenda Prioritas
                </h3>
                <button 
                    onClick={() => setActiveView('notifications')}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                >
                    Lihat Semua <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {upcomingEvents.length === 0 ? (
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Sparkles className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">Jadwal Bersih!</p>
                      <p className="text-xs text-slate-400">Tidak ada PRS H-1 atau Jatuh Tempo mendesak.</p>
                  </div>
              ) : (
                  <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                      {upcomingEvents.slice(0, 5).map((item, idx) => (
                          <div 
                            key={idx}
                            onClick={() => setActiveView('notifications')}
                            className={`min-w-[240px] bg-white border p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${item.status === 'collection' ? 'border-red-200 hover:border-red-300' : 'border-slate-200 hover:border-orange-300'}`}
                          >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${item.status === 'collection' ? 'bg-red-100 text-red-600' : item.type === 'prs' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {item.status === 'collection' ? 'MENUNGGAK' : item.type === 'prs' ? 'Kumpulan' : 'Jatuh Tempo'}
                                        </span>
                                        <span className={`text-[10px] font-bold ${item.status === 'today' || item.status === 'soon' || item.status === 'collection' ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                            {item.status === 'collection' ? `DPD: ${item.daysLeft}` : item.status === 'today' ? 'HARI INI' : item.status === 'soon' ? 'BESOK' : item.status}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-slate-800 truncate">{item.contact.name}</h4>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                        <MapPin className="w-3 h-3" /> {item.contact.sentra}
                                    </p>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-orange-600">
                                    Lihat Detail <ChevronRight className="w-3 h-3" />
                                </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {/* 4. Quick Action Grid */}
          <div>
               <h3 className="font-bold text-slate-700 mb-3 px-1 flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-amber-500" />
                   Akses Cepat
               </h3>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                   <button 
                        onClick={() => setActiveView('contacts')}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:bg-orange-50 transition-all flex flex-col items-center gap-2 text-center"
                    >
                       <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                           <Search className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold text-slate-700">Cari Nasabah</span>
                   </button>
                   
                   <button 
                        onClick={() => setActiveView('notifications')}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:bg-orange-50 transition-all flex flex-col items-center gap-2 text-center"
                    >
                       <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                           <Bell className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold text-slate-700">Follow Up</span>
                   </button>

                   <button 
                        onClick={() => setActiveView('broadcast')}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:bg-orange-50 transition-all flex flex-col items-center gap-2 text-center"
                    >
                       <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                           <Radio className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold text-slate-700">Siaran WA</span>
                   </button>

                   <button 
                        onClick={() => setActiveView('dashboard')}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:bg-orange-50 transition-all flex flex-col items-center gap-2 text-center"
                    >
                       <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                           <Activity className="w-5 h-5" />
                       </div>
                       <span className="text-xs font-bold text-slate-700">Cek Kinerja</span>
                   </button>
               </div>
          </div>

          {/* 5. Sentra Overview List */}
          <div>
               <h3 className="font-bold text-slate-700 mb-3 px-1 flex items-center gap-2">
                   <MapPin className="w-5 h-5 text-slate-500" />
                   Daftar Sentra
               </h3>
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                   {uniqueSentras.slice(0, 5).map((sentra, idx) => (
                       <div key={sentra} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                           <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500">
                                   {idx + 1}
                               </div>
                               <span className="font-bold text-sm text-slate-700">{sentra}</span>
                           </div>
                           <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-8 text-[10px]"
                                onClick={() => {
                                    // Hack: Set filters in contacts view
                                    setSelectedSentra(sentra);
                                    setActiveView('contacts');
                                }}
                            >
                               Lihat Anggota
                           </Button>
                       </div>
                   ))}
                   {uniqueSentras.length > 5 && (
                       <button 
                        onClick={() => setActiveView('contacts')}
                        className="w-full p-3 text-center text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors"
                       >
                           Lihat Semua ({uniqueSentras.length} Sentra)
                       </button>
                   )}
               </div>
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
      
      {/* Todo Input Modal */}
      <TodoInputModal 
        isOpen={isTodoModalOpen}
        onClose={() => setIsTodoModalOpen(false)}
        onSave={handleSavePlan}
        availableCos={uniqueCos}
      />

      {renderBottomNav()}
    </div>
  );
};

export default App;