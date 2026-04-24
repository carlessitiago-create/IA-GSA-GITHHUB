import * as functions from 'firebase-functions';
import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
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

// Obtém o databaseId (Hardcoded para funcionar corretamente na nuvem já que o firebase.json ignora a raiz)
let dbId = 'ai-studio-2473fb05-836e-42bf-bfe7-6175607907dd';
try {
    const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.firestoreDatabaseId) dbId = config.firestoreDatabaseId;
    }
} catch (e) {
    console.warn("[STARTUP] Mantendo fallback hardcoded para ambiente de nuvem.");
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
function throwHttpsError(code: string, message: string, originalError?: any): never {
    const validCodes = ['ok', 'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found', 'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition', 'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable', 'data-loss', 'unauthenticated'];
    let safeCode = validCodes.includes(code) ? code : 'aborted';
    if (safeCode === 'internal' || safeCode === 'unknown') safeCode = 'aborted';
    
    let technicalDetails = '';
    if (originalError) {
        if (originalError.response?.data) {
            technicalDetails = JSON.stringify(originalError.response.data);
        } else if (originalError.message) {
            technicalDetails = String(originalError.message);
        } else {
            technicalDetails = String(originalError);
        }
    }

    const detailMessage = technicalDetails ? `${message} [Info: ${technicalDetails}]` : message;
    console.error(`[HTTPS_ERROR] Code: ${safeCode} | Msg: ${message} | Technical: ${technicalDetails}`);
    
    throw new HttpsError(safeCode as any, message, detailMessage);
}

/**
 * Asserts that the context has an authenticated user and returns the UID.
 */
function logToFile(msg: string) {
    console.log(`[FILE_LOG_EMULATED] ${msg}`);
}

function assertAuth(request: CallableRequest): string {
    const uid = request.auth?.uid;
    
    if (!uid) {
        logToFile(`[AUTH DEBUG] Auth failed!`);
        throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    return uid;
}

/**
 * Standardizes execution of Cloud Functions with robust logging and error conversion.
 */
function safeExecute(moduleName: string, handler: (request: CallableRequest) => Promise<any>) {
    return async (request: CallableRequest) => {
        try {
            console.log(`\n\n\n[SAFE_EXECUTE] >>> intercepting request for ${moduleName}`);
            console.log(`[${moduleName}] INICIO | UID: ${request.auth?.uid}`);
            const result = await handler(request);
            console.log(`[${moduleName}] SUCESSO`);
            return result;
        } catch (error: any) {
            console.error(`[${moduleName}] ERRO CRITICO capturado:`, error);
            
            const grpcToFunctions: Record<number, functions.https.FunctionsErrorCode> = {
                0: 'ok', 1: 'cancelled', 2: 'unknown', 3: 'invalid-argument', 
                4: 'deadline-exceeded', 5: 'not-found', 6: 'already-exists', 
                7: 'permission-denied', 8: 'resource-exhausted', 9: 'failed-precondition', 
                10: 'aborted', 11: 'out-of-range', 12: 'unimplemented', 
                13: 'internal', 14: 'unavailable', 15: 'data-loss', 16: 'unauthenticated'
            };

            let safeCode: functions.https.FunctionsErrorCode = 'aborted';
            let safeMessage = 'Falha desconhecida no servidor GSA';

            if (error?.code !== undefined) {
                const rawCode = error.code;
                if (typeof rawCode === 'number' && grpcToFunctions[rawCode]) {
                    safeCode = grpcToFunctions[rawCode];
                } else {
                    const strCode = String(rawCode).replace('functions/', '');
                    const validCodes = Object.values(grpcToFunctions);
                    if (validCodes.includes(strCode as any)) {
                        safeCode = strCode as any;
                    }
                }
            }

            if (error?.message) {
                 safeMessage = String(error.message);
            }

            if (safeCode === 'internal' || safeCode === 'unknown') {
                safeCode = 'aborted'; // Prevenir INTERNAL genérico do Firebase que mascara a causa real
            }

            console.error(`[${moduleName}] Final Error to emit -> Code: ${safeCode}, Message: ${safeMessage}`);
            throw new HttpsError(safeCode, safeMessage, error?.details);
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

export const criarAdministradorDeUsuarios = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  // Verificar se o usuário tem nível ADM ou GESTOR no banco
  const callerRef = db.collection('usuarios').doc(request.auth.uid);
  const callerSnap = await callerRef.get();
  const callerData = callerSnap.data();
  
  const isAdmOrGestor = callerData?.role === 'ADM_MASTER' || 
                        callerData?.role === 'ADM_MESTRE' || 
                        callerData?.role === 'ADM_GERENTE' || 
                        callerData?.role === 'ADM' || 
                        callerData?.role === 'GESTOR';

  if (!isAdmOrGestor) {
    throw new HttpsError('permission-denied', 'Você não tem permissão para criar usuários.');
  }

  const { nome, email, senha, role, cpf, data_nascimento, telefone, id_superior } = request.data;

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
    throw new HttpsError('aborted', 'Erro ao criar usuário: ' + (error?.message || error));
  }
});

export const atualizarSenhaUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  // Verificar se o usuário tem nível ADM no banco
  const callerRef = db.collection('usuarios').doc(request.auth.uid);
  const callerSnap = await callerRef.get();
  const callerData = callerSnap.data();
  
  const isAdm = callerData?.role === 'ADM_MASTER' || 
                callerData?.role === 'ADM_MESTRE' || 
                callerData?.role === 'ADM_GERENTE';

  if (!isAdm) {
    throw new HttpsError('permission-denied', 'Você não tem permissão para alterar senhas.');
  }

  const { uid, novaSenha } = request.data;

  if (!uid || !novaSenha) {
    throw new HttpsError('invalid-argument', 'UID e nova senha são obrigatórios.');
  }

  try {
    await admin.auth().updateUser(uid, {
      password: novaSenha
    });

    return { success: true };
  } catch (error: any) {
    console.error("Erro em atualizarSenhaUsuario:", error);
    throw new HttpsError('aborted', 'Erro ao atualizar senha: ' + (error?.message || error));
  }
});

