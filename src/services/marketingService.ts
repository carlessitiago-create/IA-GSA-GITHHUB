import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  orderBy,
  Timestamp,
  getDoc,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanData } from '../firebase';
import { addPontos, getPointsRules } from './pointsService';

export interface Referral {
  id?: string;
  cliente_origem_id: string;
  origem_tipo: 'CLIENTE' | 'GESTOR' | 'VENDEDOR';
  metodo_indicacao?: 'MANUAL' | 'VITRINE';
  nome_indicado: string;
  email_indicado?: string;
  telefone_indicado: string;
  vendedor_id: string;
  status_indicacao: 'Enviado' | 'Feito Contato' | 'Aguardando Retorno' | 'Retorno Positivo' | 'Sem Retorno' | 'Concluído' | 'Cliente Aceitou Proposta';
  timestamp: Timestamp;
  bloqueado?: boolean;
  cadastrado?: boolean;
  bonus_valor?: number;
  bonus_creditado?: boolean;
}

export interface ShowcaseService {
  id?: string;
  titulo: string;
  descricao_curta: string;
  descricao_longa: string;
  imagem_capa_url: string;
  videoId?: string;
  ativo: boolean;
  modelo_id?: string;
}

export type LeadStatus = 'Novo' | 'Em Atendimento' | 'Qualificado' | 'Proposta Enviada' | 'Negociação' | 'Venda Concluída' | 'Perdido' | 'Feito Contato' | 'Aguardando Retorno' | 'Cliente Aceitou Proposta' | 'Recusado' | 'Rejeitado Cliente';

export interface LeadHistory {
  status_anterior: string;
  novo_status: string;
  mensagem: string;
  autor_id: string;
  autor_nome: string;
  timestamp: Timestamp;
}

export interface PropostaDetalhes {
  valorAVistaDe: string;
  valorAVistaPara: string;
  valorEntrada: string;
  parcelas: string;
  valorParcela: string;
  detalhesExtras?: string;
}

export interface ShowcaseLead {
  id?: string;
  cliente_id: string;
  cliente_nome?: string;
  cliente_email?: string;
  cliente_telefone?: string;
  servico_id: string;
  servico_nome?: string;
  vendedor_id: string;
  vendedor_nome?: string;
  status: LeadStatus;
  timestamp: Timestamp;
  historico?: LeadHistory[];
  notas?: string;
  proposta?: PropostaDetalhes;
  comprovante_venda_url?: string;
  indicado_por?: string; // ID do cliente que indicou via link
  origem?: 'MANUAL' | 'VITRINE';
}

const REFERRALS_COLLECTION = 'referrals';
const SHOWCASE_SERVICES_COLLECTION = 'showcase_services';
const SHOWCASE_LEADS_COLLECTION = 'showcase_leads';

/**
 * Cria uma nova indicação
 */
export async function criarIndicacao(data: Omit<Referral, 'id' | 'timestamp' | 'status_indicacao'>) {
  try {
    const newReferral = {
      ...cleanData(data),
      status_indicacao: 'Enviado',
      timestamp: serverTimestamp(),
      bloqueado: false
    };
    const docRef = await addDoc(collection(db, REFERRALS_COLLECTION), newReferral);
    
    // Notificar Hierarquia
    const { sendNotification } = await import('./notificationService');
    
    // 1. Notificar o Vendedor Responsável
    if (data.vendedor_id && data.vendedor_id !== 'ADM') {
      await sendNotification({
        usuario_id: data.vendedor_id,
        titulo: '📢 Nova Indicação Recebida',
        mensagem: `Você recebeu uma nova indicação: ${data.nome_indicado}. Entre em contato!`,
        tipo: 'REFERRAL'
      });

      // 2. Notificar o Superior do Vendedor
      const vendSnap = await getDoc(doc(db, 'usuarios', data.vendedor_id));
      if (vendSnap.exists()) {
        const vendData = vendSnap.data();
        if (vendData.id_superior && vendData.id_superior !== 'ADM') {
          await sendNotification({
            usuario_id: vendData.id_superior,
            titulo: '📢 Nova Indicação na Equipe',
            mensagem: `O especialista ${vendData.nome_completo} recebeu uma nova indicação: ${data.nome_indicado}.`,
            tipo: 'REFERRAL'
          });
        }
      }
    }

    // 3. Notificar ADMs
    const adminsSnapshot = await getDocs(query(collection(db, 'usuarios'), where('nivel', 'in', ['ADM_MASTER', 'ADM_GERENTE'])));
    for (const adminDoc of adminsSnapshot.docs) {
      await sendNotification({
        usuario_id: adminDoc.id,
        titulo: '📢 Nova Indicação no Sistema',
        mensagem: `Uma nova indicação foi registrada para ${data.nome_indicado}.`,
        tipo: 'SYSTEM'
      });
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, REFERRALS_COLLECTION);
    throw error;
  }
}

