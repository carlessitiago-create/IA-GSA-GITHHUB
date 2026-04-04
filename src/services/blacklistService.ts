import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const BLACKLIST_COLLECTION = 'blacklist';

export interface BlacklistEntry {
  id?: string;
  telefone: string;
  motivo: string;
  autor_id: string;
  autor_nome: string;
  timestamp: any;
}

/**
 * Adiciona um telefone à blacklist
 */
export async function adicionarABlacklist(telefone: string, motivo: string, autorId: string, autorNome: string) {
  try {
    // Limpar telefone (apenas números)
    const telLimpo = telefone.replace(/\D/g, '');
    
    // Verificar se já existe
    const q = query(collection(db, BLACKLIST_COLLECTION), where('telefone', '==', telLimpo));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const docRef = await addDoc(collection(db, BLACKLIST_COLLECTION), {
      telefone: telLimpo,
      motivo,
      autor_id: autorId,
      autor_nome: autorNome,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, BLACKLIST_COLLECTION);
    throw error;
  }
}

/**
 * Verifica se um telefone está na blacklist
 */
export async function verificarBlacklist(telefone: string): Promise<boolean> {
  try {
    const telLimpo = telefone.replace(/\D/g, '');
    const q = query(collection(db, BLACKLIST_COLLECTION), where('telefone', '==', telLimpo));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, BLACKLIST_COLLECTION);
    throw error;
  }
}

/**
 * Lista toda a blacklist
 */
export async function listarBlacklist() {
  try {
    const snap = await getDocs(collection(db, BLACKLIST_COLLECTION));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlacklistEntry));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, BLACKLIST_COLLECTION);
    throw error;
  }
}

/**
 * Remove da blacklist
 */
export async function removerDaBlacklist(id: string) {
  try {
    await deleteDoc(doc(db, BLACKLIST_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, BLACKLIST_COLLECTION);
    throw error;
  }
}
