import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Import the Firebase configuration
import firebaseConfigImport from '../firebase-applet-config.json';
export const firebaseConfig = firebaseConfigImport;

// Initialize Firebase SDK
export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Use correct domain for Callable Functions
// (We hit the production Firebase Cloud Functions directly using the v2 SDK setup)

export const secondaryAuth = auth; // Simplification for now

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Removes undefined fields from an object to prevent Firestore errors.
 * Recursively cleans nested objects and arrays.
 */
export function cleanData(data: any): any {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => cleanData(item)).filter(item => item !== undefined);
  }
  
  if (typeof data === 'object') {
    // Preserve special objects (FieldValue, Timestamp, Date, etc.)
    if (data.constructor && data.constructor.name && data.constructor.name !== 'Object') return data;
    if (data instanceof Date) return data;

    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      const cleanedValue = cleanData(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  
  return data;
}
