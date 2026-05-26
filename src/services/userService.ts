import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  where,
  writeBatch,
  limit
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { db, secondaryAuth, auth, handleFirestoreError, OperationType } from '../firebase';

export interface UserProfile {
  uid: string;
  nome_completo: string;
  email: string;
  nivel: 'ADM_MASTER' | 'ADM_MESTRE' | 'ADM_ANALISTA' | 'ADM_GERENTE' | 'GESTOR' | 'VENDEDOR' | 'CLIENTE' | 'ADM';
  id_superior?: string;
  vendedor_id?: string;
  saldo_pontos?: number;
  nivel_fidelidade?: 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';
  indicado_por_uid?: string;
  gestor_id?: string;
  managerId?: string;
  data_cadastro: any;
  ativo: boolean;
  cpf?: string;
  data_nascimento?: string;
  telefone?: string;
  whatsapp?: string;
  tem_empresa?: boolean;
  nome_empresa?: string;
  cnpj?: string;
  status_conta?: 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'SUSPENSO' | 'BLOQUEADO';
  percentual_empresa?: number;
}

const COLLECTION_NAME = 'usuarios';

import { httpsCallable } from 'firebase/functions';
import { app, functions } from '../firebase';

export async function createSecondaryUser(dados: Omit<UserProfile, 'uid' | 'data_cadastro' | 'ativo' | 'status'> & { senha?: string }, creatorRole: string) {
  try {
    // Trava de segurança: GESTOR não cria ADMIN
    if (creatorRole === 'GESTOR' && (dados.nivel === 'ADM_MASTER' || dados.nivel === 'ADM_GERENTE')) {
      throw new Error("Você não tem permissão para criar este nível de usuário.");
    }

    const criarAdministradorDeUsuarios = httpsCallable(functions, 'criarAdministradorDeUsuarios');
    const result = await criarAdministradorDeUsuarios(dados);
    
    return result.data as { uid: string };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    throw error;
  }
}

export async function listarTodosUsuarios() {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('data_cadastro', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    throw error;
  }
}

export async function listarEspecialistas() {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('nivel', 'in', ['GESTOR', 'VENDEDOR']),
      where('ativo', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    throw error;
  }
}

export async function excluirUsuario(uid: string) {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
    throw error;
  }
}

export async function atualizarNivelUsuario(uid: string, novoNivel: UserProfile['nivel']) {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, uid), { nivel: novoNivel });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
}

export async function editarUsuario(uid: string, dados: Partial<UserProfile>) {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, uid), dados);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
}

export async function atualizarStatusAprovacao(uid: string, status: UserProfile['status_conta']) {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, uid), { status_conta: status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
}

export async function atualizarStatusUsuario(uid: string, ativo: boolean) {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, uid), { ativo });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
}

export async function enviarEmailResetSenha(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
}

export const vincularHistoricoPublico = async (uid: string, cpf: string) => {
  if (!cpf) return;
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    const batch = writeBatch(db);
    let count = 0;

    // 1. Referrals
    const qRef = query(collection(db, 'referrals'), where('cliente_origem_id', '==', cleanCpf), where('cadastrado', '==', false));
    const snapRef = await getDocs(qRef);
    snapRef.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { cliente_origem_id: uid, cadastrado: true });
      count++;
    });

    let lastVendedorId = null;
    let lastIdSuperior = null;

    // 2. Order Processes
    const limitMax = 50;
    const collectionsToUpdate = [
      { name: 'order_processes', field: 'cliente_cpf_cnpj' },
      { name: 'sales', field: 'cliente_cpf_cnpj' },
      { name: 'pendencies', field: 'cliente_cpf_cnpj' }
    ] as const;

    for (const coll of collectionsToUpdate) {
      try {
        const qDocs = query(collection(db, coll.name), where(coll.field, '==', cleanCpf), limit(limitMax));
        const snap = await getDocs(qDocs);
        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.cliente_id !== uid) {
            batch.update(docSnap.ref, { cliente_id: uid });
            count++;
          }
          if (data.vendedor_id && !lastVendedorId) lastVendedorId = data.vendedor_id;
          if (data.id_superior && !lastIdSuperior) lastIdSuperior = data.id_superior;
        });
      } catch (e) {
        console.warn(`Erro ao vincular histórico em ${coll.name}:`, e);
      }
    }

    if (lastVendedorId || lastIdSuperior) {
       const userUpdate: any = {};
       if (lastVendedorId) userUpdate.vendedor_id = lastVendedorId;
       // Often id_superior acts as the manager or the direct seller if no manager.
       if (lastIdSuperior) userUpdate.id_superior = lastIdSuperior;
       else if (lastVendedorId) userUpdate.id_superior = lastVendedorId; // Fallback

       try {
           batch.update(doc(db, 'usuarios', uid), userUpdate);
       } catch (e) {
           console.warn('Erro ao atualizar usuario com hierarquia', e);
       }
    }

    // 3. Wallets e Transactions
    try {
        // As vezes wallet está salva pelo CPF na collection
        const walletQuery = query(collection(db, 'wallets'), where('cliente_id', '==', cleanCpf), limit(1));
        const walletSnap = await getDocs(walletQuery);
        if (!walletSnap.empty) {
             const walletDoc = walletSnap.docs[0];
             batch.update(walletDoc.ref, { cliente_id: uid });
             count++;
        }
        
        const transQuery = query(collection(db, 'financial_transactions'), where('cliente_id', '==', cleanCpf), limit(limitMax));
        const transSnap = await getDocs(transQuery);
        transSnap.docs.forEach(docSnap => {
             const data = docSnap.data();
             if (data.cliente_id !== uid) {
                 batch.update(docSnap.ref, { cliente_id: uid });
                 count++;
             }
        });
    } catch (e) {
        console.warn(`Erro ao vincular transactions:`, e);
    }

    if (count > 0) {
      await batch.commit();
      console.log(`vincularHistoricoPublico: Vinculou ${count} registros ao UID ${uid}`);
    }
  } catch (error) {
    console.error("Erro ao vincular histórico:", error);
  }
};