/**
 * Atualiza o status de uma indicação
 */
export async function atualizarStatusIndicacao(referralId: string, novoStatus: Referral['status_indicacao']) {
  try {
    const docRef = doc(db, REFERRALS_COLLECTION, referralId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Indicação não encontrada');
    const referral = { id: snap.id, ...snap.data() } as Referral;

    const updateData: any = { status_indicacao: novoStatus };

    // Notificar o cliente que indicou sobre a alteração de status
    const { sendNotification } = await import('./notificationService');
    if (referral.cliente_origem_id && referral.cliente_origem_id.length > 15) {
      await sendNotification({
        usuario_id: referral.cliente_origem_id,
        titulo: '🔄 Status de Indicação Atualizado',
        mensagem: `Sua indicação para ${referral.nome_indicado} agora está como: ${novoStatus}.`,
        tipo: 'STATUS_CHANGE'
      });
    }

    // Notificar o Vendedor Responsável
    if (referral.vendedor_id && referral.vendedor_id !== 'ADM') {
      await sendNotification({
        usuario_id: referral.vendedor_id,
        titulo: '🔄 Status de Indicação Atualizado',
        mensagem: `O status da indicação de ${referral.nome_indicado} foi alterado para: ${novoStatus}.`,
        tipo: 'STATUS_CHANGE'
      });

      // Notificar o Superior do Vendedor
      const vendSnap = await getDoc(doc(db, 'usuarios', referral.vendedor_id));
      if (vendSnap.exists()) {
        const vendData = vendSnap.data();
        if (vendData.id_superior && vendData.id_superior !== 'ADM') {
          await sendNotification({
            usuario_id: vendData.id_superior,
            titulo: '📢 Atualização na Equipe',
            mensagem: `O status da indicação de ${referral.nome_indicado} (Especialista: ${vendData.nome_completo}) mudou para: ${novoStatus}.`,
            tipo: 'SYSTEM'
          });
        }
      }
    }

    // Se o status for concluído, gerar um novo processo
    if (novoStatus === 'Concluído' && referral.cliente_origem_id) {
      const { criarProcessoDeIndicacao } = await import('./orderService');
      await criarProcessoDeIndicacao(
        referral.cliente_origem_id,
        referral.nome_indicado,
        referral.telefone_indicado,
        referral.vendedor_id,
        referralId
      );
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, REFERRALS_COLLECTION);
    throw error;
  }
}

/**
 * Reatribui o especialista de uma indicação (ADM)
 */
export async function reatribuirEspecialistaIndicacao(referralId: string, novoVendedorId: string) {
  try {
    const docRef = doc(db, REFERRALS_COLLECTION, referralId);
    await updateDoc(docRef, { vendedor_id: novoVendedorId });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, REFERRALS_COLLECTION);
    throw error;
  }
}

/**
 * Lista indicações de um cliente de origem
 */
export async function listarMinhasIndicacoes(clienteOrigemId: string) {
  if (!clienteOrigemId) return [];
  try {
    const q = query(
      collection(db, REFERRALS_COLLECTION), 
      where('cliente_origem_id', '==', clienteOrigemId),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Referral));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, REFERRALS_COLLECTION);
    throw error;
  }
}

/**
 * Lista indicações recebidas por um vendedor
 */
export async function listarIndicacoesRecebidas(vendedorId: string) {
  if (!vendedorId) return [];
  try {
    const q = query(
      collection(db, REFERRALS_COLLECTION), 
      where('vendedor_id', '==', vendedorId),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Referral));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, REFERRALS_COLLECTION);
    throw error;
  }
}

/**
 * Lista todas as indicações (ADM)
 */
export async function listarTodasIndicacoes() {
  try {
    const q = query(collection(db, REFERRALS_COLLECTION), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Referral));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, REFERRALS_COLLECTION);
    throw error;
  }
}

/**
 * Lista serviços da vitrine
 */
export async function listarServicosVitrine() {
  try {
    const q = query(collection(db, SHOWCASE_SERVICES_COLLECTION), where('ativo', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShowcaseService));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, SHOWCASE_SERVICES_COLLECTION);
    throw error;
  }
}

/**
 * Cria um novo serviço na vitrine
 */
export async function criarServicoVitrine(data: Omit<ShowcaseService, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, SHOWCASE_SERVICES_COLLECTION), data);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SHOWCASE_SERVICES_COLLECTION);
    throw error;
  }
}

