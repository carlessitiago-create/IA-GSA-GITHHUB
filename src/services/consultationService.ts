// src/services/consultationService.ts
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase'; // Ajuste o caminho do seu db
import { ConsultationType } from '../types/consultation';

const COLLECTION_NAME = 'consultation_types';

export const getConsultationTypes = async (): Promise<ConsultationType[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ConsultationType[];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    throw error;
  }
};

export const createConsultationType = async (data: Omit<ConsultationType, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    throw error;
  }
};

export const updateConsultationType = async (id: string, data: Partial<ConsultationType>) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
};

export const deleteConsultationType = async (id: string) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
    throw error;
  }
};
