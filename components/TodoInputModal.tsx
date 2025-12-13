import React, { useState } from 'react';
import { DailyPlan } from '../types';
import { Button } from './Button';
import { X, Save, Calendar, Briefcase, ChevronRight, TrendingUp, AlertTriangle, Fingerprint, FileText, History, Sparkles } from 'lucide-react';

interface TodoInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: DailyPlan) => Promise<void>;
  availableCos: string[];
  dailyPlans: DailyPlan[]; // Added to access history
}

export const TodoInputModal: React.FC<TodoInputModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave,
  availableCos,
  dailyPlans
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autofillSource, setAutofillSource] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<DailyPlan>>({
      date: new Date().toLocaleDateString('id-ID'), 
      coName: '',
      swCurrentNoa: '', swCurrentDisb: '',
      swNextNoa: '', swNextDisb: '',
      colCtxNoa: '', colCtxOs: '',
      colLantakurNoa: '', colLantakurOs: '',
      fppbNoa: '', biometrikNoa: ''
  });

  if (!isOpen) return null;

  const handleChange = (field: keyof DailyPlan, value: string) => {
      // Only allow numbers for numeric fields
      if (field !== 'coName' && field !== 'date' && field !== 'notes') {
          const numeric = value.replace(/[^0-9]/g, '');
          setFormData(prev => ({ ...prev, [field]: numeric }));
      } else {
          setFormData(prev => ({ ...prev, [field]: value }));
      }
  };

  const handleCoChange = (coName: string) => {
      setFormData(prev => ({ ...prev, coName }));
      setAutofillSource(null);

      if (!coName) return;

      // SMART DETECT: Find latest plan for this CO
      const history = dailyPlans
        .filter(p => p.coName === coName)
        // Sort by ID descending (Assuming ID contains timestamp as implemented: Date.now())
        .sort((a, b) => (b.id > a.id ? 1 : -1));

      if (history.length > 0) {
          const latest = history[0];
          setFormData(prev => ({
              ...prev,
              swCurrentNoa: latest.swCurrentNoa,
              swCurrentDisb: latest.swCurrentDisb,
              swNextNoa: latest.swNextNoa,
              swNextDisb: latest.swNextDisb,
              colCtxNoa: latest.colCtxNoa,
              colCtxOs: latest.colCtxOs,
              colLantakurNoa: latest.colLantakurNoa,
              colLantakurOs: latest.colLantakurOs,
              fppbNoa: latest.fppbNoa,
              biometrikNoa: latest.biometrikNoa
          }));
          setAutofillSource(latest.date);
      }
  };

  const handleSubmit = async () => {
      if (!formData.coName) {
          alert("Mohon pilih Nama CO terlebih dahulu.");
          setStep(1);
          return;
      }

      setIsSubmitting(true);
      try {
          const finalPlan: DailyPlan = {
              id: Date.now().toString(),
              date: formData.date || new Date().toLocaleDateString('id-ID'),
              coName: formData.coName,
              swCurrentNoa: formData.swCurrentNoa || '0',
              swCurrentDisb: formData.swCurrentDisb || '0',
              swNextNoa: formData.swNextNoa || '0',
              swNextDisb: formData.swNextDisb || '0',
              colCtxNoa: formData.colCtxNoa || '0',
              colCtxOs: formData.colCtxOs || '0',
              colLantakurNoa: formData.colLantakurNoa || '0',
              colLantakurOs: formData.colLantakurOs || '0',
              fppbNoa: formData.fppbNoa || '0',
              biometrikNoa: formData.biometrikNoa || '0'
          };
          
          await onSave(finalPlan);
          onClose();
          // Reset
          setStep(1);
          setFormData({ ...formData, coName: '' }); 
          setAutofillSource(null);
      } catch (e) {
          alert("Gagal menyimpan rencana.");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
                <h2 className="text-xl font-bold text-slate-800">Rencana Harian CO</h2>
                <p className="text-xs text-slate-500">Input target aktivitas harian Anda</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
            
            {/* Step 1: Identitas & SW */}
            {step === 1 && (
                <div className="space-y-5 animate-fade-in-up">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3">
                         <Calendar className="w-5 h-5 text-blue-600" />
                         <div className="flex-1">
                             <label className="text-[10px] uppercase font-bold text-blue-400 block">Tanggal Rencana</label>
                             <input 
                                type="text" 
                                value={formData.date} 
                                onChange={e => handleChange('date', e.target.value)}
                                className="bg-transparent font-bold text-blue-800 outline-none w-full"
                                placeholder="DD/MM/YYYY"
                             />
                         </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Nama Petugas (CO)</label>
                        <select 
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/50 outline-none"
                            value={formData.coName}
                            onChange={e => handleCoChange(e.target.value)}
                        >
                            <option value="">-- Pilih Nama Anda --</option>
                            {availableCos.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {autofillSource && (
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-600 font-bold bg-emerald-50 w-fit px-2 py-1 rounded-lg border border-emerald-100 animate-fade-in-up">
                                <Sparkles className="w-3 h-3" />
                                Data otomatis diisi dari history tgl {autofillSource}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <h3 className="font-bold text-slate-700">Target Survey (SW)</h3>
                        </div>
                        
                        {/* SW Bulan Ini */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <p className="text-[10px] font-bold text-slate-400 mb-1">SW Bln INI (NOA)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-slate-800 outline-none text-lg"
                                    placeholder="0"
                                    value={formData.swCurrentNoa}
                                    onChange={e => handleChange('swCurrentNoa', e.target.value)}
                                />
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <p className="text-[10px] font-bold text-slate-400 mb-1">SW Bln INI (Disb)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-slate-800 outline-none text-lg"
                                    placeholder="Rp 0"
                                    value={formData.swCurrentDisb}
                                    onChange={e => handleChange('swCurrentDisb', e.target.value)}
                                />
                            </div>
                        </div>

                         {/* SW Bulan Depan */}
                         <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <p className="text-[10px] font-bold text-slate-400 mb-1">SW Bln DEPAN (NOA)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-slate-800 outline-none text-lg"
                                    placeholder="0"
                                    value={formData.swNextNoa}
                                    onChange={e => handleChange('swNextNoa', e.target.value)}
                                />
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <p className="text-[10px] font-bold text-slate-400 mb-1">SW Bln DEPAN (Disb)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-slate-800 outline-none text-lg"
                                    placeholder="Rp 0"
                                    value={formData.swNextDisb}
                                    onChange={e => handleChange('swNextDisb', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Collection & Lainnya */}
            {step === 2 && (
                <div className="space-y-5 animate-fade-in-up">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <h3 className="font-bold text-slate-700">Target Collection</h3>
                        </div>
                        
                        {/* CTX */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                <p className="text-[10px] font-bold text-red-400 mb-1">CTX (NOA)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-red-800 outline-none text-lg"
                                    placeholder="0"
                                    value={formData.colCtxNoa}
                                    onChange={e => handleChange('colCtxNoa', e.target.value)}
                                />
                            </div>
                            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                <p className="text-[10px] font-bold text-red-400 mb-1">CTX (OS)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-red-800 outline-none text-lg"
                                    placeholder="Rp 0"
                                    value={formData.colCtxOs}
                                    onChange={e => handleChange('colCtxOs', e.target.value)}
                                />
                            </div>
                        </div>

                         {/* Lantakur */}
                         <div className="grid grid-cols-2 gap-3">
                            <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                                <p className="text-[10px] font-bold text-yellow-600 mb-1">Lantakur (NOA)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-yellow-800 outline-none text-lg"
                                    placeholder="0"
                                    value={formData.colLantakurNoa}
                                    onChange={e => handleChange('colLantakurNoa', e.target.value)}
                                />
                            </div>
                            <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                                <p className="text-[10px] font-bold text-yellow-600 mb-1">Lantakur (OS)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-yellow-800 outline-none text-lg"
                                    placeholder="Rp 0"
                                    value={formData.colLantakurOs}
                                    onChange={e => handleChange('colLantakurOs', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-purple-500" />
                            <h3 className="font-bold text-slate-700">Administrasi</h3>
                        </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                <p className="text-[10px] font-bold text-purple-500 mb-1">Input FPPB (NOA)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-purple-800 outline-none text-lg"
                                    placeholder="0"
                                    value={formData.fppbNoa}
                                    onChange={e => handleChange('fppbNoa', e.target.value)}
                                />
                            </div>
                            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                <p className="text-[10px] font-bold text-indigo-500 mb-1">Biometrik (NOA)</p>
                                <input 
                                    type="tel"
                                    className="w-full bg-transparent font-bold text-indigo-800 outline-none text-lg"
                                    placeholder="0"
                                    value={formData.biometrikNoa}
                                    onChange={e => handleChange('biometrikNoa', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            {step === 2 ? (
                <>
                     <Button variant="secondary" onClick={() => setStep(1)}>Kembali</Button>
                     <Button onClick={handleSubmit} isLoading={isSubmitting} icon={<Save className="w-4 h-4" />}>
                         Simpan Rencana
                     </Button>
                </>
            ) : (
                <>
                    <div></div>
                    <Button onClick={() => setStep(2)} icon={<ChevronRight className="w-4 h-4" />}>
                         Lanjut (Collection)
                     </Button>
                </>
            )}
        </div>

      </div>
    </div>
  );
};