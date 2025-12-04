import React, { useMemo, useState } from 'react';
import { Contact } from '../types';
import { ArrowLeft, TrendingUp, Users, Wallet, PieChart, MapPin, CheckCircle2, XCircle, UserMinus, LayoutList, Award, AlertOctagon, ArrowUpRight, Ban } from 'lucide-react';

interface DashboardPanelProps {
  contacts: Contact[];
  onBack: () => void;
}

// --- HELPER COMPONENTS ---

// 1. Simple SVG Donut Chart
const DonutChart = ({ 
  data, 
  size = 120 
}: { 
  data: { label: string; value: number; color: string }[]; 
  size?: number 
}) => {
  const total = data.reduce((acc, cur) => acc + cur.value, 0);
  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  if (total === 0) return (
      <div className="flex items-center justify-center text-xs text-slate-400 font-medium h-full w-full bg-slate-50 rounded-full border border-slate-100">
          No Data
      </div>
  );

  return (
    <div className="relative flex items-center justify-center">
        <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} width={size} height={size}>
        {data.map((slice, i) => {
            const start = cumulativePercent;
            const slicePercent = slice.value / total;
            cumulativePercent += slicePercent;
            const end = cumulativePercent;

            // Handle full circle case
            if (slicePercent === 1) {
            return (
                <circle key={i} r="1" fill="none" stroke={slice.color} strokeWidth="0.4" />
            );
            }

            const [startX, startY] = getCoordinatesForPercent(start);
            const [endX, endY] = getCoordinatesForPercent(end);
            const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

            const pathData = [
            `M ${startX} ${startY}`,
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
            ];

            return (
            <path
                key={i}
                d={pathData.join(' ')}
                fill="none"
                stroke={slice.color}
                strokeWidth="0.4" // Thickness
                className="transition-all duration-500 ease-out"
            />
            );
        })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-slate-700">{total}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">TOTAL</span>
        </div>
    </div>
  );
};

