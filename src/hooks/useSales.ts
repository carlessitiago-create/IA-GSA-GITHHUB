import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SaleData } from '../services/orderService';

export const useSales = (profile: any, realIsAdm: boolean, realIsGestor: boolean) => {
  const [sales, setSales] = useState<SaleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    let qSales;
    if (realIsAdm) {
      qSales = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
    } else if (realIsGestor && profile?.uid) {
      qSales = query(collection(db, 'sales'), where('managerId', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else if (profile?.nivel === 'VENDEDOR' && profile?.uid) {
      qSales = query(collection(db, 'sales'), where('vendedor_id', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else if (profile?.uid) {
      qSales = query(collection(db, 'sales'), where('cliente_id', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleData)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
      setError('Erro ao carregar vendas.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, realIsAdm, realIsGestor]);

  return { sales, loading, error };
};
