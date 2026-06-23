import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { getSaasConfig, SaasConfig, updateSaasConfig } from '../../services/configService';
import { wipeSystemData } from '../../services/wipeSystem';
import { getDiagnosticoOrigin } from '../../lib/urlUtils';
import { Settings, Link, Info, Save, CheckCircle, DollarSign, DownloadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export const AdminSaasSettings: React.FC = () => {
  const [config, setConfig] = useState<SaasConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [isWiping, setIsWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState<string | null>(null);

  const saasUrl = getDiagnosticoOrigin();
  const displayUrl = saasUrl.replace('https://', '');

  useEffect(() => {
    getSaasConfig().then(data => {
      setConfig(data);
      setLoading(false);
    });
  }, []);

  const [isExporting, setIsExporting] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [generatingBackup, setGeneratingBackup] = useState(false);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const { auth } = await import('../../firebase');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/backups', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.backups) setBackups(data.backups);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (!loading) fetchBackups();
  }, [loading]);

  const handleManualBackup = async () => {
    setGeneratingBackup(true);
    try {
      const { auth } = await import('../../firebase');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/trigger-backup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        Swal.fire('Sucesso', 'Backup gerado no Cloud Storage.', 'success');
        fetchBackups();
      } else {
         const d = await res.json();
         Swal.fire('Erro', d.error || 'Erro ao gerar backup', 'error');
      }
    } catch (e: any) {
       Swal.fire('Erro', e.message || 'Erro de rede', 'error');
    } finally {
      setGeneratingBackup(false);
    }
  };

  const handleExportAudit = async () => {
    setIsExporting(true);
    try {
      const auditPayload: any = {
        exportedAt: new Date().toISOString(),
        financial_transactions: [],
        consultation_requests: []
      };

      // Fetch financial transactions
      const transactionsSnap = await getDocs(collection(db, 'financial_transactions'));
      transactionsSnap.forEach(doc => {
        auditPayload.financial_transactions.push({ id: doc.id, ...doc.data() });
      });

      // Fetch consultation history (if the collection doesn't exist it will just return empty)
      try {
        const consultationsSnap = await getDocs(collection(db, 'consultation_requests'));
        consultationsSnap.forEach(doc => {
          auditPayload.consultation_requests.push({ id: doc.id, ...doc.data() });
        });
      } catch (e) {
        console.warn('Could not fetch consultation_requests collection:', e);
      }

      // Add status history as another form of history
      try {
        const historySnap = await getDocs(collection(db, 'status_history'));
        auditPayload.status_history = [];
        historySnap.forEach(doc => {
          auditPayload.status_history.push({ id: doc.id, ...doc.data() });
        });
      } catch (e) {}

      // Trigger download
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditPayload, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `gsa_audit_export_${new Date().getTime()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      Swal.fire({
         icon: 'success',
         title: 'Exportação Concluída',
         text: 'O arquivo JSON foi baixado para o seu dispositivo.',
         confirmButtonColor: '#0a0a2e'
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire('Erro', 'Ocorreu um erro ao exportar os dados de auditoria.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleWipe = async () => {
    const result = await Swal.fire({
      title: 'Zerar Registros',
      text: 'Isso apagará TODOS os leads, vendas, clientes e processos. O sistema voltará ao zero (mantendo configurações, usuários e APIs). ESSA AÇÃO NÃO PODE SER DESFEITA.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, Zerar Tudo',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      setIsWiping(true);
      setWipeProgress('Iniciando...');
      try {
        await wipeSystemData((progressMsg) => {
          setWipeProgress(progressMsg);
        });
        Swal.fire('Concluído', 'O sistema foi reiniciado com sucesso. A plataforma está pronta para operar.', 'success');
      } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Ocorreu um erro ao limpar o sistema.', 'error');
      } finally {
        setIsWiping(false);
        setWipeProgress(null);
      }
    }
  };

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

  if (loading) return <div className="p-6 text-center text-slate-400">Carregando configurações...</div>;

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
        <div className="md:col-span-2 bg-blue-600 p-8 rounded-2xl text-white shadow-lg shadow-blue-600/20 relative overflow-hidden">
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
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
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
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PIX Nativo (Alta Conversão)</p>
              </div>
              {config?.modo_pagamento === 'AUTOMATICO' && <CheckCircle size={20} className="text-blue-600" />}
            </button>
          </div>

          <AnimatePresence>
            {config?.modo_pagamento === 'AUTOMATICO' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-4 border-t border-slate-100 space-y-3"
              >
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione o Gateway</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setConfig(prev => prev ? { ...prev, gateway_ativo: 'MERCADO_PAGO' } : null)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${config?.gateway_ativo !== 'ASAAS' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    Mercado Pago
                  </button>
                  <button 
                    onClick={() => setConfig(prev => prev ? { ...prev, gateway_ativo: 'ASAAS' } : null)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${config?.gateway_ativo === 'ASAAS' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    Asaas
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase">
            * O modo automático requer o plano Blaze do Firebase para funcionar corretamente com Cloud Functions.
          </p>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                <DollarSign size={18} />
              </div>
              <h3 className="font-black text-[#0a0a2e] uppercase italic tracking-tight">Crendenciais (API)</h3>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Mercado Pago Access Token</label>
              <input 
                type="password"
                value={config?.mercado_pago_access_token || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, mercado_pago_access_token: e.target.value } : null)}
                placeholder="APP_USR-..."
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Mercado Pago Public Key</label>
              <input 
                type="text"
                value={config?.mercado_pago_public_key || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, mercado_pago_public_key: e.target.value } : null)}
                placeholder="APP_USR-..."
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">SMTP Host</label>
              <input 
                type="text"
                value={config?.smtp_host || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, smtp_host: e.target.value } : null)}
                placeholder="smtp.hostinger.com"
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
            
            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">SMTP Port</label>
              <input 
                type="number"
                value={config?.smtp_port || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, smtp_port: e.target.value } : null)}
                placeholder="587"
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
            
            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">SMTP User</label>
              <input 
                type="text"
                value={config?.smtp_user || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, smtp_user: e.target.value } : null)}
                placeholder="email@seu-dominio.com"
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">SMTP Pass</label>
              <input 
                type="password"
                value={config?.smtp_pass || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, smtp_pass: e.target.value } : null)}
                placeholder="********"
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Asaas API Key</label>
              <input 
                type="password"
                value={config?.asaas_key || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, asaas_key: e.target.value } : null)}
                placeholder="$a..."
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
            
            <div className="pt-2 flex items-center gap-2">
              <input 
                type="checkbox"
                checked={!!config?.is_sandbox}
                onChange={(e) => setConfig(prev => prev ? { ...prev, is_sandbox: e.target.checked } : null)}
                className="size-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usar Modo Sandbox (Teste)</label>
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Instala o Píxel da Meta no teu site
              </label>
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed mb-3">
                O Píxel da Meta é um excerto de código que adicionas ao teu site ao copiar o código base.
              </p>
              <textarea 
                value={config?.meta_pixel_code || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, meta_pixel_code: e.target.value } : null)}
                placeholder="<!-- Meta Pixel Code -->\n<script>...</script>\n<!-- End Meta Pixel Code -->"
                rows={5}
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xs font-mono text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Instala o Píxel do TikTok no teu site
              </label>
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed mb-3">
                O Píxel do TikTok é um excerto de código que adicionas ao teu site ao copiar o código base.
              </p>
              <textarea 
                value={config?.tiktok_pixel_code || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, tiktok_pixel_code: e.target.value } : null)}
                placeholder="<!-- TikTok Pixel Code -->\n<script>...</script>\n<!-- End TikTok Pixel Code -->"
                rows={5}
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xs font-mono text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Facebook Pixel ID (Opção Alternativa)</label>
              <input 
                type="text"
                value={config?.facebook_pixel_id || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, facebook_pixel_id: e.target.value } : null)}
                placeholder="123456789012345"
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase mt-2 mb-4">
                O Pixel será ativado automaticamente na Landing Page. Tente usar o campo de código base acima primeiro, ou apenas informe o ID aqui.
              </p>
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Meta Conversions API Token</label>
              <input 
                type="text"
                value={config?.meta_conversions_token || ''}
                onChange={(e) => setConfig(prev => prev ? { ...prev, meta_conversions_token: e.target.value } : null)}
                placeholder="EAA..."
                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-[#0a0a2e] focus:ring-2 focus:ring-blue-600 outline-none"
              />
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase mt-2 mb-4">
                Token de acesso da API de Conversões do Meta. Necessário para disparar os eventos de Purchase e Conversões offline (server-side).
              </p>
            </div>
          </div>

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

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                <Info size={18} />
              </div>
              <h3 className="font-black text-[#0a0a2e] uppercase italic tracking-tight">Configurações de Webhook</h3>
            </div>
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Webhook Mercado Pago:</p>
                <code className="text-[10px] bg-white px-2 py-1 rounded block border border-slate-200 break-all select-all">
                  https://us-central1-gsa-camara-pro.cloudfunctions.net/webhookMercadoPago
                </code>
              </div>
              <div>
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Webhook Asaas:</p>
                <code className="text-[10px] bg-white px-2 py-1 rounded block border border-slate-200 break-all select-all">
                  https://us-central1-gsa-camara-pro.cloudfunctions.net/webhookAsaas
                </code>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">Configure estas URLs nos respectivos painéis para ter baixa automática.</p>
            </div>
          </div>
        </div>

        {/* Configurações Manuais */}
        <div className={`bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 transition-opacity ${config?.modo_pagamento === 'AUTOMATICO' ? 'opacity-50 pointer-events-none' : ''}`}>
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

      <div className="pt-4 border-t border-slate-100 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
            <DownloadCloud size={18} />
          </div>
          <h3 className="font-black text-[#0a0a2e] uppercase italic tracking-tight">Auditoria e Exportação</h3>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h4 className="font-black text-[#0a0a2e] uppercase">Exportar Logs de Transações</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Gera um arquivo JSON contendo o histórico estruturado de consultas e todas as transações financeiras realizadas, para fins de arquivamento legal e auditoria.
            </p>
          </div>
          <button 
            onClick={handleExportAudit}
            disabled={isExporting}
            className="flex-shrink-0 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest px-8 py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {isExporting ? 'Exportando...' : 'Baixar JSON'}
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
            <DownloadCloud size={18} />
          </div>
          <h3 className="font-black text-[#0a0a2e] uppercase italic tracking-tight">Backups (Cloud Storage)</h3>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
            <div>
              <h4 className="font-black text-[#0a0a2e] uppercase">Backups Diários e Manuais</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Uma rotina agendada gera backups diários dos principais documentos (Leads e Consultas). Você também pode gerar um backup manual agora.
              </p>
            </div>
            <button 
              onClick={handleManualBackup}
              disabled={generatingBackup}
              className="flex-shrink-0 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest px-8 py-4 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {generatingBackup ? 'Gerando...' : 'Criar Backup Agora'}
            </button>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {loadingBackups ? (
              <div className="p-8 text-center text-slate-400 text-sm font-bold">Carregando backups do Cloud Storage...</div>
            ) : backups.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-bold">Nenhum backup encontrado.</div>
            ) : (
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-50 border-b border-slate-100">
                     <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Arquivo</th>
                     <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tamanho</th>
                     <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                   </tr>
                 </thead>
                 <tbody>
                   {backups.map(b => (
                     <tr key={b.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                       <td className="p-4">
                         <div className="text-sm font-bold text-[#0a0a2e]">{b.name}</div>
                         <div className="text-xs text-slate-400">{new Date(b.timeCreated).toLocaleString()}</div>
                       </td>
                       <td className="p-4 text-xs font-bold text-slate-500 text-center">
                         {(Number(b.size) / 1024 / 1024).toFixed(2)} MB
                       </td>
                       <td className="p-4 text-right">
                         <a 
                           href={b.downloadUrl} 
                           target="_blank" 
                           className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-lg"
                         >
                           Baixar JSON
                         </a>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-8 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
            <Info size={18} />
          </div>
          <h3 className="font-black text-red-600 uppercase italic tracking-tight">Área de Risco: Limpeza de Sistema</h3>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h4 className="font-black text-red-900 uppercase">Hard Reset</h4>
            <p className="text-xs text-red-700/80 mt-1 max-w-md">
              Apaga todos os registros transacionais (leads, vendas, processos, tickets, financeiro). Mantém apenas as configurações, APIs e usuários do sistema. Esta ação é irreversível.
            </p>
            {wipeProgress && (
              <p className="text-xs font-bold text-red-600 mt-2 flex items-center gap-2">
                <span className="animate-spin">⏳</span> {wipeProgress}
              </p>
            )}
          </div>
          <button 
            onClick={handleWipe}
            disabled={isWiping}
            className="flex-shrink-0 bg-red-600 text-white font-black uppercase text-[10px] tracking-widest px-8 py-4 rounded-xl hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {isWiping ? 'Resetando...' : 'Zerar Registros'}
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-3 px-5 py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg ${success ? 'bg-emerald-500 text-white' : 'bg-[#0a0a2e] text-white hover:scale-105 active:scale-95'}`}
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
