import React from 'react';
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
  BarChart3
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
    
    // Mock data for charts if real data is empty
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
            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 group hover:shadow-xl transition-all"
                >
                    <div className="size-12 sm:size-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0a0a2e] group-hover:scale-110 transition-transform shadow-sm">
                        <DollarSign className="size-6 sm:size-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Volume Total</p>
                        <h3 className="text-3xl font-black text-[#0a0a2e] italic tracking-tighter">
                            R$ {sales.reduce((acc: number, s: any) => acc + (s.valorTotal || 0), 0).toLocaleString('pt-BR')}
                        </h3>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 group hover:shadow-xl transition-all"
                >
                    <div className="size-12 sm:size-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-sm">
                        <Zap className="size-6 sm:size-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Processos Ativos</p>
                        <h3 className="text-3xl font-black text-[#0a0a2e] italic tracking-tighter">{processes.length}</h3>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 group hover:shadow-xl transition-all"
                >
                    <div className="size-12 sm:size-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform shadow-sm">
                        <AlertCircle className="size-6 sm:size-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pendências</p>
                        <h3 className="text-3xl font-black text-[#0a0a2e] italic tracking-tighter">{pendencies.length}</h3>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 group hover:shadow-xl transition-all"
                >
                    <div className="size-12 sm:size-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform shadow-sm">
                        <Users className="size-6 sm:size-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Time Ativo</p>
                        <h3 className="text-3xl font-black text-[#0a0a2e] italic tracking-tighter">{allUsers.length}</h3>
                    </div>
                </motion.div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Sales Chart */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm"
                >
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Performance de Vendas</h4>
                            <h2 className="text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter mt-1">Fluxo Financeiro</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl">
                            <button className="px-4 py-2 bg-white shadow-sm rounded-xl text-[10px] font-black uppercase tracking-widest text-[#0a0a2e]">7 Dias</button>
                            <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">30 Dias</button>
                        </div>
                    </div>
                    
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '20px', 
                                        border: 'none', 
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                        padding: '15px'
                                    }}
                                    itemStyle={{ fontWeight: 900, color: '#0a0a2e' }}
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
                    className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col"
                >
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest italic mb-1">Distribuição</h4>
                    <h2 className="text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter mb-8">Status Processos</h2>
                    
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full mt-8">
                            {statusData.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                                    <div className="size-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.name}</p>
                                        <p className="text-sm font-black text-[#0a0a2e]">{item.value}</p>
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
                    className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm"
                >
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Atividades Recentes</h2>
                        <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Ver Tudo</button>
                    </div>
                    <div className="space-y-6">
                        {statusHistory.slice(0, 5).map((history: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-6 group">
                                <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                                    <Activity size={20} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-black text-[#0a0a2e] uppercase italic">{history.status}</p>
                                        <span className="text-[10px] font-bold text-slate-400">{history.data?.toDate().toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Processo ID: {history.processoId?.slice(-8)}</p>
                                </div>
                            </div>
                        ))}
                        {statusHistory.length === 0 && (
                            <div className="py-10 text-center">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma atividade registrada</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0a0a2e] p-10 rounded-[3rem] shadow-xl text-white relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-10 opacity-10">
                        <Target className="size-[80px] sm:size-[120px]" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="size-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                                <TrendingUp size={20} />
                            </div>
                            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Insights de IA</h2>
                        </div>
                        
                        <div className="space-y-8">
                            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Oportunidade Detectada</p>
                                <h3 className="text-lg font-black italic leading-tight group-hover:translate-x-2 transition-transform">O volume de vendas cresceu 15% em relação à semana passada. Considere aumentar o limite de crédito para clientes VIP.</h3>
                            </div>

                            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Alerta de Eficiência</p>
                                <h3 className="text-lg font-black italic leading-tight group-hover:translate-x-2 transition-transform">O tempo médio de aprovação de processos subiu para 4.2 horas. Verifique as pendências do gestor.</h3>
                            </div>

                            <button className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-[#0a0a2e] rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-3">
                                Gerar Relatório Completo <BarChart3 size={18} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
