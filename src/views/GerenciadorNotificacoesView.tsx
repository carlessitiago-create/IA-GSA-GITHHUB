import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';

interface Notificacao {
  id: string;
  tipo: 'PAGAMENTO' | 'SUPORTE' | 'ERRO_IA';
  mensagem: string;
  timestamp: any;
}

export const GerenciadorNotificacoes = () => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [filtro, setFiltro] = useState('TODAS');

  useEffect(() => {
    // DOCUMENTAÇÃO: Escuta em tempo real as notificações sem refresh de página
    const q = query(collection(db, "system_notifications"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotificacoes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notificacao)));
    });
    return () => unsubscribe();
  }, []);

  const filtradas = filtro === 'TODAS' ? notificacoes : notificacoes.filter(n => n.tipo === filtro);

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciador GSA</h1>
        <div className="flex gap-2">
          {['TODAS', 'PAGAMENTO', 'SUPORTE', 'ERRO_IA'].map(f => (
            <button 
              key={f} 
              onClick={() => setFiltro(f)}
              className={`px-3 py-1 rounded text-xs ${filtro === f ? 'bg-green-600' : 'bg-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {filtradas.map(n => (
          <div key={n.id} className={`p-4 rounded border-l-4 ${n.tipo === 'ERRO_IA' ? 'border-red-500 bg-slate-800' : 'border-green-500 bg-slate-800'}`}>
            <p className="text-sm font-semibold">[{n.tipo}] - {n.mensagem}</p>
            <span className="text-xs text-slate-500">{n.timestamp?.toDate().toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
