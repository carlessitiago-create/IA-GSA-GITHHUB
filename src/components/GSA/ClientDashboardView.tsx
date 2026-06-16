import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Wallet, 
  ListOrdered, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  getOrCreateWallet, 
  listarHistorico, 
  Wallet as WalletType, 
  FinancialTransaction 
} from '../../services/financialService';
import { 
  listarProcessosCliente, 
  OrderProcess 
} from '../../services/orderService';

export const ClientDashboardView: React.FC = () => {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [processes, setProcesses] = useState<OrderProcess[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [w, t, p] = await Promise.all([
          getOrCreateWallet(profile.uid),
          listarHistorico(profile.uid),
          listarProcessosCliente(profile.uid, profile.cpf)
        ]);
        setWallet(w);
        setTransactions(t.slice(0, 5)); // Recent 5
        setProcesses(p);
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído': return 'text-emerald-500 bg-emerald-50';
      case 'Pendente': return 'text-amber-500 bg-amber-50';
      default: return 'text-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-3xl font-black text-[#0a0a2e] uppercase italic mb-8">Dashboard Cliente</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0a0a2e] text-white p-6 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-lg">
            <Wallet className="text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-blue-300">Saldo Wallet</p>
            <p className="text-xl font-black">{formatCurrency(wallet?.saldo_atual || 0)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg">
            <ListOrdered className="text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-slate-400">Processos Ativos</p>
            <p className="text-xl font-black text-slate-800">{processes.filter(p => p.status_atual !== 'Concluído').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg">
            <CheckCircle className="text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-slate-400">Concluídos</p>
            <p className="text-xl font-black text-slate-800">{processes.filter(p => p.status_atual === 'Concluído').length}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-black text-[#0a0a2e] mb-6 flex items-center gap-2">
            <Clock size={20} /> Últimos Processos
          </h3>
          <div className="space-y-3">
            {processes.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 border rounded-xl">
                <div>
                  <p className="text-sm font-black text-slate-800">{p.servico_nome}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400">{p.protocolo}</p>
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded ${getStatusColor(p.status_atual)}`}>
                  {p.status_atual}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-black text-[#0a0a2e] mb-6 flex items-center gap-2">
            <TrendingUp size={20} /> Movimentações Recentes
          </h3>
          <div className="space-y-3">
             {transactions.map(t => (
               <div key={t.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50">
                 <div>
                   <p className="text-sm font-black text-slate-800">{t.descricao}</p>
                 </div>
                 <p className={`font-black ${t.tipo === 'CREDITO' ? 'text-emerald-600' : 'text-rose-600'}`}>
                   {t.tipo === 'CREDITO' ? '+' : '-'} {formatCurrency(Math.abs(t.valor))}
                 </p>
               </div>
             ))}
          </div>
        </section>
      </div>
    </div>
  );
};
