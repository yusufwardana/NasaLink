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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Import Kontak</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Cara Upload dari HP:</p>
            <p>Export kontak Anda ke file JSON atau Paste teks data nasabah di bawah ini. AI akan mencoba merapikan data Anda.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Kontak (JSON / Text)</label>
            <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
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
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleProcessImport} isLoading={isLoading} disabled={!jsonText}>
            Proses & Simpan
          </Button>
        </div>
      </div>
    </div>
  );
};
