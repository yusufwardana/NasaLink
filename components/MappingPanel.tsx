
import React, { useState, useMemo, useEffect } from 'react';
import { Contact, SheetConfig } from '../types';
import { Button } from './Button';
import { ArrowLeft, Filter, Search, ChevronDown, CheckCircle2, AlertTriangle, UserCheck, CalendarDays, MapPin, ListFilter, Save, Loader2, RefreshCw, Wand2, Cloud } from 'lucide-react';
import { saveContactsBatchToSupabase } from '../services/supabaseService';

interface MappingPanelProps {
  contacts: Contact[];
  onBack: () => void;
  config: SheetConfig | null;
  onUpdateContact: (contact: Contact) => void;
  onGenerateMessage: (contact: Contact) => void;
}

const MAPPING_OPTIONS = [
    'Lanjut', 
    'Istirahat', 
    'Bayar mundur', 
    'Sakit', 
    'Tidak boleh suami', 
    'Loan sharing'
];

const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const normalize = (str?: string) => (str || '').trim();
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const MappingPanel: React.FC<MappingPanelProps> = ({ 
  contacts, 
  onBack,
  config,
  onUpdateContact,
  onGenerateMessage
}) => {
  const [filterCo, setFilterCo] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All'); 
  const [filterStatus, setFilterStatus] = useState<string>('All'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  
  const parseDateParts = (dateStr?: string) => {
      if (!dateStr) return null;
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const yStr = parts[2];
      const y = yStr.length === 2 ? parseInt('20' + yStr, 10) : parseInt(yStr, 10);
      return { d, m, y };
  };

  const activeContacts2026 = useMemo(() => {
      return contacts.filter(c => {
          const flag = (c.flag || '').toLowerCase();
          const isActive = !flag.includes('do') && !flag.includes('drop') && !flag.includes('lunas') && !flag.includes('inactive');
          if (!isActive || !c.tglJatuhTempo) return false;
          const p = parseDateParts(c.tglJatuhTempo);
          return p && p.y === 2026;
      });
  }, [contacts]);

  const uniqueMonths = useMemo(() => {
      const months = new Set<string>();
      activeContacts2026.forEach(c => {
          const p = parseDateParts(c.tglJatuhTempo);
          if (p) {
              months.add(`${String(p.m).padStart(2,'0')}/${p.y}`);
          }
      });
      return Array.from(months).sort((a, b) => {
          const [m1] = a.split('/').map(Number);
          const [m2] = b.split('/').map(Number);
          return m1 - m2;
      });
  }, [activeContacts2026]);

  const availableCos = useMemo((): string[] => {
      let source = activeContacts2026;
      if (filterMonth !== 'All') {
          source = source.filter(c => {
              const p = parseDateParts(c.tglJatuhTempo);
              if (!p) return false;
              const mKey = `${String(p.m).padStart(2,'0')}/${p.y}`;
              return mKey === filterMonth;
          });
      }
      const cos = new Set<string>(source.map(c => normalize(c.co || 'Unassigned')));
      return Array.from(cos).sort();
  }, [activeContacts2026, filterMonth]);

  useEffect(() => {
      if (filterCo !== 'All' && !availableCos.includes(filterCo)) {
          setFilterCo('All');
      }
  }, [availableCos, filterCo]);

  useEffect(() => {
      setVisibleCount(20);
  }, [filterCo, filterMonth, filterStatus, searchTerm]);

  const filteredContacts = useMemo(() => {
      return activeContacts2026.filter(c => {
          const p = parseDateParts(c.tglJatuhTempo);
          if (!p) return false;

          if (searchTerm) {
              const term = searchTerm.toLowerCase();
              if (!c.name.toLowerCase().includes(term) && !c.sentra?.toLowerCase().includes(term)) return false;
          }
          
          if (filterMonth !== 'All') {
              const mKey = `${String(p.m).padStart(2,'0')}/${p.y}`;
              if (mKey !== filterMonth) return false;
          }

          if (filterCo !== 'All') {
              const contactCo = normalize(c.co || 'Unassigned');
              if (contactCo !== filterCo) return false;
          }

          const currentMapping = pendingChanges[c.id] !== undefined ? pendingChanges[c.id] : c.mapping;
          
          if (filterStatus === 'Pending') {
              if (currentMapping) return false;
          } else if (filterStatus === 'Done') {
              if (!currentMapping) return false;
          }

          return true;
      }).sort((a, b) => {
          const dateA = parseDateParts(a.tglJatuhTempo);
          const dateB = parseDateParts(b.tglJatuhTempo);
          if (dateA && dateB) {
              const timeA = new Date(dateA.y, dateA.m - 1, dateA.d).getTime();
              const timeB = new Date(dateB.y, dateB.m - 1, dateB.d).getTime();
              return timeA - timeB;
          }
          return 0;
      });
  }, [activeContacts2026, searchTerm, filterCo, filterMonth, filterStatus, pendingChanges]);

  const displayedContacts = useMemo(() => {
      return filteredContacts.slice(0, visibleCount);
  }, [filteredContacts, visibleCount]);

  const handleLoadMore = () => {
      setVisibleCount(prev => prev + 20);
  };

  const formatMonthLabel = (mKey: string) => {
      const [m, y] = mKey.split('/');
      const mIdx = parseInt(m, 10) - 1;
      return `${MONTH_NAMES[mIdx]}`;
  };

  const handleLocalChange = (contactId: string, newValue: string) => {
      setPendingChanges(prev => ({
          ...prev,
          [contactId]: newValue
      }));
  };

  // SUPABASE BATCH SAVE
  const handleSaveChanges = async () => {
      const changesEntries = Object.entries(pendingChanges);
      if (changesEntries.length === 0) return;

      setIsSaving(true);
      setSaveProgress({ current: 0, total: changesEntries.length });
      
      try {
          // 1. Construct Full Payload
          const updatedContacts: Contact[] = [];
          
          changesEntries.forEach(([id, newMapping]) => {
              const contact = contacts.find(c => c.id === id);
              if (contact) {
                  updatedContacts.push({
                      ...contact,
                      mapping: newMapping
                  });
              }
          });

          // 2. CHUNKING STRATEGY (Supabase is robust, but chunking is safe)
          const CHUNK_SIZE = 100;
          
          for (let i = 0; i < updatedContacts.length; i += CHUNK_SIZE) {
              const chunk = updatedContacts.slice(i, i + CHUNK_SIZE);
              
              await saveContactsBatchToSupabase(chunk);
              
              // Update Visual Progress
              setSaveProgress(prev => ({ ...prev, current: Math.min(prev.current + chunk.length, changesEntries.length) }));
          }

          // 3. Update Local State (App)
          updatedContacts.forEach(updated => {
              onUpdateContact(updated);
          });

          setPendingChanges({});
          alert(`Berhasil menyimpan ${updatedContacts.length} data ke Supabase.`);

      } catch (e) {
          console.error("Batch save failed", e);
          alert("Gagal menyimpan data ke Database. Cek koneksi internet.");
      } finally {
          setIsSaving(false);
          setSaveProgress({ current: 0, total: 0 });
      }
  };

  const pendingCount = Object.keys(pendingChanges).length;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-32 animate-fade-in-up relative">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm px-4 py-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 -mx-4">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        Mapping & Wording (Cloud)
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 uppercase">2026</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                        Total {activeContacts2026.length} Nasabah (Jatuh Tempo 2026)
                    </p>
                </div>
            </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-4 space-y-3">
            {/* ... (Filters UI code remains same) ... */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 mb-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5" /> Filter Data (2026)
                </div>
                {filterMonth !== 'All' && (
                     <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold border border-emerald-100">
                        {formatMonthLabel(filterMonth)} 2026
                     </span>
                )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Month Filter */}
                <div className="relative">
                     <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                        className="w-full p-2.5 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                        value={filterMonth}
                        onChange={e => {
                            setFilterMonth(e.target.value);
                            setFilterCo('All'); // Reset CO when month changes to prevent mismatch
                        }}
                    >
                        <option value="All">Semua Bulan 2026</option>
                        {uniqueMonths.map(m => (
                            <option key={m} value={m}>{formatMonthLabel(m)}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* CO Filter (Dependent) */}
                <div className="relative">
                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                        className="w-full p-2.5 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                        value={filterCo}
                        onChange={e => setFilterCo(e.target.value)}
                    >
                        <option value="All">Semua Petugas {filterMonth !== 'All' ? '(Bulan Ini)' : ''}</option>
                        {availableCos.map(co => <option key={co} value={co}>{co}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Status Filter */}
                <div className="relative">
                    <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                        className="w-full p-2.5 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="All">Semua Status Mapping</option>
                        <option value="Pending">Belum Dipetakan</option>
                        <option value="Done">Sudah Dipetakan</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Cari Nama / Sentra..." 
                    className="w-full pl-9 p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition-colors"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            </div>
        </div>

        {/* List (Paginasi) */}
        <div className="space-y-3">
            {filteredContacts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold">Tidak ada data nasabah 2026 ditemukan.</p>
                    <p className="text-xs text-slate-400 mt-1">Coba reset filter Bulan atau Petugas.</p>
                </div>
            ) : (
                <>
                {displayedContacts.map((contact) => {
                    const isChanged = pendingChanges[contact.id] !== undefined;
                    const currentValue = isChanged ? pendingChanges[contact.id] : (contact.mapping || '');

                    return (
                        <div key={contact.id} className={`border rounded-xl p-4 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            isChanged ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200' : 'bg-white border-slate-200 hover:shadow-md'
                        }`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-slate-800 text-sm truncate">{contact.name}</h3>
                                    {isChanged && (
                                        <span className="text-[10px] font-bold bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded">
                                            Diedit
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {contact.sentra}</span>
                                    {contact.tglJatuhTempo ? (
                                        <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                            JT: {contact.tglJatuhTempo}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 italic">No Tgl JT</span>
                                    )}
                                    <span>CO: {contact.co}</span>
                                </div>
                            </div>

                            {/* Action Buttons: Template & Dropdown */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={() => onGenerateMessage(contact)}
                                    className="p-2.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg border border-orange-200 transition-colors"
                                    title="Buat Pesan WhatsApp"
                                >
                                    <Wand2 className="w-4 h-4" />
                                </button>

                                <div className="relative flex-1 sm:w-48">
                                    <select 
                                        className={`w-full p-2.5 pl-3 pr-8 rounded-lg border text-sm font-bold appearance-none cursor-pointer transition-colors ${
                                            currentValue 
                                            ? (currentValue === 'Lanjut' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-300 text-slate-600')
                                            : 'bg-slate-50 border-slate-200 text-slate-400'
                                        }`}
                                        value={currentValue}
                                        onChange={(e) => handleLocalChange(contact.id, e.target.value)}
                                        disabled={isSaving}
                                    >
                                        <option value="">-- Status --</option>
                                        {MAPPING_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <ChevronDown className={`w-4 h-4 ${currentValue ? 'text-emerald-500' : 'text-slate-400'}`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {/* Load More Button */}
                {visibleCount < filteredContacts.length && (
                    <div className="pt-4 flex justify-center">
                        <Button 
                            variant="secondary" 
                            onClick={handleLoadMore}
                            className="shadow-md text-xs font-bold"
                            icon={<ChevronDown className="w-4 h-4" />}
                        >
                            Tampilkan Lebih Banyak ({filteredContacts.length - visibleCount})
                        </Button>
                    </div>
                )}
                </>
            )}
        </div>

        {/* Floating Save Bar */}
        {pendingCount > 0 && (
            <div className="fixed bottom-20 left-4 right-4 max-w-4xl mx-auto z-50 animate-fade-in-up">
                <div className="bg-slate-800 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/50">
                            {pendingCount}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Perubahan Belum Disimpan</p>
                            <p className="text-xs text-slate-400">Pastikan simpan sebelum keluar.</p>
                        </div>
                    </div>
                    <Button 
                        onClick={handleSaveChanges} 
                        isLoading={isSaving}
                        className="bg-orange-500 hover:bg-orange-600 border-none shadow-lg shadow-orange-500/20 text-white min-w-[140px]"
                        icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                    >
                        {isSaving ? `Menyimpan ${saveProgress.current}/${saveProgress.total}` : 'Simpan Semua'}
                    </Button>
                </div>
            </div>
        )}
    </div>
  );
};
