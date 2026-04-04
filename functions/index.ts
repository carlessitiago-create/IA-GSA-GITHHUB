import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Inicializa o admin SDK apenas uma vez
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

export const criarAdministradorDeUsuarios = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  // Verificar se o usuário tem nível ADM ou GESTOR no banco
  const callerRef = db.collection('usuarios').doc(context.auth.uid);
  const callerSnap = await callerRef.get();
  const callerData = callerSnap.data();
  
  const isAdmOrGestor = callerData?.role === 'ADM_MASTER' || 
                        callerData?.role === 'ADM_MESTRE' || 
                        callerData?.role === 'ADM_GERENTE' || 
                        callerData?.role === 'ADM' || 
                        callerData?.role === 'GESTOR';

  if (!isAdmOrGestor) {
    throw new functions.https.HttpsError('permission-denied', 'Você não tem permissão para criar usuários.');
  }

  const { nome, email, senha, role, cpf, data_nascimento, telefone, id_superior } = data;

  try {
    // Criar usuário no Auth
    const userRecord = await admin.auth().createUser({
      email,
      password: senha || 'Mudar@123',
      displayName: nome,
    });

    // Gravar dados complementares no Firestore
    const newProfile = {
      uid: userRecord.uid,
      nome,
      email,
      role,
      saldo_pontos: 0,
      nivel_fidelidade: 'BRONZE',
      data_cadastro: admin.firestore.FieldValue.serverTimestamp(),
      ativo: true,
      cpf,
      data_nascimento,
      telefone,
      status: 'APROVADO',
      id_superior: id_superior || null
    };

    await db.collection('usuarios').doc(userRecord.uid).set(newProfile);

    return { uid: userRecord.uid };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Erro ao criar usuário: ' + error);
  }
});

export const atualizarSenhaUsuario = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  // Verificar se o usuário tem nível ADM no banco
  const callerRef = db.collection('usuarios').doc(context.auth.uid);
  const callerSnap = await callerRef.get();
  const callerData = callerSnap.data();
  
  const isAdm = callerData?.role === 'ADM_MASTER' || 
                callerData?.role === 'ADM_MESTRE' || 
                callerData?.role === 'ADM_GERENTE';

  if (!isAdm) {
    throw new functions.https.HttpsError('permission-denied', 'Você não tem permissão para alterar senhas.');
  }

  const { uid, novaSenha } = data;

  if (!uid || !novaSenha) {
    throw new functions.https.HttpsError('invalid-argument', 'UID e nova senha são obrigatórios.');
  }

  try {
    await admin.auth().updateUser(uid, {
      password: novaSenha
    });

    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Erro ao atualizar senha: ' + error);
  }
});

