import * as functions from 'firebase-functions';
import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import { seedUsers } from './seedUsers';

// Inicializa o admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const app = admin.apps[0]!;

// Obtém o databaseId
let dbId = '(default)';
try {
    const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.firestoreDatabaseId) dbId = config.firestoreDatabaseId;
    }
} catch (e) {
    console.warn("[STARTUP] Mantendo fallback hardcoded para ambiente de nuvem.");
}

const db = getFirestore(app, dbId);
console.log(`Cloud Functions conectadas ao Firestore DB: ${dbId}`);

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

async function processarBonusDeVendaNoBackend(vendaId: string, batch: admin.firestore.WriteBatch) {
    try {
        const saleSnap = await db.collection('sales').doc(vendaId).get();
        if (!saleSnap.exists) return;
        const sale = saleSnap.data()!;

        const rulesSnap = await db.collection('platform_config').doc('points_rules').get();
        const rules = rulesSnap.data()?.valores || {
            cadastro: 50, indicacao: 100, venda_vendedor: 150, venda_gestor: 75
        };

        if (sale.vendedor_id) {
            batch.update(db.collection('usuarios').doc(sale.vendedor_id), {
                saldo_pontos: FieldValue.increment(rules.venda_vendedor)
            });
            batch.set(db.collection('points_history').doc(), cleanDataForFirestore({
                userId: sale.vendedor_id, quantidade: rules.venda_vendedor,
                motivo: `Venda ${vendaId.substring(0, 8)} Concluída (Gateway)`, tipo: 'GANHO',
                data: FieldValue.serverTimestamp()
            }));
        }

        if (sale.id_superior) {
            batch.update(db.collection('usuarios').doc(sale.id_superior), {
                saldo_pontos: FieldValue.increment(rules.venda_gestor)
            });
            batch.set(db.collection('points_history').doc(), cleanDataForFirestore({
                userId: sale.id_superior, quantidade: rules.venda_gestor,
                motivo: `Bônus Liderança: Venda Equipe (${vendaId.substring(0, 8)})`, tipo: 'GANHO',
                data: FieldValue.serverTimestamp()
            }));
        }

        const clientSnap = await db.collection('clients').doc(sale.cliente_id).get();
        const clientData = clientSnap.data();
        if (clientData?.indicado_por_uid) {
            batch.update(db.collection('usuarios').doc(clientData.indicado_por_uid), {
                saldo_pontos: FieldValue.increment(rules.indicacao)
            });
            batch.set(db.collection('points_history').doc(), cleanDataForFirestore({
                userId: clientData.indicado_por_uid, quantidade: rules.indicacao,
                motivo: `Bônus MGM: Amigo (${clientData.nome_completo}) Ativou conta`, tipo: 'GANHO',
                data: FieldValue.serverTimestamp()
            }));
        }
    } catch (error) {
        console.error("Erro ao processar bônus no webhook:", error);
    }
}

function cleanDataForFirestore(obj: any, isRoot = true): any {
    if (obj === null || obj === undefined) return isRoot ? {} : undefined;
    if (typeof obj === 'number') return isFinite(obj) ? obj : 0;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => cleanDataForFirestore(v, false)).filter(v => v !== undefined);

    if (obj instanceof FieldValue) return obj;
    if (obj instanceof Timestamp || obj instanceof Date) return obj;
    
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

function logDetailed(message: string, data?: any) {
    if (!data) {
        console.log(`[INFO] ${message}`);
        return;
    }
    try {
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
        console.log(`[INFO] ${message}: [Data too complex to stringify]`);
    }
}

function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) logDetailed(`[${timestamp}] [INFO] ${message}`, data);
  else console.log(`[${timestamp}] [INFO] ${message}`);
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  if (error) console.error(`[${timestamp}] [ERROR] ${message}`, error);
  else console.error(`[${timestamp}] [ERROR] ${message}`);
}

function throwHttpsError(code: string, message: string, originalError?: any): never {
    const validCodes = ['ok', 'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found', 'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition', 'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable', 'data-loss', 'unauthenticated'];
    let safeCode = validCodes.includes(code) ? code : 'aborted';
    if (safeCode === 'internal' || safeCode === 'unknown') safeCode = 'aborted';
    
    let technicalDetails = '';
    if (originalError) {
        if (originalError.response?.data) technicalDetails = JSON.stringify(originalError.response.data);
        else if (originalError.message) technicalDetails = String(originalError.message);
        else technicalDetails = String(originalError);
    }

    const detailMessage = technicalDetails ? `${message} [Info: ${technicalDetails}]` : message;
    console.error(`[HTTPS_ERROR] Code: ${safeCode} | Msg: ${message} | Technical: ${technicalDetails}`);
    throw new HttpsError(safeCode as any, message, detailMessage);
}

