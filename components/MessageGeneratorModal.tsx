import React, { useState, useEffect } from 'react';
import { Contact, MessageTemplate } from '../types';
import { generateWhatsAppMessage } from '../services/geminiService';
import { Button } from './Button';
import { X, Wand2, Copy, Send, RefreshCw, Calendar, CreditCard } from 'lucide-react';

interface MessageGeneratorModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  initialTemplateId?: string;
}

export const MessageGeneratorModal: React.FC<MessageGeneratorModalProps> = ({ contact, isOpen, onClose, templates, initialTemplateId }) => {
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
    
    // MANUAL MODE:
    if (selectedTemplate.type === 'manual') {
        let text = selectedTemplate.content || '';
        // Replace placeholders
        text = text.replace(/{name}/g, contact.name);
        text = text.replace(/{flag}/g, contact.flag); // Changed from segment
        text = text.replace(/{segment}/g, contact.flag); // Backward compatibility
        text = text.replace(/{sentra}/g, contact.sentra || 'Sentra');
        text = text.replace(/{phone}/g, contact.phone);
        text = text.replace(/{co}/g, contact.co || 'Petugas');
        text = text.replace(/{plafon}/g, contact.plafon || '');
        text = text.replace(/{tgl_jatuh_tempo}/g, contact.tglJatuhTempo || '');
        setGeneratedText(text);
        return;
    }

    // AI MODE:
    setIsGenerating(true);
    // Pass the full contact object now
    const text = await generateWhatsAppMessage(
      contact,
      selectedTemplate.promptContext || 'Sapaan ramah',
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                BTPN Syariah Assistant
                <Wand2 className="w-5 h-5 text-cyan-400" />
            </h2>
            <p className="text-sm text-white/50">Buat pesan untuk <span className="font-semibold text-cyan-300">{contact.name}</span></p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white hover:bg-white/10 rounded-full p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
            
            {/* Context Info Widget */}
            {(contact.tglJatuhTempo || contact.plafon) && (
                <div className="flex gap-4 p-3 bg-blue-900/20 border border-blue-500/20 rounded-xl">
                    {contact.tglJatuhTempo && (
                        <div className="flex items-center gap-2 text-xs text-blue-200">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span>Jatuh Tempo: <b>{contact.tglJatuhTempo}</b></span>
                        </div>
                    )}
                    {contact.plafon && (
                        <div className="flex items-center gap-2 text-xs text-blue-200">
                            <CreditCard className="w-4 h-4 text-blue-400" />
                            <span>Plafon: <b>{contact.plafon}</b></span>
                        </div>
                    )}
                </div>
            )}

          
          {/* Selection Area */}
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-white/70 mb-3 uppercase tracking-wider">Pilih Kategori Pesan</label>
              {templates.length === 0 ? (
                <div className="text-center p-8 bg-white/5 rounded-xl border border-dashed border-white/20">
                    <p className="text-sm text-white/50">Belum ada template tersedia.</p>
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
                            ? 'border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                            : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                        }`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex justify-between items-start w-full relative z-10">
                            <span className="text-2xl">{t.icon}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                t.type === 'manual' 
                                ? 'border-purple-500/30 text-purple-300 bg-purple-500/10' 
                                : 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'
                            }`}>
                                {t.type === 'manual' ? 'BAKU' : 'AI'}
                            </span>
                        </div>
                        <div className={`text-sm font-medium relative z-10 ${selectedTemplate?.id === t.id ? 'text-cyan-300' : 'text-white'}`}>
                            {t.label}
                        </div>
                    </button>
                    ))}
                </div>
              )}
            </div>

            {selectedTemplate?.type === 'ai' && (
                <div className="animate-fade-in-up">
                    <label className="block text-xs font-bold text-white/70 mb-3 uppercase tracking-wider">Tone Bicara</label>
                    <div className="flex gap-2 p-1 bg-black/30 rounded-xl w-fit border border-white/10">
                        {(['formal', 'friendly', 'casual'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTone(t)}
                                className={`px-5 py-2 rounded-lg text-sm capitalize transition-all duration-300 ${
                                    tone === t 
                                    ? 'bg-white/10 text-white shadow-lg border border-white/10 font-semibold' 
                                    : 'text-white/50 hover:text-white hover:bg-white/5'
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
                className="w-full sm:w-auto shadow-[0_0_20px_rgba(6,182,212,0.2)]"
             >
                {selectedTemplate?.type === 'manual' ? 'Gunakan Template' : 'Generate Wording AI'}
             </Button>
          </div>

          {/* Result Area */}
          {generatedText && (
            <div className="animate-fade-in-up space-y-3">
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wider">Preview Pesan</label>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-5 relative shadow-inner group">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-green-500/20 to-cyan-500/20 rounded-2xl opacity-50 blur-sm -z-10"></div>
                <textarea 
                    className="w-full bg-transparent border-none resize-none focus:ring-0 text-white/90 text-sm leading-relaxed placeholder-white/20"
                    rows={6}
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                />
                <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {selectedTemplate?.type === 'ai' && (
                        <button 
                            onClick={handleGenerate}
                            className="p-2 bg-slate-800 rounded-lg shadow-lg text-white/60 hover:text-cyan-400 border border-white/10 transition-colors"
                            title="Regenerate"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                    <button 
                        onClick={handleCopy}
                        className="p-2 bg-slate-800 rounded-lg shadow-lg text-white/60 hover:text-cyan-400 border border-white/10 transition-colors"
                        title="Copy Text"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                 <Button 
                    variant="primary"
                    className="bg-gradient-to-r from-[#25D366] to-[#128C7E] border-none hover:shadow-[0_0_25px_rgba(37,211,102,0.4)] w-full sm:w-auto"
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