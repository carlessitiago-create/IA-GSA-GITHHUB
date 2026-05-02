import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';

// Definição do formato da notificação para o TypeScript
interface Notificacao {
  id: string;
  tipo: 'PAGAMENTO' | 'SUPORTE' | 'ERRO_IA';
  mensagem: string;
  lida: boolean;
  timestamp: any;
  prioridade: 'alta' | 'media' | 'baixa';
}

export const GerenciadorNotificacoesView = () => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [filtro, setFiltro] = useState('TODAS');

  useEffect(() => {
    // Ordenamos pela data mais recente e limitamos às últimas 50
    const q = query(collection(db, "system_notifications"), orderBy("timestamp", "desc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Notificacao[] = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() } as Notificacao);
      });
      setNotificacoes(lista);
    });

    return () => unsubscribe();
  }, []);

  // Lógica de filtragem simples e eficiente
  const notificacoesFiltradas = filtro === 'TODAS' 
    ? notificacoes 
    : notificacoes.filter(n => n.tipo === filtro);

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-green-500">Monitoramento GSA</h1>
        
        {/* Filtros rápidos */}
        <div className="flex gap-2">
          {['TODAS', 'PAGAMENTO', 'SUPORTE', 'ERRO_IA'].map(f => (
            <button 
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-full text-xs ${filtro === f ? 'bg-green-600' : 'bg-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {notificacoesFiltradas.map((notif) => (
          <div key={notif.id} className="bg-slate-800 p-4 rounded-lg border-l-4 border-green-500 flex justify-between items-center">
            <div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block ${
                notif.tipo === 'ERRO_IA' ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'
              }`}>
                {notif.tipo}
              </span>
              <p className="text-sm">{notif.mensagem}</p>
              <span className="text-xs text-slate-500 italic">
                {notif.timestamp?.toDate().toLocaleString('pt-BR')}
              </span>
            </div>
            
            <button className="text-xs text-slate-400 hover:text-white underline">
              Ver Detalhes
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
