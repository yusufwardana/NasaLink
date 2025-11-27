import React from 'react';
import { Contact } from '../types';
import { X, CalendarClock, MessageCircle, AlertCircle, Users, MapPin, Banknote } from 'lucide-react';
import { Button } from './Button';

export interface NotificationItem {
  contact: Contact;
  type: 'payment' | 'prs'; // 'payment' = Jatuh Tempo (Selesai Angsuran), 'prs' = Pertemuan Rutin Sentra
  status: 'today' | 'soon';
  daysLeft: number;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  items: NotificationItem[];
  onRemind: (contact: Contact, type: 'payment' | 'prs') => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  isOpen, 
  onClose, 
  items, 
  onRemind 
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-full right-0 mt-4 w-full sm:w-96 z-50 px-4 sm:px-0">
      <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/50">
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                <CalendarClock className="w-4 h-4 text-slate-600" />
            </div>
            <div>
                <h3 className="font-bold text-slate-800 text-sm">Agenda & Peluang</h3>
                <p className="text-[10px] text-slate-500">Monitoring H-3</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50/50">
          {items.length === 0 ? (
            <div className="text-center p-8 text-slate-400 flex flex-col items-center">
                <CalendarClock className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">Tidak ada agenda mendesak.</p>
            </div>
          ) : (
            items.map(({ contact, type, status, daysLeft }, idx) => {
              // Styling based on Type
              // Payment (Jatuh Tempo) is now GREEN (Opportunity/Lunas), PRS is BLUE
              const isPayment = type === 'payment';
              
              // Dynamic Classes
              const containerBorder = isPayment 
                  ? (status === 'today' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-emerald-100')
                  : (status === 'today' ? 'bg-blue-50 border-blue-200' : 'bg-white border-blue-100');
              
              const badgeStyle = isPayment
                  ? (status === 'today' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600')
                  : (status === 'today' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600');

              return (
                <div 
                  key={`${contact.id}-${type}-${idx}`} 
                  className={`p-3 rounded-xl border flex flex-col gap-2 transition-colors hover:shadow-md ${containerBorder}`}
                >
                  <div className="flex justify-between items-start">
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                  isPayment ? 'bg-white text-emerald-600 border-emerald-200' : 'bg-white text-blue-600 border-blue-200'
                              }`}>
                                  {isPayment ? 'Prospek Cair' : 'Kumpulan PRS'}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded text-slate-600 border border-slate-200 bg-slate-100/50`}>
                                  {contact.sentra || 'Umum'}
                              </span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                              {contact.name}
                          </h4>
                      </div>
                      <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm text-center min-w-[60px] ${badgeStyle}`}>
                          <div>{status === 'today' ? 'HARI INI' : `${daysLeft} HARI LAGI`}</div>
                      </div>
                  </div>

                  <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-200/50">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          {isPayment ? <Banknote className="w-3.5 h-3.5 text-emerald-500" /> : <Users className="w-3.5 h-3.5 text-blue-400" />}
                          <span>Tgl: {isPayment ? contact.tglJatuhTempo : contact.tglPrs}</span>
                      </div>
                      <Button 
                          size="sm" 
                          variant="glass" 
                          className={`h-8 text-xs bg-white border-slate-200 ${isPayment ? 'hover:text-emerald-600' : 'hover:text-blue-600'}`}
                          onClick={() => {
                              onRemind(contact, type);
                              onClose();
                          }}
                          icon={<MessageCircle className="w-3 h-3" />}
                      >
                          {isPayment ? 'Tawarkan' : 'Ingatkan'}
                      </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Footer */}
        {items.length > 0 && (
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-center text-slate-500 flex justify-between px-6">
                 <span>💰 Prospek: {items.filter(i => i.type === 'payment').length}</span>
                 <span>🔵 PRS: {items.filter(i => i.type === 'prs').length}</span>
            </div>
        )}
      </div>
    </div>
  );
};