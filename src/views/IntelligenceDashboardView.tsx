import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Activity, 
  TrendingUp, 
  DollarSign, 
  ArrowRight, 
  Users, 
  FileText, 
  AlertCircle,
  Zap,
  Target,
  BarChart3,
  Globe2,
  Wallet,
  Crosshair,
  Radar
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

function useCounter(end: number, duration: number = 1500) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (end === 0) {
            setCount(0);
            return;
        }
        let start = 0;
        const inc = end / (duration / 16);
        const timer = setInterval(() => {
            start += inc;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [end, duration]);

    return count;
}

export const IntelligenceDashboardView = () => {
    const props = useOutletContext<any>();
    const { 
        showcaseLeads = [], 
        statusHistory = [], 
        allTransactions = [], 
        processes = [], 
        pendencies = [], 
        allWallets = [], 
        pendingTransactions = [], 
        sales = [], 
        allUsers = [] 
    } = props || {};
    
    // Calculate static values
    const totalVolumeValue = sales.reduce((acc: number, s: any) => acc + (s.valorTotal || 0), 0);
    const processosLength = processes.length || 0;
    const pendenciesLength = pendencies.length || 0;
    const leadsLength = showcaseLeads.length || 0;

    // Use animated counters
    const animVolume = useCounter(totalVolumeValue);
    const animProcessos = useCounter(processosLength);
    const animPendencies = useCounter(pendenciesLength);
    const animUsers = useCounter(allUsers.length);
    
    const salesData = sales.length > 0 ? sales.slice(-7).map((s: any) => ({
        name: s.criadoEm?.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) || 'N/A',
        valor: s.valorTotal || 0
    })) : [
        { name: 'Seg', valor: 4000 },
        { name: 'Ter', valor: 3000 },
        { name: 'Qua', valor: 2000 },
        { name: 'Qui', valor: 2780 },
        { name: 'Sex', valor: 1890 },
        { name: 'Sab', valor: 2390 },
        { name: 'Dom', valor: 3490 },
    ];

    const statusData = [
        { name: 'Aprovados', value: processes.filter((p: any) => p.status === 'APROVADO').length || 15, color: '#10b981' },
        { name: 'Pendentes', value: pendencies.length || 8, color: '#f59e0b' },
        { name: 'Em Análise', value: processes.filter((p: any) => p.status === 'ANALISE').length || 12, color: '#3b82f6' },
        { name: 'Reprovados', value: processes.filter((p: any) => p.status === 'REPROVADO').length || 3, color: '#ef4444' },
    ];

    return (
        <div className="space-y-10">
            {/* POWER HUD - Global Target */}
            <div className="relative overflow-hidden bg-[#020617] border border-slate-800 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none"></div>
                <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-80 h-80 bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none"></div>

                <div className="relative z-10 flex-1">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 mb-6">
                        <Radar className="text-blue-400" size={16} />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Global Command Center</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-none mb-4">
                        Pulsar de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Operações</span>
                    </h1>
                    <p className="text-slate-400 font-medium max-w-md">
                        Visão panorâmica e em tempo real da performance, transações e fluxo de atendimento de toda a operação.
                    </p>
                </div>

                <div className="relative z-10 flex items-center gap-8 bg-[#0F172A]/80 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-700/50">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta Diária Atingida</p>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-emerald-400 tracking-tighter">84%</span>
                            <TrendingUp className="text-emerald-500 mb-1" size={20} />
                        </div>
                    </div>
                    <div className="w-1 h-16 bg-slate-800 rounded-full"></div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ticket Médio</p>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-white tracking-tighter">R$ 1.250</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-[#0B0F19] p-8 rounded-[2.5rem] shadow-xl border border-slate-800 flex items-center gap-6 group hover:border-blue-500/50 transition-all cursor-default relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 size-12 sm:size-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all border border-blue-500/20">
                        <DollarSign className="size-6 sm:size-8" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Volume Transacionado</p>
                        <h3 className="text-3xl font-black text-white italic tracking-tighter">
                            R$ {animVolume.toLocaleString('pt-BR')}
                        </h3>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-[#0B0F19] p-8 rounded-[2.5rem] shadow-xl border border-slate-800 flex items-center gap-6 group hover:border-emerald-500/50 transition-all cursor-default relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 size-12 sm:size-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all border border-emerald-500/20">
                        <Zap className="size-6 sm:size-8" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carga Ativa (Proc.)</p>
                        <h3 className="text-3xl font-black text-white italic tracking-tighter">{animProcessos}</h3>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-[#0B0F19] p-8 rounded-[2.5rem] shadow-xl border border-slate-800 flex items-center gap-6 group hover:border-rose-500/50 transition-all cursor-default relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 size-12 sm:size-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-400 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(244,63,94,0.3)] transition-all border border-rose-500/20">
                        <AlertCircle className="size-6 sm:size-8" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Gargalos / Alertas</p>
                        <h3 className="text-3xl font-black text-white italic tracking-tighter">{animPendencies}</h3>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-[#0B0F19] p-8 rounded-[2.5rem] shadow-xl border border-slate-800 flex items-center gap-6 group hover:border-indigo-500/50 transition-all cursor-default relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10 size-12 sm:size-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all border border-indigo-500/20">
                        <Users className="size-6 sm:size-8" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Agentes em Campo</p>
                        <h3 className="text-3xl font-black text-white italic tracking-tighter">{animUsers}</h3>
                    </div>
                </motion.div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Sales Chart */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-2 bg-[#0B0F19] p-10 rounded-[3rem] border border-slate-800 shadow-xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-full h-1/2 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between mb-10 relative z-10">
                        <div>
                            <h4 className="text-xs font-black text-blue-500 uppercase tracking-widest italic">Análise de Liquidez</h4>
                            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mt-1">Fluxo Financeiro</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-[#020617] border border-slate-800 p-2 rounded-2xl">
                            <button className="px-4 py-2 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all">7 Dias</button>
                            <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">30 Dias</button>
                        </div>
                    </div>
                    
                    <div className="h-[350px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '20px', 
                                        border: '1px solid #1e293b', 
                                        backgroundColor: '#020617',
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                                        padding: '15px'
                                    }}
                                    itemStyle={{ fontWeight: 900, color: '#60a5fa' }}
                                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="valor" 
                                    stroke="#3b82f6" 
                                    strokeWidth={4}
                                    fillOpacity={1} 
                                    fill="url(#colorValor)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Status Distribution */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#0B0F19] p-10 rounded-[3rem] border border-slate-800 shadow-xl flex flex-col"
                >
                    <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest italic mb-1">Carga Operacional</h4>
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-8">Status Slots</h2>
                    
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={105}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '1rem' }}
                                        itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full mt-8">
                            {statusData.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-[#111827] border border-slate-800 rounded-2xl">
                                    <div className="size-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}80` }}></div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.name}</p>
                                        <p className="text-sm font-black text-white">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Recent Activities & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0B0F19] p-10 rounded-[3rem] border border-slate-800 shadow-xl"
                >
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Timeline Operacional</h2>
                        <button className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors">Ver Tudo</button>
                    </div>
                    <div className="space-y-6">
                        {statusHistory.slice(0, 5).map((history: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-6 group">
                                <div className="size-12 bg-[#111827] border border-slate-800 rounded-2xl flex items-center justify-center shrink-0 group-hover:border-blue-500/50 transition-colors">
                                    <Activity size={20} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                                </div>
                                <div className="flex-1 border-b border-slate-800/50 pb-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-black text-slate-200 uppercase italic">{history.status}</p>
                                        <span className="text-[10px] font-bold text-slate-500 bg-[#111827] px-2 py-1 rounded-md">{history.data?.toDate().toLocaleDateString?.() || 'Recente'}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 font-mono">ID: {history.processoId?.slice(-8)}</p>
                                </div>
                            </div>
                        ))}
                        {statusHistory.length === 0 && (
                            <div className="py-10 text-center bg-[#111827] rounded-3xl border border-slate-800 border-dashed">
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
                                    <Activity size={16} /> Sem Movimentação Recente
                                </p>
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-indigo-950 to-[#020617] p-10 rounded-[3rem] border border-indigo-900/50 shadow-[0_20px_50px_rgba(49,46,129,0.2)] text-white relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] scale-150 transform translate-x-10 -translate-y-10 pointer-events-none">
                        <Target className="size-[200px]" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-indigo-500/20 border border-indigo-500/50 rounded-xl flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                    <Crosshair size={20} />
                                </div>
                                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-indigo-50">Insights Ocultos</h2>
                            </div>
                            <span className="flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                            </span>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="p-6 bg-[#020617]/50 backdrop-blur-sm rounded-[2rem] border border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-900/20 transition-all cursor-pointer group shadow-inner">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <TrendingUp size={12} /> Alta Propensão
                                </p>
                                <h3 className="text-lg font-black italic leading-relaxed text-indigo-50 group-hover:text-white transition-colors">O volume de vendas cresceu 15% em relação à semana passada. Risco sistêmico baixo. Acelerar liberação de crédito.</h3>
                            </div>

                            <div className="p-6 bg-[#020617]/50 backdrop-blur-sm rounded-[2rem] border border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-900/20 transition-all cursor-pointer group shadow-inner">
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <AlertCircle size={12} /> Atenção
                                </p>
                                <h3 className="text-lg font-black italic leading-relaxed text-indigo-50 group-hover:text-white transition-colors">Gargalo operacional: 8 pendências em análise manual. O SLA de 24h está em risco caso não seja distribuído.</h3>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
