import React, { useState, useEffect } from 'react';
import { getPublicPortalConfig, updatePublicPortalConfig, PublicPortalConfig } from '../../services/configService';
import { Eye, Save, Palette, Shield, Copy, ExternalLink, User, Clock, Search } from 'lucide-react';
import { PublicPortal } from '../../views/PublicPortal';
import { getPublicOrigin } from '../../lib/urlUtils';
import Swal from 'sweetalert2';

export const PortalSettingsView = () => {
  const [config, setConfig] = useState<PublicPortalConfig | null>(null);

  useEffect(() => {
    const load = async () => {
      const cfg = await getPublicPortalConfig();
      setConfig(cfg);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    try {
      await updatePublicPortalConfig(config);
      Swal.fire('Sucesso', 'Portal atualizado com sucesso!', 'success');
    } catch (e) {
      Swal.fire('Erro', 'Falha ao salvar configurações', 'error');
    }
  };

  if (!config) return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">Carregando configurações...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Formulário de Edição */}
      <div className="bg-white dark:bg-slate-900 p-4 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic flex items-center gap-2">
          <Palette size={24} className="text-blue-600" /> Identidade do Portal
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Título do Portal</label>
              <input 
                type="text" 
                value={config.titulo_portal || ''} 
                onChange={e => setConfig({...config, titulo_portal: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
                placeholder="Ex: Consulta GSA"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cor Principal</label>
              <div className="flex gap-4 items-center">
                <input 
                  type="color" 
                  value={config.cor_primaria || '#3b82f6'} 
                  onChange={e => setConfig({...config, cor_primaria: e.target.value})}
                  className="h-10 w-20 rounded cursor-pointer bg-transparent border-none"
                />
                <span className="font-mono text-sm dark:text-slate-300">{config.cor_primaria}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Boas-vindas (Página Inicial)</label>
            <textarea 
              value={config.mensagem_boas_vindas || ''} 
              onChange={e => setConfig({...config, mensagem_boas_vindas: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500/20 h-24 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">WhatsApp Suporte</label>
              <input 
                type="text" 
                value={config.whatsapp_suporte_geral || ''} 
                onChange={e => setConfig({...config, whatsapp_suporte_geral: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
                placeholder="5511999999999"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">WhatsApp Negociação (Cobrança)</label>
              <input 
                type="text" 
                value={config.whatsapp_negociacao || ''} 
                onChange={e => setConfig({...config, whatsapp_negociacao: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
                placeholder="5511999999999"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bônus Indicação (R$)</label>
              <input 
                type="number" 
                value={config.bonus_indicacao || 0} 
                onChange={e => setConfig({...config, bonus_indicacao: Number(e.target.value)})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Link Vídeo Explicativo</label>
              <input 
                type="text" 
                value={config.link_video_explicativo || ''} 
                onChange={e => setConfig({...config, link_video_explicativo: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm dark:text-white"
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleSave}
            className="flex-1 bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            <Save size={18} /> Salvar Alterações
          </button>
          <button 
            onClick={() => window.open('/cp', '_blank')}
            className="px-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <Eye size={18} /> Preview
          </button>
        </div>

        {/* Link de Compartilhamento */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/30">
          <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <ExternalLink size={14} /> Link de Consulta Pública
          </h4>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly 
              value={`${getPublicOrigin()}/cp`}
              className="flex-1 bg-white dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-mono text-slate-600 dark:text-slate-300"
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${getPublicOrigin()}/cp`);
                Swal.fire({
                  title: 'Copiado!',
                  text: 'Link copiado para a área de transferência.',
                  icon: 'success',
                  timer: 1500,
                  showConfirmButton: false
                });
              }}
              className="bg-white dark:bg-slate-800 p-3 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
              title="Copiar Link"
            >
              <Copy size={18} />
            </button>
          </div>
          <p className="text-[9px] text-blue-400 mt-3 italic">Compartilhe este link com seus clientes para que eles acompanhem o processo.</p>
        </div>
      </div>

      {/* Mini Preview em Tempo Real */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-[2rem] border-4 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-start overflow-hidden relative min-h-[600px]">
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Eye size={12} className="text-blue-600" /> Visualização em Tempo Real
            </p>
         </div>
         
         <div className="w-full h-full origin-top scale-[0.65] mt-8 pointer-events-none select-none">
            <div className="w-[150%] -translate-x-[16.5%]">
               <PublicPortal previewConfig={config} />
            </div>
         </div>
         
         <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[200px] text-center">
            <p className="text-[9px] text-slate-400 italic">Este é um preview interativo. As alterações acima são refletidas aqui instantaneamente.</p>
         </div>
      </div>
    </div>
  );
};
