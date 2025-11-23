import React, { useState, useRef } from 'react';
import { Contact } from '../types';
import { Button } from './Button';
import { X, Upload, FileJson, AlertCircle, Smartphone } from 'lucide-react';
import { extractContactsFromText } from '../services/geminiService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (contacts: Contact[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
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
        const extractedStr = await extractContactsFromText(jsonText);
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
        segment: item.segment || 'Prospect',
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
          { name: "Budi Santoso", phone: "081234567890", segment: "Gold", notes: "Minat asuransi jiwa" },
          { name: "Siti Aminah", phone: "081987654321", segment: "Platinum", notes: "Policy renewal next month" },
          { name: "Andi Pratama", phone: "085678901234", segment: "Prospect", notes: "Baru tanya-tanya kesehatan" }
      ];
      setJsonText(JSON.stringify(demo, null, 2));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
            <div className="bg-blue-500/20 p-2 rounded-lg">
                <Smartphone className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Import Kontak</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white hover:bg-white/10 rounded-full p-2 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200">
            <p className="font-bold mb-1 text-blue-300">Cara Upload dari HP:</p>
            <p className="opacity-80">Export kontak Anda ke file JSON atau Paste teks data nasabah di bawah ini. AI akan mencoba merapikan data Anda.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-wider">Data Kontak (JSON / Text)</label>
            <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-40 p-3 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-transparent font-mono text-xs text-white placeholder-white/20 outline-none"
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
            <div className="flex items-center gap-2 text-red-300 text-sm bg-red-900/20 border border-red-500/30 p-3 rounded-xl animate-shake">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleProcessImport} isLoading={isLoading} disabled={!jsonText}>
            Proses & Simpan
          </Button>
        </div>
      </div>
    </div>
  );
};