function assertAuth(request: CallableRequest): string {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado (Cloud)');
    return uid;
}

function safeExecute(moduleName: string, handler: (request: CallableRequest) => Promise<any>) {
    return async (request: CallableRequest) => {
        try {
            console.log(`[${moduleName}] INICIO | UID: ${request.auth?.uid}`);
            const result = await handler(request);
            console.log(`[${moduleName}] SUCESSO`);
            return result;
        } catch (error: any) {
            console.error(`[${moduleName}] ERRO CRITICO capturado:`, error);
            
            console.error(`[${moduleName}] ERRO CRITICO capturado:`, error);
            
            const safeCode: functions.https.FunctionsErrorCode = 'aborted';
            let safeMessage = error?.message || 'Erro inesperado no servidor GSA';
            
            console.error(`[${moduleName}] Emitindo Erro -> Code: ${safeCode}, Message: ${safeMessage}`);
            throw new HttpsError(safeCode, safeMessage);
        }
    };
}

async function getMPClient() {
    const config = await getSaasAdminConfig();
    const token = config.mercado_pago_access_token || process.env.MP_ACCESS_TOKEN || 'APP_USR-4343959448906136-101900-bd86782be2ecf529a1c0e25c935bf4f1-124360597';
                  
    const client = new MercadoPagoConfig({ accessToken: token });
    return {
        client,
        payment: new Payment(client),
        projectId: config.projectId || process.env.GCLOUD_PROJECT || 'gen-lang-client-0086269527'
    };
}

const ASAAS_URL = 'https://www.asaas.com/api/v3';

// DEPLOY_COMMAND: npx -y firebase-tools deploy --only functions --project gsa-camara-pro

export const criarAdministradorDeUsuarios = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Usuário não autenticado');

  const callerRef = db.collection('usuarios').doc(request.auth.uid);
  const callerSnap = await callerRef.get();
  const callerData = callerSnap.data();
  
  const isAdmOrGestor = ['ADM_MASTER', 'ADM_MESTRE', 'ADM_GERENTE', 'ADM', 'GESTOR'].includes(callerData?.role);
  if (!isAdmOrGestor) throw new HttpsError('permission-denied', 'Permissão negada.');

  const { nome, email, senha, role, cpf, data_nascimento, telefone, id_superior } = request.data;

  try {
    const userRecord = await admin.auth().createUser({ email, password: senha || 'Mudar@123', displayName: nome });
    const newProfile = {
      uid: userRecord.uid, nome, email, role, saldo_pontos: 0, nivel_fidelidade: 'BRONZE',
      data_cadastro: FieldValue.serverTimestamp(), ativo: true, cpf, data_nascimento, telefone, status: 'APROVADO', id_superior: id_superior || null
    };
    await db.collection('usuarios').doc(userRecord.uid).set(cleanDataForFirestore(newProfile));
    return { uid: userRecord.uid };
  } catch (error: any) {
    throw new HttpsError('aborted', 'Erro ao criar usuário: ' + (error?.message || error));
  }
});

export const atualizarSenhaUsuario = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Usuário não autenticado');

  const callerSnap = await db.collection('usuarios').doc(request.auth.uid).get();
  if (!['ADM_MASTER', 'ADM_MESTRE', 'ADM_GERENTE'].includes(callerSnap.data()?.role)) {
    throw new HttpsError('permission-denied', 'Permissão negada.');
  }

  const { uid, novaSenha } = request.data;
  if (!uid || !novaSenha) throw new HttpsError('invalid-argument', 'UID e nova senha são obrigatórios.');

  try {
    await admin.auth().updateUser(uid, { password: novaSenha });
    return { success: true };
  } catch (error: any) {
    throw new HttpsError('aborted', 'Erro ao atualizar senha: ' + (error?.message || error));
  }
});

export const syncUsers = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  const callerSnap = await db.collection('usuarios').doc(request.auth.uid).get();
  if (!['ADM_MASTER', 'ADM_MESTRE', 'ADM_GERENTE'].includes(callerSnap.data()?.role)) {
    throw new HttpsError('permission-denied', 'Permissão negada.');
  }
  try {
    await seedUsers();
    return { success: true };
  } catch (error: any) {
    throw new HttpsError('aborted', 'Erro ao sincronizar usuários: ' + (error?.message || error));
  }
});

