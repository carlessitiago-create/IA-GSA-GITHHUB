import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Loader2, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

export const AdminConsultationHistoryView: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'consultation_requests'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredRequests = requests.filter(req => {
    const term = searchTerm.toLowerCase();
    return (
      (req.id && req.id.toLowerCase().includes(term)) ||
      (req.payment_id && req.payment_id.toLowerCase().includes(term)) ||
      (req.client_id && req.client_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Histórico de Consultas</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Acompanhe em tempo real todas as consultas geradas pelos clientes via integração com provedores.
          </p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-3">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
            <input 
              type="text" 
              placeholder="Buscar por ID, Pagamento, Cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none text-sm font-medium text-slate-700 shadow-sm"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="size-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium mt-4">Carregando histórico...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Cliente / ID</th>
                  <th className="px-6 py-4">Pagamento</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Resultado / Input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      {req.created_at ? new Date(req.created_at.toDate()).toLocaleString('pt-BR') : '...'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      ID Serv: {req.consultation_type_id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-medium">{req.client_id}</div>
                      <div className="text-slate-400 text-xs">Pedido: {req.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      {req.amount_paid ? `R$ ${req.amount_paid.toFixed(2)}` : 'R$ 0.00'}
                      <div className="text-[10px] text-slate-400 font-mono mt-1">PIX: {req.payment_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold leading-none
                        ${req.status === 'completed' ? 'bg-green-100 text-green-700' :
                          req.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' :
                          req.status === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }
                      `}>
                        {req.status === 'completed' ? <CheckCircle className="size-3.5" /> : 
                         req.status === 'error' ? <XCircle className="size-3.5" /> : 
                         <Clock className="size-3.5 animate-pulse" />}
                        {req.status.toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        {req.result_data ? (
                           <button onClick={() => alert(JSON.stringify(req.result_data, null, 2))} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-lg transition">
                             <FileText className="size-3.5" />
                             VER DADOS
                           </button>
                        ) : '--'}
                    </td>
                  </tr>
                ))}
                
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <Search className="size-8 mx-auto mb-3 text-slate-300" />
                      Nenhuma consulta encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
