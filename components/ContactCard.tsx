import React from 'react';
import { Contact } from '../types';
import { Phone, MessageCircle, Pencil, MapPin } from 'lucide-react';

interface ContactCardProps {
  contact: Contact;
  onGenerateClick: (contact: Contact) => void;
  onEditClick: (contact: Contact) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onGenerateClick, onEditClick }) => {
  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'Platinum': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Silver': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">{contact.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSegmentColor(contact.segment)}`}>
              {contact.segment}
            </span>
            {contact.sentra && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-orange-50 text-orange-700 border-orange-100">
                    <MapPin className="w-3 h-3" />
                    {contact.sentra}
                </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <Phone className="w-3 h-3" />
            <span>{contact.phone}</span>
          </div>
          {contact.lastInteraction && (
            <p className="text-xs text-gray-400 mt-1">
              Terakhir kontak: {contact.lastInteraction}
            </p>
          )}
          {contact.notes && (
            <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">
              "{contact.notes}"
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
            onClick={() => onEditClick(contact)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Kontak"
        >
            <Pencil className="w-4 h-4" />
        </button>
        <button 
            onClick={() => onGenerateClick(contact)}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium border border-green-200"
        >
            <MessageCircle className="w-4 h-4" />
            Buat Pesan
        </button>
      </div>
    </div>
  );
};