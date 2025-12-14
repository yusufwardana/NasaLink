
import React, { useState, useEffect, useRef } from 'react';
import { MessageTemplate, SheetConfig } from '../types';
import { Button } from './Button';
import { saveTemplatesToSupabase, fetchSettingsFromSupabase, saveSettingsToSupabase, isSupabaseConfigured } from '../services/supabaseService';
import { getSheetConfig, saveSheetConfig } from '../services/dbService';
import { saveTemplatesToSheet } from '../services/sheetService';
import { GLOBAL_CONFIG } from '../config';
import { X, Plus, Trash2, Check, LayoutTemplate, Database, AlertTriangle, Save, PlayCircle, Bot, Type, Info, Layers, ChevronRight, Wand2, Eye, Key, Loader2, ArrowLeft, RefreshCw, Sliders, Monitor, Zap, Cloud, Wifi, WifiOff, FileSpreadsheet, Bug, Table } from 'lucide-react';

interface AdminPanelProps {
  // Removed isOpen since it's a page now
  onBack: () => void; // Renamed from onClose for clarity
  templates: MessageTemplate[];
  onUpdateTemplates: (templates: MessageTemplate[]) => void;
  onResetData: () => void;
  onTestTemplate?: (templateId: string) => void;
  onBulkUpdateMode?: (mode: 'ai' | 'manual') => void;
  defaultTemplates?: MessageTemplate[];
}

