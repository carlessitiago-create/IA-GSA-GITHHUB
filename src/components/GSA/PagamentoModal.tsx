import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  QrCode, 
  Wallet, 
  Loader2, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

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
  const [method, setMethod] = useState<'PIX' | 'CARTEIRA'>('PIX');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Simulation of payment process
      // In real scenario, would call backend/vendaService
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onSuccess({ 
        method, 
        amount, 
        timestamp: new Date(),
        ...paymentInfo 
      });
    } catch (error) {
      Swal.fire('Erro', 'Falha no processamento. Tente novamente.', 'error');
    } finally {
      setLoading(false);
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
        <div className="p-8 space-y-6">
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
                <span className={`text-[10px] font-black uppercase tracking-widest ${method === 'CARTEIRA' ? 'text-[#0a0a2e]' : 'text-slate-400'}`}>Saldo em Carteira</span>
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
        </div>
      </motion.div>
    </div>
  );
};
