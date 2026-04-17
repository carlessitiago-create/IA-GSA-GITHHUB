import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';

// Inicializa o admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const app = admin.apps[0]!;

// Obtém o databaseId de forma segura
let dbId = 'ai-studio-2473fb05-836e-42bf-bfe7-6175607907dd';
try {
    const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.firestoreDatabaseId) dbId = config.firestoreDatabaseId;
    }
} catch (e) {
    console.warn("Usando databaseId padrão devido a erro na config:", e);
}

// Inicializa o Firestore
const db = getFirestore(app, dbId);
console.log(`Cloud Functions conectadas ao Firestore DB: ${dbId}`);

// Helper para obter configuração SaaS do Firestore
async function getSaasAdminConfig() {
    try {
        const saasRef = db.collection('platform_config').doc('saas_settings');
        const saasSnap = await saasRef.get();
        return saasSnap.data() || {};
    } catch (e) {
        console.error("Erro ao obter saas_settings:", e);
        return {};
    }
}

/**
 * Replicando a lógica do pointsService no Back-end para o Webhook
 */
async function processarBonusDeVendaNoBackend(vendaId: string, batch: admin.firestore.WriteBatch) {
    try {
        const saleSnap = await db.collection('sales').doc(vendaId).get();
        if (!saleSnap.exists) return;
        const sale = saleSnap.data()!;

        const rulesSnap = await db.collection('platform_config').doc('points_rules').get();
        const rules = rulesSnap.data()?.valores || {
            cadastro: 50,
            indicacao: 100,
            venda_vendedor: 150,
            venda_gestor: 75
        };

        // 1. Ganho Direto (Pontos de Venda)
        if (sale.vendedor_id) {
            batch.update(db.collection('usuarios').doc(sale.vendedor_id), {
                saldo_pontos: admin.firestore.FieldValue.increment(rules.venda_vendedor)
            });
            batch.set(db.collection('points_history').doc(), cleanDataForFirestore({
                userId: sale.vendedor_id,
                quantidade: rules.venda_vendedor,
                motivo: `Venda ${vendaId.substring(0, 8)} Concluída (Gateway)`,
                tipo: 'GANHO',
                data: admin.firestore.FieldValue.serverTimestamp()
            }));
        }

        if (sale.id_superior) {
            batch.update(db.collection('usuarios').doc(sale.id_superior), {
                saldo_pontos: admin.firestore.FieldValue.increment(rules.venda_gestor)
            });
            batch.set(db.collection('points_history').doc(), cleanDataForFirestore({
                userId: sale.id_superior,
                quantidade: rules.venda_gestor,
                motivo: `Bônus Liderança: Venda Equipe (${vendaId.substring(0, 8)})`,
                tipo: 'GANHO',
                data: admin.firestore.FieldValue.serverTimestamp()
            }));
        }

        // 2. Bonus de Indicação (MGM)
        const clientSnap = await db.collection('clients').doc(sale.cliente_id).get();
        const clientData = clientSnap.data();
        if (clientData?.indicado_por_uid) {
            batch.update(db.collection('usuarios').doc(clientData.indicado_por_uid), {
                saldo_pontos: admin.firestore.FieldValue.increment(rules.indicacao)
            });
            batch.set(db.collection('points_history').doc(), cleanDataForFirestore({
                userId: clientData.indicado_por_uid,
                quantidade: rules.indicacao,
                motivo: `Bônus MGM: Amigo (${clientData.nome_completo}) Ativou conta`,
                tipo: 'GANHO',
                data: admin.firestore.FieldValue.serverTimestamp()
            }));
        }
    } catch (error) {
        console.error("Erro ao processar bônus no webhook:", error);
    }
}

/**
 * Robust utility to clean objects for Firestore.
 * - Removes undefined
 * - Converts NaN to 0
 * - Preserves special Firestore types
 * - Prevents empty objects from becoming undefined at the root level
 */
