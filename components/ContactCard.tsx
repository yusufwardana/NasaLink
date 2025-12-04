import React from 'react';
import { Contact } from '../types';
import { Phone, Pencil, MapPin, Wand2, UserCircle, Users, CheckCircle2, CreditCard, Box, Wallet, AlertOctagon, Landmark, CalendarCheck } from 'lucide-react';

interface ContactCardProps {
  contact: Contact;
  onEditClick: (contact: Contact) => void;
  onGenerateClick: (contact: Contact) => void;
}

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
    <div className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative ${isDpdWarning ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'}`}>
      {/* Decorative Top Border */}
      <div className={`absolute top-0 inset-x-0 h-1 transition-opacity ${isDpdWarning ? 'bg-red-500 opacity-100' : 'bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100'}`} />

      {/* HEADER: Identity */}
      <div className="p-5 pb-3 flex justify-between items-start gap-3">
        <div className="flex gap-4 items-center">
            {/* Avatar */}
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 font-bold text-lg shadow-sm transition-all duration-300 ${
                isDpdWarning 
                ? 'bg-red-50 border-red-100 text-red-600'
                : 'bg-slate-50 border-slate-100 text-slate-600 group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-amber-600 group-hover:text-white'
            }`}>
                {contact.name.charAt(0).toUpperCase()}
            </div>
            
            {/* Name & Phone */}
            <div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-orange-700 transition-colors">
                    {contact.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                    <Phone className="w-3.5 h-3.5" />
                    <span className="text-sm font-medium font-mono">{contact.phone}</span>
                </div>
            </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-end gap-1">
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
      <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/30">
        <div className="grid grid-cols-2 gap-y-3 gap-x-6">
            
            {/* Row 1: Sentra & CO */}
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Sentra
                </span>
                <span className="text-sm font-semibold text-slate-700 truncate" title={contact.sentra}>
                    {contact.sentra || '-'}
                </span>
            </div>
            
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                    <UserCircle className="w-3 h-3" /> Petugas (CO)
                </span>
                <span className="text-sm font-semibold text-slate-700 truncate" title={contact.co}>
                    {contact.co || '-'}
                </span>
            </div>

            {/* Row 2: Financials (Updated) */}
            <div className="flex flex-col col-span-2 grid grid-cols-2 gap-x-6 pt-2 border-t border-slate-100/50 mt-1">
                <div className="flex flex-col">
                     <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> Outstanding (OS)
                    </span>
                    <span className={`text-sm font-mono font-medium ${contact.os ? 'text-slate-800' : 'text-slate-400'}`}>
                        {contact.os || '-'}
                    </span>
                </div>
                <div className="flex flex-col">
                     <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> Plafon
                    </span>
                    <span className="text-sm font-mono font-medium text-slate-600">
                        {contact.plafon || '-'}
                    </span>
                </div>
            </div>

             {/* Row 3: Savings & Product */}
            <div className="flex flex-col col-span-2 grid grid-cols-2 gap-x-6">
                 <div className="flex flex-col">
                     <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                        <Landmark className="w-3 h-3" /> Tabungan
                    </span>
                    <span className="text-sm font-mono font-medium text-emerald-700">
                        {contact.saldoTabungan || '-'}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                        <Box className="w-3 h-3" /> Produk
                    </span>
                    <span className="text-xs text-slate-600 truncate">
                        {contact.produk || '-'}
                    </span>
                </div>
            </div>

        </div>
        
        {contact.notes && (
             <div className="mt-3 pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400 italic line-clamp-1">
                  Catatan: "{contact.notes}"
                </p>
             </div>
        )}
      </div>

      {/* FOOTER: Dates & Actions */}
      <div className="px-5 py-3 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-t border-slate-100">
        
        {/* Dates Indicators */}
        <div className="flex flex-col gap-1">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {/* Priority Display: Tgl Lunas -> Tgl Jatuh Tempo */}
                {isLunas ? (
                     <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg shadow-sm whitespace-nowrap">
                        <CalendarCheck className="w-3.5 h-3.5 text-purple-500" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Tgl Lunas</span>
                            <span className="text-xs font-bold text-purple-700">{contact.tglLunas}</span>
                        </div>
                    </div>
                ) : contact.tglJatuhTempo ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg shadow-sm whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Jatuh Tempo</span>
                            <span className="text-xs font-bold text-emerald-700">{contact.tglJatuhTempo}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg opacity-50 whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-400">No Jatuh Tempo</span>
                    </div>
                )}

                {contact.tglPrs && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg shadow-sm whitespace-nowrap">
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
                className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-orange-50 text-orange-700 border border-slate-200 hover:border-orange-300 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
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