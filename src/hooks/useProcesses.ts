import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { OrderProcess } from '../services/orderService';

export const useProcesses = (profile: any, realIsAdm: boolean, realIsGestor: boolean) => {
  const [processes, setProcesses] = useState<OrderProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    let qProcesses;
    if (realIsAdm) {
      qProcesses = query(collection(db, 'order_processes'), orderBy('venda_id', 'desc'));
    } else if (realIsGestor && profile?.uid) {
      qProcesses = query(collection(db, 'order_processes'), where('id_superior', '==', profile.uid));
    } else if (profile?.nivel === 'VENDEDOR' && profile?.uid) {
      qProcesses = query(collection(db, 'order_processes'), where('vendedor_id', '==', profile.uid));
    } else if (profile?.uid) {
      qProcesses = query(collection(db, 'order_processes'), where('cliente_id', '==', profile.uid));
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(qProcesses, (snapshot) => {
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderProcess));
      if (!realIsAdm) {
        items.sort((a, b) => {
           const vA = a.venda_id || 0;
           const vB = b.venda_id || 0;
           return (vB as number) - (vA as number);
        });
      }
      setProcesses(items);
      setLoading(false);
    }, (error) => {
      setError('Erro ao carregar processos.');
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'order_processes');
    });

    return () => unsubscribe();
  }, [profile, realIsAdm, realIsGestor]);

  return { processes, loading, error };
};
