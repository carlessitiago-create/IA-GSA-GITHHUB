import React from 'react';
import { ClientConsultationUpsell } from '../components/ClientConsultationUpsell';
import { Search, ShieldAlert, Activity } from 'lucide-react';

export const ConsultasCpfCnpjView: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#0a0a2e] to-[#16164d] rounded-[2rem] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest mb-6 border border-blue-500/30">
            <Search size={16} /> Central de Inteligência
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
            Consultas Completas de <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">CPF e CNPJ</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl font-light">
            Consultas de dívidas, Score, Rating, Bacen, CADIN, Veículos e muito mais! Receba a consulta em PDF na mesma hora do pedido.
          </p>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-start gap-4 shadow-lg backdrop-blur-sm">
            <ShieldAlert className="text-amber-400 shrink-0 mt-1" size={24} />
            <div>
              <h4 className="text-amber-400 font-bold uppercase tracking-widest text-xs mb-1">Atenção</h4>
              <p className="text-amber-100/80 text-sm font-medium">
                Evite fazer muitas consultas do mesmo CPF/CNPJ num curto período, pois cada consulta poderá baixar a pontuação de Score e Rating do documento junto aos birôs de crédito.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Consultations List (Uses the existing component) */}
      <div className="mx-auto mt-8">
        <div className="flex items-center gap-3 mb-6 px-2">
          <Activity className="text-blue-600" size={24} />
          <h2 className="text-2xl font-black text-[#0a0a2e] uppercase tracking-tight">Serviços Disponíveis</h2>
        </div>
        
        {/* Usamos o componente integrado que já puxa os dados e gera PIX automático */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <ClientConsultationUpsell hideHeader={true} />
        </div>
      </div>
    </div>
  );
};
