
import React, { useState, useRef } from 'react';
import { Contact } from '../types';
import { Button } from './Button';
import { X, Upload, FileJson, AlertCircle, Smartphone } from 'lucide-react';
import { extractContactsFromText } from '../services/geminiService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (contacts: Contact[]) => void;
  apiKey?: string; // Add API Key
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, apiKey }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setJsonText(text);
    };
    reader.readAsText(file);
  };

  const handleProcessImport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let parsedData: any[] = [];
      
      // Try direct JSON parse first
      try {
        parsedData = JSON.parse(jsonText);
      } catch {
        // If JSON parse fails, use Gemini to try and extract contacts from raw text
        const extractedStr = await extractContactsFromText(jsonText, apiKey);
        try {
             parsedData = JSON.parse(extractedStr);
        } catch (e) {
            throw new Error("Gagal membaca format data. Pastikan format JSON valid atau teks jelas.");
        }
      }

      if (!Array.isArray(parsedData)) {
        throw new Error("Format data tidak valid. Harus berupa list nasabah.");
      }

      const newContacts: Contact[] = parsedData.map((item: any) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: item.name || 'Tanpa Nama',
        phone: item.phone || '-',
        flag: item.flag || item.segment || 'Prospect', // Migration handle
        notes: item.notes || '',
        lastInteraction: new Date().toLocaleDateString('id-ID')
      }));

      onImport(newContacts);
      onClose();
      setJsonText('');
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat import.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemoData = () => {
      const demo = [
          { name: "Budi Santoso", phone: "081234567890", flag: "Gold", notes: "Minat asuransi jiwa" },
          { name: "Siti Aminah", phone: "081987654321", flag: "Platinum", notes: "Policy renewal next month" },
          { name: "Andi Pratama", phone: "085678901234", flag: "Prospect", notes: "Baru tanya-tanya kesehatan" }
      ];
      setJsonText(JSON.stringify(demo, null, 2));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg">
                <Smartphone className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Import Kontak</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-bold mb-1 text-blue-700">Cara Upload dari HP:</p>
            <p className="opacity-80">Export kontak Anda ke file JSON atau Paste teks data nasabah di bawah ini. AI akan mencoba merapikan data Anda.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Data Kontak (JSON / Text)</label>
            <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono text-xs text-slate-800 placeholder-slate-400 outline-none"
                placeholder='[{"name": "Nama", "phone": "0812..."}] atau paste text dari Excel...'
            />
          </div>

          <div className="flex gap-3">
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json,.txt,.csv"
                onChange={handleFileUpload}
             />
             <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                icon={<Upload className="w-4 h-4" />}
             >
                Upload File
             </Button>
             <Button 
                variant="secondary" 
                size="sm" 
                onClick={loadDemoData}
                icon={<FileJson className="w-4 h-4" />}
             >
                Isi Data Demo
             </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-xl animate-shake">
              <AlertCircle className="w-4 h-4 text-red-500" />
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white/50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleProcessImport} isLoading={isLoading} disabled={!jsonText}>
            Proses & Simpan
          </Button>
        </div>
      </div>
    </div>
  );
};
