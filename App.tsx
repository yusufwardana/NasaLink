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
import { Search, Users, Settings, Shield, RefreshCw, Sparkles, Bell, Globe, Briefcase, MapPin, HeartHandshake, Database, ChevronDown, Server, AlertTriangle, Home, Loader2, Download, X, Radio, Activity, TrendingUp, Contact as ContactIcon, ChevronRight, Calendar, AlertOctagon, Trophy, ClipboardList, PenTool, BarChart3, LineChart, Fingerprint } from 'lucide-react';

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
    content: 'Assalamualaikum Ibu {name}, besok hadir di kumpulan sentra {sentra} jam berapa ya? Ditunggu kehadirannya tepat waktu nggih Bu. Terima kasih.', 
    icon: '✅' 
  },
  { 
    id: '2', 
    label: 'Tagihan Angsuran (H-1)', 
    type: 'ai', 
    promptContext: 'Ingatkan Ibu nasabah bahwa angsuran jatuh tempo besok. Gunakan bahasa yang sopan namun tegas. Sampaikan harap disiapkan uangnya agar lancar.', icon: '💰' 
  },

  // --- KATEGORI 2: PENANGANAN MASALAH (COLLECTION) ---
  { 
    id: '3', 
    label: 'Penagihan Telat (Sopan)', 
    type: 'ai', 
    promptContext: 'Nasabah telat bayar angsuran 1-3 hari. Tanyakan kendalanya apa dengan empati, lalu ingatkan kewajiban untuk membayar segera agar tidak kena denda/masalah.', icon: '🙏' 
  },
  { 
    id: '4', 
    label: 'Penagihan Tegas (Macet)', 
    type: 'ai', 
    promptContext: 'Nasabah sudah menunggak lama (macet). Berikan peringatan tegas namun profesional. Minta kepastian pembayaran hari ini juga.', icon: '⚠️' 
  },
  { 
    id: '5', 
    label: 'Janji Bayar (Follow Up)', 
    type: 'ai', 
    promptContext: 'Nasabah kemarin janji bayar hari ini. Tagih janjinya dengan sopan. "Bu, sesuai janji kemarin..."', icon: '🤝' 
  },

  // --- KATEGORI 3: PROMOSI & RELATIONSHIP ---
  { 
    id: '6', 
    label: 'Tawar Tambah Modal (Top Up)', 
    type: 'ai', 
    promptContext: 'Nasabah lancar dan mau lunas. Tawarkan pembiayaan tambahan (Top Up) untuk modal usaha. Puji perkembangan usahanya.', icon: '📈' 
  },
  { 
    id: '7', 
    label: 'Ajak Menabung (Sukarela)', 
    type: 'ai', 
    promptContext: 'Ajak nasabah untuk menambah tabungan sukarela. Jelaskan manfaat menabung sedikit demi sedikit untuk masa depan.', icon: '🐖' 
  },
  { 
    id: '8', 
    label: 'Ucapan Ulang Tahun', 
    type: 'ai', 
    promptContext: 'Ucapkan selamat ulang tahun yang hangat dan doakan kesehatan serta kelancaran usahanya. Sebagai bentuk perhatian personal.', icon: '🎂' 
  },
  { 
    id: '9', 
    label: 'Winback (Ajak Kembali)', 
    type: 'ai', 
    promptContext: 'Sapa mantan nasabah yang sudah lunas. Tanyakan kabar usaha, dan tawarkan jika butuh modal lagi kami siap bantu proses cepat.', icon: '🔄' 
  }
];

