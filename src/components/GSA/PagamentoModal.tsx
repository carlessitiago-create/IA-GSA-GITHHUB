import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  QrCode, 
  Wallet, 
  Loader2, 
  CheckCircle2,
  ArrowRight,
  Copy,
  Zap,
  Lock,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { gerarPagamentoAsaasFront, processarVendaSeguraFront } from '../../services/vendaService';
import { pagarComCarteira, getOrCreateWallet } from '../../services/financialService';
import { useAuth } from '../AuthContext';

interface PagamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  amount: number;
  description: string;
  paymentInfo: any;
}

export const PagamentoModal: React.FC<PagamentoModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  amount, 
  description,
  paymentInfo 
}) => {
  const { profile } = useAuth();
  const [method, setMethod] = useState<'PIX' | 'CARTEIRA'>('PIX');
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; copy_paste: string } | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (isOpen && profile?.uid) {
      getOrCreateWallet(profile.uid).then(w => setWalletBalance(w.saldo_atual));
    }
  }, [isOpen, profile?.uid]);

  const handleConfirm = async () => {
    if (!profile?.uid) return Swal.fire('Erro', 'Usuário não autenticado.', 'error');
    if (isNaN(amount) || amount <= 0) return Swal.fire('Erro', 'Valor da venda inválido.', 'error');
    
    setLoading(true);
    try {
      if (method === 'CARTEIRA') {
        if (walletBalance < amount) {
          throw new Error('Saldo insuficiente em carteira.');
        }

        // 1. Criar a venda segura no backend
        const { saleId } = await processarVendaSeguraFront(
          profile.uid,
          paymentInfo.servico_id || 'manual',
          amount,
          'CARTEIRA',
          paymentInfo.is_bulk || false,
          paymentInfo.quantidade || 1
        );

        // 2. Debitar da carteira
        await pagarComCarteira(profile.uid, amount, description, saleId);

        onSuccess({ 
          method: 'CARTEIRA', 
          amount, 
          saleId,
          timestamp: new Date(),
          ...paymentInfo 
        });
      } else {
        // PIX Flow
        // 1. Criar a venda segura no backend primeiro para ter o saleId
        const { saleId } = await processarVendaSeguraFront(
          profile.uid,
          paymentInfo.servico_id || 'manual',
          amount,
          'PIX',
          paymentInfo.is_bulk || false,
          paymentInfo.quantidade || 1
        );

        // 2. Chamar o NOVO gateway Asaas
        const res = await gerarPagamentoAsaasFront({
          valor: amount,
          descricao: description,
          email: profile.email || 'cliente@gsa.com',
          nome: profile.nome_completo || (profile as any).nome || 'Cliente GSA',
          cpf: (profile as any).cpf || '00000000000',
          vendaId: saleId
        });

        // 3. Atualizar o estado para exibir o QR Code
        setPixData({ 
          qr_code: `data:image/png;base64,${res.qr_code_base64}`, // O Asaas manda base64 direto
          copy_paste: res.copy_paste 
        });

        onSuccess({ 
          method: 'PIX', 
          amount, 
          saleId,
          timestamp: new Date(),
          ...paymentInfo 
        });
      }
    } catch (error: any) {
      console.error("Erro no pagamento:", error);
      Swal.fire('Erro', error.message || 'Falha no processamento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.copy_paste) {
      navigator.clipboard.writeText(pixData.copy_paste);
      Swal.fire({
        title: 'Copiado!',
        text: 'Código PIX copiado com sucesso.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[420px] bg-[#0B0F19] border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          {/* Fundo Glow Decorativo */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-600/20 rounded-full blur-[80px] pointer-events-none"></div>

          {/* HEADER */}
          <div className="p-8 relative z-10 border-b border-slate-800/50">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 size-8 flex items-center justify-center rounded-full bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="size-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 border border-blue-500/30">
                <Lock className="text-white" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Checkout Blindado</h3>
                <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck size={10} /> Ambiente 100% Seguro
                </p>
              </div>
            </div>

            <div className="bg-[#111827] p-5 rounded-2xl border border-slate-700 shadow-inner">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor do Serviço</p>
              <p className="text-3xl font-black text-white tracking-tighter">
                R$ <span className="text-4xl">{amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-8 space-y-6 relative z-10">
            {!pixData ? (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl">
                  <p className="text-xs font-medium text-slate-300 italic tracking-tight">{description}</p>
                </div>
                
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Selecione o Método</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setMethod('PIX')}
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-300 ${
                        method === 'PIX' 
                        ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-[1.02]' 
                        : 'border-slate-800 bg-[#111827] hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className={`size-10 rounded-full flex items-center justify-center ${method === 'PIX' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <QrCode size={18} />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${method === 'PIX' ? 'text-blue-400' : 'text-slate-400'}`}>PIX Instântaneo</span>
                    </button>

                    <button 
                      onClick={() => setMethod('CARTEIRA')}
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-300 ${
                        method === 'CARTEIRA' 
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-[1.02]' 
                        : 'border-slate-800 bg-[#111827] hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className={`size-10 rounded-full flex items-center justify-center ${method === 'CARTEIRA' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Wallet size={18} />
                      </div>
                      <div className="text-center">
                        <span className={`text-[10px] font-black uppercase tracking-widest block ${method === 'CARTEIRA' ? 'text-emerald-400' : 'text-slate-400'}`}>Carteira GSA</span>
                        <span className="text-[10px] font-bold text-slate-500 block mt-0.5 tracking-tighter">R$ {walletBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* TRUST BADGES SECTION */}
                <div className="flex items-center justify-center gap-4 py-2 border-t border-b border-slate-800/50">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Lock size={12} />
                    <span className="text-[8px] font-black uppercase tracking-widest">SSL 256-bit</span>
                  </div>
                  <div className="size-1 rounded-full bg-slate-700"></div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Building2 size={12} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Homologado Bacen</span>
                  </div>
                </div>

                <div className="relative group">
                  {/* Glow do botão */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                  <button 
                    onClick={handleConfirm}
                    disabled={loading}
                    className="relative w-full bg-[#0F172A] border border-slate-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
                  >
                    {loading ? <Loader2 className="animate-spin text-blue-500" size={18} /> : <Zap className="text-blue-500" size={18} />}
                    {loading ? 'PROCESSANDO...' : 'FINALIZAR COM SEGURANÇA'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center gap-2">
                  <Zap className="text-emerald-400 animate-pulse" size={24} />
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Código Gerado com Sucesso</p>
                  <p className="text-[10px] text-emerald-500/70 uppercase">Escaneie o QR Code no app do seu banco</p>
                </div>

                <div className="bg-[#111827] p-6 rounded-[2rem] border border-slate-800 flex flex-col items-center gap-5 shadow-inner">
                  <div className="relative">
                    <div className="absolute -inset-2 bg-gradient-to-tr from-blue-500 to-emerald-500 rounded-3xl blur opacity-20"></div>
                    <div className="relative size-48 bg-white p-3 rounded-2xl shadow-xl">
                      <img 
                        src={pixData.qr_code} 
                        alt="QR Code PIX" 
                        className="w-full h-full rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  
                  <div className="w-full space-y-2 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Código Copia e Cola</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={pixData.copy_paste || ''}
                        className="flex-1 bg-[#020617] border border-slate-700 rounded-xl px-4 py-3 text-[10px] text-slate-300 font-mono outline-none focus:border-blue-500 transition-colors"
                      />
                      <button 
                        onClick={handleCopyPix}
                        className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={onClose}
                  className="w-full bg-slate-800 text-slate-300 border border-slate-700 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-700 hover:text-white transition-all"
                >
                  <CheckCircle2 size={16} className="inline-block mr-2 -mt-0.5"/> JÁ REALIZEI O PAGAMENTO
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
