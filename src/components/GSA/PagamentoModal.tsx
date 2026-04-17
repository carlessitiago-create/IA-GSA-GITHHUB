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
  Zap
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#0a0a2e]/80 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        {/* HEADER */}
        <div className="bg-[#0a0a2e] p-8 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <CreditCard className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Pagamento Seguro</h3>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Checkout GSA Diagnostics</p>
            </div>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Valor Total</p>
            <p className="text-3xl font-black italic">R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {!pixData ? (
            <>
              <div className="space-y-4">
                <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight">{description}</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setMethod('PIX')}
                    className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                      method === 'PIX' 
                      ? 'border-[#0a0a2e] bg-slate-50 shadow-inner' 
                      : 'border-slate-50 bg-white hover:border-slate-100'
                    }`}
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center ${method === 'PIX' ? 'bg-[#0a0a2e] text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <QrCode size={20} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${method === 'PIX' ? 'text-[#0a0a2e]' : 'text-slate-400'}`}>PIX Copia e Cola</span>
                  </button>

                  <button 
                    onClick={() => setMethod('CARTEIRA')}
                    className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                      method === 'CARTEIRA' 
                      ? 'border-[#0a0a2e] bg-slate-50 shadow-inner' 
                      : 'border-slate-50 bg-white hover:border-slate-100'
                    }`}
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center ${method === 'CARTEIRA' ? 'bg-[#0a0a2e] text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Wallet size={20} />
                    </div>
                    <div className="text-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest block ${method === 'CARTEIRA' ? 'text-[#0a0a2e]' : 'text-slate-400'}`}>Saldo Carteira</span>
                      <span className="text-[9px] font-bold text-emerald-600 block mt-1">R$ {walletBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <p className="text-[10px] text-emerald-700 font-bold leading-relaxed uppercase">
                  Liberação imediata após a confirmação do pagamento. Os processos entrarão na fila de produção automaticamente.
                </p>
              </div>

              <button 
                onClick={handleConfirm}
                disabled={loading}
                className="w-full bg-[#0a0a2e] text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                {loading ? 'PROCESSANDO...' : 'CONFIRMAR PAGAMENTO'}
                {!loading && <ArrowRight size={18} />}
              </button>
            </>
          ) : (
            <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2">
                <Zap className="text-emerald-600 animate-pulse" size={20} />
                <p className="text-xs font-black text-emerald-800 uppercase tracking-tight">Pagamento PIX Gerado!</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center gap-4">
                <div className="size-48 bg-white p-4 rounded-2xl shadow-inner border border-slate-200">
                  <img 
                    src={pixData.qr_code} 
                    alt="QR Code PIX" 
                    className="w-full h-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <div className="w-full space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código Copia e Cola</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={pixData.copy_paste || ''}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-mono outline-none"
                    />
                    <button 
                      onClick={handleCopyPix}
                      className="bg-[#0a0a2e] text-white p-3 rounded-xl hover:bg-blue-900 transition-colors"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">
                Após pagar, o sistema identificará automaticamente em até 60 segundos e iniciará os processos.
              </p>

              <button 
                onClick={onClose}
                className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
              >
                FECHAR E IR PARA HISTÓRICO
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
