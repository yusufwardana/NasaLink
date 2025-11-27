import React, { useState, useEffect } from 'react';
import { Contact } from '../types';
import { Button } from './Button';
import { X, Save, Trash2, Contact as ContactIcon } from 'lucide-react';

interface EditContactModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedContact: Contact) => void;
  onDelete: (id: string) => void;
}

export const EditContactModal: React.FC<EditContactModalProps> = ({ contact, isOpen, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState<Partial<Contact>>({});

  useEffect(() => {
    if (contact) {
      setFormData({ ...contact });
    }
  }, [contact]);

  if (!isOpen || !contact) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.phone) {
      onSave(formData as Contact);
      onClose();
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
            
            let newName = formData.name;
            let newPhone = formData.phone;
            let phoneFound = false;
            
            if (selected.name && selected.name.length > 0) {
                newName = selected.name[0];
            }
            
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
                name: newName,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative">
        {/* Top glow */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
          <h2 className="text-xl font-bold text-slate-800">Edit Nasabah</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Nama Lengkap</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name || ''}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Nomor WhatsApp</label>
            <div className="relative">
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full p-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all focus:bg-white"
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
            <p className="text-[10px] text-slate-400 mt-1">*Klik ikon orang untuk ambil dari kontak HP (Khusus Android Chrome)</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Flag (Segmen)</label>
                <select
                  name="flag"
                  value={formData.flag || 'Prospect'}
                  onChange={handleChange}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none appearance-none focus:bg-white"
                >
                  <option value="Prospect">Prospect</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Sentra</label>
                <input
                  type="text"
                  name="sentra"
                  value={formData.sentra || ''}
                  onChange={handleChange}
                  placeholder="Sentra Mawar"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none focus:bg-white"
                />
              </div>
          </div>
          
          {/* BTPN Specific Fields */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">CO (Petugas)</label>
                <input
                  type="text"
                  name="co"
                  value={formData.co || ''}
                  onChange={handleChange}
                  placeholder="Nama CO"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none focus:bg-white"
                />
              </div>
               <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Tgl Jatuh Tempo</label>
                <input
                  type="text"
                  name="tglJatuhTempo"
                  value={formData.tglJatuhTempo || ''}
                  onChange={handleChange}
                  placeholder="Contoh: 25"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none focus:bg-white"
                />
              </div>
          </div>
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Plafon</label>
                <input
                  type="text"
                  name="plafon"
                  value={formData.plafon || ''}
                  onChange={handleChange}
                  placeholder="Rp ..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none focus:bg-white"
                />
              </div>
               <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Status</label>
                <input
                  type="text"
                  name="status"
                  value={formData.status || ''}
                  onChange={handleChange}
                  placeholder="Lancar/Macet"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none focus:bg-white"
                />
              </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Catatan Tambahan</label>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes || ''}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none resize-none focus:bg-white"
              placeholder="Catatan personal..."
            />
          </div>
          
           <div className="pt-5 flex justify-between items-center border-t border-slate-100 mt-2">
                <button 
                    type="button" 
                    onClick={handleDelete}
                    className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <Trash2 className="w-4 h-4" /> Hapus
                </button>
                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                    <Button type="submit" icon={<Save className="w-4 h-4" />}>Simpan</Button>
                </div>
          </div>
        </form>
      </div>
    </div>
  );
};