export default function App() {
  // --- STATE MANAGEMENT ---
  const [view, setView] = useState<'home' | 'admin_login' | 'admin_panel' | 'notifications' | 'broadcast' | 'dashboard' | 'contacts' | 'plan_history'>('home');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>(INITIAL_TEMPLATES_FALLBACK);
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(GLOBAL_CONFIG);
  
  // Modals & UI State
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false); // New Todo Modal
  
  // Loading & Data State
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // New Data
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  
  // --- INITIALIZATION ---
  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      try {
        // 1. Load Settings (Local -> Supabase)
        let config = await getSheetConfig() || GLOBAL_CONFIG;
        
        if (isSupabaseConfigured()) {
            const remoteConfig = await fetchSettingsFromSupabase();
            if (remoteConfig) {
                config = { ...config, ...remoteConfig };
            }
        }
        setSheetConfig(config);

        // 2. Load Templates (Supabase -> Local Fallback)
        if (isSupabaseConfigured()) {
            try {
                const remoteTemplates = await fetchTemplatesFromSupabase();
                if (remoteTemplates.length > 0) {
                    setTemplates(remoteTemplates);
                }
            } catch (e) {
                console.warn("Using fallback templates due to load error.");
            }
        }

        // 3. Load Contacts from Sheet (Live) if configured
        if (config.spreadsheetId) {
             await syncData(config);
        }
      } catch (error) {
        console.error("Init Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  const syncData = async (config = sheetConfig) => {
    if (!config.spreadsheetId) return;
    setIsSyncing(true);
    try {
        // 1. Fetch Contacts
        const data = await fetchContactsFromSheet(config.spreadsheetId, config.sheetName);
        setContacts(data);
        
        // 2. Fetch Plans
        const plans = await fetchPlansFromSheet(config.spreadsheetId, 'Plan');
        setDailyPlans(plans);

        setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
        console.error("Sync Error:", error);
        alert("Gagal sinkronisasi dengan Google Sheet. Cek ID Spreadsheet Anda.");
    } finally {
        setIsSyncing(false);
    }
  };

  // --- DERIVED STATE ---
  
  // Notification Items Generator
  const notificationItems: NotificationItem[] = useMemo(() => {
    const items: NotificationItem[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Configurable thresholds
    const prsThreshold = sheetConfig.prsThresholdDays || 1; // H-1
    const refiLookahead = sheetConfig.refinancingLookaheadMonths || 1; // M+1

    contacts.forEach(c => {
        const flag = (c.flag || '').toLowerCase();
        const status = (c.status || '').toLowerCase();
        const flagMenunggak = (c.flagMenunggak || '').toLowerCase();
        const flagLantakur = (c.flagLantakur || '').toLowerCase();

        // 1. PAYMENT REMINDERS (Jatuh Tempo) & COLLECTION
        if (c.tglJatuhTempo) {
            // Helper to parse DD/MM/YYYY
            const parts = c.tglJatuhTempo.split('/');
            if (parts.length === 3) {
                const dueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                const diffTime = dueDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // --- PRIORITY 1: COLLECTION (MENUNGGAK) ---
                const dpd = parseInt(c.dpd || '0', 10);
                const isMenunggak = dpd > 0 || status.includes('macet') || status.includes('menunggak') || flagMenunggak.length > 0;
                
                if (isMenunggak) {
                     // Check CTX vs Eks CTX
                     if (flagMenunggak.includes('ctx')) {
                         items.push({ contact: c, type: 'payment', status: 'collection_ctx', daysLeft: dpd });
                     } else if (flagMenunggak.includes('npf') || flagMenunggak.includes('xday') || flagMenunggak.includes('sm')) {
                         items.push({ contact: c, type: 'payment', status: 'collection_ex', daysLeft: dpd });
                     }
                } 
                // --- PRIORITY 2: LANTAKUR (TABUNGAN KURANG) ---
                else if (flagLantakur.includes('lantakur')) {
                     items.push({ contact: c, type: 'payment', status: 'lantakur', daysLeft: 0 });
                }
                // --- PRIORITY 3: REFINANCING (JATUH TEMPO LANCAR) ---
                else {
                    // Logic: Show if Due This Month OR Next Month (Refinancing Window)
                    const currentMonth = today.getMonth();
                    const currentYear = today.getFullYear();
                    const dueMonth = dueDate.getMonth();
                    const dueYear = dueDate.getFullYear();
                    
                    const isRelevantMonth = 
                        (dueYear === currentYear && dueMonth === currentMonth) || 
                        (dueYear === currentYear && dueMonth === currentMonth + refiLookahead) ||
                        (dueYear === currentYear + 1 && currentMonth + refiLookahead >= 12 && dueMonth === (currentMonth + refiLookahead) % 12);

                    if (isRelevantMonth && !flag.includes('inactive') && !flag.includes('lunas')) {
                         if (diffDays === 0) items.push({ contact: c, type: 'payment', status: 'today', daysLeft: 0 });
                         else if (diffDays === 1) items.push({ contact: c, type: 'payment', status: 'soon', daysLeft: 1 });
                         else if (dueMonth === currentMonth) items.push({ contact: c, type: 'payment', status: 'this_month', daysLeft: diffDays });
                         else items.push({ contact: c, type: 'payment', status: 'next_month', daysLeft: diffDays });
                    }
                }
            }
        }
        
        // 2. PRS REMINDERS (Kumpulan) - H-1
        if (c.tglPrs && !flag.includes('inactive')) {
             let prsDate: Date | null = null;
             
             // Handle simple date "15" -> Convert to this month's date
             if (c.tglPrs.match(/^\d{1,2}$/)) {
                 const d = parseInt(c.tglPrs);
                 prsDate = new Date(today.getFullYear(), today.getMonth(), d);
                 // If date passed, assume next month
                 if (prsDate < today) {
                     prsDate.setMonth(prsDate.getMonth() + 1);
                 }
             } else {
                 // Try parse full date
                 const parts = c.tglPrs.split('/');
                 if (parts.length === 3) {
                     prsDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                 }
             }

             if (prsDate) {
                 const diffPrs = Math.ceil((prsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                 // Show alert if H-1 (Besok Kumpulan) or Today
                 if (diffPrs >= 0 && diffPrs <= prsThreshold) {
                      items.push({ contact: c, type: 'prs', status: 'soon', daysLeft: diffPrs });
                 }
             }
        }

        // 3. WINBACK (Lunas)
        if (c.tglLunas && (flag.includes('lunas') || flag.includes('do') || flag.includes('drop'))) {
             // Parse Lunas Date
             const parts = c.tglLunas.split('/');
             if (parts.length === 3) {
                 const lunasDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                 const monthsAgo = (today.getFullYear() - lunasDate.getFullYear()) * 12 + (today.getMonth() - lunasDate.getMonth());
                 
                 // Strategy: 
                 // Recent Winback: < 3 Months
                 // Old Winback: > 3 Months (Up to 12 months maybe?)
                 if (monthsAgo >= 1 && monthsAgo < 3) {
                      items.push({ contact: c, type: 'payment', status: 'winback_recent', daysLeft: 0 });
                 } else if (monthsAgo >= 3 && monthsAgo <= 12) {
                      items.push({ contact: c, type: 'payment', status: 'winback_old', daysLeft: 0 });
                 }
             }
        }
    });
    
    // Sort by priority: Collection > Lantakur > Today > Soon
    return items.sort((a, b) => {
        const score = (s: string) => {
            if (s === 'collection_ctx') return 0;
            if (s === 'collection_ex') return 1;
            if (s === 'lantakur') return 2;
            if (s === 'today') return 3;
            if (s === 'soon') return 4;
            return 99;
        }
        return score(a.status) - score(b.status);
    });
  }, [contacts, sheetConfig]);

  // Unique COs for Filtering
  const uniqueCos = useMemo(() => {
    return Array.from(new Set(contacts.map(c => c.co || 'Unassigned'))).sort();
  }, [contacts]);

  // Filtered Contacts for Home View
  const homeFilteredContacts = useMemo(() => {
     if (!deferredSearchTerm) return contacts;
     const lower = deferredSearchTerm.toLowerCase();
     return contacts.filter(c => 
         c.name.toLowerCase().includes(lower) || 
         c.phone.includes(lower) ||
         (c.sentra || '').toLowerCase().includes(lower)
     ).slice(0, 20); // Limit results for performance on home
  }, [contacts, deferredSearchTerm]);


  // --- HANDLERS ---

  const handleOpenMsgModal = (c: Contact) => {
    setSelectedContact(c);
    setIsMsgModalOpen(true);
  };

  const handleOpenEditModal = (c: Contact) => {
    setSelectedContact(c);
    setIsEditModalOpen(true);
  };

  const handleSaveContact = (updated: Contact) => {
    // Optimistic Update
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  };
  
  const handleDeleteContact = (id: string) => {
      // Optimistic Delete (Note: Won't delete from Sheet, just Hide)
      setContacts(prev => prev.filter(c => c.id !== id));
      alert("Kontak disembunyikan dari tampilan (Data di Sheet aman).");
  };

  const handleSavePlan = async (plan: DailyPlan) => {
      // 1. Send to Sheet
      if (sheetConfig.googleScriptUrl) {
           // Pass debugMode flag
           await submitPlanToSheet(sheetConfig.googleScriptUrl, plan, sheetConfig.enableDebugMode);
      } else {
          alert("URL Script belum disetting. Data hanya tersimpan lokal sementara.");
      }
      
      // 2. Update Local State
      setDailyPlans(prev => [...prev, plan]);
      alert("Rencana berhasil disimpan!");
  };

  // --- RENDER ---

  if (view === 'admin_login') {
    return <AdminLoginPanel onBack={() => setView('home')} onLogin={() => setView('admin_panel')} />;
  }

  if (view === 'admin_panel') {
    return (
      <AdminPanel 
        onBack={() => setView('home')}
        templates={templates}
        onUpdateTemplates={setTemplates}
        onResetData={() => setContacts([])}
        defaultTemplates={INITIAL_TEMPLATES_FALLBACK}
        onBulkUpdateMode={(mode) => {
             const updated = templates.map(t => ({ ...t, type: mode }));
             setTemplates(updated);
             saveTemplatesToSupabase(updated);
        }}
      />
    );
  }

  if (view === 'notifications') {
      return (
          <NotificationPanel 
            items={notificationItems} 
            onRemind={(c) => {
                setSelectedContact(c);
                setIsMsgModalOpen(true);
            }}
            onBack={() => setView('home')} 
          />
      );
  }

  if (view === 'broadcast') {
      return (
          <BroadcastPanel 
            contacts={contacts} 
            templates={templates} 
            onBack={() => setView('home')}
            apiKey={sheetConfig.geminiApiKey}
          />
      );
  }

  if (view === 'dashboard') {
      return (
          <DashboardPanel 
            contacts={contacts} 
            dailyPlans={dailyPlans} // Pass plan data
            onBack={() => setView('home')} 
          />
      );
  }

  if (view === 'contacts') {
      return (
          <ContactManagementPanel 
            contacts={contacts} 
            onEdit={handleOpenEditModal}
            onDelete={handleDeleteContact}
            onBack={() => setView('home')} 
          />
      );
  }

  if (view === 'plan_history') {
      return (
          <PlanHistoryPanel 
            plans={dailyPlans}
            availableCos={uniqueCos}
            onBack={() => setView('home')}
          />
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-safe">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm transition-all">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white p-2 rounded-xl shadow-lg shadow-orange-500/20">
               <Fingerprint className="w-5 h-5" />
            </div>
            <div>
                <h1 className="font-bold text-slate-800 text-lg leading-tight tracking-tight">B-Connect</h1>
                <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                   {isSyncing ? (
                       <><Loader2 className="w-3 h-3 animate-spin text-orange-500"/> Syncing...</>
                   ) : (
                       <><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online {lastSyncTime && `• ${lastSyncTime}`}</>
                   )}
                </p>
            </div>
          </div>
          
          <div className="flex gap-2">
             <button 
                onClick={() => setView('notifications')}
                className="relative p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
             >
                <Bell className="w-5 h-5" />
                {notificationItems.length > 0 && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
             </button>
             <button 
                onClick={() => setView('admin_login')}
                className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
             >
                <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {/* HERO SECTION */}
        {sheetConfig.showHeroSection && (
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 shadow-xl shadow-slate-900/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full blur-[80px] opacity-20 -mr-16 -mt-16"></div>
                <div className="relative z-10 text-white">
                    <h2 className="text-2xl font-bold mb-1">Halo, Pejuang Syariah! 👋</h2>
                    <p className="text-slate-300 text-sm mb-4">Siap melayani nasabah hari ini?</p>
                    
                    <div className="flex gap-3">
                        <Button 
                            size="sm" 
                            className="bg-white/10 hover:bg-white/20 border-white/10 backdrop-blur-md text-white shadow-none"
                            onClick={() => setIsTodoModalOpen(true)}
                            icon={<ClipboardList className="w-4 h-4 text-orange-400"/>}
                        >
                            Input Rencana
                        </Button>
                        <Button 
                            size="sm" 
                            className="bg-orange-500 hover:bg-orange-600 text-white border-none shadow-lg shadow-orange-500/30"
                            onClick={() => setView('plan_history')}
                            icon={<BarChart3 className="w-4 h-4"/>}
                        >
                            Cek Realisasi
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* QUICK MENU GRID */}
        <div className="grid grid-cols-4 gap-3">
            <button onClick={() => setView('dashboard')} className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 text-center leading-tight">Dashboard</span>
            </button>
            <button onClick={() => setView('broadcast')} className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Radio className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 text-center leading-tight">Broadcast</span>
            </button>
            <button onClick={() => setView('contacts')} className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ContactIcon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 text-center leading-tight">Kontak</span>
            </button>
            <button onClick={() => syncData()} disabled={isSyncing} className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className={`w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform ${isSyncing ? 'animate-spin' : ''}`}>
                    <RefreshCw className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 text-center leading-tight">Sync</span>
            </button>
        </div>

        {/* STATS OVERVIEW CARDS (Optional via Config) */}
        {sheetConfig.showStatsCards && (
            <div className="grid grid-cols-2 gap-3">
                 <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Nasabah</p>
                     <div className="flex items-center gap-2 mt-1">
                         <Users className="w-5 h-5 text-blue-500" />
                         <span className="text-2xl font-black text-slate-800">{contacts.length}</span>
                     </div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Follow Up</p>
                     <div className="flex items-center gap-2 mt-1">
                         <Bell className="w-5 h-5 text-red-500" />
                         <span className="text-2xl font-black text-slate-800">{notificationItems.length}</span>
                     </div>
                 </div>
            </div>
        )}

        {/* SEARCH & LIST */}
        <div className="space-y-4">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl leading-5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                    placeholder="Cari Nasabah, Sentra, atau HP..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
                    <p className="text-sm font-medium">Memuat Data Direktori...</p>
                </div>
            ) : homeFilteredContacts.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Search className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">Data tidak ditemukan.</p>
                    <p className="text-xs text-slate-400 mt-1">Coba kata kunci lain atau sync data.</p>
                </div>
            ) : (
                <div className="space-y-4 pb-20">
                    {searchTerm && (
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                            Hasil Pencarian ({homeFilteredContacts.length})
                        </p>
                    )}
                    
                    {homeFilteredContacts.map((contact) => (
                        <ContactCard 
                            key={contact.id} 
                            contact={contact} 
                            onEditClick={handleOpenEditModal}
                            onGenerateClick={handleOpenMsgModal}
                        />
                    ))}
                    
                    {!searchTerm && contacts.length > 20 && (
                        <div className="text-center pt-4">
                            <p className="text-xs text-slate-400 italic">Menampilkan 20 data teratas. Gunakan pencarian untuk hasil spesifik.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </main>

      {/* --- MODALS --- */}
      
      {selectedContact && (
        <MessageGeneratorModal
            contact={selectedContact}
            isOpen={isMsgModalOpen}
            onClose={() => setIsMsgModalOpen(false)}
            templates={templates}
            apiKey={sheetConfig.geminiApiKey}
        />
      )}

      {selectedContact && (
          <EditContactModal 
            contact={selectedContact}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleSaveContact}
            onDelete={handleDeleteContact}
            sheetConfig={sheetConfig}
          />
      )}

      <TodoInputModal 
          isOpen={isTodoModalOpen}
          onClose={() => setIsTodoModalOpen(false)}
          onSave={handleSavePlan}
          availableCos={uniqueCos}
          dailyPlans={dailyPlans}
          contacts={contacts}
      />

    </div>
  );
}