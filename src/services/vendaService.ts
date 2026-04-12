import { getFunctions, httpsCallable } from 'firebase/functions';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { app, db, cleanData } from '../firebase';

const functions = getFunctions(app);

export async function processarVenda(
  clienteId: string, 
  itens: { servicoId: string; servicoNome: string; precoBase: number; precoVenda: number; prazoEstimadoDias: number }[],
  metodoPagamento: 'PIX' | 'CARTEIRA' | 'MANUAL',
  comprovanteUrl?: string,
  clienteNome?: string,
  clienteDocumento?: string,
  dataNascimento?: string
) {
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
  return result.data as { saleId: string; [key: string]: any };
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
      margem_total: plano.preco, // No modo manual, assumimos margem total por enquanto
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
    console.error("Erro ao registrar venda manual:", error);
    throw error;
  }
}

export async function processarVendaSeguraFront(
  clienteId: string,
  servicoId: string,
  valorVendaFinal: number,
  metodoPagamento: 'PIX' | 'CARTEIRA'
) {
  try {
    const processarVendaBackend = httpsCallable(functions, 'processarVendaSegura');
    
    const result = await processarVendaBackend({ 
      clienteId,
      servicoId,
      valorVendaFinal,
      metodoPagamento 
    });

    // Retorna o que o backend respondeu (saleId e protocolo)
    return result.data as { saleId: string, protocolo: string };
    
  } catch (error: any) {
    console.error("Erro na Venda Segura:", error);
    // Repassa o erro legível do backend (ex: Tentativa de fraude) para o usuário ver no Toast/Swal
    throw new Error(error.message || 'Erro ao processar a venda.');
  }
}

export async function gerarPagamentoSaaS(data: {
  valor: number;
  plano: string;
  email: string;
  nome: string;
  cpf: string;
  clienteId: string;
  vendaId: string;
}) {
  const gerarPagamento = httpsCallable(functions, 'gerarPagamentoSaaS');
  const result = await gerarPagamento(data);
  return result.data as { 
    id: number; 
    status: string; 
    qr_code: string; 
    qr_code_base64: string; 
    copy_paste: string; 
  };
}
