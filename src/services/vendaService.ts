import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

const functions = getFunctions(app);

export async function processarVenda(
  clienteId: string, 
  itens: { servicoId: string; servicoNome: string; precoBase: number; precoVenda: number; prazoEstimadoDias: number }[],
  metodoPagamento: 'PIX' | 'CARTEIRA',
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
