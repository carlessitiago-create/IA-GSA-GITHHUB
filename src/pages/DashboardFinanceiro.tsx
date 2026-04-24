import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { FinancialTransactions } from '../components/dashboard/FinancialTransactions';
import { OpenInvoices } from '../components/dashboard/OpenInvoices';
import { RecentSales } from '../components/dashboard/RecentSales';
import { DollarSign, Clock, AlertTriangle, ReceiptText, TrendingUp, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import AlertCenter from '../components/GSA/AlertCenter';
import { useNavigate } from 'react-router-dom';

export function DashboardFinanceiro() {
  const props = useOutletContext<any>();
  const navigate = useNavigate();
  const { totalPending = 0, totalOpenInvoices = 0, sales = [], processes = [], clients = [], notification, setNotification, currentProfile } = props || {};
  const overdueInvoices = sales.filter((s: any) => s.status_pagamento === 'Vencida').reduce((acc: number, curr: any) => acc + curr.valor_total, 0);
  
  const isGestorVendedor = currentProfile?.nivel === 'GESTOR' || currentProfile?.nivel === 'VENDEDOR';
  const myProcesses = processes.filter((p: any) => p.status_atual !== 'Concluído');
  const myClients = clients;

  return (
    <div className="w-full space-y-8">
      <AlertCenter onResolveClick={() => navigate('/pendencias')} />

      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl font-bold text-sm shadow-sm border ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-red-50 border-red-100 text-red-800'
          }`}
        >
          {notification.message}
        </motion.div>
      )}

      <div className="responsive-container pb-20">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sm:gap-8 bg-white p-6 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
            <TrendingUp className="size-24 sm:size-32 md:size-[180px] text-[#0a0a2e]" />
          </div>

          <div className="space-y-2 sm:space-y-3 relative z-10">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="size-10 sm:size-12 md:size-14 bg-[#0a0a2e] rounded-xl sm:rounded-2xl md:rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/20 shrink-0">
                <DollarSign size={20} className="md:size-7 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-4xl md:text-5xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none truncate">
                  Financeiro
                </h1>
                <p className="text-slate-400 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-0.5">Control v4.0</p>
              </div>
            </div>
            <p className="text-slate-500 text-[10px] sm:text-xs md:text-sm font-medium">
              Gestão estratégica de faturas e fluxo de caixa.
            </p>
          </div>

          <div className="flex items-center gap-4 relative z-10 shrink-0">
            <div className="bg-emerald-50 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-[1.5rem] border border-emerald-100 flex items-center gap-3 sm:gap-4">
              <div className="size-8 sm:size-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Saúde Financeira</p>
                <p className="text-base sm:text-lg font-black text-emerald-700 uppercase italic leading-none">Excelente</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de Cards de Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-8">
          <motion.div 
            whileHover={{ y: -5 }}
            className="responsive-card flex flex-col gap-6 sm:gap-8 group hover:shadow-xl transition-all"
          >
            <div className="flex justify-between items-start">
              <div className="size-14 sm:size-16 bg-blue-50 rounded-2xl sm:rounded-[1.5rem] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                <Clock className="size-7 sm:size-8" />
              </div>
              <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Comprovantes Pendentes</p>
              <h3 className="text-3xl sm:text-4xl font-black text-[#0a0a2e] tracking-tighter italic">
                R$ {totalPending.toLocaleString('pt-BR')}
              </h3>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="responsive-card flex flex-col gap-6 sm:gap-8 group hover:shadow-xl transition-all"
          >
            <div className="flex justify-between items-start">
              <div className="size-14 sm:size-16 bg-amber-50 rounded-2xl sm:rounded-[1.5rem] flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
                <ReceiptText className="size-7 sm:size-8" />
              </div>
              <div className="bg-amber-50 text-amber-600 p-2 rounded-xl">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Faturas em Aberto</p>
              <h3 className="text-3xl sm:text-4xl font-black text-[#0a0a2e] tracking-tighter italic">
                R$ {totalOpenInvoices.toLocaleString('pt-BR')}
              </h3>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="responsive-card flex flex-col gap-6 sm:gap-8 group hover:shadow-xl transition-all"
          >
            <div className="flex justify-between items-start">
              <div className="size-14 sm:size-16 bg-rose-50 rounded-2xl sm:rounded-[1.5rem] flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-sm">
                <AlertTriangle className="size-7 sm:size-8" />
              </div>
              <div className="bg-rose-50 text-rose-600 p-2 rounded-xl">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Faturas Vencidas</p>
              <h3 className="text-3xl sm:text-4xl font-black text-[#0a0a2e] tracking-tighter italic">
                R$ {overdueInvoices.toLocaleString('pt-BR')}
              </h3>
            </div>
          </motion.div>
        </div>

        {isGestorVendedor && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mt-8">
            <motion.div 
              whileHover={{ y: -5 }}
              onClick={() => navigate('/operacional')}
              className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm transition-all hover:shadow-xl cursor-pointer group"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="size-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                  <Clock className="size-8" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Em Andamento</p>
                  <p className="text-2xl font-black text-[#0a0a2e] italic tracking-tighter">{myProcesses.length} Processos</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium">Acompanhe a evolução dos processos de seus clientes em tempo real.</p>
              <div className="mt-6 flex items-center gap-2 text-[#0a0a2e] font-black text-[10px] uppercase tracking-widest group-hover:gap-4 transition-all">
                Ver Meus Processos <ArrowUpRight size={14} className="text-blue-600" />
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              onClick={() => navigate('/equipe')}
              className="bg-white p-8 rounded-[2.5rem] border border-emerald-100 shadow-sm transition-all hover:shadow-xl cursor-pointer group"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="size-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                  <ReceiptText className="size-8" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Base de Clientes</p>
                  <p className="text-2xl font-black text-[#0a0a2e] italic tracking-tighter">{myClients.length} Cadastrados</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium">Gerencie sua carteira de clientes e novas propostas comerciais.</p>
              <div className="mt-6 flex items-center gap-2 text-[#0a0a2e] font-black text-[10px] uppercase tracking-widest group-hover:gap-4 transition-all">
                {currentProfile?.nivel === 'VENDEDOR' ? 'Meus Clientes' : 'Minha Equipe'} <ArrowUpRight size={14} className="text-emerald-600" />
              </div>
            </motion.div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 sm:gap-12 mt-12">
          <FinancialTransactions {...props} />
          <OpenInvoices {...props} />
          <RecentSales {...props} />
        </div>
      </div>
    </div>
  );
}