function cleanDataForFirestore(obj: any, isRoot = true): any {
    if (obj === null || obj === undefined) return isRoot ? {} : undefined;
    
    // Handle Primitive Types
    if (typeof obj === 'number') return isFinite(obj) ? obj : 0;
    if (typeof obj !== 'object') return obj;

    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj.map(v => cleanDataForFirestore(v, false)).filter(v => v !== undefined);
    }

    // Preserve special objects (Firestore types)
    if (obj instanceof admin.firestore.FieldValue) return obj;
    if (obj instanceof admin.firestore.Timestamp || obj instanceof Date) return obj;
    
    // Safely check constructor name
    const constructorName = obj.constructor?.name;
    if (constructorName && !['Object', 'Array'].includes(constructorName)) return obj;

    const result: any = {};
    let hasData = false;
    
    Object.keys(obj).forEach((key) => {
        const val = cleanDataForFirestore(obj[key], false);
        if (val !== undefined) {
            result[key] = val;
            hasData = true;
        }
    });

    if (!hasData && !isRoot) return undefined;
    return result;
}

/**
 * Safe logging utility to prevent "Circular reference" crashes
 * and provide clean output.
 */
function logDetailed(message: string, data?: any) {
    if (!data) {
        console.log(`[INFO] ${message}`);
        return;
    }
    try {
        // Simple circular ref handler
        const cache = new Set();
        const safeData = JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) return '[Circular]';
                cache.add(value);
            }
            return value;
        }, 2);
        console.log(`[INFO] ${message}: ${safeData}`);
    } catch (e) {
        console.log(`[INFO] ${message}: [Data too complex to stringify: ${String(e)}]`);
    }
}

/**
 * Professional Enterprise Logging - INFO
 */
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) {
    logDetailed(`[${timestamp}] [INFO] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [INFO] ${message}`);
  }
}

/**
 * Professional Enterprise Logging - ERROR
 */
function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  if (error) {
    console.error(`[${timestamp}] [ERROR] ${message}`, error);
  } else {
    console.error(`[${timestamp}] [ERROR] ${message}`);
  }
}

/**
 * Standardized HttpsError wrapper for cleaner "internal" error prevention.
 * Converts 'internal' to 'aborted' to ensure technical details are not masked by Firebase.
 */
function throwHttpsError(code: functions.https.FunctionsErrorCode, message: string, originalError?: any): never {
    const safeCode = (code === 'internal' || code === 'unknown') ? 'aborted' : code;
    
    let technicalDetails = '';
    if (originalError) {
        if (originalError.response?.data) {
            technicalDetails = JSON.stringify(originalError.response.data);
        } else if (originalError.message) {
            technicalDetails = originalError.message;
        } else {
            technicalDetails = String(originalError);
        }
    }

    const detailMessage = technicalDetails ? `${message} [Info: ${technicalDetails}]` : message;
    
    console.error(`[HTTPS_ERROR] Code: ${safeCode} | Msg: ${message} | Technical: ${technicalDetails}`);
    
    throw new functions.https.HttpsError(safeCode, message, detailMessage);
}

/**
 * Asserts that the context has an authenticated user and returns the UID.
 */
function assertAuth(context: functions.https.CallableContext): string {
    if (!context.auth) {
        throwHttpsError('unauthenticated', 'Usuário não autenticado');
    }
    return context.auth.uid;
}

/**
 * Standardizes execution of Cloud Functions with robust logging and error conversion.
 */
function safeExecute(moduleName: string, handler: (data: any, context: functions.https.CallableContext) => Promise<any>) {
    return async (data: any, context: functions.https.CallableContext) => {
        try {
            console.log(`[${moduleName}] INICIO | UID: ${context.auth?.uid}`);
            const result = await handler(data, context);
            console.log(`[${moduleName}] SUCESSO`);
            return result;
        } catch (error: any) {
            console.error(`[${moduleName}] ERRO CRITICO:`, error);
            
            // Se já for um HttpsError com código seguro, repassamos
            if (error && typeof error === 'object' && typeof error.code === 'string') {
                if (error.code !== 'internal' && error.code !== 'unknown') {
                    throw error;
                }
            }
            
            // Caso contrário, convertemos para aborted com detalhes
            throwHttpsError('aborted', `Erro interno no módulo ${moduleName}`, error);
        }
    };
}

// Helper para obter cliente Mercado Pago configurado
async function getMPClient() {
    const config = await getSaasAdminConfig();
    const token = config.mercado_pago_access_token || 
                  process.env.MP_ACCESS_TOKEN || 
                  'APP_USR-4343959448906136-101900-bd86782be2ecf529a1c0e25c935bf4f1-124360597';
                  
    const client = new MercadoPagoConfig({ accessToken: token });
    return {
        client,
        payment: new Payment(client),
        projectId: config.projectId || process.env.GCLOUD_PROJECT || 'gen-lang-client-0086269527'
    };
}