// Renamed to AdminPanel, but kept in AdminModal.tsx file to avoid file system errors
export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onBack, 
  templates, 
  onUpdateTemplates,
  onResetData,
  onTestTemplate,
  onBulkUpdateMode,
  defaultTemplates
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'features' | 'database'>('templates');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MessageTemplate>>({});
  
  // Initialize with flexible defaults
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(GLOBAL_CONFIG);
  
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load config on mount
    setIsLoadingConfig(true);
    setIsCloudConnected(isSupabaseConfigured());
    
    const initConfig = async () => {
        let config = { ...GLOBAL_CONFIG };
        
        try {
            // 1. Load Local
            const local = await getSheetConfig();
            if (local) config = { ...config, ...local };
            
            // 2. Load Supabase (if configured, override local)
            if (isSupabaseConfigured()) {
                    const remote = await fetchSettingsFromSupabase();
                    if (remote) config = { ...config, ...remote };
            }
        } catch (e) {
            console.warn("Error loading admin config:", e);
        }
        
        setSheetConfig(config);
        setIsLoadingConfig(false);
    };
    initConfig();
  }, []);

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
          // 1. Save Locally (Browser Persistence)
          await saveSheetConfig(sheetConfig);
          let msg = 'Konfigurasi disimpan di perangkat ini.';

          // 2. Save to Server (Supabase) if available
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

  // --- NEW: Backup to Sheet ---
  const handleBackupToSheet = async () => {
      if (!sheetConfig.googleScriptUrl) {
          alert("URL Apps Script belum disetting di bawah.");
          return;
      }
      setIsBackingUp(true);
      try {
          // Pass debug mode
          await saveTemplatesToSheet(sheetConfig.googleScriptUrl, templates, sheetConfig.enableDebugMode);
          alert("Backup berhasil! Cek sheet 'Templates' di Google Sheet Anda.");
      } catch (e) {
          console.error(e);
          alert("Gagal backup ke Sheet.");
      } finally {
          setIsBackingUp(false);
      }
  };

  // FULL PAGE LAYOUT (No Modal Overlays)
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
            <p className="text-sm text-slate-500">Pengaturan Aplikasi & Template</p>
        </div>
      </div>

      {/* Tabs - Sticky below header */}
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
        
        {/* --- TAB 1: TEMPLATES --- */}
        {activeTab === 'templates' && (
            <div className="space-y-4 animate-fade-in-up">
                {selectedTemplateId ? (
                    // Edit Form
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
                    // List
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
                        <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-4 h-4 text-slate-500" />
                                <p className="text-xs font-bold text-slate-500 uppercase">Aksi Massal (Bulk Actions)</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => handleBulkMode('ai')} 
                                        className="flex-1 py-2.5 bg-white hover:bg-orange-50 active:bg-orange-100 rounded-lg border border-slate-200 hover:border-orange-300 text-xs font-bold text-slate-600 hover:text-orange-600 shadow-sm transition-all"
                                    >
                                        Ubah Semua ke AI
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => handleBulkMode('manual')} 
                                        className="flex-1 py-2.5 bg-white hover:bg-purple-50 active:bg-purple-100 rounded-lg border border-slate-200 hover:border-purple-300 text-xs font-bold text-slate-600 hover:text-purple-600 shadow-sm transition-all"
                                    >
                                        Ubah Semua ke Manual
                                    </button>
                                </div>
                                {defaultTemplates && (
                                    <button 
                                        type="button"
                                        onClick={handleResetDefaults} 
                                        disabled={isSavingTemplates} 
                                        className="w-full py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold shadow-sm hover:bg-red-100 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Reset ke Template Standar (Isi CTX)
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        {/* --- TAB 2: FEATURES & LOGIC (NEW) --- */}
        {activeTab === 'features' && (
            <div className="space-y-6 animate-fade-in-up">
                {/* 1. Pengaturan Tampilan */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-purple-600" />
                        Tampilan Beranda
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                                <span className="block text-sm font-bold text-slate-700">Hero Section</span>
                                <span className="text-xs text-slate-500">Banner sambutan & deskripsi di atas.</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={sheetConfig.showHeroSection !== false} onChange={e => setSheetConfig({...sheetConfig, showHeroSection: e.target.checked})} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                                <span className="block text-sm font-bold text-slate-700">Kartu Statistik</span>
                                <span className="text-xs text-slate-500">Ringkasan total nasabah, sentra, CO.</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={sheetConfig.showStatsCards !== false} onChange={e => setSheetConfig({...sheetConfig, showStatsCards: e.target.checked})} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

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

                {/* 3. System Debugging (NEW) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-red-500">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Bug className="w-5 h-5 text-red-500" />
                        System Debugging
                    </h3>
                     <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                        <div>
                            <span className="block text-sm font-bold text-slate-700">Aktifkan Log Apps Script</span>
                            <span className="text-xs text-slate-500">Jika aktif, Script akan menulis error detail ke sheet "SystemLogs".</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={sheetConfig.enableDebugMode || false} onChange={e => setSheetConfig({...sheetConfig, enableDebugMode: e.target.checked})} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveSheetConfig} isLoading={isLoadingConfig} icon={<Save className="w-4 h-4" />}>
                        Simpan Pengaturan
                    </Button>
                </div>
            </div>
        )}

        {/* --- TAB 3: DATABASE (EXISTING) --- */}
        {activeTab === 'database' && (
            <div className="space-y-6 animate-fade-in-up">
                
                {/* Cloud Status Indicator */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${isCloudConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    {isCloudConnected ? <Cloud className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
                    <div>
                        <p className="text-sm font-bold uppercase">{isCloudConnected ? 'Cloud Sync: Terhubung' : 'Cloud Sync: Tidak Aktif'}</p>
                        <p className="text-xs opacity-80 mt-1">
                            {isCloudConnected 
                                ? 'Pengaturan akan disimpan otomatis ke Supabase (Server) & bisa diakses semua user.' 
                                : 'Pengaturan hanya tersimpan di perangkat ini (Local Browser). Setup Supabase di config.ts untuk mengaktifkan.'}
                        </p>
                    </div>
                </div>

                {/* NEW: TEMPLATE BACKUP CARD */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        Backup Template
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Simpan seluruh template pesan yang ada di aplikasi saat ini ke dalam Google Sheet (Tab "Templates") untuk backup.</p>
                    
                    <Button 
                        onClick={handleBackupToSheet} 
                        isLoading={isBackingUp}
                        variant="secondary"
                        className="w-full justify-center border-green-200 hover:bg-green-50 text-green-700"
                        icon={<Save className="w-4 h-4" />}
                    >
                        Backup Template ke Sheet
                    </Button>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-600" />
                        Koneksi Database Sheet
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
                        
                        {/* NEW: PLAN SHEET NAME CONFIG */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase flex items-center gap-1">
                                Nama Tab Plan <Table className="w-3 h-3" />
                            </label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 font-bold text-orange-600 focus:ring-2 focus:ring-orange-500/50 outline-none"
                                value={sheetConfig.planSheetName || 'Plan'}
                                onChange={e => setSheetConfig({...sheetConfig, planSheetName: e.target.value})}
                                placeholder="Plan"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Default: "Plan". Ganti jika Anda membuat sheet baru (misal: "Plan 2025").</p>
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
                            <Button onClick={handleSaveSheetConfig} isLoading={isLoadingConfig} icon={<Save className="w-4 h-4" />}>
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
