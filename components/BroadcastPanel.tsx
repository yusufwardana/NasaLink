import React, { useState, useMemo } from 'react';
import { Contact, MessageTemplate } from '../types';
import { ArrowLeft, Send, CheckCircle2, MessageSquare, MapPin, Filter, Copy, ChevronDown } from 'lucide-react';
import { Button } from './Button';

interface BroadcastPanelProps {
  contacts: Contact[];
  templates: MessageTemplate[];
  onBack: () => void;
}

export const BroadcastPanel: React.FC<BroadcastPanelProps> = ({
  contacts,
  templates,
  onBack
}) => {
  const [selectedSentra, setSelectedSentra] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [sentStatus, setSentStatus] = useState<Record<string, boolean>>({});

  // Extract Sentras
  const uniqueSentras = useMemo(() => {
    const sentras = new Set(contacts.map(c => c.sentra || 'Unknown'));
    return Array.from(sentras).sort();
  }, [contacts]);

  // Filter Contacts by Sentra
  const targetContacts = useMemo(() => {
    if (!selectedSentra) return [];
    return contacts.filter(c => (c.sentra || 'Unknown') === selectedSentra);
  }, [contacts, selectedSentra]);

  // Generate Message Logic
  const generateMessage = (contact: Contact) => {
    if (!selectedTemplate) return '';
    
    // Simple generator logic (Manual/Template only for speed, AI is too slow for bulk)
    let text = selectedTemplate.content || selectedTemplate.promptContext || '';
    
    // Replace variables
    text = text.replace(/{name}/g, contact.name);
    text = text.replace(/{sentra}/g, contact.sentra || '');
    text = text.replace(/{flag}/g, contact.flag);
    text = text.replace(/{phone}/g, contact.phone);
    text = text.replace(/{co}/g, contact.co || '');
    text = text.replace(/{plafon}/g, contact.plafon || '');
    text = text.replace(/{tgl_jatuh_tempo}/g, contact.tglJatuhTempo || '');

    return encodeURIComponent(text);
  };

  const handleSend = (contact: Contact) => {
    if (!selectedTemplate) {
        alert("Pilih template pesan terlebih dahulu");
        return;
    }

    const message = generateMessage(contact);
    const cleanPhone = contact.phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;

    // Open WhatsApp
    window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');

    // Mark as sent
    setSentStatus(prev => ({ ...prev, [contact.id]: true }));
  };

  const sentCount = Object.keys(sentStatus).filter(k => targetContacts.find(c => c.id === k)).length;
  const progress = targetContacts.length > 0 ? (sentCount / targetContacts.length) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 animate-fade-in-up">
      {/* Header - Fixed */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-4 mb-6 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex items-center gap-4">
        <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all"
        >
            <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Siaran Sentra
                <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full border border-orange-200">
                    BETA
                </span>
            </h2>
            <p className="text-sm text-slate-500">Kirim pesan massal (satu per satu) ke anggota sentra.</p>
        </div>
      </div>

      {/* Step 1: Configuration */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 p-5 shadow-sm mb-6 space-y-4">
         
         {/* Select Sentra */}
         <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Pilih Sentra Target
            </label>
            <div className="relative">
                <select
                    className="w-full p-3 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none transition-all"
                    value={selectedSentra}
                    onChange={(e) => {
                        setSelectedSentra(e.target.value);
                        setSentStatus({}); // Reset status if sentra changes
                    }}
                >
                    <option value="">-- Pilih Sentra --</option>
                    {uniqueSentras.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
         </div>

         {/* Select Template */}
         <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> Pilih Template Pesan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                {templates.filter(t => t.type === 'manual').length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-400 border border-dashed rounded-lg col-span-2">
                        Tidak ada template manual. Buat template tipe 'MANUAL' di menu Setting.
                    </div>
                )}
                {templates.filter(t => t.type === 'manual').map(t => (
                    <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className={`text-left p-3 rounded-xl border text-sm transition-all flex items-center gap-3 ${
                            selectedTemplate?.id === t.id 
                            ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm ring-1 ring-orange-500' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300'
                        }`}
                    >
                        <span className="text-lg">{t.icon}</span>
                        <span className="font-medium truncate">{t.label}</span>
                    </button>
                ))}
            </div>
         </div>

      </div>

      {/* Step 2: Execution List */}
      {selectedSentra && (
          <div className="space-y-4">
              <div className="flex justify-between items-end px-1">
                  <div>
                      <h3 className="font-bold text-slate-700">Daftar Anggota {selectedSentra}</h3>
                      <p className="text-xs text-slate-400">Total: {targetContacts.length} Nasabah</p>
                  </div>
                  <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Progress</p>
                      <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-green-600">{sentCount}/{targetContacts.length}</span>
                      </div>
                  </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {targetContacts.map((contact, idx) => {
                      const isSent = sentStatus[contact.id];
                      return (
                          <div 
                            key={contact.id} 
                            className={`p-4 flex items-center justify-between border-b border-slate-100 last:border-0 transition-colors ${
                                isSent ? 'bg-green-50/50' : 'hover:bg-slate-50'
                            }`}
                          >
                              <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                                      isSent ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                      {idx + 1}
                                  </div>
                                  <div>
                                      <p className={`font-bold text-sm ${isSent ? 'text-green-800' : 'text-slate-800'}`}>{contact.name}</p>
                                      <p className="text-xs text-slate-400 font-mono">{contact.phone}</p>
                                  </div>
                              </div>

                              <Button
                                size="sm"
                                variant={isSent ? "outline" : "primary"}
                                onClick={() => handleSend(contact)}
                                disabled={!selectedTemplate}
                                className={isSent ? 'border-green-200 text-green-600 bg-white' : 'shadow-orange-200'}
                                icon={isSent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                              >
                                  {isSent ? 'Terkirim' : 'Kirim WA'}
                              </Button>
                          </div>
                      );
                  })}
                  
                  {targetContacts.length === 0 && (
                      <div className="p-8 text-center text-slate-400">
                          Tidak ada data nasabah di sentra ini.
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};