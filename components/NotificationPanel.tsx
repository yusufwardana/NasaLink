import React from 'react';
import { Contact } from '../types';
import { X, CalendarClock, MessageCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  dueContacts: Array<{ contact: Contact; status: 'today' | 'soon'; daysLeft: number }>;
  onRemind: (contact: Contact) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  isOpen, 
  onClose, 
  dueContacts, 
  onRemind 
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-full right-0 mt-4 w-full sm:w-96 z-50 px-4 sm:px-0">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
            <div className="bg-red-500/20 p-1.5 rounded-lg">
                <CalendarClock className="w-4 h-4 text-red-400" />
            </div>
            <h3 className="font-bold text-white text-sm">Pengingat Jatuh Tempo</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto custom-scrollbar p-2 space-y-2">
          {dueContacts.length === 0 ? (
            <div className="text-center p-8 text-white/30 flex flex-col items-center">
                <CalendarClock className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">Tidak ada tagihan jatuh tempo dalam 3 hari ke depan.</p>
            </div>
          ) : (
            dueContacts.map(({ contact, status, daysLeft }) => (
              <div 
                key={contact.id} 
                className={`p-3 rounded-xl border flex flex-col gap-2 transition-colors ${
                    status === 'today' 
                    ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20' 
                    : 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10'
                }`}
              >
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-bold text-white text-sm">{contact.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/70">
                                {contact.sentra || 'Umum'}
                             </span>
                             {contact.plafon && (
                                <span className="text-[10px] text-white/50">
                                   Plafon: {contact.plafon}
                                </span>
                             )}
                        </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        status === 'today' ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' : 'bg-orange-500/20 text-orange-300'
                    }`}>
                        {status === 'today' ? 'HARI INI' : `${daysLeft} HARI LAGI`}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-white/60">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Tgl: {contact.tglJatuhTempo}</span>
                    </div>
                    <Button 
                        size="sm" 
                        variant="glass" 
                        className="h-8 text-xs bg-white/5 hover:bg-white/10"
                        onClick={() => {
                            onRemind(contact);
                            onClose();
                        }}
                        icon={<MessageCircle className="w-3 h-3" />}
                    >
                        Ingatkan
                    </Button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer */}
        {dueContacts.length > 0 && (
            <div className="p-3 bg-red-900/20 border-t border-white/10 text-[10px] text-center text-red-200/60">
                Total {dueContacts.length} nasabah perlu diperhatikan
            </div>
        )}
      </div>
    </div>
  );
};