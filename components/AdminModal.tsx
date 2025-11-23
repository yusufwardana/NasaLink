import React, { useState, useEffect } from 'react';
import { MessageTemplate, SheetConfig } from '../types';
import { Button } from './Button';
import { X, Plus, Edit2, Trash2, Check, LayoutTemplate, Database, AlertTriangle, Save, PlayCircle, Bot, Type } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  onUpdateTemplates: (templates: MessageTemplate[]) => void;
  onResetData: () => void;
  onTestTemplate?: (templateId: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ 
  isOpen, 
  onClose, 
  templates, 
  onUpdateTemplates,
  onResetData,
  onTestTemplate
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
    // Ensure default type for existing data
    setEditForm({ type: 'ai', ...template });
  };

  const handleStartAdd = () => {
    const newId = Date.now().toString();
    setEditingId(newId);
    setEditForm({
      id: newId,
      label: 'Template Baru',
      icon: '📝',
      type: 'ai',
      promptContext: '',
      content: ''
    });
  };

  const handleSaveTemplate = () => {
    if (!editForm.label) return;
    if (editForm.type === 'ai' && !editForm.promptContext) return;
    if (editForm.type === 'manual' && !editForm.content) return;

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
                    className={`flex-1 py-3 text-sm font-medium ${