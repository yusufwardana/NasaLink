import React, { useState, useMemo } from 'react';
import { DailyPlan } from '../types';
import { ArrowLeft, Calendar, Briefcase, Filter, ChevronDown, TrendingUp, AlertTriangle, BarChart3, Info, FileText } from 'lucide-react';

interface PlanHistoryPanelProps {
  plans: DailyPlan[];
  onBack: () => void;
  availableCos: string[];
}

export const PlanHistoryPanel: React.FC<PlanHistoryPanelProps> = ({ 
  plans, 
  onBack, 
  availableCos
}) => {
  const [filterCo, setFilterCo] = useState('All');

  // Sort by Date Descending
  const sortedPlans = useMemo(() => {
    let filtered = plans;
    if (filterCo !== 'All') {
        filtered = plans.filter(p => p.coName === filterCo);
    }
    
    return [...filtered].sort((a, b) => {
        // Parse DD/MM/YYYY
        const parseDate = (dStr: string) => {
            const [d, m, y] = dStr.split('/').map(Number);
            return new Date(y, m - 1, d).getTime();
        };
        return parseDate(b.date) - parseDate(a.date);
    });
  }, [plans, filterCo]);

  // Helper for Percentage Bar (Robust parsing)
  const ProgressBar = ({ target, actual, colorClass }: { target: string, actual?: string, colorClass: string }) => {
      // Remove non-numeric chars except . or , if needed, but for now strict numeric
      const parse = (val?: string) => parseInt(val?.replace(/[^0-9]/g, '') || '0', 10);
      
      const t = parse(target);
      const a = parse(actual);
      
      if (t === 0) return <span className="text-xs text-slate-400">-</span>;
      
      const percent = Math.min((a / t) * 100, 100);
      
      return (
          <div className="w-full">
              <div className="flex justify-between text-[10px] mb-1 font-bold">
                  <span className="text-slate-500">Target: {t}</span>
                  <span className={a >= t ? 'text-green-600' : 'text-slate-700'}>Aktual: {a} ({Math.round((a/t)*100)}%)</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${percent}%` }}></div>
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 animate-fade-in-up">
        {/* Header */}
        <div className="sticky top-0 z-40 -mx-4 px-4 py-4 mb-6 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex items-center gap-4">
            <button 
                onClick={onBack}
                className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Riwayat Rencana
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                </h2>
                <p className="text-sm text-slate-500">Monitoring Target vs Realisasi Harian</p>
            </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Filter className="w-4 h-4" /> Filter Riwayat
            </div>
            <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select 
                    className="w-full pl-9 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none"
                    value={filterCo}
                    onChange={(e) => setFilterCo(e.target.value)}
                >
                    <option value="All">Semua Petugas (CO)</option>
                    {availableCos.map(co => (
                        <option key={co} value={co}>{co}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
            
            <div className="mt-3 flex gap-2 items-start p-2 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-700">
                <Info className="w-4 h-4 shrink-0" />
                Data aktual diambil otomatis dari sheet "Aktual". Jika data belum muncul, pastikan Admin sudah menginput data realisasi di Google Sheets.
            </div>
        </div>

        {/* List */}
        <div className="space-y-4">
            {sortedPlans.length === 0 ? (
                 <div className="text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-2xl">
                    Belum ada riwayat rencana.
                </div>
            ) : (
                sortedPlans.map(plan => {
                    return (
                        <div key={plan.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                            
                            {/* Card Header */}
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{plan.date}</h3>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <Briefcase className="w-3 h-3" /> {plan.coName}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Survey Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            <h4 className="font-bold text-slate-700 text-sm">Survey (SW)</h4>
                                        </div>
                                        
                                        {/* SW Bulan Ini */}
                                        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                                            <p className="text-[10px] font-bold text-emerald-600 mb-2 uppercase flex items-center gap-1">
                                                 <Calendar className="w-3 h-3"/> Bulan Ini
                                            </p>
                                            <div className="space-y-3">
                                                <div>
                                                     <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">NOA</p>
                                                     <ProgressBar target={plan.swCurrentNoa} actual={plan.actualSwNoa} colorClass="bg-emerald-500" />
                                                </div>
                                                <div>
                                                     <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">Pencairan</p>
                                                     <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">T: {plan.swCurrentDisb}</span>
                                                        <span className="font-bold text-slate-700">R: {plan.actualSwDisb || '-'}</span>
                                                     </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SW Bulan Depan */}
                                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                            <p className="text-[10px] font-bold text-blue-600 mb-2 uppercase flex items-center gap-1">
                                                 <Calendar className="w-3 h-3"/> Bulan Depan
                                            </p>
                                            <div className="space-y-3">
                                                 <div>
                                                     <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">NOA</p>
                                                     <ProgressBar target={plan.swNextNoa} actual={plan.actualSwNextNoa} colorClass="bg-blue-500" />
                                                </div>
                                                 <div>
                                                     <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">Pencairan</p>
                                                     <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">T: {plan.swNextDisb}</span>
                                                        <span className="font-bold text-slate-700">R: {plan.actualSwNextDisb || '-'}</span>
                                                     </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Collection & Admin Section */}
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                                <h4 className="font-bold text-slate-700 text-sm">Collection (Menunggak)</h4>
                                            </div>

                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">CTX (Nasabah Bayar)</p>
                                                <ProgressBar 
                                                    target={plan.colCtxNoa} 
                                                    actual={plan.actualCtxNoa} 
                                                    colorClass="bg-red-500" 
                                                />
                                            </div>

                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Lantakur (Menabung)</p>
                                                <ProgressBar 
                                                    target={plan.colLantakurNoa} 
                                                    actual={plan.actualLantakurNoa} 
                                                    colorClass="bg-amber-500" 
                                                />
                                            </div>
                                        </div>

                                        {/* Administrasi Section */}
                                        <div className="space-y-3 border-t border-slate-100 pt-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FileText className="w-4 h-4 text-purple-500" />
                                                <h4 className="font-bold text-slate-700 text-sm">Administrasi</h4>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Input FPPB</p>
                                                <ProgressBar 
                                                    target={plan.fppbNoa} 
                                                    actual={plan.actualFppbNoa} 
                                                    colorClass="bg-purple-500" 
                                                />
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Biometrik</p>
                                                <ProgressBar 
                                                    target={plan.biometrikNoa} 
                                                    actual={plan.actualBiometrikNoa} 
                                                    colorClass="bg-indigo-500" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    </div>
  );
};