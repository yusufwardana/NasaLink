import React, { useState, useEffect } from 'react';
import { MessageTemplate, SheetConfig } from '../types';
import { Button } from './Button';
import { X, Plus, Edit2, Trash2, Check, LayoutTemplate, Database, AlertTriangle, Save, Link } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  onUpdateTemplates: (templates: MessageTemplate[]) => void;
  onResetData: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ 
  isOpen, 
  onClose, 
  templates, 
  onUpdateTemplates,
  onResetData
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'settings'>('templates');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MessageTemplate>>({});
  
  // Sheet Config State
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({ spreadsheetId: '', sheetName: '' });

  useEffect(() => {
    const savedConfig = localStorage.getItem('nasalink_sheet_config');
    if (savedConfig) {
        setSheetConfig(JSON.parse(savedConfig));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Template Logic ---
  const handleStartEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setEditForm({ ...template });
  };

  const handleStartAdd = () => {
    const newId = Date.now().toString();
    setEditingId(newId);
    setEditForm({
      id: newId,
      label: 'Template Baru',
      icon: '📝',
      promptContext: ''
    });
  };

  const handleSaveTemplate = () => {
    if (!editForm.label || !editForm.promptContext) return;

    const newTemplate = editForm as MessageTemplate;
    
    if (templates.find(t => t.id === newTemplate.id)) {
      onUpdateTemplates(templates.map(t => t.id === newTemplate.id ? newTemplate : t));
    } else {
      onUpdateTemplates([...templates, newTemplate]);
    }
    setEditingId(null);
    setEditForm({});
  };

  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('Hapus template ini?')) {
      onUpdateTemplates(templates.filter(t => t.id !== id));
      if (editingId === id) setEditingId(null);
    }
  };

  // --- Settings Logic ---
  const handleSaveSheetConfig = () => {
      localStorage.setItem('nasalink_sheet_config', JSON.stringify(sheetConfig));
      alert('Konfigurasi Google Sheet disimpan!');
  };

  const handleReset = () => {
      if (window.confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data nasabah dan mengembalikan template ke default? Tindakan ini tidak dapat dibatalkan.')) {
          onResetData();
          setSheetConfig({ spreadsheetId: '', sheetName: '' });
          localStorage.removeItem('nasalink_sheet_config');
          onClose();
      }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] h-[600px]">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-900 text-white">
          <div className="flex items-center gap-2">
             <div className="bg-blue-600 p-1.5 rounded text-white font-bold">Admin</div>
             <h2 className="text-lg font-medium">Dashboard</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-1/4 bg-gray-50 border-r hidden sm:flex flex-col p-3 gap-2">
                <button 
                    onClick={() => setActiveTab('templates')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'templates' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <LayoutTemplate className="w-4 h-4" />
                    Template Pesan
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'settings' ? 'bg-white text-red-600 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <Database className="w-4 h-4" />
                    Data & Konfigurasi
                </button>
            </div>

            {/* Mobile Tabs */}
            <div className="sm:hidden border-b flex bg-gray-50">
                <button 
                    onClick={() => setActiveTab('templates')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'templates' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                >
                    Template
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'settings' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
                >
                    Pengaturan
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                
                {/* --- TAB: TEMPLATES --- */}
                {activeTab === 'templates' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Manajemen Template Wording</h3>
                                <p className="text-sm text-gray-500">Atur instruksi untuk AI generator.</p>
                            </div>
                            {!editingId && (
                                <Button size="sm" onClick={handleStartAdd} icon={<Plus className="w-4 h-4"/>}>
                                    Buat Baru
                                </Button>
                            )}
                        </div>

                        {editingId && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 animate-fade-in">
                                <h4 className="font-semibold text-blue-900 mb-4">{editForm.id && templates.find(t => t.id === editForm.id) ? 'Edit Template' : 'Template Baru'}</h4>
                                <div className="grid gap-4">
                                    <div className="flex gap-4">
                                        <div className="w-24">
                                            <label className="block text-xs font-semibold text-blue-800 mb-1">Icon</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2 border rounded-lg text-center text-xl"
                                                value={editForm.icon || ''}
                                                onChange={e => setEditForm({...editForm, icon: e.target.value})}
                                                placeholder="👋"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-blue-800 mb-1">Nama Kategori</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2 border rounded-lg"
                                                value={editForm.label || ''}
                                                onChange={e => setEditForm({...editForm, label: e.target.value})}
                                                placeholder="Contoh: Follow Up Nasabah"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-blue-800 mb-1">Prompt Context (Instruksi AI)</label>
                                        <textarea 
                                            className="w-full p-3 border rounded-lg text-sm h-24 focus:ring-2 focus:ring-blue-400 outline-none"
                                            value={editForm.promptContext || ''}
                                            onChange={e => setEditForm({...editForm, promptContext: e.target.value})}
                                            placeholder="Jelaskan tujuan pesan. Contoh: Tanyakan kabar dan ingatkan jatuh tempo premi..."
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>Batal</Button>
                                        <Button size="sm" onClick={handleSaveTemplate} icon={<Check className="w-4 h-4"/>}>Simpan</Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3">
                            {templates.map(template => (
                                <div 
                                    key={template.id} 
                                    className={`group bg-white border hover:border-blue-300 rounded-xl p-4 flex items-center justify-between transition-all hover:shadow-md ${editingId === template.id ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                                            {template.icon}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{template.label}</h4>
                                            <p className="text-xs text-gray-500 line-clamp-1 max-w-md">{template.promptContext}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleStartEdit(template)}
                                            className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteTemplate(template.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg"
                                            title="Hapus"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- TAB: SETTINGS --- */}
                {activeTab === 'settings' && (
                     <div className="space-y-8">
                        
                        {/* Google Sheets Config */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-1">Integrasi Google Sheets</h3>
                            <p className="text-sm text-gray-500 mb-4">Sinkronisasi data nasabah dari Google Sheets (via CSV).</p>
                            
                            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-green-800 mb-1">Spreadsheet ID</label>
                                    <input 
                                        type="text" 
                                        value={sheetConfig.spreadsheetId}
                                        onChange={(e) => setSheetConfig({...sheetConfig, spreadsheetId: e.target.value})}
                                        placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBkJ..."
                                        className="w-full p-2 border border-green-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">ID ada di URL Google Sheet setelah /d/ dan sebelum /edit</p>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-green-800 mb-1">Nama Sheet (Tab)</label>
                                    <input 
                                        type="text" 
                                        value={sheetConfig.sheetName}
                                        onChange={(e) => setSheetConfig({...sheetConfig, sheetName: e.target.value})}
                                        placeholder="Sheet1"
                                        className="w-full p-2 border border-green-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                
                                <div className="bg-white p-3 rounded-lg border border-green-100 mb-4 text-xs text-gray-600">
                                    <strong>Format Kolom (Header):</strong><br/>
                                    Name, Phone, Segment, Sentra, Notes
                                    <br/><br/>
                                    *Pastikan akses Share file diatur ke <em>"Anyone with the link"</em>
                                </div>

                                <div className="flex justify-end">
                                    <Button variant="primary" className="bg-green-600 hover:bg-green-700" onClick={handleSaveSheetConfig} icon={<Save className="w-4 h-4"/>}>
                                        Simpan Konfigurasi
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Reset Zone */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-1">Zona Bahaya</h3>
                            <div className="bg-red-50 border border-red-100 rounded-xl p-6 mt-2">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-red-100 rounded-full text-red-600">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-red-800 mb-1">Reset Aplikasi</h4>
                                        <p className="text-sm text-red-700 mb-4">
                                            Menghapus semua data lokal (nasabah & template) dan konfigurasi.
                                        </p>
                                        <Button variant="danger" onClick={handleReset} icon={<Trash2 className="w-4 h-4"/>}>
                                            Hapus Data & Reset
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                     </div>
                )}

            </div>
        </div>
      </div>
    </div>
  );
};