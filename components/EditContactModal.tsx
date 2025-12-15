
import React, { useState, useEffect } from 'react';
import { Contact, SheetConfig } from '../types';
import { Button } from './Button';
import { updateContactData } from '../services/sheetService';
import { X, Save, Trash2, Contact as ContactIcon, Info, Lock, Loader2, Zap, FileText, Check } from 'lucide-react';

interface EditContactModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedContact: Contact) => void;
  onDelete: (id: string) => void;
  sheetConfig: SheetConfig | null;
}

export const EditContactModal: React.FC<EditContactModalProps> = ({ 
  contact, 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  sheetConfig
}) => {
  const [formData, setFormData] = useState<Partial<Contact>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (contact) {
      setFormData({ ...contact });
      setSaveStatus('idle');
    }
  }, [contact, isOpen]);

  if (!isOpen || !contact) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name) {
      setIsSaving(true);
      
      try {
          // 1. UI Update (Immediate)
          onSave(formData as Contact);
          
          // 2. Background Sync
          if (sheetConfig?.googleScriptUrl) {
               await updateContactData(
                   sheetConfig.googleScriptUrl, 
                   formData.name, 
                   formData.phone || '', 
                   formData.notes || '',
                   sheetConfig.enableDebugMode
               );
          }
          
          setSaveStatus('success');
          // Close after short delay to show success tick
          setTimeout(() => {
              onClose();
              setIsSaving(false);
          }, 800);

      } catch (err) {
          console.error("Save failed:", err);
          setSaveStatus('error');
          setIsSaving(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePickContact = async () => {
    const nav = navigator as any;
    if (!('contacts' in nav && 'select' in nav.contacts)) {
        alert('Fitur "Ambil Kontak" hanya tersedia di Google Chrome (Android/iOS).');
        return;
    }
    try {
        const contacts = await nav.contacts.select(['name', 'tel'], { multiple: false });
        if (contacts && contacts.length > 0) {
            const selected = contacts[0];
            let newPhone = formData.phone;
            if (selected.tel && selected.tel.length > 0) {
                 newPhone = String(selected.tel[0]).replace(/[^0-9+]/g, '');
            }
            setFormData(prev => ({ ...prev, phone: newPhone }));
        }
    } catch (err) {
        console.error(err);
    }
  };

  const LabelLocked = ({ label }: { label: string }) => (
      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
          {label} <Lock className="w-3 h-3 text-slate-300" />
      </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
          <h2 className="text-xl font-bold text-slate-800">Edit Kontak</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-3">
             <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
             <div className="text-xs text-blue-800 leading-relaxed">
                 <span className="font-bold">Mode Sinkronisasi:</span> 
                 {sheetConfig?.googleScriptUrl ? (
                     <span className="text-green-700 font-bold block mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Auto-Save ke Google Sheets aktif.
                     </span>
                 ) : (
                     <span className="text-orange-700 block mt-1">⚠ Script belum dipasang. Data hanya tersimpan di HP ini.</span>
                 )}
             </div>
          </div>

          <div>
            <LabelLocked label="Nama Lengkap" />
            <input
              type="text"
              name="name"
              disabled
              value={formData.name || ''}
              className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-orange-600 mb-2 uppercase tracking-wider">Nomor WhatsApp</label>
            <div className="relative">
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full p-3 pr-12 bg-white border border-orange-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-orange-500/50 outline-none transition-all shadow-sm"
                  placeholder="08..."
                />
                <button
                    type="button"
                    onClick={handlePickContact}
                    className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center text-orange-600 hover:bg-orange-100 rounded-lg transition-colors z-10"
                >
                    <ContactIcon className="w-5 h-5" />
                </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-orange-600 mb-2 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Catatan / Keterangan
            </label>
            <textarea
              name="notes"
              rows={3}
              value={formData.notes || ''}
              onChange={handleChange}
              className="w-full p-3 bg-white border border-orange-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-orange-500/50 outline-none transition-all shadow-sm text-sm"
              placeholder="Tambahkan catatan penting..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <LabelLocked label="Sentra" />
                <input type="text" disabled value={formData.sentra || ''} className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500" />
              </div>
               <div>
                <LabelLocked label="Jatuh Tempo" />
                <input type="text" disabled value={formData.tglJatuhTempo || ''} className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500" />
              </div>
          </div>
          
           <div className="pt-5 flex justify-end items-center border-t border-slate-100 mt-2 gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Batal</Button>
                <Button 
                    type="submit" 
                    disabled={isSaving}
                    isLoading={isSaving}
                    icon={saveStatus === 'success' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    className={saveStatus === 'success' ? 'bg-green-600 border-green-600' : ''}
                >
                    {saveStatus === 'success' ? 'Tersimpan!' : 'Simpan'}
                </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
