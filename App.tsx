
import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Contact, MessageTemplate, SheetConfig, DailyPlan } from './types';
import { MessageGeneratorModal } from './components/MessageGeneratorModal';
import { EditContactModal } from './components/EditContactModal';
import { AdminPanel } from './components/AdminModal';
import { AdminLoginPanel } from './components/AdminLoginModal';
import { NotificationPanel, NotificationItem } from './components/NotificationPanel';
import { BroadcastPanel } from './components/BroadcastPanel';
import { DashboardPanel } from './components/DashboardPanel';
import { ContactManagementPanel } from './components/ContactManagementPanel';
import { TodoInputModal } from './components/TodoInputModal'; 
import { PlanHistoryPanel } from './components/PlanHistoryPanel'; 
import { ImportModal } from './components/ImportModal';
import { Button } from './components/Button';
import { fetchContactsFromSheet, submitPlanToSheet, fetchPlansFromSheet } from './services/sheetService';
import { fetchTemplatesFromSupabase, fetchSettingsFromSupabase, isSupabaseConfigured, saveTemplatesToSupabase, fetchPlansFromSupabase, savePlanToSupabase } from './services/supabaseService';
import { getSheetConfig, saveSheetConfig, getAllTemplates, saveBulkTemplates } from './services/dbService';
import { Home, Bell, Radio, Settings, Trophy, RefreshCw, AlertTriangle, ClipboardList, Calendar, BarChart3, TrendingUp, Contact as ContactIcon, ChevronRight, Briefcase } from 'lucide-react';

// REKOMENDASI TEMPLATE DEFAULT
const INITIAL_TEMPLATES_FALLBACK: MessageTemplate[] = [
  { id: '1', label: 'Pengingat PRS (Besok)', type: 'ai', promptContext: 'Ingatkan Ibu nasabah untuk hadir di Pertemuan Rutin Sentra (PRS) BESOK. Sampaikan pentingnya kehadiran.', icon: '👥' },
  { id: 'manual-1', label: 'Konfirmasi Hadir (Cek)', type: 'manual', content: 'Assalamualaikum Ibu {name}, besok hadir di kumpulan sentra {sentra} kan Bu? Ditunggu ya.', icon: '🗓️' },
  { id: '2', label: 'Tawaran Lanjut (Cair)', type: 'ai', promptContext: 'Nasabah ini sebentar lagi lunas. Tawarkan tambah modal.', icon: '💰' },
  { id: '6', label: 'Penagihan Menunggak (CTX)', type: 'ai', promptContext: 'Buat pesan penagihan tegas namun sopan untuk nasabah menunggak (CTX).', icon: '⚠️' },
];

const DEFAULT_EMPTY_CONFIG: SheetConfig = {
    spreadsheetId: '',
    sheetName: 'Data',
    planSheetName: 'Plan',
    googleScriptUrl: '',
    geminiApiKey: '',
    prsThresholdDays: 1,
    refinancingLookaheadMonths: 1,
    showHeroSection: true,
    showStatsCards: true,
    enableDebugMode: false
};

type AppView = 'home' | 'notifications' | 'broadcast' | 'settings' | 'dashboard' | 'contacts' | 'login' | 'plans';

// Helper: Parse Date once outside component to reuse
const parseFullDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const clean = dateStr.trim();
    const partsIndo = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (partsIndo) {
        const d = parseInt(partsIndo[1], 10);
        const m = parseInt(partsIndo[2], 10) - 1; 
        const y = parseInt(partsIndo[3], 10);
        const dateObj = new Date(y, m, d);
        if (dateObj.getFullYear() === y && dateObj.getMonth() === m && dateObj.getDate() === d) return dateObj;
    }
    const parsed = Date.parse(clean);
    return !isNaN(parsed) ? new Date(parsed) : null;
};