/**
 * Solicita orçamento de um serviço da vitrine
 */
export async function solicitarOrcamentoVitrine(
  clienteId: string, 
  servicoId: string, 
  vendedorId: string, 
  clienteNome: string,
  indicadoPor?: string,
  clienteEmail?: string,
  clienteTelefone?: string
) {
  try {
    // Buscar dados extras para o lead - Tenta em ambas as coleções (Marketing e Fábrica)
    let servicoData: any = null;
    
    const servicoSnapShowcase = await getDoc(doc(db, SHOWCASE_SERVICES_COLLECTION, servicoId));
    if (servicoSnapShowcase.exists()) {
      servicoData = servicoSnapShowcase.data();
    } else {
      const servicoSnapFactory = await getDoc(doc(db, 'services', servicoId));
      if (servicoSnapFactory.exists()) {
        const factoryData = servicoSnapFactory.data();
        servicoData = {
          titulo: factoryData.nome_servico,
          id: servicoId
        };
      }
    }
    
    const clienteSnap = await getDoc(doc(db, 'usuarios', clienteId));
    const clienteData = clienteSnap.data();

    let vendedorNome = 'ADM';
    if (vendedorId !== 'ADM') {
      const vendSnap = await getDoc(doc(db, 'usuarios', vendedorId));
      if (vendSnap.exists()) {
        const vendData = vendSnap.data();
        vendedorNome = vendData.nome_completo || vendData.nome || 'Especialista GSA';
      }
    }

    const newLead: Omit<ShowcaseLead, 'id'> = cleanData({
      cliente_id: clienteId,
      cliente_nome: clienteNome || clienteData?.nome_completo || 'Cliente GSA',
      cliente_email: clienteEmail || clienteData?.email || '',
      cliente_telefone: clienteTelefone || clienteData?.telefone || '',
      servico_id: servicoId,
      servico_nome: servicoData?.titulo || servicoData?.nome_servico || 'Serviço GSA',
      vendedor_id: vendedorId,
      vendedor_nome: vendedorNome || 'ADM',
      status: 'Novo',
      timestamp: serverTimestamp() as Timestamp,
      indicado_por: indicadoPor,
      origem: 'VITRINE',
      historico: [{
        status_anterior: 'Nenhum',
        novo_status: 'Novo',
        mensagem: `Lead criado por solicitação de orçamento de ${clienteNome || clienteData?.nome_completo || 'Cliente'} via Vitrine`,
        autor_id: clienteId,
        autor_nome: clienteNome || clienteData?.nome_completo || 'Cliente',
        timestamp: Timestamp.now()
      }]
    });
    const docRef = await addDoc(collection(db, SHOWCASE_LEADS_COLLECTION), newLead);
    
    const { sendNotification } = await import('./notificationService');
    
    // Notificar Vendedor
    if (vendedorId !== 'ADM') {
      await sendNotification({
        usuario_id: vendedorId,
        titulo: 'Novo Lead da Vitrine',
        mensagem: `${clienteNome} solicitou orçamento para um serviço.`,
        tipo: 'NEW_LEAD'
      });
      
      // Notificar Gestor do Vendedor (se houver)
      const vendedorDoc = await getDoc(doc(db, 'usuarios', vendedorId));
      const vendedorData = vendedorDoc.data();
      if (vendedorData?.id_superior && vendedorData.id_superior !== 'ADM') {
        await sendNotification({
          usuario_id: vendedorData.id_superior,
          titulo: 'Novo Lead para sua Equipe',
          mensagem: `O cliente ${clienteNome} solicitou orçamento. Especialista: ${vendedorData.nome}.`,
          tipo: 'NEW_LEAD'
        });
      }
    }

    // Notificar ADMs (Inteligência do Sistema)
    const usersSnapshot = await getDocs(query(collection(db, 'usuarios'), where('nivel', 'in', ['ADM_MASTER', 'ADM_GERENTE'])));
    for (const adminDoc of usersSnapshot.docs) {
      await sendNotification({
        usuario_id: adminDoc.id,
        titulo: 'Novo Lead no Sistema',
        mensagem: `O cliente ${clienteNome} iniciou uma intenção de compra na vitrine.`,
        tipo: 'SYSTEM'
      });
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SHOWCASE_LEADS_COLLECTION);
    throw error;
  }
}

/**
 * Lista todos os leads da vitrine
 */
export async function listarLeadsVitrine() {
  try {
    const q = query(collection(db, SHOWCASE_LEADS_COLLECTION), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShowcaseLead));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, SHOWCASE_LEADS_COLLECTION);
    throw error;
  }
}