// ==========================================
// CONFIGURAÇÃO ASAAS
// ==========================================
const ASAAS_URL = 'https://www.asaas.com/api/v3';

async function getAsaasHeaders() {
    const config = await getSaasAdminConfig();
    const key = config.asaas_key || process.env.ASAAS_KEY;
    if (!key) throw new Error("Chave do Asaas não configurada.");
    return {
        'access_token': key,
        'Content-Type': 'application/json'
    };
}

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

    await db.collection('usuarios').doc(userRecord.uid).set(cleanDataForFirestore(newProfile));

    return { uid: userRecord.uid };
  } catch (error: any) {
    console.error("Erro em criarAdministradorDeUsuarios:", error);
    throw new functions.https.HttpsError('aborted', 'Erro ao criar usuário: ' + (error?.message || error));
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
  } catch (error: any) {
    console.error("Erro em atualizarSenhaUsuario:", error);
    throw new functions.https.HttpsError('aborted', 'Erro ao atualizar senha: ' + (error?.message || error));
  }
});

export const processVenda = functions.https.onCall(
  safeExecute("PROCESS_VENDA", async (data, context) => {
    const { clienteId, itens, metodoPagamento, comprovanteUrl, clienteNome, clienteDocumento, dataNascimento } = data;
    if (!clienteId || !itens || !metodoPagamento) {
      throw new functions.https.HttpsError('invalid-argument', 'Dados incompletos');
    }

    return await db.runTransaction(async (transaction) => {
        logDetailed("Transação iniciada para processVenda", { clienteId, itemsLength: itens.length });
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

        transaction.update(walletRef, cleanDataForFirestore({
          saldo_atual: novoSaldoAtual,
          saldo_bonus: novoSaldoBonus,
          ultima_atualizacao: admin.firestore.FieldValue.serverTimestamp()
        }));
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
    transaction.set(saleRef, cleanDataForFirestore({
      protocolo,
      cliente_id: clienteId,
      vendedor_id: vendedorId,
      vendedor_nome: vendedorNome,
      managerId: managerId,
      valor_total: valorTotal,
      margem_total: margemTotal,
      metodo_pagamento: metodoPagamento,
      status_pagamento: statusPagamento,
      comprovante_url: comprovanteUrl || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      visibilidade_uids
    }));

    // 5. Create processes
    for (const pData of processDataList) {
      const processRef = db.collection('order_processes').doc();
      transaction.set(processRef, cleanDataForFirestore({
        venda_id: saleRef.id,
        protocolo,
        ...pData,
        status_atual: statusProcesso,
        vendedor_id: vendedorId,
        vendedor_nome: vendedorNome,
        managerId: managerId,
        cliente_id: clienteId,
        cliente_nome: clienteNome || '',
        cliente_cpf_cnpj: clienteDocumento || '',
        data_nascimento: dataNascimento || '',
        data_venda: admin.firestore.FieldValue.serverTimestamp(),
        visibilidade_uids
      }));
    }

    // 6. Create Financial Transactions
    if (metodoPagamento === 'PIX') {
      const creditRef = db.collection('financial_transactions').doc();
      transaction.set(creditRef, cleanDataForFirestore({
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
        comprovante_url: comprovanteUrl || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        visibilidade_uids: visibilidade_uids
      }));

      const debitRef = db.collection('financial_transactions').doc();
      transaction.set(debitRef, cleanDataForFirestore({
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
      }));
    } else if (metodoPagamento === 'CARTEIRA') {
      if (transacaoConfirmada) {
        const transRef = db.collection('financial_transactions').doc();
        transaction.set(transRef, cleanDataForFirestore({
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
        }));
      } else {
        const transRef = db.collection('financial_transactions').doc();
        transaction.set(transRef, cleanDataForFirestore({
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
        }));
      }
    }

    return { saleId: saleRef.id, protocolo };
    });
  })
);

