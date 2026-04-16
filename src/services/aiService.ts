import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Configuração de IA Pendente: A Chave de API (GEMINI_API_KEY) não foi encontrada no ambiente.");
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
  } catch (error) {
    console.error("Erro na análise do documento:", error);
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
