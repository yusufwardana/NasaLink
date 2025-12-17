


import React, { useState, useEffect, useRef } from 'react';
import { MessageTemplate, SheetConfig } from '../types';
import { Button } from './Button';
import { saveTemplatesToSupabase, fetchSettingsFromSupabase, saveSettingsToSupabase, isSupabaseConfigured } from '../services/supabaseService';
import { getSheetConfig, saveSheetConfig, saveBulkTemplates } from '../services/dbService';
import { X, Plus, Trash2, Check, LayoutTemplate, Database, AlertTriangle, Save, PlayCircle, Bot, Type, Info, Layers, ChevronRight, Wand2, Eye, Key, Loader2, ArrowLeft, RefreshCw, Sliders, Monitor, Zap, Cloud, Wifi, WifiOff, FileSpreadsheet, Bug, Table, UserCircle2 } from 'lucide-react';

interface AdminPanelProps {
  onBack: () => void;
  templates: MessageTemplate[];
  onUpdateTemplates: (templates: MessageTemplate[]) => void;
  onResetData: () => void;
  onTestTemplate?: (templateId: string) => void;
  onBulkUpdateMode?: (mode: 'ai' | 'manual') => void;
  defaultTemplates?: MessageTemplate[];
  currentConfig?: SheetConfig | null; 
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onBack, 
  templates, 
  onUpdateTemplates,
  onResetData,
  onTestTemplate,
  onBulkUpdateMode,
  defaultTemplates,
  currentConfig
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'features' | 'database'>('templates');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MessageTemplate>>({});
  
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
      spreadsheetId: '',
      sheetName: 'Data',
      planSheetName: 'Plan',
      googleScriptUrl: '',
      prsThresholdDays: 1,
      refinancingLookaheadMonths: 1,
      showHeroSection: true,
      showStatsCards: true,
      enableDebugMode: false,
      defaultCoName: ''
  });
  
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentConfig) {
        setSheetConfig(currentConfig);
    }
    setIsCloudConnected(isSupabaseConfigured());
  }, [currentConfig]);

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
    setIsSavingTemplates(true);

    try {
        await saveBulkTemplates(updatedTemplates);
        if (isSupabaseConfigured()) {
            await saveTemplatesToSupabase(updatedTemplates);
        }
    } catch (e) {
        console.error("Failed to sync templates:", e);
        alert("Template disimpan di lokal, namun gagal sync ke cloud.");
    } finally {
        setIsSavingTemplates(false);
    }
  };

  const handleDeleteCurrent = async () => {
    if (!selectedTemplateId) return;
    if (window.confirm('Hapus template ini secara Global?')) {
      const remaining = templates.filter(t => t.id !== selectedTemplateId);
      onUpdateTemplates(remaining);
      setSelectedTemplateId(null);
      setEditForm({});
      
      setIsSavingTemplates(true);
      try {
          await saveBulkTemplates(remaining); 
          if (isSupabaseConfigured()) {
            await saveTemplatesToSupabase(remaining); 
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsSavingTemplates(false);
      }
    }
  };

  const handleResetDefaults = async () => {
      if (!defaultTemplates) return;
      if (window.confirm("PERINGATAN: Ini akan menghapus semua template yang ada dan menggantinya dengan Template Standar. Lanjutkan?")) {
          onUpdateTemplates(defaultTemplates);
          setIsSavingTemplates(true);
          try {
              await saveBulkTemplates(defaultTemplates); 
              if (isSupabaseConfigured()) {
                  await saveTemplatesToSupabase(defaultTemplates); 
                  alert("Template berhasil direset ke standar.");
              }
          } catch (e) {
              console.error(e);
              alert("Gagal reset database.");
          } finally {
              setIsSavingTemplates(false);
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
      if (!onBulkUpdateMode) {
          alert("Fitur Bulk Update tidak tersedia. Mohon refresh halaman.");
          return;
      }
      if (window.confirm(`Ubah SEMUA template menjadi mode ${mode.toUpperCase()}?`)) {
          onBulkUpdateMode(mode);
      }
  };

  const handleSaveSheetConfig = async () => {
      setIsLoadingConfig(true);
      try {
          await saveSheetConfig(sheetConfig);
          let msg = 'Konfigurasi disimpan di perangkat ini.';

          if (isSupabaseConfigured()) {
              await saveSettingsToSupabase(sheetConfig);
              msg = '✅ Sukses! Pengaturan disimpan ke Server (Supabase) & Lokal.';
          } else {
              msg = '⚠️ Disimpan di Lokal Saja (Supabase Tidak Terhubung).';
          }
          
          if(window.confirm(`${msg}\n\nRefresh aplikasi sekarang agar perubahan aktif?`)) {
              window.location.reload();
          }
      } catch (e) {
          console.error(e);
          alert("Gagal menyimpan konfigurasi.");
      } finally {
          setIsLoadingConfig(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 animate-fade-in-up">
      
      {/* Header - Sticky */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm px-4 py-4 flex items-center gap-4">
        <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all"
        >
            <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-slate-500" />
                Menu Admin
            </h2>
            <p className="text-sm text-slate-500">Pengaturan Aplikasi (Supabase)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-2 sticky top-[76px] z-30 shadow-sm overflow-x-auto">
        <div className="flex min-w-full">
            <button 
                onClick={() => setActiveTab('templates')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap px-4 ${activeTab === 'templates' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}
            >
                <LayoutTemplate className="w-4 h-4" /> Template
            </button>
            <button 
                onClick={() => setActiveTab('features')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap px-4 ${activeTab === 'features' ? 'border-purple-500 text-purple-600' : 'border-transparent text-slate-400'}`}
            >
                <Sliders className="w-4 h-4" /> Fitur
            </button>
            <button 
                onClick={() => setActiveTab('database')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap px-4 ${activeTab === 'database' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400'}`}
            >
                <Database className="w-4 h-4" /> Database
            </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        
        {/* --- TAB 1: TEMPLATES (Same logic) --- */}
        {activeTab === 'templates' && (
            <div className="space-y-4 animate-fade-in-up">
                {selectedTemplateId ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                             <button onClick={() => setSelectedTemplateId(null)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                                 <ArrowLeft className="w-5 h-5" />
                             </button>
                             <h3 className="font-bold text-slate-700">Edit Template</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-16">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1 text-center">Icon</label>
                                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-2xl" value={editForm.icon || ''} onChange={e => setEditForm({...editForm, icon: e.target.value})} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Judul</label>
                                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-bold" value={editForm.label || ''} onChange={e => setEditForm({...editForm, label: e.target.value})} />
                                </div>
                            </div>
                            <div className="bg-slate-50 p-1 rounded-xl flex border border-slate-200">
                                <button onClick={() => setEditForm(prev => ({ ...prev, type: 'ai' }))} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${editForm.type === 'ai' ? 'bg-orange-600 text-white shadow' : 'text-slate-400'}`}>
                                    <Bot className="w-4 h-4" /> AI
                                </button>
                                <button onClick={() => setEditForm(prev => ({ ...prev, type: 'manual' }))} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${editForm.type === 'manual' ? 'bg-purple-600 text-white shadow' : 'text-slate-400'}`}>
                                    <Type className="w-4 h-4" /> Manual
                                </button>
                            </div>
                            {editForm.type === 'ai' ? (
                                <textarea className="w-full h-48 bg-white border border-slate-200 rounded-2xl p-4 text-sm" value={editForm.promptContext || ''} onChange={e => setEditForm({...editForm, promptContext: e.target.value})} placeholder="Instruksi AI..." />
                            ) : (
                                <div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {[{ label: '+ Nama', code: '{name}' }, { label: '+ Sentra', code: '{sentra}' }, { label: '+ HP', code: '{phone}' }].map((chip) => (
                                            <button key={chip.code} onClick={() => handleInsertVariable(chip.code)} className="px-2 py-1 bg-purple-50 border border-purple-200 rounded text-[10px] font-bold text-purple-600">{chip.label}</button>
                                        ))}
                                    </div>
                                    <textarea ref={textAreaRef} className="w-full h-48 bg-white border border-slate-200 rounded-2xl p-4 text-sm font-mono" value={editForm.content || ''} onChange={e => setEditForm({...editForm, content: e.target.value})} />
                                </div>
                            )}
                            <div className="pt-6 border-t border-slate-100 flex gap-3">
                                <button onClick={handleDeleteCurrent} className="p-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50"><Trash2 className="w-5 h-5" /></button>
                                <Button className="flex-1 shadow-lg shadow-orange-500/20" onClick={handleSaveCurrent} isLoading={isSavingTemplates} icon={<Save className="w-4 h-4" />}>Simpan</Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <Button onClick={handleStartAdd} variant="outline" className="w-full justify-center py-3 mb-4 border-dashed" icon={<Plus className="w-4 h-4" />}>Buat Template Baru</Button>
                        <div className="space-y-3">
                            {templates.map(t => (
                                <button key={t.id} onClick={() => handleSelectTemplate(t)} className="w-full text-left p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between group hover:border-orange-300 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl w-10 h-10 flex items-center justify-center bg-slate-50 rounded-lg">{t.icon}</span>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm group-hover:text-orange-700">{t.label}</div>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${t.type === 'manual' ? 'text-purple-600 bg-purple-100' : 'text-orange-600 bg-orange-100'}`}>{t.type === 'manual' ? 'MANUAL' : 'AI AUTO'}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500" />
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* --- TAB 2: FEATURES --- */}
        {activeTab === 'features' && (
            <div className="space-y-6 animate-fade-in-up">
                {/* 2. Pengaturan Logika Follow Up */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-orange-600" />
                        Logika Notifikasi
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Alert PRS (Kumpulan)</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="number" 
                                    min="0" max="7"
                                    className="w-20 p-3 text-center font-bold text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500/50 outline-none"
                                    value={sheetConfig.prsThresholdDays ?? 1}
                                    onChange={e => setSheetConfig({...sheetConfig, prsThresholdDays: parseInt(e.target.value)})}
                                />
                                <span className="text-sm text-slate-600">Hari sebelum Tanggal PRS (H-X)</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Default: 1 (Muncul notifikasi besok kumpulan).</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Jangkauan Refinancing (Jatuh Tempo)</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="number" 
                                    min="0" max="6"
                                    className="w-20 p-3 text-center font-bold text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500/50 outline-none"
                                    value={sheetConfig.refinancingLookaheadMonths ?? 1}
                                    onChange={e => setSheetConfig({...sheetConfig, refinancingLookaheadMonths: parseInt(e.target.value)})}
                                />
                                <span className="text-sm text-slate-600">Bulan ke depan (M+X)</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Default: 1 (Menampilkan jatuh tempo bulan ini & bulan depan).</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveSheetConfig} isLoading={isLoadingConfig} icon={<Save className="w-4 h-4" />}>
                        Simpan Pengaturan
                    </Button>
                </div>
            </div>
        )}

        {/* --- TAB 3: DATABASE --- */}
        {activeTab === 'database' && (
            <div className="space-y-6 animate-fade-in-up">
                
                {/* Cloud Status Indicator */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${isCloudConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-200 text-red-500'}`}>
                    {isCloudConnected ? <Cloud className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
                    <div>
                        <p className="text-sm font-bold uppercase">{isCloudConnected ? 'Database: Terhubung ke Supabase' : 'Database: Terputus'}</p>
                        <p className="text-xs opacity-80 mt-1">
                            {isCloudConnected 
                                ? 'Data tersimpan di Cloud Database Supabase.' 
                                : 'Cek konfigurasi di config.ts.'}
                        </p>
                    </div>
                </div>

                {/* PERSONALIZATION CONFIG (CO NAME) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UserCircle2 className="w-5 h-5 text-purple-600" />
                        Konfigurasi Personal
                    </h3>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Nama CO Default (Saya)</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-purple-500/50 outline-none"
                            value={sheetConfig.defaultCoName || ''}
                            onChange={e => setSheetConfig({...sheetConfig, defaultCoName: e.target.value})}
                            placeholder="Contoh: ALDA MANDA"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            Nama ini akan digunakan sebagai default di form input rencana agar baku dan tidak perlu pilih manual.
                        </p>
                    </div>
                </div>

                {/* AI Configuration Section - Fixed to comply with security guidelines */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-600" />
                        Status AI
                    </h3>
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-sm">
                             <p className="font-bold mb-1">Koneksi AI Terintegrasi</p>
                             <p className="opacity-80">AI Wording Generator menggunakan API Key yang dikelola secara aman oleh sistem.</p>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleSaveSheetConfig} isLoading={isLoadingConfig} icon={<Save className="w-4 h-4" />}>
                                Simpan Pengaturan
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