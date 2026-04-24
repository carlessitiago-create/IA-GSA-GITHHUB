import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  Timestamp,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  writeBatch,
  or
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanData } from '../firebase';
import { 
  addPontos, 
  processarPontosDeVenda, 
  distribuirPontosPorServico, 
  entregarCashbackCliente 
} from './pointsService';
// import { getPointsForRule } from './clubService';
import { UserProfile } from './userService';
import { 
  notificarStatusProcesso, 
  notificarNovaPendencia 
} from './notificationService';

export interface SaleData {
  id?: string;
  protocolo: string;
  cliente_id: string;
  cliente_nome?: string;
  vendedor_id: string;
  valor_total: number;
  margem_total: number;
  metodo_pagamento: 'PIX' | 'CARTEIRA';
  status_pagamento: 'Pendente' | 'Aguardando Confirmação' | 'Pago' | 'Débito em Carteira' | 'Vencida';
  comprovante_url?: string;
  dias_atraso?: number;
  timestamp: Timestamp;
}

export interface OrderProcess {
  id?: string;
  venda_id?: string;
  protocolo: string;
  cliente_id: string;
  vendedor_id: string;
  id_superior?: string;
  servico_id: string;
  servico_nome?: string;
  status_atual: 'Pendente' | 'Em Análise' | 'Protocolado' | 'Em Andamento' | 'Concluído' | 'Aguardando Documentação' | 'Aguardando Aprovação';
  preco_base?: number;
  preco_venda?: number;
  margem_lucro?: number;
  prazo_estimado_dias?: number;
  data_inicial?: Timestamp;
  data_venda: Timestamp;
  data_conclusao?: Timestamp;
  data_conclusao_real?: Timestamp;
  url_arquivo_final?: string;
  url_nada_consta?: string;
  observacoes_internas?: string;
  cliente_nome?: string;
  cliente_cpf_cnpj?: string;
  data_nascimento?: string;
  vendedor_nome?: string;
  gestor_nome?: string;
  adm_notes?: string;
  whatsapp_suporte?: string;
  proposta_enviada_url?: string;
  detalhes_negociacao?: string;
  valor_proposta_aceita?: number;
  status_info_extra?: string;
  modelo_id?: string;
  pendencias_iniciais?: string[];
  dados_faltantes?: string[];
  documentos_enviados?: string[];
  dias_atraso?: number;
  status_financeiro?: 'PENDENTE' | 'PAGO' | 'VENCIDO';
  anexo_conclusao_url?: string;
  referral_id?: string;
  lead_id?: string;
}

export interface StatusHistory {
  id?: string;
  processo_id: string;
  status_anterior: string;
  novo_status: string;
  usuario_id: string;
  timestamp: Timestamp;
  visibilidade_uids: string[];
  status_info_extra?: string;
  observacoes?: string;
}

export interface PendingIssue {
  id?: string;
  venda_id: string;
  processo_id: string;
  vendedor_id: string;
  id_superior: string;
  cliente_id?: string;
  descricao: string;
  status_pendencia: 'AGUARDANDO_GESTOR' | 'ENVIADO_CLIENTE' | 'RESOLVIDO';
  criadaEm: Timestamp;
  criado_por_id: string;
  resolvidaEm?: Timestamp;
  tempoResolucaoSegundos?: number;
  resolucao?: string;
  msg_interna?: string;
  msg_publica?: string;
  observacao_adm_privada?: string;
  titulo?: string;
  anexo_url?: string;
  observacao_adm?: string;
  timestamp?: Timestamp;
}

export interface PendencyAuditLog {
  id?: string;
  pendencia_id: string;
  origem_usuario_id: string;
  origem_nome?: string; // Added to match App.tsx usage
  destino_papel: 'GESTOR' | 'VENDEDOR' | 'CLIENTE' | 'ADM_ANALISTA';
  mensagem_publica?: string;
  mensagem_interna?: string;
  observacao_adm?: string;
  anexo_url?: string;
  data_log: Timestamp;
  timestamp?: Timestamp; // Added alias to match App.tsx usage
  tipo_bloco: 'AZUL' | 'AMARELO' | 'VERDE';
}

const SALES_COLLECTION = 'sales';
const PROCESSES_COLLECTION = 'order_processes';
const HISTORY_COLLECTION = 'status_history';
const PENDENCIES_COLLECTION = 'pendencies';
const AUDIT_LOGS_COLLECTION = 'pendency_audit_logs';

