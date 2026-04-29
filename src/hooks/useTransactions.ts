import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FinancialTransaction } from '../services/financialService';

export const useTransactions = (profile: any, realIsAdm: boolean, realIsGestor: boolean) => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    let qTrans;
    if (realIsAdm) {
      qTrans = query(collection(db, 'financial_transactions'), orderBy('timestamp', 'desc'));
    } else if (realIsGestor && profile?.uid) {
      qTrans = query(collection(db, 'financial_transactions'), where('id_superior', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else if (profile?.nivel === 'VENDEDOR' && profile?.uid) {
      qTrans = query(collection(db, 'financial_transactions'), where('vendedor_id', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else if (profile?.uid) {
      qTrans = query(collection(db, 'financial_transactions'), where('cliente_id', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialTransaction)));
      setLoading(false);
    }, (error) => {
      setError('Erro ao carregar transações.');
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'financial_transactions');
    });

    return () => unsubscribe();
  }, [profile, realIsAdm, realIsGestor]);

  return { transactions, loading, error };
};
