import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { LoteLimpaNome } from '../types/limpaNome';

export const useLoteAtivo = () => {
  const [loteAtivo, setLoteAtivo] = useState<LoteLimpaNome | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca o lote que está com status ABERTO
    const qLote = query(
      collection(db, 'lotes_limpa_nome'), 
      where('status', '==', 'ABERTO'),
      limit(1)
    );

    const unsubscribe = onSnapshot(qLote, (snapshot) => {
      if (!snapshot.empty) {
        setLoteAtivo({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LoteLimpaNome);
      } else {
        setLoteAtivo(null); // Nenhum lote aberto
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { loteAtivo, loading };
};