const App: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [configError, setConfigError] = useState<boolean>(false);
  const [activeConfig, setActiveConfig] = useState<SheetConfig | null>(null);
  const [activeView, setActiveView] = useState<AppView>('home');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialTemplateId, setInitialTemplateId] = useState<string | undefined>(undefined);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoadingData(true);
    setConfigError(false);
    try {
        let finalConfig: SheetConfig = { ...DEFAULT_EMPTY_CONFIG };
        let configFound = false;
        
        // 1. CONFIGURATION LOADING
        // Try Supabase first (Source of Truth)
        if (isSupabaseConfigured()) {
            try {
                const supabaseSettings = await fetchSettingsFromSupabase();
                if (supabaseSettings && supabaseSettings.spreadsheetId) {
                    finalConfig = { ...finalConfig, ...supabaseSettings };
                    configFound = true;
                    // Cache config locally
                    await saveSheetConfig(finalConfig);
                }
            } catch (err) {
                console.warn("Supabase config fetch failed, falling back to local.");
            }
        }

        // Try Local DB if Supabase failed or empty
        if (!configFound) {
             try {
                const localConfig = await getSheetConfig();
                if (localConfig && localConfig.spreadsheetId) {
                     finalConfig = { ...finalConfig, ...localConfig };
                     configFound = true;
                }
             } catch (e) {
                 console.warn("Local config fetch failed.");
             }
        }
        
        setActiveConfig(finalConfig);

        // 2. DATA LOADING (If Config Exists)
        if (configFound && finalConfig.spreadsheetId) {
            // A. Contacts from Sheet
            try {
                const liveContacts = await fetchContactsFromSheet(finalConfig.spreadsheetId, finalConfig.sheetName);
                setContacts(liveContacts);
            } catch (err) {
                console.error("Sheet fetch error:", err);
            }
            
            // B. Plans from Supabase (Priority)
            if (isSupabaseConfigured()) {
                try {
                    const dbPlans = await fetchPlansFromSupabase();
                    setDailyPlans(dbPlans);
                } catch (err) {
                    console.error("Plans fetch failed:", err);
                }
            }

            // C. Templates (Supabase -> Local -> Fallback)
            let loadedTemplates: MessageTemplate[] = [];
            
            // Try Supabase
            if (isSupabaseConfigured()) {
                try {
                    const sbTemplates = await fetchTemplatesFromSupabase();
                    if (sbTemplates && sbTemplates.length > 0) {
                        loadedTemplates = sbTemplates;
                        // Cache to local DB for offline access
                        await saveBulkTemplates(sbTemplates);
                    }
                } catch (err) {
                    console.warn("Supabase templates fetch failed, trying local.");
                }
            }

            // Try Local DB if Supabase failed or returned nothing
            if (loadedTemplates.length === 0) {
                try {
                    const localTemplates = await getAllTemplates();
                    if (localTemplates && localTemplates.length > 0) {
                        loadedTemplates = localTemplates;
                    }
                } catch (err) {
                    console.warn("Local templates fetch failed.");
                }
            }

            // Fallback
            if (loadedTemplates.length === 0) {
                loadedTemplates = INITIAL_TEMPLATES_FALLBACK;
            }

            setTemplates(loadedTemplates);

        } else {
            // No Config
            setConfigError(true);
            setTemplates(INITIAL_TEMPLATES_FALLBACK);
        }
    } catch (e) {
        console.error("Init failed:", e);
    } finally {
        setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- OPTIMIZED NOTIFICATION LOGIC ---
  const upcomingEvents = useMemo(() => {
    if (contacts.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const nextMonth = (currentMonth + 1) % 12;
    const nextMonthYear = nextMonth === 0 ? currentYear + 1 : currentYear;

    const result: NotificationItem[] = [];

    // Single pass loop for performance
    for (const contact of contacts) {
        const flag = (contact.flag || '').toLowerCase();
        const status = (contact.status || '').toLowerCase();
        const flagMenunggak = (contact.flagMenunggak || '').toLowerCase();
        
        const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
        const isCtx = flagMenunggak.includes('ctx');
        const isExCtx = flagMenunggak.includes('xday') || flagMenunggak.includes('sm') || flagMenunggak.includes('npf') || flagMenunggak.includes('macet');
        const dpd = parseInt(contact.dpd || '0', 10) || 0;
        const isGenericTrouble = dpd > 0 || status.includes('macet') || status.includes('menunggak');
        const isLantakur = (contact.flagLantakur || '').toLowerCase().includes('lantakur');

        // 1. Troubles
        if (isCtx && !isInactive) {
            result.push({ contact, type: 'payment', status: 'collection_ctx', daysLeft: dpd });
            continue;
        }
        if ((isExCtx || isGenericTrouble) && !isInactive) {
            result.push({ contact, type: 'payment', status: 'collection_ex', daysLeft: dpd });
            continue;
        }
        if (isLantakur && !isInactive) {
            result.push({ contact, type: 'payment', status: 'lantakur', daysLeft: 0 });
            continue;
        }

        // 2. Dates (Parse only if needed)
        const dueDate = contact.tglJatuhTempo ? parseFullDate(contact.tglJatuhTempo) : null;
        const lunasDate = contact.tglLunas ? parseFullDate(contact.tglLunas) : null;

        if (!isInactive && dueDate) {
             const dm = dueDate.getMonth();
             const dy = dueDate.getFullYear();
             if (dy === currentYear && dm === currentMonth) {
                 const isToday = dueDate.getDate() === today.getDate();
                 result.push({ contact, type: 'payment', status: isToday ? 'today' : 'this_month', daysLeft: 0 });
             } else if (dy === nextMonthYear && dm === nextMonth) {
                 result.push({ contact, type: 'payment', status: 'next_month', daysLeft: 0 });
             }
        } else if (isInactive && (lunasDate || dueDate)) {
            const refDate = lunasDate || dueDate;
            if (refDate) {
                const monthsAgo = (today.getFullYear() - refDate.getFullYear()) * 12 + (today.getMonth() - refDate.getMonth());
                if (monthsAgo >= 1 && monthsAgo <= 12) {
                    result.push({ contact, type: 'payment', status: monthsAgo < 3 ? 'winback_recent' : 'winback_old', daysLeft: 0 });
                }
            }
        }

        // 3. PRS Logic
        if (contact.tglPrs && !isInactive) {
             let prsDate: Date | null = null;
             // Handle "15" -> Date
             if (contact.tglPrs.match(/^\d{1,2}$/)) {
                 const tDay = parseInt(contact.tglPrs);
                 prsDate = new Date(currentYear, currentMonth, tDay);
                 if (prsDate < today) prsDate.setMonth(prsDate.getMonth() + 1);
             } else {
                 prsDate = parseFullDate(contact.tglPrs);
             }

             if (prsDate) {
                 const diff = Math.ceil((prsDate.getTime() - today.getTime()) / (86400000));
                 if (diff === 0) result.push({ contact, type: 'prs', status: 'today', daysLeft: 0 });
                 else if (diff === 1) result.push({ contact, type: 'prs', status: 'soon', daysLeft: 1 });
             }
        }
    }

    return result.sort((a, b) => {
        // Priority Score
        const getScore = (s: string) => {
            if (s === 'collection_ctx') return 0;
            if (s === 'collection_ex') return 1;
            if (s === 'today') return 2;
            if (s === 'soon') return 3;
            if (s === 'lantakur') return 4;
            return 10;
        };
        return getScore(a.status) - getScore(b.status);
    });
  }, [contacts]);

  // Derived Stats
  const uniqueSentras = useMemo(() => Array.from(new Set(contacts.map(c => c.sentra || 'Unknown'))).length, [contacts]);
  const uniqueCos = useMemo(() => Array.from(new Set(contacts.map(c => c.co || 'Unassigned'))).sort(), [contacts]);
  const totalActiveContacts = useMemo(() => contacts.filter(c => !(c.flag||'').toLowerCase().match(/do|drop|lunas|tutup|inactive/)).length, [contacts]);

  // Today's Plan Logic
  const todaysPlan = useMemo(() => {
      const todayStr = new Date().toLocaleDateString('id-ID'); // D/M/YYYY
      // Normalize to D/M/YYYY without leading zeros for safe comparison
      const norm = (s: string) => s.split('/').map(p => parseInt(p,10)).join('/');
      const target = norm(todayStr);
      
      const plansToday = dailyPlans.filter(p => norm(p.date) === target);
      if (plansToday.length === 0) return null;

      // Aggregator
      return plansToday.reduce((acc, curr) => ({
          ...acc,
          swCurrentNoa: String((parseInt(acc.swCurrentNoa)||0) + (parseInt(curr.swCurrentNoa)||0)),
          colCtxNoa: String((parseInt(acc.colCtxNoa)||0) + (parseInt(curr.colCtxNoa)||0)),
          colLantakurNoa: String((parseInt(acc.colLantakurNoa)||0) + (parseInt(curr.colLantakurNoa)||0)),
          date: todayStr
      }));
  }, [dailyPlans]);

  const handleSyncSheet = async () => {
    setIsSyncing(true);
    try {
        if (!activeConfig?.spreadsheetId) {
            await loadData();
            return;
        }

        // 1. Fetch Contacts (Existing)
        const liveContacts = await fetchContactsFromSheet(activeConfig.spreadsheetId, activeConfig.sheetName);
        setContacts(liveContacts);

        // 2. Fetch Plans from Sheet (NEW: 2-Way Sync Read)
        const sheetPlans = await fetchPlansFromSheet(activeConfig.spreadsheetId, activeConfig.planSheetName || 'Plan');
        
        // 3. Update Local State
        if (sheetPlans.length > 0) {
            setDailyPlans(sheetPlans);
            
            // 4. Update Supabase (Sync Sheet -> Supabase)
            if (isSupabaseConfigured()) {
                // Upsert all fetched plans to Supabase to ensure it matches Sheet
                await Promise.all(sheetPlans.map(p => savePlanToSupabase(p)));
            }
        } else {
            // Fallback to Supabase if sheet is empty or fail
             if (isSupabaseConfigured()) {
                const dbPlans = await fetchPlansFromSupabase();
                setDailyPlans(dbPlans);
            }
        }

    } catch (e) {
        console.error("Sync failed:", e);
        alert("Gagal sinkronisasi data. Periksa koneksi internet.");
    } finally {
        setIsSyncing(false);
    }
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
  };

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleSavePlan = async (plan: DailyPlan) => {
     // 1. Save to State
     setDailyPlans(prev => {
         const idx = prev.findIndex(p => p.id === plan.id);
         return idx >= 0 ? prev.map((p, i) => i === idx ? plan : p) : [...prev, plan];
     });

     // 2. Save to Supabase (Database)
     if (isSupabaseConfigured()) {
         await savePlanToSupabase(plan);
     } else {
         console.warn("Database Supabase belum dikonfigurasi.");
     }

     // 3. Save to Google Sheet (NEW: 2-Way Sync Write)
     if (activeConfig?.googleScriptUrl) {
         // Fire and forget to avoid blocking UI
         submitPlanToSheet(activeConfig.googleScriptUrl, plan, activeConfig.enableDebugMode);
     }
  };

  const handleBulkUpdateMode = async (mode: 'ai' | 'manual') => {
      const updated = templates.map(t => ({ ...t, type: mode }));
      setTemplates(updated);
      
      // Update Local DB
      await saveBulkTemplates(updated);
      
      // Update Cloud
      if (isSupabaseConfigured()) await saveTemplatesToSupabase(updated);
  };

  const renderBottomNav = () => (
    <div className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 z-40 pb-safe">
        <div className="flex justify-between items-center px-4 py-2 max-w-md mx-auto">
            <button onClick={() => setActiveView('home')} className={`nav-btn ${activeView === 'home' ? 'active' : ''}`}>
                <Home className="w-5 h-5 mb-0.5" /><span className="text-[9px]">Beranda</span>
            </button>
            <button onClick={() => setActiveView('dashboard')} className={`nav-btn ${activeView === 'dashboard' || activeView === 'plans' ? 'active' : ''}`}>
                <TrendingUp className="w-5 h-5 mb-0.5" /><span className="text-[9px]">Kinerja</span>
            </button>
            <button onClick={() => setActiveView('contacts')} className={`nav-btn ${activeView === 'contacts' ? 'active' : ''}`}>
                <ContactIcon className="w-5 h-5 mb-0.5" /><span className="text-[9px]">Kontak</span>
            </button>
            <div className="relative">
                <button onClick={() => setActiveView('notifications')} className={`nav-btn ${activeView === 'notifications' ? 'active' : ''}`}>
                    <Bell className="w-5 h-5 mb-0.5" /><span className="text-[9px]">Follow Up</span>
                </button>
                {upcomingEvents.length > 0 && <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
            </div>
            <button onClick={() => setActiveView('broadcast')} className={`nav-btn ${activeView === 'broadcast' ? 'active' : ''}`}>
                <Radio className="w-5 h-5 mb-0.5" /><span className="text-[9px]">Siaran</span>
            </button>
            <button onClick={() => setActiveView('login')} className={`nav-btn ${activeView === 'settings' || activeView === 'login' ? 'active' : ''}`}>
                <Settings className="w-5 h-5 mb-0.5" /><span className="text-[9px]">Admin</span>
            </button>
        </div>
        <style>{`.nav-btn { @apply flex flex-col items-center p-2 rounded-xl transition-colors text-slate-400 hover:text-orange-600; } .nav-btn.active { @apply text-orange-600 bg-orange-50; }`}</style>
    </div>
  );

  // VIEW ROUTING
  if (activeView === 'login') return <AdminLoginPanel onBack={() => setActiveView('home')} onLogin={() => setActiveView('settings')} />;
  if (activeView === 'settings') return <><AdminPanel onBack={() => setActiveView('home')} templates={templates} onUpdateTemplates={setTemplates} onResetData={async () => { await loadData(); setActiveView('home'); }} defaultTemplates={INITIAL_TEMPLATES_FALLBACK} onBulkUpdateMode={handleBulkUpdateMode} currentConfig={activeConfig} />{renderBottomNav()}</>;
  if (activeView === 'notifications') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30"><NotificationPanel items={upcomingEvents} onBack={() => setActiveView('home')} onRemind={(contact, type) => { setSelectedContact(contact); }} />{selectedContact && <MessageGeneratorModal contact={selectedContact} isOpen={!!selectedContact} onClose={() => setSelectedContact(null)} templates={templates} initialTemplateId={initialTemplateId} apiKey={activeConfig?.geminiApiKey} />}{renderBottomNav()}</div>;
  if (activeView === 'broadcast') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30"><BroadcastPanel contacts={contacts} templates={templates} onBack={() => setActiveView('home')} apiKey={activeConfig?.geminiApiKey} />{renderBottomNav()}</div>;
  if (activeView === 'dashboard') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30"><div className="max-w-4xl mx-auto px-4 pt-4"><Button variant="outline" className="w-full justify-between bg-white/80 backdrop-blur" onClick={() => setActiveView('plans')} icon={<BarChart3 className="w-5 h-5 text-blue-600" />}><span className="font-bold text-slate-700">Lihat Riwayat & Realisasi Rencana</span><ChevronRight className="w-4 h-4 text-slate-400" /></Button></div><DashboardPanel contacts={contacts} onBack={() => setActiveView('home')} />{renderBottomNav()}</div>;
  if (activeView === 'plans') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30"><PlanHistoryPanel plans={dailyPlans} onBack={() => setActiveView('dashboard')} availableCos={uniqueCos} />{renderBottomNav()}</div>;
  if (activeView === 'contacts') return <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30"><ContactManagementPanel contacts={contacts} onEdit={setContactToEdit} onDelete={handleDeleteContact} onBack={() => setActiveView('home')} /><EditContactModal contact={contactToEdit} isOpen={!!contactToEdit} onClose={() => setContactToEdit(null)} onSave={handleUpdateContact} onDelete={handleDeleteContact} sheetConfig={activeConfig} />{renderBottomNav()}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 pb-24 relative">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-2 rounded-xl shadow-lg shadow-orange-500/20 text-white">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none">Borobudur <span className="text-orange-600">Berprestasi</span></h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mobile CRM System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Button onClick={handleSyncSheet} size="sm" variant="outline" className="h-8 border-orange-200 text-orange-600 hover:bg-orange-50" icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}>{isSyncing ? 'Syncing' : 'Sync'}</Button>
          </div>
        </div>
      </header>
      
      {configError && (
          <div className="max-w-4xl mx-auto px-4 py-2 mt-2">
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /><div><p className="text-xs font-bold uppercase">Setup Diperlukan</p><p className="text-xs opacity-80">Database belum dikonfigurasi.</p></div></div>
                  <Button size="sm" variant="danger" onClick={() => setActiveView('login')}>Buka Admin</Button>
              </div>
          </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-3xl p-6 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                    <h2 className="text-2xl font-black mb-1">Halo, Pejuang!</h2>
                    <p className="text-orange-50 text-sm leading-relaxed max-w-[90%]">CRM Monitoring & AI Wording Generator.</p>
                    <div className="flex gap-4 mt-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex-1 border border-white/20">
                            <p className="text-xs text-orange-100 uppercase font-bold mb-1">Nasabah</p>
                            <p className="text-2xl font-black">{totalActiveContacts}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex-1 border border-white/20">
                            <p className="text-xs text-orange-100 uppercase font-bold mb-1">Sentra</p>
                            <p className="text-2xl font-black">{uniqueSentras}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => setIsTodoModalOpen(true)} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-orange-300 transition-all text-left group">
                     <div className="bg-orange-50 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-orange-100"><ClipboardList className="w-5 h-5 text-orange-600" /></div>
                     <h3 className="font-bold text-slate-700 text-sm">Input Rencana</h3>
                     <p className="text-[10px] text-slate-400 mt-1">Target Harian</p>
                 </button>
                 <button onClick={() => setActiveView('notifications')} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group">
                     <div className="bg-blue-50 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100"><Calendar className="w-5 h-5 text-blue-600" /></div>
                     <h3 className="font-bold text-slate-700 text-sm">Agenda Follow Up</h3>
                     <p className="text-[10px] text-slate-400 mt-1">Jatuh Tempo & PRS</p>
                 </button>
                 <button onClick={() => setActiveView('plans')} className="col-span-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group flex items-center justify-between">
                     <div><h3 className="font-bold text-slate-700 text-sm">Monitoring Realisasi</h3><p className="text-[10px] text-slate-400 mt-1">Cek Plan vs Aktual Hari Ini</p></div>
                     <div className="bg-emerald-50 w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-emerald-100"><BarChart3 className="w-5 h-5 text-emerald-600" /></div>
                 </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Briefcase className="w-4 h-4 text-slate-500" /> Rencana Hari Ini (Total)</h3>
                    <span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono text-slate-500">{todaysPlan ? todaysPlan.date : new Date().toLocaleDateString('id-ID')}</span>
                </div>
                {todaysPlan ? (
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-slate-50 rounded-lg"><p className="text-[9px] text-slate-400 uppercase font-bold">SW</p><p className="font-black text-slate-700">{todaysPlan.swCurrentNoa}</p></div>
                        <div className="p-2 bg-slate-50 rounded-lg"><p className="text-[9px] text-slate-400 uppercase font-bold">CTX</p><p className="font-black text-slate-700">{todaysPlan.colCtxNoa}</p></div>
                        <div className="p-2 bg-slate-50 rounded-lg"><p className="text-[9px] text-slate-400 uppercase font-bold">Par</p><p className="font-black text-slate-700">{todaysPlan.colLantakurNoa}</p></div>
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2"><BarChart3 className="w-5 h-5 text-slate-300" /></div>
                        <p className="text-xs text-slate-400 font-bold">Belum ada data.</p>
                        <button onClick={() => setIsTodoModalOpen(true)} className="text-[10px] text-blue-600 font-bold mt-1 hover:underline">+ Input Baru</button>
                    </div>
                )}
            </div>
      </main>

      <TodoInputModal isOpen={isTodoModalOpen} onClose={() => setIsTodoModalOpen(false)} onSave={handleSavePlan} availableCos={uniqueCos} dailyPlans={dailyPlans} contacts={contacts} />
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={(newContacts) => setContacts([...contacts, ...newContacts])} apiKey={activeConfig?.geminiApiKey} />
      {renderBottomNav()}
    </div>
  );
};

export default App;
