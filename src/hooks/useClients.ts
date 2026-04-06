import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const useClients = (profile: any, realIsAdm: boolean) => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    let qClients;
    if (realIsAdm) {
      qClients = query(collection(db, 'clients'), orderBy('data_entrada', 'desc'));
    } else if (profile?.uid) {
      qClients = query(collection(db, 'clients'), where('visibilidade_uids', 'array-contains', profile.uid), orderBy('data_entrada', 'desc'));
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(qClients, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'clients');
      setError('Erro ao carregar clientes.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, realIsAdm]);

  return { clients, loading, error };
};