// ==========================================
// 3.5 CLOUD FUNCTION: PROCESSAR VENDA SEGURA (VERSÃO ENTERPRISE)
// ==========================================
export const processarVendaSegura = functions.https.onCall(
  safeExecute("VENDA_SEGURA", async (data, context) => {
    const uid = assertAuth(context);
    const clean = cleanDataForFirestore;

    const {
      clienteId,
      servicoId,
      valorVendaFinal,
      metodoPagamento,
      isBulk = false,
      quantidade = 1
    } = data;

    if (!clienteId || !servicoId || valorVendaFinal === undefined) {
      throw new functions.https.HttpsError('invalid-argument', 'Dados incompletos');
    }

    const valor = Number(valorVendaFinal);
    const qty = Number(quantidade) || 1;

    if (isNaN(valor) || valor <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Valor inválido');
    }

    return await db.runTransaction(async (tx) => {
      console.log(`[VENDA_SEGURA] Iniciando transação para cliente: ${clienteId}`);

      // 🔍 1. VALIDAR VENDEDOR E SERVIÇO
      const userRef = db.collection('usuarios').doc(uid);
      const servicoRef = db.collection('services').doc(servicoId);

      const [userSnap, servicoSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(servicoRef)
      ]);

      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'Vendedor não encontrado');
      if (!servicoSnap.exists) throw new functions.https.HttpsError('not-found', 'Serviço não encontrado');

      const user = userSnap.data()!;
      const servico = servicoSnap.data()!;
      const nivel = user.role || 'CLIENTE';

      console.log(`[VENDA_SEGURA] Vendedor: ${user.nome_completo}, Nível: ${nivel}`);

      // 🔍 2. VALIDAR PREÇO MÍNIMO (MÁRMORE DA FINTECH)
      let precoMin = Number(servico.preco_base_vendedor) || 0;

      if (['ADM_MASTER', 'ADM_MESTRE', 'GESTOR', 'ADM_GERENTE'].includes(nivel)) {
        precoMin = Number(servico.preco_base_gestor) || precoMin;
      }

      if (isBulk && servico.is_mass_sale_active) {
        precoMin = Number(servico.preco_massa_vendedor) || precoMin;
      }

      const minimoTotal = precoMin * qty;
      console.log(`[VENDA_SEGURA] Valor: ${valor}, Mínimo: ${minimoTotal}`);

      if (valor < (minimoTotal - 0.01)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          `Preço abaixo do mínimo autorizado (R$ ${valor} < R$ ${minimoTotal})`
        );
      }

      // 💰 3. LÓGICA DE CARTEIRA (INVESTIMENTO QUE VIRA CRÉDITO)
      if (metodoPagamento === 'CARTEIRA') {
        console.log(`[VENDA_SEGURA] Processando débito em carteira...`);
        const walletsCol = db.collection('wallets');
        const walletQuery = await tx.get(walletsCol.where('cliente_id', '==', clienteId).limit(1));
        
        if (walletQuery.empty) throw new functions.https.HttpsError('failed-precondition', 'Cliente sem carteira configurada');

        const walletRef = walletQuery.docs[0].ref;
        const wallet = walletQuery.docs[0].data();
        const totalDisponivel = (Number(wallet.saldo_atual) || 0) + (Number(wallet.saldo_bonus) || 0);

        console.log(`[VENDA_SEGURA] Carteira encontrada. Saldo disponível: ${totalDisponivel}`);

        if (totalDisponivel < valor) {
          throw new functions.https.HttpsError('failed-precondition', 'Saldo insuficiente na plataforma');
        }

        let aDebitar = valor;
        let novoBonus = Number(wallet.saldo_bonus) || 0;
        let novoSaldo = Number(wallet.saldo_atual) || 0;

        if (novoBonus >= aDebitar) {
          novoBonus -= aDebitar;
        } else {
          aDebitar -= novoBonus;
          novoBonus = 0;
          novoSaldo -= aDebitar;
        }

        tx.update(walletRef, clean({
          saldo_atual: novoSaldo,
          saldo_bonus: novoBonus,
          ultima_atualizacao: admin.firestore.FieldValue.serverTimestamp()
        }));

        // Registro Financeiro
        tx.set(db.collection('financial_transactions').doc(), clean({
          cliente_id: clienteId,
          valor: -valor,
          tipo: 'DEBITO',
          origem: 'VENDA_SEGURA',
          descricao: `Ativação de serviço: ${servico.nome_servico}`,
          confirmado_pelo_administrador: true,
          vendedor_id: uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        }));
      }

      // 📝 4. CRIAR REGISTRO DE VENDA
      console.log(`[VENDA_SEGURA] Criando registros de venda e processos...`);
      const saleRef = db.collection('sales').doc();
      const protocolo = `SEC-${Date.now()}`;
      const custoGestor = (Number(servico.preco_base_gestor) || 0) * qty;

      const visibilidade_uids = [uid, clienteId, ...(user.id_superior ? [user.id_superior] : [])];

      tx.set(saleRef, clean({
        protocolo,
        cliente_id: clienteId,
        vendedor_id: uid,
        vendedor_nome: user.nome || user.nome_completo || 'Vendedor',
        id_superior: user.id_superior || null,
        servico_id: servicoId,
        servico_nome: servico.nome_servico || 'Serviço',
        valor_total: valor,
        margem_total: valor - custoGestor,
        metodo_pagamento: metodoPagamento,
        status_pagamento: metodoPagamento === 'CARTEIRA' ? 'Pago' : 'Pendente',
        quantidade: qty,
        origem: 'SISTEMA_V3_ENTERPRISE',
        visibilidade_uids,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      }));

      // 🔁 5. CRIAR PROCESSOS (WORKFLOW)
      const statusProcesso = metodoPagamento === 'CARTEIRA' ? 'Em Análise' : 'Aguardando Pagamento';
      for (let i = 0; i < qty; i++) {
        tx.set(db.collection('order_processes').doc(), clean({
          venda_id: saleRef.id,
          protocolo,
          servico_id: servicoId,
          servico_nome: servico.nome_servico,
          status_atual: statusProcesso,
          preco_venda: valor / qty,
          cliente_id: clienteId,
          vendedor_id: uid,
          id_superior: user.id_superior || null,
          data_venda: admin.firestore.FieldValue.serverTimestamp(),
          modelo_id: servico.modelo_id || '',
          pendencias_iniciais: servico.documentos || [],
          dados_faltantes: servico.campos || [],
          visibilidade_uids
        }));
      }

      console.log(`[VENDA_SEGURA] Transação concluída com sucesso! Protocolo: ${protocolo}`);

      return {
        saleId: saleRef.id,
        protocolo
      };
    }).catch(err => {
        console.error("[VENDA_SEGURA] Falha na transação Firestore:", err);
        throw err;
    });
  })
);

