import React from 'react';
import { Contact } from '../types';
import { Phone, Pencil, MapPin, Wand2, UserCircle, CheckCircle2, CreditCard, Box, Wallet, AlertOctagon, Landmark, CalendarCheck, Users } from 'lucide-react';

interface ContactCardProps {
  contact: Contact;
  onEditClick: (contact: Contact) => void;
  onGenerateClick: (contact: Contact) => void;
}

// Helper component for consistent info display
const InfoItem = ({ label, value, icon: Icon, highlight, mono }: { label: string, value?: string, icon?: React.ElementType, highlight?: boolean, mono?: boolean }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1.5 whitespace-nowrap">
      {Icon && <Icon className="w-3 h-3 text-slate-400/80" />} {label}
    </span>
    <span className={`text-sm ${highlight ? 'font-bold text-emerald-700' : 'font-semibold text-slate-700'} ${mono ? 'font-mono tracking-tight' : ''} truncate`} title={value || '-'}>
      {value || '-'}
    </span>
  </div>
);

// React.memo optimizes performance by only re-rendering if props change
export const ContactCard: React.FC<ContactCardProps> = React.memo(({ contact, onEditClick, onGenerateClick }) => {
  const getFlagStyle = (flag: string) => {
    const f = flag.toLowerCase();
    if (f.includes('platinum')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (f.includes('gold') || f.includes('active')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (f.includes('silver')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (f.includes('do') || f.includes('drop') || f.includes('lunas')) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  // Helper to check if DPD is serious (> 0)
  const dpdValue = parseInt(contact.dpd || '0', 10);
  const isDpdWarning = dpdValue > 0;
  // Check if paid off
  const isLunas = contact.tglLunas && contact.tglLunas.length > 0;

  return (
    <div className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative flex flex-col ${isDpdWarning ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'}`}>
      {/* Decorative Top Border */}
      <div className={`absolute top-0 inset-x-0 h-1 transition-opacity ${isDpdWarning ? 'bg-red-500 opacity-100' : 'bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100'}`} />

      {/* HEADER: Identity */}
      <div className="p-5 pb-3 flex justify-between items-start gap-3">
        <div className="flex gap-4 items-center min-w-0">
            {/* Avatar */}
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 font-bold text-lg shadow-sm transition-all duration-300 ${
                isDpdWarning 
                ? 'bg-red-50 border-red-100 text-red-600'
                : 'bg-slate-50 border-slate-100 text-slate-600 group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-amber-600 group-hover:text-white'
            }`}>
                {contact.name.charAt(0).toUpperCase()}
            </div>
            
            {/* Name & Phone */}
            <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-orange-700 transition-colors truncate">
                    {contact.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-sm font-medium font-mono truncate">{contact.phone}</span>
                </div>
            </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
             <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getFlagStyle(contact.flag)}`}>
                {contact.flag}
             </span>
             {contact.status && (
                 <span className="text-[10px] text-slate-400 font-medium">
                     {contact.status}
                 </span>
             )}
             {isDpdWarning && (
                 <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100 animate-pulse">
                     <AlertOctagon className="w-3 h-3" /> DPD: {contact.dpd}
                 </span>
             )}
        </div>
      </div>

      {/* BODY: Info Grid */}
      <div className="px-5 py-4 border-t border-slate-50 bg-slate-50/30 grow">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-4">
            <InfoItem label="Sentra" value={contact.sentra} icon={MapPin} />
            <InfoItem label="Petugas (CO)" value={contact.co} icon={UserCircle} />
            <InfoItem label="Outstanding (OS)" value={contact.os} icon={Wallet} mono />
            <InfoItem label="Plafon" value={contact.plafon} icon={CreditCard} mono />
            <InfoItem label="Tabungan" value={contact.saldoTabungan} icon={Landmark} highlight mono />
            <InfoItem label="Produk" value={contact.produk} icon={Box} />
        </div>
        
        {contact.notes && (
             <div className="mt-4 pt-3 border-t border-slate-100/60">
                <p className="text-xs text-slate-400 italic line-clamp-1">
                  Catatan: "{contact.notes}"
                </p>
             </div>
        )}
      </div>

      {/* FOOTER: Dates & Actions */}
      <div className="px-5 py-3 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-t border-slate-100">
        
        {/* Dates Indicators */}
        <div className="flex flex-col gap-1 overflow-hidden">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                {/* Priority Display: Tgl Lunas -> Tgl Jatuh Tempo */}
                {isLunas ? (
                     <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg shadow-sm whitespace-nowrap shrink-0">
                        <CalendarCheck className="w-3.5 h-3.5 text-purple-500" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Tgl Lunas</span>
                            <span className="text-xs font-bold text-purple-700">{contact.tglLunas}</span>
                        </div>
                    </div>
                ) : contact.tglJatuhTempo ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg shadow-sm whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Jatuh Tempo</span>
                            <span className="text-xs font-bold text-emerald-700">{contact.tglJatuhTempo}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg opacity-50 whitespace-nowrap shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-400">No Jatuh Tempo</span>
                    </div>
                )}

                {contact.tglPrs && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg shadow-sm whitespace-nowrap shrink-0">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">PRS</span>
                            <span className="text-xs font-bold text-blue-700">{contact.tglPrs}</span>
                        </div>
                    </div>
                )}
            </div>
            {/* Meta Data (APPID/CIF) */}
            {(contact.appId || contact.cif) && (
                <div className="flex gap-2 text-[9px] text-slate-300 font-mono mt-1 px-1">
                    {contact.appId && <span>ID: {contact.appId}</span>}
                    {contact.cif && <span>CIF: {contact.cif}</span>}
                </div>
            )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 mt-1 sm:mt-0">
            <button
                onClick={() => onGenerateClick(contact)}
                className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-orange-50 text-orange-700 border border-slate-200 hover:border-orange-300 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 whitespace-nowrap"
                title="Buat Pesan WA"
            >
                <Wand2 className="w-3.5 h-3.5" />
                <span className="sm:hidden">Buat Pesan</span>
            </button>
            <button
                onClick={() => onEditClick(contact)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all"
                title="Edit Detail"
            >
                <Pencil className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
});
