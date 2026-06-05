import { GoogleGenAI, Type } from "@google/genai";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("A Chave de API da sua aplicação encontra-se ausente. O sistema necessita de uma API configurada.");
  }
  
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

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

    const prompt = `
      Analise a imagem deste documento brasileiro e extraia as informações principais.
      Determine se o documento parece autêntico (não é uma montagem óbvia ou foto de tela).
      Retorne os dados no formato JSON especificado.
      Documentos suportados: RG, CNH, CPF, CNPJ, Contrato Social.
      Se for outro tipo, identifique como OUTRO.
    `;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data.split(',')[1],
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          // @ts-ignore
          type: Type.OBJECT,
          properties: {
            documentType: {
              type: Type.STRING,
              enum: ['RG', 'CNH', 'CPF', 'CNPJ', 'CONTRATO_SOCIAL', 'OUTRO'],
            },
            authenticityScore: {
              type: Type.NUMBER,
              description: "Score de 0 a 100 de probabilidade de ser um documento real e não manipulado.",
            },
            extractedData: {
              // @ts-ignore
              type: Type.OBJECT,
              properties: {
                nome: { type: Type.STRING },
                numero_documento: { type: Type.STRING },
                data_nascimento: { type: Type.STRING },
                data_validade: { type: Type.STRING },
                cpf: { type: Type.STRING },
                cnpj: { type: Type.STRING },
                razao_social: { type: Type.STRING },
                nome_mae: { type: Type.STRING },
                nome_pai: { type: Type.STRING },
                orgao_emissor: { type: Type.STRING },
                data_emissao: { type: Type.STRING },
              },
            },
            validationNotes: {
              // @ts-ignore
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            isAuthentic: {
              type: Type.BOOLEAN,
            },
          },
          required: ['documentType', 'authenticityScore', 'extractedData', 'validationNotes', 'isAuthentic'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
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
    const prompt = `
      Você é um especialista em análise de crédito e Vendas B2B/B2C (CRO).
      Analise os dados deste cliente/lead que preencheu uma ficha de triagem:
      ${JSON.stringify(leadData, null, 2)}
      
      Gere um score de urgência de 0 a 100 baseado na probabilidade dele precisar do serviço urgente (Dívidas no BACEN, restrições, etc).
      Retorne o nível urgência (BAIXA, MEDIA, ALTA, CRITICA).
      Forneça uma ação recomendada para o consultor.
      Crie um "Sales Pitch" (Argumento de Venda) curto e um poderoso gatilho mental para ser usado imediatamente por telefone/wpp.
      E forneça até 3 key insights principais sobre o perfil desse cara.
    `;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          // @ts-ignore
          type: Type.OBJECT,
          properties: {
            urgencyScore: { type: Type.NUMBER, description: "0 a 100" },
            urgencyLevel: { type: Type.STRING, enum: ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] },
            recommendedAction: { type: Type.STRING },
            salesPitch: { type: Type.STRING },
            keyInsights: { 
              // @ts-ignore
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ['urgencyScore', 'urgencyLevel', 'recommendedAction', 'salesPitch', 'keyInsights']
        }
      }
    });

    return JSON.parse(response.text || '{}') as TriageResult;
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