// ==========================================
// 4. CLOUD FUNCTION: GERAR PAGAMENTO PIX (VERSÃO ENTERPRISE - MP ONLY)
// ==========================================
export const gerarPagamentoPixGateway = functions.https.onCall(
  safeExecute("PIX_GATEWAY", async (data, context) => {
    assertAuth(context);
    const clean = cleanDataForFirestore;

    const { valor, nome, email, cpf, vendaId, descricao } = data;

    if (!valor || !nome || !email || !cpf || !vendaId) {
      throw new functions.https.HttpsError('invalid-argument', 'Dados incompletos para geração do Pix.');
    }

    const valorNum = Number(valor);
    const cpfLimpo = String(cpf).replace(/\D/g, '');

    if (isNaN(valorNum) || valorNum <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Valor de pagamento inválido.');
    }

    // Obtém cliente Mercado Pago
    const { payment: mpPayment, projectId } = await getMPClient();

    let response;
    try {
      response = await mpPayment.create({
        body: {
          transaction_amount: valorNum,
          description: descricao || 'Pagamento GSA (SaaS Premium)',
          payment_method_id: 'pix',
          external_reference: vendaId,
          payer: {
            email,
            first_name: nome.split(' ')[0],
            last_name: nome.split(' ').slice(1).join(' ') || 'Cliente',
            identification: {
              type: 'CPF',
              number: cpfLimpo
            }
          },
          notification_url: `https://us-central1-${projectId}.cloudfunctions.net/webhookMercadoPago`
        }
      });
    } catch (err) {
      throwHttpsError('aborted', 'O gateway de pagamento recusou a transação', err);
    }

    if (!response?.id) {
      throw new functions.https.HttpsError('aborted', 'O Mercado Pago não gerou um ID de transação válido.');
    }

    const qrData = response.point_of_interaction?.transaction_data;

    // Atualiza a venda com os dados do Gateway (Single Source of Truth)
    await db.collection('sales').doc(vendaId).update(
      clean({
        mp_payment_id: String(response.id),
        gateway: 'MERCADO_PAGO',
        status_pagamento: 'Pendente',
        qr_code: qrData?.qr_code,
        qr_code_base64: qrData?.qr_code_base64,
        copy_paste: qrData?.qr_code,
        atualizado_em: admin.firestore.FieldValue.serverTimestamp()
      })
    );

    return {
      id: String(response.id),
      status: response.status,
      qr_code: qrData?.qr_code,
      qr_code_base64: qrData?.qr_code_base64,
      copy_paste: qrData?.qr_code,
      gateway: 'MERCADO_PAGO'
    };
  })
);