// 2. Stat Card
const StatCard = ({ title, value, subtext, icon: Icon, colorClass, delay }: any) => (
    <div className={`bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-500 animate-fade-in-up`} style={{ animationDelay: delay }}>
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-xl ${colorClass}`}>
                <Icon className="w-5 h-5" />
            </div>
            {subtext && <span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-lg">{subtext}</span>}
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{title}</p>
        <h3 className="text-2xl font-black text-slate-800">{value}</h3>
    </div>
);


export const DashboardPanel: React.FC<DashboardPanelProps> = ({ contacts, onBack }) => {
  const [viewMode, setViewMode] = useState<'summary' | 'co_list'>('summary');
  const [sortBy, setSortBy] = useState<'asset' | 'quality' | 'active'>('active');

  // --- HELPERS ---
  const isVacantOrInactive = (c: Contact) => {
      const flag = (c.flag || '').toLowerCase();
      return flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
  };

  const parseMoney = (val?: string) => {
      if (!val) return 0;
      return parseInt(val.replace(/[^0-9]/g, '') || '0', 10);
  };

  const formatShortIDR = (num: number) => {
      if (num >= 1000000000) return (num / 1000000000).toFixed(2) + ' M';
      if (num >= 1000000) return (num / 1000000).toFixed(1) + ' Jt';
      return (num / 1000).toFixed(0) + ' Rb';
  };

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    // 1. Segmentation
    const activeContacts = contacts.filter(c => !isVacantOrInactive(c));
    const vacantCount = contacts.length - activeContacts.length;

    // 2. Financials (OS)
    const totalOS = activeContacts.reduce((sum, c) => {
        const osVal = parseMoney(c.os);
        const plafonVal = parseMoney(c.plafon);
        return sum + (osVal > 0 ? osVal : plafonVal); // Use OS if avail, else Plafon
    }, 0);

    // 3. Health
    const troubleContacts = activeContacts.filter(c => {
        const status = (c.status || '').toLowerCase();
        const dpd = parseInt(c.dpd || '0', 10);
        return status.includes('macet') || status.includes('menunggak') || dpd > 0;
    });
    const troubleCount = troubleContacts.length;
    const activeCount = activeContacts.length; // "Lancar" roughly
    const healthyCount = activeCount - troubleCount;

    // 4. Opportunity
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Simple Opportunity Logic: Active Jatuh Tempo Soon OR Recent Winback
    const opportunityCount = contacts.filter(c => {
        // ... (Logic same as App.tsx simplified for speed)
        // For dashboard visualization, imply logic:
        if (!isVacantOrInactive(c)) return !!c.tglJatuhTempo; // Active & has Due Date = Potential Refinancing
        return !!c.tglLunas; // Inactive & has Lunas Date = Potential Winback
    }).length;

    // 5. Leaders
    const sentraMap: Record<string, number> = {};
    activeContacts.forEach(c => {
        const s = c.sentra || 'Unknown';
        sentraMap[s] = (sentraMap[s] || 0) + 1;
    });
    const topSentras = Object.entries(sentraMap)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    return { 
        totalNasabah: contacts.length,
        activeTotal: activeCount, 
        vacantTotal: vacantCount, 
        totalOS, 
        healthyCount, 
        troubleCount, 
        opportunityCount, 
        topSentras,
        activeContacts 
    };
  }, [contacts]);

  // --- CO STATS ---
  const coStats = useMemo(() => {
      const map: Record<string, any> = {};
      contacts.forEach(c => {
          const co = c.co || 'Unassigned';
          if (!map[co]) map[co] = { name: co, active: 0, os: 0, trouble: 0 };
          
          if (!isVacantOrInactive(c)) {
              map[co].active++;
              map[co].os += (parseMoney(c.os) || parseMoney(c.plafon));
              
              const status = (c.status || '').toLowerCase();
              const dpd = parseInt(c.dpd || '0', 10);
              if (status.includes('macet') || status.includes('menunggak') || dpd > 0) {
                  map[co].trouble++;
              }
          }
      });
      return Object.values(map).sort((a: any, b: any) => {
          if (sortBy === 'asset') return b.os - a.os;
          if (sortBy === 'quality') return (a.trouble/a.active || 0) - (b.trouble/b.active || 0);
          return b.active - a.active;
      });
  }, [contacts, sortBy]);


  const donutData = [
      { label: 'Aktif', value: stats.activeTotal, color: '#f97316' }, // Orange-500
      { label: 'Vacant', value: stats.vacantTotal, color: '#e2e8f0' }, // Slate-200
  ];

  const healthPercent = stats.activeTotal > 0 ? (stats.healthyCount / stats.activeTotal) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 animate-fade-in-up">
      
      {/* HEADER */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-4 mb-6 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all">
            <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Dashboard Kinerja
                <TrendingUp className="w-5 h-5 text-orange-600" />
            </h2>
            <p className="text-sm text-slate-500">Analisis Portofolio Real-time</p>
        </div>
      </div>

      {/* VIEW TOGGLE */}
      <div className="flex p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200 w-full max-w-sm mx-auto sm:mx-0">
          <button 
            onClick={() => setViewMode('summary')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'summary' ? 'bg-white text-orange-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <PieChart className="w-4 h-4" /> Ringkasan
          </button>
          <button 
            onClick={() => setViewMode('co_list')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'co_list' ? 'bg-white text-orange-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <LayoutList className="w-4 h-4" /> Performa CO
          </button>
      </div>

      {viewMode === 'summary' ? (
        <div className="space-y-6">
            
            {/* 1. HERO CARD: ASSETS */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl shadow-slate-900/20">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-orange-500 rounded-full blur-3xl opacity-20"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-slate-400 mb-2 font-bold text-xs uppercase tracking-widest">
                        <Wallet className="w-4 h-4 text-orange-500" /> Total Outstanding (Estimasi)
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-medium text-orange-500">Rp</span>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
                            {formatShortIDR(stats.totalOS).split(' ')[0]}
                            <span className="text-2xl sm:text-3xl text-slate-400 font-bold ml-1">
                                {formatShortIDR(stats.totalOS).split(' ')[1]}
                            </span>
                        </h1>
                    </div>
                    <p className="mt-4 text-xs text-slate-500 max-w-xs">
                        *Akumulasi nilai OS atau Plafon dari {stats.activeTotal} nasabah aktif yang terdaftar.
                    </p>
                </div>
            </div>

            {/* 2. MAIN METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* CARD: KOMPOSISI NASABAH (DONUT CHART) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-slate-700 mb-1">Status Nasabah</h4>
                        <p className="text-xs text-slate-400 mb-4">Aktif vs Vacant (Non-Aktif)</p>
                        
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                                <span className="text-sm font-bold text-slate-700">{stats.activeTotal}</span>
                                <span className="text-xs text-slate-400">Aktif</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-slate-200"></span>
                                <span className="text-sm font-bold text-slate-700">{stats.vacantTotal}</span>
                                <span className="text-xs text-slate-400">Vacant</span>
                            </div>
                        </div>
                    </div>
                    <div className="shrink-0">
                        <DonutChart data={donutData} size={110} />
                    </div>
                </div>

                {/* CARD: KESEHATAN (BAR CHART) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="font-bold text-slate-700">Kualitas Portofolio</h4>
                            <p className="text-xs text-slate-400">Rasio Lancar vs Bermasalah</p>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-xs font-bold ${healthPercent >= 95 ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {healthPercent.toFixed(1)}% Sehat
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Lancar Bar */}
                        <div>
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Lancar</span>
                                <span className="font-bold text-slate-700">{stats.healthyCount} org</span>
                            </div>
                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${(stats.healthyCount/stats.activeTotal)*100}%` }}></div>
                            </div>
                        </div>

                        {/* Macet Bar */}
                        <div>
                             <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-bold text-red-500 flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> Bermasalah (PAR)</span>
                                <span className="font-bold text-slate-700">{stats.troubleCount} org</span>
                            </div>
                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                <div className="bg-red-500 h-full rounded-full transition-all duration-1000" style={{ width: `${(stats.troubleCount/stats.activeTotal)*100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. OPPORTUNITY & TOP SENTRA GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* OPPORTUNITY CARD */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20 md:col-span-1 flex flex-col justify-between">
                    <div>
                         <div className="flex items-center gap-2 text-emerald-100 font-bold text-xs uppercase mb-2">
                             <TrendingUp className="w-4 h-4" /> Peluang Bisnis
                         </div>
                         <h3 className="text-3xl font-black">{stats.opportunityCount}</h3>
                         <p className="text-sm text-emerald-50 font-medium">Prospek Potensial</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                        <p className="text-[10px] text-emerald-100 leading-tight">
                            Gabungan nasabah Lancar Jatuh Tempo & Winback.
                        </p>
                    </div>
                </div>

                {/* TOP SENTRA LIST */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm md:col-span-2">
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-purple-500" /> Top 5 Sentra Terbesar
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {stats.topSentras.map(([name, count], idx) => (
                            <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                                        idx === 0 ? 'bg-yellow-400 text-yellow-900' : 
                                        idx === 1 ? 'bg-slate-300 text-slate-700' : 
                                        idx === 2 ? 'bg-orange-300 text-orange-900' : 'bg-white border border-slate-200 text-slate-400'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[100px]">{name}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-500">{count} Agt</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

        </div>
      ) : (
        /* CO LIST VIEW */
        <div className="animate-fade-in-up">
            {/* Sort Controls */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
                <button 
                onClick={() => setSortBy('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all flex items-center gap-1 ${sortBy === 'active' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                    <Users className="w-3.5 h-3.5" /> Nasabah Terbanyak
                </button>
                <button 
                onClick={() => setSortBy('asset')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all flex items-center gap-1 ${sortBy === 'asset' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                    <Wallet className="w-3.5 h-3.5" /> Aset Tertinggi
                </button>
                <button 
                onClick={() => setSortBy('quality')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all flex items-center gap-1 ${sortBy === 'quality' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                    <Award className="w-3.5 h-3.5" /> Kualitas Terbaik
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coStats.map((co: any, idx: number) => {
                    const total = co.active;
                    const troubleRate = total > 0 ? (co.trouble / total) * 100 : 0;
                    const healthRate = 100 - troubleRate;
                    
                    return (
                        <div key={co.name} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                             <div className="absolute top-0 right-0 bg-slate-100 text-slate-400 px-3 py-1 rounded-bl-xl text-[10px] font-bold z-10">
                                #{idx + 1}
                            </div>
                            
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 border border-slate-300 shadow-inner">
                                    {co.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{co.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-medium">Community Officer</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                                    <p className="text-[9px] text-blue-400 font-bold uppercase mb-0.5">OS Kelolaan</p>
                                    <p className="text-xs font-bold text-blue-700">{formatShortIDR(co.os)}</p>
                                </div>
                                <div className="p-2 bg-orange-50/50 rounded-lg border border-orange-100">
                                    <p className="text-[9px] text-orange-400 font-bold uppercase mb-0.5">Nasabah</p>
                                    <p className="text-xs font-bold text-orange-700">{co.active} Org</p>
                                </div>
                            </div>

                            {/* Mini Health Bar */}
                            <div className="relative pt-1">
                                <div className="flex justify-between items-center text-[9px] font-bold mb-1">
                                    <span className={healthRate === 100 ? 'text-emerald-600' : 'text-slate-500'}>
                                        {healthRate === 100 ? 'Perfect Score' : `${healthRate.toFixed(0)}% Sehat`}
                                    </span>
                                    {co.trouble > 0 && <span className="text-red-500">{co.trouble} PAR</span>}
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                     <div className={`h-full rounded-full ${healthRate === 100 ? 'bg-emerald-500' : 'bg-yellow-400'}`} style={{ width: `${healthRate}%` }}></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}
    </div>
  );
};