import React, { useState } from 'react';
import { Button } from './Button';
import { ArrowLeft, Lock, Shield, ChevronLeft } from 'lucide-react';

interface AdminLoginPanelProps {
  onBack: () => void;
  onLogin: () => void;
}

// Renamed to Panel, rendering as full page
export const AdminLoginPanel: React.FC<AdminLoginPanelProps> = ({ onBack, onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '123456') {
      onLogin();
      setPin('');
      setError(false);
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-100 p-6 animate-fade-in-up">
      
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 p-2 rounded-xl bg-white/80 border border-slate-200 text-slate-500 hover:text-orange-600 shadow-sm transition-all flex items-center gap-2 text-sm font-bold"
      >
        <ChevronLeft className="w-5 h-5" />
        Kembali
      </button>

      <div className="w-full max-w-md">
        {/* Logo / Icon Area */}
        <div className="text-center mb-8">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl shadow-orange-500/10 flex items-center justify-center mx-auto mb-6 border border-orange-100 transform rotate-3 hover:rotate-0 transition-all duration-500">
                <Shield className="w-10 h-10 text-orange-500" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">Security Check</h1>
            <p className="text-slate-500">Halaman ini dilindungi. Masukkan PIN Admin untuk mengakses konfigurasi sistem.</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl shadow-orange-500/10 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                        PIN Keamanan
                    </label>
                    <div className="relative max-w-[240px] mx-auto">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="• • • • • •"
                            className={`w-full pl-12 pr-4 py-4 bg-slate-50 border rounded-2xl outline-none text-center font-mono text-2xl tracking-[0.5em] transition-all text-slate-800 placeholder-slate-300 shadow-inner ${error ? 'border-red-300 ring-4 ring-red-50 bg-red-50' : 'border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500'}`}
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value);
                                if (error) setError(false);
                            }}
                            autoFocus
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-red-500 mt-3 font-bold text-center animate-pulse flex items-center justify-center gap-1">
                            ⚠️ PIN Salah. Akses ditolak.
                        </p>
                    )}
                </div>
                
                <Button type="submit" className="w-full py-4 text-base justify-center shadow-xl shadow-orange-500/20 rounded-xl">
                    Buka Dashboard Admin
                </Button>
            </form>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-8">
            B-Connect CRM • BTPN Syariah<br/>
            Secure Admin Gateway V1.0
        </p>
      </div>
    </div>
  );
};