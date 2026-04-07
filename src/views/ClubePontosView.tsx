import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Trophy, 
  Star, 
  Award, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Zap,
  ArrowRight,
  Info,
  Wallet,
  History,
  UserPlus,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getPointsRules, getClubRewards, getPointHistory, redeemReward } from '../services/pointsService';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { transformImageUrl } from '../utils/imageUtils';

export function ClubePontosView() {
  const { profile, refreshProfile } = useAuth();
  const [rewards, setRewards] = useState<any[]>([]);
  const [rules, setRules] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'premios' | 'historico'>('premios');
  const navigate = useNavigate();

  const fetchData = async () => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }
    try {
      const [rewardsData, rulesData, historyData] = await Promise.all([
        getClubRewards(),
        getPointsRules(),
        getPointHistory(profile.uid)
      ]);
      setRewards(rewardsData);
      setRules(rulesData);
      setHistory(historyData);
    } catch (error) {
      console.error("Erro ao carregar dados do clube:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile?.uid]);

  const handleRedeem = async (reward: any) => {
    if (!profile?.uid) return;
    
    const result = await Swal.fire({
      title: 'Resgatar Prêmio?',
      text: `Você deseja trocar ${reward.pontos} pontos por: ${reward.nome}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, Resgatar!',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3b82f6',
      background: '#12122b',
      color: '#fff'
    });

    if (result.isConfirmed) {
      try {
        await redeemReward(profile.uid, reward);
        
        Swal.fire({
          title: 'Resgate Solicitado!',
          text: 'Seu pedido foi enviado para análise. Em breve entraremos em contato para a entrega.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          background: '#12122b',
          color: '#fff'
        });
        
        // Refresh history and profile points
        await Promise.all([
          refreshProfile(),
          fetchData()
        ]);
      } catch (error: any) {
        Swal.fire('Erro', error.message || 'Não foi possível realizar o resgate.', 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER / SALDO */}
      <section className="relative bg-[#0a0a2e] rounded-[2.5rem] sm:rounded-[3.5rem] p-8 sm:p-12 overflow-hidden shadow-2xl shadow-blue-900/20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 px-4 py-1.5 rounded-full">
              <Star className="text-blue-400 size-4 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Clube de Pontos GSA</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black italic uppercase text-white tracking-tighter leading-none">
              Seu Saldo de <br/>
              <span className="text-blue-400">Vantagens.</span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-md font-medium opacity-80">
              Acumule pontos e troque por prêmios exclusivos. Quanto mais você interage, mais você ganha.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-[2.5rem] flex flex-col items-center justify-center min-w-[240px] shadow-2xl">
            <div className="size-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/40">
              <Trophy className="text-white size-8" />
            </div>
            <p className="text-[10px] font-black text-blue-300 uppercase tracking-[0.3em] mb-1">Pontos Disponíveis</p>
            <p className="text-5xl font-black text-white tracking-tighter italic">
              {profile?.saldo_pontos || 0}
            </p>
            <div className="mt-4 flex items-center gap-2 text-emerald-400">
              <TrendingUp size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">Crescendo 12% este mês</span>
            </div>
          </div>
        </div>
        
        {/* Background Decoration */}
        <Award className="absolute -right-20 -bottom-20 text-white/5 size-80 rotate-12 pointer-events-none" />
      </section>

      {/* TABS DE NAVEGAÇÃO INTERNA */}
      <div className="flex items-center gap-4 p-1.5 bg-slate-100 rounded-2xl w-fit mx-auto sm:mx-0">
        <button 
          onClick={() => setActiveSubTab('premios')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'premios' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Vitrine de Prêmios
        </button>
        <button 
          onClick={() => setActiveSubTab('historico')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'historico' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Extrato de Pontos
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'premios' ? (
          <motion.div 
            key="premios"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            {/* GRID DE PRÊMIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rewards.length > 0 ? rewards
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                .map((reward, idx) => (
                <div 
                  key={reward.id}
                  className={`group bg-white rounded-[2.5rem] p-5 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col ${reward.status === 'esgotado' ? 'opacity-75 grayscale-[0.5]' : ''}`}
                >
                  <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6 shadow-inner bg-slate-50">
                    <img 
                      src={transformImageUrl(reward.foto || 'https://picsum.photos/seed/gift/400/400')} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      alt={reward.nome}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      <div className="bg-[#0a0a2e]/80 backdrop-blur-md text-white px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2 w-fit">
                        <Zap size={12} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{reward.pontos} PTS</span>
                      </div>
                      
                      {reward.status === 'esgotado' && (
                        <div className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20 w-fit">
                          Esgotado
                        </div>
                      )}
                      
                      {reward.status === 'ultimas_unidades' && (
                        <div className="bg-orange-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 animate-pulse w-fit">
                          Últimas Unidades
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-2 space-y-4 flex-1 flex flex-col">
                    <h4 className="text-xl font-black italic uppercase text-[#0a0a2e] tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
                      {reward.nome}
                    </h4>
                    <p className="text-slate-500 text-xs leading-relaxed font-medium flex-1">
                      {reward.status === 'esgotado' 
                        ? 'Este prêmio está temporariamente indisponível. Fique atento para a reposição de estoque!'
                        : 'Resgate este prêmio exclusivo utilizando seus pontos acumulados no Clube GSA.'}
                    </p>
                    <button 
                      onClick={() => handleRedeem(reward)}
                      disabled={(profile?.saldo_pontos || 0) < reward.pontos || reward.status === 'esgotado'}
                      className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                        (profile?.saldo_pontos || 0) >= reward.pontos && reward.status !== 'esgotado'
                          ? 'bg-[#0a0a2e] text-white shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {reward.status === 'esgotado' ? (
                        <>Indisponível</>
                      ) : (profile?.saldo_pontos || 0) >= reward.pontos ? (
                        <>Resgatar Agora <ArrowRight size={16} /></>
                      ) : (
                        <>Pontos Insuficientes</>
                      )}
                    </button>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="size-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <Gift className="text-slate-300" size={32} />
                  </div>
                  <p className="text-slate-400 font-medium italic">Nenhum prêmio disponível no momento.</p>
                </div>
              )}
            </div>

            {/* REGRAS DE PONTUAÇÃO */}
            <section className="bg-white rounded-[3rem] p-8 sm:p-12 border border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
                <div className="space-y-2 text-center md:text-left">
                  <h3 className="text-2xl font-black italic uppercase text-[#0a0a2e] tracking-tighter">Como Acumular Pontos?</h3>
                  <p className="text-slate-500 text-sm font-medium">Veja todas as formas de turbinar seu saldo no Clube GSA.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                    <CheckCircle2 className="text-emerald-500 size-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Regras Ativas</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: UserPlus, label: 'Indicar Amigo', points: rules?.indicacao || 100, color: 'blue' },
                  { icon: Clock, label: 'Pagamento em Dia', points: rules?.pagamento_dia || 20, color: 'emerald' },
                  { icon: Zap, label: 'Antecipar Fatura', points: rules?.pagamento_antecipado || 50, color: 'amber' },
                  { icon: ShoppingBag, label: 'Contratar Serviço', points: 'Variável', color: 'indigo' }
                ].map((item, i) => (
                  <div key={i} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:border-blue-200 transition-all group text-center">
                    <div className={`size-14 mx-auto rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform`}>
                      <item.icon className={`text-${item.color}-500`} size={24} />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-2xl font-black text-[#0a0a2e] italic uppercase tracking-tight">
                      {typeof item.points === 'number' ? `+${item.points} PTS` : item.points}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div 
            key="historico"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <History className="text-blue-600" size={20} />
                </div>
                <h3 className="text-lg font-black italic uppercase text-[#0a0a2e] tracking-tight">Extrato Detalhado</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimas 50 transações</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.length > 0 ? history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <p className="text-xs font-bold text-slate-600">
                          {item.data?.toDate().toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">
                          {item.data?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight">{item.motivo}</p>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          item.tipo === 'GANHO' ? 'bg-emerald-100 text-emerald-600' : 
                          item.tipo === 'RESGATE' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {item.tipo}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <p className={`text-lg font-black italic ${item.quantidade > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {item.quantidade > 0 ? `+${item.quantidade}` : item.quantidade}
                        </p>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <p className="text-slate-400 font-medium italic">Nenhuma movimentação encontrada.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BANNER INFORMATIVO */}
      <section className="bg-blue-600 rounded-[2.5rem] p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="relative z-10 space-y-4 text-center md:text-left">
          <h3 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">Indique e Ganhe Mais!</h3>
          <p className="opacity-80 text-sm sm:text-base max-w-md font-medium">
            Cada amigo indicado que contratar um serviço GSA garante pontos extras e bônus em dinheiro na sua carteira.
          </p>
          <button 
            onClick={() => navigate('/clube')}
            className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:scale-105 transition-all"
          >
            Começar a Indicar
          </button>
        </div>
        <div className="relative z-10 size-40 sm:size-56 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
          <Gift className="text-white size-20 sm:size-28" />
        </div>
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <Zap size={200} className="text-white" />
        </div>
      </section>
    </div>
  );
}