/**
 * Cria uma nova pendência e registra o log inicial (AZUL)
 */
export const atualizarProcesso = async (processId: string, data: Partial<OrderProcess>) => {
  try {
    const processRef = doc(db, 'order_processes', processId);
    const updateData: any = { ...data };
    
    // If status is being changed to Concluído, set data_conclusao
    if (data.status_atual === 'Concluído' && !data.data_conclusao) {
      updateData.data_conclusao = serverTimestamp();
    }

    await updateDoc(processRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `order_processes/${processId}`);
  }
};

/**
 * Abre uma pendência em cascata vinculada a uma venda
 */
export async function abrirPendenciaCascata(data: {
  vendaId?: string;
  processo_id?: string;
  descricao: string;
  criado_por_id: string;
  mensagem_interna?: string;
  mensagem_publica?: string;
  observacao_adm_privada?: string;
}) {
  try {
    let vendaId = data.vendaId;
    let processoData: any = null;

    // Se houver processo_id, tenta buscar os dados do processo
    if (data.processo_id) {
      const procSnap = await getDoc(doc(db, PROCESSES_COLLECTION, data.processo_id));
      if (procSnap.exists()) {
        processoData = procSnap.data();
        if (!vendaId) vendaId = processoData.venda_id;
      }
    }

    // Se ainda não houver vendaId, mas tivermos processoData, podemos tentar prosseguir sem vendaId
    // mas a interface PendingIssue exige vendaId. Vamos usar 'STANDALONE' se realmente não houver.
    const finalVendaId = vendaId || 'STANDALONE';

    let vendedor_id = '';
    let id_superior = '';
    let cliente_id = '';

    if (vendaId && vendaId !== 'STANDALONE') {
      const saleSnap = await getDoc(doc(db, SALES_COLLECTION, vendaId));
      if (saleSnap.exists()) {
        const saleData = saleSnap.data();
        vendedor_id = saleData.vendedor_id || '';
        id_superior = saleData.id_superior || '';
        cliente_id = saleData.cliente_id || '';
      }
    }

    // Fallback para dados do processo se não encontramos na venda
    if (!vendedor_id && processoData) {
      vendedor_id = processoData.vendedor_id || '';
      id_superior = processoData.id_superior || '';
      cliente_id = processoData.cliente_id || '';
    }
    
    const batch = writeBatch(db);
    const pendencyRef = doc(collection(db, PENDENCIES_COLLECTION));
    const timestamp = Timestamp.now();

    const pendencyData: PendingIssue = {
      venda_id: finalVendaId,
      processo_id: data.processo_id || '',
      vendedor_id,
      id_superior,
      cliente_id,
      descricao: data.descricao,
      status_pendencia: 'AGUARDANDO_GESTOR',
      criadaEm: timestamp,
      criado_por_id: data.criado_por_id,
      msg_interna: data.mensagem_interna || '',
      msg_publica: data.mensagem_publica || '',
      timestamp: timestamp
    };

    batch.set(pendencyRef, pendencyData);

    // 2. Travar o processo se houver um processo_id
    if (data.processo_id) {
      const processRef = doc(db, PROCESSES_COLLECTION, data.processo_id);
      batch.update(processRef, {
        status_atual: 'Aguardando Documentação',
        status_info_extra: `PENDÊNCIA ATIVA: ${data.descricao}`
      });
    }

    // 3. Registrar log de auditoria
    const logRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    batch.set(logRef, {
      pendencia_id: pendencyRef.id,
      origem_usuario_id: data.criado_por_id,
      destino_papel: 'VENDEDOR',
      mensagem_interna: data.mensagem_interna || `PENDÊNCIA ABERTA: ${data.descricao}`,
      mensagem_publica: data.mensagem_publica || '',
      data_log: timestamp,
      tipo_bloco: 'AZUL'
    });

    await batch.commit();

    // Notificar nova pendência
    try {
      if (processoData) {
        await notificarNovaPendencia(processoData, data.descricao);
      }
    } catch (e) {
      console.warn('Erro ao notificar pendência:', e);
    }

    return pendencyRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PENDENCIES_COLLECTION);
    throw error;
  }
}

