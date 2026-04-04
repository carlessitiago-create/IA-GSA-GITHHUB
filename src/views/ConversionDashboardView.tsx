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
  Zap
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0a0a2e]"></div>
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
    { name: 'Geradas', value: totalProposals, fill: '#6366f1' },
    { name: 'Visualizadas', value: proposals.filter(p => (p.visualizacoes || 0) > 0).length, fill: '#8b5cf6' },
    { name: 'Aceitas', value: totalAccepted, fill: '#10b981' },
    { name: 'Pagas', value: totalPaid, fill: '#059669' },
  ];

  // Distribuição por Status
  const statusData = [
    { name: 'Abertas', value: proposals.filter(p => p.status === 'ABERTA').length },
    { name: 'Aceitas', value: proposals.filter(p => p.status === 'ACEITA').length },
    { name: 'Pagas', value: proposals.filter(p => p.status === 'PAGA').length },
    { name: 'Recusadas', value: proposals.filter(p => p.status === 'RECUSADA').length },
    { name: 'Expiradas', value: proposals.filter(p => p.status === 'EXPIRADA').length },
  ].filter(d => d.value > 0);

  const COLORS = ['#6366f1', '#10b981', '#059669', '#ef4444', '#94a3b8'];

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
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">
            Dashboard de Conversão
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Acompanhe a eficiência das propostas geradas pela equipe.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
            <Calendar size={16} />
            Últimos 30 dias
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0a0a2e] text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition-colors shadow-lg shadow-indigo-500/20">
            <Download size={16} />
            Exportar
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          color="emerald"
        />
        <MetricCard 
          title="Conversão Final" 
          value={`${conversionRate.toFixed(1)}%`} 
          icon={Zap} 
          trend="+8.2%" 
          trendUp={true}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Funil de Conversão */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Filter size={20} />
              </div>
              <h3 className="font-black text-slate-800 uppercase italic tracking-tighter">Funil de Vendas</h3>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição de Status */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase italic tracking-tighter mb-8 flex items-center gap-3">
            <div className="size-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Target size={20} />
            </div>
            Status das Propostas
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance da Equipe */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-3">
            <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Users size={20} />
            </div>
            Performance por Consultor
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultor</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Propostas</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aceites</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendas</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sellerData.map((seller: any, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        {seller.nome.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-700">{seller.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-600">{seller.total}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">{seller.aceitas}</td>
                  <td className="px-6 py-4 font-bold text-indigo-600">{seller.pagas}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                        <div 
                          className="h-full bg-indigo-500 rounded-full" 
                          style={{ width: `${(seller.pagas / seller.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-slate-500">
                        {((seller.pagas / seller.total) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: any;
  trend: string;
  trendUp: boolean;
  color: 'indigo' | 'blue' | 'emerald' | 'amber';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, trend, trendUp, color }) => {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`size-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${colors[color]}`}>
          <Icon size={24} />
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
          trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        }`}>
          {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </div>
      </div>
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
      <p className="text-2xl font-black text-slate-800 tracking-tighter">{value}</p>
    </div>
  );
};
