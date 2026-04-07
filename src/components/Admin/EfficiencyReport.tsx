import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, query, onSnapshot } from "firebase/firestore";

interface SellerEfficiency {
  vendedorId: string;
  nome: string;
  mediaHoras: number;
  totalResolvidas: number;
  pendenciasAtivas: number;
}

const EfficiencyReport: React.FC = () => {
  const [report, setReport] = useState<SellerEfficiency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Buscamos todas as pendências (Resolvidas e Ativas)
    const q = query(collection(db, "pendencies"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats: { [key: string]: any } = {};

      snapshot.docs.forEach((doc) => {
        const p = doc.data();
        const vId = p.vendedor_id || p.vendedorId;
        const vNome = p.vendedorNome || p.vendedor_id || p.vendedorId || "Vendedor";

        if (!stats[vId]) {
          stats[vId] = { id: vId, nome: vNome, tempos: [], resolvidas: 0, ativas: 0 };
        }

        if (p.status_pendencia === "RESOLVIDO" && p.resolvidaEm && p.criadaEm) {
          const inicio = p.criadaEm.toDate().getTime();
          const fim = p.resolvidaEm.toDate().getTime();
          const horas = (fim - inicio) / (1000 * 60 * 60); // Converte para horas
          
          stats[vId].tempos.push(horas);
          stats[vId].resolvidas += 1;
        } else if (p.status_pendencia !== "RESOLVIDO") {
          stats[vId].ativas += 1;
        }
      });

      const finalReport = Object.values(stats).map(s => ({
        vendedorId: s.id,
        nome: s.nome,
        totalResolvidas: s.resolvidas,
        pendenciasAtivas: s.ativas,
        mediaHoras: s.tempos.length > 0 ? s.tempos.reduce((a:number,b:number)=>a+b, 0) / s.tempos.length : 0
      })).sort((a, b) => a.mediaHoras - b.mediaHoras); // Menor tempo primeiro

      setReport(finalReport);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="p-10 text-center animate-pulse font-black uppercase text-[10px] tracking-widest text-slate-400">Gerando relatório de auditoria...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">Relatório de Eficiência</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">SLA de Resolução de Pendências por Vendedor</p>
        </div>
        <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
             <span className="text-[10px] font-black text-blue-600 uppercase">Média Global: </span>
             <span className="text-sm font-black text-blue-800">
                {(report.reduce((a,b)=>a+b.mediaHoras,0)/report.length || 0).toFixed(1)}h
             </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-6">Especialista</th>
              <th className="px-8 py-6 text-center">Resolvidas</th>
              <th className="px-8 py-6 text-center">Ativas (Gargalo)</th>
              <th className="px-8 py-6 text-right">Tempo Médio (SLA)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {report.map((item) => (
              <tr key={item.vendedorId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                <td className="px-8 py-5 font-bold text-slate-800 dark:text-slate-200">{item.nome}</td>
                <td className="px-8 py-5 text-center">
                    <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-black">{item.totalResolvidas}</span>
                </td>
                <td className="px-8 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-black ${item.pendenciasAtivas > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                        {item.pendenciasAtivas}
                    </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex flex-col items-end">
                    <span className={`text-sm font-black ${item.mediaHoras > 24 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {item.mediaHoras.toFixed(1)} horas
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">por pendência</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.length === 0 && <p className="p-20 text-center text-slate-400 italic">Nenhum dado de auditoria encontrado.</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100">
              <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-2">Insight de Agilidade</h4>
              <p className="text-xs text-emerald-800 font-medium leading-relaxed">Vendedores com tempo médio abaixo de 4h aumentam a satisfação do cliente em 40% e aceleram o ciclo de pagamento.</p>
          </div>
          <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
              <h4 className="text-[10px] font-black text-red-600 uppercase mb-2">Alerta de Retenção</h4>
              <p className="text-xs text-red-800 font-medium leading-relaxed">Pendências ativas com mais de 48h sem interação indicam possível abandono de processo ou falha de comunicação do vendedor.</p>
          </div>
      </div>
    </div>
  );
};

export default EfficiencyReport;