export async function criarPendencia(data: Omit<PendingIssue, 'id' | 'criadaEm'>, origemNome: string) {
  try {
    if (!data.processo_id) throw new Error('ID do Processo é obrigatório para criar pendência.');
    
    const batch = writeBatch(db);
    const pendencyRef = doc(collection(db, PENDENCIES_COLLECTION));
    const timestamp = Timestamp.now();

    const processSnap = await getDoc(doc(db, PROCESSES_COLLECTION, data.processo_id));
    const visibilidade_uids = processSnap.exists() ? (processSnap.data().visibilidade_uids || [data.criado_por_id]) : [data.criado_por_id];

    batch.set(pendencyRef, {
      ...data,
      visibilidade_uids,
      criadaEm: timestamp,
      timestamp: timestamp
    });

    const logRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    const logData: any = {
      pendencia_id: pendencyRef.id,
      origem_usuario_id: data.criado_por_id,
      origem_nome: origemNome,
      destino_papel: 'GESTOR',
      mensagem_interna: data.msg_interna || '',
      mensagem_publica: data.msg_publica || '',
      observacao_adm: data.observacao_adm || '',
      anexo_url: data.anexo_url || '',
      data_log: timestamp,
      visibilidade_uids,
      tipo_bloco: 'AZUL'
    };
    batch.set(logRef, logData);

    await batch.commit();

    // Notificar nova pendência
    try {
      if (processSnap.exists()) {
        await notificarNovaPendencia(processSnap.data(), data.descricao);
      }
    } catch (e) {
      console.warn('Erro ao notificar pendência:', e);
    }

    return pendencyRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PENDENCIES_COLLECTION);
    throw error;
  }
}

/**
 * Atualiza o status de uma pendência e registra log (AMARELO ou VERDE)
 */
export async function atualizarStatusPendencia(
  pendenciaId: string, 
  novoStatus: PendingIssue['status_pendencia'],
  usuarioId: string,
  userRole: string,
  origemNome: string,
  mensagem?: string,
  anexoUrl?: string,
  mensagemInterna?: string
) {
  try {
    const batch = writeBatch(db);
    const pendencyRef = doc(db, PENDENCIES_COLLECTION, pendenciaId);
    const timestamp = Timestamp.now();

    const updates: any = { status_pendencia: novoStatus };
    if (mensagemInterna) updates.msg_interna = mensagemInterna;
    if (anexoUrl) updates.anexo_url = anexoUrl;

    batch.update(pendencyRef, updates);

    const pendencySnap = await getDoc(pendencyRef);
    const visibilidade_uids = pendencySnap.exists() ? (pendencySnap.data().visibilidade_uids || [usuarioId]) : [usuarioId];

    const logRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    
    let tipoBloco: 'AZUL' | 'AMARELO' | 'VERDE' = 'AMARELO';
    let destino: PendencyAuditLog['destino_papel'] = 'GESTOR';

    if (novoStatus === 'RESOLVIDO') {
      tipoBloco = 'VERDE';
      destino = 'CLIENTE';
    } else if (userRole === 'CLIENTE' || userRole === 'VENDEDOR') {
      tipoBloco = 'VERDE';
      destino = 'GESTOR';
    } else if (userRole === 'ADM_ANALISTA') {
      tipoBloco = 'AZUL';
      destino = 'GESTOR';
    } else if (userRole === 'GESTOR' || userRole === 'ADM_GERENTE' || userRole === 'ADM_MASTER') {
      tipoBloco = 'AMARELO';
      destino = 'ADM_ANALISTA';
    }

    const logData: any = {
      pendencia_id: pendenciaId,
      origem_usuario_id: usuarioId,
      origem_nome: origemNome,
      destino_papel: destino,
      mensagem_publica: mensagem || '',
      mensagem_interna: mensagemInterna || '',
      anexo_url: anexoUrl || '',
      data_log: timestamp,
      visibilidade_uids,
      tipo_bloco: tipoBloco
    };
    batch.set(logRef, logData);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, PENDENCIES_COLLECTION);
    throw error;
  }
}

/**
 * ADM Força a resolução da pendência
 */