export const processVenda = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { clienteId, itens, metodoPagamento, comprovanteUrl, clienteNome, clienteDocumento, dataNascimento } = data;
  if (!clienteId || !itens || !metodoPagamento) {
    throw new functions.https.HttpsError('invalid-argument', 'Dados incompletos');
  }

  return await db.runTransaction(async (transaction) => {
    // 0. Fetch Salesperson Profile
    const userRef = db.collection('usuarios').doc(context.auth!.uid);
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data();
    const managerId = userData?.managerId || null;
    const vendedorNome = userData?.nome || 'Vendedor';

    // 1. Generate protocol (simplified for now, ideally use a counter)
    const ano = new Date().getFullYear();
    const protocolo = `#GSA-${ano}-${Date.now()}`; // Simplified protocol
    
    // 2. Calculate totals
    let valorTotal = 0;
    let margemTotal = 0;
    const processDataList: any[] = [];

    for (const item of itens) {
      const servicoRef = db.doc(`services/${item.servicoId}`);
      const servicoSnap = await transaction.get(servicoRef);
      if (!servicoSnap.exists) {
        throw new functions.https.HttpsError('not-found', `Serviço ${item.servicoId} não encontrado`);
      }
      const servicoData = servicoSnap.data();
      
      const precoBase = item.precoBase; // Should be validated against service data
      const precoVenda = item.precoVenda;
      
      valorTotal += precoVenda;
      margemTotal += (precoVenda - precoBase);

      // Get model info
      let modeloId = servicoData.modelo_id || '';
      let pendenciasIniciais = [];
      let dadosFaltantes = [];

      if (modeloId) {
        const modelSnap = await transaction.get(db.doc(`process_models/${modeloId}`));
        if (modelSnap.exists) {
          const modelData = modelSnap.data();
          pendenciasIniciais = modelData.documentos || [];
          dadosFaltantes = modelData.campos || [];
        }
      }

      processDataList.push({
        servicoId: item.servicoId,
        servicoNome: item.servicoNome,
        precoBase,
        precoVenda,
        prazoEstimadoDias: item.prazoEstimadoDias,
        modeloId,
        pendenciasIniciais,
        dadosFaltantes
      });
    }

    // 3. Logic for Payment and Status
    let statusPagamento = metodoPagamento === 'PIX' ? 'Aguardando Confirmação' : 'Pendente';
    let statusProcesso = metodoPagamento === 'PIX' ? 'Aguardando Aprovação' : 'Pendente';
    let transacaoConfirmada = false;
    let responsavelId = context.auth!.uid;

    // Fetch client data to find specialist/responsible
    const clientRef = db.collection('clients').doc(clienteId);
    const clientSnap = await transaction.get(clientRef);
    if (!clientSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Cliente não encontrado');
    }
    const clientData = clientSnap.data() || {};
    responsavelId = clientData.especialista_id || context.auth!.uid;
    const visibilidade_uids = clientData.visibilidade_uids || [];

    if (metodoPagamento === 'CARTEIRA') {
      // Get client's wallet
      const walletQuery = db.collection('wallets').where('cliente_id', '==', clienteId).limit(1);
      const walletSnap = await transaction.get(walletQuery);
      
      let saldoDisponivel = 0;
      let walletId = null;
      let walletData: any = null;

      if (!walletSnap.empty) {
        walletId = walletSnap.docs[0].id;
        walletData = walletSnap.docs[0].data();
        saldoDisponivel = (walletData.saldo_atual || 0) + (walletData.saldo_bonus || 0);
      }

      if (saldoDisponivel >= valorTotal) {
        // Aprovado imediatamente
        statusPagamento = 'Pago';
        statusProcesso = 'Em Análise';
        transacaoConfirmada = true;

        // Debit from client wallet
        if (walletId) {
          const walletRef = db.collection('wallets').doc(walletId);
          let valorRestante = valorTotal;
          let novoSaldoBonus = walletData.saldo_bonus || 0;
          let novoSaldoAtual = walletData.saldo_atual || 0;

          if (novoSaldoBonus >= valorRestante) {
            novoSaldoBonus -= valorRestante;
            valorRestante = 0;
          } else {
            valorRestante -= novoSaldoBonus;
            novoSaldoBonus = 0;
            novoSaldoAtual -= valorRestante;
          }

          transaction.update(walletRef, {
            saldo_atual: novoSaldoAtual,
            saldo_bonus: novoSaldoBonus,
            ultima_atualizacao: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        // Saldo insuficiente -> Vai para carteira do responsável e aguarda liberação
        statusPagamento = 'Aguardando Liberação ADM';
        statusProcesso = 'Aguardando Liberação';
        transacaoConfirmada = false;
      }
    }

    // 4. Create sale
    const saleRef = db.collection('sales').doc();
    transaction.set(saleRef, {
      protocolo,
      cliente_id: clienteId,
      vendedor_id: context.auth!.uid,
      vendedor_nome: vendedorNome,
      managerId: managerId,
      valor_total: valorTotal,
      margem_total: margemTotal,
      metodo_pagamento: metodoPagamento,
      status_pagamento: statusPagamento,
      comprovante_url: comprovanteUrl || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // 5. Create processes
    for (const pData of processDataList) {
      const processRef = db.collection('order_processes').doc();
      transaction.set(processRef, {
        venda_id: saleRef.id,
        protocolo,
        servico_id: pData.servicoId,
        servico_nome: pData.servicoNome,
        status_atual: statusProcesso,
        preco_base: pData.precoBase,
        preco_venda: pData.precoVenda,
        margem_lucro: pData.precoVenda - pData.precoBase,
        prazo_estimado_dias: pData.prazoEstimadoDias,
        vendedor_id: context.auth!.uid,
        vendedor_nome: vendedorNome,
        managerId: managerId,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        cliente_cpf_cnpj: clienteDocumento || '',
        data_nascimento: dataNascimento || '',
        data_venda: admin.firestore.FieldValue.serverTimestamp(),
        modelo_id: pData.modeloId,
        pendencias_iniciais: pData.pendenciasIniciais,
        dados_faltantes: pData.dadosFaltantes
      });
    }

    // 6. Create Financial Transactions
    if (metodoPagamento === 'PIX') {
      // Create pending transactions for client
      const creditRef = db.collection('financial_transactions').doc();
      transaction.set(creditRef, {
        cliente_id: clienteId,
        valor: valorTotal,
        tipo: 'CREDITO',
        origem: 'DEPOSITO_PIX',
        descricao: `Pagamento PIX Venda ${saleRef.id.slice(0, 8)}`,
        confirmado_pelo_administrador: false,
        venda_id: saleRef.id,
        vendedor_id: context.auth!.uid,
        vendedor_nome: vendedorNome,
        managerId: managerId,
        comprovante_url: comprovanteUrl || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        visibilidade_uids: visibilidade_uids
      });

      const debitRef = db.collection('financial_transactions').doc();
      transaction.set(debitRef, {
        cliente_id: clienteId,
        valor: -valorTotal,
        tipo: 'DEBITO',
        origem: 'VENDA',
        descricao: `Débito Venda ${saleRef.id.slice(0, 8)}`,
        confirmado_pelo_administrador: false,
        venda_id: saleRef.id,
        vendedor_id: context.auth!.uid,
        vendedor_nome: vendedorNome,
        managerId: managerId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        visibilidade_uids: visibilidade_uids
      });
    } else if (metodoPagamento === 'CARTEIRA') {
      if (transacaoConfirmada) {
        // Transaction already confirmed (debited from wallet)
        const transRef = db.collection('financial_transactions').doc();
        transaction.set(transRef, {
          cliente_id: clienteId,
          valor: -valorTotal,
          tipo: 'DEBITO',
          origem: 'VENDA',
          descricao: `Pagamento via Carteira (Saldo Disponível) - Venda ${saleRef.id.slice(0, 8)}`,
          confirmado_pelo_administrador: true,
          venda_id: saleRef.id,
          vendedor_id: context.auth!.uid,
          vendedor_nome: vendedorNome,
          managerId: managerId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          visibilidade_uids: visibilidade_uids
        });
      } else {
        // Pending transaction for responsible person
        const transRef = db.collection('financial_transactions').doc();
        transaction.set(transRef, {
          cliente_id: responsavelId,
          valor: -valorTotal,
          tipo: 'DEBITO',
          origem: 'VENDA',
          descricao: `Venda Pagar Depois (Cliente ${clientData.nome} sem saldo) - Aguardando Liberação - Venda ${saleRef.id.slice(0, 8)}`,
          confirmado_pelo_administrador: false,
          venda_id: saleRef.id,
          vendedor_id: context.auth!.uid,
          vendedor_nome: vendedorNome,
          managerId: managerId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          visibilidade_uids: [responsavelId, context.auth!.uid]
        });
      }
    }

    return { saleId: saleRef.id };
  });
});
