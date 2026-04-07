import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, limit, orderBy } from 'firebase/firestore';

export const consultaPublicaProcesso = async (documento: string, dataNascimento: string) => {
  if (!documento || !dataNascimento) {
    throw new Error("Documento e Data de Nascimento são obrigatórios.");
  }

  // 1. Busca o cliente com validação dupla obrigatória
  // Primeiro tentamos na coleção 'usuarios' (novo padrão)
  let qCliente = query(
    collection(db, 'usuarios'), 
    where('cpf', '==', documento),
    where('data_nascimento', '==', dataNascimento),
    limit(1)
  );
  
  let snapCliente = await getDocs(qCliente);
  
  // Se não encontrar, tentamos na coleção 'clients' (legado)
  if (snapCliente.empty) {
    qCliente = query(
      collection(db, 'clients'), 
      where('documento', '==', documento),
      where('data_nascimento', '==', dataNascimento),
      limit(1)
    );
    snapCliente = await getDocs(qCliente);
  }

  if (snapCliente.empty) {
    throw new Error("Dados não conferem ou cliente não encontrado.");
  }
  
  const clienteId = snapCliente.docs[0].id;
  const clienteData = snapCliente.docs[0].data();

  // 2. Busca o processo mais recente vinculado a este cliente com validação de segurança
  const qProc = query(
    collection(db, 'order_processes'),
    where('cliente_id', '==', clienteId),
    limit(10) // Busca os últimos 10 para garantir que pegamos o mais recente em memória se necessário
  );

  const snapProc = await getDocs(qProc);
  if (snapProc.empty) return null;

  // Ordena em memória para evitar necessidade de índice composto complexo no Firestore
  const processos = snapProc.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
  processos.sort((a, b) => {
    const dateA = a.data_venda?.seconds || 0;
    const dateB = b.data_venda?.seconds || 0;
    return dateB - dateA;
  });

  return {
    ...processos[0],
    cliente_saldo_pontos: clienteData.saldo_pontos || 0
  };
};

// Listar Indicações do Cliente (para o Portal Público)
export const listarMinhasIndicacoesPublicas = async (documento: string, dataNascimento: string) => {
  // 1. Busca o cliente para validar (Tenta usuarios primeiro, depois clients)
  let qCliente = query(
    collection(db, 'usuarios'), 
    where('cpf', '==', documento),
    where('data_nascimento', '==', dataNascimento),
    limit(1)
  );
  let snapCliente = await getDocs(qCliente);
  
  if (snapCliente.empty) {
    qCliente = query(
      collection(db, 'clients'), 
      where('documento', '==', documento),
      where('data_nascimento', '==', dataNascimento),
      limit(1)
    );
    snapCliente = await getDocs(qCliente);
  }

  if (snapCliente.empty) return [];

  const clienteId = snapCliente.docs[0].id;

  // 2. Busca as indicações vinculadas a este cliente (pelo ID ou pelo Documento)
  const qReferrals = query(
    collection(db, 'referrals'),
    where('cliente_origem_id', 'in', [clienteId, documento]),
    orderBy('timestamp', 'desc'),
    limit(20)
  );

  const snapReferrals = await getDocs(qReferrals);
  return snapReferrals.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Listar Pendências de um Cliente (para o Portal Público)
export const listarPendenciasPublicas = async (clienteId: string) => {
  // 1. Primeiro buscamos os IDs dos processos do cliente
  const qProc = query(
    collection(db, 'order_processes'),
    where('cliente_id', '==', clienteId),
    limit(20)
  );
  const snapProc = await getDocs(qProc);
  if (snapProc.empty) return [];
  
  const processoIds = snapProc.docs.map(doc => doc.id);

  // 2. Buscamos todas as pendências vinculadas a esses processos
  // Dividimos em chunks de 10 devido ao limite do 'in' no Firestore
  const pendencias: any[] = [];
  for (let i = 0; i < processoIds.length; i += 10) {
    const chunk = processoIds.slice(i, i + 10);
    const qPend = query(
      collection(db, 'pendencies'),
      where('processo_id', 'in', chunk)
    );
    const snapPend = await getDocs(qPend);
    pendencias.push(...snapPend.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  return pendencias;
};

// Listar Notificações do Cliente (para o Portal Público)
export const listarNotificacoesPublicas = async (clienteId: string) => {
  const qNotif = query(
    collection(db, 'notifications'),
    where('usuario_id', '==', clienteId),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  const snapNotif = await getDocs(qNotif);
  return snapNotif.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Registrar Indicação vinda da área pública
export const registrarIndicacaoPublica = async (documento: string, dataNascimento: string, nomeAmigo: string, whatsAmigo: string, bonusValor: number = 50) => {
  // 1. Busca o cliente para pegar o ID real (Tenta usuarios primeiro, depois clients)
  let qCliente = query(
    collection(db, 'usuarios'), 
    where('cpf', '==', documento),
    where('data_nascimento', '==', dataNascimento),
    limit(1)
  );
  let snapCliente = await getDocs(qCliente);
  
  if (snapCliente.empty) {
    qCliente = query(
      collection(db, 'clients'), 
      where('documento', '==', documento),
      where('data_nascimento', '==', dataNascimento),
      limit(1)
    );
    snapCliente = await getDocs(qCliente);
  }

  const clienteId = !snapCliente.empty ? snapCliente.docs[0].id : documento;

  await addDoc(collection(db, 'referrals'), {
    nome_indicado: nomeAmigo,
    telefone_indicado: whatsAmigo,
    cliente_origem_id: clienteId,
    origem_tipo: 'CLIENTE',
    vendedor_id: 'ADM',
    status_indicacao: 'Enviado',
    timestamp: serverTimestamp(),
    cadastrado: false,
    bloqueado: false,
    origem: 'PORTAL_PUBLICO',
    bonus_valor: bonusValor
  });
};
