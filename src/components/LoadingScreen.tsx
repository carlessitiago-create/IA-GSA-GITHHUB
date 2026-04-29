import React from 'react';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';

export const LoadingScreen: React.FC<{ message?: string }> = ({ message = "Validando Acesso GSA..." }) => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0a0a2e] relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <div className="relative z-10 flex flex-col items-center">
        <div
          className="size-24 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] flex items-center justify-center shadow-2xl mb-8 relative"
        >
          <Shield className="text-white w-10 h-10" />
          {/* Animated Ring */}
          <div className="absolute inset-0 rounded-[2rem] border-2 border-blue-500/30 animate-ping opacity-20"></div>
          <div className="absolute inset-[-8px] rounded-[2.5rem] border border-white/5 animate-spin-slow"></div>
        </div>

        <div
          className="text-center space-y-3"
        >
          <h2 className="text-white font-black italic uppercase tracking-widest text-sm">GSA INTELLIGENCE</h2>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="size-1 bg-blue-400 rounded-full animate-pulse"
              />
            ))}
          </div>
          <p className="text-blue-200/50 font-bold uppercase text-[9px] tracking-[0.4em] pt-2">{message}</p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-12 left-0 right-0 text-center">
        <p className="text-white/10 font-black italic text-[10px] tracking-widest">SISTEMA DE GESTÃO INTELIGENTE</p>
      </div>
    </div>
  );
};
