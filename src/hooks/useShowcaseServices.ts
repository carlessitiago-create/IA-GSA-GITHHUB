import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ShowcaseService } from '../services/marketingService';

export const useShowcaseServices = () => {
  const [showcaseServices, setShowcaseServices] = useState<ShowcaseService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'showcase_services'), (snapshot) => {
      setShowcaseServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShowcaseService)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'showcase_services');
      setError('Erro ao carregar serviços da vitrine.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { showcaseServices, loading, error };
};
