import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface WhatsappLog {
  id?: string;
  destinatario: string;
  mensagem: string;
  processo_id?: string;
  status: 'ENVIADO' | 'SIMULADO' | 'FALHADO';
  timestamp: any;
  api_configurada: boolean;
  erro?: string | null;
}

/**
 * Envia uma notificação de WhatsApp através da API do servidor
 */
export async function enviarNotificacaoWhatsApp(to: string, message: string, processoId?: string): Promise<{ success: boolean; sentReal: boolean; error?: string }> {
  if (!to || !message) {
    return { success: false, sentReal: false, error: "Telefone e mensagem são obrigatórios" };
  }
  try {
    const res = await fetch("/api/send-whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to,
        message,
        processoId
      })
    });
    if (!res.ok) {
      const errorData = await res.json();
      return { success: false, sentReal: false, error: errorData.error || "Erro no servidor" };
    }
    const data = await res.json();
    return {
      success: true,
      sentReal: data.sentReal,
      error: data.error
    };
  } catch (error: any) {
    console.error("Erro ao enviar WhatsApp:", error);
    return { success: false, sentReal: false, error: error.message };
  }
}

/**
 * Obtém os logs de envio de WhatsApp salvos no Firestore
 */
export async function listarLogsWhatsApp(processoId?: string): Promise<WhatsappLog[]> {
  try {
    const logsRef = collection(db, 'whatsapp_logs');
    let q = query(logsRef, orderBy('timestamp', 'desc'));

    if (processoId) {
      q = query(logsRef, where('processo_id', '==', processoId), orderBy('timestamp', 'desc'));
    }

    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as WhatsappLog));
  } catch (error: any) {
    // If composite index is missing, fallback to unordered query and sort in memory
    if (error?.message?.includes("index") || error?.code === "failed-precondition") {
       try {
         const logsRef = collection(db, 'whatsapp_logs');
         let q = query(logsRef);
         if (processoId) {
           q = query(logsRef, where('processo_id', '==', processoId));
         }
         const snap = await getDocs(q);
         const logs = snap.docs.map(doc => ({
           id: doc.id,
           ...doc.data()
         } as WhatsappLog));
         return logs.sort((a,b) => {
           const tA = a.timestamp?.seconds || 0;
           const tB = b.timestamp?.seconds || 0;
           return tB - tA;
         });
       } catch (fallbackErr) {
          console.error("Fallback whatsapp logs error:", fallbackErr);
          return [];
       }
    }
    console.error("Erro ao listar logs do WhatsApp:", error);
    return [];
  }
}
