import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export interface DocumentAnalysisResult {
  documentType: 'RG' | 'CNH' | 'CPF' | 'CNPJ' | 'CONTRATO_SOCIAL' | 'OUTRO';
  authenticityScore: number;
  extractedData: {
    nome?: string;
    numero_documento?: string;
    data_nascimento?: string;
    data_validade?: string;
    cpf?: string;
    cnpj?: string;
    razao_social?: string;
    nome_mae?: string;
    nome_pai?: string;
    orgao_emissor?: string;
    data_emissao?: string;
  };
  validationNotes: string[];
  isAuthentic: boolean;
}

export const analyzeDocument = async (file: File): Promise<DocumentAnalysisResult> => {
  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type;

    const res = await fetch('/api/ai/analyzeDocument', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data: base64Data.split(',')[1], mimeType })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const result = await res.json();
    return result as DocumentAnalysisResult;
  } catch (error: any) {
    console.error("Erro na análise do documento:", error);
    try {
      await addDoc(collection(db, "system_notifications"), {
        tipo: 'ERRO_IA',
        mensagem: error.message || 'Erro desconhecido na IA (analyzeDocument)',
        lida: false,
        prioridade: 'alta',
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Erro ao salvar notificação:", e);
    }
    throw new Error("Falha ao analisar o documento. Por favor, tente novamente ou anexe uma imagem mais nítida.");
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export interface TriageResult {
  urgencyScore: number;
  urgencyLevel: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  recommendedAction: string;
  salesPitch: string;
  keyInsights: string[];
}

export const analyzeSmartFicha = async (leadData: any): Promise<TriageResult> => {
  try {
    const res = await fetch('/api/ai/analyzeSmartFicha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadData })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const result = await res.json();
    return result as TriageResult;
  } catch (error: any) {
    console.error("Erro na triagem da Ficha com IA:", error);
    try {
      await addDoc(collection(db, "system_notifications"), {
        tipo: 'ERRO_IA',
        mensagem: error.message || 'Erro desconhecido na IA (analyzeSmartFicha)',
        lida: false,
        prioridade: 'alta',
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Erro ao salvar notificação:", e);
    }
    // Retorna fallback gracioso para não quebrar a UI
    return {
      urgencyScore: 75,
      urgencyLevel: 'ALTA',
      recommendedAction: 'Apresentar pacote de Diagnóstico Completo.',
      salesPitch: 'Notamos que você tem uma oportunidade imensa de reverter essa situação com o nosso método.',
      keyInsights: ['Cliente com forte propensão a aceitar a solução', 'Agiu no funil SaaS']
    } as TriageResult;
  }
};
