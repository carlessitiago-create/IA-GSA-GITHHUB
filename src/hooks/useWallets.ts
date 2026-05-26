import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { getOrCreateWallet, registrarTransacao } from '../services/financialService';

export interface Wallet {
  id?: string;
  cliente_id: string;
  saldo_atual: number;
  saldo_bonus: number;
  saldoDisponivel: number;
}

export const useWallets = () => {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<Wallet>({ cliente_id: '', saldo_atual: 0, saldo_bonus: 0, saldoDisponivel: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }

    const qWallets = query(collection(db, 'wallets'), where('cliente_id', '==', profile.uid));
    const unsubscribe = onSnapshot(qWallets, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setWallet({ 
          id: docSnap.id, 
          cliente_id: data.cliente_id,
          saldo_atual: data.saldo_atual || 0,
          saldo_bonus: data.saldo_bonus || 0,
          saldoDisponivel: (data.saldo_atual || 0) + (data.saldo_bonus || 0)
        });
      } else {
        // Fallback para wallet vazia se não existir
        setWallet({ cliente_id: profile.uid, saldo_atual: 0, saldo_bonus: 0, saldoDisponivel: 0 });
      }
      setLoading(false);
    }, (err) => {
      setError('Erro ao carregar carteira.');
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, 'wallets');
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const usarSaldoParaAbatimento = async (valorServico: number) => {
    if (!profile?.uid) return false;
    try {
      await registrarTransacao(
        profile.uid,
        -valorServico,
        'DEBITO',
        'PAGAMENTO_MANUAL',
        'Abatimento de serviço via saldo interno',
        true
      );
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return { wallet, loading, error, usarSaldoParaAbatimento };
};
