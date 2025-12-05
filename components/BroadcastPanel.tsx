import React, { useState, useMemo } from 'react';
import { Contact, MessageTemplate } from '../types';
import { ArrowLeft, Send, CheckCircle2, MapPin, ChevronDown, Wand2, Briefcase, CalendarClock, Banknote, Sparkles, History, Users, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { generateBroadcastMessage } from '../services/geminiService';

interface BroadcastPanelProps {
  contacts: Contact[];
  templates: MessageTemplate[];
  onBack: () => void;
  apiKey?: string;
}

export const BroadcastPanel: React.FC<BroadcastPanelProps> = ({
  contacts,
  templates,
  onBack,
  apiKey
}) => {
  // 1. Filter State
  const [filterCo, setFilterCo] = useState<string>('All');
  const [filterSentra, setFilterSentra] = useState<string>('All');
  
  // NEW: Filter Type specific logic (Refinancing, Winback, PRS, Collection, etc)
  const [filterTargetType, setFilterTargetType] = useState<string>('All');
  
  // Pagination State (Prevents UI Hang)
  const [visibleCount, setVisibleCount] = useState(50);

  // 2. Message State
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 3. Sending State
  const [sentStatus, setSentStatus] = useState<Record<string, boolean>>({});

  // --- Date Helpers (Copied from App.tsx/NotificationPanel logic) ---
  const today = new Date();
  today.setHours(0,0,0,0);
  const nextMonthDate = new Date(today);
  nextMonthDate.setMonth(today.getMonth() + 1);

  const parseDate = (dateStr: string | undefined): Date | null => {
      if (!dateStr) return null;
      const clean = dateStr.trim();
      const partsIndo = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (partsIndo) {
          return new Date(parseInt(partsIndo[3]), parseInt(partsIndo[2]) - 1, parseInt(partsIndo[1]));
      }
      const parsed = Date.parse(clean);
      return isNaN(parsed) ? null : new Date(parsed);
  };

  // --- Derived Data ---

  const uniqueCos = useMemo(() => {
      return Array.from(new Set(contacts.map(c => c.co || 'Unassigned'))).sort();
  }, [contacts]);

  const uniqueSentras = useMemo(() => {
    let source = contacts;
    if (filterCo !== 'All') {
        source = contacts.filter(c => (c.co || 'Unassigned') === filterCo);
    }
    const sentras = new Set(source.map(c => c.sentra || 'Unknown'));
    return Array.from(sentras).sort();
  }, [contacts, filterCo]);

  // Target filtering logic
  const targetContacts = useMemo(() => {
    const filtered = contacts.filter(contact => {
        // 1. Basic Filters
        const cCo = (contact.co || 'Unassigned');
        const cSentra = (contact.sentra || 'Unknown');
        
        const matchCo = filterCo === 'All' || cCo === filterCo;
        const matchSentra = filterSentra === 'All' || cSentra === filterSentra;
        
        if (!matchCo || !matchSentra) return false;

        // 2. Target Type Logic (The complex part)
        if (filterTargetType === 'All') return true;

        const flag = (contact.flag || '').toLowerCase();
        const status = (contact.status || '').toLowerCase();
        // Robust DPD Parsing
        const dpd = parseInt(contact.dpd || '0', 10) || 0;
        
        const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
        const isTrouble = dpd > 0 || status.includes('macet') || status.includes('menunggak');

        // Date parsing
        const dueDate = parseDate(contact.tglJatuhTempo);
        const lunasDate = parseDate(contact.tglLunas);

        // A. COLLECTION (Menunggak)
        if (filterTargetType === 'collection') {
            return isTrouble && !isInactive;
        }

        // B. REFINANCING (Jatuh Tempo Lancar)
        if (filterTargetType === 'refinancing') {
            if (isInactive || isTrouble) return false; // Must be active & clean
            if (!dueDate) return false;
            
            // Logic: Month is Current or Next
            const m = dueDate.getMonth();
            const y = dueDate.getFullYear();
            const isCurrentMonth = m === today.getMonth() && y === today.getFullYear();
            const isNextMonth = m === nextMonthDate.getMonth() && y === nextMonthDate.getFullYear();
            
            return isCurrentMonth || isNextMonth;
        }

        // C. WINBACK (Recent < 3 Months)
        if (filterTargetType === 'winback_recent') {
            if (!isInactive) return false;
            
            // Prioritize Tgl Lunas, fallback to Jatuh Tempo
            const refDate = lunasDate || dueDate;
            if (!refDate) return false;

            const monthsAgo = (today.getFullYear() - refDate.getFullYear()) * 12 + (today.getMonth() - refDate.getMonth());
            return monthsAgo >= 1 && monthsAgo < 3;
        }

        // D. WINBACK (Old > 3 Months)
        if (filterTargetType === 'winback_old') {
            if (!isInactive) return false;

            const refDate = lunasDate || dueDate;
            if (!refDate) return false;

            const monthsAgo = (today.getFullYear() - refDate.getFullYear()) * 12 + (today.getMonth() - refDate.getMonth());
            return monthsAgo >= 3 && monthsAgo <= 12; // Cap at 1 year for relevance
        }

        // E. PRS (Kumpulan Besok / Hari Ini)
        if (filterTargetType === 'prs') {
             if (isInactive) return false;
             if (!contact.tglPrs) return false;

             let prsDate: Date | null = null;
             // Handle "15" format
             if (contact.tglPrs.match(/^\d{1,2}$/)) {
                 let targetDay = parseInt(contact.tglPrs);
                 prsDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
                 if (prsDate < today) prsDate.setMonth(prsDate.getMonth() + 1);
             } else {
                 prsDate = parseDate(contact.tglPrs);
             }

             if (!prsDate) return false;
             const diff = Math.ceil((prsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
             return diff === 0 || diff === 1; // Today or Tomorrow
        }
        
        return true;
    });

    // --- SORTING LOGIC ---
    return filtered.sort((a, b) => {
        // Specifically for Collection: Sort by DPD Ascending (Smallest DPD first)
        if (filterTargetType === 'collection') {
            let dpdA = parseInt(a.dpd || '0', 10);
            let dpdB = parseInt(b.dpd || '0', 10);
            
            // Handle NaN or 0: Push to bottom (Assume 0/Empty DPD is less urgent than DPD 1)
            if (isNaN(dpdA) || dpdA <= 0) dpdA = 999999;
            if (isNaN(dpdB) || dpdB <= 0) dpdB = 999999;

            return dpdA - dpdB; // Ascending (1, 2, 3 ... 999999)
        }
        // Default: Sort by Name
        return a.name.localeCompare(b.name);
    });

  }, [contacts, filterCo, filterSentra, filterTargetType]);

  // Sliced contacts for rendering to avoid UI freeze
  const visibleContacts = useMemo(() => {
      return targetContacts.slice(0, visibleCount);
  }, [targetContacts, visibleCount]);

  // --- Handlers ---

  const handleGenerateDraft = async () => {
      if (!selectedTemplate) return;
      
      setBroadcastMessage('');
      setIsGenerating(true);

      try {
          if (selectedTemplate.type === 'manual') {
              // Manual: Just load content
              setBroadcastMessage(selectedTemplate.content || '');
          } else {
              // AI: Generate generic message
              const audience = filterSentra !== 'All' 
                ? `Anggota Sentra ${filterSentra}` 
                : `Nasabah BTPN Syariah (Total ${targetContacts.length} orang)`;
              
              const text = await generateBroadcastMessage(
                  selectedTemplate.promptContext || 'Info Penting',
                  audience,
                  'friendly',
                  apiKey
              );
              setBroadcastMessage(text);
          }
      } catch (e) {
          console.error(e);
          alert("Gagal membuat draft pesan.");
      } finally {
          setIsGenerating(false);
      }
  };

  const handleSendToContact = (contact: Contact) => {
      if (!broadcastMessage) return;

      // Local Replacement (Client-Side)
      let finalMsg = broadcastMessage;
      
      // Replace placeholders
      finalMsg = finalMsg.replace(/{name}/gi, contact.name);
      finalMsg = finalMsg.replace(/{sentra}/gi, contact.sentra || '');
      finalMsg = finalMsg.replace(/{co}/gi, contact.co || '');
      finalMsg = finalMsg.replace(/{phone}/gi, contact.phone);

      const encodedMessage = encodeURIComponent(finalMsg);
      const cleanPhone = contact.phone.replace(/\D/g, '');
      const finalPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;

      window.open(`https://wa.me/${finalPhone}?text=${encodedMessage}`, '_blank');
      
      setSentStatus(prev => ({ ...prev, [contact.id]: true }));
  };

  const sentCount = Object.keys(sentStatus).filter(k => targetContacts.find(c => c.id === k)).length;
  const progress = targetContacts.length > 0 ? (sentCount / targetContacts.length) * 100 : 0;

  // Counters for Chips
  // Note: These counts are global (within current contacts list), to show availability
  // Ideally these should respect CO filter if selected, but for simplicity let's stick to simple counts or just static labels
  
  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 animate-fade-in-up">
      {/* Header - Fixed/Sticky */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-4 mb-6 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex items-center gap-4">
        <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all"
        >
            <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Siaran Broadcast
                <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full border border-orange-200">
                    BULK MODE
                </span>
            </h2>
            <p className="text-sm text-slate-500">Kirim 1 draft pesan ke banyak nasabah.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* STEP 1: TARGETING */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="bg-slate-100 w-5 h-5 flex items-center justify-center rounded-full text-slate-600">1</span>
                Filter Penerima
            </h3>

             {/* Quick Filter Chips (Color Coded like NotificationPanel) */}
             <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
                 <button 
                    onClick={() => {
                        setFilterTargetType('collection');
                        setSentStatus({});
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                        filterTargetType === 'collection' ? 'bg-red-100 border-red-300 text-red-700 ring-1 ring-red-300' : 'bg-white border-slate-200 text-slate-500 hover:bg-red-50'
                    }`}
                >
                    <AlertTriangle className="w-3.5 h-3.5" /> Menunggak
                </button>
                <button 
                    onClick={() => {
                        setFilterTargetType('refinancing');
                        setSentStatus({});
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                        filterTargetType === 'refinancing' ? 'bg-emerald-100 border-emerald-300 text-emerald-700 ring-1 ring-emerald-300' : 'bg-white border-slate-200 text-slate-500 hover:bg-emerald-50'
                    }`}
                >
                    <Banknote className="w-3.5 h-3.5" /> Jatuh Tempo
                </button>
                 <button 
                    onClick={() => {
                        setFilterTargetType('winback_recent');
                        setSentStatus({});
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                        filterTargetType === 'winback_recent' ? 'bg-pink-100 border-pink-300 text-pink-700 ring-1 ring-pink-300' : 'bg-white border-slate-200 text-slate-500 hover:bg-pink-50'
                    }`}
                >
                    <Sparkles className="w-3.5 h-3.5" /> Winback &lt; 3 Bln
                </button>
                 <button 
                    onClick={() => {
                        setFilterTargetType('winback_old');
                        setSentStatus({});
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                        filterTargetType === 'winback_old' ? 'bg-purple-100 border-purple-300 text-purple-700 ring-1 ring-purple-300' : 'bg-white border-slate-200 text-slate-500 hover:bg-purple-50'
                    }`}
                >
                    <History className="w-3.5 h-3.5" /> Winback &gt; 3 Bln
                </button>
                 <button 
                    onClick={() => {
                        setFilterTargetType('prs');
                        setSentStatus({});
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                        filterTargetType === 'prs' ? 'bg-blue-100 border-blue-300 text-blue-700 ring-1 ring-blue-300' : 'bg-white border-slate-200 text-slate-500 hover:bg-blue-50'
                    }`}
                >
                    <Users className="w-3.5 h-3.5" /> PRS Besok
                </button>
            </div>

            <div className="space-y-3">
                {/* Filter CO */}
                <div className="relative">
                    <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select
                        className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500 appearance-none shadow-sm truncate"
                        value={filterCo}
                        onChange={(e) => {
                            setFilterCo(e.target.value);
                            setFilterSentra('All'); // Reset Sentra
                            setSentStatus({}); // Reset Progress
                            setVisibleCount(50); // Reset Pagination
                        }}
                    >
                        <option value="All">Semua Petugas (CO)</option>
                        {uniqueCos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
                </div>

                {/* Filter Sentra */}
                <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select
                        className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500 appearance-none shadow-sm truncate"
                        value={filterSentra}
                        onChange={(e) => {
                            setFilterSentra(e.target.value);
                            setSentStatus({});
                            setVisibleCount(50);
                        }}
                    >
                        <option value="All">Semua Sentra</option>
                        {uniqueSentras.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
                </div>

                {/* Filter Type (Specific Logic) */}
                <div className="relative">
                    <CalendarClock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select
                        className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500 appearance-none shadow-sm truncate"
                        value={filterTargetType}
                        onChange={(e) => {
                            setFilterTargetType(e.target.value);
                            setSentStatus({});
                            setVisibleCount(50);
                        }}
                    >
                        <option value="All">Semua Target (General)</option>
                        <option value="collection">Menunggak (Collection)</option>
                        <option value="refinancing">Jatuh Tempo (Lancar)</option>
                        <option value="winback_recent">Winback Baru (&lt; 3 Bulan)</option>
                        <option value="winback_old">Winback Lama (&gt; 3 Bulan)</option>
                        <option value="prs">Kumpulan PRS (Besok)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
                </div>
            </div>
            
            <div className={`mt-4 flex items-center gap-2 text-sm p-3 rounded-xl border ${targetContacts.length > 0 ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                <Users className="w-4 h-4" />
                <span className="font-bold">{targetContacts.length}</span> Nasabah terpilih
            </div>
        </div>

        {/* STEP 2: TEMPLATE & GENERATE */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="bg-slate-100 w-5 h-5 flex items-center justify-center rounded-full text-slate-600">2</span>
                Template & Generate
            </h3>
            
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
                {templates.map(t => (
                    <button
                        key={t.id}
                        onClick={() => {
                            setSelectedTemplate(t);
                        }}
                        className={`flex-shrink-0 p-3 rounded-xl border text-left min-w-[120px] max-w-[140px] transition-all flex flex-col gap-1 ${
                            selectedTemplate?.id === t.id 
                            ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500' 
                            : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-sm'
                        }`}
                    >
                        <span className="text-xl">{t.icon}</span>
                        <span className={`text-[10px] font-bold uppercase truncate w-full ${selectedTemplate?.id === t.id ? 'text-orange-700' : 'text-slate-500'}`}>
                            {t.label}
                        </span>
                    </button>
                ))}
            </div>

            <Button 
                onClick={handleGenerateDraft} 
                disabled={!selectedTemplate || targetContacts.length === 0} 
                isLoading={isGenerating}
                className="w-full"
                icon={<Wand2 className="w-4 h-4" />}
            >
                {isGenerating ? 'Membuat Draft...' : 'Buat Draft Pesan (Generate)'}
            </Button>
            
            <p className="text-[10px] text-slate-400 mt-2 text-center">
                *Pesan akan dibuat sekali (generic) dengan placeholder {`{name}`}
            </p>
        </div>
      </div>

      {/* STEP 3 & 4: PREVIEW & SEND LIST */}
      <div className="animate-fade-in-up space-y-4">
          
          {/* Master Message */}
          <div className={`bg-gradient-to-br from-orange-50 to-white rounded-2xl border p-5 shadow-sm relative group transition-all ${broadcastMessage ? 'border-orange-300 ring-2 ring-orange-200' : 'border-slate-200 opacity-70'}`}>
              <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-2">
                    <span className="bg-orange-200 w-5 h-5 flex items-center justify-center rounded-full text-orange-700">3</span>
                    Draft Pesan Master
                  </h3>
                  <span className="text-[10px] bg-white px-2 py-1 rounded border border-orange-100 text-orange-500 font-bold">
                      {`{name}`} akan berubah otomatis
                  </span>
              </div>
              
              <textarea 
                className="w-full h-24 bg-transparent border-none focus:ring-0 text-slate-800 text-sm leading-relaxed resize-none p-0 placeholder-slate-400"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Pilih template & generate dahulu. Hasil akan muncul di sini."
                disabled={isGenerating}
              />
          </div>

          {/* Contact List Actions */}
          {targetContacts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center sticky top-0">
                    <div className="flex items-center gap-2">
                         <h3 className="font-bold text-slate-700">Daftar Kirim ({targetContacts.length})</h3>
                         {sentCount > 0 && (
                             <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                 {Math.round(progress)}% Selesai
                             </span>
                         )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-600">{sentCount}/{targetContacts.length}</span>
                    </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {visibleContacts.map((contact, idx) => {
                        const isSent = sentStatus[contact.id];
                        const readyToSend = !!broadcastMessage;
                        
                        return (
                        <div key={contact.id} className={`p-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${isSent ? 'bg-green-50/30' : ''}`}>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400 font-mono w-6 text-center">{idx + 1}</span>
                                <div>
                                    <p className="font-bold text-sm text-slate-800">{contact.name}</p>
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                        {contact.phone} • <span className="px-1.5 py-0.5 rounded bg-slate-100">{contact.sentra}</span>
                                        {filterTargetType === 'collection' && (
                                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold">DPD: {contact.dpd}</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                size="sm" 
                                variant={isSent ? 'outline' : 'primary'}
                                className={`h-8 px-4 text-xs ${isSent ? 'border-green-200 text-green-600 bg-green-50' : ''}`}
                                onClick={() => handleSendToContact(contact)}
                                disabled={!readyToSend}
                                icon={isSent ? <CheckCircle2 className="w-3 h-3"/> : <Send className="w-3 h-3"/>}
                            >
                                {isSent ? 'Terkirim' : 'Kirim WA'}
                            </Button>
                        </div>
                        );
                    })}
                    
                    {visibleCount < targetContacts.length && (
                        <div className="p-3 text-center border-t border-slate-50">
                             <span className="text-xs text-slate-400 block mb-2">
                                 Menampilkan {visibleCount} dari {targetContacts.length}
                             </span>
                             <Button variant="secondary" size="sm" onClick={() => setVisibleCount(p => p + 50)}>
                                Tampilkan Lebih Banyak
                             </Button>
                        </div>
                    )}
                </div>
            </div>
          )}
      </div>

    </div>
  );
};