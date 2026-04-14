import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getSaasConfig, SaasConfig, updateSaasConfig } from '../../services/configService';
import { getSaasOrigin } from '../../lib/urlUtils';
import { Settings, Link, Info, Save, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const AdminSaasSettings: React.FC = () => {
  const [config, setConfig] = useState<SaasConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const saasUrl = getSaasOrigin();
  const displayUrl = saasUrl.replace('https://', '');

  useEffect(() => {
    getSaasConfig().then(data => {
      setConfig(data);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateSaasConfig(config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar config SaaS:", error);
      alert("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-400">Carregando configurações...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 p-6"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Configurações SaaS</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Gerencie o fluxo de pagamentos e checkout</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Link Público do SaaS */}
        <div className="md:col-span-2 bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-lg shadow-blue-600/20 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="size-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Link size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Link Público do SaaS</h3>
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">Este é o link que você deve divulgar para seus clientes</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white/10 p-2 rounded-2xl border border-white/10 w-full md:w-auto">
              <div className="flex flex-col">
                <code className="px-4 py-1 text-sm font-mono font-bold text-white truncate">
                  {displayUrl}
                </code>
                <a 
                  href={window.location.origin + "/diagnostico"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 text-[9px] font-black text-blue-200 uppercase tracking-tighter hover:text-white transition-colors"
                >
                  Testar Link Interno (Clique aqui)
                </a>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(saasUrl);
                  setSuccess(true);
                  setTimeout(() => setSuccess(false), 2000);
                }}
                className="bg-white text-blue-600 px-6 py-2 rounded-xl font-black text-xs uppercase hover:bg-blue-50 transition-all"
              >
                Copiar
              </button>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 size-48 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        {/* Modo de Pagamento */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
              <Info size={18} />
            </div>
            <h3 className="font-black text-[#0a0a2e] uppercase italic tracking-tight">Modo de Operação</h3>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => setConfig(prev => prev ? { ...prev, modo_pagamento: 'MANUAL' } : null)}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${config?.modo_pagamento === 'MANUAL' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}
            >
              <div>
                <p className="font-black text-[#0a0a2e] text-sm uppercase">Modo Manual</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Links externos (Kiwify, Hotmart, etc)</p>
              </div>
              {config?.modo_pagamento === 'MANUAL' && <CheckCircle size={20} className="text-blue-600" />}
            </button>

            <button 
              onClick={() => setConfig(prev => prev ? { ...prev, modo_pagamento: 'AUTOMATICO' } : null)}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${config?.modo_pagamento === 'AUTOMATICO' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}
            >
              <div>
                <p className="font-black text-[#0a0a2e] text-sm uppercase">Modo Automático</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mercado Pago (PIX Nativo)</p>
              </div>
              {config?.modo_pagamento === 'AUTOMATICO' && <CheckCircle size={20} className="text-blue-600" />}
            </button>
          </div>
          
          <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase">
            * O modo automático requer o plano Blaze do Firebase para funcionar corretamente com Cloud Functions.
          </p>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                <Settings size={18} />
              </div>
              <h3 className="font-black text-[#0a0a2e] uppercase italic tracking-tight">Vídeo de Vendas (VSL)</h3>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">ID do Vídeo no YouTube</label>
              <input 
                type="text"
                value={config?.vsl_youtube_id || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, vsl_youtube_id: e.target.value } : null)}
                placeholder="Ex: dQw4w9WgXcQ"
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
              <p className="text-[9px] text-slate-400 mt-2 font-medium">Insira apenas o ID do vídeo (o que vem após o v= na URL).</p>
            </div>
          </div>
        </div>

        {/* Configurações Manuais */}
        <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 transition-opacity ${config?.modo_pagamento === 'AUTOMATICO' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
              <Link size={18} />
            </div>
            <h3 className="font-black text-[#0a0a2e] uppercase italic tracking-tight">Checkout Manual</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Link: Diagnóstico Dívidas (R$ 24,90)</label>
              <input 
                type="text"
                value={config?.links_manuais?.dividas || ''}
                onChange={(e) => setConfig(prev => {
                  if (!prev) return null;
                  const links = prev.links_manuais || { dividas: '', bacen: '', rating: '', master: '' };
                  return { ...prev, links_manuais: { ...links, dividas: e.target.value } };
                })}
                placeholder="https://pay.kiwify.com.br/..."
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Link: Diagnóstico BACEN (R$ 47,00)</label>
              <input 
                type="text"
                value={config?.links_manuais?.bacen || ''}
                onChange={(e) => setConfig(prev => {
                  if (!prev) return null;
                  const links = prev.links_manuais || { dividas: '', bacen: '', rating: '', master: '' };
                  return { ...prev, links_manuais: { ...links, bacen: e.target.value } };
                })}
                placeholder="https://pay.kiwify.com.br/..."
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Link: Rating de Crédito (R$ 97,00)</label>
              <input 
                type="text"
                value={config?.links_manuais?.rating || ''}
                onChange={(e) => setConfig(prev => {
                  if (!prev) return null;
                  const links = prev.links_manuais || { dividas: '', bacen: '', rating: '', master: '' };
                  return { ...prev, links_manuais: { ...links, rating: e.target.value } };
                })}
                placeholder="https://pay.kiwify.com.br/..."
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Link: Diagnóstico Master (R$ 297,00)</label>
              <input 
                type="text"
                value={config?.links_manuais?.master || ''}
                onChange={(e) => setConfig(prev => {
                  if (!prev) return null;
                  const links = prev.links_manuais || { dividas: '', bacen: '', rating: '', master: '' };
                  return { ...prev, links_manuais: { ...links, master: e.target.value } };
                })}
                placeholder="https://pay.kiwify.com.br/..."
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Instruções ao Cliente</label>
              <textarea 
                value={config?.instrucoes_checkout || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, instrucoes_checkout: e.target.value } : null)}
                rows={3}
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg ${success ? 'bg-emerald-500 text-white' : 'bg-[#0a0a2e] text-white hover:scale-105 active:scale-95'}`}
        >
          {saving ? 'Salvando...' : success ? (
            <>Configurações Salvas <CheckCircle size={18} /></>
          ) : (
            <>Salvar Configurações <Save size={18} /></>
          )}
        </button>
      </div>
    </motion.div>
  );
};
