import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  memoryLocalCache,
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Import the Firebase configuration
import firebaseConfigImport from '../firebase-applet-config.json';
export const firebaseConfig = firebaseConfigImport;

// Initialize Firebase SDK
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log("Firebase initialized with dbId:", firebaseConfig.firestoreDatabaseId);

export let isPersistenceEnabled = false;
export let persistenceInitializationError: string | null = null;

let firestoreInstance;
try {
  // Detect iframe context (safe check for SSR or other environments)
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  if (isIframe) {
    console.log("[Firebase] Running inside iframe - utilizing memoryLocalCache and long-polling to bypass sandbox lock issues");
    firestoreInstance = initializeFirestore(
      app, 
      {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true 
      },
      firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId
    );
    isPersistenceEnabled = false;
  } else {
    firestoreInstance = initializeFirestore(
      app, 
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        }),
        experimentalForceLongPolling: true 
      },
      firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId
    );
    isPersistenceEnabled = true;
  }
} catch (e: any) {
  persistenceInitializationError = e instanceof Error ? e.message : String(e);
  // CORREÇÃO: Caso o Firestore já tenha sido inicializado (HMR), recupera a instância atrelada ao banco correto
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId);
  
  // Se o erro foi que o Firestore já foi inicializado (comum no HMR), podemos assumir que a persistência está ativa
  if (e?.code === 'failed-precondition' || e?.message?.includes('already exist') || e?.message?.includes('already been initialized')) {
    isPersistenceEnabled = true;
  } else {
    isPersistenceEnabled = false;
  }
}

export const db = firestoreInstance;
console.log("Firestore db instance configured:", db);
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
