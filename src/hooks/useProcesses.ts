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
      qProcesses = query(collection(db, 'order_processes'), where('id_superior', '==', profile.uid), orderBy('venda_id', 'desc'));
    } else if (profile?.nivel === 'VENDEDOR' && profile?.uid) {
      qProcesses = query(collection(db, 'order_processes'), where('vendedor_id', '==', profile.uid), orderBy('venda_id', 'desc'));
    } else if (profile?.uid) {
      qProcesses = query(collection(db, 'order_processes'), where('cliente_id', '==', profile.uid), orderBy('venda_id', 'desc'));
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(qProcesses, (snapshot) => {
      setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderProcess)));
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