export const processVenda = onCall(
  safeExecute("PROCESS_VENDA", async (request) => {
    const data = request.data;
    const { clienteId, itens, metodoPagamento, comprovanteUrl, clienteNome, clienteDocumento, dataNascimento } = data;
    
    if (!clienteId || !itens || !metodoPagamento) throw new HttpsError('invalid-argument', 'Dados incompletos');
    if (!Array.isArray(itens) || itens.length === 0) throw new HttpsError('invalid-argument', 'A lista de itens não pode estar vazia');

    // Busca a carteira FORA da transação (queries não funcionam com `transaction.get`)
    let walletId: string | null = null;
    if (metodoPagamento === 'CARTEIRA') {
        const walletQuery = await db.collection('wallets').where('cliente_id', '==', clienteId).limit(1).get();
        if (!walletQuery.empty) walletId = walletQuery.docs[0].id;
    }

    // Transação ÚNICA (Removido o erro de transação aninhada)
    return await db.runTransaction(async (transaction: any) => {
      logInfo("INICIO_TRANSACAO", { clienteId, metodoPagamento });
      let vendedorId = request.auth?.uid || 'SYSTEM_SAAS';
      let vendedorNome = 'GSA-IA SaaS';
      let managerId = null;

      if (request.auth) {
        logInfo("BUSCANDO_USUARIO", { uid: request.auth.uid });
        const userSnap = await transaction.get(db.collection('usuarios').doc(request.auth.uid));
        managerId = userSnap.data()?.managerId || null;
        vendedorNome = userSnap.data()?.nome || 'Vendedor';
      }

      const ano = new Date().getFullYear();
      const protocolo = `#GSA-${ano}-${Date.now()}`;
      
      let valorTotal = 0;
      let margemTotal = 0;
      const processDataList: any[] = [];

      for (const item of itens) {
        if (!item.servicoId) throw new HttpsError('invalid-argument', 'servicoId ausente');
        
        const servicoSnap = await transaction.get(db.doc(`services/${item.servicoId}`));
        let servicoData: any = servicoSnap.exists ? servicoSnap.data() : null;
        
        if (!servicoData) {
            if (vendedorId === 'SYSTEM_SAAS' || ['diag_credito', 'diag_saas'].includes(item.servicoId)) {
                servicoData = { nome: item.servicoNome || 'Serviço SaaS', modelo_id: '', documentos: [], campos: [] };
            } else {
                throw new HttpsError('not-found', `Serviço ${item.servicoId} não encontrado`);
            }
        }
        
        const precoBase = Number(item.precoBase) || 0;
        const precoVenda = Number(item.precoVenda) || 0;
        valorTotal += precoVenda;
        margemTotal += (precoVenda - precoBase);

        let modeloId = servicoData?.modelo_id || '';
        let pendenciasIniciais = servicoData?.requisitos_documentos || servicoData?.documentos || [];
        let dadosFaltantes = servicoData?.requisitos_campos || servicoData?.campos || [];

        if (modeloId) {
          const modelSnap = await transaction.get(db.doc(`process_models/${modeloId}`));
          if (modelSnap.exists) {
            pendenciasIniciais = modelSnap.data()?.documentos || [];
            dadosFaltantes = modelSnap.data()?.campos || [];
          }
        }

        processDataList.push({
          servicoId: item.servicoId, servicoNome: item.servicoNome || servicoData.nome,
          precoBase, precoVenda, prazoEstimadoDias: Number(item.prazoEstimadoDias) || 7,
          modeloId, pendenciasIniciais, dadosFaltantes
        });
      }

      const clientSnap = await transaction.get(db.collection('clients').doc(clienteId));
      if (!clientSnap.exists) throw new HttpsError('not-found', 'Cliente não encontrado');
      
      const clientData = clientSnap.data() || {};
      const responsavelId = clientData.especialista_id || vendedorId;
      const visibilidade_uids = clientData.visibilidade_uids || [];

      let statusPagamento = metodoPagamento === 'PIX' ? 'Aguardando Confirmação' : 'Pendente';
      let statusProcesso = metodoPagamento === 'PIX' ? 'Aguardando Aprovação' : 'Pendente';
      let transacaoConfirmada = false;

      if (metodoPagamento === 'CARTEIRA' && walletId) {
        const walletSnap = await transaction.get(db.collection('wallets').doc(walletId));
        const walletData = walletSnap.data();
        let saldoDisponivel = (walletData?.saldo_atual || 0) + (walletData?.saldo_bonus || 0);

        if (saldoDisponivel >= valorTotal) {
          statusPagamento = 'Pago'; statusProcesso = 'Em Análise'; transacaoConfirmada = true;
          
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

          transaction.update(walletSnap.ref, cleanDataForFirestore({
              saldo_atual: novoSaldoAtual, saldo_bonus: novoSaldoBonus, ultima_atualizacao: FieldValue.serverTimestamp()
          }));
        } else {
          statusPagamento = 'Aguardando Liberação ADM'; statusProcesso = 'Aguardando Liberação'; transacaoConfirmada = false;
        }
      } else if (metodoPagamento === 'CARTEIRA') {
          statusPagamento = 'Aguardando Liberação ADM'; statusProcesso = 'Aguardando Liberação'; transacaoConfirmada = false;
      }

      const saleRef = db.collection('sales').doc();
      transaction.set(saleRef, cleanDataForFirestore({
        protocolo, cliente_id: clienteId, vendedor_id: vendedorId, vendedor_nome: vendedorNome,
        managerId, valor_total: valorTotal, margem_total: margemTotal, metodo_pagamento: metodoPagamento,
        status_pagamento: statusPagamento, comprovante_url: comprovanteUrl || null,
        timestamp: FieldValue.serverTimestamp(), visibilidade_uids
      }));

      for (const pData of processDataList) {
        const processRef = db.collection('order_processes').doc();
        transaction.set(processRef, cleanDataForFirestore({
          venda_id: saleRef.id, protocolo, ...pData, status_atual: statusProcesso,
          vendedor_id: vendedorId, vendedor_nome: vendedorNome, managerId,
          cliente_id: clienteId, cliente_nome: clienteNome || '', cliente_cpf_cnpj: clienteDocumento || '',
          data_nascimento: dataNascimento || '', data_venda: FieldValue.serverTimestamp(), visibilidade_uids
        }));
      }

      if (metodoPagamento === 'PIX') {
        transaction.set(db.collection('financial_transactions').doc(), cleanDataForFirestore({
          cliente_id: clienteId, valor: valorTotal, tipo: 'CREDITO', origem: 'DEPOSITO_PIX',
          descricao: `Pagamento PIX Venda ${saleRef.id.slice(0, 8)}`, confirmado_pelo_administrador: false,
          venda_id: saleRef.id, vendedor_id: vendedorId, vendedor_nome: vendedorNome, managerId,
          comprovante_url: comprovanteUrl || null, timestamp: FieldValue.serverTimestamp(), visibilidade_uids
        }));
        transaction.set(db.collection('financial_transactions').doc(), cleanDataForFirestore({
          cliente_id: clienteId, valor: -valorTotal, tipo: 'DEBITO', origem: 'VENDA',
          descricao: `Débito Venda ${saleRef.id.slice(0, 8)}`, confirmado_pelo_administrador: false,
          venda_id: saleRef.id, vendedor_id: vendedorId, vendedor_nome: vendedorNome, managerId,
          timestamp: FieldValue.serverTimestamp(), visibilidade_uids
        }));
      } else if (metodoPagamento === 'CARTEIRA') {
        transaction.set(db.collection('financial_transactions').doc(), cleanDataForFirestore({
          cliente_id: transacaoConfirmada ? clienteId : responsavelId,
          valor: -valorTotal, tipo: 'DEBITO', origem: 'VENDA',
          descricao: transacaoConfirmada ? `Pagamento via Carteira - Venda ${saleRef.id.slice(0, 8)}` : `Aguardando Liberação - Venda ${saleRef.id.slice(0, 8)}`,
          confirmado_pelo_administrador: transacaoConfirmada, venda_id: saleRef.id, vendedor_id: vendedorId,
          vendedor_nome: vendedorNome, managerId, timestamp: FieldValue.serverTimestamp(),
          visibilidade_uids: transacaoConfirmada ? visibilidade_uids : [responsavelId, vendedorId]
        }));
      }

      return { saleId: saleRef.id, protocolo };
    });
  })
);

