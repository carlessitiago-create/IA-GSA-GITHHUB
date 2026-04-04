import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { FIELD_LABELS as DEFAULT_FIELDS, DOCUMENT_LABELS as DEFAULT_DOCS } from '../constants/processRequirements';

export interface RequirementsConfig {
  field_labels: Record<string, string>;
  document_labels: Record<string, string>;
}

const CONFIG_DOC_PATH = 'config/requirements';

export const getRequirementsConfig = async (): Promise<RequirementsConfig> => {
  const docRef = doc(db, CONFIG_DOC_PATH);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as RequirementsConfig;
  } else {
    // Initialize with defaults if not exists
    const initialConfig: RequirementsConfig = {
      field_labels: DEFAULT_FIELDS,
      document_labels: DEFAULT_DOCS
    };
    await setDoc(docRef, initialConfig);
    return initialConfig;
  }
};

export const saveRequirementsConfig = async (config: RequirementsConfig) => {
  const docRef = doc(db, CONFIG_DOC_PATH);
  await setDoc(docRef, config);
};

export const subscribeToRequirements = (callback: (config: RequirementsConfig) => void) => {
  const docRef = doc(db, CONFIG_DOC_PATH);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as RequirementsConfig);
    } else {
      callback({
        field_labels: DEFAULT_FIELDS,
        document_labels: DEFAULT_DOCS
      });
    }
  });
};
