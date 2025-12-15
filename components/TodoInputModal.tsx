
import React, { useState, useEffect, useMemo } from 'react';
import { DailyPlan, Contact } from '../types';
import { Button } from './Button';
import { X, Save, Calendar, ChevronRight, TrendingUp, AlertTriangle, FileText, CheckCircle2, Circle, AlertCircle, BarChart2, Target, Wand2 } from 'lucide-react';

interface TodoInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: DailyPlan) => Promise<void>;
  availableCos: string[];
  dailyPlans: DailyPlan[]; 
  contacts: Contact[]; 
}

type InputMode = 'plan' | 'actual';

export const TodoInputModal: React.FC<TodoInputModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave,
  availableCos,
  dailyPlans,
  contacts
}) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<InputMode>('plan');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Selection State
  const [selectedCtxIds, setSelectedCtxIds] = useState<Set<string>>(new Set());
  const [selectedLantakurIds, setSelectedLantakurIds] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState<Partial<DailyPlan>>({
      id: '',
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }), 
      coName: '',
      // Targets
      swCurrentNoa: '', swCurrentDisb: '',
      swNextNoa: '', swNextDisb: '',
      colCtxNoa: '', colCtxOs: '',
      colLantakurNoa: '', colLantakurOs: '',
      fppbNoa: '', biometrikNoa: '',
      // Actuals
      actualSwNoa: '', actualSwDisb: '',
      actualSwNextNoa: '', actualSwNextDisb: '',
      actualCtxNoa: '', actualCtxOs: '',
      actualLantakurNoa: '', actualLantakurOs: '',
      actualFppbNoa: '', actualBiometrikNoa: '',
      notes: ''
  });

  // --- HELPERS ---
  const parseMoney = (val?: string) => {
      if (!val) return 0;
      return parseInt(val.replace(/[^0-9]/g, '') || '0', 10);
  };

  const formatShortIDR = (num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + ' Jt';
      return (num / 1000).toFixed(0) + ' Rb';
  };

  const normalizeDate = (d: string) => {
      const parts = d.split('/');
      if (parts.length === 3) {
          return parts.map(p => p.padStart(2, '0')).join('/');
      }
      return d;
  };

  // --- FILTER LOGIC FOR CHECKLISTS ---
  const relevantCtxContacts = useMemo(() => {
      if (!formData.coName) return [];
      return contacts.filter(c => {
          if (c.co !== formData.coName) return false;
          const flag = (c.flag || '').toLowerCase();
          if (flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('inactive')) return false;
          const flagMenunggak = (c.flagMenunggak || '').toLowerCase();
          return flagMenunggak.includes('ctx');
      }).sort((a, b) => parseInt(a.dpd || '0') - parseInt(b.dpd || '0'));
  }, [contacts, formData.coName]);

  const relevantLantakurContacts = useMemo(() => {
    if (!formData.coName) return [];
    return contacts.filter(c => {
        if (c.co !== formData.coName) return false;
        const flag = (c.flag || '').toLowerCase();
        if (flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('inactive')) return false;
        return (c.flagLantakur || '').toLowerCase().includes('lantakur');
    });
  }, [contacts, formData.coName]);


  // --- AUTO CALCULATION FROM CHECKLIST ---
  useEffect(() => {
      if (selectedCtxIds.size >= 0) {
          const selectedContacts = relevantCtxContacts.filter(c => selectedCtxIds.has(c.id));
          const totalNoa = selectedContacts.length;
          const totalOs = selectedContacts.reduce((sum, c) => sum + parseMoney(c.os), 0);
          
          setFormData(prev => ({
              ...prev,
              [mode === 'plan' ? 'colCtxNoa' : 'actualCtxNoa']: totalNoa > 0 ? totalNoa.toString() : '',
              [mode === 'plan' ? 'colCtxOs' : 'actualCtxOs']: totalOs > 0 ? totalOs.toString() : ''
          }));
      }
  }, [selectedCtxIds, relevantCtxContacts, mode]);

  useEffect(() => {
      if (selectedLantakurIds.size >= 0) {
          const selectedContacts = relevantLantakurContacts.filter(c => selectedLantakurIds.has(c.id));
          const totalNoa = selectedContacts.length;
          const totalOs = selectedContacts.reduce((sum, c) => sum + parseMoney(c.os), 0);
          
          setFormData(prev => ({
              ...prev,
              [mode === 'plan' ? 'colLantakurNoa' : 'actualLantakurNoa']: totalNoa > 0 ? totalNoa.toString() : '',
              [mode === 'plan' ? 'colLantakurOs' : 'actualLantakurOs']: totalOs > 0 ? totalOs.toString() : ''
          }));
      }
  }, [selectedLantakurIds, relevantLantakurContacts, mode]);


  // --- LOAD EXISTING DATA ---
  const loadExistingData = (date: string, co: string) => {
      if (!date || !co) return;
      const normDate = normalizeDate(date);
      const existingPlan = dailyPlans.find(p => 
          normalizeDate(p.date) === normDate && 
          p.coName.toLowerCase() === co.toLowerCase()
      );

      if (existingPlan) {
          setFormData({ ...existingPlan });
      } else {
          setFormData(prev => ({
              ...prev,
              id: '',
              swCurrentNoa: '', swCurrentDisb: '',
              swNextNoa: '', swNextDisb: '',
              colCtxNoa: '', colCtxOs: '',
              colLantakurNoa: '', colLantakurOs: '',
              fppbNoa: '', biometrikNoa: '',
              actualSwNoa: '', actualSwDisb: '',
              actualSwNextNoa: '', actualSwNextDisb: '',
              actualCtxNoa: '', actualCtxOs: '',
              actualLantakurNoa: '', actualLantakurOs: '',
              actualFppbNoa: '', actualBiometrikNoa: '',
              notes: ''
          }));
          setSelectedCtxIds(new Set());
          setSelectedLantakurIds(new Set());
      }
  };

  useEffect(() => {
      if (formData.date && formData.coName) {
          loadExistingData(formData.date, formData.coName);
      }
  }, [formData.date, formData.coName]);


  if (!isOpen) return null;

  const handleChange = (field: keyof DailyPlan, value: string) => {
      if (field !== 'coName' && field !== 'date' && field !== 'notes' && field !== 'id') {
          const numeric = value.replace(/[^0-9.,]/g, '');
          setFormData(prev => ({ ...prev, [field]: numeric }));
      } else {
          setFormData(prev => ({ ...prev, [field]: value }));
      }
  };

  // --- SMART INPUT HANDLER ---
  const handleSmartCurrencyBlur = (field: keyof DailyPlan, value: string) => {
      const normalized = value.replace(/,/g, '.');
      const num = parseFloat(normalized);

      if (!isNaN(num) && num > 0) {
          // Rule: If < 1000, convert to millions
          if (num < 1000) {
              const millions = num * 1000000;
              setFormData(prev => ({ ...prev, [field]: millions.toString() }));
          }
      }
  };

  const toggleCtxContact = (id: string) => {
      const newSet = new Set(selectedCtxIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedCtxIds(newSet);
  };

  const toggleLantakurContact = (id: string) => {
      const newSet = new Set(selectedLantakurIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedLantakurIds(newSet);
  };

  const handleSubmit = async () => {
      if (!formData.coName) {
          alert("Mohon pilih Nama CO terlebih dahulu.");
          return;
      }
      setIsSubmitting(true);
      try {
          const finalPlan: DailyPlan = {
              ...(formData as DailyPlan),
              id: formData.id || `${Date.now()}-${Math.floor(Math.random()*1000)}`,
              date: formData.date || new Date().toLocaleDateString('id-ID'),
          };
          await onSave(finalPlan);
          onClose();
          setStep(1);
          setMode('plan');
          setFormData({ ...formData, coName: '' }); 
      } catch (e) {
          alert("Gagal menyimpan rencana.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const renderInputPair = (label: string, fieldNoa: keyof DailyPlan, fieldVal: keyof DailyPlan, isMillions: boolean = false) => (
      <div className={`p-3 rounded-xl border ${mode === 'plan' ? 'bg-slate-50 border-slate-200' : 'bg-white border-orange-200 shadow-sm'}`}>
          <p className={`text-[10px] font-bold mb-3 uppercase ${mode === 'plan' ? 'text-slate-400' : 'text-orange-600'}`}>
              {label} ({mode === 'plan' ? 'Target' : 'Aktual'})
          </p>
          <div className="flex gap-4">
              <div className="flex-1 relative">
                  <label className="text-[9px] font-bold text-slate-400 absolute -top-2 left-0">NOA (Nasabah)</label>
                  <input 
                      type="tel"
                      className="w-full bg-transparent font-bold text-slate-800 outline-none text-base placeholder-slate-300 pt-2"
                      placeholder="0"
                      value={formData[fieldNoa] || ''}
                      onChange={e => handleChange(fieldNoa, e.target.value)}
                  />
                  <div className="h-0.5 w-full bg-slate-200 mt-1"></div>
              </div>
              <div className="flex-[1.5] relative">
                  <label className="text-[9px] font-bold text-slate-400 absolute -top-2 right-0">
                      {isMillions ? 'Disb (Juta Rp)' : 'Nominal (Rp)'}
                  </label>
                  <input 
                      type="tel"
                      className="w-full bg-transparent font-bold text-slate-800 outline-none text-base placeholder-slate-300 text-right pt-2"
                      placeholder={isMillions ? "Ketik 1 = 1 Juta" : "0"}
                      value={formData[fieldVal] || ''}
                      onChange={e => handleChange(fieldVal, e.target.value)}
                      onBlur={e => {
                          if (isMillions) handleSmartCurrencyBlur(fieldVal, e.target.value);
                      }}
                  />
                  <div className="h-0.5 w-full bg-slate-200 mt-1"></div>
                  {isMillions && (
                      <div className="text-[8px] text-orange-600 text-right mt-1 flex justify-end items-center gap-1 animate-pulse">
                          <Wand2 className="w-2.5 h-2.5" /> Auto: Ketik 1 jadi 1.000.000
                      </div>
                  )}
              </div>
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {mode === 'plan' ? <Target className="w-5 h-5 text-blue-600" /> : <BarChart2 className="w-5 h-5 text-orange-600" />}
                        {mode === 'plan' ? 'Input Rencana' : 'Update Realisasi'}
                    </h2>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button onClick={() => setMode('plan')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'plan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>TARGET</button>
                <button onClick={() => setMode('actual')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'actual' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>REALISASI</button>
            </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
            
            {/* Step 1: Identity & SW */}
            {step === 1 && (
                <div className="space-y-4 animate-fade-in-up">
                    <div className="flex gap-3">
                        <div className="w-1/3">
                             <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tanggal</label>
                             <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={formData.date} 
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                    className="bg-transparent font-bold text-slate-700 outline-none w-full text-xs"
                                />
                             </div>
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nama Petugas (CO)</label>
                            <select 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs focus:ring-2 focus:ring-orange-500/50 outline-none"
                                value={formData.coName}
                                onChange={e => setFormData({...formData, coName: e.target.value})}
                            >
                                <option value="">-- Pilih --</option>
                                {availableCos.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" /> 
                            Survey & Pencairan (SW)
                        </h3>
                        {renderInputPair("1. SW BULAN INI", mode === 'plan' ? 'swCurrentNoa' : 'actualSwNoa', mode === 'plan' ? 'swCurrentDisb' : 'actualSwDisb', true)}
                        {renderInputPair("2. SW BULAN DEPAN", mode === 'plan' ? 'swNextNoa' : 'actualSwNextNoa', mode === 'plan' ? 'swNextDisb' : 'actualSwNextDisb', true)}
                    </div>
                </div>
            )}

            {/* Step 2: Collection & Checklists */}
            {step === 2 && (
                <div className="space-y-6 animate-fade-in-up">
                    {/* CTX Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <h3 className="font-bold text-slate-700 text-sm">Collection CTX</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Total OS</p>
                                <p className="text-xs font-black text-red-600">
                                    {formatShortIDR(mode === 'plan' ? parseMoney(formData.colCtxOs) : parseMoney(formData.actualCtxOs))}
                                </p>
                            </div>
                        </div>
                        
                        <div className="space-y-2 mb-6 max-h-40 overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl p-2">
                            {relevantCtxContacts.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada nasabah CTX.</p>
                            ) : (
                                relevantCtxContacts.map(c => (
                                    <div key={c.id} 
                                        onClick={() => toggleCtxContact(c.id)}
                                        className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all mb-2 last:mb-0 ${selectedCtxIds.has(c.id) ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${selectedCtxIds.has(c.id) ? 'bg-red-500 border-red-500' : 'bg-white border-slate-300'}`}>
                                                {selectedCtxIds.has(c.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold ${selectedCtxIds.has(c.id) ? 'text-red-700' : 'text-slate-700'}`}>{c.name}</p>
                                                <p className="text-[9px] text-slate-500">{c.sentra} • OS: {formatShortIDR(parseMoney(c.os))}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Lantakur Section */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                <h3 className="font-bold text-slate-700 text-sm">Lancar Tabungan Kurang</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Total OS</p>
                                <p className="text-xs font-black text-amber-600">
                                    {formatShortIDR(mode === 'plan' ? parseMoney(formData.colLantakurOs) : parseMoney(formData.actualLantakurOs))}
                                </p>
                            </div>
                        </div>
                         <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl p-2">
                            {relevantLantakurContacts.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada nasabah Lantakur.</p>
                            ) : (
                                relevantLantakurContacts.map(c => (
                                    <div key={c.id} 
                                        onClick={() => toggleLantakurContact(c.id)}
                                        className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all mb-2 last:mb-0 ${selectedLantakurIds.has(c.id) ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${selectedLantakurIds.has(c.id) ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'}`}>
                                                {selectedLantakurIds.has(c.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold ${selectedLantakurIds.has(c.id) ? 'text-amber-700' : 'text-slate-700'}`}>{c.name}</p>
                                                <p className="text-[9px] text-slate-500">{c.sentra}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Admin & Notes */}
            {step === 3 && (
                <div className="space-y-6 animate-fade-in-up">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        Admin & Lainnya
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase">FPPB (NOA)</label>
                            <input 
                                type="tel" 
                                className="w-full bg-transparent font-bold text-slate-700 text-lg outline-none"
                                placeholder="0"
                                value={mode === 'plan' ? formData.fppbNoa : formData.actualFppbNoa}
                                onChange={e => handleChange(mode === 'plan' ? 'fppbNoa' : 'actualFppbNoa', e.target.value)}
                            />
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase">Biometrik (NOA)</label>
                            <input 
                                type="tel" 
                                className="w-full bg-transparent font-bold text-slate-700 text-lg outline-none"
                                placeholder="0"
                                value={mode === 'plan' ? formData.biometrikNoa : formData.actualBiometrikNoa}
                                onChange={e => handleChange(mode === 'plan' ? 'biometrikNoa' : 'actualBiometrikNoa', e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase">Catatan Harian</label>
                        <textarea 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                            rows={3}
                            placeholder="Kendala di lapangan, info penting..."
                            value={formData.notes || ''}
                            onChange={e => handleChange('notes', e.target.value)}
                        />
                    </div>
                </div>
            )}

        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
             {step > 1 && (
                 <Button variant="outline" onClick={() => setStep(s => s - 1)}>Kembali</Button>
             )}
             {step < 3 ? (
                 <Button className="flex-1" onClick={() => setStep(s => s + 1)} icon={<ChevronRight className="w-4 h-4" />}>
                     Lanjut
                 </Button>
             ) : (
                 <Button 
                    className="flex-1" 
                    onClick={handleSubmit} 
                    isLoading={isSubmitting}
                    icon={<Save className="w-4 h-4" />}
                 >
                     Simpan Rencana
                 </Button>
             )}
        </div>

      </div>
    </div>
  );
};