export const processarVendaSegura = onCall(
  safeExecute("VENDA_SEGURA", async (request) => {
    const uid = assertAuth(request);
    const { clienteId, servicoId, valorVendaFinal, metodoPagamento, isBulk = false, quantidade = 1 } = request.data;

    if (!clienteId || !servicoId || valorVendaFinal === undefined || valorVendaFinal === null) throw new HttpsError('invalid-argument', 'Dados incompletos.');

    const valor = Number(valorVendaFinal);
    const qty = Number(quantidade) || 1;
    if (isNaN(valor) || valor <= 0) throw new HttpsError('invalid-argument', 'Valor inválido');

    return await db.runTransaction(async (tx: any) => {
      const userSnap = await tx.get(db.collection('usuarios').doc(uid));
      if (!userSnap.exists) throw new HttpsError('not-found', 'Vendedor não encontrado');
      
      const user = userSnap.data()!;
      let servico: any = { nome_servico: 'Serviço/Recarga', preco_base_vendedor: 0, preco_base_gestor: 0, is_mass_sale_active: false, modelo_id: '', documentos: [], campos: [] };

      if (servicoId !== 'manual') {
        const servicoSnap = await tx.get(db.collection('services').doc(servicoId));
        if (servicoSnap.exists) servico = servicoSnap.data()!;
      }
      
      const nivel = user.role || 'CLIENTE';
      let precoMin = Number(servico.preco_base_vendedor) || 0;

      if (['ADM_MASTER', 'ADM_MESTRE', 'GESTOR', 'ADM_GERENTE'].includes(nivel)) precoMin = Number(servico.preco_base_gestor) || precoMin;
      if (isBulk && servico.is_mass_sale_active) precoMin = Number(servico.preco_massa_vendedor) || precoMin;

      const minimoTotal = precoMin * qty;
      if (valor < (minimoTotal - 0.01)) throw new HttpsError('permission-denied', `Abaixo do mínimo (R$ ${valor} < R$ ${minimoTotal})`);

      if (metodoPagamento === 'CARTEIRA') {
        const walletQuery = await db.collection('wallets').where('cliente_id', '==', clienteId).limit(1).get();
        if (walletQuery.empty) throw new HttpsError('failed-precondition', 'Cliente sem carteira');

        const walletRef = walletQuery.docs[0].ref;
        const wallet = (await tx.get(walletRef)).data()!;
        const totalDisponivel = (Number(wallet.saldo_atual) || 0) + (Number(wallet.saldo_bonus) || 0);

        if (totalDisponivel < valor) throw new HttpsError('failed-precondition', 'Saldo insuficiente');

        let aDebitar = valor, novoBonus = Number(wallet.saldo_bonus) || 0, novoSaldo = Number(wallet.saldo_atual) || 0;

        if (novoBonus >= aDebitar) { novoBonus -= aDebitar; aDebitar = 0; }
        else { aDebitar -= novoBonus; novoBonus = 0; novoSaldo -= aDebitar; }

        tx.update(walletRef, cleanDataForFirestore({ saldo_atual: novoSaldo, saldo_bonus: novoBonus, ultima_atualizacao: FieldValue.serverTimestamp() }));
        tx.set(db.collection('financial_transactions').doc(), cleanDataForFirestore({
          cliente_id: clienteId, valor: -valor, tipo: 'DEBITO', origem: 'VENDA_SEGURA',
          descricao: `Ativação de serviço: ${servico.nome_servico}`, confirmado_pelo_administrador: true, vendedor_id: uid,
          timestamp: FieldValue.serverTimestamp()
        }));
      }

      const saleRef = db.collection('sales').doc();
      const protocolo = `SEC-${Date.now()}`;
      const visibilidade_uids = [uid, clienteId, ...(user.id_superior ? [user.id_superior] : [])];

      tx.set(saleRef, cleanDataForFirestore({
        protocolo, cliente_id: clienteId, vendedor_id: uid, vendedor_nome: user.nome || user.nome_completo || 'Vendedor',
        id_superior: user.id_superior || null, servico_id: servicoId, servico_nome: servico.nome_servico || 'Serviço',
        valor_total: valor, margem_total: valor - ((Number(servico.preco_base_gestor) || 0) * qty),
        metodo_pagamento: metodoPagamento, status_pagamento: metodoPagamento === 'CARTEIRA' ? 'Pago' : 'Pendente',
        quantidade: qty, origem: 'SISTEMA_V3_ENTERPRISE', visibilidade_uids, created_at: FieldValue.serverTimestamp()
      }));

      const statusProcesso = metodoPagamento === 'CARTEIRA' ? 'Em Análise' : 'Aguardando Pagamento';
      for (let i = 0; i < qty; i++) {
        tx.set(db.collection('order_processes').doc(), cleanDataForFirestore({
          venda_id: saleRef.id, protocolo, servico_id: servicoId, servico_nome: servico.nome_servico,
          status_atual: statusProcesso, preco_venda: valor / qty, cliente_id: clienteId, vendedor_id: uid,
          id_superior: user.id_superior || null, data_venda: FieldValue.serverTimestamp(),
          modelo_id: servico.modelo_id || '', pendencias_iniciais: servico.requisitos_documentos || servico.documentos || [],
          dados_faltantes: servico.requisitos_campos || servico.campos || [], visibilidade_uids
        }));
      }

      return { saleId: saleRef.id, protocolo };
    });
  })
);

