import { httpsCallable } from 'firebase/functions';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, cleanData, functions } from '../firebase';

/**
 * Utilitário para extrair a mensagem de erro real de um HttpsError do Firebase.
 * Evita o mascaramento do erro "internal" pelo Firebase.
 */
function handleFirebaseError(error: any, context: string): never {
  console.error(`ERRO COMPLETO (${context}):`, error);
  
  let errorMessage = `Falha técnica em ${context}.`;
  
  if (error?.message) {
    errorMessage = error.message;
  } else if (error?.details) {
    errorMessage = typeof error.details === 'string' ? error.details : JSON.stringify(error.details);
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // Se a mensagem for "internal", tentamos extrair o máximo de info técnica do objeto de erro
  if (errorMessage.toLowerCase() === 'internal' || errorMessage.toLowerCase() === 'internal error') {
    const technicalInfo = [];
    if (error?.code) technicalInfo.push(`Code: ${error.code}`);
    if (error?.details) technicalInfo.push(`Details: ${JSON.stringify(error.details)}`);
    if (error?.message) technicalInfo.push(`Msg: ${error.message}`);
    
    errorMessage = `Erro interno no servidor GSA (${context}). Info: ` + 
                   (technicalInfo.length > 0 ? technicalInfo.join(' | ') : "Nenhuma informação extra disponível. Verifique os logs do servidor.");
  }
                       
  throw new Error(errorMessage);
}

export async function processarVenda(
  clienteId: string, 
  itens: { servicoId: string; servicoNome: string; precoBase: number; precoVenda: number; prazoEstimadoDias: number }[],
  metodoPagamento: 'PIX' | 'CARTEIRA' | 'MANUAL',
  comprovanteUrl?: string,
  clienteNome?: string,
  clienteDocumento?: string,
  dataNascimento?: string
) {
  try {
    const processVenda = httpsCallable(functions, 'processVenda');
    const result = await processVenda({ 
      clienteId, 
      itens, 
      metodoPagamento, 
      comprovanteUrl, 
      clienteNome, 
      clienteDocumento, 
      dataNascimento 
    });
    return result.data as { saleId: string; protocolo: string; [key: string]: any };
  } catch (error) {
    return handleFirebaseError(error, "ProcessarVenda");
  }
}

export async function registrarVendaManual(
  clienteId: string,
  plano: { nome: string; preco: number },
  vendedorId: string = 'SaaS_DIRETO'
) {
  try {
    const vendaRef = await addDoc(collection(db, 'sales'), cleanData({
      cliente_id: clienteId,
      vendedor_id: vendedorId,
      vendedor_nome: 'GSA-IA SaaS',
      valor_total: plano.preco,
      margem_total: plano.preco,
      metodo_pagamento: 'MANUAL_LINK',
      status_pagamento: 'Aguardando Comprovante',
      timestamp: serverTimestamp(),
      origem: 'SAAS_LANDING_PAGE',
      itens: [{
        servicoId: 'diag_saas',
        servicoNome: plano.nome,
        precoBase: plano.preco,
        precoVenda: plano.preco
      }]
    }));
    
    return vendaRef.id;
  } catch (error) {
    return handleFirebaseError(error, "RegistrarVendaManual");
  }
}

export async function processarVendaSeguraFront(
  clienteId: string,
  servicoId: string,
  valorVendaFinal: number,
  metodoPagamento: 'PIX' | 'CARTEIRA',
  isBulk: boolean = false,
  quantidade: number = 1
) {
  try {
    const processarVendaBackend = httpsCallable(functions, 'processarVendaSegura');
    
    if (!clienteId || !servicoId || isNaN(valorVendaFinal)) {
      throw new Error(`Dados inválidos para Venda Segura. Valor: ${valorVendaFinal}`);
    }

    const payload = cleanData({ 
      clienteId,
      servicoId,
      valorVendaFinal: Number(valorVendaFinal),
      metodoPagamento,
      isBulk,
      quantidade: Number(quantidade) || 1
    });

    const result = await processarVendaBackend(payload);
    return result.data as { saleId: string, protocolo: string };
  } catch (error) {
    return handleFirebaseError(error, "VendaSegura");
  }
}

export async function gerarPagamentoPixGateway(data: {
  valor: number;
  descricao: string;
  email: string;
  nome: string;
  cpf: string;
  clienteId: string;
  vendaId: string;
}) {
  try {
    const gerarPagamento = httpsCallable(functions, 'gerarPagamentoPixGateway');
    const result = await gerarPagamento(data);
    return result.data as { 
      id: string; 
      status: string; 
      qr_code: string; 
      qr_code_base64: string; 
      copy_paste: string; 
      gateway: string;
    };
  } catch (error) {
    return handleFirebaseError(error, "PixGateway");
  }
}

export async function gerarPagamentoAsaasFront(data: any) {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('../firebase');
  const func = httpsCallable(functions, 'gerarPagamentoAsaas');
  const result = await func(data);
  return result.data as { qr_code_base64: string; copy_paste: string; payment_id: string };
}
