import React, { useState, useEffect } from 'react';
import { Contact, SheetConfig } from '../types';
import { Button } from './Button';
import { updatePhoneInSheet } from '../services/sheetService';
import { X, Save, Trash2, Contact as ContactIcon, Info, Lock, Loader2 } from 'lucide-react';

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

  useEffect(() => {
    if (contact) {
      setFormData({ ...contact });
    }
  }, [contact]);

  if (!isOpen || !contact) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.phone) {
      setIsSaving(true);
      try {
        // If Google Script URL is available, try to update sheet
        if (sheetConfig?.googleScriptUrl) {
           await updatePhoneInSheet(sheetConfig.googleScriptUrl, formData.name, formData.phone);
           alert("Nomor telepon berhasil diperbarui di Google Sheets!");
        } else {
           // Just local warning
           alert("Catatan: Perubahan ini hanya tersimpan di aplikasi. Untuk update permanen di database, mohon update file Google Sheets atau konfigurasikan Google Script URL.");
        }
        
        onSave(formData as Contact);
        onClose();
      } catch (err: any) {
        alert(`Gagal update ke Google Sheets: ${err.message}`);
        // We do NOT save locally if sheet update failed to keep data consistent
      } finally {
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

  const handleDelete = () => {
      if(window.confirm(`Yakin ingin menghapus nasabah ${contact.name}?`)) {
          onDelete(contact.id);
          onClose();
      }
  };

  const handlePickContact = async () => {
    const nav = navigator as any;

    if (!('contacts' in nav && 'select' in nav.contacts)) {
        alert('Fitur "Ambil Kontak" tidak didukung oleh browser ini.\n\nTips: Gunakan Google Chrome pada HP Android untuk menggunakan fitur ini.');
        return;
    }

    try {
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        
        const contacts = await nav.contacts.select(props, opts);
        
        if (contacts && contacts.length > 0) {
            const selected = contacts[0];
            
            // Note: We only update phone, as Name is locked now
            let newPhone = formData.phone;
            let phoneFound = false;
            
            if (selected.tel && selected.tel.length > 0) {
                 const validPhone = selected.tel.find((t: any) => t && String(t).trim().length > 0);
                 
                 if (validPhone) {
                     let rawPhone = String(validPhone);
                     let cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
                     newPhone = cleanPhone;
                     phoneFound = true;
                 }
            }

            if (!phoneFound) {
                alert("Kontak yang dipilih tidak memiliki nomor telepon yang terbaca.");
            }
            
            setFormData(prev => ({
                ...prev,
                phone: newPhone
            }));
        }
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error("Contact picker error:", err);
        let msg = 'Gagal membuka kontak.';
        if (err instanceof Error) {
             if (err.name === 'NotAllowedError') {
                 msg = 'Izin akses kontak ditolak. Mohon izinkan akses di pengaturan browser atau popup izin.';
             } else if (err.name === 'SecurityError') {
                 msg = 'Fitur ini memerlukan koneksi HTTPS yang aman.';
             } else {
                 msg = `Error: ${err.message}`;
             }
        }
        alert(msg);
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
        {/* Top glow */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
          <h2 className="text-xl font-bold text-slate-800">Edit Kontak</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          
          {/* WARNING BANNER */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-3">
             <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
             <div className="text-xs text-blue-800 leading-relaxed">
                 <span className="font-bold">Mode Live Sheet:</span> Data utama dikunci sesuai Google Sheet. 
                 {sheetConfig?.googleScriptUrl ? (
                     <span className="text-green-700 font-bold block mt-1">✓ Terhubung ke Script Update: Perubahan nomor HP akan langsung disimpan ke Sheet.</span>
                 ) : (
                     <span className="text-orange-700 block mt-1">⚠ Script Update Belum Dipasang: Perubahan nomor hanya sementara.</span>
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
            <label className="block text-xs font-bold text-cyan-600 mb-2 uppercase tracking-wider">Nomor WhatsApp (Bisa Diedit)</label>
            <div className="relative">
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full p-3 pr-12 bg-white border border-cyan-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all shadow-sm"
                  placeholder="08..."
                />
                <button
                    type="button"
                    onClick={handlePickContact}
                    className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center text-cyan-600 hover:bg-cyan-100 rounded-lg transition-colors z-10 cursor-pointer"
                    title="Ambil dari Kontak HP"
                >
                    <ContactIcon className="w-5 h-5" />
                </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <div>
                <LabelLocked label="Flag (Segmen)" />
                <input
                  type="text"
                  name="flag"
                  disabled
                  value={formData.flag || ''}
                  className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
              <div>
                <LabelLocked label="Sentra" />
                <input
                  type="text"
                  name="sentra"
                  disabled
                  value={formData.sentra || ''}
                  className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
          </div>
          
          {/* BTPN Specific Fields */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <LabelLocked label="CO (Petugas)" />
                <input
                  type="text"
                  name="co"
                  disabled
                  value={formData.co || ''}
                  className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
               <div>
                <LabelLocked label="Tgl Jatuh Tempo" />
                <input
                  type="text"
                  name="tglJatuhTempo"
                  disabled
                  value={formData.tglJatuhTempo || ''}
                  className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
          </div>
          
           <div className="pt-5 flex justify-end items-center border-t border-slate-100 mt-2 gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Batal</Button>
                <Button 
                    type="submit" 
                    icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                    isLoading={isSaving}
                >
                    {isSaving ? 'Menyimpan...' : 'Simpan & Update'}
                </Button>
          </div>
        </form>
      </div>
    </div>
  );
};