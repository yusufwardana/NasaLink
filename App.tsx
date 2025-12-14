
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
import { PlanHistoryPanel } from './components/PlanHistoryPanel'; // NEW IMPORT
import { Button } from './components/Button';
import { fetchContactsFromSheet, fetchPlansFromSheet, submitPlanToSheet } from './services/sheetService';
import { fetchTemplatesFromSupabase, fetchSettingsFromSupabase, isSupabaseConfigured, saveTemplatesToSupabase } from './services/supabaseService';
import { getSheetConfig } from './services/dbService';
import { GLOBAL_CONFIG } from './config';
import { Search, Users, Settings, Shield, RefreshCw, Sparkles, Bell, Globe, Briefcase, MapPin, HeartHandshake, Database, ChevronDown, Server, AlertTriangle, Home, Loader2, Download, X, Radio, Activity, TrendingUp, Contact as ContactIcon, ChevronRight, Calendar, AlertOctagon, Trophy, ClipboardList, PenTool, BarChart3, LineChart } from 'lucide-react';

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

// Add 'plans' to View Type
type AppView = 'home' | 'notifications' | 'broadcast' | 'settings' | 'dashboard' | 'contacts' | 'login' | 'plans';

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
            
            // Fetch Plans (NEW: This now merges PLAN + AKTUAL internally)
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

  // ... (Notification Logic remains same) ...
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
        const flagMenunggak = (contact.flagMenunggak || '').toLowerCase();
        const dpd = parseInt(contact.dpd || '0', 10) || 0;
        
        const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
        const isCtx = flagMenunggak.includes('ctx');
        const isExCtx = flagMenunggak.includes('xday') || flagMenunggak.includes('sm') || flagMenunggak.includes('npf') || flagMenunggak.includes('macet');
        const isGenericTrouble = dpd > 0 || status.includes('macet') || status.includes('menunggak');
        const isLantakur = (contact.flagLantakur || '').toLowerCase().includes('lantakur');
        const dueDate = contact.tglJatuhTempo ? parseFullDate(contact.tglJatuhTempo) : null;
        const lunasDate = contact.tglLunas ? parseFullDate(contact.tglLunas) : null;

        if (isCtx && !isInactive) acc.push({ contact, type: 'payment', status: 'collection_ctx', daysLeft: dpd });
        else if ((isExCtx || isGenericTrouble) && !isInactive) acc.push({ contact, type: 'payment', status: 'collection_ex', daysLeft: dpd });
        else if (isLantakur && !isInactive) acc.push({ contact, type: 'payment', status: 'lantakur', daysLeft: 0 });
        else if (dueDate || lunasDate) {
            if (!isInactive && dueDate) {
                 const dm = dueDate.getMonth();
                 const dy = dueDate.getFullYear();
                 let notifStatus: any = null;
                 if (dy === currentYear && dm === currentMonth) notifStatus = (dueDate.getDate() === today.getDate()) ? 'today' : 'this_month';
                 else if ((dy === nextMonthYear && dm === nextMonth)) notifStatus = 'next_month';
                 if (notifStatus) acc.push({ contact, type: 'payment', status: notifStatus, daysLeft: 0 });
            } 
            else if (isInactive && (lunasDate || dueDate)) {
                const referenceDate = lunasDate || dueDate;
                if (referenceDate) {
                    const monthsAgo = (today.getFullYear() - referenceDate.getFullYear()) * 12 + (today.getMonth() - referenceDate.getMonth());
                    if (monthsAgo >= 1 && monthsAgo <= 12) {
                        if (monthsAgo < 3) acc.push({ contact, type: 'payment', status: 'winback_recent', daysLeft: 0 });
                        else acc.push({ contact, type: 'payment', status: 'winback_old', daysLeft: 0 });
                    }
                }
            }
        }
        if (contact.tglPrs && !isInactive && !isCtx && !isExCtx && !isGenericTrouble) {
             let prsDate: Date | null = null;
             if (contact.tglPrs.match(/^\d{1,2}$/)) {
                 let targetDay = parseInt(contact.tglPrs);
                 prsDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
                 if (prsDate < today) prsDate.setMonth(prsDate.getMonth() + 1);
             } else {
                 prsDate = parseFullDate(contact.tglPrs);
             }
             if (prsDate) {
                 const diff = Math.ceil((prsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                 if (diff === 0) acc.push({ contact, type: 'prs', status: 'today', daysLeft: 0 });
                 else if (diff === 1) acc.push({ contact, type: 'prs', status: 'soon', daysLeft: 1 }); 
             }
        }
        return acc;
    }, []).sort((a, b) => {
        const score = (s: string) => {
            if (s === 'collection_ctx') return 0;
            if (s === 'collection_ex') return 1;
            if (s === 'lantakur') return 2;
            if (s === 'today') return 3;
            if (s === 'soon') return 4;
            return 99;
        }
        const scoreA = score(a.status);
        const scoreB = score(b.status);
        if (scoreA !== scoreB) return scoreA - scoreB;
        if (a.status.includes('collection') && b.status.includes('collection')) {
            let dpdA = parseInt(a.contact.dpd || '0', 10);
            let dpdB = parseInt(b.contact.dpd || '0', 10);
            if (isNaN(dpdA) || dpdA <= 0) dpdA = 999999;
            if (isNaN(dpdB) || dpdB <= 0) dpdB = 999999;
            return dpdA - dpdB; 
        }
        return 0;
    });
  }, [contacts]);

  const uniqueSentras = useMemo(() => {
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

  // ... (Filter & Stats logic same as before) ...
  const filteredContacts = useMemo(() => {
    if (!deferredSearchTerm && !deferredSentra && !deferredCo && deferredStatus === 'All') return [];
    return contacts.filter(contact => {
      if (deferredSearchTerm) {
          const term = deferredSearchTerm.toLowerCase();
          const matchName = contact.name.toLowerCase().includes(term);
          const matchPhone = contact.phone.includes(term);
          if (!matchName && !matchPhone) return false;
      }
      if (deferredSentra && (contact.sentra || 'Unknown') !== deferredSentra) return false;
      if (deferredCo && (contact.co || 'Unassigned') !== deferredCo) return false;
      if (deferredStatus !== 'All') {
          const cStatus = (contact.status || '').toLowerCase();
          const cFlag = (contact.flag || '').toLowerCase();
          const flagMenunggak = (contact.flagMenunggak || '').toLowerCase();
          const isTrouble = cStatus.includes('macet') || cStatus.includes('menunggak') || cStatus.includes('tutup') || flagMenunggak.includes('ctx') || cFlag.includes('do') || cFlag.includes('drop');
          if (deferredStatus === 'Active') { if (isTrouble) return false; } 
          else if (deferredStatus === 'Inactive') { if (!isTrouble) return false; }
      }
      return true;
    });
  }, [contacts, deferredSearchTerm, deferredSentra, deferredCo, deferredStatus]);

  const visibleContacts = useMemo(() => {
      return filteredContacts.slice(0, visibleCount);
  }, [filteredContacts, visibleCount]);

  const totalActiveContacts = useMemo(() => {
      return contacts.filter(c => {
        const flag = (c.flag || '').toLowerCase();
        return !flag.includes('do') && !flag.includes('drop') && !flag.includes('lunas') && !flag.includes('tutup') && !flag.includes('inactive');
      }).length;
  }, [contacts]);
  
  // --- CORRECTED "TODAY'S PLAN" LOGIC (STRICT) ---
  const todaysPlan = useMemo(() => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const todayStr = `${dd}/${mm}/${yyyy}`; 

      // Strictly normalize: Remove any extra zeroes to be safe: 01/01/2025 -> 1/1/2025
      const norm = (str: string) => {
          if (!str) return '';
          return str.split('/').map(s => parseInt(s, 10)).join('/');
      };
      
      const target = norm(todayStr);

      // Filter plans that match TODAY's date (Strict Check)
      const plansToday = dailyPlans.filter(p => norm(p.date) === target);

      if (plansToday.length === 0) return null;

      // AGGREGATE IF MULTIPLE
      const aggregated = plansToday.reduce((acc, curr) => ({
          ...acc,
          swCurrentNoa: String((parseInt(acc.swCurrentNoa)||0) + (parseInt(curr.swCurrentNoa)||0)),
          colCtxNoa: String((parseInt(acc.colCtxNoa)||0) + (parseInt(curr.colCtxNoa)||0)),
          colLantakurNoa: String((parseInt(acc.colLantakurNoa)||0) + (parseInt(curr.colLantakurNoa)||0)),
          id: curr.id, 
          date: todayStr, // Ensure display date is standardized
          coName: 'Total Tim' 
      }));

      return aggregated;
  }, [dailyPlans]);

  const handleSyncSheet = async () => {
    setIsSyncing(true);
    setContacts([]); 
    setDailyPlans([]); // Clear plans to ensure visual update on sync
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
         setDailyPlans(prev => {
             // If update existing ID
             if (prev.find(p => p.id === plan.id)) {
                 return prev.map(p => p.id === plan.id ? plan : p);
             }
             return [...prev, plan];
         });
         
         // Background Save - Pass Debug Mode Flag
         await submitPlanToSheet(activeConfig.googleScriptUrl, plan, activeConfig.enableDebugMode);
     } else {
         alert("Script URL belum disetting di Admin panel. Data tidak akan tersimpan ke Sheet.");
     }
  };

  const handleAdminAuth = () => {
      setActiveView('login');
  };

  const handleBulkUpdateMode = async (mode: 'ai' | 'manual') => {
      const updatedTemplates = templates.map(t => ({ ...t, type: mode }));
      setTemplates(updatedTemplates);
      if (isSupabaseConfigured()) {
          try {
              await saveTemplatesToSupabase(updatedTemplates);
          } catch (e) {
              console.error("Failed to bulk update templates", e);
          }
      }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 10) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // --- Render Navigation ---
  const renderBottomNav = () => (
    <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 z-40 pb-safe">
        <div className="flex justify-between items-center px-4 py-2 max-w-md mx-auto">
            <button onClick={() => setActiveView('home')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'home' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
                <Home className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-medium">Beranda</span>
            </button>
            
            <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeView === 'dashboard' || activeView === 'plans' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600'}`}>
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

  if (activeView === 'login') return <AdminLoginPanel onBack={() => setActiveView('home')} onLogin={() => setActiveView('settings')} />;
  if (activeView === 'settings') return <><AdminPanel onBack={() => setActiveView('home')} templates={templates} onUpdateTemplates={setTemplates} onResetData={async () => { await loadData(); setActiveView('home'); }} defaultTemplates={INITIAL_TEMPLATES_FALLBACK} onBulkUpdateMode={handleBulkUpdateMode} />{renderBottomNav()}</>;
  if (activeView === 'notifications') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30"><NotificationPanel items={upcomingEvents} onBack={() => setActiveView('home')} onRemind={(contact, type) => { let keywords: string[] = []; if (type === 'prs') { keywords = ['prs', 'kumpulan', 'besok']; } else if (type === 'payment') { const flag = (contact.flag || '').toLowerCase(); const status = (contact.status || '').toLowerCase(); const dpd = parseInt(contact.dpd || '0', 10); const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive'); const isTrouble = dpd > 0 || status.includes('macet') || status.includes('menunggak'); const isLantakur = (contact.flagLantakur || '').toLowerCase().includes('lantakur'); if (isTrouble) { keywords = ['tagih', 'ctx', 'tunggak', 'bayar']; } else if (isLantakur) { keywords = ['lantakur', 'tabungan']; } else if (isInactive) { keywords = ['winback', 'gabung', 'tawar', 'cair']; } else { keywords = ['tawar', 'lanjut', 'cair', 'modal']; } } const found = templates.find(t => keywords.some(k => t.label.toLowerCase().includes(k))); setInitialTemplateId(found?.id || templates[0]?.id); setSelectedContact(contact); }} />{selectedContact && <MessageGeneratorModal contact={selectedContact} isOpen={!!selectedContact} onClose={() => setSelectedContact(null)} templates={templates} initialTemplateId={initialTemplateId} apiKey={activeConfig?.geminiApiKey} />}{renderBottomNav()}</div>;
  if (activeView === 'broadcast') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30"><BroadcastPanel contacts={contacts} templates={templates} onBack={() => setActiveView('home')} apiKey={activeConfig?.geminiApiKey} />{renderBottomNav()}</div>;
  if (activeView === 'dashboard') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
      <div className="max-w-4xl mx-auto px-4 pt-4">
          <Button 
            variant="outline" 
            className="w-full justify-between bg-white/80 backdrop-blur"
            onClick={() => setActiveView('plans')}
            icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
          >
              <span className="font-bold text-slate-700">Lihat Riwayat & Realisasi Rencana</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
          </Button>
      </div>
      <DashboardPanel contacts={contacts} onBack={() => setActiveView('home')} />{renderBottomNav()}
  </div>;

  if (activeView === 'plans') {
      return (
          <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30">
              <PlanHistoryPanel 
                plans={dailyPlans} 
                onBack={() => setActiveView('dashboard')}
                availableCos={uniqueCos}
              />
              {renderBottomNav()}
          </div>
      );
  }

  if (activeView === 'contacts') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30"><ContactManagementPanel contacts={contacts} onEdit={setContactToEdit} onDelete={handleDeleteContact} onBack={() => setActiveView('home')} /><EditContactModal contact={contactToEdit} isOpen={!!contactToEdit} onClose={() => setContactToEdit(null)} onSave={handleUpdateContact} onDelete={handleDeleteContact} sheetConfig={activeConfig} />{renderBottomNav()}</div>;

  // --- HOME VIEW ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 pb-24 relative">
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
             <Button onClick={handleSyncSheet} size="sm" variant="outline" className="h-8 border-orange-200 text-orange-600 hover:bg-orange-50" icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}>{isSyncing ? 'Syncing' : 'Sync'}</Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-3xl p-6 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-orange-500/30 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <Trophy className="w-5 h-5 text-yellow-300" />
                        <span className="text-xs font-bold uppercase tracking-widest text-yellow-100">Team Borobudur</span>
                    </div>
                    <h2 className="text-2xl font-black mb-1">{getGreeting()}, CO!</h2>
                    <p className="text-orange-50 text-sm leading-relaxed max-w-[90%]">Aplikasi CRM Digital untuk memonitor nasabah, sentra, dan kinerja tim BTPN Syariah secara real-time & presisi.</p>
                    <div className="flex gap-4 mt-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex-1 border border-white/20 hover:bg-white/20 transition-colors">
                            <p className="text-xs text-orange-100 uppercase font-bold mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Total Nasabah</p>
                            <p className="text-2xl font-black">{totalActiveContacts}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex-1 border border-white/20 hover:bg-white/20 transition-colors">
                            <p className="text-xs text-orange-100 uppercase font-bold mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Total Sentra</p>
                            <p className="text-2xl font-black">{uniqueSentras.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => setIsTodoModalOpen(true)} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-orange-300 transition-all text-left group">
                     <div className="bg-orange-50 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-orange-100 transition-colors">
                         <ClipboardList className="w-5 h-5 text-orange-600" />
                     </div>
                     <h3 className="font-bold text-slate-700 text-sm">Input Rencana</h3>
                     <p className="text-[10px] text-slate-400 mt-1">Target Harian CO</p>
                 </button>
                 <button onClick={() => setActiveView('notifications')} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group">
                     <div className="bg-blue-50 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                         <Calendar className="w-5 h-5 text-blue-600" />
                     </div>
                     <h3 className="font-bold text-slate-700 text-sm">Jadwal Harian</h3>
                     <p className="text-[10px] text-slate-400 mt-1">Cek Reminder</p>
                 </button>
                 {/* NEW CARD: MONITORING REALISASI */}
                 <button onClick={() => setActiveView('plans')} className="col-span-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group flex items-center justify-between">
                     <div>
                        <h3 className="font-bold text-slate-700 text-sm">Monitoring Realisasi</h3>
                        <p className="text-[10px] text-slate-400 mt-1">Cek Plan vs Aktual Hari Ini</p>
                     </div>
                     <div className="bg-emerald-50 w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                         <BarChart3 className="w-5 h-5 text-emerald-600" />
                     </div>
                 </button>
            </div>

            {/* TODAYS PLAN CARD - VISUAL FEEDBACK FOR EMPTY */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Briefcase className="w-4 h-4 text-slate-500" /> Rencana Hari Ini (Total)</h3>
                    <span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono text-slate-500">
                        {todaysPlan ? todaysPlan.date : new Date().toLocaleDateString('id-ID')}
                    </span>
                </div>
                {todaysPlan ? (
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="text-[9px] text-slate-400 uppercase font-bold">SW</p>
                            <p className="font-black text-slate-700">{todaysPlan.swCurrentNoa}</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="text-[9px] text-slate-400 uppercase font-bold">CTX</p>
                            <p className="font-black text-slate-700">{todaysPlan.colCtxNoa}</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Par</p>
                            <p className="font-black text-slate-700">{todaysPlan.colLantakurNoa}</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <BarChart3 className="w-5 h-5 text-slate-300" />
                        </div>
                        <p className="text-xs text-slate-400 font-bold">Belum ada data rencana hari ini.</p>
                        <button onClick={() => setIsTodoModalOpen(true)} className="text-[10px] text-blue-600 font-bold mt-1 hover:underline">
                            + Input Rencana Baru
                        </button>
                    </div>
                )}
                
                <div className="mt-3 text-center">
                        <button onClick={() => setActiveView('plans')} className="text-xs text-blue-600 font-bold hover:underline">
                            Lihat Detail Realisasi
                        </button>
                </div>
            </div>
      </main>

      <TodoInputModal isOpen={isTodoModalOpen} onClose={() => setIsTodoModalOpen(false)} onSave={handleSavePlan} availableCos={uniqueCos} dailyPlans={dailyPlans} contacts={contacts} />
      {renderBottomNav()}
    </div>
  );
};
export default App;