// ==========================================
// 4.5. CLOUD FUNCTION: GERAR PAGAMENTO PIX ASAAS
// ==========================================
export const gerarPagamentoAsaas = functions.https.onCall(
  safeExecute("ASAAS_PIX", async (data, context) => {
    assertAuth(context);
    const clean = cleanDataForFirestore;

    const { valor, nome, email, cpf, vendaId, descricao } = data;

    if (!valor || !nome || !email || !cpf || !vendaId) {
      throw new functions.https.HttpsError('invalid-argument', 'Dados incompletos para geração do Pix Asaas.');
    }

    // 1. Obtém as configurações do SaaS (chave Asaas)
    const saasConfig = await getSaasAdminConfig();
    const asaasKey = saasConfig.asaas_key;

    if (!asaasKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Configuração do Asaas (API Key) não encontrada no servidor.');
    }

    const ASAAS_URL = saasConfig.is_sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';
    const headers = { 'access_token': asaasKey };

    // 2. Criar ou Recuperar Cliente no Asaas
    let customerId;
    try {
      const cpfLimpo = String(cpf).replace(/\D/g, '');
      const clientListResp = await axios.get(`${ASAAS_URL}/customers?email=${encodeURIComponent(email)}`, { headers });
      
      const existing = clientListResp.data.data.find((c: any) => c.cpfCnpj === cpfLimpo || c.email === email);
      
      if (existing) {
        customerId = existing.id;
      } else {
        const createRes = await axios.post(`${ASAAS_URL}/customers`, {
          name: nome,
          email: email,
          cpfCnpj: cpfLimpo
        }, { headers });
        customerId = createRes.data.id;
      }
    } catch (err: any) {
      logError("Erro ao gerenciar cliente Asaas", err.response?.data || err);
      throwHttpsError('aborted', 'Falha ao processar dados do cliente no gateway', err);
    }

    // 3. Gerar Cobrança PIX
    let paymentId;
    try {
      const paymentResp = await axios.post(`${ASAAS_URL}/payments`, {
        customer: customerId,
        billingType: 'PIX',
        value: Number(valor),
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // 24h
        description: descricao || 'Pagamento GSA (SaaS)',
        externalReference: vendaId
      }, { headers });
      paymentId = paymentResp.data.id;
    } catch (err: any) {
      logError("Erro ao gerar pagamento Asaas", err.response?.data || err);
      throwHttpsError('aborted', 'O gateway Asaas recusou a cobrança', err);
    }

    // 4. Obter QR Code e Copy/Paste
    let pixData;
    try {
      const pixResp = await axios.get(`${ASAAS_URL}/payments/${paymentId}/pixQrCode`, { headers });
      pixData = pixResp.data;
    } catch (err: any) {
      logError("Erro ao obter QR Code Asaas", err.response?.data || err);
      throwHttpsError('aborted', 'Falha ao recuperar código PIX do Asaas', err);
    }

    // 5. Atualizar a venda no Firestore
    await db.collection('sales').doc(vendaId).update(clean({
      asaas_payment_id: paymentId,
      gateway: 'ASAAS',
      status_pagamento: 'Pendente'
    }));

    return {
      copy_paste: pixData.payload,
      qr_code_base64: pixData.encodedImage,
      payment_id: paymentId
    };
  })
);

