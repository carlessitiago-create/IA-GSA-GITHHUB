"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookMercadoPago = exports.webhookAsaas = exports.gerarPagamentoAsaas = exports.gerarPagamentoPixGateway = exports.processarVendaSegura = exports.processVenda = exports.atualizarSenhaUsuario = exports.criarAdministradorDeUsuarios = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const mercadopago_1 = require("mercadopago");
const axios_1 = __importDefault(require("axios"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const app = admin.apps[0];
let dbId = 'ai-studio-2473fb05-836e-42bf-bfe7-6175607907dd';
try {
    const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.firestoreDatabaseId)
            dbId = config.firestoreDatabaseId;
    }
}
catch (e) {
    console.warn("Usando databaseId padrão devido a erro na config:", e);
}
const db = (0, firestore_1.getFirestore)(app, dbId);
console.log(`Cloud Functions conectadas ao Firestore DB: ${dbId}`);
async function getSaasAdminConfig() {
    try {
        const saasRef = db.collection('platform_config').doc('saas_settings');
        const saasSnap = await saasRef.get();
        return saasSnap.data() || {};
    }
    catch (e) {
        console.error("Erro ao obter saas_settings:", e);
        return {};
    }
}
async function processarBonusDeVendaNoBackend(vendaId, batch) {
    try {
        const saleSnap = await db.collection('sales').doc(vendaId).get();
        if (!saleSnap.exists)
            return;
        const sale = saleSnap.data();
        const rulesSnap = await db.collection('platform_config').doc('points_rules').get();
        const rules = rulesSnap.data()?.valores || {
            cadastro: 50,
            indicacao: 100,
            venda_vendedor: 150,
            venda_gestor: 75
        };
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
    }
    catch (error) {
        console.error("Erro ao processar bônus no webhook:", error);
    }
}
function cleanDataForFirestore(obj, isRoot = true) {
    if (obj === null || obj === undefined)
        return isRoot ? {} : undefined;
    if (typeof obj === 'number')
        return isFinite(obj) ? obj : 0;
    if (typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(v => cleanDataForFirestore(v, false)).filter(v => v !== undefined);
    }
    if (obj instanceof admin.firestore.FieldValue)
        return obj;
    if (obj instanceof admin.firestore.Timestamp || obj instanceof Date)
        return obj;
    const constructorName = obj.constructor?.name;
    if (constructorName && !['Object', 'Array'].includes(constructorName))
        return obj;
    const result = {};
    let hasData = false;
    Object.keys(obj).forEach((key) => {
        const val = cleanDataForFirestore(obj[key], false);
        if (val !== undefined) {
            result[key] = val;
            hasData = true;
        }
    });
    if (!hasData && !isRoot)
        return undefined;
    return result;
}
function logDetailed(message, data) {
    if (!data) {
        console.log(`[INFO] ${message}`);
        return;
    }
    try {
        const cache = new Set();
        const safeData = JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value))
                    return '[Circular]';
                cache.add(value);
            }
            return value;
        }, 2);
        console.log(`[INFO] ${message}: ${safeData}`);
    }
    catch (e) {
        console.log(`[INFO] ${message}: [Data too complex to stringify: ${String(e)}]`);
    }
}
function logInfo(message, data) {
    const timestamp = new Date().toISOString();
    if (data) {
        logDetailed(`[${timestamp}] [INFO] ${message}`, data);
    }
    else {
        console.log(`[${timestamp}] [INFO] ${message}`);
    }
}
function logError(message, error) {
    const timestamp = new Date().toISOString();
    if (error) {
        console.error(`[${timestamp}] [ERROR] ${message}`, error);
    }
    else {
        console.error(`[${timestamp}] [ERROR] ${message}`);
    }
}
function throwHttpsError(code, message, originalError) {
    const validCodes = ['ok', 'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found', 'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition', 'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable', 'data-loss', 'unauthenticated'];
    let safeCode = validCodes.includes(code) ? code : 'aborted';
    if (safeCode === 'internal' || safeCode === 'unknown')
        safeCode = 'aborted';
    let technicalDetails = '';
    if (originalError) {
        if (originalError.response?.data) {
            technicalDetails = JSON.stringify(originalError.response.data);
        }
        else if (originalError.message) {
            technicalDetails = String(originalError.message);
        }
        else {
            technicalDetails = String(originalError);
        }
    }
    const detailMessage = technicalDetails ? `${message} [Info: ${technicalDetails}]` : message;
    console.error(`[HTTPS_ERROR] Code: ${safeCode} | Msg: ${message} | Technical: ${technicalDetails}`);
    throw new functions.https.HttpsError(safeCode, message, detailMessage);
}
function assertAuth(context) {
    if (!context.auth) {
        throwHttpsError('unauthenticated', 'Usuário não autenticado');
    }
    return context.auth.uid;
}
function safeExecute(moduleName, handler) {
    return async (data, context) => {
        try {
            console.log(`[${moduleName}] INICIO | UID: ${context.auth?.uid}`);
            const result = await handler(data, context);
            console.log(`[${moduleName}] SUCESSO`);
            return result;
        }
        catch (error) {
            console.error(`[${moduleName}] ERRO CRITICO capturado:`, error);
            let safeCode = 'aborted';
            let safeMessage = 'Falha desconhecida';
            let safeDetails = null;
            if (error?.code && typeof error.code === 'string') {
                const cleanCode = error.code.replace('functions/', '');
                const validCodes = ['ok', 'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found', 'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition', 'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable', 'data-loss', 'unauthenticated'];
                if (validCodes.includes(cleanCode)) {
                    safeCode = cleanCode;
                }
            }
            if (error?.message) {
                safeMessage = String(error.message);
            }
            if (error?.details) {
                safeDetails = error.details;
            }
            if (safeCode === 'internal' || safeCode === 'unknown') {
                safeCode = 'aborted';
            }
            console.error(`[${moduleName}] Final Error to emit -> Code: ${safeCode}, Message: ${safeMessage}`);
            throw new functions.https.HttpsError(safeCode, safeMessage, safeDetails);
        }
    };
}
async function getMPClient() {
    const config = await getSaasAdminConfig();
    const token = config.mercado_pago_access_token ||
        process.env.MP_ACCESS_TOKEN ||
        'APP_USR-4343959448906136-101900-bd86782be2ecf529a1c0e25c935bf4f1-124360597';
    const client = new mercadopago_1.MercadoPagoConfig({ accessToken: token });
    return {
        client,
        payment: new mercadopago_1.Payment(client),
        projectId: config.projectId || process.env.GCLOUD_PROJECT || 'gen-lang-client-0086269527'
    };
}
const ASAAS_URL = 'https://www.asaas.com/api/v3';
async function getAsaasHeaders() {
    const config = await getSaasAdminConfig();
    const key = config.asaas_key || process.env.ASAAS_KEY;
    if (!key)
        throw new Error("Chave do Asaas não configurada.");
    return {
        'access_token': key,
        'Content-Type': 'application/json'
    };
}
exports.criarAdministradorDeUsuarios = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
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
        const userRecord = await admin.auth().createUser({
            email,
            password: senha || 'Mudar@123',
            displayName: nome,
        });
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
    }
    catch (error) {
        console.error("Erro em criarAdministradorDeUsuarios:", error);
        throw new functions.https.HttpsError('aborted', 'Erro ao criar usuário: ' + (error?.message || error));
    }
});
exports.atualizarSenhaUsuario = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
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
    }
    catch (error) {
        console.error("Erro em atualizarSenhaUsuario:", error);
        throw new functions.https.HttpsError('aborted', 'Erro ao atualizar senha: ' + (error?.message || error));
    }
});
exports.processVenda = functions.https.onCall(safeExecute("PROCESS_VENDA", async (data, context) => {
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
        const ano = new Date().getFullYear();
        const protocolo = `#GSA-${ano}-${Date.now()}`;
        let valorTotal = 0;
        let margemTotal = 0;
        const processDataList = [];
        if (!Array.isArray(itens) || itens.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'A lista de itens não pode estar vazia');
        }
        for (const item of itens) {
            const servicoRef = db.doc(`services/${item.servicoId}`);
            const servicoSnap = await transaction.get(servicoRef);
            let servicoData = null;
            if (servicoSnap.exists) {
                servicoData = servicoSnap.data();
            }
            else if (vendedorId === 'SYSTEM_SAAS') {
                servicoData = {
                    nome: item.servicoNome || 'Serviço SaaS',
                    modelo_id: '',
                    documentos: [],
                    campos: []
                };
            }
            else {
                throw new functions.https.HttpsError('not-found', `Serviço ${item.servicoId} não encontrado`);
            }
            const precoBase = Number(item.precoBase) || 0;
            const precoVenda = Number(item.precoVenda) || 0;
            valorTotal += precoVenda;
            margemTotal += (precoVenda - precoBase);
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
        let statusPagamento = metodoPagamento === 'PIX' ? 'Aguardando Confirmação' : 'Pendente';
        let statusProcesso = metodoPagamento === 'PIX' ? 'Aguardando Aprovação' : 'Pendente';
        let transacaoConfirmada = false;
        let responsavelId = vendedorId;
        const clientRef = db.collection('clients').doc(clienteId);
        const clientSnap = await transaction.get(clientRef);
        if (!clientSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Cliente não encontrado');
        }
        const clientData = clientSnap.data() || {};
        responsavelId = clientData.especialista_id || vendedorId;
        const visibilidade_uids = clientData.visibilidade_uids || [];
        if (metodoPagamento === 'CARTEIRA') {
            const walletQuery = await db.collection('wallets').where('cliente_id', '==', clienteId).limit(1).get();
            let saldoDisponivel = 0;
            let walletId = null;
            let walletData = null;
            if (!walletQuery.empty) {
                walletId = walletQuery.docs[0].id;
                const walletRef = db.collection('wallets').doc(walletId);
                const walletSnap = await transaction.get(walletRef);
                walletData = walletSnap.data();
                saldoDisponivel = (walletData?.saldo_atual || 0) + (walletData?.saldo_bonus || 0);
            }
            if (saldoDisponivel >= valorTotal) {
                statusPagamento = 'Pago';
                statusProcesso = 'Em Análise';
                transacaoConfirmada = true;
                if (walletId) {
                    const walletRef = db.collection('wallets').doc(walletId);
                    let valorRestante = valorTotal;
                    let novoSaldoBonus = walletData.saldo_bonus || 0;
                    let novoSaldoAtual = walletData.saldo_atual || 0;
                    if (novoSaldoBonus >= valorRestante) {
                        novoSaldoBonus -= valorRestante;
                        valorRestante = 0;
                    }
                    else {
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
            }
            else {
                statusPagamento = 'Aguardando Liberação ADM';
                statusProcesso = 'Aguardando Liberação';
                transacaoConfirmada = false;
            }
        }
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
        }
        else if (metodoPagamento === 'CARTEIRA') {
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
            }
            else {
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
}));
exports.processarVendaSegura = functions.https.onCall(safeExecute("VENDA_SEGURA", async (data, context) => {
    const uid = assertAuth(context);
    const clean = cleanDataForFirestore;
    const { clienteId, servicoId, valorVendaFinal, metodoPagamento, isBulk = false, quantidade = 1 } = data;
    if (!clienteId || !servicoId || valorVendaFinal === undefined || valorVendaFinal === null) {
        throw new functions.https.HttpsError('invalid-argument', 'Dados incompletos: clienteId, servicoId ou valor ausentes.');
    }
    const valor = Number(valorVendaFinal);
    const qty = Number(quantidade) || 1;
    if (isNaN(valor) || valor <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Valor inválido');
    }
    return await db.runTransaction(async (tx) => {
        console.log(`[VENDA_SEGURA] Iniciando transação para cliente: ${clienteId}`);
        const userRef = db.collection('usuarios').doc(uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists)
            throw new functions.https.HttpsError('not-found', 'Vendedor não encontrado');
        const user = userSnap.data();
        let servico = {
            nome_servico: 'Serviço/Recarga GSA',
            preco_base_vendedor: 0,
            preco_base_gestor: 0,
            is_mass_sale_active: false,
            modelo_id: '',
            documentos: [],
            campos: []
        };
        if (servicoId !== 'manual') {
            const servicoRef = db.collection('services').doc(servicoId);
            const servicoSnap = await tx.get(servicoRef);
            if (servicoSnap.exists) {
                servico = servicoSnap.data();
            }
            else {
                console.warn(`[VENDA_SEGURA] Servico ${servicoId} não encontrado. Assumindo venda manual.`);
            }
        }
        const nivel = user.role || 'CLIENTE';
        console.log(`[VENDA_SEGURA] Vendedor: ${user.nome_completo}, Nível: ${nivel}`);
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
            throw new functions.https.HttpsError('permission-denied', `Preço abaixo do mínimo autorizado (R$ ${valor} < R$ ${minimoTotal})`);
        }
        if (metodoPagamento === 'CARTEIRA') {
            const walletQuery = await db.collection('wallets').where('cliente_id', '==', clienteId).limit(1).get();
            if (walletQuery.empty)
                throw new functions.https.HttpsError('failed-precondition', 'Cliente sem carteira configurada');
            const walletRef = walletQuery.docs[0].ref;
            const walletSnap = await tx.get(walletRef);
            const wallet = walletSnap.data();
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
            }
            else {
                aDebitar -= novoBonus;
                novoBonus = 0;
                novoSaldo -= aDebitar;
            }
            tx.update(walletRef, clean({
                saldo_atual: novoSaldo,
                saldo_bonus: novoBonus,
                ultima_atualizacao: admin.firestore.FieldValue.serverTimestamp()
            }));
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
    }).catch((err) => {
        console.error("[VENDA_SEGURA] Falha na transação Firestore:", err);
        throw err;
    });
}));
exports.gerarPagamentoPixGateway = functions.https.onCall(safeExecute("PIX_GATEWAY", async (data, context) => {
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
    }
    catch (err) {
        throwHttpsError('aborted', 'O gateway de pagamento recusou a transação', err);
    }
    if (!response?.id) {
        throw new functions.https.HttpsError('aborted', 'O Mercado Pago não gerou um ID de transação válido.');
    }
    const qrData = response.point_of_interaction?.transaction_data;
    await db.collection('sales').doc(vendaId).update(clean({
        mp_payment_id: String(response.id),
        gateway: 'MERCADO_PAGO',
        status_pagamento: 'Pendente',
        qr_code: qrData?.qr_code,
        qr_code_base64: qrData?.qr_code_base64,
        copy_paste: qrData?.qr_code,
        atualizado_em: admin.firestore.FieldValue.serverTimestamp()
    }));
    return {
        id: String(response.id),
        status: response.status,
        qr_code: qrData?.qr_code,
        qr_code_base64: qrData?.qr_code_base64,
        copy_paste: qrData?.qr_code,
        gateway: 'MERCADO_PAGO'
    };
}));
exports.gerarPagamentoAsaas = functions.https.onCall(safeExecute("ASAAS_PIX", async (data, context) => {
    const uid = assertAuth(context);
    const { valor, nome, email, cpf, vendaId, descricao } = data;
    const config = await getSaasAdminConfig();
    const token = config.asaas_key || process.env.ASAAS_KEY;
    if (!token) {
        throw new functions.https.HttpsError('failed-precondition', 'Chave de API do Asaas não encontrada no sistema.');
    }
    const ASAAS_URL = config.is_sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';
    const headers = {
        'access_token': token,
        'Content-Type': 'application/json'
    };
    const safeCpf = cpf ? String(cpf).replace(/\D/g, '') : '';
    const safeName = nome || 'Cliente GSA';
    const safeEmail = email || 'cliente@gsa.com';
    try {
        let customerId = '';
        const searchRes = await axios_1.default.get(`${ASAAS_URL}/customers?email=${safeEmail}`, { headers });
        if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
            customerId = searchRes.data.data[0].id;
        }
        else {
            const customerPayload = { name: safeName, email: safeEmail };
            if (safeCpf && safeCpf.length === 11 && safeCpf !== '00000000000') {
                customerPayload.cpfCnpj = safeCpf;
            }
            const customerRes = await axios_1.default.post(`${ASAAS_URL}/customers`, customerPayload, { headers });
            customerId = customerRes.data.id;
        }
        const paymentRes = await axios_1.default.post(`${ASAAS_URL}/payments`, {
            customer: customerId,
            billingType: 'PIX',
            value: valor,
            dueDate: new Date().toISOString().split('T')[0],
            externalReference: vendaId,
            description: descricao || 'Pagamento GSA'
        }, { headers });
        const paymentId = paymentRes.data.id;
        const qrRes = await axios_1.default.get(`${ASAAS_URL}/payments/${paymentId}/pixQrCode`, { headers });
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
    }
    catch (error) {
        console.error("ERRO DETALHADO DO ASAAS:", error.response?.data || error);
        const asaasErrorMessage = error.response?.data?.errors?.[0]?.description
            || error.response?.data?.message
            || error.message
            || 'Erro desconhecido ao comunicar com o Asaas';
        throw new functions.https.HttpsError('aborted', `Asaas recusou: ${asaasErrorMessage}`);
    }
}));
exports.webhookAsaas = functions.https.onRequest(async (req, res) => {
    const eventId = req.body?.payment?.id;
    try {
        logInfo("Webhook Asaas recebido", req.body);
        if (!eventId) {
            logError("Evento sem ID", req.body);
            return res.status(400).send("Missing eventId");
        }
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
        const saleData = saleSnap.data();
        if (saleData.status_pagamento === 'Pago') {
            await eventRef.set(cleanDataForFirestore({ processedAt: admin.firestore.FieldValue.serverTimestamp() }));
            logDetailed("Venda Asaas já estava paga", { vendaId });
            return res.status(200).send("Already paid");
        }
        const batch = db.batch();
        batch.update(saleRef, cleanDataForFirestore({
            status_pagamento: 'Pago',
            pago_em: admin.firestore.FieldValue.serverTimestamp(),
            asaas_status: payment.status,
            asaas_payment_id: payment.id,
            gateway: 'ASAAS'
        }));
        const processes = await db.collection('order_processes')
            .where('venda_id', '==', vendaId)
            .get();
        processes.forEach((doc) => {
            const pData = doc.data();
            batch.update(doc.ref, cleanDataForFirestore({
                status_atual: 'Em Análise',
                status_financeiro: 'PAGO',
                data_inicial: admin.firestore.FieldValue.serverTimestamp()
            }));
            batch.set(db.collection('status_history').doc(), cleanDataForFirestore({
                processo_id: doc.id,
                status_anterior: pData.status_atual || 'Pendente',
                novo_status: 'Em Análise',
                usuario_id: 'SYSTEM_WEBHOOK',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status_info_extra: 'Pagamento Asaas confirmado. Iniciando análise.'
            }));
        });
        await processarBonusDeVendaNoBackend(vendaId, batch);
        const batches = await db.collection('bulk_sales_batches')
            .where('venda_id', '==', vendaId)
            .get();
        batches.forEach((doc) => {
            batch.update(doc.ref, cleanDataForFirestore({
                status_pagamento: 'Pago',
                status_lote: 'Processando',
                data_confirmacao: admin.firestore.FieldValue.serverTimestamp()
            }));
        });
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
        batch.set(eventRef, cleanDataForFirestore({
            gateway: 'ASAAS',
            eventId,
            vendaId,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        }));
        await batch.commit();
        logInfo("Webhook Asaas processado com sucesso", { vendaId });
        res.status(200).send("OK");
    }
    catch (error) {
        logError("Erro no webhook Asaas", error);
        res.status(500).send("Internal Error");
    }
});
exports.webhookMercadoPago = functions.https.onRequest(async (req, res) => {
    const paymentId = req.body?.data?.id || req.body?.id || req.query?.id;
    try {
        logInfo("Webhook Mercado Pago recebido", { body: req.body, query: req.query });
        if (!paymentId) {
            logError("Pagamento sem ID", { body: req.body });
            return res.status(400).send("Missing paymentId");
        }
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
        const saleData = saleSnap.data();
        if (saleData.status_pagamento === 'Pago') {
            await eventRef.set(cleanDataForFirestore({ processedAt: admin.firestore.FieldValue.serverTimestamp() }));
            logDetailed("Venda MP já estava paga", { vendaId });
            return res.status(200).send("Already paid");
        }
        const batch = db.batch();
        batch.update(saleRef, cleanDataForFirestore({
            status_pagamento: 'Pago',
            pago_em: admin.firestore.FieldValue.serverTimestamp(),
            mp_status: 'approved',
            mp_payment_id: String(paymentId),
            gateway: 'MERCADO_PAGO'
        }));
        const processes = await db.collection('order_processes')
            .where('venda_id', '==', vendaId)
            .get();
        processes.forEach((doc) => {
            batch.update(doc.ref, cleanDataForFirestore({
                status_atual: 'Em Análise',
                status_financeiro: 'PAGO'
            }));
        });
        const batches = await db.collection('bulk_sales_batches')
            .where('venda_id', '==', vendaId)
            .get();
        batches.forEach((doc) => {
            batch.update(doc.ref, cleanDataForFirestore({
                status_pagamento: 'Pago',
                status_lote: 'Processando',
                data_confirmacao: admin.firestore.FieldValue.serverTimestamp()
            }));
        });
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
        batch.set(eventRef, cleanDataForFirestore({
            gateway: 'MERCADO_PAGO',
            paymentId: String(paymentId),
            vendaId,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        }));
        await batch.commit();
        logInfo("Webhook MP processado com sucesso", { vendaId });
        res.status(200).send("OK");
    }
    catch (error) {
        logError("Erro no webhook MP", error);
        res.status(500).send("Internal Error");
    }
});
//# sourceMappingURL=index.js.map