export async function forcarResolucaoPendencia(pendenciaId: string, usuarioId: string, mensagemResolucao?: string) {
  try {
    const batch = writeBatch(db);
    const pendencyRef = doc(db, PENDENCIES_COLLECTION, pendenciaId);
    const timestamp = Timestamp.now();

    batch.update(pendencyRef, { 
      status_pendencia: 'RESOLVIDO',
      msg_interna: mensagemResolucao || 'RESOLUÇÃO FORÇADA PELO ADMINISTRADOR'
    });

    const pendencySnap = await getDoc(pendencyRef);
    const visibilidade_uids = pendencySnap.exists() ? (pendencySnap.data().visibilidade_uids || [usuarioId]) : [usuarioId];

    const logRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    const logData: any = {
      pendencia_id: pendenciaId,
      origem_usuario_id: usuarioId,
      destino_papel: 'GESTOR',
      mensagem_interna: mensagemResolucao || 'RESOLUÇÃO FORÇADA PELO ADMINISTRADOR',
      data_log: timestamp,
      visibilidade_uids,
      tipo_bloco: 'AMARELO'
    };
    batch.set(logRef, logData);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, PENDENCIES_COLLECTION);
    throw error;
  }
}

/**
 * Troca o vendedor responsável pelo processo
 */
export const trocarResponsavelProcesso = async (processoId: string, novoVendedorId: string) => {
  try {
    const docRef = doc(db, PROCESSES_COLLECTION, processoId);
    await updateDoc(docRef, {
      vendedor_id: novoVendedorId,
      data_transferencia: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, PROCESSES_COLLECTION);
    throw error;
  }
};

/**
 * Edita valores do processo (ADM Gerente)
 */
export async function editarValoresProcesso(processoId: string, novoPrecoVenda: number, novoPrecoBase: number) {
  try {
    await updateDoc(doc(db, PROCESSES_COLLECTION, processoId), {
      preco_venda: novoPrecoVenda,
      preco_base: novoPrecoBase,
      margem_lucro: novoPrecoVenda - novoPrecoBase
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, PROCESSES_COLLECTION);
    throw error;
  }
}

/**
 * Atualiza notas de gestão ADM
 */
export async function atualizarNotasADM(processoId: string, notas: string) {
  try {
    await updateDoc(doc(db, PROCESSES_COLLECTION, processoId), { adm_notes: notas });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, PROCESSES_COLLECTION);
    throw error;
  }
}

/**
 * Lista pendências de um processo
 */
export async function listarPendenciasPorProcesso(processoId: string) {
  if (!processoId) return [];
  try {
    const q = query(collection(db, PENDENCIES_COLLECTION), where('processo_id', '==', processoId), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as PendingIssue) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PENDENCIES_COLLECTION);
    throw error;
  }
}

/**
 * Gera um protocolo único no formato #GSA-ANO-SEQUENCIAL
 */
export async function gerarProtocolo(): Promise<string> {
  const ano = new Date().getFullYear();
  const q = query(collection(db, SALES_COLLECTION), orderBy('timestamp', 'desc'), where('timestamp', '>=', Timestamp.fromDate(new Date(ano, 0, 1))));
  const snapshot = await getDocs(q);
  const count = snapshot.size + 1001;
  return `#GSA-${ano}-${count}`;
}

// criarVenda was removed as it has been replaced by processarVenda Cloud Function

/**
 * Cria um novo processo originado de uma indicação concluída
 */
