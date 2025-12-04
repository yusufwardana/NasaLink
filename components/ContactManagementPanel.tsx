import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
import { Search, Edit2, Trash2, Filter, ChevronDown, User, MapPin } from 'lucide-react';
import { Button } from './Button';

interface ContactManagementPanelProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export const ContactManagementPanel: React.FC<ContactManagementPanelProps> = ({
  contacts,
  onEdit,
  onDelete,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSentra, setFilterSentra] = useState('All');
  const [visibleCount, setVisibleCount] = useState(20);

  // Unique Sentras for Filter
  const uniqueSentras = useMemo(() => {
    return Array.from(new Set(contacts.map(c => c.sentra || 'Unknown'))).sort();
  }, [contacts]);

  // Filter Logic
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      const matchSearch = !searchTerm || 
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        contact.phone.includes(searchTerm);
      const matchSentra = filterSentra === 'All' || (contact.sentra || 'Unknown') === filterSentra;
      
      return matchSearch && matchSentra;
    });
  }, [contacts, searchTerm, filterSentra]);

  const displayedContacts = filteredContacts.slice(0, visibleCount);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 animate-fade-in-up">
      
      {/* Header */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-4 mb-4 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Manajemen Kontak
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full border border-slate-200">
                    {filteredContacts.length}
                </span>
            </h2>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-2">
            <div className="relative flex-1">
                <input 
                    type="text" 
                    placeholder="Cari nama / HP..." 
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            
            <div className="relative w-1/3 min-w-[120px]">
                <select 
                    className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none appearance-none truncate"
                    value={filterSentra}
                    onChange={e => setFilterSentra(e.target.value)}
                >
                    <option value="All">Semua Sentra</option>
                    {uniqueSentras.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
        </div>
      </div>

      {/* Contact List */}
      <div className="space-y-2">
          {displayedContacts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-2xl">
                  Tidak ada kontak yang cocok.
              </div>
          ) : (
              displayedContacts.map(contact => (
                  <div key={contact.id} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 font-bold text-slate-500 text-sm">
                              {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                              <h4 className="font-bold text-slate-700 text-sm truncate">{contact.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3"/> {contact.sentra}</span>
                                  <span>•</span>
                                  <span className="font-mono">{contact.phone}</span>
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                          <button 
                            onClick={() => onEdit(contact)}
                            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          >
                              <Edit2 className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              ))
          )}
          
          {visibleCount < filteredContacts.length && (
              <div className="pt-4 flex justify-center">
                  <Button variant="secondary" size="sm" onClick={() => setVisibleCount(p => p + 20)}>
                      Load More ({filteredContacts.length - visibleCount})
                  </Button>
              </div>
          )}
      </div>

    </div>
  );
};