export const processVenda = onCall(
  safeExecute("PROCESS_VENDA", async (request) => {
    const data = request.data;
    const { clienteId, itens, metodoPagamento, comprovanteUrl, clienteNome, clienteDocumento, dataNascimento } = data;
    if (!clienteId || !itens || !metodoPagamento) {
      throw new HttpsError('invalid-argument', 'Dados incompletos');
    }

    return await db.runTransaction(async (transaction: any) => {
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new HttpsError('invalid-argument', 'A lista de itens não pode estar vazia');
    }

    logDetailed("Transação iniciada para processVenda", { clienteId, itemsLength: itens.length });
    let vendedorId = request.auth?.uid || 'SYSTEM_SAAS';
    let vendedorNome = 'GSA-IA SaaS';
    let managerId = null;

    if (request.auth) {
      const userRef = db.collection('usuarios').doc(request.auth.uid);
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data();
      managerId = userData?.managerId || null;
      vendedorNome = userData?.nome || 'Vendedor';
    }

    // 1. Generate protocol
    const ano = new Date().getFullYear();
    const protocolo = `#GSA-${ano}-${Date.now()}`;
    
    // 2. Calculate totals
    let valorTotal = 0;
    let margemTotal = 0;
    const processDataList: any[] = [];

    for (const item of itens) {
      if (!item.servicoId) {
          throw new HttpsError('invalid-argument', 'servicoId ausente em um dos itens da venda');
      }
      
      const servicoRef = db.doc(`services/${item.servicoId}`);
      const servicoSnap = await transaction.get(servicoRef);
      
      let servicoData: any = null;
      if (servicoSnap.exists) {
        servicoData = servicoSnap.data();
      } else if (vendedorId === 'SYSTEM_SAAS' || item.servicoId === 'diag_credito' || item.servicoId === 'diag_saas') {
        // Fallback for SaaS sales if service doc is missing
        servicoData = {
          nome: item.servicoNome || 'Serviço SaaS',
          modelo_id: '',
          documentos: [],
          campos: []
        };
      } else {
        throw new HttpsError('not-found', `Serviço ${item.servicoId} não encontrado`);
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
      throw new HttpsError('not-found', 'Cliente não encontrado');
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
export const processarVendaSegura = onCall(
  safeExecute("VENDA_SEGURA", async (request) => {
    const uid = assertAuth(request);
    const actualData = request.data;
    const clean = cleanDataForFirestore;

    const {
      clienteId,
      servicoId,
      valorVendaFinal,
      metodoPagamento,
      isBulk = false,
      quantidade = 1
    } = actualData;

    // VALIDAÇÃO INICIAL BLINDADA
    if (!clienteId || !servicoId || valorVendaFinal === undefined || valorVendaFinal === null) {
      throw new HttpsError('invalid-argument', 'Dados incompletos: clienteId, servicoId ou valor ausentes.');
    }

    const valor = Number(valorVendaFinal);
    const qty = Number(quantidade) || 1;

    if (isNaN(valor) || valor <= 0) {
      throw new HttpsError('invalid-argument', 'Valor inválido');
    }

    return await db.runTransaction(async (tx: any) => {
      console.log(`[VENDA_SEGURA] Iniciando transação para cliente: ${clienteId}`);

      // 🔍 1. VALIDAR VENDEDOR E SERVIÇO
      const userRef = db.collection('usuarios').doc(uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new HttpsError('not-found', 'Vendedor não encontrado');
      
      const user = userSnap.data()!;
      
      // 🔍 2. VALIDAR SERVIÇO (COM FALLBACK PARA VENDA MANUAL)
      let servico: any = {
        nome_servico: 'Serviço/Recarga GSA',
        preco_base_vendedor: 0,
        preco_base_gestor: 0,
        is_mass_sale_active: false,
        modelo_id: '',
        documentos: [],
        campos: []
      };

      // Só tenta buscar no banco se NÃO for manual
      if (servicoId !== 'manual') {
        const servicoRef = db.collection('services').doc(servicoId);
        const servicoSnap = await tx.get(servicoRef);
        if (servicoSnap.exists) {
          servico = servicoSnap.data()!;
        } else {
          console.warn(`[VENDA_SEGURA] Servico ${servicoId} não encontrado. Assumindo venda manual.`);
        }
      }
      
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
        throw new HttpsError(
          'permission-denied',
          `Preço abaixo do mínimo autorizado (R$ ${valor} < R$ ${minimoTotal})`
        );
      }

      // 💰 3. LÓGICA DE CARTEIRA (INVESTIMENTO QUE VIRA CRÉDITO)
      if (metodoPagamento === 'CARTEIRA') {
        const walletQuery = await db.collection('wallets').where('cliente_id', '==', clienteId).limit(1).get();
        if (walletQuery.empty) throw new HttpsError('failed-precondition', 'Cliente sem carteira configurada');

        const walletRef = walletQuery.docs[0].ref;
        const walletSnap = await tx.get(walletRef);
        const wallet = walletSnap.data()!;
        const totalDisponivel = (Number(wallet.saldo_atual) || 0) + (Number(wallet.saldo_bonus) || 0);

        console.log(`[VENDA_SEGURA] Carteira encontrada. Saldo disponível: ${totalDisponivel}`);

        if (totalDisponivel < valor) {
          throw new HttpsError('failed-precondition', 'Saldo insuficiente na plataforma');
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
    }).catch((err: any) => {
        console.error("[VENDA_SEGURA] Falha na transação Firestore:", err);
        throw err;
    });
  })
);

// ==========================================
// 4. CLOUD FUNCTION: GERAR PAGAMENTO PIX (VERSÃO ENTERPRISE - MP ONLY)
// ==========================================
export const gerarPagamentoPixGateway = onCall(
  safeExecute("PIX_GATEWAY", async (request) => {
    const data = request.data;
    assertAuth(request);
    const clean = cleanDataForFirestore;

    const { valor, nome, email, cpf, vendaId, descricao } = data;

    if (!valor || !nome || !email || !cpf || !vendaId) {
      throw new HttpsError('invalid-argument', 'Dados incompletos para geração do Pix.');
    }

    const valorNum = Number(valor);
    const cpfLimpo = String(cpf).replace(/\D/g, '');
    const idType = cpfLimpo.length > 11 ? 'CNPJ' : 'CPF';

    if (isNaN(valorNum) || valorNum <= 0) {
      throw new HttpsError('invalid-argument', 'Valor de pagamento inválido.');
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
              type: idType,
              number: cpfLimpo
            }
          },
          notification_url: `https://us-central1-${projectId}.cloudfunctions.net/webhookMercadoPago`
        }
      });
    } catch (err: any) {
      const mpError = err.response?.data?.cause?.[0]?.description || err.response?.data?.message || err.message;
      console.error("ERRO COMPLETO MERCADO PAGO:", err.response?.data || err);
      throwHttpsError('aborted', `O gateway de pagamento recusou a transação: ${mpError}`, err);
    }

    if (!response?.id) {
      throw new HttpsError('aborted', 'O Mercado Pago não gerou um ID de transação válido.');
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
export const gerarPagamentoAsaas = onCall(
  safeExecute("ASAAS_PIX", async (request) => {
    const uid = assertAuth(request);
    const data = request.data;
    const { valor, nome, email, cpf, vendaId, descricao } = data;

    // 1. Obtém as configurações
    const config = await getSaasAdminConfig();
    const token = config.asaas_key || process.env.ASAAS_KEY;

    // Trava de segurança: Se não tiver token, avisa na hora
    if (!token) {
      throw new HttpsError('failed-precondition', 'Chave de API do Asaas não encontrada no sistema.');
    }

    const ASAAS_URL = config.is_sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';

    const headers = {
      'access_token': token,
      'Content-Type': 'application/json'
    };

    // Limpeza de dados
    const safeCpf = cpf ? String(cpf).replace(/\D/g, '') : '';
    const safeName = nome || 'Cliente GSA';
    const safeEmail = email || 'cliente@gsa.com';

    try {
      let customerId = '';

      // 2. TENTA BUSCAR O CLIENTE PRIMEIRO (Evita erro de duplicidade)
      const searchRes = await axios.get(`${ASAAS_URL}/customers?email=${safeEmail}`, { headers });
      
      if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
        customerId = searchRes.data.data[0].id; // Usa o cliente que já existe
      } else {
        // 3. SE NÃO EXISTE, CRIA UM NOVO
        const customerPayload: any = { name: safeName, email: safeEmail };
        
        // Só envia o CPF para o Asaas se for um número válido de 11 dígitos e diferente de zero
        if (safeCpf && safeCpf.length === 11 && safeCpf !== '00000000000') {
          customerPayload.cpfCnpj = safeCpf;
        }

        const customerRes = await axios.post(`${ASAAS_URL}/customers`, customerPayload, { headers });
        customerId = customerRes.data.id;
      }

      // 4. GERA A COBRANÇA PIX
      const paymentRes = await axios.post(`${ASAAS_URL}/payments`, {
        customer: customerId,
        billingType: 'PIX',
        value: valor,
        dueDate: new Date().toISOString().split('T')[0], // Vence hoje
        externalReference: vendaId,
        description: descricao || 'Pagamento GSA'
      }, { headers });

      const paymentId = paymentRes.data.id;

      // 5. BUSCA O QR CODE DO PIX
      const qrRes = await axios.get(`${ASAAS_URL}/payments/${paymentId}/pixQrCode`, { headers });

      // 6. SALVA O VÍNCULO NO BANCO DE DADOS
      await db.collection('sales').doc(vendaId).update({
        asaas_payment_id: paymentId,
        gateway: 'ASAAS',
        status_pagamento: 'Pendente'
      });

      return {
        copy_paste: qrRes.data.payload,
        qr_code_base64: qrRes.data.encodedImage,
        payment_id: paymentId
      };
      
    } catch (error: any) {
      console.error("ERRO DETALHADO DO ASAAS:", error.response?.data || error);
      
      // 7. EXTRAI A MENSAGEM REAL DO ASAAS E MANDA PARA O FRONT-END
      const asaasErrorMessage = error.response?.data?.errors?.[0]?.description 
                             || error.response?.data?.message 
                             || error.message 
                             || 'Erro desconhecido ao comunicar com o Asaas';
                             
      // Lança o erro com a mensagem mastigada para o modal exibir
      throw new HttpsError('aborted', `Asaas recusou: ${asaasErrorMessage}`);
    }
  })
);

// ==========================================
// 5. WEBHOOK: ASAAS NOTIFICATION (ENTERPRISE EDITION)
// ==========================================
export const webhookAsaas = onRequest(async (req: any, res: any) => {
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

    processes.forEach((doc: any) => {
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

    batches.forEach((doc: any) => {
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
export const webhookMercadoPago = onRequest(async (req: any, res: any) => {
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

    processes.forEach((doc: any) => {
      batch.update(doc.ref, cleanDataForFirestore({
        status_atual: 'Em Análise',
        status_financeiro: 'PAGO'
      }));
    });

    // 📦 Lote
    const batches = await db.collection('bulk_sales_batches')
      .where('venda_id', '==', vendaId)
      .get();

    batches.forEach((doc: any) => {
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

// ==========================================
// 4. CLOUD FUNCTION: REGISTRAR VENDA ADMINISTRATIVA
// ==========================================
export const registrarVendaAdministrativa = onCall(
    async (request) => {
        // Log start immediately
        console.log("[REGISTRAR_VENDA_ADMIN] Invoked. Raw data keys:", Object.keys(request.data || {}));

        try {
            const uid = request.auth?.uid;
            if (!uid) {
                console.error("[REGISTRAR_VENDA_ADMIN] No UID in request context.");
                throw new HttpsError('unauthenticated', 'Acesso negado: Você não está logado.');
            }

            // Database instance check - Using global db but ensuring it's ready
            if (!db) {
                console.error("[REGISTRAR_VENDA_ADMIN] Firestore db instance is null/undefined during execution!");
                throw new HttpsError('internal', 'O serviço de banco de dados não está inicializado.');
            }

            const { cliente, servicoId, vendedorId, dataServico } = request.data || {};
            
            // Minimal critical validation
            if (!cliente?.nome || !cliente?.cpf || !servicoId || !dataServico) {
                console.warn("[REGISTRAR_VENDA_ADMIN] Incomplete payload:", { hasNome: !!cliente?.nome, hasCPF: !!cliente?.cpf, hasSvc: !!servicoId, hasDate: !!dataServico });
                throw new HttpsError('invalid-argument', 'Campos obrigatórios: Nome, CPF, Serviço e Data.');
            }

            const cleanCPF = String(cliente.cpf).replace(/\D/g, '');
            if (!cleanCPF || cleanCPF.length < 11) {
                throw new HttpsError('invalid-argument', 'CPF inválido. Forneça apenas os 11 dígitos numéricos.');
            }

            // Check permissions
            const userSnap = await db.collection('usuarios').doc(uid).get();
            const userData = userSnap.data();
            const authorizedRoles = ['ADM_MASTER', 'ADM_GERENTE', 'ADM_ANALISTA'];
            
            if (!userData || !authorizedRoles.includes(userData.nivel)) {
                console.error(`[REGISTRAR_VENDA_ADMIN] Unauthorized role: ${userData?.nivel}`);
                throw new HttpsError('permission-denied', `Seu nível (${userData?.nivel || 'N/A'}) não permite esta operação.`);
            }

            const safeVendedorId = vendedorId || uid;
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const batch = db.batch();

            // 1. New Client
            const clientRef = db.collection('clients').doc();
            batch.set(clientRef, cleanDataForFirestore({
                nome: cliente.nome,
                documento: cleanCPF,
                cpf: cleanCPF,
                data_nascimento: cliente.nasc || "",
                telefone: cliente.telefone || "0000000000",
                vendedor_id: safeVendedorId,
                timestamp: timestamp,
                created_at: timestamp,
                origem: 'ADMIN_FLOW'
            }));

            // 2. Lock
            const lockRef = db.collection('documento_locks').doc(cleanCPF);
            batch.set(lockRef, {
                documento: cleanCPF,
                dono_id: safeVendedorId,
                timestamp: timestamp
            }, { merge: true });

            // 3. Sale
            const saleRef = db.collection('sales').doc();
            const protocolo = `ADM-${nowFormat()}-${Math.floor(Math.random() * 1000)}`;
            batch.set(saleRef, cleanDataForFirestore({
                protocolo,
                cliente_id: clientRef.id,
                cliente_nome: cliente.nome,
                vendedor_id: safeVendedorId,
                valor_total: 0,
                metodo_pagamento: 'MANUAL',
                status_pagamento: 'Confirmado',
                timestamp: timestamp,
                pago_em: timestamp
            }));

            // 4. Process
            const processRef = db.collection('order_processes').doc();
            batch.set(processRef, cleanDataForFirestore({
                protocolo,
                venda_id: saleRef.id,
                servico_id: servicoId,
                cliente_id: clientRef.id,
                cliente_nome: cliente.nome,
                cliente_cpf_cnpj: cleanCPF,
                vendedor_id: safeVendedorId,
                status_atual: 'Ativo',
                status_financeiro: 'PAGO',
                data_execucao: dataServico,
                data_venda: timestamp
            }));

            console.log(`[REGISTRAR_VENDA_ADMIN] Committing batch for ${cleanCPF}...`);
            await batch.commit();
            console.log(`[REGISTRAR_VENDA_ADMIN] Success.`);

            return { success: true, vendaId: saleRef.id, protocolo };

        } catch (error: any) {
            console.error(`[REGISTRAR_VENDA_ADMIN] Error caught:`, error);
            
            // If it's already an HttpsError, throw it directly
            if (error instanceof HttpsError) throw error;
            
            // For other errors, wrap them in 'aborted' with the actual message to avoid masked 'internal' errors
            throw new HttpsError('aborted', error.message || 'Erro inesperado durante o processamento da venda.');
        }
    }
);

// Helper for protocol generation date
function nowFormat() {
    const d = new Date();
    return d.getFullYear() + (d.getMonth() + 1).toString().padStart(2, '0') + d.getDate().toString().padStart(2, '0');
}

