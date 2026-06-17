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
  premios?: { nome: string; img: string }[];
  servicos?: {
    nome_servico: string;
    icone: string;
    subtitulo?: string;
    topicos?: string[];
  }[];
}

export interface SaasConfig {
  modo_pagamento: 'MANUAL' | 'AUTOMATICO';
  gateway_ativo?: 'MERCADO_PAGO' | 'ASAAS';
  links_manuais: {
    dividas: string;
    bacen: string;
    rating: string;
    master: string;
  };
  mercado_pago_public_key?: string;
  mercado_pago_access_token?: string;
  asaas_key?: string;
  facebook_pixel_id?: string;
  meta_pixel_code?: string;
  meta_conversions_token?: string;
  tiktok_pixel_code?: string;
  instrucoes_checkout: string;
  vsl_youtube_id?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  is_sandbox?: boolean;
}

const CONFIG_COLLECTION = 'platform_config';
const DEFAULT_CONFIG_ID = 'settings';
const PUBLIC_PORTAL_CONFIG_ID = 'portal_publico';
const SAAS_CONFIG_ID = 'saas_settings';

/**
 * Obtém as configurações do portal público
 */
export const getPublicPortalConfig = async (): Promise<PublicPortalConfig> => {
  const cacheKey = `portal_config_data`;
  
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
    const docRef = doc(db, CONFIG_COLLECTION, PUBLIC_PORTAL_CONFIG_ID);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      const data = snap.data() as PublicPortalConfig;
      localStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    }
    
    return defaultConfig;
  } catch (error: any) {
    const cached = localStorage.getItem(cacheKey);
    console.warn("AuthContext: Firestore error or offline for PublicPortalConfig, fallback to cache or default.", error);
    if (cached) {
      return JSON.parse(cached);
    }
    return defaultConfig;
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
  const cacheKey = `platform_config_data`;
  
  const defaultConfig: PlatformConfig = {
    referral_bonus: 50,
    allow_vendedor_set_whatsapp: false
  };

  try {
    const docRef = doc(db, CONFIG_COLLECTION, DEFAULT_CONFIG_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const config = docSnap.data() as PlatformConfig;
      localStorage.setItem(cacheKey, JSON.stringify(config));
      return config;
    }
    
    // Configuração padrão se não existir
    return defaultConfig;
  } catch (error: any) {
    const cached = localStorage.getItem(cacheKey);
    console.warn("AuthContext: Firestore error or offline, fallback to cache or default.", error);
    if (cached) {
      return JSON.parse(cached);
    }
    return defaultConfig;
  }
}

/**
 * Obtém as configurações do SaaS
 */
export async function getSaasConfig(): Promise<SaasConfig> {
  const cacheKey = `saas_config`;
  
  const defaultConfig: SaasConfig = {
    modo_pagamento: 'MANUAL',
    links_manuais: {
      dividas: 'https://link-dividas.com',
      bacen: 'https://link-bacen.com',
      rating: 'https://link-rating.com',
      master: 'https://link-master.com'
    },
    instrucoes_checkout: 'Após o pagamento, seu diagnóstico será liberado em até 24h.',
    vsl_youtube_id: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    is_sandbox: false
  };

  try {
    const docRef = doc(db, CONFIG_COLLECTION, SAAS_CONFIG_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const config = {
        ...defaultConfig,
        ...data,
        links_manuais: {
          ...defaultConfig.links_manuais,
          ...(data.links_manuais || {})
        }
      } as SaasConfig;
      
      localStorage.setItem(cacheKey, JSON.stringify(config));
      return config;
    }
    
    return defaultConfig;
  } catch (error: any) {
    const cached = localStorage.getItem(cacheKey);
    console.warn("AuthContext: Firestore error or offline, fallback to cache or default.", error);
    if (cached) {
      return JSON.parse(cached);
    }
    return defaultConfig;
  }
}

/**
 * Atualiza as configurações do SaaS
 */
export async function updateSaasConfig(data: Partial<SaasConfig>) {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, SAAS_CONFIG_ID);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, CONFIG_COLLECTION);
    throw error;
  }
}

