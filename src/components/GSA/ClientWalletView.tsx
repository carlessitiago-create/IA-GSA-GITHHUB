import React, { useEffect, useState } from 'react';
import { 
  Wallet, 
  FinancialTransaction, 
  getOrCreateWallet, 
  listarHistorico 
} from '../../services/financialService';
import { useAuth } from '../AuthContext';
import { 
  Wallet as WalletIcon, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft,
  ShieldCheck,
  Gift,
  Calendar,
  AlertCircle,
  PlusCircle,
  QrCode,
  Copy,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';
import { gerarPagamentoPixGateway, processarVenda } from '../../services/vendaService';

export const ClientWalletView: React.FC = () => {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletData = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const w = await getOrCreateWallet(profile.uid);
        setWallet(w);
        const t = await listarHistorico(profile.uid);
        setTransactions(t);
      } catch (error) {
        console.error('Erro ao carregar carteira:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWalletData();
  }, [profile]);

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleAddBalance = async () => {
    if (!profile) return;

    const { value: amount } = await Swal.fire({
      title: 'Adicionar Saldo',
      text: 'Quanto você deseja recarregar via PIX?',
      input: 'number',
      inputLabel: 'Valor em R$',
      inputPlaceholder: 'Ex: 100.00',
      confirmButtonText: 'Gerar PIX',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      inputValidator: (value) => {
        if (!value || Number(value) < 10) {
          return 'O valor mínimo é R$ 10,00';
        }
      }
    });

    if (amount) {
      setLoading(true);
      try {
        const valor = Number(amount);
        
        // 1. Criar a venda de Recarga
        const result = await processarVenda(
          profile.uid,
          [{
            servicoId: 'RECARGA_CARTEIRA',
            servicoNome: 'Recarga de Saldo',
            precoBase: valor,
            precoVenda: valor,
            prazoEstimadoDias: 0
          }],
          'PIX',
          undefined,
          profile.nome_completo,
          profile.cpf || '00000000000',
          '2000-01-01'
        );

        // 2. Marcar venda como RECARGA (para o webhook saber o que fazer)
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../../firebase');
        await updateDoc(doc(db, 'sales', result.saleId), {
           tipo_venda: 'RECARGA',
           cliente_id: profile.uid
        });

        // 3. Gerar Pagamento Real
        const pixResult = await gerarPagamentoPixGateway({
          valor,
          descricao: `Recarga de Saldo GSA - ${profile.nome_completo}`,
          email: profile.email || 'financeiro@gsa.io',
          nome: profile.nome_completo,
          cpf: profile.cpf || '00000000000',
          clienteId: profile.uid,
          vendaId: result.saleId
        });

        // 4. Mostrar QR Code
        await Swal.fire({
          title: 'PIX Gerado com Sucesso!',
          html: `
            <div class="space-y-6 py-4">
              <div class="flex flex-col items-center gap-4">
                <p class="text-xs text-slate-500 font-bold uppercase tracking-widest text-center">Escaneie o QR Code abaixo</p>
                <div class="p-4 bg-white rounded-3xl border-2 border-slate-100 shadow-xl">
                  <img src="${pixResult.qr_code_base64}" alt="QR Code PIX" style="width: 180px; height: 180px;" />
                </div>
              </div>
              
              <div class="space-y-2">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ou copie o código abaixo</p>
                <div class="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <input id="wallet-pix-copy" class="text-[10px] font-mono text-slate-600 truncate w-full bg-transparent border-none outline-none" value="${pixResult.copy_paste}" readonly />
                  <button onclick="document.getElementById('wallet-pix-copy').select(); document.execCommand('copy');" class="bg-[#0a0a2e] text-white p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>
                </div>
              </div>

              <div class="bg-blue-50 p-4 rounded-2xl flex items-center gap-3">
                <div class="size-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.89 14 3.5l-2.3 8.1 8.3-1.1-10 11.4 2.3-8.1-8.3 1.1z"/></svg>
                </div>
                <p class="text-[10px] font-black text-blue-700 uppercase tracking-widest text-left">Seu saldo será atualizado automaticamente após a confirmação do pagamento via ${pixResult.gateway}.</p>
              </div>
            </div>
          `,
          confirmButtonText: 'ENTENDIDO',
          confirmButtonColor: '#0a0a2e'
        });

      } catch (err: any) {
        console.error("Erro ao adicionar saldo:", err);
        Swal.fire('Erro', 'Não foi possível gerar o PIX de recarga. Tente novamente mais tarde.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-10 pb-24">
      {/* HEADER DE SEÇÃO */}
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Minha Carteira</h2>
        <p className="text-slate-500 font-medium text-sm">Gestão transparente de saldos, bônus e transações seguras.</p>
      </div>

      {/* CARDS DE SALDO (Layout 4.0) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-[#0a0a2e] rounded-[3rem] p-10 shadow-2xl shadow-blue-900/20 group"
        >
          {/* Abstract background elements */}
          <div className="absolute -right-10 -top-10 size-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />
          <div className="absolute -left-10 -bottom-10 size-48 bg-emerald-500/5 rounded-full blur-2xl" />
          
          <div className="relative z-10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <WalletIcon size={20} className="text-blue-400" />
                </div>
                <span className="text-[11px] font-black text-blue-200 uppercase tracking-[0.2em]">Saldo Disponível</span>
              </div>
              <ShieldCheck size={24} className="text-emerald-400 opacity-50" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-5xl md:text-6xl font-black italic text-white tracking-tighter">
                {formatCurrency(wallet?.saldo_atual || 0)}
              </h3>
              <p className="text-[10px] font-bold text-blue-300/50 uppercase tracking-widest">Atualizado em tempo real</p>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={handleAddBalance}
                className="bg-emerald-500 hover:bg-emerald-600 text-[#0a0a2e] px-6 py-2.5 rounded-2xl flex items-center gap-2 transition-all font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                <PlusCircle size={16} /> Adicionar Saldo
              </button>
              <button className="text-[10px] font-black text-white/50 uppercase tracking-widest hover:text-white transition-colors">
                Ver Detalhes
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100 group"
        >
          <div className="absolute -right-10 -top-10 size-64 bg-amber-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Gift size={20} className="text-amber-500" />
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">GSA Club Bônus</span>
              </div>
              <TrendingUp size={24} className="text-amber-400 opacity-30" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-5xl md:text-6xl font-black italic text-amber-500 tracking-tighter">
                {formatCurrency(wallet?.saldo_bonus || 0)}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Créditos para novos serviços</p>
            </div>

            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed max-w-[240px]">
              Utilize seu saldo de bônus para abater parcelas ou contratar novos serviços na vitrine.
            </p>
          </div>
        </motion.div>
      </div>

      {/* HISTÓRICO DE TRANSAÇÕES (Layout 4.0) */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-[#0a0a2e] rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-white" />
            </div>
            <h3 className="text-[11px] font-black text-[#0a0a2e] uppercase tracking-[0.2em]">Extrato Detalhado</h3>
          </div>
          <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">
            Exportar PDF
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-[3rem] p-20 text-center flex flex-col items-center shadow-sm">
            <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Clock className="text-slate-300" size={40} />
            </div>
            <p className="text-slate-400 font-black uppercase tracking-tight text-lg">Nenhuma transação registrada</p>
            <p className="text-[10px] text-slate-500 uppercase mt-2 font-bold tracking-widest">Seu histórico financeiro aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t, idx) => (
              <motion.div 
                key={t.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center justify-between group hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-5">
                  <div className={`size-14 rounded-2xl flex items-center justify-center shadow-sm ${
                    t.tipo === 'CREDITO' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {t.tipo === 'CREDITO' ? <ArrowDownLeft size={28} /> : <ArrowUpRight size={28} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">
                        {t.origem.replace('_', ' ')}
                      </span>
                      {!t.confirmado_pelo_administrador && (
                        <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-amber-100">
                          Aguardando Confirmação
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-black text-[#0a0a2e] uppercase tracking-tight leading-tight">{t.descricao}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1">
                      <Calendar size={10} />
                      {t.timestamp?.toDate().toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-2xl font-black italic tracking-tighter ${
                    t.tipo === 'CREDITO' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {t.tipo === 'CREDITO' ? '+' : '-'} {formatCurrency(Math.abs(t.valor))}
                  </p>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">
                    REF: {t.id?.slice(-8).toUpperCase()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
