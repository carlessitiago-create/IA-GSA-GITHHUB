import { httpsCallable } from "firebase/functions";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, cleanData, functions } from "../firebase";

const BACKEND_URL = "";

/**
 * Utilitário para extrair a mensagem de erro real de um HttpsError do Firebase.
 * Evita o mascaramento do erro "internal" pelo Firebase.
 */
function handleFirebaseError(error: any, context: string): never {
  console.error(`ERRO COMPLETO (${context}):`, error);

  let errorMessage = `Falha técnica em ${context}.`;

  if (error?.message) {
    errorMessage = error.message + " (Frontend)";
  } else if (error?.details) {
    errorMessage =
      typeof error.details === "string"
        ? error.details
        : JSON.stringify(error.details);
  } else if (typeof error === "string") {
    errorMessage = error;
  }

  // Se a mensagem for "internal", tentamos extrair o máximo de info técnica do objeto de erro
  if (errorMessage.toLowerCase().includes("internal")) {
    const technicalInfo = [];
    if (error?.code) technicalInfo.push(`Code: ${error.code}`);
    if (error?.details)
      technicalInfo.push(`Details: ${JSON.stringify(error.details)}`);
    if (error?.message) technicalInfo.push(`Msg: ${error.message}`);

    errorMessage =
      `Erro interno no servidor GSA (${context}). Info: ` +
      (technicalInfo.length > 0
        ? technicalInfo.join(" | ")
        : "Nenhuma informação extra disponível. Verifique os logs do servidor.");
  }

  throw new Error(errorMessage);
}

export async function processarVenda(
  clienteId: string,
  itens: {
    servicoId: string;
    servicoNome: string;
    precoBase: number;
    precoVenda: number;
    prazoEstimadoDias: number;
  }[],
  metodoPagamento: "PIX" | "CARTEIRA" | "MANUAL",
  comprovanteUrl?: string,
  clienteNome?: string,
  clienteDocumento?: string,
  dataNascimento?: string,
) {
  try {
    const processVenda = httpsCallable(functions, "processVenda");
    const result = await processVenda(
      cleanData({
        clienteId,
        itens,
        metodoPagamento,
        comprovanteUrl,
        clienteNome,
        clienteDocumento,
        dataNascimento,
      }),
    );
    return result.data as {
      saleId: string;
      protocolo: string;
      [key: string]: any;
    };
  } catch (error) {
    return handleFirebaseError(error, "ProcessarVenda");
  }
}

export async function registrarVendaManual(
  clienteId: string,
  plano: { nome: string; preco: number },
  vendedorId: string = "SaaS_DIRETO",
) {
  try {
    const vendaRef = await addDoc(
      collection(db, "sales"),
      cleanData({
        cliente_id: clienteId,
        vendedor_id: vendedorId,
        vendedor_nome: "GSA-IA SaaS",
        valor_total: plano.preco,
        margem_total: plano.preco,
        metodo_pagamento: "MANUAL_LINK",
        status_pagamento: "Aguardando Comprovante",
        timestamp: serverTimestamp(),
        origem: "SAAS_LANDING_PAGE",
        itens: [
          {
            servicoId: "diag_saas",
            servicoNome: plano.nome,
            precoBase: plano.preco,
            precoVenda: plano.preco,
          },
        ],
      }),
    );

    return vendaRef.id;
  } catch (error) {
    return handleFirebaseError(error, "RegistrarVendaManual");
  }
}

export async function processarVendaSeguraFront(
  clienteId: string,
  servicoId: string,
  valorVendaFinal: number,
  metodoPagamento: "PIX" | "CARTEIRA",
  isBulk: boolean = false,
  quantidade: number = 1,
  splitComissoes: any = null,
) {
  try {
    const processarVendaBackend = httpsCallable(
      functions,
      "processarVendaSegura",
    );

    if (!clienteId || !servicoId || isNaN(valorVendaFinal)) {
      throw new Error(
        `Dados inválidos para Venda Segura. Valor: ${valorVendaFinal}`,
      );
    }

    const { auth, cleanData } = await import("../firebase");
    await auth.authStateReady(); // wait for auth state just in case

    if (!auth.currentUser) {
      throw new Error("Sessão expirada ou usuário não autenticado no Client.");
    }

    const payload = cleanData({
      clienteId,
      servicoId,
      valorVendaFinal: Number(valorVendaFinal),
      metodoPagamento,
      isBulk,
      quantidade: Number(quantidade) || 1,
      split_comissoes: splitComissoes,
    });

    const result = await processarVendaBackend(payload);
    return result.data as { saleId: string; protocolo: string };
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
  origem?: string;
}) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/consultations/create-pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionAmount: data.valor,
        description: data.descricao,
        clientEmail: data.email,
        requestId: data.vendaId,
      }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha na API de pagamento (Mercado Pago)");
    }
    
    const result = await res.json();
    return {
      id: result.payment_id,
      status: "pending",
      qr_code: result.qr_code,
      qr_code_base64: result.qr_code_base64,
      copy_paste: result.qr_code,
      gateway: "MERCADO_PAGO",
    };
  } catch (error: any) {
    console.error("Erro MP Frontend:", error);
    throw new Error(error.message || "Erro no pagamento MP");
  }
}

export async function gerarPagamentoAsaasFront(data: any) {
  try {
    const { auth } = await import("../firebase");
    
    if (!auth.currentUser) {
      throw new Error("Usuário não autenticado no Client.");
    }
    
    const token = await auth.currentUser.getIdToken(true);
    
    console.log("[vendaService] Iniciando chamada Asaas. Token presente:", !!token);

    const res = await fetch(`${BACKEND_URL}/api/v1/asaas/create-pix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        customerName: data.nome,
        customerEmail: data.email,
        customerCpfCnpj: data.cpf,
        value: data.valor,
        description: data.descricao,
        externalReference: data.vendaId,
      }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Falha na API de pagamento (Asaas)");
    }
    
    const result = await res.json();
    return {
      payment_id: result.payment_id,
      copy_paste: result.qr_code,
      qr_code: result.qr_code,
      qr_code_base64: result.qr_code_base64,
      status: "pending",
      invoice_url: result.invoice_url,
      gateway: "ASAAS",
    };
  } catch (error: any) {
    console.error("Erro Asaas Frontend:", error);
    throw new Error(error.message || "Erro no pagamento Asaas");
  }
}
