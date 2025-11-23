import React, { useState } from 'react';
import { Contact, MessageTemplate } from '../types';
import { generateWhatsAppMessage } from '../services/geminiService';
import { Button } from './Button';
import { X, Wand2, Copy, Send, RefreshCw } from 'lucide-react';

interface MessageGeneratorModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
}

export const MessageGeneratorModal: React.FC<MessageGeneratorModalProps> = ({ contact, isOpen, onClose, templates }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [generatedText, setGeneratedText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [tone, setTone] = useState<'formal' | 'casual' | 'friendly'>('friendly');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    const text = await generateWhatsAppMessage(
      contact.name,
      contact.segment,
      selectedTemplate.promptContext,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">AI Assistant Writer</h2>
            <p className="text-sm text-gray-500">Buat pesan untuk <span className="font-semibold text-blue-600">{contact.name}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Selection Area */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Kategori Pesan</label>
              {templates.length === 0 ? (
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-dashed">
                    <p className="text-sm text-gray-500">Belum ada template tersedia.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {templates.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => {
                            setSelectedTemplate(t);
                            setGeneratedText(''); // Clear previous generation when template changes
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                        selectedTemplate?.id === t.id
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                    >
                        <div className="text-2xl mb-1">{t.icon}</div>
                        <div className="text-sm font-medium text-gray-900">{t.label}</div>
                    </button>
                    ))}
                </div>
              )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone Bicara</label>
                <div className="flex gap-2">
                    {(['formal', 'friendly', 'casual'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTone(t)}
                            className={`px-4 py-2 rounded-full text-sm capitalize border ${
                                tone === t ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
             <Button 
                onClick={handleGenerate} 
                disabled={!selectedTemplate} 
                isLoading={isGenerating}
                icon={<Wand2 className="w-4 h-4" />}
             >
                Generate Wording
             </Button>
          </div>

          {/* Result Area */}
          {generatedText && (
            <div className="animate-fade-in-up">
              <label className="block text-sm font-medium text-gray-700 mb-2">Preview Pesan</label>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 relative">
                <textarea 
                    className="w-full bg-transparent border-none resize-none focus:ring-0 text-gray-800 text-sm leading-relaxed"
                    rows={6}
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                />
                <div className="absolute bottom-4 right-4 flex gap-2">
                    <button 
                        onClick={handleGenerate}
                        className="p-2 bg-white rounded-full shadow text-gray-500 hover:text-blue-600 transition-colors"
                        title="Regenerate"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={handleCopy}
                        className="p-2 bg-white rounded-full shadow text-gray-500 hover:text-blue-600 transition-colors"
                        title="Copy Text"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                 <Button 
                    variant="primary"
                    className="bg-[#25D366] hover:bg-[#20bd5a] text-white w-full sm:w-auto"
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