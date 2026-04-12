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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-[#1e293b] w-full max-w-md rounded-3xl border border-white/10 p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-2 text-white">Diagnóstico: {plano} 🚀</h2>
        <p className="text-slate-400 text-sm mb-6">Informe seus dados para gerar seu relatório personalizado.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">Nome Completo</label>
            <input 
              required
              className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-white focus:border-green-500 outline-none transition"
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              value={formData.nome}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">CPF ou CNPJ</label>
            <input 
              required
              className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-white focus:border-green-500 outline-none transition"
              onChange={(e) => setFormData({...formData, documento: e.target.value})}
              value={formData.documento}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">Data de Nascimento</label>
            <input 
              required
              type="text"
              placeholder="DD/MM/AAAA"
              className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-white focus:border-green-500 outline-none transition"
              onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
              value={formData.data_nascimento}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">E-mail</label>
            <input 
              required
              type="email"
              className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-white focus:border-green-500 outline-none transition"
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              value={formData.email}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">WhatsApp</label>
            <input 
              required
              placeholder="(00) 00000-0000"
              className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-white focus:border-green-500 outline-none transition"
              onChange={(e) => setFormData({...formData, telefone: formatPhone(e.target.value)})}
              value={formData.telefone}
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

          <div className="flex gap-3 mt-8">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-400 font-bold hover:text-white transition">Cancelar</button>
            <button type="submit" className="flex-1 bg-green-500 text-slate-900 py-3 rounded-xl font-black hover:bg-green-400 transition shadow-lg shadow-green-500/20">GERAR AGORA</button>
          </div>
        </form>
      </div>
    </div>
  );
};
