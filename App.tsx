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
  { id: '1', name: 'Ibu Siti Aminah', phone: '081299998888', flag: 'Platinum', sentra: 'Mawar Indah', lastInteraction: '12 Okt 2023', notes: 'Ketua Sentra', tglJatuhTempo: '25' },
  { id: '2', name: 'Ibu Ratna', phone: '081377776666', flag: 'Gold', sentra: 'Melati Putih', lastInteraction: '20 Okt 2023', notes: 'Rajin hadir PRS', tglJatuhTempo: '5' },
  { id: '3', name: 'Ibu Yanti', phone: '085655554444', flag: 'Prospect', sentra: 'Anggrek', lastInteraction: 'Kemarin', notes: 'Baru tanya pembiayaan' },
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

            // Simple Migration Logic for old 'segment' field
            const migratedContacts = dbContacts.map((c: any) => ({
                ...c,
                flag: c.flag || c.segment || 'Prospect',
                status: c.status || c.statusAsli || ''
            }));

            // If empty, initialize with fallbacks and save to DB
            if (migratedContacts.length === 0) {
                await saveBulkContacts(INITIAL_DATA_FALLBACK);
                setContacts(INITIAL_DATA_FALLBACK);
            } else {
                setContacts(migratedContacts);
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

    // Calculate days until specific day of month (1-31)
    const getDaysUntilDayOfMonth = (targetDay: number) => {
        // If target day is today
        if (targetDay === currentDay) return 0;
        
        let targetDate = new Date(currentYear, currentMonth, targetDay);
        
        // If day has passed this month, assume it refers to next month
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
        
        // Check if it's a number (Day of Month, e.g., "25") or Full Date (e.g., "2023-10-25")
        // Clean non-numeric except separators
        const cleanDate = c.tglJatuhTempo.trim();
        
        // Try to see if it's just 1-2 digits
        if (/^\d{1,2}$/.test(cleanDate)) {
            const day = parseInt(cleanDate, 10);
            if (day >= 1 && day <= 31) targetDay = day;
        } else {
            // Try to parse as Date
            const parsed = Date.parse(cleanDate);
            if (!isNaN(parsed)) {
                const d = new Date(parsed);
                targetDay = d.getDate();
            } else {
                // Try fallback regex extraction for "Tgl 25"
                const match = cleanDate.match(/(\d+)/);
                if (match) {
                     const day = parseInt(match[0], 10);
                     if (day >= 1 && day <= 31) targetDay = day;
                }
            }
        }

        if (targetDay !== null) {
            const diff = getDaysUntilDayOfMonth(targetDay);
            // Alert if Today (0) or within next 3 days (1,2,3)
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

  const handleSyncSheet = async () => {
    const config = await getSheetConfig();
    
    if (!config || !config.spreadsheetId) {
        alert("Konfigurasi Google Sheet belum diatur. Silakan ke Menu Admin.");
        setIsAdminModalOpen(true);
        return;
    }

    if (window.confirm("Sync akan memperbarui Data Bank (Plafon, Status, PRS) dari Google Sheet, namun tetap mempertahankan Edit Lokal (Nama, Notes) Anda. Lanjutkan?")) {
        setIsSyncing(true);
        try {
            const sheetContacts = await fetchContactsFromSheet(config.spreadsheetId, config.sheetName);
            
            // Helper: Normalize phone
            const normalizePhone = (p: string) => p.replace(/[^0-9]/g, '');
            // Helper: Normalize Name+Sentra Key for matching when phone is missing
            const generateNameKey = (c: Contact) => `${c.name.trim().toLowerCase()}_${(c.sentra || '').trim().toLowerCase()}`;

            const currentContacts = await getAllContacts();
            
            // Build Maps for efficient Lookup
            const dbPhoneMap = new Map<string, Contact>();
            const dbNameMap = new Map<string, Contact>();

            currentContacts.forEach(c => {
                const p = normalizePhone(c.phone);
                if (p.length >= 5) {
                    dbPhoneMap.set(p, c);
                }
                // Always add to name map as fallback
                dbNameMap.set(generateNameKey(c), c);
            });
            
            let newCount = 0;
            let updatedCount = 0;
            const processedIds = new Set<string>();
            const mergedList: Contact[] = [];

            // Process Sheet Rows
            sheetContacts.forEach(sc => {
                const cleanPhone = normalizePhone(sc.phone);
                
                // 1. Try Match by Phone
                let existing = cleanPhone.length >= 5 ? dbPhoneMap.get(cleanPhone) : undefined;
                
                // 2. If not found by phone, Try Match by Name+Sentra
                if (!existing) {
                    existing = dbNameMap.get(generateNameKey(sc));
                }

                if (existing) {
                    // Avoid processing same existing contact twice (e.g. if sheet has duplicates)
                    if (processedIds.has(existing.id)) return;
                    
                    // SMART MERGE:
                    const merged: Contact = {
                        ...existing, 
                        
                        // Force Update Financial/System Fields from Sheet
                        plafon: sc.plafon || existing.plafon,
                        tglJatuhTempo: sc.tglJatuhTempo || existing.tglJatuhTempo,
                        tglPrs: sc.tglPrs || existing.tglPrs,
                        produk: sc.produk || existing.produk,
                        status: sc.status || existing.status,
                        co: sc.co || existing.co,
                        sentra: sc.sentra || existing.sentra,
                        
                        // If local has no phone but sheet does, update it
                        phone: (existing.phone.length < 5 && sc.phone.length >= 5) ? sc.phone : existing.phone,

                        // Name: prefer Sheet if Local is "Tanpa Nama"
                        name: (existing.name === 'Tanpa Nama' && sc.name) ? sc.name : existing.name,
                        
                        // Flag: prefer Sheet if Local is default
                        flag: ((existing.flag === 'Prospect' || existing.flag === 'Active') && sc.flag) ? sc.flag : existing.flag
                    };

                    mergedList.push(merged);
                    processedIds.add(existing.id);
                    updatedCount++;
                } else {
                    // New Contact
                    mergedList.push(sc);
                    newCount++;
                }
            });
            
            // 3. Keep existing contacts that were NOT in the sheet? 
            // Usually Sync means "Make app look like sheet". 
            // But if user added manual contacts, we should keep them.
            // Current Strategy: If it was in DB but not matched in Sheet, KEEP IT (Manual additions).
            currentContacts.forEach(c => {
                if (!processedIds.has(c.id)) {
                    mergedList.push(c);
                }
            });
            
            await saveBulkContacts(mergedList);
            setContacts(mergedList);
            
            alert(`Sync Selesai!\nTotal Database: ${mergedList.length}\nData Baru: ${newCount}\nData Diupdate: ${updatedCount}`);
        } catch (e: any) {
            console.error(e);
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
                    // Find 'Info Angsuran' template or use first available
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
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Direktori Nasabah</p>
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
                        className="whitespace-nowrap shadow-lg shadow-cyan-500/20"
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
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                    Daftar Nasabah {selectedSentra ? `- ${selectedSentra}` : ''} ({filteredContacts.length})
                </h2>
            </div>
            
            {isLoadingData ? (
                 <div className="text-center py-20">
                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                     <p className="text-slate-500 animate-pulse">Memuat Database...</p>
                 </div>
            ) : filteredContacts.length === 0 ? (
                <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                        <Users className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500 mb-6 font-medium">Tidak ada nasabah ditemukan.</p>
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