import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { Contact, MessageTemplate, SheetConfig } from './types';
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
import { Button } from './components/Button';
import { fetchContactsFromSheet } from './services/sheetService';
import { fetchTemplatesFromSupabase, fetchSettingsFromSupabase, isSupabaseConfigured, saveTemplatesToSupabase } from './services/supabaseService';
import { getSheetConfig } from './services/dbService';
import { GLOBAL_CONFIG } from './config';
import { Search, Users, Settings, Shield, RefreshCw, Sparkles, Bell, Globe, Briefcase, MapPin, HeartHandshake, Database, ChevronDown, Server, AlertTriangle, Home, Loader2, Download, X, Radio, Activity, TrendingUp, Contact as ContactIcon } from 'lucide-react';

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
            try {
                const liveContacts = await fetchContactsFromSheet(finalConfig.spreadsheetId, finalConfig.sheetName);
                setContacts(liveContacts);
            } catch (err) {
                console.error("Error fetching live contacts from Sheet:", err);
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

  // --- LOGIC NOTIFIKASI BARU (PRS H-1 & REFINANCING) ---
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
        const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
        
        // Date parsing helper
        const dueDate = contact.tglJatuhTempo ? parseFullDate(contact.tglJatuhTempo) : null;
        const lunasDate = contact.tglLunas ? parseFullDate(contact.tglLunas) : null;

        // 1. REFINANCING / PAYMENT LOGIC
        if (dueDate || lunasDate) {
            
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

        // 2. PRS LOGIC (H-1)
        if (contact.tglPrs && !isInactive) {
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
        // Sort Priority: Today > Tomorrow > This Month > Next Month > Winback Recent > Winback Old
        const score = (s: string) => {
            if (s === 'today') return 1;
            if (s === 'soon') return 2;
            if (s === 'this_month') return 3;
            if (s === 'next_month') return 4;
            if (s === 'winback_recent') return 5;
            if (s === 'winback_old') return 6;
            return 99;
        }
        return score(a.status) - score(b.status);
    });
  }, [contacts]);

  const uniqueSentras = useMemo(() => {
    let source = selectedCo ? contacts.filter(c => (c.co || 'Unassigned') === selectedCo) : contacts;
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
                            keywords = ['winback', 'gabung', 'sapa'];
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

  // Home View
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 pb-24 relative">
      
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">V1.0 STABLE</p>
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
      {activeConfig?.showHeroSection !== false && (
        <div className="bg-gradient-to-b from-white to-orange-50/80 border-b border-orange-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-orange-100 rounded-full blur-3xl opacity-40 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 bg-amber-100 rounded-full blur-3xl opacity-40 pointer-events-none"></div>

            <div className="max-w-4xl mx-auto px-6 py-8 relative z-10">
                <div className="mb-6">
                    <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-widest rounded-full mb-3 border border-orange-200">
                        BTPN Syariah
                    </span>
                    <h2 className="text-3xl font-extrabold text-slate-800 mb-3 leading-tight">
                        Borobudur
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
                            Berprestasi
                        </span>
                    </h2>
                    <p className="text-slate-600 text-sm leading-relaxed max-w-lg mb-4">
                        B-Connect CRM membantu Community Officer mengelola data nasabah sentra, memantau jadwal jatuh tempo, dan mengirim pesan personalisasi berbasis AI dalam satu genggaman.
                    </p>
                </div>
                
                {/* Stats Cards */}
                {activeConfig?.showStatsCards !== false && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users className="w-12 h-12 text-orange-600" />
                            </div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 relative z-10">Total Nasabah</p>
                            <p className="text-2xl font-black text-slate-800 relative z-10">{contacts.length}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <MapPin className="w-12 h-12 text-orange-600" />
                            </div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 relative z-10">Total Sentra</p>
                            <p className="text-xl font-black text-slate-800 relative z-10 truncate">{uniqueSentras.length}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Briefcase className="w-12 h-12 text-orange-600" />
                            </div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 relative z-10">Total CO</p>
                            <p className="text-xl font-black text-slate-800 relative z-10 truncate">{uniqueCos.length}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

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

           <div className="grid grid-cols-3 gap-2">
              <div className="relative">
                 <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                 <select
                    className="w-full pl-8 pr-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600 focus:outline-none focus:border-orange-500 appearance-none shadow-sm truncate"
                    value={selectedCo}
                    onChange={(e) => {
                        setSelectedCo(e.target.value);
                        setSelectedSentra(''); // Reset Sentra when CO changes
                    }}
                 >
                    <option value="">Semua CO</option>
                    {uniqueCos.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
              </div>

              <div className="relative">
                 <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                 <select
                    className="w-full pl-8 pr-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600 focus:outline-none focus:border-orange-500 appearance-none shadow-sm truncate"
                    value={selectedSentra}
                    onChange={(e) => setSelectedSentra(e.target.value)}
                 >
                    <option value="">Semua Sentra</option>
                    {uniqueSentras.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
              </div>

              <div className="relative">
                 <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                 <select
                    className="w-full pl-8 pr-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600 focus:outline-none focus:border-orange-500 appearance-none shadow-sm truncate"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                 >
                    <option value="All">Semua Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
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
                    {debouncedSearchTerm || selectedSentra || selectedCo || selectedStatus !== 'All' ? (
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