export async function criarProcessoDeIndicacao(
  clienteOrigemId: string, 
  nomeIndicado: string, 
  telefoneIndicado: string, 
  vendedorId: string,
  referralId?: string
) {
  try {
    const batch = writeBatch(db);
    const protocolo = await gerarProtocolo();
    
    // Buscar visibilidade_uids baseada no cliente de origem (quem indicou)
    let visibilidade_uids = [vendedorId];
    let id_superior = '';
    if (vendedorId !== 'ADM') {
      const vendSnap = await getDoc(doc(db, 'usuarios', vendedorId));
      if (vendSnap.exists()) {
        id_superior = vendSnap.data().id_superior || '';
        if (id_superior) visibilidade_uids.push(id_superior);
      }
    }

    const saleRef = doc(collection(db, SALES_COLLECTION));
    const saleData: any = {
      protocolo,
      cliente_id: clienteOrigemId,
      vendedor_id: vendedorId,
      id_superior,
      valor_total: 0,
      margem_total: 0,
      metodo_pagamento: 'PIX',
      status_pagamento: 'Pendente',
      visibilidade_uids,
      referral_id: referralId || null,
      timestamp: Timestamp.now()
    };

    batch.set(saleRef, saleData);

    const processRef = doc(collection(db, PROCESSES_COLLECTION));
    const processData: OrderProcess = {
      venda_id: saleRef.id,
      protocolo: protocolo,
      cliente_id: clienteOrigemId,
      vendedor_id: vendedorId,
      id_superior,
      servico_id: 'REFERRAL_PROCESS',
      servico_nome: `Processo de Indicação: ${nomeIndicado}`,
      status_atual: 'Pendente',
      data_venda: Timestamp.now(),
      status_financeiro: 'PENDENTE',
      referral_id: referralId || null
    };

    // Sincronizar dados de segurança
    try {
      const { getClienteData } = await import('./leadService');
      const cliente = await getClienteData(clienteOrigemId);
      if (cliente) {
        processData.cliente_cpf_cnpj = cliente.documento || (cliente as any).cpf || '';
        processData.data_nascimento = cliente.data_nascimento || '';
        processData.cliente_nome = cliente.nome || '';
      }
    } catch (e) {
      console.warn("Erro ao sincronizar dados na indicação:", e);
    }

    batch.set(processRef, processData);

    await batch.commit();

    // Notificar o cliente que indicou que um novo processo foi aberto
    const { sendNotification } = await import('./notificationService');
    if (clienteOrigemId.length > 15) {
      await sendNotification({
        usuario_id: clienteOrigemId,
        titulo: '🚀 Novo Processo Iniciado!',
        mensagem: `Sua indicação para ${nomeIndicado} foi concluída e um novo processo (#${protocolo}) foi gerado. Acompanhe o progresso!`,
        tipo: 'PROCESS'
      });
    }

    return processRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PROCESSES_COLLECTION);
    throw error;
  }
}

/**
 * Atualiza o status de um processo com auditoria e trava de conclusão
 */
export async function atualizarStatusProcesso(
  processoId: string, 
  novoStatus: OrderProcess['status_atual'], 
  usuarioId: string,
  statusAnterior: string,
  urlArquivo?: string,
  observacoes?: string,
  statusInfoExtra?: string
) {
  try {
    if (novoStatus === 'Concluído' && !urlArquivo) {
      throw new Error('TRAVA_CONCLUSAO: É obrigatório anexar o comprovante para concluir o processo.');
    }

    const batch = writeBatch(db);
    const processRef = doc(db, PROCESSES_COLLECTION, processoId);
    
    const updates: any = {
      status_atual: novoStatus,
      observacoes_internas: observacoes || ''
    };

    if (statusInfoExtra !== undefined) {
      updates.status_info_extra = statusInfoExtra;
    }

    if (novoStatus === 'Concluído') {
      updates.data_conclusao = serverTimestamp();
      updates.url_nada_consta = urlArquivo;
      updates.anexo_conclusao_url = urlArquivo;
    }

    if (statusAnterior === 'Pendente' && novoStatus !== 'Pendente') {
      updates.data_inicial = serverTimestamp();
    }

    batch.update(processRef, updates);

    const processSnap = await getDoc(processRef);
    const visibilidade_uids = processSnap.exists() ? (processSnap.data().visibilidade_uids || [usuarioId]) : [usuarioId];

    const historyRef = doc(collection(db, HISTORY_COLLECTION));
    const historyData = {
      processo_id: processoId,
      status_anterior: statusAnterior,
      novo_status: novoStatus,
      usuario_id: usuarioId,
      timestamp: serverTimestamp(),
      visibilidade_uids,
      status_info_extra: statusInfoExtra || ''
    };
    batch.set(historyRef, historyData);

    await batch.commit();

    // Notificar status
    try {
      if (processSnap.exists()) {
        const processData = { id: processoId, ...processSnap.data() };
        await notificarStatusProcesso(processData, novoStatus);
      }
    } catch (e) {
      console.warn('Erro ao notificar status:', e);
    }

    // Creditar pontos para o Cliente se o processo foi concluído
    if (novoStatus === 'Concluído') {
      try {
        const processSnap = await getDoc(processRef);
        if (processSnap.exists()) {
          const processData = processSnap.data() as OrderProcess;
          
          // Entrega o cashback configurado no serviço
          await entregarCashbackCliente(processData.servico_id, processData.cliente_id);
        }
      } catch (e) {
        console.warn('Erro ao creditar pontos de conclusão:', e);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, PROCESSES_COLLECTION);
    throw error;
  }
}

/**
 * Exclui um processo e seus dados relacionados (histórico e pendências)
 */
export async function excluirProcesso(processoId: string) {
  try {
    const batch = writeBatch(db);
    
    // 1. Delete the process document
    batch.delete(doc(db, PROCESSES_COLLECTION, processoId));
    
    // 2. Delete related history
    const historyQuery = query(collection(db, HISTORY_COLLECTION), where('processo_id', '==', processoId));
    const historySnapshot = await getDocs(historyQuery);
    historySnapshot.docs.forEach(d => batch.delete(d.ref));
    
    // 3. Delete related pendencies
    const pendenciesQuery = query(collection(db, PENDENCIES_COLLECTION), where('processo_id', '==', processoId));
    const pendenciesSnapshot = await getDocs(pendenciesQuery);
    pendenciesSnapshot.docs.forEach(d => batch.delete(d.ref));
    
    // 4. Delete related audit logs
    for (const pendencyDoc of pendenciesSnapshot.docs) {
      const logsQuery = query(collection(db, AUDIT_LOGS_COLLECTION), where('pendencia_id', '==', pendencyDoc.id));
      const logsSnapshot = await getDocs(logsQuery);
      logsSnapshot.docs.forEach(d => batch.delete(d.ref));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, PROCESSES_COLLECTION);
    throw error;
  }
}

export async function listarProcessosPorVenda(vendaId: string) {
  if (!vendaId) return [];
  try {
    const q = query(collection(db, PROCESSES_COLLECTION), where('venda_id', '==', vendaId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as OrderProcess) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PROCESSES_COLLECTION);
    throw error;
  }
}

export async function criarProcessoDireto(data: Partial<OrderProcess>) {
  try {
    const processData: any = {
      ...data,
      status_atual: 'Pendente',
      data_venda: serverTimestamp()
    };

    // Sincronizar dados de segurança do cliente para permitir consulta pública
    if (data.cliente_id) {
      try {
        const { getClienteData } = await import('./leadService');
        const cliente = await getClienteData(data.cliente_id);
        if (cliente) {
          if (!processData.cliente_cpf_cnpj && cliente.documento) processData.cliente_cpf_cnpj = cliente.documento;
          if (!processData.data_nascimento && cliente.data_nascimento) processData.data_nascimento = cliente.data_nascimento;
          if (!processData.cliente_nome && cliente.nome) processData.cliente_nome = cliente.nome;
        }
      } catch (e) {
        console.warn("Erro ao sincronizar dados do cliente na criação do processo:", e);
      }
    }

    const processRef = await addDoc(collection(db, PROCESSES_COLLECTION), cleanData(processData));
    return processRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PROCESSES_COLLECTION);
    throw error;
  }
}

