import React, { useState, useEffect, useRef } from 'react';
import { MessageTemplate, SheetConfig } from '../types';
import { Button } from './Button';
import { saveTemplatesToSupabase, fetchSettingsFromSupabase, saveSettingsToSupabase, isSupabaseConfigured } from '../services/supabaseService';
import { GLOBAL_CONFIG } from '../config';
import { X, Plus, Trash2, Check, LayoutTemplate, Database, AlertTriangle, Save, PlayCircle, Bot, Type, Info, Layers, ChevronRight, Wand2, Eye, Key, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  onUpdateTemplates: (templates: MessageTemplate[]) => void;
  onResetData: () => void;
  onTestTemplate?: (templateId: string) => void;
  onBulkUpdateMode?: (mode: 'ai' | 'manual') => void;
  defaultTemplates?: MessageTemplate[]; // New prop for reset capability
}

export const AdminModal: React.FC<AdminModalProps> = ({ 
  isOpen, 
  onClose, 
  templates, 
  onUpdateTemplates,
  onResetData,
  onTestTemplate,
  onBulkUpdateMode,
  defaultTemplates
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
    
    onUpdateTemplates(updatedTemplates);

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
      setSelectedTemplateId(null);
      setEditForm({});

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

  const handleResetDefaults = async () => {
      if (!defaultTemplates) return;
      if (window.confirm("PERINGATAN: Ini akan menghapus semua template yang ada dan menggantinya dengan Template Standar (Termasuk Penagihan CTX). Lanjutkan?")) {
          onUpdateTemplates(defaultTemplates);
          if (isSupabaseConfigured()) {
              setIsSavingTemplates(true);
              try {
                  await saveTemplatesToSupabase(defaultTemplates);
                  alert("Template berhasil direset ke standar.");
              } catch (e) {
                  console.error(e);
                  alert("Gagal reset database.");
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
      const newText = text.substring(0, start) + variable + text.substring(end);
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
          alert("Supabase belum dikonfigurasi.");
          return;
      }
      setIsLoadingConfig(true);
      try {
          await saveSettingsToSupabase(sheetConfig);
          alert('Konfigurasi Global berhasil disimpan!');
      } catch (e) {
          console.error(e);
          alert("Gagal menyimpan konfigurasi.");
      } finally {
          setIsLoadingConfig(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 animate-fade-in-up">
      {/* Page Header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
             <button 
                onClick={onClose}
                className="p-2 rounded-xl bg-white/50 hover:bg-slate-100 text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
             <div>
                 <h2 className="text-lg font-bold text-slate-800 leading-none flex items-center gap-2">
                    <Database className="w-5 h-5 text-slate-400" />
                    Pengaturan Admin
                 </h2>
                 <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                     {isSavingTemplates ? (
                         <span className="text-orange-600 animate-pulse font-bold flex items-center gap-1">
                             <Loader2 className="w-3 h-3 animate-spin" />
                             Menyimpan...
                         </span>
                     ) : isSupabaseConfigured() ? (
                         <span className="text-green-600 flex items-center gap-1">
                             <Check className="w-3 h-3" />
                             Online (Supabase)
                         </span>
                     ) : (
                         <span className="text-red-500 flex items-center gap-1">
                             <AlertTriangle className="w-3 h-3" />
                             Offline Mode
                         </span>
                     )}
                 </p>
             </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sticky top-[73px] z-30 shadow-sm">
        <div className="flex">
            <button 
                onClick={() => setActiveTab('templates')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'templates' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}
            >
                <LayoutTemplate className="w-4 h-4" /> Template
            </button>
            <button 
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'settings' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400'}`}
            >
                <Database className="w-4 h-4" /> Config
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {activeTab === 'templates' && (
            <div className="space-y-4">
                {selectedTemplateId ? (
                    // --- FORM EDIT TEMPLATE ---
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 animate-fade-in-up">
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                             <button onClick={() => setSelectedTemplateId(null)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                                 <ArrowLeft className="w-5 h-5" />
                             </button>
                             <h3 className="font-bold text-slate-700">Edit Template</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-16">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase text-center">Icon</label>
                                    <input 
                                        type="text" 
                                        disabled={isSavingTemplates}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-2xl focus:ring-2 focus:ring-orange-500/50 outline-none"
                                        value={editForm.icon || ''}
                                        onChange={e => setEditForm({...editForm, icon: e.target.value})}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Judul Template</label>
                                    <input 
                                        type="text" 
                                        disabled={isSavingTemplates}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-orange-500/50 outline-none font-bold text-slate-800"
                                        value={editForm.label || ''}
                                        onChange={e => setEditForm({...editForm, label: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-1 rounded-xl flex border border-slate-200">
                                <button 
                                    onClick={() => setEditForm(prev => ({ ...prev, type: 'ai' }))}
                                    disabled={isSavingTemplates}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                        editForm.type === 'ai' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400'
                                    }`}
                                >
                                    <Bot className="w-4 h-4" /> AI Generator
                                </button>
                                <button 
                                    onClick={() => setEditForm(prev => ({ ...prev, type: 'manual' }))}
                                    disabled={isSavingTemplates}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                        editForm.type === 'manual' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'
                                    }`}
                                >
                                    <Type className="w-4 h-4" /> Manual Text
                                </button>
                            </div>

                            {editForm.type === 'ai' ? (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-2">
                                        <Wand2 className="w-3 h-3" /> Instruksi untuk AI
                                    </label>
                                    <textarea 
                                        className="w-full h-48 bg-white border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-orange-500/50 outline-none text-slate-800 text-sm leading-relaxed"
                                        value={editForm.promptContext || ''}
                                        onChange={e => setEditForm({...editForm, promptContext: e.target.value})}
                                        placeholder="Contoh: Ingatkan Ibu nasabah..."
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-2">
                                        <Type className="w-3 h-3" /> Isi Pesan Baku
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {[{ label: '+ Nama', code: '{name}' }, { label: '+ Sentra', code: '{sentra}' }, { label: '+ HP', code: '{phone}' }].map((chip) => (
                                            <button
                                                key={chip.code}
                                                onClick={() => handleInsertVariable(chip.code)}
                                                className="px-2 py-1 bg-purple-50 border border-purple-200 rounded text-[10px] font-bold text-purple-600"
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea 
                                        ref={textAreaRef}
                                        className="w-full h-48 bg-white border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-purple-500/50 outline-none text-slate-800 text-sm font-mono leading-relaxed"
                                        value={editForm.content || ''}
                                        onChange={e => setEditForm({...editForm, content: e.target.value})}
                                    />
                                </div>
                            )}

                            <div className="pt-6 border-t border-slate-100 flex gap-3">
                                <button 
                                    onClick={handleDeleteCurrent}
                                    className="p-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <Button 
                                    className="flex-1 shadow-lg shadow-orange-500/20"
                                    onClick={handleSaveCurrent}
                                    isLoading={isSavingTemplates}
                                    icon={<Save className="w-4 h-4" />}
                                >
                                    Simpan Template
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- LIST TEMPLATE ---
                    <>
                        <Button 
                            onClick={handleStartAdd} 
                            variant="outline" 
                            className="w-full justify-center text-sm border-dashed border-slate-300 hover:border-orange-400 hover:text-orange-600 py-3 mb-4 bg-white" 
                            icon={<Plus className="w-4 h-4" />}
                        >
                            Buat Template Baru
                        </Button>

                        <div className="space-y-3">
                            {templates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => handleSelectTemplate(t)}
                                    className="w-full text-left p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between group active:scale-95 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl w-10 h-10 flex items-center justify-center bg-slate-50 rounded-lg">{t.icon}</span>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{t.label}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide ${
                                                    t.type === 'manual' ? 'text-purple-600 bg-purple-100' : 'text-orange-600 bg-orange-100'
                                                }`}>
                                                    {t.type === 'manual' ? 'MANUAL' : 'AI AUTO'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300" />
                                </button>
                            ))}
                        </div>

                        {/* Reset Actions */}
                        <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">System Actions</p>
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <button onClick={() => handleBulkMode('ai')} className="flex-1 py-2 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
                                        Set All to AI
                                    </button>
                                     <button onClick={() => handleBulkMode('manual')} className="flex-1 py-2 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
                                        Set All to Manual
                                    </button>
                                </div>
                                {defaultTemplates && (
                                    <button 
                                        onClick={handleResetDefaults} 
                                        disabled={isSavingTemplates}
                                        className="w-full py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold shadow-sm hover:bg-red-100 flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Reset ke Template Standar (Isi CTX)
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in-up">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    {/* Settings Form */}
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-600" />
                        Database Configuration
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Spreadsheet ID</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500/50 outline-none font-mono"
                                value={sheetConfig.spreadsheetId}
                                onChange={e => setSheetConfig({...sheetConfig, spreadsheetId: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">URL Apps Script</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500/50 outline-none"
                                value={sheetConfig.googleScriptUrl || ''}
                                onChange={e => setSheetConfig({...sheetConfig, googleScriptUrl: e.target.value})}
                            />
                        </div>
                        <div className="border-t border-slate-100 pt-4 mt-4">
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase flex items-center gap-1">
                                Gemini API Key <Key className="w-3 h-3" />
                            </label>
                            <input 
                                type="password" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500/50 outline-none"
                                value={sheetConfig.geminiApiKey || ''}
                                onChange={e => setSheetConfig({...sheetConfig, geminiApiKey: e.target.value})}
                                placeholder="AIza..."
                            />
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
  );
};