/**
 * Atualiza o status de um lead da vitrine com registro de histórico e notificações
 */
export async function atualizarStatusLeadVitrine(
  leadId: string, 
  novoStatus: LeadStatus, 
  autorId: string, 
  autorNome: string,
  mensagem: string = '',
  proposta?: PropostaDetalhes
) {
  try {
    const docRef = doc(db, SHOWCASE_LEADS_COLLECTION, leadId);
    const leadSnap = await getDoc(docRef);
    
    if (!leadSnap.exists()) throw new Error('Lead não encontrado');
    
    const leadData = leadSnap.data() as ShowcaseLead;
    const statusAnterior = leadData.status;
    
    const novoHistorico: LeadHistory = {
      status_anterior: statusAnterior,
      novo_status: novoStatus,
      mensagem: mensagem || `Status alterado de ${statusAnterior} para ${novoStatus}`,
      autor_id: autorId,
      autor_nome: autorNome,
      timestamp: Timestamp.now()
    };

    const historicoAtual = leadData.historico || [];
    
    const updateData: any = cleanData({
      status: novoStatus,
      historico: [...historicoAtual, novoHistorico]
    });

    if (proposta) {
      updateData.proposta = cleanData(proposta);
    }
    
    await updateDoc(docRef, updateData);

    // Notificações para a Hierarquia
    const { sendNotification } = await import('./notificationService');

    // Se a venda foi concluída, criar o processo operacional
    if (novoStatus === 'Venda Concluída') {
      const { criarProcessoDireto, gerarProtocolo } = await import('./orderService');
      const protocolo = await gerarProtocolo();
      
      const servicoSnap = await getDoc(doc(db, SHOWCASE_SERVICES_COLLECTION, leadData.servico_id));
      const servicoData = servicoSnap.data();

      await criarProcessoDireto({
        protocolo,
        cliente_id: leadData.cliente_id,
        cliente_nome: leadData.cliente_nome,
        vendedor_id: leadData.vendedor_id,
        vendedor_nome: leadData.vendedor_nome,
        servico_id: leadData.servico_id,
        servico_nome: leadData.servico_nome || servicoData?.titulo || 'Serviço GSA',
        status_atual: 'Pendente',
        preco_venda: leadData.proposta ? parseFloat(leadData.proposta.valorAVistaPara.replace(/[^\d,]/g, '').replace(',', '.')) : 0,
        preco_base: servicoData?.preco_base || 0,
        margem_lucro: 0,
        prazo_estimado_dias: servicoData?.prazo_dias || 7,
        modelo_id: servicoData?.modelo_id || '',
        data_venda: Timestamp.now(),
        lead_id: leadId
      });

      // Notificar Analistas (Notificação Crítica)
      const analistasSnap = await getDocs(query(collection(db, 'usuarios'), where('nivel', '==', 'ADM_ANALISTA')));
      for (const analistaDoc of analistasSnap.docs) {
        await sendNotification({
          usuario_id: analistaDoc.id,
          titulo: '⚠️ NOVO PROCESSO NA FILA',
          mensagem: `Venda concluída para ${leadData.cliente_nome}. Inicie a análise técnica.`,
          tipo: 'PROCESS'
        });
      }
    }

    // 1. Notificar o Vendedor (se não for ele quem alterou)
    if (leadData.vendedor_id !== autorId) {
      await sendNotification({
        usuario_id: leadData.vendedor_id,
        titulo: 'Atualização de Lead',
        mensagem: `O status do seu lead foi alterado para ${novoStatus} por ${autorNome}.`,
        tipo: 'STATUS_CHANGE'
      });
    }

    // 2. Notificar Superior do Vendedor
    const vendedorSnap = await getDoc(doc(db, 'usuarios', leadData.vendedor_id));
    if (vendedorSnap.exists()) {
      const vendedorData = vendedorSnap.data();
      if (vendedorData.id_superior && vendedorData.id_superior !== autorId) {
        await sendNotification({
          usuario_id: vendedorData.id_superior,
          titulo: 'Monitoramento de Lead',
          mensagem: `O lead do vendedor ${vendedorData.nome} avançou para ${novoStatus}.`,
          tipo: 'SYSTEM'
        });
      }
    }

    // 3. Notificar ADMs (Inteligência do Sistema)
    const adminsSnapshot = await getDocs(query(collection(db, 'usuarios'), where('nivel', 'in', ['ADM_MASTER', 'ADM_GERENTE'])));
    for (const adminDoc of adminsSnapshot.docs) {
      if (adminDoc.id !== autorId && adminDoc.id !== (vendedorSnap.exists() ? vendedorSnap.data().id_superior : null)) {
        const vendedorNome = vendedorSnap.exists() ? vendedorSnap.data().nome : 'Desconhecido';
        
        let gestorNome = 'Nenhum';
        if (vendedorSnap.exists() && vendedorSnap.data().id_superior) {
          const gestorSnap = await getDoc(doc(db, 'usuarios', vendedorSnap.data().id_superior));
          if (gestorSnap.exists()) {
            gestorNome = gestorSnap.data().nome;
          }
        }

        await sendNotification({
          usuario_id: adminDoc.id,
          titulo: 'Inteligência: Movimentação de Lead',
          mensagem: `Lead movimentado: ${statusAnterior} -> ${novoStatus}. Vendedor: ${vendedorNome}. Gestor: ${gestorNome}. (Autor: ${autorNome})`,
          tipo: 'SYSTEM'
        });
      }
    }

  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, SHOWCASE_LEADS_COLLECTION);
    throw error;
  }
}

