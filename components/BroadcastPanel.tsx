import React, { useState, useMemo } from 'react';
import { Contact, MessageTemplate } from '../types';
import { ArrowLeft, Send, CheckCircle2, MessageSquare, MapPin, ChevronDown, Loader2, Wand2, Briefcase, Activity, Edit3, Copy, Users } from 'lucide-react';
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
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // 2. Message State
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 3. Sending State
  const [sentStatus, setSentStatus] = useState<Record<string, boolean>>({});

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

  // Fix: Target filtering logic
  const targetContacts = useMemo(() => {
    return contacts.filter(contact => {
        const cCo = (contact.co || 'Unassigned').trim();
        const cSentra = (contact.sentra || 'Unknown').trim();
        // IMPORTANT: Status filter should check 'flag' (Active/Prospect) OR 'status' (Lancar/Macet)
        // Here we map the dropdown "Active" to check if flag contains it.
        const cFlag = (contact.flag || '').toLowerCase();
        
        const matchCo = filterCo === 'All' || cCo === filterCo;
        const matchSentra = filterSentra === 'All' || cSentra === filterSentra;
        
        let matchStatus = true;
        if (filterStatus !== 'All') {
            const f = filterStatus.toLowerCase();
            // Check broadly in Flag (Active/Silver/Gold) or Status
            matchStatus = cFlag.includes(f) || (contact.status || '').toLowerCase().includes(f);
        }
        
        return matchCo && matchSentra && matchStatus;
    });
  }, [contacts, filterCo, filterSentra, filterStatus]);

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
                        }}
                    >
                        <option value="All">Semua Sentra</option>
                        {uniqueSentras.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
                </div>

                {/* Filter Status */}
                <div className="relative">
                    <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select
                        className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500 appearance-none shadow-sm truncate"
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setSentStatus({});
                        }}
                    >
                        <option value="All">Semua Status (Active/Inactive)</option>
                        <option value="Active">Active / Lancar</option>
                        <option value="Inactive">Inactive / Macet</option>
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
                            // Do not clear message immediately to allow template switching comparison
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
                placeholder="Hasil generate AI akan muncul di sini. Silakan edit manual jika perlu sebelum mengirim."
                disabled={isGenerating}
              />
          </div>

          {/* Contact List Actions */}
          {targetContacts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center sticky top-0">
                    <div className="flex items-center gap-2">
                         <h3 className="font-bold text-slate-700">Daftar Kirim</h3>
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
                    {targetContacts.map((contact, idx) => {
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
                </div>
            </div>
          )}
      </div>

    </div>
  );
};