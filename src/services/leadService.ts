import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, cleanData } from '../firebase';
import { validateDocument } from '../utils/validators';

export interface ClientData {
  id?: string;
  uid?: string;
  nome: string;
  documento: string;
  telefone: string;
  whatsapp?: string;
  email?: string;
  data_nascimento?: string;
  especialista_id: string;
  id_superior?: string;
  visibilidade_uids?: string[];
  data_entrada: any;
  
  // Novos campos PF
  estado_civil?: string;
  profissao?: string;
  renda_mensal?: number;
  endereco?: string;
  titulo_eleitor?: string;
  nome_pai?: string;
  nome_mae?: string;
  banco_nome?: string;
  banco_agencia?: string;
  banco_conta?: string;

  // Novos campos PJ
  razao_social?: string;
  cnpj?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  regime_tributario?: string;
  bens_patrimoniais?: string;
  faturamento_mensal?: number;
  endereco_comercial?: string;

  // Campos de processo específicos
  valor_pedido?: number;
  parcelas_pagas?: number;
  parcelas_atrasadas?: number;
  total_parcelas_contrato?: number;
  tipo_indenizacao?: string;
  tipo_sinistro?: string;
}

export async function verificarPropriedadeLead(documento: string, telefone: string, userId: string) {
  if (!documento || !telefone) throw new Error('Documento e telefone são obrigatórios para verificar propriedade.');
  const path = 'clients';
  try {
    // Check by document
    const qDoc = query(collection(db, path), where('documento', '==', documento));
    const snapDoc = await getDocs(qDoc);
    
    // Check by phone
    const qTel = query(collection(db, path), where('telefone', '==', telefone));
    const snapTel = await getDocs(qTel);

    const existingDoc = !snapDoc.empty ? snapDoc.docs[0] : !snapTel.empty ? snapTel.docs[0] : null;

    if (existingDoc) {
      const clientData = existingDoc.data();

      if (clientData.especialista_id === userId) {
        return { status: 'DONO_PROPRIO', clientId: existingDoc.id };
      } else {
        // Grava Log de Conflito
        await addDoc(collection(db, 'conflict_logs'), {
          tentou_id: userId,
          dono_id: clientData.especialista_id,
          cliente_documento: documento,
          cliente_telefone: telefone,
          timestamp: serverTimestamp()
        });
        return { status: 'BLOQUEIO_CARTEIRA', donoId: clientData.especialista_id };
      }
    }

    return { status: 'LIVRE' };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function cadastrarCliente(data: Omit<ClientData, 'data_entrada' | 'id_superior'>) {
  if (!validateDocument(data.documento)) {
    throw new Error('CPF ou CNPJ inválido');
  }
  const path = 'clients';
  try {
    const visibilidade_uids = [data.especialista_id];
    let id_superior = null;

    // Fetch specialist's hierarchy - Skip if not authenticated to avoid permission errors
    if (auth.currentUser) {
      let currentSuperiorId = data.especialista_id;
      let depth = 0;
      while (currentSuperiorId && depth < 5) { // Limit depth to prevent infinite loops
        const userSnap = await getDoc(doc(db, 'usuarios', currentSuperiorId));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (depth === 0) {
            id_superior = userData.id_superior || null;
          }
          
          if (userData.id_superior && !visibilidade_uids.includes(userData.id_superior)) {
            visibilidade_uids.push(userData.id_superior);
            currentSuperiorId = userData.id_superior;
            depth++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }

    // --- AI TRIAGE INJECTION ---
    let aiScoreMsg = '';
    let aiInsights = null;
    try {
      const { analyzeSmartFicha } = await import('./aiService');
      const triageResult = await analyzeSmartFicha({
        nome: data.nome,
        telefone: data.telefone,
        email: data.email,
        documento: data.documento,
        origem: 'Landing Page SaaS'
      });
      aiInsights = triageResult;
      aiScoreMsg = `\r\n🔥 Score IA: ${triageResult.urgencyScore}% - Pitch Sugerido: ${triageResult.salesPitch}`;
    } catch (err) {
      console.warn("AI Triage falhou silenciosamente", err);
    }
    // ---------------------------

    const docRef = await addDoc(collection(db, path), cleanData({
      ...data,
      id_superior,
      visibilidade_uids,
      data_nascimento: data.data_nascimento || '',
      data_entrada: serverTimestamp(),
      ai_insights: aiInsights
    }));

    // Alert admins if lead is "orphan" (e.g., from SaaS Landing Page without specific seller)
    if (!data.especialista_id || data.especialista_id === 'ADM' || data.especialista_id === 'SaaS_GSA_IA') {
      try {
        const { sendNotification } = await import('./notificationService');
        const adminsSnapshot = await getDocs(query(collection(db, 'usuarios'), where('nivel', 'in', ['ADM_MASTER', 'ADM_GERENTE'])));
        for (const adminDoc of adminsSnapshot.docs) {
          await sendNotification({
            usuario_id: adminDoc.id,
            titulo: '🚨 Lead Órfão Capturado (SaaS)' + (aiScoreMsg ? ` 🔥` : ''),
            mensagem: `O lead ${data.nome} se cadastrou através de uma Landing Page sem Vendedor. Atribua um especialista imediatamente!${aiScoreMsg}`,
            tipo: 'NEW_LEAD'
          });
        }
      } catch (err) {
        console.error("Failed to notify admins of orphan lead", err);
      }
    }

    return { id: docRef.id, id_superior, visibilidade_uids, data_nascimento: data.data_nascimento || '' };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function listarClientes(userId: string, role: string) {
  if (!userId) return [];
  const path = 'clients';
  try {
    let q;
    const isAdm = role === 'ADM_MASTER' || role === 'ADM_GERENTE' || role === 'ADM_ANALISTA';
    if (isAdm) {
      q = query(collection(db, path));
    } else if (role === 'CLIENTE') {
      // Client sees their own record (where uid matches or visibilidade_uids contains it)
      q = query(collection(db, path), where('uid', '==', userId));
    } else {
      // Both GESTOR and VENDEDOR use visibilidade_uids
      q = query(collection(db, path), where('visibilidade_uids', 'array-contains', userId));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export async function resolverConflito(conflitoId: string, acao: 'TRANSFERIR' | 'MANTER', clienteDocumento: string, novoEspecialistaId: string) {
  if (!clienteDocumento) throw new Error('Documento do cliente é obrigatório para resolver conflito.');
  try {
    if (acao === 'TRANSFERIR') {
      // Find the client by document
      const qDoc = query(collection(db, 'clients'), where('documento', '==', clienteDocumento));
      const snapDoc = await getDocs(qDoc);
      if (!snapDoc.empty) {
        const clientId = snapDoc.docs[0].id;
        // Fetch specialist's superior
        const userSnap = await getDoc(doc(db, 'usuarios', novoEspecialistaId));
        const id_superior = userSnap.exists() ? (userSnap.data().id_superior || null) : null;
        
        await updateDoc(doc(db, 'clients', clientId), {
          especialista_id: novoEspecialistaId,
          id_superior: id_superior
        });
      }
    }
    
    // Mark conflict as resolved or delete it
    await deleteDoc(doc(db, 'conflict_logs', conflitoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'conflict_logs');
    throw error;
  }
}

export async function updateCliente(clientId: string, data: Partial<ClientData>) {
  const path = 'clients';
  try {
    if (data.documento && !validateDocument(data.documento)) {
      throw new Error('CPF ou CNPJ inválido');
    }
    await updateDoc(doc(db, path, clientId), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function getClienteData(clientId: string) {
  if (!clientId) return null;
  const path = 'clients';
  try {
    const docSnap = await getDoc(doc(db, path, clientId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ClientData;
    }

    // Tenta buscar na coleção de usuários caso não encontre em clientes
    // Isso é comum para processos originados de indicações onde o cliente já é um usuário do sistema
    const userSnap = await getDoc(doc(db, 'usuarios', clientId));
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return {
        id: userSnap.id,
        nome: userData.nome_completo || 'Usuário GSA',
        documento: userData.cpf || userData.cnpj || 'Não informado',
        telefone: userData.telefone || userData.whatsapp || 'Não informado',
        data_nascimento: userData.data_nascimento || '',
        especialista_id: userData.vendedor_id || userData.gestor_id || '',
        data_entrada: userData.data_cadastro
      } as ClientData;
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function excluirCliente(clientId: string) {
  const path = 'clients';
  try {
    await deleteDoc(doc(db, path, clientId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
