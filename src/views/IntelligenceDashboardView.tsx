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
    const totalVolumeValue = sales.reduce((acc: number, s: any) => acc + (s.valor_total || s.valorTotal || 0), 0);
    const processosLength = processes.length || 0;
    const pendenciesLength = pendencies.length || 0;
    const leadsLength = showcaseLeads.length || 0;
    
    // Use animated counters
    const animVolume = useCounter(totalVolumeValue);
    const animProcessos = useCounter(processosLength);
    const animPendencies = useCounter(pendenciesLength);
    const animUsers = useCounter(allUsers.length);
    
    const salesData = sales.length > 0 ? sales.slice(-7).map((s: any) => ({
        name: s.timestamp?.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) || 
              s.criadoEm?.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) || 
              'N/A',
        valor: s.valor_total || s.valorTotal || 0
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
        <div className="space-y-8 sm:space-y-10 pb-10 sm:pb-20">
            {/* POWER HUD - Global Target */}
            <div className="relative overflow-hidden bg-[#020617] border border-slate-800 rounded-3xl sm:rounded-[2.5rem] md:rounded-[3rem] p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-96 h-64 sm:h-96 bg-blue-600/20 blur-[80px] sm:blur-[100px] rounded-full pointer-events-none"></div>
                <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-56 sm:w-80 h-56 sm:h-80 bg-emerald-600/10 blur-[80px] sm:blur-[100px] rounded-full pointer-events-none"></div>

                <div className="relative z-10 flex-1 w-full text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 mb-6 mx-auto md:mx-0">
                        <Radar className="text-blue-400 size-3.5 sm:size-4" />
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest">Command Center</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-none mb-4 md:whitespace-nowrap">
                        Pulsar de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Operações</span>
                    </h1>
                    <p className="text-slate-400 text-xs sm:text-sm md:text-base font-medium max-w-md mx-auto md:mx-0">
                        Visão panorâmica em tempo real da performance, transações e fluxo de atendimento da operação.
                    </p>
                </div>

                <div className="relative z-10 flex flex-row items-center gap-4 sm:gap-8 bg-[#0F172A]/80 backdrop-blur-md p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-slate-700/50 w-full md:w-auto justify-center sm:justify-start">
                    <div className="space-y-1 sm:space-y-2">
                        <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta</p>
                        <div className="flex items-end gap-1.5 sm:gap-2">
                            <span className="text-xl sm:text-3xl md:text-4xl font-black text-emerald-400 tracking-tighter">84%</span>
                            <TrendingUp className="text-emerald-500 mb-1 size-3.5 sm:size-5" />
                        </div>
                    </div>
                    <div className="w-px h-10 sm:h-16 bg-slate-800 rounded-full"></div>
                    <div className="space-y-1 sm:space-y-2">
                        <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Ticket</p>
                        <div className="flex items-end gap-1.5 sm:gap-2">
                            <span className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tighter whitespace-nowrap">R$ 1.2k</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: 'Volume', value: `R$ ${animVolume >= 1000 ? (animVolume / 1000).toFixed(1) + 'k' : animVolume}`, icon: DollarSign, color: 'blue' },
                    { label: 'Processos', value: animProcessos, icon: Zap, color: 'emerald' },
                    { label: 'Alertas', value: animPendencies, icon: AlertCircle, color: 'rose' },
                    { label: 'Agentes', value: animUsers, icon: Users, color: 'indigo' },
                ].map((stat, i) => (
                    <motion.div 
                        key={stat.label}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * (i + 1) }}
                        className={`bg-[#0B0F19] p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-800 flex flex-col md:flex-row items-center md:items-start lg:items-center gap-3 sm:gap-4 md:gap-6 group hover:border-${stat.color}-500/50 transition-all cursor-default relative overflow-hidden`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                        <div className={`relative z-10 size-10 sm:size-12 md:size-16 bg-${stat.color}-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-${stat.color}-400 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all border border-${stat.color}-500/20 shrink-0`}>
                            <stat.icon className="size-5 sm:size-6 md:size-8" />
                        </div>
                        <div className="relative z-10 text-center md:text-left min-w-0 flex-1">
                            <p className="text-[7px] sm:text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{stat.label}</p>
                            <h3 className="text-base sm:text-xl md:text-3xl font-black text-white italic tracking-tighter truncate leading-tight mt-0.5">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Main Sales Chart */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-2 bg-[#0B0F19] p-6 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] md:rounded-[3rem] border border-slate-800 shadow-xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-full h-1/2 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none"></div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 sm:mb-10 relative z-10">
                        <div>
                            <h4 className="text-[9px] sm:text-xs font-black text-blue-500 uppercase tracking-widest italic">Análise de Liquidez</h4>
                            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tighter mt-1">Fluxo Financeiro</h2>
                        </div>
                        <div className="flex items-center gap-1.5 p-1.5 bg-[#020617] border border-slate-800 rounded-xl sm:rounded-2xl w-full sm:w-auto">
                            <button className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white transition-all">7d</button>
                            <button className="flex-1 sm:flex-none px-4 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">30d</button>
                        </div>
                    </div>
                    
                    <div className="h-[250px] sm:h-[300px] md:h-[350px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
                                    tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                                    tickFormatter={(value) => `${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '12px', 
                                        border: '1px solid #1e293b', 
                                        backgroundColor: '#020617',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                                        padding: '10px'
                                    }}
                                    itemStyle={{ fontWeight: 900, color: '#60a5fa', fontSize: '11px' }}
                                    labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="valor" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorValor)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Status Distribution */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#0B0F19] p-6 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] md:rounded-[3rem] border border-slate-800 shadow-xl flex flex-col"
                >
                    <h4 className="text-[9px] sm:text-xs font-black text-emerald-500 uppercase tracking-widest italic mb-1">Carga Operacional</h4>
                    <h2 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tighter mb-6 sm:mb-8">Status Slots</h2>
                    
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-[200px] sm:h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={85}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }}
                                        itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mt-6 sm:mt-8">
                            {statusData.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-[#111827] border border-slate-800 rounded-xl sm:rounded-2xl">
                                    <div className="size-2 sm:size-3 rounded-full shrink-0" style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}80` }}></div>
                                    <div className="min-w-0">
                                        <p className="text-[7px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">{item.name}</p>
                                        <p className="text-[10px] sm:text-sm font-black text-white truncate">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Recent Activities & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0B0F19] p-6 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] md:rounded-[3rem] border border-slate-800 shadow-xl"
                >
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                        <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tighter">Timeline</h2>
                        <button className="text-[9px] sm:text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors">Tudo</button>
                    </div>
                    <div className="space-y-4 sm:space-y-6">
                        {statusHistory.slice(0, 5).map((history: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-4 sm:gap-6 group">
                                <div className="size-10 sm:size-12 bg-[#111827] border border-slate-800 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 group-hover:border-blue-500/50 transition-colors">
                                    <Activity size={18} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                                </div>
                                <div className="flex-1 border-b border-slate-800/50 pb-3 sm:pb-4 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs sm:text-sm font-black text-slate-200 uppercase italic truncate">{history.status}</p>
                                        <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 bg-[#111827] px-2 py-0.5 sm:py-1 rounded-md shrink-0">{history.data?.toDate().toLocaleDateString?.() || 'Recente'}</span>
                                    </div>
                                    <p className="text-[9px] sm:text-xs text-slate-500 mt-1 font-mono truncate">ID: {history.processoId?.slice(-8)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-indigo-950 to-[#020617] p-6 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] md:rounded-[3rem] border border-indigo-900/50 shadow-[0_20px_50px_rgba(49,46,129,0.2)] text-white relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] scale-125 sm:scale-150 transform translate-x-10 -translate-y-10 pointer-events-none">
                        <Target className="size-[150px] sm:size-[200px]" />
                    </div>
                    <div className="relative z-10 h-full">
                        <div className="flex items-center justify-between mb-6 sm:mb-8">
                            <div className="flex items-center gap-3">
                                <div className="size-9 sm:size-10 bg-indigo-500/20 border border-indigo-500/50 rounded-xl flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)] shrink-0">
                                    <Crosshair className="size-4.5 sm:size-5" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-indigo-50 truncate">Insights</h2>
                            </div>
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                            </span>
                        </div>
                        
                        <div className="space-y-4 sm:space-y-6">
                            <div className="p-4 sm:p-5 md:p-6 bg-[#020617]/50 backdrop-blur-sm rounded-2xl sm:rounded-[2rem] border border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-900/20 transition-all cursor-pointer group shadow-inner">
                                <p className="text-[8px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1.5">
                                    <TrendingUp className="size-2.5 sm:size-3" /> Alta Propensão
                                </p>
                                <h3 className="text-xs sm:text-sm md:text-base font-black italic leading-tight sm:leading-relaxed text-indigo-50 group-hover:text-white transition-colors">Vendas cresceram 15% em relação à última semana. Risco sistêmico baixo.</h3>
                            </div>

                            <div className="p-4 sm:p-5 md:p-6 bg-[#020617]/50 backdrop-blur-sm rounded-2xl sm:rounded-[2rem] border border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-900/20 transition-all cursor-pointer group shadow-inner">
                                <p className="text-[8px] sm:text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 sm:mb-2 flex items-center gap-1.5">
                                    <AlertCircle className="size-2.5 sm:size-3" /> Atenção
                                </p>
                                <h3 className="text-xs sm:text-sm md:text-base font-black italic leading-tight sm:leading-relaxed text-indigo-50 group-hover:text-white transition-colors">Gargalo operacional: 8 pendências em análise manual. SLA de 24h em risco.</h3>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
