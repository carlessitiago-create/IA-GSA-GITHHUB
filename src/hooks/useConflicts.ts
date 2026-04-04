import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const useConflicts = (realIsAdm: boolean) => {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!realIsAdm) return;

    const q = query(collection(db, 'conflict_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConflicts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'conflict_logs');
      setError('Erro ao carregar conflitos.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [realIsAdm]);

  return { conflicts, loading, error };
};
