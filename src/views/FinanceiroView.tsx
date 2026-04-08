import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { FinancialTransactions } from '../components/dashboard/FinancialTransactions';
import { OpenInvoices } from '../components/dashboard/OpenInvoices';
import { RecentSales } from '../components/dashboard/RecentSales';
import { DollarSign, Clock, AlertTriangle, ReceiptText, TrendingUp, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const FinanceiroView = () => {
    const props = useOutletContext<any>();
    const { totalPending = 0, totalOpenInvoices = 0, sales = [] } = props || {};
    const overdueInvoices = sales.filter((s: any) => s.status_pagamento === 'Vencida').reduce((acc: number, curr: any) => acc + curr.valor_total, 0);

    return (
        <div className="responsive-container pb-20">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-6 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
                    <TrendingUp className="size-[140px] sm:size-[180px] text-[#0a0a2e]" />
                </div>

                <div className="space-y-3 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="size-12 md:size-14 bg-[#0a0a2e] rounded-2xl md:rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/20">
                            <DollarSign size={24} className="md:size-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">
                                Financeiro
                            </h1>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">GSA IA Financial Control v4.0</p>
                        </div>
                    </div>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium">
                        Gestão de faturas, comprovantes e fluxo de caixa estratégico.
                    </p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
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

            <div className="grid grid-cols-1 gap-8 sm:gap-12">
                <FinancialTransactions {...props} />
                <OpenInvoices {...props} />
                <RecentSales {...props} />
            </div>
        </div>
    );
};