export async function aceitarPropostaLeadVitrine(
  leadId: string,
  clienteId: string,
  clienteNome: string,
  mensagem: string = ''
) {
  try {
    const docRef = doc(db, SHOWCASE_LEADS_COLLECTION, leadId);
    const leadSnap = await getDoc(docRef);
    
    if (!leadSnap.exists()) throw new Error('Lead não encontrado');
    
    const leadData = leadSnap.data() as ShowcaseLead;
    const statusAnterior = leadData.status;
    const novoStatus = 'Negociação'; // Move to Negociação to finalize the sale
    
    const novoHistorico: LeadHistory = {
      status_anterior: statusAnterior,
      novo_status: novoStatus,
      mensagem: mensagem || `O cliente ${clienteNome} ACEITOU a oferta! Aguardando conclusão da venda.`,
      autor_id: clienteId,
      autor_nome: clienteNome,
      timestamp: Timestamp.now()
    };

    const historicoAtual = leadData.historico || [];
    
    await updateDoc(docRef, cleanData({ 
      status: novoStatus,
      historico: [...historicoAtual, novoHistorico]
    }));

    // Notify the seller
    const { sendNotification } = await import('./notificationService');
    if (leadData.vendedor_id && leadData.vendedor_id !== 'ADM') {
      await sendNotification({
        usuario_id: leadData.vendedor_id,
        titulo: 'Oferta Aceita!',
        mensagem: `O cliente ${clienteNome} aceitou a oferta. Finalize a venda!`,
        tipo: 'STATUS_CHANGE'
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, SHOWCASE_LEADS_COLLECTION);
    throw error;
  }
}

/**
 * Reatribui o especialista de um lead da vitrine
 */
export async function reatribuirEspecialistaLeadVitrine(leadId: string, novoVendedorId: string) {
  try {
    const docRef = doc(db, SHOWCASE_LEADS_COLLECTION, leadId);
    await updateDoc(docRef, { vendedor_id: novoVendedorId });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, SHOWCASE_LEADS_COLLECTION);
    throw error;
  }
}

/**
 * Exclui um lead da vitrine
 */
export async function excluirLeadVitrine(leadId: string) {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    const docRef = doc(db, SHOWCASE_LEADS_COLLECTION, leadId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, SHOWCASE_LEADS_COLLECTION);
    throw error;
  }
}

/**
 * Edita os dados de um lead da vitrine
 */
export async function editarLeadVitrine(leadId: string, data: Partial<ShowcaseLead>) {
  try {
    const docRef = doc(db, SHOWCASE_LEADS_COLLECTION, leadId);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, SHOWCASE_LEADS_COLLECTION);
    throw error;
  }
}

/**
 * Exclui uma indicação
 */
export async function excluirIndicacao(referralId: string) {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    const docRef = doc(db, REFERRALS_COLLECTION, referralId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, REFERRALS_COLLECTION);
    throw error;
  }
}

/**
 * Bloqueia/Desbloqueia uma indicação
 */
export async function alternarBloqueioIndicacao(referralId: string, bloqueado: boolean) {
  try {
    const docRef = doc(db, REFERRALS_COLLECTION, referralId);
    await updateDoc(docRef, { bloqueado });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, REFERRALS_COLLECTION);
    throw error;
  }
}

/**
 * Edita os dados de uma indicação
 */
export async function editarIndicacao(referralId: string, data: Partial<Referral>) {
  try {
    const docRef = doc(db, REFERRALS_COLLECTION, referralId);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, REFERRALS_COLLECTION);
    throw error;
  }
}