// ==========================================
// 5. WEBHOOK: ASAAS NOTIFICATION (ENTERPRISE EDITION)
// ==========================================
export const webhookAsaas = functions.https.onRequest(async (req, res) => {
  const eventId = req.body?.payment?.id;

  try {
    logInfo("Webhook Asaas recebido", req.body);

    if (!eventId) {
      logError("Evento sem ID", req.body);
      return res.status(400).send("Missing eventId");
    }

    // 🔒 IDEMPOTÊNCIA
    const eventRef = db.collection('webhook_events').doc(`asaas_${eventId}`);
    const eventSnap = await eventRef.get();

    if (eventSnap.exists) {
      logInfo("Evento já processado", { eventId });
      return res.status(200).send("OK");
    }

    const { event, payment } = req.body;

    if (!payment?.externalReference) {
      logError("Pagamento sem referência", payment);
      return res.status(400).send("Invalid payment");
    }

    if (!['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
      return res.status(200).send("Evento ignorado");
    }

    const vendaId = payment.externalReference;

    const saleRef = db.collection('sales').doc(vendaId);
    const saleSnap = await saleRef.get();

    if (!saleSnap.exists) {
      logError("Venda asaas não encontrada", { vendaId });
      return res.status(404).send("Sale not found");
    }

    const saleData = saleSnap.data()!;

    if (saleData.status_pagamento === 'Pago') {
      await eventRef.set(cleanDataForFirestore({ processedAt: admin.firestore.FieldValue.serverTimestamp() }));
      logDetailed("Venda Asaas já estava paga", { vendaId });
      return res.status(200).send("Already paid");
    }

    const batch = db.batch();

    // ✅ Atualiza venda
    batch.update(saleRef, cleanDataForFirestore({
      status_pagamento: 'Pago',
      pago_em: admin.firestore.FieldValue.serverTimestamp(),
      asaas_status: payment.status,
      asaas_payment_id: payment.id,
      gateway: 'ASAAS'
    }));

    // 🔁 Processos
    const processes = await db.collection('order_processes')
      .where('venda_id', '==', vendaId)
      .get();

    processes.forEach(doc => {
      const pData = doc.data();
      batch.update(doc.ref, cleanDataForFirestore({
        status_atual: 'Em Análise',
        status_financeiro: 'PAGO',
        data_inicial: admin.firestore.FieldValue.serverTimestamp()
      }));

      // Adiciona Log de Histórico
      batch.set(db.collection('status_history').doc(), cleanDataForFirestore({
          processo_id: doc.id,
          status_anterior: pData.status_atual || 'Pendente',
          novo_status: 'Em Análise',
          usuario_id: 'SYSTEM_WEBHOOK',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status_info_extra: 'Pagamento Asaas confirmado. Iniciando análise.'
      }));
    });

    // 🎁 Liberar Bônus e Pontos
    await processarBonusDeVendaNoBackend(vendaId, batch);

    // 📦 Lote
    const batches = await db.collection('bulk_sales_batches')
      .where('venda_id', '==', vendaId)
      .get();

    batches.forEach(doc => {
      batch.update(doc.ref, cleanDataForFirestore({
        status_pagamento: 'Pago',
        status_lote: 'Processando',
        data_confirmacao: admin.firestore.FieldValue.serverTimestamp()
      }));
    });

    // 💰 RECARGA
    if (saleData.tipo_venda === 'RECARGA' && saleData.cliente_id) {
      const walletRef = db.collection('wallets').doc(saleData.cliente_id);
      const valorRecarga = Number(saleData.valor_total || 0);

      batch.set(walletRef, cleanDataForFirestore({
        saldo_atual: admin.firestore.FieldValue.increment(valorRecarga),
        ultima_atualizacao: admin.firestore.FieldValue.serverTimestamp()
      }), { merge: true });

      batch.set(db.collection('financial_transactions').doc(), cleanDataForFirestore({
        cliente_id: saleData.cliente_id,
        valor: valorRecarga,
        tipo: 'CREDITO',
        origem: 'RECARGA_PIX',
        descricao: `Recarga via Asaas (${payment.id})`,
        confirmado_pelo_administrador: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }));
    }

    // 🧾 Marca evento como processado
    batch.set(eventRef, cleanDataForFirestore({
      gateway: 'ASAAS',
      eventId,
      vendaId,
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    }));

    await batch.commit();

    logInfo("Webhook Asaas processado com sucesso", { vendaId });

    res.status(200).send("OK");

  } catch (error) {
    logError("Erro no webhook Asaas", error);
    res.status(500).send("Internal Error");
  }
});

// ==========================================
// 6. WEBHOOK: MERCADO PAGO NOTIFICATION (ENTERPRISE EDITION)
// ==========================================
export const webhookMercadoPago = functions.https.onRequest(async (req, res) => {
  const paymentId = req.body?.data?.id || req.body?.id || req.query?.id;

  try {
    logInfo("Webhook Mercado Pago recebido", { body: req.body, query: req.query });

    if (!paymentId) {
      logError("Pagamento sem ID", { body: req.body });
      return res.status(400).send("Missing paymentId");
    }

    // 🔒 IDEMPOTÊNCIA
    const idempotencyKey = `mp_${paymentId}`;
    const eventRef = db.collection('webhook_events').doc(idempotencyKey);
    const eventSnap = await eventRef.get();

    if (eventSnap.exists) {
      logInfo("Evento MP já processado", { paymentId });
      return res.status(200).send("OK");
    }

    const { payment: mpPayment } = await getMPClient();
    const paymentInfo = await mpPayment.get({ id: paymentId });
    
    logInfo("Status do pagamento MP", { status: paymentInfo.status });

    if (paymentInfo.status !== 'approved') {
      return res.status(200).send("Pendente");
    }

    const vendaId = paymentInfo.external_reference || paymentInfo.metadata?.venda_id;

    if (!vendaId) {
      logError("Venda sem referência no MP", paymentInfo);
      return res.status(200).send("No reference");
    }

    const saleRef = db.collection('sales').doc(vendaId);
    const saleSnap = await saleRef.get();

    if (!saleSnap.exists) {
      logError("Venda MP não encontrada", { vendaId });
      return res.status(404).send("Sale not found");
    }

    const saleData = saleSnap.data()!;

    if (saleData.status_pagamento === 'Pago') {
      await eventRef.set(cleanDataForFirestore({ processedAt: admin.firestore.FieldValue.serverTimestamp() }));
      logDetailed("Venda MP já estava paga", { vendaId });
      return res.status(200).send("Already paid");
    }

    const batch = db.batch();

    // ✅ Atualiza venda
    batch.update(saleRef, cleanDataForFirestore({
      status_pagamento: 'Pago',
      pago_em: admin.firestore.FieldValue.serverTimestamp(),
      mp_status: 'approved',
      mp_payment_id: String(paymentId),
      gateway: 'MERCADO_PAGO'
    }));

    // 🔁 Processos
    const processes = await db.collection('order_processes')
      .where('venda_id', '==', vendaId)
      .get();

    processes.forEach(doc => {
      batch.update(doc.ref, cleanDataForFirestore({
        status_atual: 'Em Análise',
        status_financeiro: 'PAGO'
      }));
    });

    // 📦 Lote
    const batches = await db.collection('bulk_sales_batches')
      .where('venda_id', '==', vendaId)
      .get();

    batches.forEach(doc => {
      batch.update(doc.ref, cleanDataForFirestore({
        status_pagamento: 'Pago',
        status_lote: 'Processando',
        data_confirmacao: admin.firestore.FieldValue.serverTimestamp()
      }));
    });

    // 💰 RECARGA
    if (saleData.tipo_venda === 'RECARGA' && saleData.cliente_id) {
      const walletRef = db.collection('wallets').doc(saleData.cliente_id);
      const valorRecarga = Number(saleData.valor_total || 0);

      batch.set(walletRef, cleanDataForFirestore({
        saldo_atual: admin.firestore.FieldValue.increment(valorRecarga),
        ultima_atualizacao: admin.firestore.FieldValue.serverTimestamp()
      }), { merge: true });

      batch.set(db.collection('financial_transactions').doc(), cleanDataForFirestore({
        cliente_id: saleData.cliente_id,
        valor: valorRecarga,
        tipo: 'CREDITO',
        origem: 'RECARGA_PIX',
        descricao: `Recarga via Mercado Pago (${paymentId})`,
        confirmado_pelo_administrador: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }));
    }

    // 🧾 Marca evento como processado
    batch.set(eventRef, cleanDataForFirestore({
      gateway: 'MERCADO_PAGO',
      paymentId: String(paymentId),
      vendaId,
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    }));

    await batch.commit();

    logInfo("Webhook MP processado com sucesso", { vendaId });

    res.status(200).send("OK");

  } catch (error) {
    logError("Erro no webhook MP", error);
    res.status(500).send("Internal Error");
  }
});
