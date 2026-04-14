import React, { useState } from 'react';
import { validateDocument, formatPhone, validatePhone } from '../../utils/validators';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { nome: string; documento: string; telefone: string; data_nascimento: string; email: string }) => void;
  plano: string;
}

export const LeadCaptureModal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, plano }) => {
  const [formData, setFormData] = useState({ nome: '', documento: '', telefone: '', data_nascimento: '', email: '' });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDocument(formData.documento)) {
      setError('CPF ou CNPJ inválido.');
      return;
    }
    if (!validatePhone(formData.telefone)) {
      setError('Número de WhatsApp inválido.');
      return;
    }
    if (!formData.data_nascimento) {
      setError('Data de nascimento é obrigatória.');
      return;
    }
    if (!formData.email || !formData.email.includes('@')) {
      setError('E-mail inválido.');
      return;
    }
    onConfirm(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a2e]/90 backdrop-blur-md">
      <div className="bg-[#161b33] w-full max-w-md rounded-[2.5rem] border border-blue-500/30 p-10 shadow-[0_0_60px_rgba(59,130,246,0.1)] relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2 text-white uppercase italic tracking-tighter">Diagnóstico GSA 🚀</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Plano: <span className="text-blue-400">{plano}</span></p>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Nome Completo</label>
              <input 
                required
                placeholder="Ex: João Silva"
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition font-medium text-sm"
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                value={formData.nome}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">CPF ou CNPJ</label>
              <input 
                required
                placeholder="000.000.000-00"
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition font-medium text-sm"
                onChange={(e) => setFormData({...formData, documento: e.target.value})}
                value={formData.documento}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Nascimento</label>
                <input 
                  required
                  type="date"
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition font-medium text-sm"
                  onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
                  value={formData.data_nascimento}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">WhatsApp</label>
                <input 
                  required
                  placeholder="(00) 00000-0000"
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition font-medium text-sm"
                  onChange={(e) => setFormData({...formData, telefone: formatPhone(e.target.value)})}
                  value={formData.telefone}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">E-mail</label>
              <input 
                required
                type="email"
                placeholder="seu@email.com"
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition font-medium text-sm"
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                value={formData.email}
              />
            </div>

            {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>}

            <div className="flex flex-col gap-3 mt-8">
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-500 transition shadow-xl shadow-blue-600/20 active:scale-95">GERAR DIAGNÓSTICO AGORA</button>
              <button type="button" onClick={onClose} className="w-full py-3 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition">Voltar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
