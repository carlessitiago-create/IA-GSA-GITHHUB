import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { User } from "firebase/auth";
import { TrendingUp, Award, Users as UsersIcon } from "lucide-react";

interface SellerRanking {
  id: string;
  nome: string;
  totalVendido: number;
  quantidadeVendas: number;
}

const TeamIntelligence: React.FC<{ user: User }> = ({ user }) => {
  const [ranking, setRanking] = useState<SellerRanking[]>([]);
  const [totalEquipe, setTotalEquipe] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Buscamos todas as vendas que pertencem a este Gestor
    // Usamos a coleção 'sales' que é a padrão do projeto
    const q = query(
      collection(db, "sales"),
      where("managerId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const perfMap: { [key: string]: SellerRanking } = {};
      let totalGeral = 0;

      snapshot.docs.forEach((doc) => {
        const venda = doc.data();
        const v_id = venda.vendedor_id; // Ajustado para o padrão do projeto
        const v_nome = venda.vendedor_nome || "Vendedor Externo"; // Ajustado para o padrão do projeto
        const valor = Number(venda.valor_total) || 0;

        totalGeral += valor;

        if (v_id) {
          if (!perfMap[v_id]) {
            perfMap[v_id] = { id: v_id, nome: v_nome, totalVendido: 0, quantidadeVendas: 0 };
          }

          perfMap[v_id].totalVendido += valor;
          perfMap[v_id].quantidadeVendas += 1;
        }
      });

      // Transformar o mapa em array e ordenar pelo maior valor vendido
      const sortedRanking = Object.values(perfMap).sort((a, b) => b.totalVendido - a.totalVendido);
      
      setRanking(sortedRanking);
      setTotalEquipe(totalGeral);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar inteligência de equipe:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) return (
    <div className="p-10 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Processando métricas da equipe...</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Resumo da Equipe */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0a0a2e] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-2">Faturamento Total da Equipe</p>
            <h3 className="text-4xl font-black text-emerald-400">R$ {totalEquipe.toLocaleString('pt-BR')}</h3>
            <p className="text-xs mt-4 opacity-70 italic">Baseado em {ranking.reduce((acc, s) => acc + s.quantidadeVendas, 0)} vendas concluídas.</p>
          </div>
          <TrendingUp className="absolute -right-4 -bottom-4 size-32 opacity-10" />
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Melhor Performance</p>
                <h3 className="text-2xl font-black text-slate-800 truncate max-w-[200px]">{ranking[0]?.nome || "Nenhum dado"}</h3>
                <p className="text-blue-600 font-bold text-xs mt-2">Líder do Ranking atual</p>
            </div>
            <div className="size-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Award size={32} />
            </div>
        </div>
      </div>

      {/* Ranking de Vendedores */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <UsersIcon size={16} className="text-blue-600" />
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Ranking de Performance (Vendedores)</h4>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {ranking.map((vendedor, index) => (
            <div key={vendedor.id} className="flex items-center gap-4">
              <div className={`size-10 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-amber-400 text-white shadow-lg shadow-amber-200' : 'bg-slate-100 text-slate-400'}`}>
                {index + 1}º
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-end mb-2">
                  <p className="font-bold text-slate-800">{vendedor.nome}</p>
                  <p className="text-xs font-black text-slate-900">R$ {vendedor.totalVendido.toLocaleString('pt-BR')}</p>
                </div>
                {/* Barra de Progresso Visual */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-1000" 
                    style={{ width: `${(vendedor.totalVendido / (ranking[0].totalVendido || 1)) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase italic">{vendedor.quantidadeVendas} vendas realizadas</p>
                  <p className="text-[10px] text-blue-600 font-black uppercase tracking-tighter">
                    {((vendedor.totalVendido / (totalEquipe || 1)) * 100).toFixed(1)}% do total
                  </p>
                </div>
              </div>
            </div>
          ))}
          {ranking.length === 0 && (
            <div className="text-center py-12">
              <UsersIcon size={48} className="text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 italic">Nenhum dado de venda para esta equipe ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamIntelligence;
