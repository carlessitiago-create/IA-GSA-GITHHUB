import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Inicializa o admin SDK apenas uma vez
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = getFirestore('ai-studio-2473fb05-836e-42bf-bfe7-6175607907dd');

// Configuração Mercado Pago
// Tenta ler de functions.config() (legado/CLI) ou process.env (moderno)
const MP_TOKEN = functions.config().mp?.access_token || 
                 process.env.MP_ACCESS_TOKEN || 
                 'APP_USR-4343959448906136-101900-bd86782be2ecf529a1c0e25c935bf4f1-124360597';

const mpClient = new MercadoPagoConfig({ 
  accessToken: MP_TOKEN
});
const mpPayment = new Payment(mpClient);

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
  try {
    const { clienteId, itens, metodoPagamento, comprovanteUrl, clienteNome, clienteDocumento, dataNascimento } = data;
    if (!clienteId || !itens || !metodoPagamento) {
      throw new functions.https.HttpsError('invalid-argument', 'Dados incompletos');
    }

    return await db.runTransaction(async (transaction) => {
    // 0. Fetch Salesperson Profile
    let vendedorId = context.auth?.uid || 'SYSTEM_SAAS';
    let vendedorNome = 'GSA-IA SaaS';
    let managerId = null;

    if (context.auth) {
      const userRef = db.collection('usuarios').doc(context.auth.uid);
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data();
      managerId = userData?.managerId || null;
      vendedorNome = userData?.nome || 'Vendedor';
    }

    // 1. Generate protocol (simplified for now, ideally use a counter)
    const ano = new Date().getFullYear();
    const protocolo = `#GSA-${ano}-${Date.now()}`; // Simplified protocol
    
    // 2. Calculate totals
    let valorTotal = 0;
    let margemTotal = 0;
    const processDataList: any[] = [];

    if (!Array.isArray(itens) || itens.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'A lista de itens não pode estar vazia');
    }

    for (const item of itens) {
      const servicoRef = db.doc(`services/${item.servicoId}`);
      const servicoSnap = await transaction.get(servicoRef);
      
      let servicoData: any = null;
      if (servicoSnap.exists) {
        servicoData = servicoSnap.data();
      } else if (vendedorId === 'SYSTEM_SAAS') {
        // Fallback for SaaS sales if service doc is missing
        servicoData = {
          nome: item.servicoNome || 'Serviço SaaS',
          modelo_id: '',
          documentos: [],
          campos: []
        };
      } else {
        throw new functions.https.HttpsError('not-found', `Serviço ${item.servicoId} não encontrado`);
      }
      
      const precoBase = Number(item.precoBase) || 0;
      const precoVenda = Number(item.precoVenda) || 0;
      
      valorTotal += precoVenda;
      margemTotal += (precoVenda - precoBase);

      // Get model info
      let modeloId = servicoData?.modelo_id || '';
      let pendenciasIniciais = servicoData?.documentos || [];
      let dadosFaltantes = servicoData?.campos || [];

      if (modeloId) {
        const modelSnap = await transaction.get(db.doc(`process_models/${modeloId}`));
        if (modelSnap.exists) {
          const modelData = modelSnap.data();
          if (modelData) {
            pendenciasIniciais = modelData.documentos || [];
            dadosFaltantes = modelData.campos || [];
          }
        }
      }

      processDataList.push({
        servicoId: item.servicoId || '',
        servicoNome: item.servicoNome || servicoData?.nome || 'Serviço',
        precoBase,
        precoVenda,
        prazoEstimadoDias: Number(item.prazoEstimadoDias) || 7,
        modeloId,
        pendenciasIniciais,
        dadosFaltantes
      });
    }

    // 3. Logic for Payment and Status
    let statusPagamento = metodoPagamento === 'PIX' ? 'Aguardando Confirmação' : 'Pendente';
    let statusProcesso = metodoPagamento === 'PIX' ? 'Aguardando Aprovação' : 'Pendente';
    let transacaoConfirmada = false;
    let responsavelId = vendedorId;

    // Fetch client data to find specialist/responsible
    const clientRef = db.collection('clients').doc(clienteId);
    const clientSnap = await transaction.get(clientRef);
    if (!clientSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Cliente não encontrado');
    }
    const clientData = clientSnap.data() || {};
    responsavelId = clientData.especialista_id || vendedorId;
    const visibilidade_uids = clientData.visibilidade_uids || [];

    if (metodoPagamento === 'CARTEIRA') {
      // Get client's wallet
      // Note: transaction.get(query) is not supported in Admin SDK.
      // We fetch the wallet doc reference first.
      const walletQuery = await db.collection('wallets').where('cliente_id', '==', clienteId).limit(1).get();
      
      let saldoDisponivel = 0;
      let walletId = null;
      let walletData: any = null;

      if (!walletQuery.empty) {
        walletId = walletQuery.docs[0].id;
        const walletRef = db.collection('wallets').doc(walletId);
        const walletSnap = await transaction.get(walletRef);
        walletData = walletSnap.data();
        saldoDisponivel = (walletData?.saldo_atual || 0) + (walletData?.saldo_bonus || 0);
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
      vendedor_id: vendedorId,
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
        servico_id: pData.servicoId || '',
        servico_nome: pData.servicoNome || '',
        status_atual: statusProcesso,
        preco_base: pData.precoBase || 0,
        preco_venda: pData.precoVenda || 0,
        margem_lucro: (pData.precoVenda || 0) - (pData.precoBase || 0),
        prazo_estimado_dias: pData.prazoEstimadoDias || 7,
        vendedor_id: vendedorId,
        vendedor_nome: vendedorNome,
        managerId: managerId,
        cliente_id: clienteId,
        cliente_nome: clienteNome || '',
        cliente_cpf_cnpj: clienteDocumento || '',
        data_nascimento: dataNascimento || '',
        data_venda: admin.firestore.FieldValue.serverTimestamp(),
        modelo_id: pData.modeloId || '',
        pendencias_iniciais: pData.pendenciasIniciais || [],
        dados_faltantes: pData.dadosFaltantes || []
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
        vendedor_id: vendedorId,
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
        vendedor_id: vendedorId,
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
          vendedor_id: vendedorId,
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
          vendedor_id: vendedorId,
          vendedor_nome: vendedorNome,
          managerId: managerId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          visibilidade_uids: [responsavelId, vendedorId]
        });
      }
    }

    return { saleId: saleRef.id, protocolo };
    });
  } catch (error: any) {
    console.error("Erro em processVenda:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    // Garante que o erro seja repassado com uma mensagem útil
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('internal', `Erro em processVenda: ${errorMessage}`);
  }
});

