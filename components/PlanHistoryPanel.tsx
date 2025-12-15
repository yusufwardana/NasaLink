
import React, { useState, useMemo } from 'react';
import { DailyPlan } from '../types';
import { ArrowLeft, Calendar, BarChart3, Search, ChevronLeft, ChevronRight, FilterX, TrendingUp, AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react';

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

  // Helper to format display (compact for table)
  const formatCompactNumber = (val: number, isCurrency: boolean) => {
      if (!isCurrency) return val; 
      // If Currency, convert to Millions (Jt)
      if (val >= 1000000) return (val / 1000000).toFixed(1) + 'jt';
      if (val > 0) return (val / 1000000).toFixed(2) + 'jt';
      return '0';
  };

  const normalizeForMatch = (d: string) => {
      if (!d) return '';
      return d.split('/').map(p => parseInt(p, 10)).join('/');
  };

  // --- CORE LOGIC: DATA PREPARATION ---
  const tableData = useMemo(() => {
    const sDateNorm = normalizeForMatch(selectedDate);
    const plansForDate = plans.filter(p => normalizeForMatch(p.date) === sDateNorm);

    const rows = plansForDate.map(p => ({
        coName: p.coName,
        plan: p,
        hasInput: true
    }));

    return rows.filter(r => 
        searchTerm === '' || r.coName.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.coName.localeCompare(b.coName));

  }, [plans, selectedDate, searchTerm]);


  // Totals Calculation for Footer & Header Scoreboard
  const totals = useMemo(() => {
      const t = {
          swCurT: 0, swCurR: 0,
          swCurDisbT: 0, swCurDisbR: 0,
          swNextT: 0, swNextR: 0,
          swNextDisbT: 0, swNextDisbR: 0,
          
          ctxT: 0, ctxR: 0, 
          ctxOsT: 0, ctxOsR: 0,
          
          parT: 0, parR: 0,
          parOsT: 0, parOsR: 0,
          
          fppbT: 0, fppbR: 0,
          bioT: 0, bioR: 0
      };

      tableData.forEach(row => {
          if (row.plan) {
            const p = row.plan;
            t.swCurT += parseNum(p.swCurrentNoa); t.swCurR += parseNum(p.actualSwNoa);
            t.swCurDisbT += parseNum(p.swCurrentDisb); t.swCurDisbR += parseNum(p.actualSwDisb);
            
            t.swNextT += parseNum(p.swNextNoa); t.swNextR += parseNum(p.actualSwNextNoa);
            t.swNextDisbT += parseNum(p.swNextDisb); t.swNextDisbR += parseNum(p.actualSwNextDisb);
            
            t.ctxT += parseNum(p.colCtxNoa); t.ctxR += parseNum(p.actualCtxNoa);
            t.ctxOsT += parseNum(p.colCtxOs); t.ctxOsR += parseNum(p.actualCtxOs);
            
            t.parT += parseNum(p.colLantakurNoa); t.parR += parseNum(p.actualLantakurNoa);
            t.parOsT += parseNum(p.colLantakurOs); t.parOsR += parseNum(p.actualLantakurOs);
            
            t.fppbT += parseNum(p.fppbNoa); t.fppbR += parseNum(p.actualFppbNoa);
            t.bioT += parseNum(p.biometrikNoa); t.bioR += parseNum(p.actualBiometrikNoa);
          }
      });
      return t;
  }, [tableData]);

  // Date Navigation
  const changeDate = (days: number) => {
      const parts = selectedDate.split('/');
      if (parts.length === 3) {
          const current = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          current.setDate(current.getDate() + days);
          setSelectedDate(getDateString(current));
      }
  };

  // --- ENHANCED COMPONENT: METRIC CELL ---
  const MetricCell = ({ target, actual, isCurrency = false, invertColor = false }: { target: string, actual?: string, isCurrency?: boolean, invertColor?: boolean }) => {
      const t = parseNum(target);
      const a = parseNum(actual);
      
      const isTargetSet = t > 0;
      // Progress calculation
      let percent = isTargetSet ? (a / t) * 100 : 0;
      if (percent > 100) percent = 100;

      // Color Logic (Traffic Light)
      // Normal: Higher is better (Sales). Invert: Lower is better (Cost/Loss) - but for Collection, usually Higher Collection is better, so normal logic applies unless tracking NPF amount rising.
      // Here we assume "Actual" means "Amount Collected" or "People Paid", so Higher is Better.
      
      let colorClass = 'bg-slate-200';
      let textClass = 'text-slate-500';
      
      if (isTargetSet) {
          if (percent >= 100) { colorClass = 'bg-emerald-500'; textClass = 'text-emerald-700'; }
          else if (percent >= 80) { colorClass = 'bg-yellow-400'; textClass = 'text-yellow-700'; }
          else { colorClass = 'bg-red-400'; textClass = 'text-red-600'; }
      } else if (a > 0) {
          // No target but has actual (Bonus?)
          colorClass = 'bg-blue-400'; textClass = 'text-blue-600';
      }

      if (!isTargetSet && a === 0) return <div className="text-center text-slate-300 py-2">-</div>;

      return (
          <div className="flex flex-col items-center justify-center h-full w-full py-1.5 px-1">
              <div className="flex items-baseline justify-between w-full mb-1">
                  <span className={`font-black text-[11px] ${textClass}`}>
                      {formatCompactNumber(a, isCurrency)}
                  </span>
                  {isTargetSet && (
                    <span className="text-[9px] text-slate-400 font-medium">
                        /{formatCompactNumber(t, isCurrency)}
                    </span>
                  )}
              </div>
              
              {/* Progress Bar & Percentage Pill */}
              {isTargetSet ? (
                <div className="w-full flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-100">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${colorClass}`} 
                            style={{ width: `${percent}%` }}
                        ></div>
                    </div>
                    <span className={`text-[8px] font-bold px-1 rounded ${percent >= 100 ? 'bg-emerald-100 text-emerald-700' : percent < 50 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                        {Math.round(percent)}%
                    </span>
                </div>
              ) : (
                 <div className="w-full h-1.5"></div>
              )}
          </div>
      );
  };

  // --- SCOREBOARD COMPONENT ---
  const ScoreCard = ({ label, target, actual, color, icon: Icon }: any) => {
      const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
      return (
          <div className={`p-3 rounded-xl border ${color} bg-white shadow-sm flex-1 min-w-[120px]`}>
              <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                  <Icon className="w-4 h-4 text-slate-400 opacity-50" />
              </div>
              <div className="flex items-end gap-1">
                  <span className="text-xl font-black text-slate-700">{pct}%</span>
                  <span className="text-[10px] text-slate-400 mb-1">Achieved</span>
              </div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
              </div>
              <div className="mt-1 text-[9px] text-slate-400 text-right">
                  {formatCompactNumber(actual, label.includes('Rp'))} / {formatCompactNumber(target, label.includes('Rp'))}
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-7xl mx-auto px-2 pb-24 animate-fade-in-up">
        {/* Header Navigation */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm px-4 py-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 -mx-2">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        Monitoring Realisasi
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                    </h2>
                    <p className="text-xs text-slate-500">Papan Skor Harian Tim</p>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto shadow-inner">
                <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500"><ChevronLeft className="w-4 h-4"/></button>
                <div className="flex-1 text-center px-4 font-bold text-slate-700 flex items-center justify-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    {selectedDate === todayStr ? 'Hari Ini' : selectedDate}
                </div>
                <button onClick={() => changeDate(1)} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500"><ChevronRight className="w-4 h-4"/></button>
            </div>
        </div>

        {/* SCOREBOARD (HERO) */}
        {tableData.length > 0 && (
            <div className="mb-6 overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex gap-3 min-w-max px-1">
                    <ScoreCard label="SW M-0 (NOA)" target={totals.swCurT} actual={totals.swCurR} color="border-orange-200" icon={TrendingUp} />
                    <ScoreCard label="SW M-0 (Rp)" target={totals.swCurDisbT} actual={totals.swCurDisbR} color="border-orange-200" icon={DollarSign} />
                    
                    <div className="w-px bg-slate-200 mx-1"></div>
                    
                    <ScoreCard label="CTX (NOA)" target={totals.ctxT} actual={totals.ctxR} color="border-red-200" icon={AlertTriangle} />
                    <ScoreCard label="CTX (Rp)" target={totals.ctxOsT} actual={totals.ctxOsR} color="border-red-200" icon={DollarSign} />
                    
                    <div className="w-px bg-slate-200 mx-1"></div>

                    <ScoreCard label="FPPB" target={totals.fppbT} actual={totals.fppbR} color="border-purple-200" icon={CheckCircle2} />
                </div>
            </div>
        )}

        {/* Search */}
        <div className="mb-4 relative">
             <input 
                type="text" 
                placeholder="Cari Nama Petugas..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-shadow shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {/* TABLE WRAPPER */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden flex flex-col h-[calc(100vh-320px)] ring-1 ring-black/5">
            <div className="overflow-auto flex-1 custom-scrollbar relative">
                <table className="w-full text-xs min-w-[1200px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 shadow-sm sticky top-0 z-20">
                        <tr>
                            <th className="p-3 text-left sticky left-0 bg-slate-50 border-r border-slate-200 w-[150px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                Petugas (CO)
                            </th>
                            
                            {/* Group SW */}
                            <th className="p-2 text-center border-r border-orange-100 bg-orange-50/50 text-orange-700 min-w-[100px]">SW M-0 (NOA)</th>
                            <th className="p-2 text-center border-r border-orange-200 bg-orange-50/50 text-orange-700 min-w-[100px]">SW M-0 (Rp)</th>
                            <th className="p-2 text-center border-r border-slate-200 min-w-[90px]">SW M+1 (NOA)</th>
                            <th className="p-2 text-center border-r border-slate-300 min-w-[90px]">SW M+1 (Rp)</th>
                            
                            {/* Group CTX */}
                            <th className="p-2 text-center border-r border-red-100 bg-red-50/50 text-red-700 min-w-[100px]">CTX (NOA)</th>
                            <th className="p-2 text-center border-r border-red-200 bg-red-50/50 text-red-700 min-w-[100px]">CTX (Rp)</th>
                            
                            {/* Group Lantakur */}
                            <th className="p-2 text-center border-r border-amber-100 bg-amber-50/50 text-amber-700 min-w-[90px]">Lantakur (NOA)</th>
                            <th className="p-2 text-center border-r border-amber-200 bg-amber-50/50 text-amber-700 min-w-[90px]">Lantakur (Rp)</th>
                            
                            {/* Admin */}
                            <th className="p-2 text-center border-r border-purple-200 bg-purple-50/50 text-purple-700 min-w-[80px]">FPPB</th>
                            <th className="p-2 text-center bg-indigo-50/50 text-indigo-700 min-w-[80px]">Biometrik</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tableData.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-300">
                                        <FilterX className="w-12 h-12 mb-3 opacity-50" />
                                        <p className="text-base font-bold text-slate-400">Tidak ada data Rencana.</p>
                                        <p className="text-xs mt-1">Belum ada input untuk tanggal {selectedDate}. <br/>Silakan input di menu "Input Rencana".</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            tableData.map((row, idx) => (
                                <tr key={row.coName} className="transition-colors group hover:bg-blue-50/30 even:bg-slate-50/30">
                                    
                                    {/* NAME */}
                                    <td className="p-3 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-blue-50/30 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${idx < 3 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-slate-100 text-slate-500'}`}>
                                                {idx + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="truncate max-w-[110px]" title={row.coName}>{row.coName}</div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* SW M-0 */}
                                    <td className="border-r border-orange-100 bg-orange-50/10 group-hover:bg-orange-100/20">
                                        <MetricCell target={row.plan?.swCurrentNoa || '0'} actual={row.plan?.actualSwNoa} />
                                    </td>
                                    <td className="border-r border-orange-200 bg-orange-50/10 group-hover:bg-orange-100/20 border-r-2 border-r-slate-200/50">
                                        <MetricCell target={row.plan?.swCurrentDisb || '0'} actual={row.plan?.actualSwDisb} isCurrency />
                                    </td>

                                    {/* SW M+1 */}
                                    <td className="border-r border-slate-100">
                                        <MetricCell target={row.plan?.swNextNoa || '0'} actual={row.plan?.actualSwNextNoa} />
                                    </td>
                                    <td className="border-r border-slate-300 border-r-2">
                                        <MetricCell target={row.plan?.swNextDisb || '0'} actual={row.plan?.actualSwNextDisb} isCurrency />
                                    </td>

                                    {/* CTX */}
                                    <td className="border-r border-red-100 bg-red-50/10 group-hover:bg-red-100/20">
                                        <MetricCell target={row.plan?.colCtxNoa || '0'} actual={row.plan?.actualCtxNoa} />
                                    </td>
                                    <td className="border-r border-red-200 bg-red-50/10 group-hover:bg-red-100/20 border-r-2 border-r-slate-200/50">
                                        <MetricCell target={row.plan?.colCtxOs || '0'} actual={row.plan?.actualCtxOs} isCurrency />
                                    </td>

                                    {/* Lantakur */}
                                    <td className="border-r border-amber-100 bg-amber-50/10 group-hover:bg-amber-100/20">
                                        <MetricCell target={row.plan?.colLantakurNoa || '0'} actual={row.plan?.actualLantakurNoa} />
                                    </td>
                                    <td className="border-r border-amber-200 bg-amber-50/10 group-hover:bg-amber-100/20 border-r-2 border-r-slate-200/50">
                                        <MetricCell target={row.plan?.colLantakurOs || '0'} actual={row.plan?.actualLantakurOs} isCurrency />
                                    </td>

                                    {/* Admin */}
                                    <td className="border-r border-purple-100 bg-purple-50/10 group-hover:bg-purple-100/20">
                                        <MetricCell target={row.plan?.fppbNoa || '0'} actual={row.plan?.actualFppbNoa} />
                                    </td>
                                    <td className="bg-indigo-50/10 group-hover:bg-indigo-100/20">
                                        <MetricCell target={row.plan?.biometrikNoa || '0'} actual={row.plan?.actualBiometrikNoa} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Sticky Footer Totals */}
            {tableData.length > 0 && (
                <div className="bg-white border-t border-slate-200 p-0 overflow-x-auto z-30 shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
                    <table className="w-full text-xs min-w-[1200px]">
                        <tfoot>
                            <tr className="bg-slate-50">
                                <td className="font-bold text-slate-700 w-[150px] p-3 pl-3 sticky left-0 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] uppercase text-[10px]">Total Tim</td>
                                
                                {/* SW M-0 */}
                                <td className="p-2 text-center font-black text-orange-700 bg-orange-50 border-r border-orange-200">
                                    {totals.swCurR}/{totals.swCurT}
                                </td>
                                <td className="p-2 text-center font-black text-orange-700 bg-orange-50 border-r border-slate-300">
                                    {formatCompactNumber(totals.swCurDisbR, true)}/{formatCompactNumber(totals.swCurDisbT, true)}
                                </td>
                                
                                {/* SW M+1 */}
                                <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-200">
                                    {totals.swNextR}/{totals.swNextT}
                                </td>
                                <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-300">
                                    {formatCompactNumber(totals.swNextDisbR, true)}/{formatCompactNumber(totals.swNextDisbT, true)}
                                </td>
                                
                                {/* CTX */}
                                <td className="p-2 text-center font-black text-red-700 bg-red-50 border-r border-red-200">
                                    {totals.ctxR}/{totals.ctxT}
                                </td>
                                <td className="p-2 text-center font-black text-red-700 bg-red-50 border-r border-slate-300">
                                    {formatCompactNumber(totals.ctxOsR, true)}/{formatCompactNumber(totals.ctxOsT, true)}
                                </td>

                                {/* Lantakur */}
                                <td className="p-2 text-center font-bold text-amber-700 bg-amber-50 border-r border-amber-200">
                                    {totals.parR}/{totals.parT}
                                </td>
                                <td className="p-2 text-center font-bold text-amber-700 bg-amber-50 border-r border-slate-300">
                                    {formatCompactNumber(totals.parOsR, true)}/{formatCompactNumber(totals.parOsT, true)}
                                </td>
                                
                                {/* Admin */}
                                <td className="p-2 text-center font-bold text-purple-700 bg-purple-50 border-r border-purple-200">
                                    {totals.fppbR}/{totals.fppbT}
                                </td>
                                <td className="p-2 text-center font-bold text-indigo-700 bg-indigo-50">
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
