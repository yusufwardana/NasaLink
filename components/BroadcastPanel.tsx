import React, { useMemo } from 'react';
import { Contact } from '../types';
import { ArrowLeft, TrendingUp, Users, Wallet, PieChart, MapPin, CheckCircle2, XCircle } from 'lucide-react';

interface DashboardPanelProps {
  contacts: Contact[];
  onBack: () => void;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ contacts, onBack }) => {
  
  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    // Total Nasabah (All)
    const totalNasabah = contacts.length;
    const uniqueSentra = new Set(contacts.map(c => c.sentra)).size;
    
    // Parse Plafon
    const totalPlafon = contacts.reduce((sum, c) => {
        const clean = (c.plafon || '0').replace(/[^0-9]/g, '');
        return sum + parseInt(clean || '0', 10);
    }, 0);

    // --- LOGIKA STATUS PORTOFOLIO ---
    
    // 1. Nasabah Lancar
    // Kriteria: Status mengandung 'lancar' ATAU Flag 'active' (tapi tidak macet/tutup)
    const active = contacts.filter(c => {
        const status = (c.status || '').toLowerCase();
        const flag = (c.flag || '').toLowerCase();
        
        // Exclude DO from active calculation just in case
        if (flag.includes('do')) return false;

        return status.includes('lancar') || (flag.includes('active') && !status.includes('macet') && !status.includes('tutup'));
    }).length;
    
    // 2. Nasabah Menunggak / Bermasalah (EXCLUDE DO)
    // Kriteria: Status mengandung 'macet' atau 'menunggak'
    // REVISI: Flag DO TIDAK masuk hitungan portfolio bermasalah (dianggap sudah lepas/write-off)
    const trouble = contacts.filter(c => {
        const status = (c.status || '').toLowerCase();
        const flag = (c.flag || '').toLowerCase();
        
        if (flag.includes('do')) return false; // Skip DO

        return status.includes('macet') || status.includes('menunggak');
    }).length;

    // Refinancing Opportunity (Jatuh Tempo This Month & Next Month)
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    const opportunity = contacts.filter(c => {
        if (!c.tglJatuhTempo) return false;
        // Simple regex split for dd/mm/yyyy or dd-mm-yyyy
        const parts = c.tglJatuhTempo.split(/[-/]/);
        if (parts.length !== 3) return false;
        
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        
        return (m === today.getMonth() && y === today.getFullYear()) || 
               (m === nextMonth.getMonth() && y === nextMonth.getFullYear());
    }).length;

    // Sentra Leaderboard
    const sentraMap: Record<string, number> = {};
    contacts.forEach(c => {
        const s = c.sentra || 'Unknown';
        sentraMap[s] = (sentraMap[s] || 0) + 1;
    });
    const topSentras = Object.entries(sentraMap)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    return { totalNasabah, uniqueSentra, totalPlafon, active, trouble, opportunity, topSentras };
  }, [contacts]);

  // Format Currency
  const formatIDR = (num: number) => {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  // Calculate percentages based on (Active + Trouble) pool, ignoring DO/Others
  const portfolioTotal = stats.active + stats.trouble;
  const activePercent = portfolioTotal > 0 ? (stats.active / portfolioTotal) * 100 : 0;
  const troublePercent = portfolioTotal > 0 ? (stats.trouble / portfolioTotal) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 animate-fade-in-up">
      
      {/* Header - Fixed */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-4 mb-6 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex items-center gap-4">
        <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all"
        >
            <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Dashboard Kinerja
                <TrendingUp className="w-5 h-5 text-orange-600" />
            </h2>
            <p className="text-sm text-slate-500">Analisis Portofolio & Peluang</p>
        </div>
      </div>

      {/* 1. Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-4 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
              <div className="absolute right-0 top-0 p-3 opacity-20"><Users className="w-12 h-12" /></div>
              <p className="text-xs font-bold text-orange-100 uppercase tracking-wider mb-1">Total Nasabah</p>
              <h3 className="text-3xl font-black">{stats.totalNasabah}</h3>
              <p className="text-xs text-orange-100 mt-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {stats.uniqueSentra} Sentra
              </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 p-3 opacity-5"><Wallet className="w-12 h-12 text-slate-800" /></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Estimasi Outstanding</p>
              <h3 className="text-lg font-bold text-slate-800 break-all leading-tight">
                  {formatIDR(stats.totalPlafon)}
              </h3>
              <p className="text-[10px] text-slate-400 mt-2">
                  *Berdasarkan total plafon
              </p>
          </div>
      </div>

      {/* 2. Health & Opportunity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          
          {/* Health Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-blue-500" /> Kesehatan Portofolio
              </h4>
              <p className="text-xs text-slate-400 mb-3 -mt-2">
                  (Mengabaikan status DO / Drop Out)
              </p>
              
              <div className="space-y-4">
                  <div>
                      <div className="flex justify-between text-xs mb-1">
                          <span className="font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Nasabah Lancar</span>
                          <span className="font-bold text-slate-600">{stats.active} ({Math.round(activePercent)}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${activePercent}%` }}></div>
                      </div>
                  </div>

                  <div>
                      <div className="flex justify-between text-xs mb-1">
                          <span className="font-bold text-red-700 flex items-center gap-1"><XCircle className="w-3 h-3"/> Menunggak / Macet</span>
                          <span className="font-bold text-slate-600">{stats.trouble} ({Math.round(troublePercent)}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-red-500 h-2.5 rounded-full" style={{ width: `${troublePercent}%` }}></div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Opportunity Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
              <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" /> Peluang Bisnis
              </h4>
              <p className="text-xs text-emerald-600 mb-4">
                  Nasabah yang akan jatuh tempo (lunas) bulan ini & depan.
              </p>
              
              <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-emerald-600">{stats.opportunity}</span>
                  <span className="text-sm font-bold text-emerald-700 mb-1">Prospek Cair</span>
              </div>
              <p className="text-xs text-emerald-500 mt-2">
                  Segera tawarkan penambahan modal usaha!
              </p>
          </div>
      </div>

      {/* 3. Top Sentra */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" /> Sentra Terbesar
          </h4>
          <div className="space-y-3">
              {stats.topSentras.map(([name, count], idx) => (
                  <div key={name} className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                              idx === 1 ? 'bg-gray-100 text-gray-700' : 
                              idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'
                          }`}>
                              {idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-slate-700">{name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                          {count} Anggota
                      </span>
                  </div>
              ))}
          </div>
      </div>

    </div>
  );
};