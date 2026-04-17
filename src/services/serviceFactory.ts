import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface ServiceData {
  id?: string;
  nome_servico: string;
  descricao?: string;
  video_youtube_url?: string;
  video_youtube_id?: string;
  video_thumbnail_url?: string;
  prazo_sla_dias: number;
  preco_base_gestor: number;
  preco_base_vendedor: number;
  preco_massa_gestor?: number;
  preco_massa_vendedor?: number;
  is_mass_sale_active?: boolean;
  ciclo_status: 'LIBERADO' | 'ENCERRADO';
  ativo: boolean;
  criado_em?: any;
  vendas_count?: number;
  bloqueado_ate?: any;
  mensagem_publica?: string;
  mensagem_interna?: string;
  pontos_cliente?: number;
  pontos_vendedor?: number;
  pontos_gestor?: number;
  possui_garantia?: boolean;
  slug?: string;
  requisitos_documentos?: string[];
  requisitos_campos?: string[];
}

const COLLECTION_NAME = 'services';

export async function criarServico(data: ServiceData) {
  try {
    const serviceWithDefaults = {
      ...data,
      pontos_cliente: data.pontos_cliente ?? 10,
      pontos_vendedor: data.pontos_vendedor ?? 50,
      pontos_gestor: data.pontos_gestor ?? 20,
      ativo: data.ativo ?? true,
      ciclo_status: data.ciclo_status ?? 'LIBERADO'
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), serviceWithDefaults);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    throw error;
  }
}

export async function atualizarServico(id: string, data: Partial<ServiceData>) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    throw error;
  }
}

export async function listarServicosAtivos() {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('ativo', '==', true),
      where('ciclo_status', '==', 'LIBERADO')
    );
    const querySnapshot = await getDocs(q);
    const now = new Date();
    return querySnapshot.docs
      .map(doc => ({ id: doc.id, ...(doc.data() as ServiceData) }))
      .filter(service => {
        if (!service.bloqueado_ate) return true;
        return new Date(service.bloqueado_ate) <= now;
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    throw error;
  }
}

export async function listarTodosServicos() {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as ServiceData) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    throw error;
  }
}

/**
 * Valida se o preço digitado está de acordo com o nível do usuário e o preço base do serviço.
 */
export function validarPrecoServico(
  valorDigitado: number, 
  servico: ServiceData, 
  role: string
): { valido: boolean; erro?: string } {
  // ADM_MASTER e ADM_GERENTE podem vender pelo preço base do gestor (custo)
  // GESTOR deve vender acima do preço base do gestor
  // VENDEDOR deve vender acima do preço base do vendedor (piso do gestor)
  
  let precoMinimo = servico.preco_base_vendedor;

  if (role === 'ADM_MASTER' || role === 'ADM_GERENTE' || role === 'ADM_ANALISTA') {
    precoMinimo = servico.preco_base_gestor;
  } else if (role === 'GESTOR') {
    precoMinimo = servico.preco_base_gestor;
  } else if (role === 'VENDEDOR') {
    precoMinimo = servico.preco_base_vendedor;
  }

  if (valorDigitado < precoMinimo) {
    return { 
      valido: false, 
      erro: `PRECO_ABAIXO_DO_MINIMO: Você não tem autorização para vender este serviço abaixo de R$ ${precoMinimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Fale com seu superior.` 
    };
  }

  return { valido: true };
}
