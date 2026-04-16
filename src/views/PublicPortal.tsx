import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDate } from '../lib/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Gift, CheckCircle2, AlertCircle, ArrowRight, Shield, ShieldCheck, Play, User, Clock, Wallet, Bell, AlertTriangle, Trophy, Star, AlertOctagon, ShieldAlert, Zap, MessageCircle, FileText, Share2, ChevronRight } from 'lucide-react';
import { ClubePromoBanner } from '../components/GSA/ClubePromoBanner';
import { consultaPublicaProcesso, registrarIndicacaoPublica, listarMinhasIndicacoesPublicas, listarPendenciasPublicas, listarNotificacoesPublicas } from '../services/publicService';
import { SmartFicha } from '../components/GSA/SmartFicha';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PublicPortalConfig } from '../services/configService';
import { formatDocument } from '../utils/validators';
import { getPublicOrigin } from '../lib/urlUtils';
import Swal from 'sweetalert2';
import { gerarRelatorioStatus } from '../services/statusPdfService';

export const PublicPortal = ({ previewConfig }: { previewConfig?: PublicPortalConfig }) => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'SEARCH' | 'RESULT'>('SEARCH');
  const [loading, setLoading] = useState(false);
  const [documento, setDocumento] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [processo, setProcesso] = useState<any>(null);
  const [indicacoes, setIndicacoes] = useState<any[]>([]);
  const [pendencias, setPendencias] = useState<any[]>([]);
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [config, setConfig] = useState<PublicPortalConfig | null>(previewConfig || null);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('gsa_referrer', ref);
    }
  }, [searchParams]);

  useEffect(() => {
    if (previewConfig) {
      setConfig(previewConfig);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'platform_config', 'portal_publico'), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data() as PublicPortalConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'platform_config');
    });
    return () => unsubscribe();
  }, [previewConfig]);

  // Estado do formulário de indicação
  const [nomeAmigo, setNomeAmigo] = useState('');
  const [whatsAmigo, setWhatsAmigo] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação estrita
    if (!documento || !dataNascimento) {
      return Swal.fire('Atenção', 'Documento e Data de Nascimento são obrigatórios para sua segurança.', 'warning');
    }

    setLoading(true);
    try {
      const res = await consultaPublicaProcesso(documento, dataNascimento);
      // Se res for null, significa que o cliente existe mas não tem processos.
      // Vamos permitir que ele veja o "Tapete Vermelho" no resultado.
      
      const refs = await listarMinhasIndicacoesPublicas(documento, dataNascimento);
      setIndicacoes(refs);
      
      if (res) {
        const pends = await listarPendenciasPublicas(res.cliente_id);
        setPendencias(pends);

        const notifs = await listarNotificacoesPublicas(res.cliente_id);
        setNotificacoes(notifs);
      }
      
      setProcesso(res);
      setStep('RESULT');
    } catch (err: any) {
      Swal.fire({
        title: 'Atenção',
        text: 'Não encontramos registros com esses dados. Deseja conhecer nossos serviços e se tornar um cliente?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Ver Serviços',
        cancelButtonText: 'Tentar Novamente',
        confirmButtonColor: '#fbbf24',
        cancelButtonColor: '#1e3a8a'
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = '/';
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    if (!documento || !dataNascimento) return;
    try {
      const res = await consultaPublicaProcesso(documento, dataNascimento);
      setProcesso(res);
      if (res) {
        const pends = await listarPendenciasPublicas(res.cliente_id);
        setPendencias(pends);
      }
    } catch (err) {
      console.error("Erro ao atualizar dados:", err);
    }
  };

  const handleIndicar = async () => {
    if (!nomeAmigo || !whatsAmigo) return;
    try {
      const bonusValor = config?.bonus_indicacao || 50;
      await registrarIndicacaoPublica(documento, dataNascimento, nomeAmigo, whatsAmigo, bonusValor);
      
      // Recarrega as indicações
      const refs = await listarMinhasIndicacoesPublicas(documento, dataNascimento);
      setIndicacoes(refs);
      
      setNomeAmigo('');
      setWhatsAmigo('');
      Swal.fire('Sucesso', 'Indicação registrada! O nosso consultor entrará em contato.', 'success');
    } catch (err) {
      Swal.fire('Erro', 'Erro ao registrar indicação.', 'error');
    }
  };

  const totalBonus = indicacoes
    .filter(ind => ind.status_indicacao === 'Concluído')
    .reduce((sum, ind) => sum + (ind.bonus_valor || 0), 0);

  const pendenciasAtivas = pendencias.filter(p => p.status_pendencia !== 'RESOLVIDO');
  const pendenciasResolvidas = pendencias.filter(p => p.status_pendencia === 'RESOLVIDO');

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col items-center justify-start font-sans overflow-y-auto">
      {/* HEADER */}
      <header className="w-full h-16 sm:h-20 bg-[#0a0a2e] text-white flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-lg">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-400/20">
              <ShieldCheck className="text-[#0a0a2e]" size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase">GSA Diagnóstico</h1>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/financeiro'}
            className="group flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 px-3 py-1.5 sm:px-6 sm:py-3 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-blue-500/20 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="size-5 sm:size-8 bg-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-lg group-hover:rotate-12 transition-transform">
              <User className="size-3 sm:size-4" />
            </div>
            
            <div className="text-left hidden sm:block">
              <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Acesso Restrito</p>
              <p className="text-[10px] font-black text-white uppercase italic tracking-tight leading-none">Área do Cliente</p>
            </div>
            <span className="text-[9px] font-black text-white uppercase italic tracking-tight sm:hidden">Entrar</span>
            
            <ChevronRight className="size-3 sm:size-4 text-white/30 group-hover:translate-x-1 transition-transform ml-1 sm:ml-2" />
          </motion.button>
        </div>
      </header>

      <div className="max-w-2xl w-full p-4 sm:p-6 md:p-8 pt-8 pb-64 sm:pb-48 md:pb-40">
        <AnimatePresence mode="wait">
          {step === 'SEARCH' ? (
            <motion.div 
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-slate-200"
              style={{ borderTop: config ? `8px solid ${config.cor_primaria}` : 'none' }}
            >
              <div className="text-center mb-6 sm:mb-8">
                <div 
                  className="size-12 sm:size-16 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                  style={{ backgroundColor: config?.cor_primaria || '#0a0a2e' }}
                >
                  <Search className="text-white size-5 sm:size-8" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 uppercase italic tracking-tight">{config?.titulo_portal || 'Consulta de Processo'}</h2>
                <p className="text-slate-500 text-xs sm:text-sm px-4">{config?.mensagem_boas_vindas || 'Introduza os seus dados para acompanhar o andamento.'}</p>
                
                {config?.link_video_explicativo && (
                  <div className="mt-6">
                    <a 
                      href={config.link_video_explicativo} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-black uppercase text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Play size={14} fill="currentColor" /> Ver Vídeo Explicativo
                    </a>
                  </div>
                )}
              </div>

              <form onSubmit={handleSearch} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest flex items-center gap-2">
                    <User size={12} className="text-blue-600" /> CPF ou CNPJ do Titular
                  </label>
                  <input 
                    type="text" 
                    placeholder="000.000.000-00"
                    value={documento}
                    onChange={(e) => setDocumento(formatDocument(e.target.value))}
                    className="w-full bg-slate-50 border-none rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs sm:text-sm focus:ring-2 focus:ring-blue-900/20 transition-all"
                    required
                  />
                </div>
                
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest flex items-center gap-2">
                    <Clock size={12} className="text-blue-600" /> Data de Nascimento
                  </label>
                  <input 
                    type="date" 
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs sm:text-sm focus:ring-2 focus:ring-blue-900/20 transition-all"
                    required
                  />
                  <p className="text-[9px] text-slate-400 italic ml-4">* Validação de segurança obrigatória</p>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                  style={{ backgroundColor: config?.cor_primaria || '#0a0a2e' }}
                >
                  {loading ? (
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search size={18} />
                      Consultar Agora
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {!processo ? (
                /* TAPETE VERMELHO PARA QUEM NÃO TEM PROCESSOS */
                <div className="space-y-8 animate-fade-in">
                  <div className="bg-[#0a0a2e] rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 md:p-16 border border-white/10 shadow-2xl text-center space-y-6 sm:space-y-8 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    
                    <div className="absolute top-0 right-0 p-6 sm:p-12 opacity-5 text-white">
                      <Star className="size-[100px] sm:size-[180px]" fill="currentColor" />
                    </div>
                    
                    <div className="size-16 sm:size-28 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-2xl shadow-yellow-400/40 relative z-10">
                      <Trophy className="size-8 sm:size-[56px] text-blue-900 animate-bounce" />
                    </div>

                    <div className="relative z-10 space-y-3 sm:space-y-4">
                      <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter leading-tight">
                        Bem-Vindo ao <br/> <span className="text-yellow-400">Tapete Vermelho!</span>
                      </h1>
                      
                      <p className="text-blue-100 text-xs sm:text-lg max-w-2xl mx-auto leading-relaxed opacity-80 px-4">
                        Ainda não tem um processo ativo? Não se preocupe! Você já faz parte da nossa comunidade exclusiva. 
                        Aproveite para conhecer os nossos serviços premium ou ganhar bónus indicando amigos.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center pt-4 sm:pt-8 relative z-10">
                      <button 
                        onClick={() => window.location.href = '/'}
                        className="btn-accent px-8 sm:px-12 py-4 sm:py-6 text-sm sm:text-base w-full sm:w-auto"
                      >
                        Ver Nossos Serviços <ArrowRight size={18} />
                      </button>
                      <button 
                        onClick={() => setStep('SEARCH')}
                        className="px-8 sm:px-12 py-4 sm:py-6 bg-white/10 text-white rounded-2xl sm:rounded-3xl font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-white/20 transition-all backdrop-blur-md flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        Nova Consulta
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Card de Indicação */}
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                      <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="size-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                            <Share2 size={24} />
                          </div>
                          <h3 className="text-xl font-black uppercase italic tracking-tight">Indique e Ganhe</h3>
                        </div>
                        
                        <p className="text-indigo-100 text-sm leading-relaxed">
                          Mesmo sem processos, você pode lucrar! Indique amigos e receba bônus direto na sua carteira por cada venda fechada.
                        </p>

                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${getPublicOrigin()}/cp?ref=${documento}`);
                            Swal.fire('Link Copiado!', 'Partilhe com os seus amigos e ganhe bônus.', 'success');
                          }}
                          className="w-full py-4 bg-white text-blue-700 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          Copiar Meu Link de Indicação
                        </button>
                      </div>
                      <div className="absolute -right-10 -bottom-10 size-48 bg-white/10 rounded-full blur-3xl"></div>
                    </div>

                    {/* Card de Clube de Prêmios */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="size-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center">
                          <Gift size={24} className="text-yellow-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Clube de Prêmios</h3>
                      </div>

                      <p className="text-slate-500 text-sm leading-relaxed">
                        Acumule pontos através das suas interações e troque por recompensas exclusivas na nossa loja.
                      </p>

                      <div className="pt-4">
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seu Saldo Atual</span>
                          <span className="text-2xl font-black text-slate-800 italic">0 <span className="text-xs font-bold not-italic text-slate-400">PTS</span></span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
                          <div className="h-full bg-yellow-400 w-0" />
                        </div>
                        
                        <button 
                          onClick={() => window.location.href = '/'}
                          className="block w-full text-center bg-slate-50 hover:bg-yellow-50 text-slate-700 hover:text-yellow-700 py-3 rounded-xl font-bold text-xs uppercase border border-slate-200 hover:border-yellow-200 transition-all"
                        >
                          Ver Vitrine de Prêmios
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* AVISO JURÍDICO (TERROR) E SALVAÇÃO (INDICAÇÃO) */}
              {processo?.dias_atraso > 10 && (
                <div className="bg-rose-600 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 text-white shadow-2xl border-4 border-rose-500 animate-pulse-slow">
                  <div className="flex items-center gap-3 sm:gap-4 mb-6">
                    <div className="size-12 sm:size-16 bg-white/20 rounded-2xl sm:rounded-3xl flex items-center justify-center shrink-0">
                      <AlertOctagon className="text-white size-6 sm:size-10" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-2xl font-black uppercase italic leading-tight">Notificação de Suspensão Jurídica</h3>
                      <p className="text-rose-100 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">Protocolo em Risco de Cancelamento</p>
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-2xl p-4 sm:p-6 mb-6 space-y-4 border border-white/10">
                    <p className="text-xs sm:text-sm leading-relaxed">
                      Identificamos um atraso de <span className="font-black underline">{processo.dias_atraso} dias</span> no seu pagamento. 
                      Conforme cláusula contratual, seu processo foi <span className="font-black">SUSPENSO</span> e está sendo encaminhado para o departamento jurídico para emissão de <span className="font-black">TÍTULO EXECUTIVO</span>.
                    </p>
                    <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black uppercase bg-rose-500/30 p-2 rounded-lg w-fit">
                      <ShieldAlert size={14} /> Risco de Bloqueio de Conta e Negativação
                    </div>
                  </div>

                  {/* SALVAÇÃO: INDIQUE E GANHE */}
                  <div className="bg-white rounded-3xl p-6 text-slate-900 shadow-inner">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="text-amber-500" fill="currentColor" size={20} />
                      <h4 className="text-sm font-black uppercase italic">Evite o Cancelamento Agora</h4>
                    </div>
                    <p className="text-xs text-slate-600 mb-4">
                      Você pode abater sua dívida e reativar seu processo sem gastar dinheiro! 
                      <span className="font-bold text-rose-600"> Indique 1 amigo</span> que feche conosco e ganhe <span className="font-bold">R$ {config?.bonus_indicacao?.toFixed(2) || '50,00'}</span> de crédito imediato.
                    </p>

                    <div className="space-y-3">
                      <input 
                        placeholder="Nome do seu amigo" 
                        className="w-full bg-slate-100 border-none rounded-xl p-3 text-sm"
                        value={nomeAmigo}
                        onChange={e => setNomeAmigo(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <input 
                          placeholder="WhatsApp dele" 
                          className="flex-1 bg-slate-100 border-none rounded-xl p-3 text-sm"
                          value={whatsAmigo}
                          onChange={e => setWhatsAmigo(e.target.value)}
                        />
                        <button 
                          onClick={handleIndicar}
                          className="bg-rose-600 text-white px-6 rounded-xl font-black text-xs uppercase hover:bg-rose-700 transition-all"
                        >
                          Salvar Meu Processo
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Ou fale com o jurídico:</p>
                      <a 
                        href={`https://wa.me/${config?.whatsapp_negociacao || config?.whatsapp_suporte_geral}?text=Olá, gostaria de negociar meu débito em atraso.`}
                        target="_blank"
                        className="flex items-center gap-2 text-xs font-black text-emerald-600 hover:underline"
                      >
                        <MessageCircle size={14} /> Negociar Agora
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Card de Status */}
              <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 relative overflow-hidden ${processo?.dias_atraso > 10 ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
                      {processo?.status_atual}
                    </span>
                    <h3 className="text-2xl font-black text-slate-800 mt-2 uppercase italic">{processo?.servico_nome}</h3>
                  </div>
                  <button onClick={() => setStep('SEARCH')} className="text-slate-400 hover:text-slate-600">
                    Nova Consulta
                  </button>
                </div>
                
                <p className="text-slate-600 text-sm italic mb-6">"{processo?.status_info_extra || 'O seu processo está a ser processado pela nossa equipa técnica.'}"</p>
                
                {/* NOVO: Pontos Acumulados */}
                <div className="mb-6 p-4 bg-yellow-50 rounded-2xl border border-yellow-200">
                  <p className="text-[10px] font-black text-yellow-700 uppercase">Pontos Acumulados</p>
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-yellow-600" />
                    <span className="text-xl font-black text-yellow-800">{processo?.cliente_saldo_pontos || 0} PTS</span>
                  </div>
                  <p className="text-[9px] text-yellow-600 mt-1 italic">Cadastre-se para trocar por prêmios!</p>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                          <CheckCircle2 size={20} />
                        </div>
                        <p className="text-xs font-bold text-slate-700">Acompanhamento Ativo</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center min-w-[120px]">
                    <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">Pendências Resolvidas</p>
                    <p className="text-xl font-black text-emerald-700">{pendenciasResolvidas.length}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <button 
                    onClick={async () => {
                      const { gerarRelatorioStatus } = await import('../services/statusPdfService');
                      gerarRelatorioStatus(processo, config?.whatsapp_negociacao || config?.whatsapp_suporte_geral);
                    }}
                    className="w-full p-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
                  >
                    <FileText size={16} />
                    {processo?.status_financeiro === 'VENCIDO' ? 'Baixar Notificação Extrajudicial (PDF)' : 'Baixar Relatório de Status (PDF)'}
                  </button>
                </div>
              </div>

              {/* Oferta de Retenção (Clube de Benefícios) */}
              {processo?.status_financeiro === 'VENCIDO' && (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] shadow-2xl border border-slate-700 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="size-[80px] sm:size-[120px]" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="size-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                        <Trophy size={20} />
                      </div>
                      <h3 className="text-xl font-black uppercase italic tracking-tight">Clube de Benefícios GSA</h3>
                    </div>
                    <p className="text-slate-300 text-sm mb-6 leading-relaxed italic">
                      "Sabia que você pode usar suas indicações para abater sua dívida? Cada amigo que fechar conosco gera bônus direto para você!"
                    </p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`Olá! Estou usando a GSA para recuperar meu crédito e recomendo. Use meu link para ganhar desconto: ${getPublicOrigin()}/cp?ref=${processo.cliente_id}`);
                        Swal.fire('Link Copiado!', 'Compartilhe com seus amigos e ganhe bônus para abater sua fatura.', 'success');
                      }}
                      className="w-full p-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <Share2 size={16} /> Copiar Meu Link de Indicação
                    </button>
                  </div>
                </div>
              )}

              {/* Card de Pendências Ativas */}
              {pendenciasAtivas.length > 0 && (
                <div className="bg-amber-50 p-6 sm:p-8 rounded-[2.5rem] shadow-xl border border-amber-200 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-amber-200 rounded-full flex items-center justify-center text-amber-700">
                      <AlertTriangle size={20} />
                    </div>
                    <h3 className="text-xl font-black text-amber-900 uppercase italic">Resolver Pendências</h3>
                  </div>
                  
                  <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-inner">
                    <SmartFicha 
                      processos={[processo]} 
                      clienteDados={{
                        id: processo.cliente_id,
                        uid: processo.cliente_id,
                        nome_completo: processo.cliente_nome,
                        cpf: processo.cliente_cpf_cnpj,
                        data_nascimento: processo.data_nascimento,
                        ...processo
                      }}
                      onUpdate={refreshData}
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-amber-100">
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Lista Detalhada de Pendências:</p>
                    {pendenciasAtivas.map((p, i) => (
                      <div key={i} className="bg-white/50 p-4 rounded-2xl border border-amber-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-black text-slate-800 uppercase">{p.titulo}</h4>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">
                            {p.status_pendencia}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 italic">{p.descricao}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Card de Avisos e Notificações */}
              {notificacoes.length > 0 && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="size-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <Bell size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase italic">Avisos e Notificações</h3>
                  </div>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {notificacoes.map((n, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-xs font-black text-slate-800 uppercase">{n.titulo}</h4>
                          <span className="text-[8px] text-slate-400 font-bold">
                            {n.timestamp?.toDate ? formatDate(n.timestamp.toDate()) : 'Recent'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{n.mensagem}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Card de Bônus Acumulado */}
              {totalBonus > 0 && (
                <div className="bg-emerald-600 p-6 rounded-[2.5rem] text-white shadow-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Wallet size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Bônus Acumulado</p>
                      <h4 className="text-2xl font-black italic">R$ {totalBonus.toFixed(2)}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-emerald-200 uppercase max-w-[120px]">
                      Disponível para resgate na área logada
                    </p>
                  </div>
                </div>
              )}

              {/* Card Indique e Ganhe */}
              <div 
                className="p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden"
                style={{ backgroundColor: config?.cor_primaria || '#1e3a8a' }}
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Gift className="text-yellow-400" size={24} />
                    <h3 className="text-xl font-black uppercase italic">Indique e Ganhe Bónus</h3>
                  </div>
                  <p className="text-blue-100 text-sm mb-6">Ganhe R$ {config?.bonus_indicacao?.toFixed(2) || '50,00'} de bônus na sua carteira por cada amigo que contratar os nossos serviços.</p>
                  
                  <div className="space-y-3 mb-6">
                    <input 
                      placeholder="Nome do Amigo" 
                      className="w-full bg-white/10 border-none rounded-xl p-3 text-sm placeholder:text-blue-200"
                      value={nomeAmigo}
                      onChange={e => setNomeAmigo(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input 
                        placeholder="WhatsApp" 
                        className="flex-1 bg-white/10 border-none rounded-xl p-3 text-sm placeholder:text-blue-200"
                        value={whatsAmigo}
                        onChange={e => setWhatsAmigo(e.target.value)}
                      />
                      <button 
                        onClick={handleIndicar}
                        className="bg-yellow-400 text-blue-900 px-6 rounded-xl font-black text-xs uppercase"
                      >
                        Indicar
                      </button>
                    </div>
                  </div>

                  {/* Resumo de Indicações do Usuário (Baseado no Documento) */}
                  <div className="bg-black/20 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase text-blue-300 mb-2">As Suas Indicações Recentes</p>
                    {indicacoes.map((ind, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <span className="text-xs font-bold">{ind.nome_indicado?.split(' ')[0]}...</span>
                        <div className="flex items-center gap-2">
                          {ind.status_indicacao === 'Concluído' && (
                            <span className="text-[9px] font-black text-emerald-400">+ R$ {ind.bonus_valor?.toFixed(2)}</span>
                          )}
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                            ind.status_indicacao === 'Concluído' ? 'text-emerald-400 bg-emerald-400/10' :
                            ind.status_indicacao === 'Em Atendimento' ? 'text-blue-400 bg-blue-400/10' :
                            'text-yellow-400 bg-yellow-400/10'
                          }`}>
                            {ind.status_indicacao}
                          </span>
                        </div>
                      </div>
                    ))}
                    {indicacoes.length === 0 && <p className="text-[10px] text-blue-300 italic">Nenhuma indicação ainda.</p>}
                  </div>

                  <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                    <p className="text-[10px] text-blue-200">
                      <AlertCircle size={12} className="inline mr-1" />
                      Para resgatar bónus em dinheiro, é necessário concluir o seu registo com login e senha.
                    </p>
                    <button 
                      onClick={() => window.location.href = '/'}
                      className="text-xs font-black uppercase text-yellow-400 mt-2 hover:underline"
                    >
                      Acessar Área do Cliente para Resgatar
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>

        {/* Clube de Prêmios Banner (Sticky no Rodapé) */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <ClubePromoBanner 
              isPublic 
              onAction={() => window.location.href = '/'} 
            />
          </div>
        </div>
        
      </div>
    </div>
  );
};
