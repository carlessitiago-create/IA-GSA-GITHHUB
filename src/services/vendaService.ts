import { httpsCallable } from "firebase/functions";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, cleanData, functions } from "../firebase";

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
    const { auth } = await import("../firebase");
    await auth.authStateReady();
    const token = await auth.currentUser?.getIdToken(true);

    const gerarPagamento = httpsCallable(functions, "gerarPagamentoPixGateway");
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
  const response = await fetch("/api/asaas/create-pix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: data.nome,
      customerEmail: data.email,
      customerCpfCnpj: data.cpf,
      value: data.valor,
      description: data.descricao,
      externalReference: data.vendaId,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const detailMsg = err.details ? " - Detalhes: " + JSON.stringify(err.details) : "";
    throw new Error(err.error + detailMsg || "Failed to create Asaas payment");
  }

  const result = await response.json();

  // Atualiza o Firestore no frontend, já que bypassamos a Cloud Function
  if (data.vendaId) {
    try {
      const { db } = await import("../firebase");
      const { doc, updateDoc, serverTimestamp } =
        await import("firebase/firestore");
      await updateDoc(doc(db, "sales", data.vendaId), {
        asaas_payment_id: result.payment_id,
        gateway: "ASAAS",
        status_pagamento: "Pendente",
        updated_at: serverTimestamp(),
      });
    } catch (e) {
      console.error("Falha ao atualizar venda no Firestore", e);
    }
  }

  return {
    qr_code_base64: result.qr_code_base64,
    copy_paste: result.qr_code,
    payment_id: result.payment_id,
    invoice_url: result.invoice_url,
  };
}