export const gerarPagamentoPixGateway = onCall(
  safeExecute("PIX_GATEWAY", async (request) => {
    try { assertAuth(request); } catch (e) { if (request.data?.origem !== 'SAAS_LANDING_PAGE') throw e; }
    
    const { valor, nome, email, cpf, vendaId, descricao } = request.data;
    if (!valor || !nome || !email || !cpf || !vendaId) throw new HttpsError('invalid-argument', 'Dados incompletos');

    const { payment: mpPayment, projectId } = await getMPClient();
    
    try {
      const response = await mpPayment.create({
        body: {
          transaction_amount: Number(valor), description: descricao || 'Pagamento GSA', payment_method_id: 'pix',
          external_reference: vendaId, payer: { email, first_name: nome.split(' ')[0], last_name: nome.split(' ').slice(1).join(' ') || 'Cliente', identification: { type: String(cpf).replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF', number: String(cpf).replace(/\D/g, '') } },
          notification_url: `https://us-central1-${projectId}.cloudfunctions.net/webhookMercadoPago`
        }
      });
      
      const qrData = response.point_of_interaction?.transaction_data;
      await db.collection('sales').doc(vendaId).update(cleanDataForFirestore({
          mp_payment_id: String(response.id), gateway: 'MERCADO_PAGO', status_pagamento: 'Pendente',
          qr_code: qrData?.qr_code, qr_code_base64: qrData?.qr_code_base64, copy_paste: qrData?.qr_code, atualizado_em: FieldValue.serverTimestamp()
      }));

      return { id: String(response.id), status: response.status, qr_code: qrData?.qr_code, qr_code_base64: qrData?.qr_code_base64, copy_paste: qrData?.qr_code, gateway: 'MERCADO_PAGO' };
    } catch (err: any) {
      throw new HttpsError('aborted', `Gateway recusou: ${err.response?.data?.message || err.message}`);
    }
  })
);

export const gerarPagamentoAsaas = onCall(
  safeExecute("ASAAS_PIX", async (request) => {
    try { assertAuth(request); } catch (e) { if (request.data?.origem !== 'SAAS_LANDING_PAGE') throw e; }
    
    const { valor, nome, email, cpf, vendaId, descricao } = request.data;
    if (!valor || !nome || !email || !cpf || !vendaId) throw new HttpsError('invalid-argument', 'Dados do pedido incompletos.');

    const config = await getSaasAdminConfig();
    const token = config.asaas_key || process.env.ASAAS_KEY;
    if (!token) throw new HttpsError('failed-precondition', 'Configuração de pagamento Asaas não encontrada.');

    const ASAAS_URL = config.is_sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';
    const headers = { 'access_token': token, 'Content-Type': 'application/json' };
    const safeCpf = cpf ? String(cpf).replace(/\D/g, '') : '';

    console.log(`[ASAAS_PIX] Iniciando para venda: ${vendaId}, Cliente: ${email}`);
    console.log(`[ASAAS_PIX] TOKEN_CHECK: ${token ? 'Presente' : 'Ausente'}`);

    try {
      // 1. Busca ou cria o cliente no Asaas
      let customerId = '';
      const searchRes = await axios.get(`${ASAAS_URL}/customers?email=${email}`, { headers });
      
      if (searchRes.data?.data?.length > 0) {
        customerId = searchRes.data.data[0].id;
      } else {
        const customerData = {
          name: nome,
          email: email,
          ...(safeCpf && { cpfCnpj: safeCpf })
        };
        const customerRes = await axios.post(`${ASAAS_URL}/customers`, customerData, { headers });
        customerId = customerRes.data.id;
        console.log(`[ASAAS_PIX] Cliente criado: ${customerId}`);
      }

      // 2. Cria a cobrança
      const paymentData = {
        customer: customerId,
        billingType: 'PIX',
        value: Number(valor),
        dueDate: new Date().toISOString().split('T')[0],
        externalReference: vendaId,
        description: descricao || `Pagamento GSA Venda ${vendaId.substring(0, 8)}`
      };
      
      const paymentRes = await axios.post(`${ASAAS_URL}/payments`, paymentData, { headers });
      console.log(`[ASAAS_PIX] paymentRes.data:`, JSON.stringify(paymentRes.data));
      const paymentId = paymentRes.data.id;
      console.log(`[ASAAS_PIX] Cobrança criada: ${paymentId}`);

      // 3. Busca o QR Code
      const qrRes = await axios.get(`${ASAAS_URL}/payments/${paymentId}/pixQrCode`, { headers });
      console.log(`[ASAAS_PIX] qrRes.data:`, JSON.stringify(qrRes.data));
      
      // 4. Atualiza a venda no banco
      await db.collection('sales').doc(vendaId).update(cleanDataForFirestore({
          asaas_payment_id: paymentId,
          gateway: 'ASAAS',
          status_pagamento: 'Pendente',
          updated_at: FieldValue.serverTimestamp()
      }));

      return {
        payment_id: paymentId,
        copy_paste: qrRes.data.payload,
        qr_code_base64: qrRes.data.encodedImage,
        status: paymentRes.data.status,
        gateway: 'ASAAS'
      };
    } catch (error: any) {
      console.error("[ASAAS_PIX] Erro na API:", JSON.stringify(error.response?.data || error.message));
      throw new HttpsError('aborted', `Falha na integração Asaas: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
  })
);

export const webhookAsaas = onRequest({ invoker: 'public' }, async (req: any, res: any) => {
  const eventId = req.body?.payment?.id;
  try {
    if (!eventId) return res.status(400).send("Missing eventId");
    const eventRef = db.collection('webhook_events').doc(`asaas_${eventId}`);
    if ((await eventRef.get()).exists) return res.status(200).send("OK");

    const { event, payment } = req.body;
    if (!['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) return res.status(200).send("Ignorado");

    const vendaId = payment.externalReference;
    const saleRef = db.collection('sales').doc(vendaId);
    const saleSnap = await saleRef.get();
    if (!saleSnap.exists) return res.status(404).send("Sale not found");

    const batch = db.batch();
    batch.update(saleRef, cleanDataForFirestore({ status_pagamento: 'Pago', pago_em: FieldValue.serverTimestamp(), asaas_status: payment.status, asaas_payment_id: payment.id, gateway: 'ASAAS' }));

    const processes = await db.collection('order_processes').where('venda_id', '==', vendaId).get();
    processes.forEach((doc: any) => {
      batch.update(doc.ref, cleanDataForFirestore({ status_atual: 'Em Análise', status_financeiro: 'PAGO', data_inicial: FieldValue.serverTimestamp() }));
    });

    await processarBonusDeVendaNoBackend(vendaId, batch);
    batch.set(eventRef, cleanDataForFirestore({ gateway: 'ASAAS', eventId, vendaId, processedAt: FieldValue.serverTimestamp() }));
    await batch.commit();

    res.status(200).send("OK");
  } catch (error) { res.status(500).send("Error"); }
});

export const webhookMercadoPago = onRequest({ invoker: 'public' }, async (req: any, res: any) => {
  const paymentId = req.body?.data?.id || req.body?.id || req.query?.id;
  try {
    if (!paymentId) return res.status(400).send("Missing paymentId");
    const eventRef = db.collection('webhook_events').doc(`mp_${paymentId}`);
    if ((await eventRef.get()).exists) return res.status(200).send("OK");

    const { payment: mpPayment } = await getMPClient();
    const paymentInfo = await mpPayment.get({ id: paymentId });
    if (paymentInfo.status !== 'approved') return res.status(200).send("Pendente");

    const vendaId = paymentInfo.external_reference || paymentInfo.metadata?.venda_id;
    if (!vendaId) return res.status(200).send("No reference");

    const saleRef = db.collection('sales').doc(vendaId);
    const saleSnap = await saleRef.get();
    
    const consRef = db.collection('consultation_requests').doc(vendaId);
    const consSnap = await consRef.get();

    if (!saleSnap.exists && !consSnap.exists) {
        return res.status(404).send("Sale/Consultation not found");
    }

    const batch = db.batch();
    
    if (saleSnap.exists) {
        batch.update(saleRef, cleanDataForFirestore({ status_pagamento: 'Pago', pago_em: FieldValue.serverTimestamp(), mp_status: 'approved', mp_payment_id: String(paymentId), gateway: 'MERCADO_PAGO' }));
        const processes = await db.collection('order_processes').where('venda_id', '==', vendaId).get();
        processes.forEach((doc: any) => {
          batch.update(doc.ref, cleanDataForFirestore({ status_atual: 'Em Análise', status_financeiro: 'PAGO' }));
        });
    }

    if (consSnap.exists) {
        batch.update(consRef, cleanDataForFirestore({ status: 'paid', status_pagamento: 'Pago', mp_status: 'approved', mp_payment_id: String(paymentId) }));
    }

    batch.set(eventRef, cleanDataForFirestore({ gateway: 'MERCADO_PAGO', paymentId: String(paymentId), vendaId, processedAt: FieldValue.serverTimestamp() }));
    await batch.commit();
    res.status(200).send("OK");
  } catch (error) { res.status(500).send("Error"); }
});

export const registrarVendaAdministrativa = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Acesso negado');

  const { cliente, servicoId, vendedorId, dataServico } = request.data || {};
  if (!cliente?.nome || !cliente?.cpf || !servicoId || !dataServico) throw new HttpsError('invalid-argument', 'Campos obrigatórios.');

  const cleanCPF = String(cliente.cpf).replace(/\D/g, '');
  const userSnap = await db.collection('usuarios').doc(uid).get();
  if (!['ADM_MASTER', 'ADM_GERENTE', 'ADM_ANALISTA'].includes(userSnap.data()?.nivel)) throw new HttpsError('permission-denied', 'Permissão negada.');

  const batch = db.batch();
  const clientRef = db.collection('clients').doc();
  const timestamp = FieldValue.serverTimestamp();
  const protocolo = `ADM-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`;

  batch.set(clientRef, cleanDataForFirestore({ nome: cliente.nome, documento: cleanCPF, cpf: cleanCPF, vendedor_id: vendedorId || uid, timestamp, created_at: timestamp, origem: 'ADMIN_FLOW' }));
  batch.set(db.collection('sales').doc(), cleanDataForFirestore({ protocolo, cliente_id: clientRef.id, cliente_nome: cliente.nome, vendedor_id: vendedorId || uid, valor_total: 0, metodo_pagamento: 'MANUAL', status_pagamento: 'Confirmado', timestamp, pago_em: timestamp }));
  batch.set(db.collection('order_processes').doc(), cleanDataForFirestore({ protocolo, servico_id: servicoId, cliente_id: clientRef.id, cliente_cpf_cnpj: cleanCPF, vendedor_id: vendedorId || uid, status_atual: 'Ativo', status_financeiro: 'PAGO', data_execucao: dataServico, data_venda: timestamp }));
  
  await batch.commit();
  return { success: true, protocolo };
});

export * from './notifications';

export const onProcessoAtualizado = functions.firestore
  .document('order_processes/{processoId}')
  .onUpdate(async (change, context) => {
    const dadosAntes = change.before.data();
    const dadosDepois = change.after.data();

    // Verifica se é um processo de limpa nome e se acabou de atingir 100%
    if (dadosDepois.is_limpa_nome && dadosAntes.progresso_baixa !== 100 && dadosDepois.progresso_baixa === 100) {
      
      const clienteId = dadosDepois.cliente_id;
      // Gera o link de indicação rastreável
      const linkIndicacao = `https://seusistema.com.br/cadastro?ref=${clienteId}`;

      // Monta o E-mail comemorativo
      const templateEmail = `
        <h2>Parabéns! Suas baixas foram completadas! 🚀</h2>
        <p>Passando para agradecer pela confiança e parceria. Há anos caminhamos juntos nesse segmento, superando desafios e construindo resultados reais! 👊🔥</p>
        <p>Sei que os últimos dias foram desafiadores, mas o mercado acaba de receber a resposta: as BAIXAS foram concluídas com sucesso no seu CPF/CNPJ.</p>
        <p>Acreditamos em quem está no campo de batalha diariamente. Nosso compromisso é um só: resultado, parceria e crescimento mútuo. Deus abençoe!</p>
        <hr/>
        <h3>Gere Renda Extra com sua Credibilidade!</h3>
        <p>Agora que você teve resultado comprovado, que tal indicar mais pessoas para que elas também possam ter a credibilidade de volta?</p>
        <p>Compartilhe o seu link exclusivo abaixo. Cada cliente que fechar conosco através dele, gerará comissões e bônus diretamente no seu painel!</p>
        <p><strong>Seu link de indicação:</strong> <a href="${linkIndicacao}">${linkIndicacao}</a></p>
      `;

      // Envia notificação Push via FCM (Firebase Cloud Messaging)
      await admin.messaging().sendToTopic(`client_${clienteId}`, {
        notification: {
          title: "Nome Limpo! 🎉",
          body: "Todas as baixas do seu processo foram concluídas. Verifique seu e-mail!"
        }
      });

      // Registrar e-mail na collection 'mail'
      await admin.firestore().collection('mail').add({
        to: dadosDepois.cliente_email,
        message: {
          subject: 'Resultado Entregue: Processo Finalizado! 🎯',
          html: templateEmail
        }
      });
    }
});


const transporter = nodemailer.createTransport({
  service: 'gmail', auth: { user: 'teu-email@gmail.com', pass: 'tua-senha-de-app' }
});

export const processadorNotificacoesGSA = functions.firestore
  .document('system_notifications/{id}')
  .onCreate(async (snap) => {
    const data = snap.data();
    if (data.tipo === 'SUPORTE') {
      return transporter.sendMail({
        from: 'Monitoramento GSA <teu-email@gmail.com>', to: 'suporte@camaragsa.com.br',
        subject: `⚠️ URGENTE: Suporte - ${data.protocolo}`, html: `<p>Suporte: ${data.cliente}</p>`
      });
    }
    return null;
});