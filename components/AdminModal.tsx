import React, { useState, useEffect, useRef } from 'react';
import { MessageTemplate, SheetConfig } from '../types';
import { Button } from './Button';
import { getSheetConfig, saveSheetConfig } from '../services/dbService';
import { saveTemplatesToSheet } from '../services/sheetService'; // Import save sync
import { GLOBAL_CONFIG } from '../config';
import { X, Plus, Trash2, Check, LayoutTemplate, Database, AlertTriangle, Save, PlayCircle, Bot, Type, Info, Layers, ChevronRight, Wand2, Eye, Lock, Code, Globe } from 'lucide-react';

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
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({ spreadsheetId: '', sheetName: '', googleScriptUrl: '' });
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  
  const isGlobalConfigActive = !!(GLOBAL_CONFIG.spreadsheetId && GLOBAL_CONFIG.spreadsheetId.trim() !== '');

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
        setIsLoadingConfig(true);
        if (isGlobalConfigActive) {
            setSheetConfig(GLOBAL_CONFIG);
            setIsLoadingConfig(false);
        } else {
            getSheetConfig().then((config) => {
                if (config) {
                    setSheetConfig(config);
                }
            }).finally(() => {
                setIsLoadingConfig(false);
            });
        }
    }
  }, [isOpen, isGlobalConfigActive]);

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

    // 2. Sync to Global Sheet
    if (sheetConfig.googleScriptUrl) {
        setIsSavingTemplates(true);
        try {
            await saveTemplatesToSheet(sheetConfig.googleScriptUrl, updatedTemplates);
            // No alert needed, just background sync
        } catch (e) {
            console.error("Failed to sync templates globally:", e);
            alert("Gagal menyimpan ke Cloud (Global). Periksa koneksi atau Script.");
        } finally {
            setIsSavingTemplates(false);
        }
    } else {
        alert("Peringatan: URL Script belum diisi. Template hanya tersimpan sementara di sesi ini.");
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

      if (sheetConfig.googleScriptUrl) {
        setIsSavingTemplates(true);
        try {
            await saveTemplatesToSheet(sheetConfig.googleScriptUrl, remaining);
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
          // Note: App.tsx will update state, but we need to trigger save to sheet
          // This is complex as onBulkUpdateMode is async state update.
          // Ideally user should click "Save" on a template to trigger sync or we assume user knows they need to edit and save.
      }
  };

  const handleSaveSheetConfig = async () => {
      if (isGlobalConfigActive) {
          alert("Pengaturan dikunci karena Mode Global aktif.");
          return;
      }
      setIsLoadingConfig(true);
      try {
          await saveSheetConfig(sheetConfig);
          alert('Konfigurasi Google Sheet berhasil disimpan!');
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingConfig(false);
      }
  };

  const handleReset = () => {
      if (window.confirm('PERINGATAN: Reset data lokal?')) {
          onResetData();
          onClose();
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
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>

        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/50 shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg text-white shadow-md">
                <Database className="w-5 h-5" />
             </div>
             <div>
                 <h2 className="text-lg font-bold text-slate-800 leading-none">Admin Global</h2>
                 <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                     {isSavingTemplates ? (
                         <span className="text-orange-500 animate-pulse font-bold">Menyimpan ke Cloud...</span>
                     ) : (
                         <span className="text-green-600">Terhubung ke Google Sheets</span>
                     )}
                 </p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50/50 shrink-0">
            <button 
                onClick={() => setActiveTab('templates')}
                className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${activeTab === 'templates' ? 'border-cyan-500 text-cyan-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
            >
                <LayoutTemplate className="w-4 h-4" /> Template Pesan
            </button>
            <button 
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${activeTab === 'settings' ? 'border-pink-500 text-pink-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
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
                                className="w-full justify-start text-xs border-dashed border-slate-300 hover:border-cyan-400 hover:text-cyan-600" 
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
                                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex items-center justify-between group ${
                                        selectedTemplateId === t.id 
                                        ? 'bg-cyan-50 border-cyan-200 shadow-sm' 
                                        : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl opacity-80">{t.icon}</span>
                                        <div>
                                            <div className="font-semibold text-sm text-slate-800">{t.label}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide ${
                                                    t.type === 'manual' ? 'text-purple-600 bg-purple-100' : 'text-cyan-600 bg-cyan-100'
                                                }`}>
                                                    {t.type === 'manual' ? 'MANUAL' : 'AI AUTO'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedTemplateId === t.id ? 'text-cyan-500 translate-x-1' : ''}`} />
                                </button>
                            ))}
                        </div>
                        
                        <div className="p-3 border-t border-slate-200 bg-slate-100/50">
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1">
                                <Layers className="w-3 h-3" /> Global Actions
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleBulkMode('ai')} className="flex-1 py-1.5 rounded bg-white text-[10px] text-slate-500 hover:text-cyan-600 border border-slate-200 hover:border-cyan-300 transition-colors shadow-sm">
                                    Set All AI
                                </button>
                                <button onClick={() => handleBulkMode('manual')} className="flex-1 py-1.5 rounded bg-white text-[10px] text-slate-500 hover:text-purple-600 border border-slate-200 hover:border-purple-300 transition-colors shadow-sm">
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
                                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-center text-2xl focus:ring-2 focus:ring-cyan-500/50 outline-none text-slate-800 transition-all hover:bg-slate-50"
                                                value={editForm.icon || ''}
                                                onChange={e => setEditForm({...editForm, icon: e.target.value})}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Nama Kategori</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-cyan-500/50 outline-none text-slate-800 font-bold text-lg placeholder-slate-300 transition-all hover:bg-slate-50"
                                                value={editForm.label || ''}
                                                onChange={e => setEditForm({...editForm, label: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-1 rounded-xl flex border border-slate-200 shadow-sm">
                                    <button 
                                        onClick={() => setEditForm(prev => ({ ...prev, type: 'ai' }))}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                            editForm.type === 'ai' 
                                            ? 'bg-cyan-600 text-white shadow-md' 
                                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Bot className="w-3.5 h-3.5" /> AI Generator
                                    </button>
                                    <button 
                                        onClick={() => setEditForm(prev => ({ ...prev, type: 'manual' }))}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
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
                                                <label className="text-xs font-bold text-cyan-600 uppercase tracking-wider flex items-center gap-2">
                                                    <Wand2 className="w-3 h-3" /> Instruksi untuk AI
                                                </label>
                                            </div>
                                            <textarea 
                                                className="w-full h-48 bg-white border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-cyan-500/50 outline-none text-slate-800 text-sm leading-relaxed placeholder-slate-300 resize-none transition-all hover:bg-slate-50"
                                                value={editForm.promptContext || ''}
                                                onChange={e => setEditForm({...editForm, promptContext: e.target.value})}
                                                placeholder="Contoh: Ingatkan Ibu nasabah untuk hadir di kumpulan..."
                                            />
                                            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 flex gap-3">
                                                <Info className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                                                <p className="text-xs text-cyan-800">
                                                    Perubahan akan disimpan di Google Sheet (Tab "Templates") dan otomatis terupdate di semua perangkat.
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
                                                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-[10px] font-bold text-purple-600 uppercase tracking-wide"
                                                    >
                                                        {chip.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <textarea 
                                                ref={textAreaRef}
                                                className="w-full h-48 bg-white border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-purple-500/50 outline-none text-slate-800 text-sm font-mono leading-relaxed placeholder-slate-300 resize-none transition-all hover:bg-slate-50"
                                                value={editForm.content || ''}
                                                onChange={e => setEditForm({...editForm, content: e.target.value})}
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
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Hapus Global
                                    </button>
                                    
                                    <div className="flex gap-3">
                                        {onTestTemplate && (
                                            <Button 
                                                variant="secondary"
                                                onClick={() => {
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
                                            className="shadow-lg shadow-cyan-500/20"
                                        >
                                            {isSavingTemplates ? 'Menyimpan...' : 'Simpan Global'}
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
                    <div className={`bg-white border rounded-2xl p-6 shadow-sm ${isGlobalConfigActive ? 'border-cyan-200 bg-cyan-50/50' : 'border-slate-200'}`}>
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Globe className={`w-5 h-5 ${isGlobalConfigActive ? 'text-cyan-600' : 'text-green-600'}`} />
                            Konfigurasi Global
                        </h3>
                        
                        <div className="space-y-4">
                            {isGlobalConfigActive && (
                                <div className="bg-cyan-100 border border-cyan-200 text-cyan-800 p-4 rounded-xl flex items-start gap-3 text-sm">
                                    <Lock className="w-5 h-5 shrink-0" />
                                    <div>
                                        <p className="font-bold">Pengaturan Terpusat (Hardcoded)</p>
                                        <p className="opacity-90 mt-1">
                                            ID Spreadsheet dan URL Script dikelola secara terpusat dari kode. Anda tidak perlu mengubahnya di sini.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Spreadsheet ID</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-xl p-3 text-slate-800 bg-slate-100 cursor-not-allowed"
                                    value={sheetConfig.spreadsheetId}
                                    disabled
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">URL Apps Script</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-xl p-3 text-slate-800 bg-slate-100 cursor-not-allowed font-mono text-xs"
                                    value={sheetConfig.googleScriptUrl || ''}
                                    disabled
                                />
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