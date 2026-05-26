import React, { useState } from 'react';
import { useWallets } from '../../hooks/useWallets';

export interface PagamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (saleData?: any) => Promise<void> | void;
  onPaymentSuccess?: () => void; // Keeping original for compatibility if used elsewhere
  amount?: number;
  valorServico?: number;
  description?: string;
  paymentInfo?: any;
}

export function PagamentoModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  onPaymentSuccess, 
  amount, 
  valorServico, 
  description, 
  paymentInfo 
}: PagamentoModalProps) {
  const { wallet, usarSaldoParaAbatimento } = useWallets();
  const [usarCredito, setUsarCredito] = useState(false);

  if (!isOpen) return null;

  const actualValor = amount ?? valorServico ?? 0;

  // Consider it might be loading, but for simplicity let's stick to the behavior.
  const valorFinal = usarCredito 
    ? Math.max(0, actualValor - (wallet?.saldoDisponivel || 0)) 
    : actualValor;

  const handlePayWithWallet = async () => {
    const success = await usarSaldoParaAbatimento(actualValor);
    if (success) {
       if (onSuccess) await onSuccess(paymentInfo);
       if (onPaymentSuccess) onPaymentSuccess();
    } else {
       alert("Erro ao debitar saldo. Tente novamente.");
    }
  };

  const handleGeneratePix = () => {
    // Aqui vai a chamada para API PIX etc...
    console.log("Gerar PIX via Asaas", valorFinal);
    // Para simplificar, vou simular o sucesso do pagamento PIX aqui, mas você deveria ligar no Webhook de fato.
    alert("Gerando PIX... Em um fluxo real, a tela trocaria para o QR Code do Asaas.");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[9999]">
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl relative w-full max-w-md shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white pb-1 w-8 h-8 rounded-full hover:bg-slate-800 transition-colors flex items-center justify-center font-black">X</button>
        <h3 className="text-xl font-bold text-white mb-4">Resumo do Pagamento</h3>
        
        {description && <p className="text-slate-400 mb-6">{description}</p>}

        {wallet && wallet.saldoDisponivel > 0 && (
          <div className="mb-4 p-4 bg-indigo-950/40 border border-indigo-800 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-300 font-medium">Você possui R$ {(wallet.saldoDisponivel || 0).toFixed(2)} de saldo interno.</p>
              <p className="text-xs text-slate-400">Deseja abater este valor no pagamento atual?</p>
            </div>
            <input 
              type="checkbox" 
              checked={usarCredito} 
              onChange={(e) => setUsarCredito(e.target.checked)}
              className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
        )}

        <div className="text-slate-300 mb-6 font-mono bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <p className="flex justify-between"><span>Valor Original:</span> <span>R$ {actualValor.toFixed(2)}</span></p>
          {usarCredito && <p className="flex justify-between text-emerald-400"><span>Abatimento:</span> <span>- R$ {Math.min(actualValor, wallet?.saldoDisponivel || 0).toFixed(2)}</span></p>}
          <div className="border-t border-slate-700 my-2"></div>
          <p className="flex justify-between text-lg font-bold text-white"><span>Valor a Pagar:</span> <span>R$ {valorFinal.toFixed(2)}</span></p>
        </div>

        {valorFinal === 0 ? (
          <button onClick={handlePayWithWallet} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 p-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20">
            Confirmar Pagamento com Saldo
          </button>
        ) : (
          <button onClick={handleGeneratePix} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20">
            Gerar PIX via Asaas (R$ {valorFinal.toFixed(2)})
          </button>
        )}
      </div>
    </div>
  );
}
