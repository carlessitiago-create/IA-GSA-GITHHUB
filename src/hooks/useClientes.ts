import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const useClientes = (userId: string, role: string, searchTerm: string = '') => {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchClientes = useCallback(async (isInitial: boolean = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const path = 'clients';
      let q;
      const isAdm = role === 'ADM_MASTER' || role === 'ADM_GERENTE' || role === 'ADM_ANALISTA';
      
      const constraints = [];
      if (!isAdm) {
        if (!userId) {
          setLoading(false);
          return;
        }
        if (role === 'CLIENTE') {
          constraints.push(where('uid', '==', userId));
        } else {
          constraints.push(where('visibilidade_uids', 'array-contains', userId));
        }
      }
      
      // Paginação e Ordenação
      constraints.push(orderBy('data_entrada', 'desc'));
      constraints.push(limit(50));
      
      if (!isInitial && lastVisible) {
        constraints.push(startAfter(lastVisible));
      }

      q = query(collection(db, path), ...constraints);
      
      const querySnapshot = await getDocs(q);
      
      const newClientes = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as { nome?: string; [key: string]: any }) }));
      
      // Filtro de busca (se o Firestore não suportar busca por texto completo, 
      // infelizmente ainda precisaremos de um filtro simples no cliente para o termo)
      // Para otimização real, o ideal seria usar Algolia ou similar para busca.
      const filteredClientes = searchTerm 
        ? newClientes.filter(c => (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()))
        : newClientes;

      if (isInitial) {
        setClientes(filteredClientes);
      } else {
        setClientes(prev => [...prev, ...filteredClientes]);
      }
      
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length === 50);
    } catch (err) {
      setError('Erro ao carregar clientes.');
      handleFirestoreError(err, OperationType.LIST, 'clients');
    } finally {
      setLoading(false);
    }
  }, [userId, role, searchTerm, lastVisible, loading]);

  useEffect(() => {
    fetchClientes(true);
  }, [userId, role, searchTerm]);

  return { clientes, loading, error, fetchMore: () => fetchClientes(false), hasMore };
};
