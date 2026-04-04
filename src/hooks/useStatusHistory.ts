import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StatusHistory } from '../services/orderService';

export const useStatusHistory = () => {
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qHistory = query(collection(db, 'status_history'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(qHistory, (snapshot) => {
      setStatusHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatusHistory)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'status_history');
      setError('Erro ao carregar histórico de status.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { statusHistory, loading, error };
};
