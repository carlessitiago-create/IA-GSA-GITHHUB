


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
    const { functions } = await import('../firebase');
    const { httpsCallable } = await import('firebase/functions');
    const base64Data = await fileToBase64(file);
    const mimeType = file.type;

    const analyzeFn = httpsCallable(functions, 'analyzeDocument');
    const res = await analyzeFn({ base64Data: base64Data.split(',')[1], mimeType });
    return res.data as DocumentAnalysisResult;
  } catch (error: any) {
    console.error("Erro na análise do documento:", error);
    throw new Error("Falha ao analisar o documento. Por favor, tente novamente.");
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
    const { functions } = await import('../firebase');
    const { httpsCallable } = await import('firebase/functions');
    const analyzeFn = httpsCallable(functions, 'analyzeSmartFicha');
    const res = await analyzeFn({ leadData });

    return res.data as TriageResult;
  } catch (error: any) {
    console.error("Erro na triagem da Ficha com IA:", error);
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
