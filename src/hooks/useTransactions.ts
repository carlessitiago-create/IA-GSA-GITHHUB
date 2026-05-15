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
      qTrans = query(collection(db, 'financial_transactions'), where('id_superior', '==', profile.uid));
    } else if (profile?.nivel === 'VENDEDOR' && profile?.uid) {
      qTrans = query(collection(db, 'financial_transactions'), where('vendedor_id', '==', profile.uid));
    } else if (profile?.uid) {
      qTrans = query(collection(db, 'financial_transactions'), where('cliente_id', '==', profile.uid));
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(qTrans, (snapshot) => {
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialTransaction));
      if (!realIsAdm) {
        items.sort((a,b) => {
           const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
           const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
           return timeB - timeA;
        });
      }
      setTransactions(items);
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
