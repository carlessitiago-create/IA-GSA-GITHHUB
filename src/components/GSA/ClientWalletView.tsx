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
          title: '<span class="text-emerald-400 font-black italic uppercase tracking-tighter text-2xl">PIX Gerado</span>',
          background: '#0B0F19',
          color: '#fff',
          html: `
            <div class="space-y-6 py-4">
              <div class="flex flex-col items-center gap-4 relative">
                <div class="absolute inset-0 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                <div class="p-4 bg-white rounded-3xl border-4 border-emerald-500/20 shadow-[0_0_40px_rgba(52,211,153,0.3)] relative z-10 transition-transform hover:scale-105 duration-300">
                  <img src="${pixResult.qr_code_base64}" alt="QR Code PIX" style="width: 200px; height: 200px;" />
                </div>
                <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] text-center mt-2 flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.3 7H6"/><path d="M3 11h3"/><path d="M3 15h3"/><path d="M8 15h3"/><path d="M8 11h3"/><path d="M8 7h3"/><path d="M13 7h3"/><path d="M13 11h3"/><path d="M18 7h3"/><path d="M18 11h3"/><path d="M21 15h-3"/><path d="M21 19h-3"/><path d="M13 19h3"/><path d="M8 19h3"/><path d="M3 19h3"/></svg>
                   Escaneie para investir saldo
                </p>
              </div>
              
              <div class="space-y-2 relative z-10">
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Ou use o Código Copia e Cola</p>
                <div class="flex items-center gap-2 bg-[#020617] p-2 rounded-xl border border-emerald-900/40">
                  <input id="wallet-pix-copy" class="text-[10px] font-mono text-emerald-100 truncate w-full bg-transparent border-none outline-none pl-2" value="${pixResult.copy_paste}" readonly />
                  <button onclick="document.getElementById('wallet-pix-copy').select(); document.execCommand('copy');" class="bg-emerald-500 hover:bg-emerald-400 text-[#0a0a2e] p-3 rounded-lg font-black uppercase text-[10px] transition-colors shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                    COPIAR
                  </button>
                </div>
              </div>

              <div class="bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-4 relative z-10">
                <div class="size-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div class="text-left">
                    <p class="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-tight">Checkout Segurado SSL</p>
                    <p class="text-[10px] font-medium text-slate-300 mt-0.5">Seu saldo entra automaticamente via ${pixResult.gateway}.</p>
                </div>
              </div>
            </div>
          `,
          confirmButtonText: 'FECHAR E AGUARDAR O PIX',
          confirmButtonColor: '#020617',
          customClass: {
             confirmButton: 'border border-slate-700 shadow-xl'
          }
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

            <div className="flex flex-col gap-4 mt-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleAddBalance}
                  className="bg-emerald-400 hover:bg-emerald-300 text-[#0a0a2e] px-8 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all font-black uppercase text-[11px] tracking-widest shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] active:scale-95 group relative overflow-hidden"
                >
                  <span className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12"></span>
                  <Zap size={16} className="text-[#0a0a2e]" /> Recarga com PIX
                </button>
              </div>
              <div className="flex items-center gap-3">
                 <div className="h-6 px-3 bg-white/10 rounded-full flex items-center justify-center gap-1.5 border border-white/5">
                    <ShieldCheck size={12} className="text-emerald-400" />
                    <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">SSL / 256-bit</span>
                 </div>
                 <div className="h-6 px-3 bg-white/10 rounded-full flex items-center justify-center border border-white/5">
                    <span className="text-[9px] font-black text-emerald-400/80 uppercase tracking-widest">Checkout Segurado</span>
                 </div>
              </div>
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
