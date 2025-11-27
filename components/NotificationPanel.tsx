import React from 'react';
import { Contact } from '../types';
import { CalendarClock, MessageCircle, Banknote, Users, ArrowLeft } from 'lucide-react';
import { Button } from './Button';

export interface NotificationItem {
  contact: Contact;
  type: 'payment' | 'prs'; 
  status: 'today' | 'soon';
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
  // Full Page Layout
  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 animate-fade-in-up">
        
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-6 pt-2">
            <button 
                onClick={onBack}
                className="p-2 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-cyan-600 border border-slate-200 shadow-sm transition-all"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Agenda & Peluang
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full border border-red-200">
                        {items.length}
                    </span>
                </h2>
                <p className="text-sm text-slate-500">Monitoring Jatuh Tempo & Jadwal PRS (H-7)</p>
            </div>
        </div>

        {/* Filter Summary Chips */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm min-w-max">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-emerald-400">Prospek Cair</span>
                    <span className="text-lg font-bold text-emerald-700 leading-none">
                        {items.filter(i => i.type === 'payment').length}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl shadow-sm min-w-max">
                <Users className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-blue-400">Jadwal PRS</span>
                    <span className="text-lg font-bold text-blue-700 leading-none">
                        {items.filter(i => i.type === 'prs').length}
                    </span>
                </div>
            </div>
        </div>

        {/* Main List */}
        <div className="space-y-3">
            {items.length === 0 ? (
                <div className="text-center py-20 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-20 h-20 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <CalendarClock className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-600">Tidak ada agenda mendesak</h3>
                    <p className="text-slate-400 text-sm mt-1">
                        Semua jadwal aman. Cek kembali nanti untuk update terbaru.
                    </p>
                    <div className="mt-6">
                        <Button variant="outline" onClick={onBack}>Kembali ke Beranda</Button>
                    </div>
                </div>
            ) : (
                items.map(({ contact, type, status, daysLeft }, idx) => {
                    const isPayment = type === 'payment';
                    
                    // Card Styling
                    const borderColor = isPayment ? 'border-emerald-100' : 'border-blue-100';
                    const bgColor = isPayment ? 'bg-gradient-to-br from-white to-emerald-50/30' : 'bg-gradient-to-br from-white to-blue-50/30';
                    const hoverShadow = isPayment ? 'hover:shadow-emerald-100' : 'hover:shadow-blue-100';

                    return (
                        <div 
                            key={`${contact.id}-${type}-${idx}`} 
                            className={`p-5 rounded-2xl border ${borderColor} ${bgColor} shadow-sm hover:shadow-lg ${hoverShadow} transition-all duration-300 relative group`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                {/* Left Side: Info */}
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
                                        isPayment ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-blue-100 border-blue-200 text-blue-600'
                                    }`}>
                                        {isPayment ? <Banknote className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                                    </div>
                                    
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                                isPayment ? 'bg-white text-emerald-600 border-emerald-200' : 'bg-white text-blue-600 border-blue-200'
                                            }`}>
                                                {isPayment ? 'Peluang Refinancing' : 'Kumpulan PRS'}
                                            </span>
                                            {status === 'today' && (
                                                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                                                    HARI INI
                                                </span>
                                            )}
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
                                                {isPayment ? `Jatuh Tempo: ${contact.tglJatuhTempo}` : `Tgl PRS: ${contact.tglPrs}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Action */}
                                <div className="flex items-center gap-3 self-end sm:self-center w-full sm:w-auto mt-2 sm:mt-0">
                                    <div className={`hidden sm:block text-right mr-2`}>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Sisa Waktu</p>
                                        <p className={`text-lg font-black ${status === 'today' ? 'text-red-500' : 'text-slate-700'}`}>
                                            {status === 'today' ? '0 Hari' : `${daysLeft} Hari`}
                                        </p>
                                    </div>
                                    <Button 
                                        className={`w-full sm:w-auto flex-1 ${isPayment ? 'shadow-emerald-200' : 'shadow-blue-200'}`}
                                        variant={isPayment ? 'primary' : 'secondary'}
                                        onClick={() => onRemind(contact, type)}
                                        icon={<MessageCircle className="w-4 h-4" />}
                                    >
                                        {isPayment ? 'Tawarkan Modal' : 'Ingatkan Hadir'}
                                    </Button>
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