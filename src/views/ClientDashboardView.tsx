import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  FileText, 
  MessageSquare,
  Package,
  ExternalLink,
  ChevronRight,
  Search,
  Filter,
  ShieldCheck,
  TrendingUp,
  Zap,
  Wallet as WalletIcon,
  Crown,
  ChevronUp,
  Activity,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aceitarPropostaLeadVitrine, atualizarStatusLeadVitrine, LeadStatus } from '../services/marketingService';
import { getOrCreateWallet, Wallet } from '../services/financialService';
import { useAuth } from '../components/AuthContext';
import { SmartFicha } from '../components/GSA/SmartFicha';
import Swal from 'sweetalert2';

interface ClientDashboardViewProps {
  processes: any[];
  pendencies: any[];
  showcaseLeads: any[];
}

export const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ processes, pendencies, showcaseLeads }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'todos' | 'ativos' | 'concluidos'>('todos');
  const [showSmartFicha, setShowSmartFicha] = useState<string | null>(null);
  const [clientWallet, setClientWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    const fetchWallet = async () => {
      if (profile?.uid) {
        try {
          const w = await getOrCreateWallet(profile.uid);
          setClientWallet(w);
        } catch (e) {
          console.error('Wallet error', e);
        }
      }
    };
    fetchWallet();

    // Simular um pequeno delay para um carregamento mais "profissional"
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [profile]);

  const saldo = (clientWallet?.saldo_atual || 0) + (clientWallet?.saldo_bonus || 0);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };
  
  // CRO Tactis: Calcular o Rating GSA simulado baseado na interação
  // Um Score que aumenta para gamificar. (Base 450, + saldo, + processos * 30)
  const scoreBase = 450;
  const scoreAumentoWallet = Math.min(Math.floor(saldo / 5), 250);
  const scoreProcessos = Math.min(processes.length * 35, 150);
  const ratingSimulado = Math.min(scoreBase + scoreAumentoWallet + scoreProcessos, 985);
  const ratingClass = ratingSimulado > 750 ? 'text-emerald-400' : ratingSimulado > 600 ? 'text-blue-400' : 'text-amber-400';


  const filteredProcesses = processes.filter(p => {
    if (activeFilter === 'ativos') return p.status_atual !== 'Concluído' && p.status_atual !== 'Cancelado';
    if (activeFilter === 'concluidos') return p.status_atual === 'Concluído';
    return true;
  });

  const handleAcceptProposal = async (lead: any) => {
    if (!profile) return;
    
    const { value: formValues } = await Swal.fire({
      title: 'Formalização de Aceite',
      html: `
        <div class="space-y-4 text-left">
          <p class="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">Confirme seus dados para prosseguir</p>
          <div>
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">CPF ou CNPJ</label>
            <input id="swal-input1" class="swal2-input !m-0 !w-full !rounded-xl !text-sm" placeholder="000.000.000-00">
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">WhatsApp para Contato</label>
            <input id="swal-input2" class="swal2-input !m-0 !w-full !rounded-xl !text-sm" placeholder="(00) 00000-0000">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Confirmar e Aceitar',
      cancelButtonText: 'Voltar',
      confirmButtonColor: '#10b981',
      background: '#0a0a2e',
      color: '#fff',
      preConfirm: () => {
        const doc = (document.getElementById('swal-input1') as HTMLInputElement).value;
        const whatsapp = (document.getElementById('swal-input2') as HTMLInputElement).value;
        if (!doc || !whatsapp) {
          Swal.showValidationMessage('Por favor, preencha todos os campos');
          return false;
        }
        return { doc, whatsapp };
      }
    });

    if (formValues) {
      try {
        // Aqui poderíamos adicionar a lógica de "Motor de Segurança" (cruzar dados)
        // Por enquanto, apenas prosseguimos com o aceite
        await aceitarPropostaLeadVitrine(
          lead.id, 
          profile.uid, 
          profile.nome_completo || 'Cliente',
          `Aceite formalizado. Doc: ${formValues.doc}, WhatsApp: ${formValues.whatsapp}`
        );
        
        Swal.fire({
          title: 'Sucesso!',
          text: 'Proposta aceita com sucesso. Nosso especialista entrará em contato em instantes.',
          icon: 'success',
          background: '#0a0a2e',
          color: '#fff'
        });
      } catch (error) {
        console.error(error);
        Swal.fire('Erro', 'Não foi possível aceitar a proposta no momento.', 'error');
      }
    }
  };

  const handleRejectProposal = async (lead: any) => {
    if (!profile) return;
    
    const result = await Swal.fire({
      title: 'Recusar Proposta?',
      text: 'Você deseja recusar esta proposta? Nosso especialista poderá entrar em contato para uma nova negociação.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, Recusar',
      cancelButtonText: 'Voltar',
      confirmButtonColor: '#ef4444',
      background: '#0a0a2e',
      color: '#fff'
    });

    if (result.isConfirmed) {
      try {
        await atualizarStatusLeadVitrine(
          lead.id, 
          'Rejeitado Cliente', 
          profile.uid, 
          profile.nome_completo || 'Cliente',
          'O cliente recusou a proposta inicial.'
        );
        Swal.fire('Proposta Recusada', 'Sua decisão foi registrada. Entraremos em contato se houver uma nova oferta.', 'info');
      } catch (error) {
        console.error(error);
        Swal.fire('Erro', 'Não foi possível registrar sua decisão.', 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="relative">
          <div className="size-16 border-4 border-slate-100 rounded-full"></div>
          <div className="size-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Sincronizando seus processos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      
      {/* POWER CARD - O EFEITO ALAVANCA */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 shadow-2xl p-8 sm:p-10"
      >
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 size-96 bg-blue-600/30 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 size-80 bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row gap-10 items-center justify-between">
          
          {/* Rating Section */}
          <div className="flex items-center gap-6 w-full lg:w-auto">
            <div className="size-24 rounded-full bg-slate-800/80 border-2 border-slate-700 flex items-center justify-center shrink-0 shadow-inner relative">
              <svg className="absolute inset-0 size-full -rotate-90">
                <circle cx="48" cy="48" r="44" fill="none" stroke="#334155" strokeWidth="8" />
                <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="276" strokeDashoffset={276 - (276 * ratingSimulado) / 1000} className={`${ratingClass} opacity-80`} strokeLinecap="round" />
              </svg>
              <div className="flex flex-col items-center">
                <span className={`text-2xl font-black tracking-tighter ${ratingClass}`}>{ratingSimulado}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Score</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown className={ratingClass} size={20} />
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Rating GSA</h3>
              </div>
              <p className="text-slate-400 text-sm max-w-xs font-medium">
                Sua blindagem no mercado. {saldo > 0 ? "O seu saldo está alavancando ativamente o seu perfil de crédito." : "Adicione saldo para acelerar sua reputação e serviços."}
              </p>
            </div>
          </div>

          {/* Wallet Balance Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-6 w-full lg:w-auto flex flex-col gap-4">
            <div className="flex justify-between items-start gap-12">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                  <WalletIcon size={12} /> Saldo de Alavancagem
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white tracking-tighter">{formatCurrency(saldo)}</span>
                </div>
              </div>
              <div className="size-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Zap size={20} />
              </div>
            </div>

            <button 
              onClick={() => {
                // Aqui seria o gatilho para modal de recarga/pagamento, usando router ou handler custom.
                Swal.fire({
                  title: 'Acelere seu Rating',
                  text: 'A funcionalidade de recarga via PIX estará disponível na Vitrine.',
                  icon: 'info',
                  background: '#0a0a2e',
                  color: '#fff',
                  confirmButtonColor: '#2563eb'
                })
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-600/20 flex justify-center items-center gap-2"
            >
              <TrendingUp size={16} /> Aumentar Limite de Crédito
            </button>
          </div>

        </div>
      </motion.div>

      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-3">
            <ClipboardList className="text-blue-600" size={32} />
            Meus Processos
          </h2>
          <p className="text-slate-500 font-medium mt-1">Acompanhe o andamento de todos os seus serviços contratados.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
          {(['todos', 'ativos', 'concluidos'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeFilter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'ativos' ? 'Em Andamento' : 'Concluídos'}
            </button>
          ))}
        </div>
      </div>

      {/* RECOVERY SECTION: TIRAR O NOME DO VERMELHO */}
      {pendencies.length > 0 || processes.some(p => p.dados_faltantes?.length > 0 || p.pendencias_iniciais?.length > 0) ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative bg-gradient-to-br from-[#0B0F19] to-[#020617] rounded-[3rem] border border-rose-900/50 p-8 sm:p-12 shadow-[0_20px_50px_rgba(225,29,72,0.15)] overflow-hidden group"
        >
          {/* Animated Glow Elements */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-rose-600/20 blur-[100px] rounded-full pointer-events-none transform translate-x-1/3 -translate-y-1/3 group-hover:bg-rose-600/30 transition-all duration-1000"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-orange-600/10 blur-[80px] rounded-full pointer-events-none transform -translate-x-1/3 translate-y-1/3"></div>

          <div className="absolute top-0 right-0 -mr-16 -mt-16 text-rose-500/10 pointer-events-none z-0">
            <Flame size={250} />
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-1 space-y-5 text-center lg:text-left">
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(225,29,72,0.2)]"
              >
                <AlertCircle size={14} className="animate-pulse" /> Ação Requerida Imediata
              </motion.div>
              <h2 className="text-4xl sm:text-5xl font-black text-white uppercase italic tracking-tighter leading-none">
                Tire seu nome do <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">Vermelho</span>
              </h2>
              <p className="text-slate-400 font-medium max-w-lg text-sm sm:text-base">
                Você possui pendências que estão <strong className="text-rose-400">travando a sua evolução</strong> no mercado. Resolver isso agora fará o seu Rating GSA disparar, liberando novos limites.
              </p>
            </div>

            {/* Termômetro Gamificado */}
            <div className="w-full max-w-md bg-[#0F172A] rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-900/20 pointer-events-none"></div>
               
              <div className="flex justify-between items-end mb-6 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Projeção de Rating</p>
                  <p className="text-3xl font-black text-emerald-400 flex items-center gap-2 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                    <Activity size={28} /> +125 PTS
                  </p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-1">
                    <TrendingUp size={16} />
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ao resolver</p>
                </div>
              </div>
              
              <div className="relative h-6 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5 z-10 shadow-inner">
                {/* Current State (Red) */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "33%" }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="absolute top-0.5 left-0.5 bottom-0.5 bg-gradient-to-r from-rose-600 to-rose-400 rounded-full flex items-center justify-end px-3 shadow-[0_0_15px_rgba(225,29,72,0.5)] z-20"
                >
                   <span className="text-[9px] font-black text-white drop-shadow-md">ATUAL</span>
                </motion.div>
                
                {/* Projected increase (Pulse Green) */}
                <motion.div 
                   animate={{ opacity: [0.3, 0.7, 0.3] }}
                   transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                   className="absolute top-0.5 left-[33%] bottom-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400 w-1/2 rounded-r-full z-10"
                   style={{ maskImage: 'linear-gradient(to right, rgba(0,0,0,1), rgba(0,0,0,0))', WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1), rgba(0,0,0,0))' }}
                ></motion.div>

                {/* Markers */}
                <div className="absolute top-0 bottom-0 left-1/3 w-px bg-rose-400/50 z-30"></div>
                <div className="absolute top-0 bottom-0 right-1/6 w-px bg-emerald-400/50 z-30 border-dashed"></div>
              </div>
              
              <div className="flex justify-between mt-3 text-[9px] font-black uppercase tracking-widest z-10 relative">
                <span className="text-rose-500">Risco Alto</span>
                <span className="text-emerald-500">Crédito Liberado</span>
              </div>

              <button 
                onClick={() => document.getElementById('processes-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="relative w-full mt-8 bg-gradient-to-r from-rose-600 to-orange-500 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:from-rose-500 hover:to-orange-400 transition-all shadow-[0_0_30px_rgba(225,29,72,0.3)] hover:shadow-[0_0_40px_rgba(225,29,72,0.5)] flex items-center justify-center gap-2 group z-10 overflow-hidden"
              >
                <span className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12"></span>
                Atuar nas Pendências Agora <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}

      <div id="processes-section" className="space-y-6">
        {filteredProcesses.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {filteredProcesses.map((process) => (
              <ProcessCard 
                key={process.id} 
                process={process} 
                onResolve={() => setShowSmartFicha(process.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center space-y-4">
            <div className="size-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
              <Package size={40} />
            </div>
            <div className="max-w-xs mx-auto">
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Nenhum processo encontrado</h3>
              <p className="text-slate-500 text-sm font-medium">
                Você ainda não possui processos {activeFilter !== 'todos' ? 'nesta categoria' : 'ativos'}. 
                Visite nossa vitrine para conhecer nossos serviços!
              </p>
            </div>
            <button className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
              Explorar Vitrine
            </button>
          </div>
        )}
      </div>

      {/* SHOWCASE LEADS (PEDIDOS DE ORÇAMENTO) */}
      {showcaseLeads.length > 0 && (
        <div className="space-y-8 pt-8 border-t border-slate-100">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-3">
              <Search className="text-indigo-600" size={28} />
              Pedidos de Orçamento
            </h2>
            <p className="text-slate-500 font-medium mt-1">Serviços que você demonstrou interesse na vitrine.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {showcaseLeads.map((lead) => (
              <LeadCard 
                key={lead.id} 
                lead={lead} 
                onAccept={() => handleAcceptProposal(lead)}
                onReject={() => handleRejectProposal(lead)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal SmartFicha */}
      <AnimatePresence>
        {showSmartFicha && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative border border-slate-100 dark:border-slate-800"
            >
              <button 
                onClick={() => setShowSmartFicha(null)}
                className="absolute top-6 right-6 z-50 size-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 transition-all"
              >
                <ChevronRight size={20} className="rotate-45" />
              </button>

              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center gap-4">
                <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Resolver Pendências</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complete as informações para o seu processo</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <SmartFicha 
                  processos={processes.filter(p => p.id === showSmartFicha)} 
                  clienteDados={profile} 
                  onUpdate={() => {
                    setShowSmartFicha(null);
                    // O pai deve atualizar os processos se necessário
                  }} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProcessCard = ({ process, onResolve }: { process: any, onResolve: () => void }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Cancelado': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Pendente': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  const getProgressWidth = (status: string) => {
    switch (status) {
      case 'Pendente': return '15%';
      case 'Aguardando Documentação': return '30%';
      case 'Em Análise': return '50%';
      case 'Protocolado': return '70%';
      case 'Em Andamento': return '85%';
      case 'Concluído': return '100%';
      default: return '15%';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group"
    >
      <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center">
        <div className="size-16 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform">
          <FileText size={32} />
        </div>
        
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo: {process.protocolo}</span>
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(process.status_atual)}`}>
              {process.status_atual}
            </span>
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">{process.servico_nome}</h3>
          <div className="flex items-center gap-4 text-slate-500 text-xs font-bold">
            <span className="flex items-center gap-1.5"><Clock size={14} /> Atualizado em {process.data_venda?.toDate().toLocaleDateString('pt-BR')}</span>
            <span className="flex items-center gap-1.5"><User size={14} className="size-3.5" /> Especialista: {process.vendedor_nome}</span>
          </div>

          {(process.status_atual === 'Pendente' || process.status_atual === 'Aguardando Documentação') && 
           ((process.dados_faltantes && process.dados_faltantes.length > 0) || 
            (process.pendencias_iniciais && process.pendencias_iniciais.length > 0)) && (
            <button 
              onClick={onResolve}
              className="mt-2 w-full md:w-auto bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <ClipboardList size={14} /> Resolver Pendências
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none px-6 py-3 bg-slate-50 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
            Ver Detalhes
          </button>
          <button className="size-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      
      {/* Progress Bar Dinâmica */}
      <div className="h-1.5 w-full bg-slate-50 flex">
        <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: getProgressWidth(process.status_atual) }}></div>
      </div>
    </motion.div>
  );
};

