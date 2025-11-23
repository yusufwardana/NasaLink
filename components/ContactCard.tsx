import React from 'react';
import { Contact } from '../types';
import { Phone, Pencil, MapPin, Wand2, CalendarClock, UserCircle } from 'lucide-react';

interface ContactCardProps {
  contact: Contact;
  onEditClick: (contact: Contact) => void;
  onGenerateClick: (contact: Contact) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onEditClick, onGenerateClick }) => {
  const getSegmentStyle = (segment: string) => {
    switch (segment) {
      case 'Platinum': return 'bg-purple-500/20 text-purple-200 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]';
      case 'Gold': return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]';
      case 'Silver': return 'bg-slate-400/20 text-slate-200 border-slate-400/30';
      default: return 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30';
    }
  };

  return (
    <div className="group relative bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:bg-white/15 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/10">
      {/* Iridescent border gradient top */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-[1px] shadow-lg group-hover:shadow-cyan-500/40 transition-all duration-300 shrink-0">
             <div className="h-full w-full rounded-2xl bg-slate-900/80 backdrop-blur-sm flex items-center justify-center text-white font-bold text-xl border border-white/10">
                {contact.name.charAt(0).toUpperCase()}
             </div>
          </div>
          
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-white text-lg tracking-tight group-hover:text-cyan-300 transition-colors">{contact.name}</h3>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border backdrop-blur-sm ${getSegmentStyle(contact.segment)}`}>
                {contact.segment}
              </span>
              {contact.statusAsli && (
                   <span className="px-2 py-0.5 rounded text-[10px] border border-white/10 bg-white/5 text-white/60">
                       {contact.statusAsli}
                   </span>
              )}
            </div>
            
            <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2 text-sm text-white/70">
                    <Phone className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-mono tracking-wide">{contact.phone}</span>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    {contact.sentra && (
                        <div className="flex items-center gap-2 text-sm text-white/70">
                            <MapPin className="w-3.5 h-3.5 text-purple-400" />
                            <span>{contact.sentra}</span>
                        </div>
                    )}
                    {contact.co && (
                        <div className="flex items-center gap-2 text-sm text-white/70">
                            <UserCircle className="w-3.5 h-3.5 text-green-400" />
                            <span>CO: {contact.co}</span>
                        </div>
                    )}
                </div>

                {contact.tglJatuhTempo && (
                    <div className="flex items-center gap-2 text-sm text-red-200/80 mt-1 bg-red-500/10 px-2 py-1 rounded-md w-fit">
                        <CalendarClock className="w-3.5 h-3.5 text-red-400" />
                        <span>Jatuh Tempo: {contact.tglJatuhTempo}</span>
                    </div>
                )}
            </div>

            {contact.notes && (
                <p className="text-xs text-white/40 mt-2 italic line-clamp-1 border-l-2 border-white/10 pl-2">
                  "{contact.notes}"
                </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
              onClick={() => onGenerateClick(contact)}
              className="px-3 py-2 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 rounded-xl transition-all duration-300 border border-cyan-500/20 hover:border-cyan-500/40 flex items-center gap-2 text-xs font-semibold shadow-[0_0_10px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
              title="Buat Pesan WA"
          >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Buat Pesan</span>
          </button>

          <button
              onClick={() => onEditClick(contact)}
              className="p-2.5 text-white/60 hover:text-cyan-300 hover:bg-white/10 rounded-xl transition-all duration-300 border border-transparent hover:border-white/20"
              title="Edit Kontak"
          >
              <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};