import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  CheckCircle, 
  Eye, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Calendar,
  Download,
  Target,
  Zap,
  Activity,
  Crosshair
} from 'lucide-react';
import { listAllProposals, ProposalData } from '../services/proposalService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ConversionDashboardView: React.FC = () => {
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await listAllProposals();
        setProposals(data);
      } catch (error) {
        console.error("Erro ao carregar dados de conversão:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Métricas Gerais
  const totalProposals = proposals.length;
  const totalViews = proposals.reduce((acc, p) => acc + (p.visualizacoes || 0), 0);
  const totalAccepted = proposals.filter(p => p.status === 'ACEITA' || p.status === 'PAGA').length;
  const totalPaid = proposals.filter(p => p.status === 'PAGA').length;

  const openingRate = totalProposals > 0 ? (proposals.filter(p => (p.visualizacoes || 0) > 0).length / totalProposals) * 100 : 0;
  const acceptanceRate = totalProposals > 0 ? (totalAccepted / totalProposals) * 100 : 0;
  const conversionRate = totalProposals > 0 ? (totalPaid / totalProposals) * 100 : 0;

  // Dados para o Funil
  const funnelData = [
    { name: 'Geradas', value: totalProposals || 1, fill: '#3b82f6' }, // Blue
    { name: 'Visualizadas', value: proposals.filter(p => (p.visualizacoes || 0) > 0).length, fill: '#8b5cf6' }, // Purple
    { name: 'Aceitas', value: totalAccepted, fill: '#14b8a6' }, // Teal
    { name: 'Pagas', value: totalPaid, fill: '#10b981' }, // Emerald
  ];

  // Distribuição por Status
  const statusData = [
    { name: 'Abertas', value: proposals.filter(p => p.status === 'ABERTA').length, color: '#3b82f6' },
    { name: 'Aceitas', value: proposals.filter(p => p.status === 'ACEITA').length, color: '#14b8a6' },
    { name: 'Pagas', value: proposals.filter(p => p.status === 'PAGA').length, color: '#10b981' },
    { name: 'Recusadas', value: proposals.filter(p => p.status === 'RECUSADA').length, color: '#f43f5e' },
    { name: 'Expiradas', value: proposals.filter(p => p.status === 'EXPIRADA').length, color: '#64748b' },
  ].filter(d => d.value > 0);

  // Performance por Vendedor
  const sellerPerformance = proposals.reduce((acc: any, p) => {
    if (!acc[p.vendedor_nome]) {
      acc[p.vendedor_nome] = { nome: p.vendedor_nome, total: 0, aceitas: 0, pagas: 0 };
    }
    acc[p.vendedor_nome].total += 1;
    if (p.status === 'ACEITA' || p.status === 'PAGA') acc[p.vendedor_nome].aceitas += 1;
    if (p.status === 'PAGA') acc[p.vendedor_nome].pagas += 1;
    return acc;
  }, {});

  const sellerData = Object.values(sellerPerformance).sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      
      {/* GLOWING HEADER */}
      <div className="relative overflow-hidden bg-[#020617] border border-slate-800 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
          
          <div className="relative z-10 flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-900/30 border border-indigo-500/30 mb-6">
                  <Activity className="text-indigo-400" size={16} />
                  <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Growth & CRO Analytics</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-none mb-4">
                  Taxa de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Conversão</span>
              </h1>
              <p className="text-slate-400 font-medium max-w-md">
                  Mapeamento em tempo real do funil de propostas. Identifique perdas e otimize o pitch de vendas.
              </p>
          </div>

          <div className="relative z-10 flex items-center gap-4">
            <button className="flex items-center gap-2 px-6 py-4 bg-[#0F172A] border border-slate-700 rounded-2xl text-[10px] uppercase tracking-widest font-black text-slate-300 hover:border-indigo-500 transition-colors shadow-inner">
              <Calendar size={16} />
              Últimos 30 dias
            </button>
            <button className="flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] uppercase tracking-widest font-black hover:bg-indigo-500 transition-colors shadow-[0_0_20px_rgba(79,70,229,0.3)] border border-indigo-500">
              <Download size={16} />
              Exportar
            </button>
          </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total de Propostas" 
          value={totalProposals} 
          icon={TrendingUp} 
          trend="+12%" 
          trendUp={true}
          color="indigo"
        />
        <MetricCard 
          title="Taxa de Abertura" 
          value={`${openingRate.toFixed(1)}%`} 
          icon={Eye} 
          trend="+5.4%" 
          trendUp={true}
          color="blue"
        />
        <MetricCard 
          title="Taxa de Aceite" 
          value={`${acceptanceRate.toFixed(1)}%`} 
          icon={CheckCircle} 
          trend="-2.1%" 
          trendUp={false}
          color="purple"
        />
        <MetricCard 
          title="Conversão Final" 
          value={`${conversionRate.toFixed(1)}%`} 
          icon={Zap} 
          trend="+8.2%" 
          trendUp={true}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Funil de Conversão */}
        <div className="lg:col-span-2 bg-[#0B0F19] p-10 rounded-[3rem] border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-1/2 right-0 w-64 h-64 bg-indigo-600/5 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="size-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                <Filter size={24} />
              </div>
              <div>
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest italic leading-none mb-1">Mapeamento de Eficiência</h4>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Funil de Vendas</h3>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 800, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#111827' }}
                  contentStyle={{ borderRadius: '20px', border: '1px solid #1e293b', backgroundColor: '#020617', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                  itemStyle={{ fontWeight: 900, color: '#f8fafc' }}
                />
                <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={40}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição de Status */}
        <div className="bg-[#0B0F19] p-10 rounded-[3rem] border border-slate-800 shadow-xl flex flex-col">
          <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic mb-1">Visão Geral</h4>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8 flex items-center gap-2">
            Status Pipeline
          </h2>
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
                    {statusData.map((entry: any, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid #1e293b', backgroundColor: '#020617' }}
                    itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full mt-8">
                {statusData.map((item: any, idx) => (
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
        </div>
      </div>

      {/* Performance da Equipe */}
      <div className="bg-[#0B0F19] rounded-[3rem] border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-8 sm:p-10 border-b border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="size-14 bg-indigo-500/10 border border-indigo-500/20 rounded-[1.2rem] flex items-center justify-center text-indigo-400">
                <Crosshair size={24} />
              </div>
              <div>
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest italic mb-1">Rankings</h4>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                  Consultores Top Performers
                </h3>
              </div>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#020617] border-b border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Consultor</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Propostas</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Aceites</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendas</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Conversão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sellerData.length > 0 ? sellerData.map((seller: any, index: number) => {
                const convRate = seller.total > 0 ? (seller.pagas / seller.total) * 100 : 0;
                return (
                  <tr key={index} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700">
                          {seller.nome.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{seller.nome}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-mono text-slate-400">{seller.total}</td>
                    <td className="px-8 py-6 font-mono text-indigo-400">{seller.aceitas}</td>
                    <td className="px-8 py-6 font-mono text-emerald-400">{seller.pagas}</td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-black ${
                        convRate >= 50 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        convRate >= 30 ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {convRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-slate-500 font-medium">
                    Nenhum dado de consultor encontrado no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Componente de Card de Métrica (Atualizado para Dark Mode)
const MetricCard = ({ title, value, icon: Icon, trend, trendUp, color }: any) => {
  const getColors = () => {
    switch (color) {
      case 'indigo': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]';
      case 'blue': return 'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]';
      case 'emerald': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]';
      case 'purple': return 'text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]';
      case 'amber': return 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className={`p-8 rounded-[2rem] border transition-all ${getColors()} relative overflow-hidden bg-[#0B0F19]`}>
      <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
        <Icon size={80} />
      </div>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className={`p-3 rounded-xl bg-slate-900/50 backdrop-blur-sm border ${getColors()}`}>
            <Icon size={20} />
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </div>
        </div>
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{title}</h3>
          <p className="text-4xl font-black text-white italic tracking-tighter">{value}</p>
        </div>
      </div>
    </div>
  );
};
