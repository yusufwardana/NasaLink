import React, { useState, useMemo } from 'react';
import { DailyPlan } from '../types';
import { ArrowLeft, Calendar, BarChart3, Search, ChevronLeft, ChevronRight, TrendingUp, Target, Percent, Fingerprint } from 'lucide-react';

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
  // Helper to get date string in DD/MM/YYYY
  const getDateString = (date: Date) => {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
  };

  const todayStr = useMemo(() => getDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to parse numbers safely
  const parseNum = (val?: string) => {
      if (!val) return 0;
      return parseInt(val.replace(/[^0-9]/g, '') || '0', 10);
  };

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
        // Normalize date comparison (handle D/M/YYYY vs DD/MM/YYYY)
        const pDate = p.date.split('/').map(s => s.padStart(2, '0')).join('/');
        const sDate = selectedDate.split('/').map(s => s.padStart(2, '0')).join('/');
        
        const matchDate = pDate === sDate;
        const matchSearch = searchTerm === '' || p.coName.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchDate && matchSearch;
    }).sort((a, b) => a.coName.localeCompare(b.coName));
  }, [plans, selectedDate, searchTerm]);

  // Totals Calculation for Summary & Footer
  const totals = useMemo(() => {
      const t = {
          swCurT: 0, swCurR: 0,
          swNextT: 0, swNextR: 0,
          ctxT: 0, ctxR: 0,
          parT: 0, parR: 0,
          fppbT: 0, fppbR: 0,
          bioT: 0, bioR: 0 // Added Biometrik Totals
      };
      filteredPlans.forEach(p => {
          t.swCurT += parseNum(p.swCurrentNoa); t.swCurR += parseNum(p.actualSwNoa);
          t.swNextT += parseNum(p.swNextNoa); t.swNextR += parseNum(p.actualSwNextNoa);
          t.ctxT += parseNum(p.colCtxNoa); t.ctxR += parseNum(p.actualCtxNoa);
          t.parT += parseNum(p.colLantakurNoa); t.parR += parseNum(p.actualLantakurNoa);
          t.fppbT += parseNum(p.fppbNoa); t.fppbR += parseNum(p.actualFppbNoa);
          t.bioT += parseNum(p.biometrikNoa); t.bioR += parseNum(p.actualBiometrikNoa);
      });
      return t;
  }, [filteredPlans]);

  // Date Navigation
  const changeDate = (days: number) => {
      const parts = selectedDate.split('/');
      if (parts.length === 3) {
          const current = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          current.setDate(current.getDate() + days);
          setSelectedDate(getDateString(current));
      }
  };

  // --- SUB-COMPONENT: SUMMARY CARD ---
  const SummaryCard = ({ label, target, actual, colorClass, bgClass, icon: Icon }: any) => {
      const percent = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
      const isAchieved = target > 0 && actual >= target;
      
      return (
          <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex flex-col justify-between h-full relative overflow-hidden group">
              <div className={`absolute top-0 right-0 p-2 rounded-bl-2xl opacity-10 ${bgClass} group-hover:opacity-20 transition-opacity`}>
                  <Icon className={`w-8 h-8 ${colorClass}`} />
              </div>
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                  <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-black ${isAchieved ? 'text-emerald-600' : 'text-slate-800'}`}>{actual}</span>
                      <span className="text-xs text-slate-400 font-medium">/ {target}</span>
                  </div>
              </div>
              <div className="mt-3">
                  <div className="flex justify-between items-center text-[9px] font-bold mb-1">
                      <span className={isAchieved ? 'text-emerald-600' : 'text-slate-400'}>{percent.toFixed(0)}%</span>
                      {target > actual && <span className="text-red-400">-{target - actual}</span>}
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${isAchieved ? 'bg-emerald-500' : colorClass.replace('text-', 'bg-')}`} style={{ width: `${percent}%` }}></div>
                  </div>
              </div>
          </div>
      );
  };

  // Render Cell Helper with GAP Indicator
  const MetricCell = ({ target, actual, label, hideLabel = true }: { target: string, actual?: string, label: string, hideLabel?: boolean }) => {
      const t = parseNum(target);
      const a = parseNum(actual);
      const gap = a - t;
      const isAchieved = t > 0 && a >= t;
      const isZero = t === 0 && a === 0;

      if (isZero) return <div className="text-center text-slate-300">-</div>;

      return (
          <div className="flex flex-col items-center justify-center h-full w-full p-1 relative group">
              {!hideLabel && <span className="text-[9px] text-slate-400 mb-0.5 uppercase">{label}</span>}
              <div className="flex items-baseline gap-1 relative z-10">
                  <span className={`font-bold text-xs ${isAchieved ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {a}
                  </span>
                  <span className="text-[9px] text-slate-400">/ {t}</span>
              </div>
              
              {/* Gap Indicator (Show red deficit or green surplus) */}
              {t > 0 && gap !== 0 && (
                   <div className={`text-[8px] font-bold px-1 rounded-sm mt-0.5 ${gap < 0 ? 'text-red-500 bg-red-50' : 'text-emerald-500 bg-emerald-50'}`}>
                       {gap > 0 ? `+${gap}` : gap}
                   </div>
              )}

              {/* Progress Bar (Visible if no Gap text or as subtle background) */}
              {t > 0 && gap === 0 && (
                <div className="w-10 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${isAchieved ? 'bg-emerald-500' : 'bg-orange-400'}`} style={{ width: `${Math.min((a/t)*100, 100)}%` }}></div>
                </div>
              )}
          </div>
      );
  };

  return (
    <div className="max-w-6xl mx-auto px-2 pb-24 animate-fade-in-up">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm px-4 py-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 -mx-2">
            <div className="flex items-center gap-3">
                <button 
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        Monitoring Realisasi
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                    </h2>
                    <p className="text-xs text-slate-500">Tabel Kinerja Harian Petugas</p>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500"><ChevronLeft className="w-4 h-4"/></button>
                <div className="flex-1 text-center px-4 font-bold text-slate-700 flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    {selectedDate === todayStr ? 'Hari Ini' : selectedDate}
                </div>
                <button onClick={() => changeDate(1)} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500"><ChevronRight className="w-4 h-4"/></button>
            </div>
        </div>

        {/* SUMMARY SCOREBOARD */}
        {filteredPlans.length > 0 && (
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard 
                    label="SW Cur (NOA)" 
                    target={totals.swCurT} 
                    actual={totals.swCurR} 
                    colorClass="text-orange-500" 
                    bgClass="bg-orange-500" 
                    icon={Target} 
                />
                <SummaryCard 
                    label="SW Next (NOA)" 
                    target={totals.swNextT} 
                    actual={totals.swNextR} 
                    colorClass="text-blue-500" 
                    bgClass="bg-blue-500" 
                    icon={TrendingUp} 
                />
                <SummaryCard 
                    label="Col CTX (NOA)" 
                    target={totals.ctxT} 
                    actual={totals.ctxR} 
                    colorClass="text-red-500" 
                    bgClass="bg-red-500" 
                    icon={Percent} 
                />
                {/* Changed to Biometrik to prioritize */}
                <SummaryCard 
                    label="Biometrik" 
                    target={totals.bioT} 
                    actual={totals.bioR} 
                    colorClass="text-indigo-500" 
                    bgClass="bg-indigo-500" 
                    icon={Fingerprint} 
                />
            </div>
        )}

        {/* Search */}
        <div className="mb-4 relative">
             <input 
                type="text" 
                placeholder="Cari Nama CO..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {/* TABLE WRAPPER */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-340px)]">
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-xs min-w-[800px]">
                    <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 shadow-sm">
                        <tr>
                            <th className="p-3 text-left sticky left-0 bg-slate-50 border-r border-slate-200 w-[120px] z-20">Petugas (CO)</th>
                            <th className="p-2 text-center border-r border-slate-100 bg-orange-50/30">SW Cur (NOA)</th>
                            <th className="p-2 text-center border-r border-slate-100 bg-orange-50/30">SW Cur (Disb)</th>
                            <th className="p-2 text-center border-r border-slate-100">SW Next (NOA)</th>
                            <th className="p-2 text-center border-r border-slate-200">SW Next (Disb)</th>
                            <th className="p-2 text-center border-r border-slate-100 bg-red-50/30 text-red-600">CTX (Bayar)</th>
                            <th className="p-2 text-center border-r border-slate-200 bg-amber-50/30 text-amber-600">Lantakur</th>
                            <th className="p-2 text-center border-r border-slate-100 bg-purple-50/30 text-purple-600">FPPB</th>
                            <th className="p-2 text-center bg-indigo-50/30 text-indigo-600">Biometrik</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredPlans.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                                    Tidak ada data rencana/realisasi untuk tanggal {selectedDate}.
                                </td>
                            </tr>
                        ) : (
                            filteredPlans.map((plan, idx) => (
                                <tr key={plan.id} className="hover:bg-orange-50/30 transition-colors group">
                                    <td className="p-3 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-orange-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] text-slate-500">
                                                {idx + 1}
                                            </div>
                                            <span className="truncate max-w-[100px]" title={plan.coName}>{plan.coName}</span>
                                        </div>
                                    </td>
                                    
                                    {/* SW CURRENT */}
                                    <td className="border-r border-slate-100 bg-orange-50/10">
                                        <MetricCell target={plan.swCurrentNoa} actual={plan.actualSwNoa} label="NOA" />
                                    </td>
                                    <td className="border-r border-slate-100 bg-orange-50/10">
                                        <div className="text-center">
                                             <div className="text-[10px] text-slate-500">{plan.actualSwDisb || 0}</div>
                                             <div className="text-[9px] text-slate-400 border-t border-slate-100 mt-0.5 pt-0.5">{plan.swCurrentDisb || 0}</div>
                                        </div>
                                    </td>

                                    {/* SW NEXT */}
                                    <td className="border-r border-slate-100">
                                        <MetricCell target={plan.swNextNoa} actual={plan.actualSwNextNoa} label="NOA" />
                                    </td>
                                    <td className="border-r border-slate-200">
                                        <div className="text-center">
                                             <div className="text-[10px] text-slate-500">{plan.actualSwNextDisb || 0}</div>
                                             <div className="text-[9px] text-slate-400 border-t border-slate-100 mt-0.5 pt-0.5">{plan.swNextDisb || 0}</div>
                                        </div>
                                    </td>

                                    {/* COLLECTION */}
                                    <td className="border-r border-slate-100 bg-red-50/10">
                                        <MetricCell target={plan.colCtxNoa} actual={plan.actualCtxNoa} label="CTX" />
                                    </td>
                                    <td className="border-r border-slate-200 bg-amber-50/10">
                                        <MetricCell target={plan.colLantakurNoa} actual={plan.actualLantakurNoa} label="Lantakur" />
                                    </td>

                                    {/* ADMIN */}
                                    <td className="border-r border-slate-100 bg-purple-50/10">
                                        <MetricCell target={plan.fppbNoa} actual={plan.actualFppbNoa} label="FPPB" />
                                    </td>
                                    <td className="bg-indigo-50/10">
                                        <MetricCell target={plan.biometrikNoa} actual={plan.actualBiometrikNoa} label="BIO" />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Sticky Footer Totals */}
            {filteredPlans.length > 0 && (
                <div className="bg-slate-50 border-t border-slate-200 p-2 overflow-x-auto">
                    <table className="w-full text-xs min-w-[800px]">
                        <tfoot>
                            <tr>
                                <td className="font-bold text-slate-700 w-[120px] p-2">TOTAL</td>
                                <td className="p-2 text-center font-bold text-orange-600 w-[10%]">
                                    {totals.swCurR}/{totals.swCurT}
                                </td>
                                <td className="p-2 text-center text-slate-400 w-[10%]">-</td>
                                <td className="p-2 text-center font-bold text-slate-600 w-[10%]">
                                    {totals.swNextR}/{totals.swNextT}
                                </td>
                                <td className="p-2 text-center text-slate-400 w-[10%]">-</td>
                                <td className="p-2 text-center font-bold text-red-600 w-[12%]">
                                    {totals.ctxR}/{totals.ctxT}
                                </td>
                                <td className="p-2 text-center font-bold text-amber-600 w-[12%]">
                                    {totals.parR}/{totals.parT}
                                </td>
                                <td className="p-2 text-center font-bold text-purple-600 w-[10%]">
                                    {totals.fppbR}/{totals.fppbT}
                                </td>
                                <td className="p-2 text-center font-bold text-indigo-600 w-[10%]">
                                    {totals.bioR}/{totals.bioT}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
};
