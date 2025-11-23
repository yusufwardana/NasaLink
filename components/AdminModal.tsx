import React, { useState, useEffect } from 'react';
import { MessageTemplate, SheetConfig } from '../types';
import { Button } from './Button';
import { X, Plus, Edit2, Trash2, Check, LayoutTemplate, Database, AlertTriangle, Save } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] h-[600px] relative">
        {/* Top Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>

        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
             <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-1.5 rounded-lg text-white shadow-[0_0_10px_rgba(124,58,237,0.5)]">
                <Database className="w-5 h-5" />
             </div>
             <h2 className="text-lg font-bold text-white">Admin Dashboard</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white hover:bg-white/10 rounded-full p-2 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar (Glass Style) */}
            <div className="w-1/4 bg-black/20 border-r border-white/10 hidden sm:flex flex-col p-3 gap-2">
                <button 
                    onClick={() => setActiveTab('templates')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        activeTab === 'templates' ? 'bg-white/10 text-cyan-300 shadow-lg border border-white/5' : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                >
                    <LayoutTemplate className="w-4 h-4" />
                    Template Pesan
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        activeTab === 'settings' ? 'bg-white/10 text-pink-300 shadow-lg border border-white/5' : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                >
                    <Database className="w-4 h-4" />
                    Data & Config
                </button>
            </div>

            {/* Mobile Tabs */}
            <div className="sm:hidden border-b border-white/10 flex bg-black/20">
                <button 
                    onClick={() => setActiveTab('templates')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'templates' ? 'text-cyan-300 border-b-2 border-cyan-300' : 'text-white/50'}`}
                >
                    Template
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'settings' ? 'text-pink-300 border-b-2 border-pink-300' : 'text-white/50'}`}
                >
                    Pengaturan
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                
                {/* --- TAB: TEMPLATES --- */}
                {activeTab === 'templates' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-white">Template Wording</h3>
                                <p className="text-sm text-white/50">Atur instruksi untuk AI generator.</p>
                            </div>
                            {!editingId && (
                                <Button size="sm" onClick={handleStartAdd} icon={<Plus className="w-4 h-4"/>}>
                                    Buat Baru
                                </Button>
                            )}
                        </div>

                        {editingId && (
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-5 animate-fade-in backdrop-blur-sm">
                                <h4 className="font-semibold text-blue-200 mb-4">{editForm.id && templates.find(t => t.id === editForm.id) ? 'Edit Template' : 'Template Baru'}</h4>
                                <div className="grid gap-4">
                                    <div className="flex gap-4">
                                        <div className="w-24">
                                            <label className="block text-xs font-semibold text-blue-300/70 mb-1">Icon</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2 border border-white/10 bg-black/30 rounded-xl text-center text-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                                value={editForm.icon || ''}
                                                onChange={e => setEditForm({...editForm, icon: e.target.value})}
                                                placeholder="👋"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-blue-300/70 mb-1">Nama Kategori</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2 border border-white/10 bg-black/30 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                                value={editForm.label || ''}
                                                onChange={e => setEditForm({...editForm, label: e.target.value})}
                                                placeholder="Contoh: Follow Up Nasabah"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-blue-300/70 mb-1">Prompt Context (Instruksi AI)</label>
                                        <textarea 
                                            className="w-full p-3 border border-white/10 bg-black/30 rounded-xl text-sm h-24 focus:ring-2 focus:ring-blue-500/50 outline-none text-white placeholder-white/20"
                                            value={editForm.promptContext || ''}
                                            onChange={e => setEditForm({...editForm, promptContext: e.target.value})}
                                            placeholder="Jelaskan tujuan pesan. Contoh: Tanyakan kabar dan ingatkan jatuh tempo premi..."
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Batal</Button>
                                        <Button size="sm" onClick={handleSaveTemplate} icon={<Check className="w-4 h-4"/>}>Simpan</Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3">
                            {templates.map(template => (
                                <div 
                                    key={template.id} 
                                    className={`group bg-white/5 border border-white/5 hover:border-white/20 rounded-xl p-4 flex items-center justify-between transition-all hover:bg-white/10 ${editingId === template.id ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center text-2xl shadow-inner">
                                            {template.icon}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white group-hover:text-cyan-300 transition-colors">{template.label}</h4>
                                            <p className="text-xs text-white/50 line-clamp-1 max-w-md">{template.promptContext}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleStartEdit(template)}
                                            className="p-2 text-white/50 hover:text-cyan-300 bg-white/5 hover:bg-white/10 rounded-lg"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteTemplate(template.id)}
                                            className="p-2 text-white/50 hover:text-red-400 bg-white/5 hover:bg-white/10 rounded-lg"
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
                            <h3 className="text-lg font-bold text-white mb-1">Integrasi Google Sheets</h3>
                            <p className="text-sm text-white/50 mb-4">Sinkronisasi data nasabah dari Google Sheets (via CSV).</p>
                            
                            <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-6 backdrop-blur-sm">
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-green-300 mb-1">Spreadsheet ID</label>
                                    <input 
                                        type="text" 
                                        value={sheetConfig.spreadsheetId}
                                        onChange={(e) => setSheetConfig({...sheetConfig, spreadsheetId: e.target.value})}
                                        placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBkJ..."
                                        className="w-full p-3 border border-green-500/30 bg-black/40 rounded-xl text-sm text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-white/40 mt-2">ID ada di URL Google Sheet setelah /d/ dan sebelum /edit</p>
                                </div>
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-green-300 mb-1">Nama Sheet (Tab)</label>
                                    <input 
                                        type="text" 
                                        value={sheetConfig.sheetName}
                                        onChange={(e) => setSheetConfig({...sheetConfig, sheetName: e.target.value})}
                                        placeholder="Sheet1"
                                        className="w-full p-3 border border-green-500/30 bg-black/40 rounded-xl text-sm text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    />
                                </div>
                                
                                <div className="bg-black/20 p-4 rounded-xl border border-white/10 mb-6 text-xs text-white/60 font-mono leading-relaxed">
                                    <strong>Format Kolom (Header):</strong><br/>
                                    Name, Phone, Segment, Sentra, Notes
                                    <br/><br/>
                                    *Pastikan akses Share file diatur ke <em>"Anyone with the link"</em>
                                </div>

                                <div className="flex justify-end">
                                    <Button variant="primary" className="bg-gradient-to-r from-green-600 to-emerald-600 border-none" onClick={handleSaveSheetConfig} icon={<Save className="w-4 h-4"/>}>
                                        Simpan Konfigurasi
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Reset Zone */}
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">Zona Bahaya</h3>
                            <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 mt-2 backdrop-blur-sm">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-red-500/20 rounded-full text-red-400 border border-red-500/20">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-red-200 mb-1">Reset Aplikasi</h4>
                                        <p className="text-sm text-red-200/70 mb-4">
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