

import React, { useState, useEffect } from 'react';
import { Contact, MessageTemplate } from '../types';
import { generateWhatsAppMessage } from '../services/geminiService';
import { Button } from './Button';
import { X, Wand2, Copy, Send, RefreshCw, Calendar, CreditCard, Users } from 'lucide-react';

interface MessageGeneratorModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  initialTemplateId?: string;
}

export const MessageGeneratorModal: React.FC<MessageGeneratorModalProps> = ({ 
  contact, 
  isOpen, 
  onClose, 
  templates, 
  initialTemplateId
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [generatedText, setGeneratedText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [tone, setTone] = useState<'formal' | 'casual' | 'friendly'>('friendly');

  useEffect(() => {
      if (initialTemplateId) {
          const found = templates.find(t => t.id === initialTemplateId);
          if (found) {
              setSelectedTemplate(found);
          }
      }
  }, [initialTemplateId, templates]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    
    // MANUAL MODE CEK:
    if (selectedTemplate.type === 'manual') {
        let text = selectedTemplate.content || '';
        // Replace placeholders
        text = text.replace(/{name}/g, contact.name);
        text = text.replace(/{flag}/g, contact.flag); 
        text = text.replace(/{segment}/g, contact.flag); // Backward compatibility
        text = text.replace(/{sentra}/g, contact.sentra || 'Sentra');
        text = text.replace(/{phone}/g, contact.phone);
        text = text.replace(/{co}/g, contact.co || 'Petugas');
        text = text.replace(/{plafon}/g, contact.plafon || '');
        text = text.replace(/{tgl_jatuh_tempo}/g, contact.tglJatuhTempo || '');
        text = text.replace(/{tgl_prs}/g, contact.tglPrs || '');
        setGeneratedText(text);
        return;
    }

    // AI MODE:
    setIsGenerating(true);
    
    // Enrich Context with new fields
    let extendedContext = selectedTemplate.promptContext || 'Sapaan ramah';
    if (contact.tglPrs) {
        extendedContext += `\n[Info Tambahan]: Tanggal PRS/Kumpulan nasabah adalah ${contact.tglPrs}. Gunakan info ini jika relevan.`;
    }

    // Fix: Updated call to generateWhatsAppMessage without manual apiKey
    const text = await generateWhatsAppMessage(
      contact,
      extendedContext,
      tone
    );
    setGeneratedText(text);
    setIsGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    alert('Pesan disalin ke clipboard!');
  };

  const handleSendWA = () => {
    const encodedText = encodeURIComponent(generatedText);
    // Remove non-numeric chars from phone for the link
    const cleanPhone = contact.phone.replace(/\D/g, '');
    // Ensure ID country code 
    const finalPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;
    
    window.open(`https://wa.me/${finalPhone}?text=${encodedText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                BTPN Syariah Assistant
                <Wand2 className="w-5 h-5 text-orange-600" />
            </h2>
            <p className="text-sm text-slate-500">Buat pesan untuk <span className="font-semibold text-orange-600">{contact.name}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
            
            {/* Context Info Widget */}
            {(contact.tglJatuhTempo || contact.plafon || contact.tglPrs) && (
                <div className="flex flex-wrap gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    {contact.tglJatuhTempo && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-white/50 px-2 py-1 rounded border border-amber-100">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>Jatuh Tempo: <b>{contact.tglJatuhTempo}</b></span>
                        </div>
                    )}
                     {contact.tglPrs && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-white/50 px-2 py-1 rounded border border-amber-100">
                            <Users className="w-3.5 h-3.5 text-amber-500" />
                            <span>PRS: <b>{contact.tglPrs}</b></span>
                        </div>
                    )}
                    {contact.plafon && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-white/50 px-2 py-1 rounded border border-amber-100">
                            <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                            <span>Plafon: <b>{contact.plafon}</b></span>
                        </div>
                    )}
                </div>
            )}

          
          {/* Selection Area */}
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Pilih Kategori Pesan</label>
              {templates.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-sm text-slate-500">Belum ada template tersedia.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {templates.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => {
                            setSelectedTemplate(t);
                            setGeneratedText(''); 
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all duration-300 group relative overflow-hidden flex flex-col gap-2 ${
                        selectedTemplate?.id === t.id
                            ? 'border-orange-500 bg-orange-50 shadow-md ring-1 ring-orange-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                        }`}
                    >
                        <div className="flex justify-between items-start w-full relative z-10">
                            <span className="text-2xl">{t.icon}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                t.type === 'manual' 
                                ? 'border-purple-200 text-purple-700 bg-purple-50' 
                                : 'border-orange-200 text-orange-700 bg-orange-50'
                            }`}>
                                {t.type === 'manual' ? 'BAKU' : 'AI'}
                            </span>
                        </div>
                        <div className={`text-sm font-medium relative z-10 ${selectedTemplate?.id === t.id ? 'text-orange-700' : 'text-slate-700'}`}>
                            {t.label}
                        </div>
                    </button>
                    ))}
                </div>
              )}
            </div>

            {selectedTemplate?.type === 'ai' && (
                <div className="animate-fade-in-up">
                    <label className="block text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Tone Bicara</label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
                        {(['formal', 'friendly', 'casual'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTone(t)}
                                className={`px-5 py-2 rounded-lg text-sm capitalize transition-all duration-300 ${
                                    tone === t 
                                    ? 'bg-white text-orange-700 shadow border border-slate-200 font-semibold' 
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
             <Button 
                onClick={handleGenerate} 
                disabled={!selectedTemplate} 
                isLoading={isGenerating}
                icon={<Wand2 className="w-4 h-4" />}
                className="w-full sm:w-auto shadow-lg shadow-orange-500/20"
             >
                {selectedTemplate?.type === 'manual' ? 'Gunakan Template' : 'Generate Wording AI'}
             </Button>
          </div>

          {/* Result Area */}
          {generatedText && (
            <div className="animate-fade-in-up space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Preview Pesan</label>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative shadow-inner group hover:bg-white transition-colors">
                <textarea 
                    className="w-full bg-transparent border-none resize-none focus:ring-0 text-slate-800 text-sm leading-relaxed placeholder-slate-400"
                    rows={6}
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                />
                <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {selectedTemplate?.type === 'ai' && (
                        <button 
                            onClick={handleGenerate}
                            className="p-2 bg-white rounded-lg shadow-md text-slate-500 hover:text-orange-600 border border-slate-100 transition-colors"
                            title="Regenerate"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                    <button 
                        onClick={handleCopy}
                        className="p-2 bg-white rounded-lg shadow-md text-slate-500 hover:text-orange-600 border border-slate-100 transition-colors"
                        title="Copy Text"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                 <Button 
                    variant="primary"
                    className="bg-gradient-to-r from-[#25D366] to-[#128C7E] border-none shadow-lg shadow-green-500/30 hover:shadow-green-500/50 w-full sm:w-auto"
                    onClick={handleSendWA}
                    icon={<Send className="w-4 h-4" />}
                 >
                    Buka WhatsApp
                 </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};