
import React, { useState, useEffect, useMemo } from 'react';
import { DailyPlan, Contact } from '../types';
import { Button } from './Button';
import { X, Save, Calendar, ChevronRight, TrendingUp, AlertTriangle, FileText, Sparkles, CheckCircle2, Circle, AlertCircle, BarChart2, Target } from 'lucide-react';

interface TodoInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: DailyPlan) => Promise<void>;
  availableCos: string[];
  dailyPlans: DailyPlan[]; // Access history/existing plans
  contacts: Contact[]; // Full contact list to filter from
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
  const [autofillSource, setAutofillSource] = useState<string | null>(null);
  
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
      actualFppbNoa: '', actualBiometrikNoa: ''
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
      // Convert D/M/YYYY or DD/MM/YYYY to consistent format
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
  // Calculates Total selected and updates EITHER Plan OR Actual based on current `mode`
  useEffect(() => {
      // CTX Calc
      if (selectedCtxIds.size >= 0) { // Run even if 0 to clear
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
      // Lantakur Calc
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
      
      // Find exact match for Date + CO
      const existingPlan = dailyPlans.find(p => 
          normalizeDate(p.date) === normDate && 
          p.coName.toLowerCase() === co.toLowerCase()
      );

      if (existingPlan) {
          setFormData({ ...existingPlan }); // Load everything (Plan + Actuals)
          setAutofillSource(`Data Tersimpan (ID: ${existingPlan.id})`);
      } else {
          // No exact match for today.
          // If in PLAN mode, try to autofill TARGETS from latest previous plan
          const previousPlans = dailyPlans
            .filter(p => p.coName.toLowerCase() === co.toLowerCase())
            .sort((a, b) => b.id.localeCompare(a.id)); // Assuming ID is time-sortable or use Date parse
          
          if (previousPlans.length > 0) {
              const last = previousPlans[0];
              setFormData(prev => ({
                  ...prev,
                  id: '', // New ID for new date
                  swCurrentNoa: last.swCurrentNoa,
                  swCurrentDisb: last.swCurrentDisb,
                  swNextNoa: last.swNextNoa,
                  swNextDisb: last.swNextDisb,
                  // Reset Actuals
                  actualSwNoa: '', actualSwDisb: '', 
                  actualCtxNoa: '', actualCtxOs: '',
                  // ... reset others ...
              }));
              setAutofillSource(`Salin Target dari tgl ${last.date}`);
          } else {
              // Fresh start
              setAutofillSource(null);
              setFormData(prev => ({
                  ...prev,
                  id: '',
                  swCurrentNoa: '', swCurrentDisb: '',
                  // ... clear ...
              }));
          }
      }
  };

  // Trigger load when Date or CO changes
  useEffect(() => {
      if (formData.date && formData.coName) {
          loadExistingData(formData.date, formData.coName);
      }
  }, [formData.date, formData.coName]);


  if (!isOpen) return null;

  const handleChange = (field: keyof DailyPlan, value: string) => {
      // Allow only numbers, dots, commas for numeric fields
      if (field !== 'coName' && field !== 'date' && field !== 'notes' && field !== 'id') {
          const numeric = value.replace(/[^0-9.,]/g, '');
          setFormData(prev => ({ ...prev, [field]: numeric }));
      } else {
          setFormData(prev => ({ ...prev, [field]: value }));
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
          // Construct Payload
          // Use existing ID if available (Update), else create new
          const finalPlan: DailyPlan = {
              ...(formData as DailyPlan),
              id: formData.id || `${Date.now()}-${Math.floor(Math.random()*1000)}`,
              date: formData.date || new Date().toLocaleDateString('id-ID'),
          };
          
          await onSave(finalPlan);
          onClose();
          
          // Cleanup
          setStep(1);
          setMode('plan');
          setFormData({ ...formData, coName: '' }); 
          setSelectedCtxIds(new Set());
          setSelectedLantakurIds(new Set());
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
                      placeholder={isMillions ? "Misal: 2 (=2 Juta)" : "0"}
                      value={formData[fieldVal] || ''}
                      onChange={e => handleChange(fieldVal, e.target.value)}
                  />
                  <div className="h-0.5 w-full bg-slate-200 mt-1"></div>
                  {isMillions && <div className="text-[8px] text-slate-400 text-right mt-0.5 italic">Cukup tulis angka (misal 2)</div>}
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
                        {mode === 'plan' ? 'Input Rencana (Pagi)' : 'Update Realisasi (Sore)'}
                    </h2>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button 
                    onClick={() => setMode('plan')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'plan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                >
                    TARGET
                </button>
                <button 
                    onClick={() => setMode('actual')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'actual' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
                >
                    REALISASI (AKTUAL)
                </button>
            </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar">
            
            {/* Identity Section (Always Visible on Step 1) */}
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

                    {autofillSource && (
                        <div className="text-[10px] text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 flex items-center gap-2">
                            <Sparkles className="w-3 h-3" /> {autofillSource}
                        </div>
                    )}

                    <hr className="border-slate-100" />

                    {/* METRICS INPUT */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" /> 
                            Survey & Pencairan (SW)
                        </h3>
                        
                        {renderInputPair(
                            "1. SW BULAN INI", 
                            mode === 'plan' ? 'swCurrentNoa' : 'actualSwNoa',
                            mode === 'plan' ? 'swCurrentDisb' : 'actualSwDisb',
                            true // isMillions
                        )}
                        
                        {renderInputPair(
                            "2. SW BULAN DEPAN", 
                            mode === 'plan' ? 'swNextNoa' : 'actualSwNextNoa',
                            mode === 'plan' ? 'swNextDisb' : 'actualSwNextDisb',
                            true // isMillions
                        )}
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
                                <h3 className="font-bold text-slate-700 text-sm">Target CTX</h3>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${mode === 'plan' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                Mode: {mode === 'plan' ? 'Input Rencana' : 'Input Hasil'}
                            </span>
                        </div>

                        {/* Checklist */}
                        {relevantCtxContacts.length > 0 && (
                            <div className="mb-3 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                                        {mode === 'plan' ? 'Siapa yg akan ditagih?' : 'Siapa yg SUDAH bayar?'}
                                    </p>
                                </div>
                                <div className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                                    {relevantCtxContacts.map(c => {
                                        const isSelected = selectedCtxIds.has(c.id);
                                        return (
                                            <div key={c.id} onClick={() => toggleCtxContact(c.id)} className={`p-2.5 flex items-center justify-between cursor-pointer ${isSelected ? 'bg-green-50' : 'hover:bg-white'}`}>
                                                <div className="flex items-center gap-2">
                                                    {isSelected ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                                                    <div>
                                                        <p className={`text-xs font-bold ${isSelected ? 'text-green-800' : 'text-slate-700'}`}>{c.name}</p>
                                                        <p className="text-[9px] text-slate-500">{c.sentra} • <span className="text-red-500 font-bold">DPD: {c.dpd}</span></p>
                                                    </div>
                                                </div>
                                                <p className="text-xs font-bold text-slate-600">{formatShortIDR(parseMoney(c.os))}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {renderInputPair(
                            "CTX / Menunggak", 
                            mode === 'plan' ? 'colCtxNoa' : 'actualCtxNoa',
                            mode === 'plan' ? 'colCtxOs' : 'actualCtxOs'
                        )}
                    </div>

                    {/* Lantakur Section */}
                    <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <h3 className="font-bold text-slate-700 text-sm">Target Lantakur</h3>
                        </div>

                        {relevantLantakurContacts.length > 0 && (
                            <div className="mb-3 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                                        {mode === 'plan' ? 'Siapa yg akan diingatkan?' : 'Siapa yg SUDAH nambah saldo?'}
                                    </p>
                                </div>
                                <div className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                                    {relevantLantakurContacts.map(c => {
                                        const isSelected = selectedLantakurIds.has(c.id);
                                        return (
                                            <div key={c.id} onClick={() => toggleLantakurContact(c.id)} className={`p-2.5 flex items-center justify-between cursor-pointer ${isSelected ? 'bg-green-50' : 'hover:bg-white'}`}>
                                                <div className="flex items-center gap-2">
                                                    {isSelected ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                                                    <div className="overflow-hidden">
                                                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-green-800' : 'text-slate-700'}`}>{c.name}</p>
                                                        <p className="text-[9px] text-slate-500 truncate">{c.sentra}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {renderInputPair(
                            "Lantakur", 
                            mode === 'plan' ? 'colLantakurNoa' : 'actualLantakurNoa',
                            mode === 'plan' ? 'colLantakurOs' : 'actualLantakurOs'
                        )}
                    </div>

                    {/* Admin Section */}
                    <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-purple-500" />
                            <h3 className="font-bold text-slate-700 text-sm">Administrasi</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[9px] font-bold text-purple-500 mb-1">FPPB (NOA)</p>
                                <input 
                                    type="tel"
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-purple-700"
                                    value={mode === 'plan' ? formData.fppbNoa : formData.actualFppbNoa}
                                    onChange={e => handleChange(mode === 'plan' ? 'fppbNoa' : 'actualFppbNoa', e.target.value)}
                                />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-purple-500 mb-1">Biometrik (NOA)</p>
                                <input 
                                    type="tel"
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-purple-700"
                                    value={mode === 'plan' ? formData.biometrikNoa : formData.actualBiometrikNoa}
                                    onChange={e => handleChange(mode === 'plan' ? 'biometrikNoa' : 'actualBiometrikNoa', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center gap-3">
            {step === 2 ? (
                <>
                     <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">Kembali</Button>
                     <Button onClick={handleSubmit} isLoading={isSubmitting} icon={<Save className="w-4 h-4" />} className="flex-[2]">
                         {mode === 'plan' ? 'Simpan Rencana' : 'Simpan Realisasi'}
                     </Button>
                </>
            ) : (
                <>
                    <div className="text-xs text-slate-400">
                        Pastikan Tanggal & CO benar
                    </div>
                    <Button onClick={() => setStep(2)} icon={<ChevronRight className="w-4 h-4" />}>
                         Lanjut
                     </Button>
                </>
            )}
        </div>

      </div>
    </div>
  );
};
