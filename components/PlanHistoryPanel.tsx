
import React, { useState, useMemo } from 'react';
import { DailyPlan } from '../types';
import { ArrowLeft, Calendar, BarChart3, Search, ChevronLeft, ChevronRight, AlertCircle, FilterX } from 'lucide-react';

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

  // Helper to Normalize Date String (Remove leading zeros to compare safely)
  const normalizeForMatch = (d: string) => {
      if (!d) return '';
      return d.split('/').map(p => parseInt(p, 10)).join('/');
  };

  // --- CORE LOGIC CHANGE: STRICT DATA FROM PLAN SHEET ---
  // Hanya menampilkan data yang ada di variable 'plans'. Tidak melakukan Left Join dengan 'availableCos'.
  const tableData = useMemo(() => {
    const sDateNorm = normalizeForMatch(selectedDate);
    
    // 1. Get plans ONLY for the selected date
    const plansForDate = plans.filter(p => normalizeForMatch(p.date) === sDateNorm);

    // 2. Map directly from Plan Data
    const rows = plansForDate.map(p => ({
        coName: p.coName,
        plan: p,
        hasInput: true
    }));

    // 3. Filter by Search Term
    return rows.filter(r => 
        searchTerm === '' || r.coName.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.coName.localeCompare(b.coName));

  }, [plans, selectedDate, searchTerm]);


  // Totals Calculation for Footer
  const totals = useMemo(() => {
      const t = {
          swCurT: 0, swCurR: 0,
          swCurDisbT: 0, swCurDisbR: 0,
          swNextT: 0, swNextR: 0,
          swNextDisbT: 0, swNextDisbR: 0,
          ctxT: 0, ctxR: 0,
          parT: 0, parR: 0,
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
            t.parT += parseNum(p.colLantakurNoa); t.parR += parseNum(p.actualLantakurNoa);
            
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

  // --- ENHANCED METRIC CELL ---
  const MetricCell = ({ target, actual }: { target: string, actual?: string }) => {
      const t = parseNum(target);
      const a = parseNum(actual);
      
      const isTargetSet = t > 0;
      const isAchieved = isTargetSet && a >= t;
      const progress = isTargetSet ? Math.min((a / t) * 100, 100) : 0;
      
      // If no target and no actual, show dash
      if (!isTargetSet && a === 0) return <div className="text-center text-slate-300">-</div>;

      return (
          <div className="flex flex-col items-center justify-center h-full w-full py-1">
              <div className="flex items-baseline gap-1">
                  <span className={`font-bold text-xs ${isAchieved ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {a}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                      / {t}
                  </span>
              </div>
              
              {/* Progress Bar */}
              {isTargetSet ? (
                <div className="w-12 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden relative">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${isAchieved ? 'bg-emerald-500' : 'bg-orange-400'}`} 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
              ) : (
                /* Placeholder to keep height consistent */
                <div className="w-12 h-1.5 mt-1"></div>
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
                    <p className="text-xs text-slate-500">DFAR & DQAR</p>
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

        {/* Search */}
        <div className="mb-4 relative">
             <input 
                type="text" 
                placeholder="Cari Nama CO..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {/* TABLE WRAPPER */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)]">
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 shadow-sm">
                        <tr>
                            <th className="p-3 text-left sticky left-0 bg-slate-50 border-r border-slate-200 w-[140px] z-20">Petugas (CO)</th>
                            <th className="p-2 text-center border-r border-slate-100 bg-orange-50/30">SW M-0(NOA)</th>
                            <th className="p-2 text-center border-r border-slate-100 bg-orange-50/30">SW M-0 (Jt)</th>
                            <th className="p-2 text-center border-r border-slate-100">SW M+1 (NOA)</th>
                            <th className="p-2 text-center border-r border-slate-200">SW M+1 (Jt)</th>
                            <th className="p-2 text-center border-r border-slate-100 bg-red-50/30 text-red-600">CTX (Bayar)</th>
                            <th className="p-2 text-center border-r border-slate-200 bg-amber-50/30 text-amber-600">Lantakur</th>
                            <th className="p-2 text-center border-r border-slate-100 bg-purple-50/30 text-purple-600">FPPB</th>
                            <th className="p-2 text-center bg-indigo-50/30 text-indigo-600">Biometrik</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tableData.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-300">
                                        <FilterX className="w-10 h-10 mb-2" />
                                        <p className="text-sm font-bold text-slate-400">Tidak ada data Rencana.</p>
                                        <p className="text-xs">Belum ada input untuk tanggal {selectedDate}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            tableData.map((row, idx) => (
                                <tr key={row.coName} className="transition-colors group hover:bg-orange-50/30">
                                    
                                    {/* COLUMN 1: NAME & STATUS */}
                                    <td className="p-3 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-orange-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="truncate max-w-[100px]" title={row.coName}>{row.coName}</div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="border-r border-slate-100 bg-orange-50/10">
                                        <MetricCell target={row.plan?.swCurrentNoa || '0'} actual={row.plan?.actualSwNoa} />
                                    </td>
                                    <td className="border-r border-slate-100 bg-orange-50/10">
                                        <MetricCell target={row.plan?.swCurrentDisb || '0'} actual={row.plan?.actualSwDisb} />
                                    </td>

                                    <td className="border-r border-slate-100">
                                        <MetricCell target={row.plan?.swNextNoa || '0'} actual={row.plan?.actualSwNextNoa} />
                                    </td>
                                    <td className="border-r border-slate-200">
                                        <MetricCell target={row.plan?.swNextDisb || '0'} actual={row.plan?.actualSwNextDisb} />
                                    </td>

                                    <td className="border-r border-slate-100 bg-red-50/10">
                                        <MetricCell target={row.plan?.colCtxNoa || '0'} actual={row.plan?.actualCtxNoa} />
                                    </td>
                                    <td className="border-r border-slate-200 bg-amber-50/10">
                                        <MetricCell target={row.plan?.colLantakurNoa || '0'} actual={row.plan?.actualLantakurNoa} />
                                    </td>

                                    <td className="border-r border-slate-100 bg-purple-50/10">
                                        <MetricCell target={row.plan?.fppbNoa || '0'} actual={row.plan?.actualFppbNoa} />
                                    </td>
                                    <td className="bg-indigo-50/10">
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
                <div className="bg-slate-50 border-t border-slate-200 p-2 overflow-x-auto">
                    <table className="w-full text-xs min-w-[900px]">
                        <tfoot>
                            <tr>
                                <td className="font-bold text-slate-700 w-[140px] p-2 pl-3">TOTAL TIM</td>
                                
                                <td className="p-2 text-center font-bold text-orange-600 w-[10%]">
                                    {totals.swCurR}/{totals.swCurT}
                                </td>
                                <td className="p-2 text-center font-bold text-orange-600 w-[10%]">
                                    {totals.swCurDisbR}/{totals.swCurDisbT}
                                </td>
                                
                                <td className="p-2 text-center font-bold text-slate-600 w-[10%]">
                                    {totals.swNextR}/{totals.swNextT}
                                </td>
                                <td className="p-2 text-center font-bold text-slate-600 w-[10%]">
                                    {totals.swNextDisbR}/{totals.swNextDisbT}
                                </td>
                                
                                <td className="p-2 text-center font-bold text-red-600 w-[10%]">
                                    {totals.ctxR}/{totals.ctxT}
                                </td>
                                <td className="p-2 text-center font-bold text-amber-600 w-[10%]">
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