// ==========================================
// 4. CLOUD FUNCTION: GERAR PAGAMENTO MERCADO PAGO
// ==========================================
export const gerarPagamentoSaaS = functions.https.onCall(async (data, context) => {
  try {
    const { valor, plano, email, nome, cpf, clienteId, vendaId } = data;
    
    console.log("Iniciando gerarPagamentoSaaS:", { valor, plano, email, clienteId, vendaId });

    if (!valor || !email || !nome || !cpf || !vendaId) {
      throw new functions.https.HttpsError('invalid-argument', 'Dados incompletos para gerar pagamento.');
    }

    if (MP_TOKEN === 'PROD_ACCESS_TOKEN_AQUI' || !MP_TOKEN) {
      console.error("ERRO: MP_ACCESS_TOKEN não configurado nas variáveis de ambiente.");
      throw new functions.https.HttpsError('failed-precondition', 'Configuração de pagamento pendente (MP_ACCESS_TOKEN ausente).');
    }

    const payment_data = {
      body: {
        transaction_amount: Number(valor),
        description: `Plano ${plano} - GSA-IA`,
        payment_method_id: 'pix',
        external_reference: vendaId,
        payer: {
          email: email,
          first_name: nome.split(' ')[0],
          last_name: nome.split(' ').slice(1).join(' ') || 'Cliente',
          identification: {
            type: 'CPF',
            number: cpf.replace(/\D/g, '')
          }
        },
        notification_url: `https://us-central1-${process.env.GCLOUD_PROJECT || 'gen-lang-client-0086269527'}.cloudfunctions.net/webhookMercadoPago`,
        metadata: {
          cliente_id: clienteId,
          venda_id: vendaId,
          plano: plano
        }
      }
    };

    console.log("Chamando mpPayment.create...");
    const response = await mpPayment.create(payment_data);
    console.log("Resposta MP recebida. ID:", response.id);
    
    // Atualiza a venda com o ID do pagamento do Mercado Pago
    await db.collection('sales').doc(vendaId).update({
      mp_payment_id: response.id?.toString(),
      mp_status: response.status
    });

    return {
      id: response.id,
      status: response.status,
      qr_code: response.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      copy_paste: response.point_of_interaction?.transaction_data?.qr_code,
    };
  } catch (error: any) {
    console.error("Erro detalhado ao gerar pagamento MP:", error);
    
    // Se for erro do Mercado Pago (pode ter estrutura específica)
    if (error.cause && Array.isArray(error.cause)) {
      const mpError = error.cause[0]?.description || 'Erro no Mercado Pago';
      throw new functions.https.HttpsError('internal', `Mercado Pago: ${mpError}`);
    }

    if (error instanceof functions.https.HttpsError) throw error;
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('internal', `Erro ao gerar pagamento: ${errorMessage}`);
  }
});

// ==========================================
// 5. WEBHOOK: MERCADO PAGO NOTIFICATION
// ==========================================
export const webhookMercadoPago = functions.https.onRequest(async (req, res) => {
  try {
    const { type, data } = req.body;
    
    console.log("Webhook MP recebido:", { type, data });

    if (type === 'payment') {
      const paymentId = data.id;
      const paymentInfo = await mpPayment.get({ id: paymentId });
      
      console.log("Status do pagamento MP:", paymentInfo.status);

      if (paymentInfo.status === 'approved') {
        const vendaId = paymentInfo.external_reference || paymentInfo.metadata?.venda_id;
        
        if (vendaId) {
          const saleRef = db.collection('sales').doc(vendaId);
          const saleSnap = await saleRef.get();
          
          if (saleSnap.exists && saleSnap.data()?.status_pagamento !== 'Pago') {
            await saleRef.update({
              status_pagamento: 'Pago',
              pago_em: admin.firestore.FieldValue.serverTimestamp(),
              mp_status: 'approved'
            });
            
            // Atualiza os processos vinculados
            const processesQuery = await db.collection('order_processes')
              .where('venda_id', '==', vendaId)
              .get();
              
            const batch = db.batch();
            processesQuery.forEach(doc => {
              batch.update(doc.ref, { status_atual: 'Em Análise' });
            });
            await batch.commit();
            
            console.log(`Venda ${vendaId} marcada como Paga via Webhook.`);
          }
        }
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error("Erro no Webhook MP:", error);
    res.status(500).send('Internal Server Error');
  }
});
