import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ShowcaseLead } from '../services/marketingService';

export const useShowcaseLeads = (profile: any, realIsAdm: boolean, realIsGestor: boolean) => {
  const [showcaseLeads, setShowcaseLeads] = useState<ShowcaseLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    let qLeads;
    if (realIsAdm || realIsGestor) {
      qLeads = query(collection(db, 'showcase_leads'), orderBy('timestamp', 'desc'));
    } else if (profile?.nivel === 'VENDEDOR' && profile?.uid) {
      qLeads = query(collection(db, 'showcase_leads'), where('vendedor_id', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else if (profile?.uid) {
      qLeads = query(collection(db, 'showcase_leads'), where('cliente_id', '==', profile.uid), orderBy('timestamp', 'desc'));
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(qLeads, (snapshot) => {
      setShowcaseLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShowcaseLead)));
      setLoading(false);
    }, (error) => {
      setError('Erro ao carregar leads da vitrine.');
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'showcase_leads');
    });

    return () => unsubscribe();
  }, [profile, realIsAdm, realIsGestor]);

  return { showcaseLeads, loading, error };
};
