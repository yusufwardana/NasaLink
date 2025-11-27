import React from 'react';
import { Contact } from '../types';
import { Phone, Pencil, MapPin, Wand2, CalendarClock, UserCircle, Users } from 'lucide-react';

interface ContactCardProps {
  contact: Contact;
  onEditClick: (contact: Contact) => void;
  onGenerateClick: (contact: Contact) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onEditClick, onGenerateClick }) => {
  const getFlagStyle = (flag: string) => {
    const f = flag.toLowerCase();
    if (f.includes('platinum')) return 'bg-purple-100 text-purple-700 border-purple-200 shadow-purple-500/10';
    if (f.includes('gold') || f.includes('active')) return 'bg-yellow-100 text-yellow-800 border-yellow-200 shadow-yellow-500/10';
    if (f.includes('silver')) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (f.includes('do') || f.includes('drop')) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  };

  return (
    <div className="group relative bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-5 hover:bg-white transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-cyan-900/5">
      {/* Iridescent border gradient top */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 p-[1px] shadow-lg group-hover:shadow-cyan-500/30 transition-all duration-300 shrink-0">
             <div className="h-full w-full rounded-2xl bg-white flex items-center justify-center text-cyan-700 font-bold text-xl border border-white/50">
                {contact.name.charAt(0).toUpperCase()}
             </div>
          </div>
          
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-800 text-lg tracking-tight group-hover:text-cyan-700 transition-colors">{contact.name}</h3>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border backdrop-blur-sm shadow-sm ${getFlagStyle(contact.flag)}`}>
                {contact.flag}
              </span>
              {contact.status && (
                   <span className="px-2 py-0.5 rounded text-[10px] border border-slate-200 bg-slate-50 text-slate-500">
                       {contact.status}
                   </span>
              )}
            </div>
            
            <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone className="w-3.5 h-3.5 text-cyan-500" />
                    <span className="font-mono tracking-wide">{contact.phone}</span>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    {contact.sentra && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-purple-500" />
                            <span>{contact.sentra}</span>
                        </div>
                    )}
                    {contact.co && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <UserCircle className="w-3.5 h-3.5 text-green-500" />
                            <span>CO: {contact.co}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 mt-1">
                    {contact.tglJatuhTempo && (
                        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                            <CalendarClock className="w-3.5 h-3.5 text-red-500" />
                            <span>JT: {contact.tglJatuhTempo}</span>
                        </div>
                    )}
                     {contact.tglPrs && (
                        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                            <span>PRS: {contact.tglPrs}</span>
                        </div>
                    )}
                </div>
            </div>

            {contact.notes && (
                <p className="text-xs text-slate-400 mt-2 italic line-clamp-1 border-l-2 border-slate-200 pl-2">
                  "{contact.notes}"
                </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
              onClick={() => onGenerateClick(contact)}
              className="px-3 py-2 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 rounded-xl transition-all duration-300 border border-cyan-200 hover:border-cyan-300 flex items-center gap-2 text-xs font-semibold shadow-sm hover:shadow-md"
              title="Buat Pesan WA"
          >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Buat Pesan</span>
          </button>

          <button
              onClick={() => onEditClick(contact)}
              className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all duration-300 border border-transparent hover:border-slate-200"
              title="Edit Kontak"
          >
              <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};