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

    // 1. Feature Detection
    if (!('contacts' in nav && 'select' in nav.contacts)) {
        alert('Fitur "Ambil Kontak" tidak didukung oleh browser ini.\n\nTips: Gunakan Google Chrome pada HP Android untuk menggunakan fitur ini.');
        return;
    }

    try {
        // 2. Request Contact
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        
        const contacts = await nav.contacts.select(props, opts);
        
        if (contacts && contacts.length > 0) {
            const selected = contacts[0];
            const updates: Partial<Contact> = {};
            
            // Update Name
            if (selected.name && selected.name.length > 0) {
                updates.name = selected.name[0];
            }
            
            // Update Phone
            if (selected.tel && selected.tel.length > 0) {
                let rawPhone = selected.tel[0];
                // Remove characters that are not digits or +
                let cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
                
                updates.phone = cleanPhone;
            }
            
            setFormData(prev => ({ ...prev, ...updates }));
        }
    } catch (err) {
        // Ignore AbortError (User Cancelled)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Edit Nasabah</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name || ''}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
            <div className="relative">
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full p-2 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="08..."
                />
                <button
                    type="button"
                    onClick={handlePickContact}
                    className="absolute right-1 top-1 bottom-1 w-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 hover:text-blue-800 rounded-md transition-colors z-10 cursor-pointer"
                    title="Ambil dari Kontak HP"
                >
                    <ContactIcon className="w-5 h-5" />
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">*Klik ikon orang untuk ambil dari kontak HP (Khusus Android Chrome)</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segmen</label>
                <select
                  name="segment"
                  value={formData.segment || 'Prospect'}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Prospect">Prospect</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sentra</label>
                <input
                  type="text"
                  name="sentra"
                  value={formData.sentra || ''}
                  onChange={handleChange}
                  placeholder="Misal: Jakarta Pusat"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Tambahan</label>
            <textarea
              name="notes"
              rows={3}
              value={formData.notes || ''}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Misal: Hobi golf, punya anak 2..."
            />
          </div>
          
           <div className="pt-4 flex justify-between items-center border-t mt-4">
                <button 
                    type="button" 
                    onClick={handleDelete}
                    className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                >
                    <Trash2 className="w-4 h-4" /> Hapus Kontak
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