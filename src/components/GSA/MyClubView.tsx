import React, { useState, useEffect } from 'react';
import { formatDate } from '../../lib/dateUtils';
import { 
  Trophy, 
  Gift, 
  TrendingUp, 
  History, 
  CheckCircle, 
  Star,
  Zap,
  Award,
  ChevronRight,
  Clock
} from 'lucide-react';
import { 
  getClubRewards, 
  getPointHistory, 
  redeemReward,
  ClubReward,
  PointTransaction
} from '../../services/pointsService';
import { useAuth } from '../AuthContext';
import Swal from 'sweetalert2';
import { motion } from 'motion/react';
import { transformImageUrl } from '../../utils/imageUtils';

export const MyClubView: React.FC = () => {
  const { profile } = useAuth();
  const [rewards, setRewards] = useState<ClubReward[]>([]);
  const [history, setHistory] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');

  useEffect(() => {
    if (profile?.uid) {
      loadData();
    } else if (profile === null) {
      setIsLoading(false);
    }
  }, [profile?.uid, profile]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rewardsData, historyData] = await Promise.all([
        getClubRewards(),
        getPointHistory(profile!.uid)
      ]);
      setRewards(rewardsData);
      setHistory(historyData as PointTransaction[]);
    } catch (error) {
      console.error('Erro ao carregar dados do clube:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async (reward: ClubReward) => {
    if (!profile?.saldo_pontos || profile.saldo_pontos < reward.pontos) {
      Swal.fire('Saldo Insuficiente', `Você precisa de ${reward.pontos} pontos para este prêmio.`, 'warning');
      return;
    }

    const result = await Swal.fire({
      title: 'Resgatar Prêmio?',
      text: `Você deseja trocar ${reward.pontos} pontos por ${reward.nome}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, resgatar!',
      cancelButtonText: 'Agora não'
    });

    if (result.isConfirmed) {
      try {
        await redeemReward(profile.uid, reward);
        Swal.fire('Sucesso!', 'Seu resgate foi solicitado. Em breve entraremos em contato.', 'success');
        loadData();
      } catch (error: any) {
        Swal.fire('Erro', error.message || 'Não foi possível realizar o resgate.', 'error');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const saldo = profile?.saldo_pontos || 0;
  const nextReward = rewards
    .filter(r => r.pontos > saldo)
    .sort((a, b) => a.pontos - b.pontos)[0];

  const progressPercent = nextReward 
    ? Math.min(100, (saldo / nextReward.pontos) * 100)
    : 100;

  return (
    <div className="space-y-8">
      {/* Header com Saldo e Progresso */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-400 rounded-lg">
                <Trophy className="text-black" size={24} />
              </div>
              <h2 className="text-xl font-bold">Meu Clube GSA</h2>
            </div>
            
            <div className="flex items-end gap-2 mb-8">
              <span className="text-6xl font-black tracking-tighter">{saldo}</span>
              <span className="text-xl font-bold text-yellow-400 mb-2 uppercase tracking-widest">Pontos</span>
            </div>

            {nextReward && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-bold uppercase tracking-wider">
                  <span className="text-gray-400">Próximo Objetivo: {nextReward.nome}</span>
                  <span className="text-yellow-400">{saldo} / {nextReward.pontos}</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    className="h-full bg-yellow-400"
                  />
                </div>
                <p className="text-xs text-gray-400 italic">Faltam {nextReward.pontos - saldo} pontos para você conquistar este prêmio!</p>
              </div>
            )}
          </div>
          
          {/* Background Decorativo */}
          <div className="absolute -right-20 -bottom-20 opacity-10">
            <Trophy size={300} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Como ganhar mais?</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Indique Amigos</p>
                <p className="text-xs text-gray-500">Ganhe 100 pts por indicação convertida.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="p-3 bg-green-50 rounded-2xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Pagamento em Dia</p>
                <p className="text-xs text-gray-500">Ganhe 20 pts por cada fatura paga.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Award size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Conclua Serviços</p>
                <p className="text-xs text-gray-500">Cada serviço concluído gera pontos extras.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-100">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-4 px-2 font-bold text-sm uppercase tracking-widest transition-colors relative ${
            activeTab === 'catalog' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Catálogo de Prêmios
          {activeTab === 'catalog' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 px-2 font-bold text-sm uppercase tracking-widest transition-colors relative ${
            activeTab === 'history' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Extrato de Pontos
          {activeTab === 'history' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900" />
          )}
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {rewards.map((reward) => (
            <div key={reward.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="h-40 sm:h-48 bg-gray-100 relative overflow-hidden">
                {reward.foto ? (
                  <img src={transformImageUrl(reward.foto)} alt={reward.nome} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Gift size={48} />
                  </div>
                )}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1 rounded-full text-[10px] font-black shadow-sm">
                  {reward.pontos} PTS
                </div>
              </div>
              <div className="p-4 sm:p-6 flex-1 flex flex-col">
                <h3 className="font-black text-gray-900 mb-2 uppercase tracking-tight text-sm sm:text-base">{reward.nome}</h3>
                
                <button
                  onClick={() => handleRedeem(reward)}
                  disabled={saldo < reward.pontos}
                  className={`mt-auto w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    saldo >= reward.pontos
                      ? 'bg-gray-900 text-white hover:bg-black shadow-lg shadow-gray-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {saldo >= reward.pontos ? 'Resgatar Agora' : 'Pontos Insuficientes'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-3">
            {history.map((tx) => (
              <div key={tx.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {tx.data?.toDate ? formatDate(tx.data.toDate()) : 'Recent'}
                  </p>
                  <p className="text-sm font-bold text-gray-800 leading-tight">{tx.motivo}</p>
                  <span className={`w-fit px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    tx.tipo === 'GANHO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {tx.tipo}
                  </span>
                </div>
                <div className={`text-right shrink-0 font-black text-base ${
                  tx.tipo === 'GANHO' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.tipo === 'GANHO' ? '+' : ''}{tx.quantidade}
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center text-gray-400 italic text-sm">
                Nenhuma movimentação encontrada.
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
              <table className="w-full min-w-[800px] text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Data</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Descrição</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {tx.data?.toDate ? formatDate(tx.data.toDate()) : 'Recent'}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-800">{tx.motivo}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          tx.tipo === 'GANHO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.tipo}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-black text-right ${
                        tx.tipo === 'GANHO' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.tipo === 'GANHO' ? '+' : ''}{tx.quantidade}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                        Nenhuma movimentação de pontos encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
