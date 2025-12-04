import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
import { CalendarClock, MessageCircle, Banknote, Users, ArrowLeft, Filter, ChevronDown, MapPin, Briefcase, UserPlus, RefreshCcw, Sparkles, History, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface NotificationItem {
  contact: Contact;
  type: 'payment' | 'prs'; 
  status: 'today' | 'soon' | 'this_month' | 'next_month' | 'winback_recent' | 'winback_old' | 'collection';
  daysLeft: number;
}

interface NotificationPanelProps {
  items: NotificationItem[];
  onRemind: (contact: Contact, type: 'payment' | 'prs') => void;
  onBack: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  items, 
  onRemind,
  onBack
}) => {
  const [filterCo, setFilterCo] = useState<string>('All');
  const [filterSentra, setFilterSentra] = useState<string>('All');
  // Updated filter types: 'refinancing' (active) vs 'winback_recent' vs 'winback_old' vs 'prs' vs 'collection'
  const [filterType, setFilterType] = useState<string>('All'); 
  const [visibleCount, setVisibleCount] = useState(20);

  // Extract unique COs
  const uniqueCos = useMemo(() => {
    const cos = new Set(items.map(item => item.contact.co || 'Unassigned'));
    return Array.from(cos).sort();
  }, [items]);

  // Extract unique Sentras (based on filtered items or all items)
  const uniqueSentras = useMemo(() => {
      let sourceItems = items;
      if (filterCo !== 'All') {
          sourceItems = items.filter(item => (item.contact.co || 'Unassigned') === filterCo);
      }
      const sentras = new Set(sourceItems.map(item => item.contact.sentra || 'Unknown'));
      return Array.from(sentras).sort();
  }, [items, filterCo]);

  // Filter Logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
        const matchesCo = filterCo === 'All' || (item.contact.co || 'Unassigned') === filterCo;
        const matchesSentra = filterSentra === 'All' || (item.contact.sentra || 'Unknown') === filterSentra;
        
        // Complex Type Filtering
        let matchesType = true;
        if (filterType === 'refinancing') {
            // Active Customers Only (Not Winback and Not Collection)
            matchesType = item.type === 'payment' && !item.status.includes('winback') && item.status !== 'collection';
        } else if (filterType === 'winback_recent') {
            matchesType = item.status === 'winback_recent';
        } else if (filterType === 'winback_old') {
            matchesType = item.status === 'winback_old';
        } else if (filterType === 'collection') {
            matchesType = item.status === 'collection';
        } else if (filterType === 'prs') {
            matchesType = item.type === 'prs';
        }
        
        return matchesCo && matchesSentra && matchesType;
    });
  }, [items, filterCo, filterSentra, filterType]);

  // Pagination Logic
  const displayedItems = useMemo(() => {
      return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  const handleLoadMore = () => {
      setVisibleCount(prev => prev + 20);
  };

  // Status Label Helper
  const getStatusLabel = (status: string) => {
      switch(status) {
          case 'today': return 'HARI INI (H-0)';
          case 'soon': return 'BESOK (H-1)';
          case 'this_month': return 'BULAN INI';
          case 'next_month': return 'BULAN DEPAN';
          case 'winback_recent': return 'LUNAS < 3 BULAN';
          case 'winback_old': return 'LUNAS > 3 BULAN';
          case 'collection': return 'MENUNGGAK';
          default: return '';
      }
  };

  // Calculate Counts for Chips
  const countRefinancing = items.filter(i => i.type === 'payment' && !i.status.includes('winback') && i.status !== 'collection').length;
  const countWinbackRecent = items.filter(i => i.status === 'winback_recent').length;
  const countWinbackOld = items.filter(i => i.status === 'winback_old').length;
  const countCollection = items.filter(i => i.status === 'collection').length;
  const countPrs = items.filter(i => i.type === 'prs').length;

  // Full Page Layout
  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 animate-fade-in-up">
        
        {/* Page Header - Fixed */}
        <div className="sticky top-0 z-40 -mx-4 px-4 py-4 mb-6 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex items-center gap-4">
            <button 
                onClick={onBack}
                className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-orange-600 border border-slate-200 shadow-sm transition-all"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Follow Up Nasabah
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full border border-red-200">
                        {filteredItems.length}
                    </span>
                </h2>
                <p className="text-sm text-slate-500">Monitoring Jatuh Tempo & PRS</p>
            </div>
        </div>

        {/* Filters Section */}
        <div className="mb-6 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Filter className="w-4 h-4" /> Filter Follow Up
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Filter CO */}
                <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                        className="w-full pl-9 p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none"
                        value={filterCo}
                        onChange={(e) => {
                            setFilterCo(e.target.value);
                            setFilterSentra('All'); // Reset sentra when CO changes
                        }}
                    >
                        <option value="All">Semua Petugas (CO)</option>
                        {uniqueCos.map(co => (
                            <option key={co} value={co}>{co}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>

                {/* Filter Sentra */}
                <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                        className="w-full pl-9 p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none"
                        value={filterSentra}
                        onChange={(e) => setFilterSentra(e.target.value)}
                    >
                        <option value="All">Semua Sentra</option>
                        {uniqueSentras.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                     <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>

                {/* Filter Type */}
                <div className="relative">
                     <CalendarClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                        className="w-full pl-9 p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="All">Semua Tipe Agenda</option>
                        <option value="collection">Menunggak / Macet (Collection)</option>
                        <option value="refinancing">Jatuh Tempo (Nasabah Lancar)</option>
                        <option value="winback_recent">Winback Baru (&lt; 3 Bulan)</option>
                        <option value="winback_old">Winback Lama (&gt; 3 Bulan)</option>
                        <option value="prs">Kumpulan PRS (Besok)</option>
                    </select>
                     <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>
            </div>
        </div>

        {/* Filter Summary Chips */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
             {/* CHIP 0: Collection (Trouble) */}
            <button 
                onClick={() => setFilterType('collection')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm min-w-max transition-all border ${
                    filterType === 'collection' ? 'bg-red-100 border-red-300 ring-1 ring-red-300' : 'bg-red-50 border-red-100 hover:bg-red-100'
                }`}
            >
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <div className="flex flex-col items-start">
                    <span className="text-[10px] uppercase font-bold text-red-500">Menunggak</span>
                    <span className="text-lg font-bold text-red-700 leading-none">
                        {countCollection}
                    </span>
                </div>
            </button>

            {/* CHIP 1: Jatuh Tempo (Refinancing Active) */}
            <button 
                onClick={() => setFilterType('refinancing')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm min-w-max transition-all border ${
                    filterType === 'refinancing' ? 'bg-emerald-100 border-emerald-300 ring-1 ring-emerald-300' : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
                }`}
            >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col items-start">
                    <span className="text-[10px] uppercase font-bold text-emerald-500">Jatuh Tempo (Lancar)</span>
                    <span className="text-lg font-bold text-emerald-700 leading-none">
                        {countRefinancing}
                    </span>
                </div>
            </button>

             {/* CHIP 2: Winback Recent (< 3 Months) */}
             <button 
                onClick={() => setFilterType('winback_recent')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm min-w-max transition-all border ${
                    filterType === 'winback_recent' ? 'bg-pink-100 border-pink-300 ring-1 ring-pink-300' : 'bg-pink-50 border-pink-100 hover:bg-pink-100'
                }`}
            >
                <Sparkles className="w-4 h-4 text-pink-600" />
                <div className="flex flex-col items-start">
                    <span className="text-[10px] uppercase font-bold text-pink-500">Winback &lt; 3 Bln</span>
                    <span className="text-lg font-bold text-pink-700 leading-none">
                        {countWinbackRecent}
                    </span>
                </div>
            </button>

            {/* CHIP 3: Winback Old (> 3 Months) */}
            <button 
                onClick={() => setFilterType('winback_old')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm min-w-max transition-all border ${
                    filterType === 'winback_old' ? 'bg-purple-100 border-purple-300 ring-1 ring-purple-300' : 'bg-purple-50 border-purple-100 hover:bg-purple-100'
                }`}
            >
                <History className="w-4 h-4 text-purple-600" />
                <div className="flex flex-col items-start">
                    <span className="text-[10px] uppercase font-bold text-purple-500">Winback &gt; 3 Bln</span>
                    <span className="text-lg font-bold text-purple-700 leading-none">
                        {countWinbackOld}
                    </span>
                </div>
            </button>

            {/* CHIP 4: PRS */}
            <button 
                onClick={() => setFilterType('prs')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm min-w-max transition-all border ${
                     filterType === 'prs' ? 'bg-blue-100 border-blue-300 ring-1 ring-blue-300' : 'bg-blue-50 border-blue-100 hover:bg-blue-100'
                }`}
            >
                <Users className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col items-start">
                    <span className="text-[10px] uppercase font-bold text-blue-500">PRS Besok (H-1)</span>
                    <span className="text-lg font-bold text-blue-700 leading-none">
                        {countPrs}
                    </span>
                </div>
            </button>
        </div>

        {/* Main List */}
        <div className="space-y-3">
            {filteredItems.length === 0 ? (
                <div className="text-center py-20 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-20 h-20 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <CalendarClock className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-600">Tidak ada agenda ditemukan</h3>
                    <p className="text-slate-400 text-sm mt-1">
                        {items.length > 0 ? 'Coba ubah filter pencarian Anda.' : 'Semua jadwal aman. Cek kembali nanti.'}
                    </p>
                    {items.length === 0 && (
                         <div className="mt-6">
                            <Button variant="outline" onClick={onBack}>Kembali ke Beranda</Button>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {displayedItems.map(({ contact, type, status, daysLeft }, idx) => {
                        const isPayment = type === 'payment';
                        const isCollection = status === 'collection';
                        const isWinbackRecent = status === 'winback_recent';
                        const isWinbackOld = status === 'winback_old';
                        const isWinback = isWinbackRecent || isWinbackOld;
                        
                        // Card Styling
                        let borderColor = 'border-slate-100';
                        let bgColor = 'bg-white';
                        let shadowColor = 'shadow-slate-100';

                        if (isPayment) {
                            if (isCollection) {
                                borderColor = 'border-red-200';
                                bgColor = 'bg-gradient-to-br from-white to-red-50/50';
                                shadowColor = 'hover:shadow-red-100';
                            } else if (isWinbackRecent) {
                                borderColor = 'border-pink-200';
                                bgColor = 'bg-gradient-to-br from-white to-pink-50/50';
                                shadowColor = 'hover:shadow-pink-100';
                            } else if (isWinbackOld) {
                                borderColor = 'border-purple-200';
                                bgColor = 'bg-gradient-to-br from-white to-purple-50/50';
                                shadowColor = 'hover:shadow-purple-100';
                            } else {
                                borderColor = 'border-emerald-100';
                                bgColor = 'bg-gradient-to-br from-white to-emerald-50/30';
                                shadowColor = 'hover:shadow-emerald-100';
                            }
                        } else {
                            // PRS
                            borderColor = 'border-blue-100';
                            bgColor = 'bg-gradient-to-br from-white to-blue-50/30';
                            shadowColor = 'hover:shadow-blue-100';
                        }

                        return (
                            <div 
                                key={`${contact.id}-${type}-${idx}`} 
                                className={`p-5 rounded-2xl border ${borderColor} ${bgColor} shadow-sm hover:shadow-lg ${shadowColor} transition-all duration-300 relative group`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    {/* Left Side: Info */}
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
                                            isPayment 
                                            ? (isCollection ? 'bg-red-100 border-red-200 text-red-600' : (isWinbackRecent ? 'bg-pink-100 border-pink-200 text-pink-600' : (isWinbackOld ? 'bg-purple-100 border-purple-200 text-purple-600' : 'bg-emerald-100 border-emerald-200 text-emerald-600')))
                                            : 'bg-blue-100 border-blue-200 text-blue-600'
                                        }`}>
                                            {isCollection ? <AlertTriangle className="w-6 h-6"/> : (isWinback ? <UserPlus className="w-6 h-6" /> : (isPayment ? <Banknote className="w-6 h-6" /> : <Users className="w-6 h-6" />))}
                                        </div>
                                        
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                                    isPayment 
                                                    ? (isCollection ? 'bg-white text-red-600 border-red-200' : (isWinbackRecent ? 'bg-white text-pink-600 border-pink-200' : (isWinbackOld ? 'bg-white text-purple-600 border-purple-200' : 'bg-white text-emerald-600 border-emerald-200')))
                                                    : 'bg-white text-blue-600 border-blue-200'
                                                }`}>
                                                    {isCollection ? 'Collection' : (isWinback ? 'Winback' : (isPayment ? 'Jatuh Tempo (Lancar)' : 'Kumpulan PRS'))}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white uppercase ${status === 'today' || status === 'soon' || isCollection ? 'bg-red-500 animate-pulse' : (isWinbackRecent ? 'bg-pink-400' : (isWinbackOld ? 'bg-purple-400' : 'bg-slate-400'))}`}>
                                                    {getStatusLabel(status)}
                                                </span>
                                                 <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                                                    {contact.flag}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-lg">
                                                {contact.name}
                                            </h4>
                                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                    {contact.sentra || 'Sentra -'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                    {isPayment ? (isCollection ? `DPD: ${daysLeft} Hari` : (isWinback ? `Lunas: ${contact.tglLunas || contact.tglJatuhTempo}` : `Jatuh Tempo: ${contact.tglJatuhTempo}`)) : `Tgl PRS: ${contact.tglPrs}`}
                                                </span>
                                            </div>
                                             <div className="text-xs text-slate-400 mt-1">
                                                CO: <span className="font-semibold text-slate-600">{contact.co || '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Action */}
                                    <div className="flex items-center gap-3 self-end sm:self-center w-full sm:w-auto mt-2 sm:mt-0">
                                        <div className={`hidden sm:block text-right mr-2`}>
                                            <p className="text-xs font-bold text-slate-400 uppercase">Status</p>
                                            <p className={`text-base font-black ${status === 'today' || status === 'soon' || isCollection ? 'text-red-500' : 'text-slate-700'}`}>
                                                {getStatusLabel(status)}
                                            </p>
                                        </div>
                                        <Button 
                                            className={`w-full sm:w-auto flex-1 ${isPayment ? 'shadow-emerald-200' : 'shadow-blue-200'}`}
                                            variant={isPayment ? (isCollection ? 'danger' : 'primary') : 'secondary'}
                                            onClick={() => onRemind(contact, type)}
                                            icon={<MessageCircle className="w-4 h-4" />}
                                        >
                                            {isCollection ? 'Tagih Bayar' : (isWinback ? 'Ajak Gabung' : (isPayment ? 'Tawarkan Modal' : 'Ingatkan Besok'))}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {visibleCount < filteredItems.length && (
                        <div className="flex justify-center mt-6">
                            <Button 
                                variant="secondary" 
                                onClick={handleLoadMore}
                                className="shadow-md"
                                icon={<ChevronDown className="w-4 h-4" />}
                            >
                                Tampilkan Lebih Banyak ({filteredItems.length - visibleCount})
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
  );
};