const LeadCard = ({ lead, onAccept, onReject }: { lead: any, onAccept: () => void, onReject: () => void }) => {
  const getStatusInfo = (status: LeadStatus) => {
    switch (status) {
      case 'Novo': return { color: 'bg-blue-50 text-blue-600', icon: Clock, label: 'Aguardando Análise' };
      case 'Proposta Enviada': return { color: 'bg-indigo-50 text-indigo-600', icon: FileText, label: 'Proposta Disponível' };
      case 'Negociação': return { color: 'bg-amber-50 text-amber-600', icon: MessageSquare, label: 'Em Negociação' };
      case 'Venda Concluída': return { color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2, label: 'Venda Concluída' };
      case 'Rejeitado Cliente': return { color: 'bg-rose-50 text-rose-600', icon: AlertCircle, label: 'Proposta Recusada' };
      default: return { color: 'bg-slate-50 text-slate-600', icon: AlertCircle, label: status };
    }
  };

  const statusInfo = getStatusInfo(lead.status);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-6 shadow-sm hover:border-indigo-200 transition-all">
      <div className="flex justify-between items-start">
        <div className={`px-4 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${statusInfo.color}`}>
          <statusInfo.icon size={14} />
          {statusInfo.label}
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{lead.timestamp?.toDate().toLocaleDateString('pt-BR')}</span>
      </div>

      <div>
        <h4 className="text-lg font-black text-slate-800 uppercase italic tracking-tight leading-tight">{lead.servico_nome}</h4>
        <p className="text-slate-500 text-xs font-medium mt-1">Solicitado via Vitrine GSA</p>
      </div>

      {lead.status === 'Proposta Enviada' && lead.proposta && (
        <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 space-y-3">
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Oferta Exclusiva</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800 tracking-tighter">{lead.proposta.valorAVistaPara}</span>
            <span className="text-xs text-slate-400 line-through font-bold">{lead.proposta.valorAVistaDe}</span>
          </div>
          <p className="text-[10px] font-bold text-slate-500 italic">Ou {lead.proposta.parcelas}x de {lead.proposta.valorParcela}</p>
          
          <div className="flex gap-2 pt-2">
            <button 
              onClick={onAccept}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              Aceitar Proposta
            </button>
            <button 
              onClick={onReject}
              className="px-4 py-3 bg-white text-rose-600 border border-rose-100 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-50 transition-all"
            >
              Recusar
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">
            {lead.vendedor_nome?.charAt(0)}
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Especialista: {lead.vendedor_nome}</span>
        </div>
        <button className="text-indigo-600 font-black uppercase text-[10px] tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
          Detalhes <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

const User = ({ className, size }: { className?: string, size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
