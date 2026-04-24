import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatDate } from '../lib/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Gift, CheckCircle2, AlertCircle, ArrowRight, Shield, ShieldCheck, Play, User, Clock, Wallet, Bell, AlertTriangle, Trophy, Star, AlertOctagon, ShieldAlert, Zap, MessageCircle, FileText, Share2, ChevronRight, Info, Calendar, UserPlus } from 'lucide-react';
import { ClubePromoBanner } from '../components/GSA/ClubePromoBanner';
import { consultaPublicaProcesso, registrarIndicacaoPublica, listarMinhasIndicacoesPublicas, listarPendenciasPublicas, listarNotificacoesPublicas, registrarNovidadePublica } from '../services/publicService';
import { SmartFicha } from '../components/GSA/SmartFicha';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PublicPortalConfig } from '../services/configService';
import { formatDocument } from '../utils/validators';
import { getPublicOrigin } from '../lib/urlUtils';
import Swal from 'sweetalert2';
import { gerarRelatorioStatus } from '../services/statusPdfService';
import { ServiceData, listarServicosAtivos } from '../services/serviceFactory';

export const PublicPortal = ({ previewConfig }: { previewConfig?: PublicPortalConfig }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<'SEARCH' | 'RESULT'>('SEARCH');
  const [loading, setLoading] = useState(false);
  const [documento, setDocumento] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [processo, setProcesso] = useState<any>(null);
  const [indicacoes, setIndicacoes] = useState<any[]>([]);
  const [pendencias, setPendencias] = useState<any[]>([]);
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [config, setConfig] = useState<PublicPortalConfig | null>(previewConfig || null);
  const [servicosVitrine, setServicosVitrine] = useState<ServiceData[]>([]);

  // Newsletter State
  const [newsNome, setNewsNome] = useState('');
  const [newsWhats, setNewsWhats] = useState('');
  const [newsEmail, setNewsEmail] = useState('');
  const [newsLoading, setNewsLoading] = useState(false);

  // Indicação State (Extendido)
  const [nomeAmigo, setNomeAmigo] = useState('');
  const [whatsAmigo, setWhatsAmigo] = useState('');
  const [emailAmigo, setEmailAmigo] = useState('');

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await listarServicosAtivos();
        setServicosVitrine(data);
      } catch (e) {
        console.error("Erro ao carregar serviços:", e);
      }
    };
    fetchServices();
  }, []);

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
    if (!nomeAmigo || !whatsAmigo) {
      return Swal.fire('Atenção', 'Nome e WhatsApp são obrigatórios.', 'warning');
    }
    try {
      const bonusValor = config?.bonus_indicacao || 50;
      await registrarIndicacaoPublica(documento, dataNascimento, nomeAmigo, whatsAmigo, emailAmigo, bonusValor);
      
      // Recarrega as indicações
      const refs = await listarMinhasIndicacoesPublicas(documento, dataNascimento);
      setIndicacoes(refs);
      
      setNomeAmigo('');
      setWhatsAmigo('');
      setEmailAmigo('');
      
      Swal.fire({
        title: 'Indicação Registrada!',
        text: 'Deseja convidar mais amigos?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Convidar Outro',
        cancelButtonText: 'Fechar',
        confirmButtonColor: '#3b82f6'
      });
    } catch (err) {
      Swal.fire('Erro', 'Erro ao registrar indicação.', 'error');
    }
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsNome || !newsWhats) return;
    
    setNewsLoading(true);
    try {
      await registrarNovidadePublica(newsNome, newsWhats, newsEmail);
      setNewsNome('');
      setNewsWhats('');
      setNewsEmail('');
      Swal.fire('Inscrito!', 'Em breve você receberá nossas novidades em primeira mão.', 'success');
    } catch (err) {
      Swal.fire('Erro', 'Tente novamente em instantes.', 'error');
    } finally {
      setNewsLoading(false);
    }
  };

  const shareViaWhatsApp = () => {
    const link = `${getPublicOrigin()}?ref=${documento}`;
    const text = `Olá! Estou participando do portal GSA e recomendo. Use meu link para conhecer os serviços e ganhar bônus: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
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
            onClick={() => navigate('/financeiro')}
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

      <div className="w-full">
        <AnimatePresence mode="wait">
          {step === 'SEARCH' ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-20 pb-32"
            >
              {/* HERO SECTION COM BUSCA */}
              <section className="relative bg-[#0a0a2e] pt-12 pb-24 px-4 overflow-hidden">
                {/* Background Decorations */}
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                  <ShieldCheck size={400} className="text-white rotate-12" />
                </div>
                <div className="absolute -bottom-24 -left-24 size-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-4xl mx-auto relative z-10 text-center space-y-12">
                  <div className="space-y-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/30"
                    >
                      <Zap size={14} className="animate-pulse" /> Portal de Vantagens GSA
                    </motion.div>
                    <h1 className="text-4xl sm:text-6xl font-black text-white uppercase italic tracking-tighter leading-tight">
                      Acompanhe seu <span className="text-yellow-400">Processo</span> <br/>
                      e Ganhe <span className="text-blue-500">Prêmios!</span>
                    </h1>
                    <p className="text-blue-100/70 text-sm sm:text-lg max-w-2xl mx-auto font-medium">
                      O portal exclusivo para clientes GSA. Consulte seu status, indique amigos e acumule pontos para trocar por bônus e presentes incríveis.
                    </p>
                  </div>

                  {/* SEARCH FORM CARD */}
                  <motion.div 
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white p-2 rounded-[2.5rem] shadow-2xl max-w-xl mx-auto"
                  >
                    <div className="bg-slate-50 rounded-[calc(2.5rem-8px)] p-6 sm:p-10 text-left">
                      <form onSubmit={handleSearch} className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest flex items-center gap-2">
                            <User size={12} className="text-blue-600" /> CPF ou CNPJ do Titular
                          </label>
                          <input 
                            type="text" 
                            placeholder="000.000.000-00"
                            value={documento}
                            onChange={(e) => setDocumento(formatDocument(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest flex items-center gap-2">
                            <Clock size={12} className="text-blue-600" /> Data de Nascimento
                          </label>
                          <input 
                            type="date" 
                            value={dataNascimento}
                            onChange={(e) => setDataNascimento(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none [color-scheme:light]"
                            required
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={loading}
                          className="w-full bg-[#0a0a2e] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl hover:bg-black active:scale-[0.98] flex items-center justify-center gap-3"
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
                    </div>
                  </motion.div>
                </div>
              </section>

              {/* VITRINE DE SERVIÇOS */}
              <section className="max-w-7xl mx-auto px-4 space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl sm:text-5xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Nossas <span className="text-blue-600">Soluções</span></h2>
                  <p className="text-slate-400 text-xs sm:text-base font-bold uppercase tracking-[0.2em]">Especialistas em Reabilitação de Crédito</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {servicosVitrine.slice(0, 3).map((s, i) => (
                    <motion.div 
                      key={s.id}
                      whileHover={{ y: -10 }}
                      className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 flex flex-col h-full group"
                    >
                      <div className="size-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-8 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                        <Zap size={28} />
                      </div>
                      <h3 className="text-2xl font-black text-[#0a0a2e] uppercase italic mb-4 leading-tight">{s.nome_servico}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed italic mb-8 grow">
                        {s.descricao || 'Solução personalizada para limpar o seu nome e restaurar seu poder de compra com rapidez e segurança.'}
                      </p>
                      <button 
                        onClick={() => window.open(`https://wa.me/${config?.whatsapp_suporte_geral}?text=Olá, vi o serviço ${s.nome_servico} no portal e gostaria de mais informações.`, '_blank')}
                        className="w-full py-4 bg-slate-50 text-[#0a0a2e] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#0a0a2e] hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        Falar com Especialista <ArrowRight size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* CLUBE DE PRÊMIOS PREVIEW */}
              <section className="max-w-7xl mx-auto px-4">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-[3.5rem] p-8 sm:p-16 text-[#0a0a2e] relative overflow-hidden flex flex-col md:flex-row items-center gap-12">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Trophy size={300} />
                  </div>
                  
                  <div className="relative z-10 text-center md:text-left space-y-6 flex-1">
                    <div className="inline-flex items-center gap-2 bg-white/30 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                      <Star size={14} fill="currentColor" /> Benefício Exclusivo
                    </div>
                    <h2 className="text-4xl sm:text-6xl font-black uppercase italic tracking-tighter leading-none">
                      Elite de <br/> <span className="text-white">Prêmios!</span>
                    </h2>
                    <p className="text-[#0a0a2e]/70 text-sm sm:text-lg font-bold uppercase italic leading-relaxed max-w-md">
                      Acumule pontos em cada interação, indique novos clientes e troque por vale-compras, PIX e recompensas exclusivas.
                    </p>
                    <button 
                      onClick={() => Swal.fire('Clube de Vantagens', 'Consulte o seu processo para ver seu saldo de pontos atual!', 'info')}
                      className="px-12 py-5 bg-[#0a0a2e] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-105 transition-transform"
                    >
                      Descobrir Prêmios
                    </button>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4 relative z-10">
                    {[
                      { nome: 'Vale iFood', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400' },
                      { nome: 'Bônus PIX', img: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&q=80&w=400' },
                    ].map((p, i) => (
                      <div key={i} className="bg-white/20 backdrop-blur-md p-4 rounded-3xl border border-white/10">
                        <img src={p.img} className="rounded-2xl w-full aspect-square object-cover mb-3" alt={p.nome} referrerPolicy="no-referrer" />
                        <p className="text-[10px] font-bold text-center uppercase tracking-widest">{p.nome}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* NEWSLETTER VIP */}
              <section className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-[3rem] p-8 sm:p-16 shadow-2xl border border-slate-100 relative overflow-hidden text-center space-y-8">
                  <div className="absolute inset-0 bg-blue-50 opacity-30"></div>
                  <div className="relative z-10 space-y-6">
                    <div className="size-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-600/30">
                      <Bell size={32} className="text-white" />
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Seja o Primeiro a <span className="text-blue-600">Saber!</span></h2>
                    <p className="text-slate-500 text-sm sm:text-lg max-w-xl mx-auto italic font-medium">
                      Torne-se um VIP e receba estratégias de crédito, promoções exclusivas e bônus em primeira mão.
                    </p>

                    <form onSubmit={handleNewsletter} className="max-w-xl mx-auto space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input 
                          placeholder="Nome Completo" 
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-blue-500/10 outline-none"
                          value={newsNome}
                          onChange={e => setNewsNome(e.target.value)}
                          required
                        />
                        <input 
                          placeholder="WhatsApp" 
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-blue-500/10 outline-none"
                          value={newsWhats}
                          onChange={e => setNewsWhats(e.target.value)}
                          required
                        />
                      </div>
                      <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4">
                        <button 
                          type="submit"
                          disabled={newsLoading}
                          className="flex-[3] bg-[#0a0a2e] text-white py-5 px-8 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-50"
                        >
                          {newsLoading ? 'Inscrevendo...' : 'Cadastrar na Lista VIP'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => window.open('https://chat.whatsapp.com/ExempleGroupGSA', '_blank')}
                          className="flex-[2] bg-emerald-500 text-white py-5 px-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                        >
                          <MessageCircle size={18} /> Nossa Comunidade
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12 pb-32"
            >
              {/* HEADER DO RESULTADO */}
              <div className="bg-[#0a0a2e] rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden group border border-white/5">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                  <Star size={200} fill="currentColor" />
                </div>
                
                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8">
                  <div className="size-20 sm:size-28 bg-yellow-400 rounded-full flex items-center justify-center shadow-2xl shadow-yellow-400/40">
                    <Trophy className="size-10 sm:size-14 text-blue-900" />
                  </div>
                  <div className="text-center sm:text-left space-y-2">
                    <h1 className="text-3xl sm:text-5xl font-black uppercase italic tracking-tighter leading-none">
                      {processo ? `Olá, ${processo.cliente_nome?.split(' ')[0]}!` : 'Área do Cliente'}
                    </h1>
                    <p className="text-blue-200 text-sm sm:text-base font-medium max-w-md opacity-80">
                      {processo 
                        ? 'Confira o andamento do seu processo e aproveite seus benefícios exclusivos.' 
                        : 'Bem-vindo ao seu portal de vantagens. Comece a indicar e ganhar agora mesmo!'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-12 relative z-10">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Saldo de Pontos</p>
                    <p className="text-2xl font-black text-yellow-400">{processo?.cliente_saldo_pontos || 0} <span className="text-xs text-white opacity-50 uppercase not-italic">Pts</span></p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Bônus Acumulado</p>
                    <p className="text-2xl font-black text-emerald-400">R$ {totalBonus.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* STATUS DO PROCESSO (Se existir) */}
              {processo && processo.dias_atraso <= 10 && (
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-8">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="size-2 bg-blue-500 rounded-full animate-ping" />
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{processo.status_atual}</span>
                      </div>
                      <h3 className="text-2xl font-black text-[#0a0a2e] uppercase italic">{processo.servico_nome}</h3>
                    </div>
                    <button 
                      onClick={() => setStep('SEARCH')}
                      className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      Nova Consulta
                    </button>
                  </div>

                  <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">"{processo.status_info_extra || 'O seu processo está a ser processado pela nossa equipe técnica.'}"</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <div className="size-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Data da Venda</p>
                        <p className="text-sm font-bold text-[#0a0a2e]">{processo.data_venda?.toDate ? formatDate(processo.data_venda.toDate()) : 'Recent'}</p>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <div className="size-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Garantia Ativa</p>
                        <p className="text-sm font-bold text-emerald-600">100% Protegido</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={async () => {
                      const { gerarRelatorioStatus } = await import('../services/statusPdfService');
                      gerarRelatorioStatus(processo, config?.whatsapp_negociacao || config?.whatsapp_suporte_geral);
                    }}
                    className="w-full mt-6 p-4 bg-[#0a0a2e] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl"
                  >
                    <FileText size={18} /> Baixar Relatório de Status (PDF)
                  </button>
                </div>
              )}

              {/* AVISO JURÍDICO (Se em atraso) */}
              {processo?.dias_atraso > 10 && (
                <div className="bg-rose-600 rounded-[2.5rem] p-8 text-white shadow-2xl border-4 border-rose-500 animate-pulse-slow">
                   <div className="flex items-center gap-4 mb-6">
                    <div className="size-16 bg-white/20 rounded-3xl flex items-center justify-center">
                      <AlertOctagon size={40} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase italic leading-tight">Alerta de Suspensão</h3>
                      <p className="text-rose-100 text-[10px] font-bold uppercase tracking-widest">Protocolo em Risco de Cancelamento</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-6">
                    Identificamos um atraso de <span className="font-black underline">{processo.dias_atraso} dias</span>. 
                    Seu processo foi suspenso e está sendo encaminhado para o departamento jurídico.
                  </p>
                  <button 
                    onClick={() => window.open(`https://wa.me/${config?.whatsapp_negociacao}?text=Olá, quero negociar meu débito para não perder meu processo.`, '_blank')}
                    className="w-full p-5 bg-white text-rose-600 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl"
                  >
                    <MessageCircle size={20} /> Negociar via WhatsApp Agora
                  </button>
                </div>
              )}

              {/* HUB INDIQUE E GANHE (POLISHED) */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-900 rounded-[3rem] p-1 scale-100 sm:scale-105 shadow-2xl">
                <div className="bg-[#0a0a2e] rounded-[calc(3rem-4px)] p-8 sm:p-12 text-white relative overflow-hidden h-full">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Share2 size={240} />
                  </div>
                  
                  <div className="relative z-10 space-y-12">
                    <div className="text-center space-y-4">
                      <div className="size-16 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-600/30">
                        <Gift size={32} className="text-white" />
                      </div>
                      <h2 className="text-3xl sm:text-5xl font-black uppercase italic tracking-tighter leading-none">
                        COMPARTILHAR <span className="text-blue-500">LINK</span>
                      </h2>
                      <p className="text-blue-200 text-sm sm:text-lg max-w-md mx-auto opacity-80 mt-4 leading-relaxed font-semibold uppercase italic">
                        Envie seu link exclusivo para amigos e ganhe bônus de R$ {config?.bonus_indicacao?.toFixed(2) || '50,00'} automaticamente.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-md">
                      <div className="space-y-4">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${getPublicOrigin()}?ref=${documento}`);
                            Swal.fire('Link Copiado!', 'Compartilhe com seus amigos!', 'success');
                          }}
                          className="w-full p-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl hover:shadow-blue-500/20"
                        >
                          Copiar Link De Indicação
                        </button>
                        <button 
                          onClick={shareViaWhatsApp}
                          className="w-full p-6 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-xl hover:shadow-emerald-500/20"
                        >
                          Compartilhar No WhatsApp
                        </button>
                      </div>
                      <div className="space-y-4">
                        <p className="text-center font-black text-xs uppercase tracking-widest text-blue-300">Indicação Premium:</p>
                        <div className="space-y-3">
                          <input 
                            placeholder="Nome do Amigo" 
                            className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-sm placeholder:text-white/30 text-white outline-none focus:border-blue-500 transition-all"
                            value={nomeAmigo}
                            onChange={e => setNomeAmigo(e.target.value)}
                          />
                          <input 
                            placeholder="WhatsApp do Amigo" 
                            className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-sm placeholder:text-white/30 text-white outline-none focus:border-blue-500 transition-all"
                            value={whatsAmigo}
                            onChange={e => setWhatsAmigo(e.target.value)}
                          />
                          <input 
                            placeholder="E-mail (Opcional)" 
                            className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-sm placeholder:text-white/30 text-white outline-none focus:border-blue-500 transition-all"
                            value={emailAmigo}
                            onChange={e => setEmailAmigo(e.target.value)}
                          />
                          <button 
                            onClick={handleIndicar}
                            className="w-full bg-yellow-400 text-blue-900 py-4 rounded-xl font-black text-xs uppercase hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-2"
                          >
                            <UserPlus size={16} /> Enviar Indicação Premium
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* VITRINE DE PRÊMIOS (CLUBE DE PONTOS) */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                   <div className="size-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-blue-900 shadow-xl shadow-yellow-400/20">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Elite de Prêmios</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Transforme pontos em presentes reais</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {[
                    { nome: 'VALE COMPRAS - BOTICÁRIO R$25', pts: 500, img: 'https://images.unsplash.com/photo-1596462502278-27bfdc4033c8?auto=format&fit=crop&q=80&w=400' },
                    { nome: 'VALE COMPRAS - SHOPEE R$25', pts: 500, img: 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?auto=format&fit=crop&q=80&w=400' },
                    { nome: 'VALE CRÉDITO - UBER R$25', pts: 500, img: 'https://images.unsplash.com/photo-1510605395823-530474d7490e?auto=format&fit=crop&q=80&w=400' },
                    { nome: 'VALE COMPRAS - IFOOD R$25', pts: 500, img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400' },
                    { nome: 'R$ 50 OFF - SERVIÇOS GSA', pts: 1000, img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=400' },
                    { nome: 'PIX R$100', pts: 2000, img: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&q=80&w=400' },
                    { nome: 'PIX R$200', pts: 4000, img: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&q=80&w=400' }
                  ].map((p, i) => (
                    <motion.div 
                      whileHover={{ y: -10 }}
                      key={i} 
                      className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xl group cursor-pointer"
                    >
                      <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-slate-100 relative">
                        <img src={p.img} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={p.nome} referrerPolicy="no-referrer" />
                        <div className="absolute top-2 left-2 bg-[#0a0a2e] text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                          {p.pts} Pts
                        </div>
                      </div>
                      <h4 className="text-[10px] font-black text-slate-800 uppercase italic truncate">{p.nome}</h4>
                      <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Pontos Insuficientes</p>
                    </motion.div>
                  ))}
                </div>
                
                <button 
                  onClick={() => window.location.href = '/'}
                  className="w-full py-4 text-[#0a0a2e] border-2 border-[#0a0a2e] rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#0a0a2e] hover:text-white transition-all shadow-lg"
                >
                  Ver Catálogo De Prêmios Completo
                </button>
              </div>

              {/* VITRINE DE SERVIÇOS (SLIDER-LIKE OR GRID) */}
              <div className="space-y-8 bg-slate-100 -mx-4 sm:-mx-8 p-8 sm:p-12 rounded-[3.5rem]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-[#0a0a2e] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/20">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter leading-none">Soluções GSA</h2>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Especialistas em proteção de crédito</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {servicosVitrine.slice(0, 3).map((s, i) => (
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      key={s.id} 
                      className="bg-white rounded-3xl p-6 shadow-xl border border-white flex flex-col h-full"
                    >
                      <div className="size-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 font-black text-sm">
                        0{i+1}
                      </div>
                      <h4 className="text-xl font-black text-[#0a0a2e] uppercase italic leading-tight mb-4">{s.nome_servico}</h4>
                      <p className="text-slate-500 text-xs leading-relaxed flex-1 italic">
                        {s.descricao || 'Solução personalizada para sua necessidade financeira.'}
                      </p>
                      <button 
                        onClick={() => window.open(`https://wa.me/${config?.whatsapp_suporte_geral}?text=Olá, vi o serviço ${s.nome_servico} no portal e tenho interesse.`, '_blank')}
                        className="mt-6 flex items-center gap-2 text-xs font-black text-blue-600 uppercase hover:translate-x-2 transition-transform"
                      >
                        Saber Mais <ArrowRight size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* NEWSLETTER (NEWS) REGISTRATION */}
              <div className="bg-white rounded-[3rem] p-8 sm:p-12 border border-slate-100 shadow-2xl relative overflow-hidden text-center space-y-8">
                <div className="absolute inset-0 bg-blue-50 opacity-30"></div>
                
                <div className="relative z-10 space-y-6">
                  <div className="size-16 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/20">
                    <Bell size={28} className="text-white" />
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Receba Novidades Em Primeira Mão</h3>
                  <p className="text-slate-500 text-sm sm:text-lg max-w-xl mx-auto italic">
                    Cadastre-se na nossa lista VIP para receber promoções, bônus extras e novas soluções GSA antes de todo mundo.
                  </p>

                  <form onSubmit={handleNewsletter} className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input 
                      placeholder="Seu Nome Completo" 
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-2 ring-blue-500/20 outline-none"
                      value={newsNome}
                      onChange={e => setNewsNome(e.target.value)}
                      required
                    />
                     <input 
                      placeholder="Seu WhatsApp" 
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-2 ring-blue-500/20 outline-none"
                      value={newsWhats}
                      onChange={e => setNewsWhats(e.target.value)}
                      required
                    />
                    <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4">
                      <button 
                        type="submit"
                        disabled={newsLoading}
                        className="flex-[3] bg-[#0a0a2e] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-50"
                      >
                        {newsLoading ? 'Cadastrando...' : 'Quero Me Cadastrar VIP'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => window.open('https://chat.whatsapp.com/ExempleGroupGSA', '_blank')}
                        className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                      >
                        <MessageCircle size={16} /> Comunidade
                      </button>
                    </div>
                  </form>
                </div>
              </div>
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
