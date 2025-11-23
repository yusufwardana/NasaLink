import React, { useState } from 'react';
import { MessageTemplate } from '../types';
import { Button } from './Button';
import { X, Plus, Edit2, Trash2, Check } from 'lucide-react';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: MessageTemplate[];
  onUpdateTemplates: (templates: MessageTemplate[]) => void;
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({ 
  isOpen, 
  onClose, 
  templates, 
  onUpdateTemplates 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MessageTemplate>>({});

  if (!isOpen) return null;

  const handleStartEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setEditForm({ ...template });
  };

  const handleStartAdd = () => {
    const newId = Date.now().toString();
    setEditingId(newId);
    setEditForm({
      id: newId,
      label: 'Template Baru',
      icon: '📝',
      promptContext: ''
    });
  };

  const handleSave = () => {
    if (!editForm.label || !editForm.promptContext) return;

    const newTemplate = editForm as MessageTemplate;
    
    if (templates.find(t => t.id === newTemplate.id)) {
      // Update existing
      onUpdateTemplates(templates.map(t => t.id === newTemplate.id ? newTemplate : t));
    } else {
      // Add new
      onUpdateTemplates([...templates, newTemplate]);
    }
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Hapus template ini?')) {
      onUpdateTemplates(templates.filter(t => t.id !== id));
      if (editingId === id) {
          setEditingId(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Atur Template Wording</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-100">
                <p className="font-semibold">Tips Wording:</p>
                <p>Template ini adalah instruksi (prompt) untuk AI. Jelaskan dengan bahasa manusia apa tujuan pesan Anda, AI yang akan merangkai kata-katanya.</p>
            </div>

          <div className="grid gap-4">
            {/* Form for Adding/Editing */}
            {editingId && (
              <div className="bg-white border-2 border-blue-500 rounded-xl p-4 shadow-md">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Icon (Emoji)</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded"
                            value={editForm.icon || ''}
                            onChange={e => setEditForm({...editForm, icon: e.target.value})}
                        />
                    </div>
                    <div className="col-span-1 sm:col-span-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Judul Kategori</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded font-semibold"
                            value={editForm.label || ''}
                            onChange={e => setEditForm({...editForm, label: e.target.value})}
                        />
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Instruksi untuk AI (Prompt Context)</label>
                    <textarea 
                        className="w-full p-2 border rounded h-24 text-sm"
                        value={editForm.promptContext || ''}
                        onChange={e => setEditForm({...editForm, promptContext: e.target.value})}
                        placeholder="Contoh: Ucapkan selamat hari raya Idul Fitri dan mohon maaf lahir batin..."
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Batal</Button>
                    <Button size="sm" onClick={handleSave} icon={<Check className="w-4 h-4"/>}>Simpan Template</Button>
                </div>
              </div>
            )}

            {/* List of Templates */}
            {templates.map(template => (
                <div 
                    key={template.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors ${editingId === template.id ? 'hidden' : ''}`}
                >
                    <div className="flex items-start gap-3 mb-3 sm:mb-0">
                        <div className="text-2xl bg-gray-100 w-12 h-12 flex items-center justify-center rounded-lg">{template.icon}</div>
                        <div>
                            <h3 className="font-semibold text-gray-900">{template.label}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2">{template.promptContext}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 self-end sm:self-center">
                        <button 
                            onClick={() => handleStartEdit(template)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDelete(template.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}

            {!editingId && (
                <button 
                    onClick={handleStartAdd}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    <span>Buat Template Baru</span>
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};