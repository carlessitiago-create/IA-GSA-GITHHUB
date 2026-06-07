import React from 'react';
import { CheckCircle, MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SuccessPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappNumber?: string;
}

export const SuccessPaymentModal: React.FC<SuccessPaymentModalProps> = ({ 
    isOpen, 
    onClose, 
    whatsappNumber = "5511999999999" 
}) => {
  const message = encodeURIComponent("Olá! Meu pagamento foi confirmado e gostaria de agendar meu diagnóstico.");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-white p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl relative"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
            </button>
            <div className="flex justify-center mb-6">
                <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
                  <CheckCircle size={48} />
                </div>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Pagamento Confirmado!</h2>
            <p className="text-slate-600 mb-6">
                Seu pagamento foi confirmado com sucesso. Agora, vamos agendar seu diagnóstico com nosso especialista.
            </p>
            
            <a 
                href={`https://wa.me/${whatsappNumber}?text=${message}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl transition-all"
            >
                <MessageCircle size={20} />
                Agendar Reunião no WhatsApp
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
