import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface PlatformConfig {
  referral_bonus: number;
  allow_vendedor_set_whatsapp?: boolean;
  whatsapp_suporte_geral?: string;
  whatsapp_negociacao?: string;
}

export interface PublicPortalConfig {
  titulo_portal: string;
  mensagem_boas_vindas: string;
  cor_primaria: string;
  link_video_explicativo: string;
  whatsapp_suporte_geral: string;
  whatsapp_negociacao?: string;
  bonus_indicacao: number;
  contato_suporte: string;
  logo_url?: string;
  status_labels?: { [key: string]: string }; // De: "EM_ANALISE" Para: "Estamos analisando seus documentos"
}

const CONFIG_COLLECTION = 'platform_config';
const DEFAULT_CONFIG_ID = 'settings';
const PUBLIC_PORTAL_CONFIG_ID = 'portal_publico';

/**
 * Obtém as configurações do portal público
 */
export const getPublicPortalConfig = async (): Promise<PublicPortalConfig> => {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, PUBLIC_PORTAL_CONFIG_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data() as PublicPortalConfig;
    
    // Default caso não exista
    const defaultConfig: PublicPortalConfig = {
      titulo_portal: 'Consulta de Processos GSA',
      mensagem_boas_vindas: "Bem-vindo ao portal de acompanhamento GSA",
      cor_primaria: "#0a0a2e",
      link_video_explicativo: '',
      whatsapp_suporte_geral: '5511999999999',
      bonus_indicacao: 50.00,
      contato_suporte: ""
    };

    try {
      await setDoc(docRef, defaultConfig);
    } catch (e) {
      console.warn('Could not create default public portal config');
    }

    return defaultConfig;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, CONFIG_COLLECTION);
    throw error;
  }
};

/**
 * Atualiza as configurações do portal público
 */
export async function updatePublicPortalConfig(data: Partial<PublicPortalConfig>) {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, PUBLIC_PORTAL_CONFIG_ID);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, CONFIG_COLLECTION);
    throw error;
  }
}

/**
 * Obtém as configurações da plataforma
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, DEFAULT_CONFIG_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as PlatformConfig;
    }
    
    // Configuração padrão se não existir
    const defaultConfig: PlatformConfig = {
      referral_bonus: 50,
      allow_vendedor_set_whatsapp: false
    };
    
    try {
      await setDoc(docRef, defaultConfig);
    } catch (e) {
      // Ignore setDoc error (e.g. permission denied for non-admins)
      console.warn('Could not create default platform config, using defaults in memory.');
    }
    
    return defaultConfig;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, CONFIG_COLLECTION);
    throw error;
  }
}

/**
 * Atualiza as configurações da plataforma
 */
export async function updatePlatformConfig(data: Partial<PlatformConfig>) {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, DEFAULT_CONFIG_ID);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, CONFIG_COLLECTION);
    throw error;
  }
}

