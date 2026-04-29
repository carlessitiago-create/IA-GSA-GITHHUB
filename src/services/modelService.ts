// src/services/modelService.ts

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface ProcessModel {
  id: string; // ex: 'RATING_CPF'
  nome: string; // ex: 'Rating PF'
  categoria?: string; // ex: 'Crédito', 'Jurídico'
  campos: string[];
  documentos: string[];
  data_atualizacao?: any;
}

const MODELS_COLLECTION = 'process_models';

export async function listarModelosProcesso(): Promise<ProcessModel[]> {
  try {
    const q = query(collection(db, MODELS_COLLECTION), orderBy('nome'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProcessModel));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, MODELS_COLLECTION);
    return [];
  }
}

export async function salvarModeloProcesso(modelo: ProcessModel) {
  if (!modelo || !modelo.id) throw new Error("ID do modelo é obrigatório");
  try {
    const { id, ...data } = modelo;
    await setDoc(doc(db, MODELS_COLLECTION, id), {
      ...data,
      data_atualizacao: new Date()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, MODELS_COLLECTION);
    throw error;
  }
}

export async function excluirModeloProcesso(id: string) {
  if (!id) return;
  try {
    await deleteDoc(doc(db, MODELS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, MODELS_COLLECTION);
    throw error;
  }
}

export async function obterModeloProcesso(id: string): Promise<ProcessModel | null> {
  if (!id) return null;
  try {
    const d = await getDoc(doc(db, MODELS_COLLECTION, id));
    if (d.exists()) {
      return { id: d.id, ...d.data() } as ProcessModel;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, MODELS_COLLECTION);
    return null;
  }
}