export async function listarTodosProcessos(profile?: any) {
  try {
    let q = query(collection(db, PROCESSES_COLLECTION), orderBy('data_venda', 'desc'));

    if (profile) {
      if (profile.nivel === 'GESTOR') {
        q = query(
          collection(db, PROCESSES_COLLECTION),
          or(where('id_superior', '==', profile.uid), where('vendedor_id', '==', profile.uid)),
          orderBy('data_venda', 'desc')
        );
      } else if (profile.nivel === 'VENDEDOR') {
        q = query(
          collection(db, PROCESSES_COLLECTION),
          where('vendedor_id', '==', profile.uid),
          orderBy('data_venda', 'desc')
        );
      }
      // ADM_MASTER, ADM_GERENTE and ADM_ANALISTA see all
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as OrderProcess) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PROCESSES_COLLECTION);
    throw error;
  }
}

export async function listarProcessosCliente(clienteId: string) {
  if (!clienteId) return [];
  try {
    const q = query(
      collection(db, PROCESSES_COLLECTION), 
      where('cliente_id', '==', clienteId),
      orderBy('data_venda', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderProcess));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PROCESSES_COLLECTION);
    throw error;
  }
}

export async function listarTodasPendencias() {
  try {
    const snapshot = await getDocs(collection(db, PENDENCIES_COLLECTION));
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as PendingIssue) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PENDENCIES_COLLECTION);
    throw error;
  }
}

/**
 * Registra um log de auditoria manual para um processo
 */
