import React, { useState, useMemo, useEffect } from 'react';
import { DailyPlan } from '../types';
import { ArrowLeft, Calendar, Briefcase, Filter, ChevronDown, TrendingUp, AlertTriangle, BarChart3, Info, FileText } from 'lucide-react';
import { Button } from './Button';

interface PlanHistoryPanelProps {
  plans: DailyPlan[];
  onBack: () => void;
  availableCos: string[];
}

// Optimized Helper: Defined outside to prevent re-creation on every render
const ProgressBar = React.memo(({ target, actual, colorClass }: { target: string, actual?: string, colorClass: string }) => {
    // Robust parsing
    const parse = (val?: string) => {
        if (!val) return 0;
        const clean = val.replace(/[^0-9]/g, '');
        return clean ? parseInt(clean, 10) : 0;
    };
    
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
});

export const PlanHistoryPanel: React.FC<PlanHistoryPanelProps> = ({ 
  plans, 
  onBack, 
  availableCos
}) => {
  const [filterCo, setFilterCo] = useState('All');
  const [visibleDaysCount, setVisibleDaysCount] = useState(5); // Show 5 days initially

  // Reset pagination when filter changes
  useEffect(() => {
    setVisibleDaysCount(5);
  }, [filterCo]);

  // Group Plans by Date
  const groupedPlans = useMemo(() => {
    let filtered = plans;
    if (filterCo !== 'All') {
        filtered = plans.filter(p => p.coName === filterCo);
    }
    
    const groups: Record<string, DailyPlan[]> = {};
    filtered.forEach(p => {
        // Assume p.date is DD/MM/YYYY
        if (!groups[p.date]) groups[p.date] = [];
        groups[p.date].push(p);
    });

    // Helper to parse date for sorting
    const parseDate = (dStr: string) => {
        if (!dStr) return 0;
        const parts = dStr.split('/');
        if (parts.length !== 3) return 0;
        const [d, m, y] = parts.map(Number);
        return new Date(y, m - 1, d).getTime();
    };

    return Object.entries(groups)
        .map(([date, items]) => ({
            date,
            items: items.sort((a, b) => a.coName.localeCompare(b.coName)), // Sort CO alphabetically inside day
            timestamp: parseDate(date)
        }))
        .sort((a, b) => b.timestamp - a.timestamp); // Sort days descending
  }, [plans, filterCo]);

  // Pagination by DAY, not by item
  const displayedGroups = useMemo(() => {
      return groupedPlans.slice(0, visibleDaysCount);
  }, [groupedPlans, visibleDaysCount]);

  const handleLoadMore = () => {
      setVisibleDaysCount(prev => prev + 5);
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
                Data dikelompokkan per Tanggal. Data ganda (duplikat) di Sheet sudah otomatis dihapus.
            </div>
        </div>

        {/* List (Grouped by Date) */}
        <div className="space-y-8">
            {displayedGroups.length === 0 ? (
                 <div className="text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-2xl">
                    Belum ada riwayat rencana.
                </div>
            ) : (
                displayedGroups.map(group => (
                    <div key={group.date} className="animate-fade-in-up">
                        {/* Date Header */}
                        <div className="flex items-center gap-3 mb-4 sticky top-[80px] z-30 bg-slate-50/90 backdrop-blur p-2 rounded-xl border border-slate-200 w-fit">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-bold border border-orange-200">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <h3 className="font-bold text-slate-700 text-sm">{group.date}</h3>
                            <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-slate-200 font-bold text-slate-400">
                                {group.items.length} CO
                            </span>
                        </div>

                        {/* Cards Grid for this Date */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {group.items.map(plan => (
                                <div key={plan.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                                    
                                    {/* Card Header (CO Name) */}
                                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200 text-xs">
                                                {plan.coName.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-sm">{plan.coName}</h3>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-4">
                                        {/* Survey Section */}
                                        <div className="space-y-3 mb-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Survey (SW)</h4>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* SW Bulan Ini */}
                                                <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                                                    <p className="text-[9px] font-bold text-emerald-600 mb-2 uppercase">Bulan Ini</p>
                                                    <div className="space-y-2">
                                                        <ProgressBar target={plan.swCurrentNoa} actual={plan.actualSwNoa} colorClass="bg-emerald-500" />
                                                        <div className="flex justify-between text-[10px] pt-1 border-t border-emerald-200/50">
                                                            <span className="text-slate-500">Disb T: {plan.swCurrentDisb}</span>
                                                            <span className="font-bold text-slate-700">R: {plan.actualSwDisb || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* SW Bulan Depan */}
                                                <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                                    <p className="text-[9px] font-bold text-blue-600 mb-2 uppercase">Bulan Depan</p>
                                                    <div className="space-y-2">
                                                        <ProgressBar target={plan.swNextNoa} actual={plan.actualSwNextNoa} colorClass="bg-blue-500" />
                                                        <div className="flex justify-between text-[10px] pt-1 border-t border-blue-200/50">
                                                            <span className="text-slate-500">Disb T: {plan.swNextDisb}</span>
                                                            <span className="font-bold text-slate-700">R: {plan.actualSwNextDisb || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Collection & Admin Section */}
                                        <div className="flex flex-col gap-3">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Collection</h4>
                                                </div>

                                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">CTX (Bayar)</p>
                                                    <ProgressBar 
                                                        target={plan.colCtxNoa} 
                                                        actual={plan.actualCtxNoa} 
                                                        colorClass="bg-red-500" 
                                                    />
                                                </div>

                                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">Lantakur (Nabung)</p>
                                                    <ProgressBar 
                                                        target={plan.colLantakurNoa} 
                                                        actual={plan.actualLantakurNoa} 
                                                        colorClass="bg-amber-500" 
                                                    />
                                                </div>
                                            </div>

                                            {/* Administrasi Section */}
                                            <div className="space-y-2 border-t border-slate-100 pt-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <FileText className="w-3.5 h-3.5 text-purple-500" />
                                                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Admin</h4>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                        <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">FPPB</p>
                                                        <ProgressBar target={plan.fppbNoa} actual={plan.actualFppbNoa} colorClass="bg-purple-500" />
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                        <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">Biometrik</p>
                                                        <ProgressBar target={plan.biometrikNoa} actual={plan.actualBiometrikNoa} colorClass="bg-indigo-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {visibleDaysCount < groupedPlans.length && (
                <div className="pt-4 flex justify-center">
                    <Button variant="secondary" onClick={handleLoadMore} icon={<ChevronDown className="w-4 h-4"/>}>
                        Tampilkan Lebih Banyak ({groupedPlans.length - visibleDaysCount} Hari)
                    </Button>
                </div>
            )}
        </div>
    </div>
  );
};
