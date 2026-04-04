import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// ==========================================
// 1. CLOUD FUNCTION: PROCESSAR VENDA SEGURA
// ==========================================
export const processarVendaSegura = functions.https.onCall(async (data, context) => {
  // Trava 1: Usuário precisa estar logado
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const { servicoId, clienteId, metodoPagamento, valorVendaFinal } = data;
  const vendedorId = context.auth.uid;

  // Inicia uma Transação (ou salva tudo, ou cancela tudo)
  return await db.runTransaction(async (transaction) => {
    // Busca Vendedor para saber o Nível (GESTOR ou VENDEDOR) e o Gestor Responsável
    const userRef = db.collection('usuarios').doc(vendedorId);
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data();
    const userRole = userData?.role;
    const managerId = userData?.managerId || null;

    // Busca Serviço para saber o Preço Real de Custo
    const serviceRef = db.collection('services').doc(servicoId);
    const serviceSnap = await transaction.get(serviceRef);
    if (!serviceSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Serviço não encontrado.');
    }
    const serviceData = serviceSnap.data();

    // Busca Cliente
    const clientRef = db.collection('clients').doc(clienteId);
    const clientSnap = await transaction.get(clientRef);
    const clientData = clientSnap.data();

    // Trava 2: Validação Financeira de Preço Mínimo
    const precoBase = (userRole === 'GESTOR' || userRole === 'ADM_MASTER' || userRole === 'ADM_GERENTE') 
      ? serviceData?.preco_base_gestor 
      : serviceData?.preco_base_vendedor;

    if (valorVendaFinal < precoBase) {
      throw new functions.https.HttpsError('invalid-argument', 'Tentativa de fraude detectada: Valor final abaixo do custo base.');
    }

    // Gera o Protocolo
    const protocolo = `#GSA-${Date.now().toString().slice(-6)}`;

    // Cria a Venda
    const vendaRef = db.collection('sales').doc();
    transaction.set(vendaRef, {
      protocolo,
      cliente_id: clienteId,
      cliente_nome: clientData?.nome || 'Cliente',
      vendedor_id: vendedorId,
      vendedor_nome: userData?.nome || 'Vendedor',
      managerId: managerId, // Adiciona o vínculo com o gestor
      valor_total: valorVendaFinal,
      metodo_pagamento: metodoPagamento,
      status_pagamento: metodoPagamento === 'PIX' ? 'Pendente' : 'Débito em Carteira',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Cria o Processo na Tela de Operações
    const processRef = db.collection('order_processes').doc();
    transaction.set(processRef, {
      venda_id: vendaRef.id,
      protocolo,
      cliente_id: clienteId,
      cliente_nome: clientData?.nome || 'Cliente',
      vendedor_id: vendedorId,
      vendedor_nome: userData?.nome || 'Vendedor',
      managerId: managerId, // Adiciona o vínculo com o gestor
      servico_id: servicoId,
      servico_nome: serviceData?.nome,
      status_atual: 'Pendente',
      preco_base: precoBase,
      preco_venda: valorVendaFinal,
      prazo_estimado_dias: serviceData?.prazo_estimado_dias || 15,
      data_inicial: admin.firestore.FieldValue.serverTimestamp()
    });

    // Cria o Extrato Financeiro
    const transacaoRef = db.collection('financial_transactions').doc();
    transaction.set(transacaoRef, {
      cliente_id: clienteId,
      venda_id: vendaRef.id,
      vendedor_id: vendedorId,
      vendedor_nome: userData?.nome || 'Vendedor',
      managerId: managerId, // Adiciona o vínculo com o gestor
      valor: -valorVendaFinal,
      tipo: 'DEBITO',
      origem: 'VENDA',
      descricao: `Débito Venda ${protocolo}`,
      confirmado_pelo_administrador: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { saleId: vendaRef.id, protocolo };
  });
});

// ==========================================
// 2. CLOUD FUNCTION: SOLICITAR SAQUE SEGURO
// ==========================================
export const solicitarSaqueSeguro = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const { valor } = data;
  const clienteId = context.auth.uid; // Garante que o usuário só saca da própria carteira

  return await db.runTransaction(async (transaction) => {
    const walletQuery = db.collection('wallets').where('cliente_id', '==', clienteId).limit(1);
    const walletSnap = await transaction.get(walletQuery);
    
    if (walletSnap.empty) {
      throw new functions.https.HttpsError('not-found', 'Carteira não encontrada.');
    }
    
    const walletDoc = walletSnap.docs[0];
    const walletData = walletDoc.data();

    // Trava: O servidor checa o saldo real
    if (walletData.saldo_atual < valor) {
      throw new functions.https.HttpsError('failed-precondition', 'Tentativa de fraude: Saldo insuficiente.');
    }

    const transRef = db.collection('financial_transactions').doc();
    transaction.set(transRef, {
      cliente_id: clienteId,
      valor: -valor,
      tipo: 'DEBITO',
      origem: 'SAQUE',
      descricao: 'Solicitação de Saque',
      confirmado_pelo_administrador: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  });
});
