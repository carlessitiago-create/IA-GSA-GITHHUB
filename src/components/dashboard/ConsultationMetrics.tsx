import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase'; // Ajuste o caminho do seu firebase.ts
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Activity } from 'lucide-react';

export const ConsultationMetrics: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ totalRevenue: 0, adminMargin: 0, totalConsultations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Procurar apenas consultas que foram pagas/concluídas
      const q = query(collection(db, 'consultation_requests'), where('status', 'in', ['paid', 'completed']));
      const querySnapshot = await getDocs(q);
      
      let revenue = 0;
      let margin = 0;
      const chartDataMap: Record<string, any> = {};

      querySnapshot.forEach((doc) => {
        const req = doc.data();
        const amount = req.amount_paid || 0;
        const adminMargin = req.commissions?.admin_margin || 0;
        
        revenue += amount;
        margin += adminMargin;

        // Agrupar por tipo de consulta para o gráfico
        const typeId = req.consultation_type_id || 'Outros';
        if (!chartDataMap[typeId]) {
          chartDataMap[typeId] = { name: typeId, Faturamento: 0, LucroLiquido: 0, vendas: 0 };
        }
        chartDataMap[typeId].Faturamento += amount;
        chartDataMap[typeId].LucroLiquido += adminMargin;
        chartDataMap[typeId].vendas += 1;
      });

      setKpis({ totalRevenue: revenue, adminMargin: margin, totalConsultations: querySnapshot.size });
      setData(Object.values(chartDataMap));

    } catch (error) {
      console.error("Erro ao buscar métricas de consultas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500 animate-pulse">A carregar métricas financeiras...</div>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Activity className="text-blue-600" /> Inteligência de Upsell (Consultas PIX)
      </h2>

      {/* Cartões de KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="text-blue-500 text-sm font-semibold mb-1">Total de Consultas</div>
          <div className="text-2xl font-black text-gray-900">{kpis.totalConsultations}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="text-green-600 text-sm font-semibold mb-1 flex items-center gap-1"><DollarSign size={16}/> Faturamento Bruto</div>
          <div className="text-2xl font-black text-gray-900">R$ {kpis.totalRevenue.toFixed(2).replace('.', ',')}</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 shadow-inner">
          <div className="text-emerald-700 text-sm font-semibold mb-1 flex items-center gap-1"><TrendingUp size={16}/> Lucro Líquido GSA</div>
          <div className="text-2xl font-black text-emerald-900">R$ {kpis.adminMargin.toFixed(2).replace('.', ',')}</div>
          <p className="text-xs text-emerald-600 mt-1">Margem retida após pagamentos e comissões</p>
        </div>
      </div>

      {/* Gráfico de Barras */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{fontSize: 12}} />
            <YAxis tick={{fontSize: 12}} tickFormatter={(value) => `R$${value}`} />
            <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="Faturamento" fill="#93c5fd" name="Faturamento Bruto (R$)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="LucroLiquido" fill="#10b981" name="Lucro Líquido Admin (R$)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
