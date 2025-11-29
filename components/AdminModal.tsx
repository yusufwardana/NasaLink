import React, { useState, useEffect, useRef } from 'react';
import { MessageTemplate, SheetConfig } from '../types';
import { Button } from './Button';
import { saveTemplatesToSupabase, fetchSettingsFromSupabase, saveSettingsToSupabase, isSupabaseConfigured } from '../services/supabaseService';
import { GLOBAL_CONFIG } from '../config';
import { X, Plus, Trash2, Check, LayoutTemplate, Database, AlertTriangle, Save, PlayCircle, Bot, Type, Info, Layers, ChevronRight, Wand2, Eye, Lock, Code, Globe, Loader2, Server, Key } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  onUpdateTemplates: (templates: MessageTemplate[]) => void;
  onResetData: () => void;
  onTestTemplate?: (templateId: string) => void;
  onBulkUpdateMode?: (mode: 'ai' | 'manual') => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ 
  isOpen, 
  onClose, 
  templates, 
  onUpdateTemplates,
  onResetData,
  onTestTemplate,
  onBulkUpdateMode
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'settings'>('templates');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MessageTemplate>>({});
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({ spreadsheetId: '', sheetName: '', googleScriptUrl: '', geminiApiKey: '' });
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
        setIsLoadingConfig(true);
        // Load Settings from Supabase if configured
        if (isSupabaseConfigured()) {
             fetchSettingsFromSupabase().then(sbConfig => {
                 if (sbConfig) {
                     setSheetConfig(prev => ({ ...prev, ...sbConfig }));
                 } else {
                     setSheetConfig(GLOBAL_CONFIG);
                 }
             }).finally(() => setIsLoadingConfig(false));
        } else {
            setSheetConfig(GLOBAL_CONFIG);
            setIsLoadingConfig(false);
        }
    }
  }, [isOpen]);

  useEffect(() => {
      if (isOpen && activeTab === 'templates' && templates.length > 0 && !selectedTemplateId) {
          handleSelectTemplate(templates[0]);
      }
  }, [isOpen, activeTab, templates]);

  if (!isOpen) return null;

  const handleSelectTemplate = (t: MessageTemplate) => {
      setSelectedTemplateId(t.id);
      setEditForm({ ...t });
  };

  const handleStartAdd = () => {
    const newId = Date.now().toString();
    const newTemplate: MessageTemplate = {
      id: newId,
      label: 'Template Baru',
      icon: '📝',
      type: 'ai',
      promptContext: '',
      content: ''
    };
    setSelectedTemplateId(newId);
    setEditForm(newTemplate);
  };

  // MAIN SAVE LOGIC
  const handleSaveCurrent = async () => {
    if (!editForm.label || !selectedTemplateId) return;
    
    if (editForm.type === 'ai' && !editForm.promptContext) {
        alert("Instruksi AI tidak boleh kosong");
        return;
    }
    if (editForm.type === 'manual' && !editForm.content) {
        alert("Isi pesan manual tidak boleh kosong");
        return;
    }

    const newTemplate = editForm as MessageTemplate;
    let updatedTemplates = [];
    
    const exists = templates.find(t => t.id === newTemplate.id);
    if (exists) {
      updatedTemplates = templates.map(t => t.id === newTemplate.id ? newTemplate : t);
    } else {
      updatedTemplates = [...templates, newTemplate];
    }
    
    // 1. Optimistic Update Local
    onUpdateTemplates(updatedTemplates);

    // 2. Sync to Supabase
    if (isSupabaseConfigured()) {
        setIsSavingTemplates(true);
        try {
            await saveTemplatesToSupabase(updatedTemplates);
        } catch (e) {
            console.error("Failed to sync templates to Supabase:", e);
            alert("Gagal menyimpan ke Supabase.");
        } finally {
            setIsSavingTemplates(false);
        }
    } else {
        alert("Peringatan: Supabase belum dikonfigurasi. Template hanya tersimpan sementara.");
    }
  };

  const handleDeleteCurrent = async () => {
    if (!selectedTemplateId) return;
    if (window.confirm('Hapus template ini secara Global?')) {
      const remaining = templates.filter(t => t.id !== selectedTemplateId);
      
      onUpdateTemplates(remaining);
      
      if (remaining.length > 0) {
          handleSelectTemplate(remaining[0]);
      } else {
          setSelectedTemplateId(null);
          setEditForm({});
      }

      if (isSupabaseConfigured()) {
        setIsSavingTemplates(true);
        try {
            await saveTemplatesToSupabase(remaining);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingTemplates(false);
        }
      }
    }
  };

  const handleInsertVariable = (variable: string) => {
      if (editForm.type !== 'manual' || !textAreaRef.current) return;
      
      const textarea = textAreaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = editForm.content || '';
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      
      const newText = before + variable + after;
      setEditForm({ ...editForm, content: newText });
      
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
  };

  const handleBulkMode = async (mode: 'ai' | 'manual') => {
      if (onBulkUpdateMode && window.confirm(`Ubah SEMUA template menjadi mode ${mode.toUpperCase()}?`)) {
          onBulkUpdateMode(mode);
      }
  };

  const handleSaveSheetConfig = async () => {
      if (!isSupabaseConfigured()) {
          alert("Supabase belum dikonfigurasi. Tidak bisa menyimpan pengaturan global.");
          return;
      }
      setIsLoadingConfig(true);
      try {
          await saveSettingsToSupabase(sheetConfig);
          alert('Konfigurasi Global berhasil disimpan ke Supabase!');
      } catch (e) {
          console.error(e);
          alert("Gagal menyimpan konfigurasi.");
      } finally {
          setIsLoadingConfig(false);
      }
  };

  const renderManualPreview = () => {
      if (!editForm.content) return null;
      let text = editForm.content;
      text = text.replace(/{name}/g, "Ibu Ratna");
      text = text.replace(/{sentra}/g, "Mawar Indah");
      text = text.replace(/{flag}/g, "Gold");
      return (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-green-600 text-xs font-bold uppercase tracking-wider">
                  <Eye className="w-3 h-3" /> Live Preview
              </div>
              <p className="text-sm text-green-800 whitespace-pre-wrap font-sans italic">"{text}"</p>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh] relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"></div>

        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/50 shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-gradient-to-br from-green-600 to-emerald-600 p-2 rounded-lg text-white shadow-md">
                <Database className="w-5 h-5" />
             </div>
             <div>
                 <h2 className="text-lg font-bold text-slate-800 leading-none">Supabase Admin</h2>
                 <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                     {isSavingTemplates ? (
                         <span className="text-orange-600 animate-pulse font-bold flex items-center gap-1">
                             <Loader2 className="w-3 h-3 animate-spin" />
                             Menyimpan ke Supabase...
                         </span>
                     ) : isSupabaseConfigured() ? (
                         <span className="text-green-600 flex items-center gap-1">
                             <Check className="w-3 h-3" />
                             Connected to Supabase
                         </span>
                     ) : (
                         <span className="text-red-500 flex items-center gap-1">
                             <AlertTriangle className="w-3 h-3" />
                             Supabase Not Configured
                         </span>
                     )}
                 </p>
             </div>
          </div>
          <button onClick={onClose} disabled={isSavingTemplates} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50/50 shrink-0">
            <button 
                onClick={() => setActiveTab('templates')}
                className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${activeTab === 'templates' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
            >
                <LayoutTemplate className="w-4 h-4" /> Template Pesan
            </button>
            <button 
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${activeTab === 'settings' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
            >
                <Database className="w-4 h-4" /> Data & Config
            </button>
        </div>

        <div className="flex-1 overflow-hidden relative bg-slate-50/30">
            {activeTab === 'templates' && (
                <div className="flex h-full flex-col sm:flex-row">
                    <div className="w-full sm:w-1/3 border-r border-slate-200 bg-white/50 flex flex-col h-full">
                        <div className="p-3 border-b border-slate-100 bg-white">
                            <Button 
                                onClick={handleStartAdd} 
                                variant="outline" 
                                disabled={isSavingTemplates}
                                className="w-full justify-start text-xs border-dashed border-slate-300 hover:border-orange-400 hover:text-orange-600" 
                                icon={<Plus className="w-3.5 h-3.5" />}
                            >
                                Buat Template Baru
                            </Button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {templates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => handleSelectTemplate(t)}
                                    disabled={isSavingTemplates}
                                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex items-center justify-between group disabled:opacity-50 ${
                                        selectedTemplateId === t.id 
                                        ? 'bg-orange-50 border-orange-200 shadow-sm' 
                                        : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl opacity-80">{t.icon}</span>
                                        <div>
                                            <div className="font-semibold text-sm text-slate-800">{t.label}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide ${
                                                    t.type === 'manual' ? 'text-purple-600 bg-purple-100' : 'text-orange-600 bg-orange-100'
                                                }`}>
                                                    {t.type === 'manual' ? 'MANUAL' : 'AI AUTO'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedTemplateId === t.id ? 'text-orange-500 translate-x-1' : ''}`} />
                                </button>
                            ))}
                        </div>
                        
                        <div className="p-3 border-t border-slate-200 bg-slate-100/50">
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1">
                                <Layers className="w-3 h-3" /> Global Actions
                            </div>
                            <div className="flex gap-2">
                                <button disabled={isSavingTemplates} onClick={() => handleBulkMode('ai')} className="flex-1 py-1.5 rounded bg-white text-[10px] text-slate-500 hover:text-orange-600 border border-slate-200 hover:border-orange-300 transition-colors shadow-sm disabled:opacity-50">
                                    Set All AI
                                </button>
                                <button disabled={isSavingTemplates} onClick={() => handleBulkMode('manual')} className="flex-1 py-1.5 rounded bg-white text-[10px] text-slate-500 hover:text-purple-600 border border-slate-200 hover:border-purple-300 transition-colors shadow-sm disabled:opacity-50">
                                    Set All Manual
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-full sm:w-2/3 bg-slate-50/50 flex flex-col h-full overflow-y-auto custom-scrollbar">
                        {selectedTemplateId ? (
                            <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4 w-full">
                                        <div className="w-16">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase text-center">Icon</label>
                                            <input 
                                                type="text" 
                                                disabled={isSavingTemplates}
                                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-center text-2xl focus:ring-2 focus:ring-orange-500/50 outline-none text-slate-800 transition-all hover:bg-slate-50 disabled:bg-slate-100"
                                                value={editForm.icon || ''}
                                                onChange={e => setEditForm({...editForm, icon: e.target.value})}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Nama Kategori</label>
                                            <input 
                                                type="text" 
                                                disabled={isSavingTemplates}
                                                className="w-full bg-white border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-orange-500/50 outline-none text-slate-800 font-bold text-lg placeholder-slate-300 transition-all hover:bg-slate-50 disabled:bg-slate-100"
                                                value={editForm.label || ''}
                                                onChange={e => setEditForm({...editForm, label: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-1 rounded-xl flex border border-slate-200 shadow-sm">
                                    <button 
                                        onClick={() => setEditForm(prev => ({ ...prev, type: 'ai' }))}
                                        disabled={isSavingTemplates}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                                            editForm.type === 'ai' 
                                            ? 'bg-orange-600 text-white shadow-md' 
                                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Bot className="w-3.5 h-3.5" /> AI Generator
                                    </button>
                                    <button 
                                        onClick={() => setEditForm(prev => ({ ...prev, type: 'manual' }))}
                                        disabled={isSavingTemplates}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                                            editForm.type === 'manual' 
                                            ? 'bg-purple-600 text-white shadow-md' 
                                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Type className="w-3.5 h-3.5" /> Manual Text
                                    </button>
                                </div>

                                <div>
                                    {editForm.type === 'ai' ? (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-end">
                                                <label className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-2">
                                                    <Wand2 className="w-3 h-3" /> Instruksi untuk AI
                                                </label>
                                            </div>
                                            <textarea 
                                                className="w-full h-48 bg-white border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-orange-500/50 outline-none text-slate-800 text-sm leading-relaxed placeholder-slate-300 resize-none transition-all hover:bg-slate-50 disabled:bg-slate-100"
                                                value={editForm.promptContext || ''}
                                                onChange={e => setEditForm({...editForm, promptContext: e.target.value})}
                                                disabled={isSavingTemplates}
                                                placeholder="Contoh: Ingatkan Ibu nasabah untuk hadir di kumpulan..."
                                            />
                                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex gap-3">
                                                <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                                                <p className="text-xs text-orange-800">
                                                    Perubahan akan disimpan di Database Supabase dan otomatis terupdate di semua perangkat.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                             <div className="flex justify-between items-end">
                                                <label className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-2">
                                                    <Type className="w-3 h-3" /> Isi Pesan Baku
                                                </label>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {[{ label: '+ Nama', code: '{name}' }, { label: '+ Sentra', code: '{sentra}' }, { label: '+ Flag', code: '{flag}' }, { label: '+ HP', code: '{phone}' }, { label: '+ CO', code: '{co}' }].map((chip) => (
                                                    <button
                                                        key={chip.code}
                                                        onClick={() => handleInsertVariable(chip.code)}
                                                        disabled={isSavingTemplates}
                                                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-[10px] font-bold text-purple-600 uppercase tracking-wide disabled:opacity-50"
                                                    >
                                                        {chip.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <textarea 
                                                ref={textAreaRef}
                                                className="w-full h-48 bg-white border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-purple-500/50 outline-none text-slate-800 text-sm font-mono leading-relaxed placeholder-slate-300 resize-none transition-all hover:bg-slate-50 disabled:bg-slate-100"
                                                value={editForm.content || ''}
                                                onChange={e => setEditForm({...editForm, content: e.target.value})}
                                                disabled={isSavingTemplates}
                                                placeholder="Assalamualaikum..."
                                            />
                                            {renderManualPreview()}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-slate-200 flex justify-between items-center">
                                    <button 
                                        onClick={handleDeleteCurrent}
                                        disabled={isSavingTemplates}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <Trash2 className="w-4 h-4" /> Hapus Global
                                    </button>
                                    
                                    <div className="flex gap-3">
                                        {onTestTemplate && (
                                            <Button 
                                                variant="secondary"
                                                disabled={isSavingTemplates}
                                                onClick={() => {
                                                    // Trigger background save but allow test immediately with local state
                                                    handleSaveCurrent(); 
                                                    if (selectedTemplateId) {
                                                        onClose();
                                                        onTestTemplate(selectedTemplateId);
                                                    }
                                                }}
                                                icon={<PlayCircle className="w-4 h-4" />}
                                            >
                                                Simpan & Test
                                            </Button>
                                         )}
                                        <Button 
                                            onClick={handleSaveCurrent}
                                            icon={<Check className="w-4 h-4" />}
                                            isLoading={isSavingTemplates}
                                            className="shadow-lg shadow-orange-500/20"
                                        >
                                            {isSavingTemplates ? 'Menyimpan...' : 'Simpan ke Supabase'}
                                        </Button>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                                <LayoutTemplate className="w-16 h-16 mb-4 opacity-50" />
                                <p>Pilih template untuk diedit</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="p-6 sm:p-10 max-w-3xl mx-auto space-y-8 animate-fade-in-up overflow-y-auto h-full custom-scrollbar">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-blue-600" />
                            Konfigurasi Global (Supabase)
                        </h3>
                        
                        {!isSupabaseConfigured() && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 text-sm mb-4">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <div>
                                    <p className="font-bold">Supabase Belum Dikonfigurasi</p>
                                    <p className="opacity-90 mt-1">
                                        Harap isi URL dan KEY di file <code>config.ts</code> agar fitur Admin ini berjalan.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">
                                Pengaturan ini akan disimpan di Supabase dan menimpa konfigurasi lokal di semua perangkat pengguna.
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Spreadsheet ID (Data Nasabah)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    value={sheetConfig.spreadsheetId}
                                    onChange={e => setSheetConfig({...sheetConfig, spreadsheetId: e.target.value})}
                                    placeholder="Contoh: 1BxiMVs0XRA5..."
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Nama Sheet (Tab)</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-blue-500/50 outline-none"
                                        value={sheetConfig.sheetName}
                                        onChange={e => setSheetConfig({...sheetConfig, sheetName: e.target.value})}
                                        placeholder="Data"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Tab Template (Opsional)</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-200 rounded-xl p-3 text-slate-400 bg-slate-100 cursor-not-allowed"
                                        value="Managed by Supabase"
                                        disabled
                                    />
                                </div>
                            </div>

                             <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">URL Apps Script (Update No HP)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-200 rounded-xl p-3 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    value={sheetConfig.googleScriptUrl || ''}
                                    onChange={e => setSheetConfig({...sheetConfig, googleScriptUrl: e.target.value})}
                                    placeholder="https://script.google.com/..."
                                />
                            </div>

                            <div className="border-t border-slate-100 pt-4 mt-4">
                                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase flex items-center gap-1">
                                    Gemini API Key (Opsional) <Key className="w-3 h-3" />
                                </label>
                                <input 
                                    type="password" 
                                    className="w-full border border-slate-200 rounded-xl p-3 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500/50 outline-none"
                                    value={sheetConfig.geminiApiKey || ''}
                                    onChange={e => setSheetConfig({...sheetConfig, geminiApiKey: e.target.value})}
                                    placeholder="AIza..."
                                />
                                <p className="text-[10px] text-orange-500 mt-1 italic">
                                    PENTING: Key ini akan disimpan di konfigurasi bersama. Pastikan aman. Jika kosong, akan menggunakan System Environment Variable.
                                </p>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button 
                                    onClick={handleSaveSheetConfig} 
                                    isLoading={isLoadingConfig}
                                    disabled={!isSupabaseConfigured()}
                                    icon={<Save className="w-4 h-4" />}
                                >
                                    Simpan Konfigurasi
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};