export async function registrarLogAuditoria(processoId: string, mensagem: string, usuarioId: string, origemNome: string) {
  try {
    const processSnap = await getDoc(doc(db, PROCESSES_COLLECTION, processoId));
    const visibilidade_uids = processSnap.exists() ? (processSnap.data().visibilidade_uids || [usuarioId]) : [usuarioId];
    
    const logRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    const logData: any = {
      pendencia_id: 'AUDIT_MANUAL',
      origem_usuario_id: usuarioId,
      origem_nome: origemNome,
      destino_papel: 'GESTOR',
      mensagem_interna: mensagem,
      data_log: Timestamp.now(),
      visibilidade_uids,
      tipo_bloco: 'VERDE'
    };
    await addDoc(collection(db, AUDIT_LOGS_COLLECTION), logData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, AUDIT_LOGS_COLLECTION);
    throw error;
  }
}

export async function processarDadosFichaTecnica(processoId: string, clienteId: string, dados: any) {
  try {
    // 1. Atualizar dados do cliente (Pode estar em 'usuarios' ou 'clients')
    const userRef = doc(db, 'usuarios', clienteId);
    const clientRef = doc(db, 'clients', clienteId);
    
    // Tenta atualizar em usuários (se for um cliente logado)
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, dados);
      }
    } catch (e) {
      console.warn("Não foi possível atualizar em 'usuarios':", e);
    }

    // Tenta atualizar em clients (CRM)
    try {
      const clientSnap = await getDoc(clientRef);
      if (clientSnap.exists()) {
        await updateDoc(clientRef, dados);
      }
    } catch (e) {
      console.warn("Não foi possível atualizar em 'clients':", e);
    }

    // 2. Registrar log de auditoria
    await registrarLogAuditoria(
      processoId,
      'Ficha técnica atualizada.',
      clienteId,
      'Sistema'
    );

    // 3. Atualizar o processo em si
    const processRef = doc(db, PROCESSES_COLLECTION, processoId);
    const processSnap = await getDoc(processRef);
    
    if (processSnap.exists()) {
      const processData = processSnap.data();
      const updates: any = { ...dados };
      
      // Mapear campos específicos para os nomes usados no processo
      if (dados.cpf) updates.cliente_cpf_cnpj = dados.cpf;
      if (dados.documento && !updates.cliente_cpf_cnpj) updates.cliente_cpf_cnpj = dados.documento;
      if (dados.data_nascimento) updates.data_nascimento = dados.data_nascimento;

      // Sincronizar dados do cliente se estiverem faltando no processo 
      // (ajuda em vendas administrativas onde o processo nasce incompleto)
      try {
        const { getClienteData } = await import('./leadService');
        const fullCliente = await getClienteData(clienteId);
        if (fullCliente) {
          if (!updates.cliente_cpf_cnpj && fullCliente.documento) updates.cliente_cpf_cnpj = fullCliente.documento;
          if (!updates.data_nascimento && fullCliente.data_nascimento) updates.data_nascimento = fullCliente.data_nascimento;
        }
      } catch (e) {
        console.warn("Erro ao sincronizar dados extras do cliente:", e);
      }

      const docsEnviados = processData.documentos_enviados || [];
      const requisitosDocs = processData.pendencias_iniciais || [];
      const novosDocs = Object.keys(dados).filter(key => 
        requisitosDocs.includes(key) && !docsEnviados.includes(key)
      );

      if (novosDocs.length > 0) {
        updates.documentos_enviados = [...docsEnviados, ...novosDocs];
      }

      // Atualizar dados_faltantes removendo o que foi preenchido
      if (processData.dados_faltantes) {
        updates.dados_faltantes = processData.dados_faltantes.filter((f: string) => !dados[f]);
      }

      // Se tudo estiver resolvido, atualizar status
      const totalDocsEnviados = updates.documentos_enviados || docsEnviados;
      const todosDocsOk = requisitosDocs.every((req: string) => totalDocsEnviados.includes(req));
      const todosCamposOk = (updates.dados_faltantes || processData.dados_faltantes || []).length === 0;
      const trackingOk = !!(updates.cliente_cpf_cnpj || processData.cliente_cpf_cnpj) && 
                         !!(updates.data_nascimento || processData.data_nascimento);

      if (todosDocsOk && todosCamposOk && trackingOk) {
        updates.status_atual = 'Em Análise';
        updates.status_info_extra = 'DOCUMENTAÇÃO COMPLETA - AGUARDANDO ANÁLISE';
      }

      await updateDoc(processRef, updates);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'order_processes');
    throw error;
  }
}
