import React from 'react';
import { Gift, Trophy, ArrowRight, Star } from 'lucide-react';
import { motion } from 'motion/react';

interface ClubePromoBannerProps {
  onAction: () => void;
  isPublic?: boolean;
}

export const ClubePromoBanner: React.FC<ClubePromoBannerProps> = ({ onAction, isPublic = false }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 p-6 sm:p-8 text-white shadow-2xl shadow-orange-500/20"
    >
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
        <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 text-center md:text-left">
          <div className="size-16 sm:size-20 bg-white/20 backdrop-blur-md rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-inner border border-white/30 shrink-0">
            <Trophy size={32} className="sm:size-[40px] text-yellow-200 drop-shadow-lg" />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Star size={14} className="sm:size-4 text-yellow-200 fill-yellow-200" />
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-yellow-100">Exclusivo GSA</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter leading-none">
              Clube de Prêmios
            </h3>
            <p className="text-xs sm:text-sm font-medium text-orange-50 max-w-sm leading-relaxed">
              {isPublic 
                ? "Cadastre-se agora, indique amigos e troque seus pontos por prêmios incríveis como iPhones, Notebooks e muito mais!"
                : "Você já tem pontos acumulados! Troque agora por prêmios exclusivos na nossa vitrine de recompensas."}
            </p>
          </div>
        </div>

        <button 
          onClick={onAction}
          className="w-full md:w-auto group relative flex items-center justify-center gap-3 px-6 sm:px-8 py-4 sm:py-5 bg-white text-orange-600 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs hover:bg-orange-50 transition-all shadow-xl hover:scale-105 active:scale-95"
        >
          {isPublic ? "Quero Me Cadastrar" : "Ver Meus Prêmios"}
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Decorative elements */}
      <div className="absolute -right-10 -top-10 size-48 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute -left-10 -bottom-10 size-64 bg-orange-400/20 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-full opacity-10 pointer-events-none">
        <Gift size={200} className="absolute -right-10 -bottom-20 rotate-12" />
      </div>
    </motion.div>
  );
};
