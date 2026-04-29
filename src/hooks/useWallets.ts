import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Wallet } from '../services/financialService';

export const useWallets = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qWallets = query(collection(db, 'wallets'), orderBy('saldo_atual', 'desc'));
    const unsubscribe = onSnapshot(qWallets, (snapshot) => {
      setWallets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet)));
      setLoading(false);
    }, (error) => {
      setError('Erro ao carregar carteiras.');
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'wallets');
    });

    return () => unsubscribe();
  }, []);

  return { wallets, loading, error };
};
