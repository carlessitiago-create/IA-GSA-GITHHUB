import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, cleanData } from '../firebase';

export interface AppNotification {
  id?: string;
  usuario_id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  tipo: 'STATUS_CHANGE' | 'BONUS' | 'NEW_LEAD' | 'SYSTEM' | 'SALE' | 'REFERRAL' | 'PROCESS' | 'FINANCIAL';
  timestamp: any;
  vendedor_id?: string;
  gestor_id?: string;
  analista_id?: string;
  visibilidade_uids?: string[];
}

export function listenToNotifications(userId: string, userRole: string, callback: (notifications: AppNotification[]) => void) {
  if (!auth.currentUser) {
    console.warn("Attempted to listen to notifications without an active session.");
    return () => {};
  }

  let q;
  if (userRole === 'ADM_MASTER' || userRole === 'ADM_GERENTE') {
    // ADMs see everything
    q = query(
      collection(db, 'notifications'),
      orderBy('timestamp', 'desc')
    );
  } else {
    // Others see their own or those where they are in visibilidade_uids
    // Note: We use array-contains for visibilidade_uids
    q = query(
      collection(db, 'notifications'),
      where('visibilidade_uids', 'array-contains', userId)
      // Removed orderBy('timestamp', 'desc') to avoid needing composite index
    );
  }

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
    items.sort((a, b) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? a.timestamp : 0);
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? b.timestamp : 0);
      return timeB - timeA;
    });
    callback(items);
  }, (error) => {
    // If user is logged out, ignore permission errors as they are expected during cleanup
    if (error.code === 'permission-denied' && !auth.currentUser) {
      return;
    }
    handleFirestoreError(error, OperationType.GET, 'notifications');
  });
}

export async function sendNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'lida'>) {
  try {
    const visibilidade_uids = [notification.usuario_id];
    let toEmail = '';
    let toName = 'Usuário';
    
    // Fetch user profile to get hierarchy if not provided or to ensure it's complete
    const userDoc = await getDoc(doc(db, 'usuarios', notification.usuario_id));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      toEmail = userData.email || '';
      toName = userData.nome || 'Usuário';
      
      // If user is CLIENTE
      if (userData.nivel === 'CLIENTE') {
        // Add their VENDEDOR/GESTOR (id_superior)
        if (userData.id_superior) {
          if (!visibilidade_uids.includes(userData.id_superior)) {
            visibilidade_uids.push(userData.id_superior);
          }
          
          // If id_superior is a VENDEDOR, also add their GESTOR
          const superiorDoc = await getDoc(doc(db, 'usuarios', userData.id_superior));
          if (superiorDoc.exists()) {
            const superiorData = superiorDoc.data();
            if (superiorData.id_superior && !visibilidade_uids.includes(superiorData.id_superior)) {
              visibilidade_uids.push(superiorData.id_superior);
            }
          }
        }
      } 
      // If user is VENDEDOR
      else if (userData.nivel === 'VENDEDOR') {
        // Add their GESTOR (id_superior)
        if (userData.id_superior && !visibilidade_uids.includes(userData.id_superior)) {
          visibilidade_uids.push(userData.id_superior);
        }
      }
    }

    // Add explicit IDs if provided in the notification object (override/supplement)
    if (notification.vendedor_id && !visibilidade_uids.includes(notification.vendedor_id)) {
      visibilidade_uids.push(notification.vendedor_id);
    }
    if (notification.gestor_id && !visibilidade_uids.includes(notification.gestor_id)) {
      visibilidade_uids.push(notification.gestor_id);
    }
    if (notification.analista_id && !visibilidade_uids.includes(notification.analista_id)) {
      visibilidade_uids.push(notification.analista_id);
    }

    await addDoc(collection(db, 'notifications'), cleanData({
      ...notification,
      visibilidade_uids,
      lida: false,
      timestamp: serverTimestamp()
    }));

    // Envios de E-mail: Dispara notificação por e-mail para o usuário direto (se tiver e-mail)
    if (toEmail) {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: toEmail,
            subject: notification.titulo,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Olá, ${toName}</h2>
                <p>${notification.mensagem}</p>
                <hr style="margin-top:20px; margin-bottom:20px; border:none; border-top:1px solid #eee;"/>
                <p style="font-size: 12px; color: #999;">Esta é uma mensagem automática. Por favor, não responda.</p>
              </div>
            `
          })
        });
      } catch (err) {
        console.error('Falha ao enviar e-mail de notificação:', err);
      }
    }

  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notifications');
  }
}

export async function markAsRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      lida: true
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export const notificarConclusaoFicha = async (processo: any, nomeCliente: string) => {
  await sendNotification({
    usuario_id: processo.vendedor_id,
    titulo: "📄 Ficha Técnica Concluída",
    mensagem: `O cliente ${nomeCliente} finalizou o preenchimento da ficha para o serviço ${processo.servico_nome}.`,
    tipo: 'PROCESS',
    vendedor_id: processo.vendedor_id,
    gestor_id: processo.gestor_id
  });
};

export const notificarPendenciaFicha = async (processo: any, clienteId: string, totalCampos: number, totalDocs: number) => {
  const total = totalCampos + totalDocs;
  if (total === 0) return;

  const mensagem = `O processo #${processo.protocolo} (${processo.servico_nome}) possui ${total} pendências ativas (${totalCampos} dados e ${totalDocs} documentos). Por favor, complete sua ficha técnica para darmos andamento.`;

  // Notifica o Cliente (o sendNotification adicionará vendedor/gestor na visibilidade)
  await sendNotification({
    usuario_id: clienteId,
    titulo: "⚠️ Pendências na Ficha Técnica",
    mensagem: mensagem,
    tipo: 'PROCESS',
    vendedor_id: processo.vendedor_id,
    gestor_id: processo.gestor_id
  });
};

export const notificarPendenciaManual = async (processo: any, clienteId: string, descricao: string) => {
  const mensagem = `O processo #${processo.protocolo} (${processo.servico_nome}) possui uma nova pendência: ${descricao}. Por favor, verifique os detalhes no seu portal.`;

  await sendNotification({
    usuario_id: clienteId,
    titulo: "🚨 Pendência Identificada",
    mensagem: mensagem,
    tipo: 'PROCESS',
    vendedor_id: processo.vendedor_id,
    gestor_id: processo.gestor_id
  });
};

export const notificarAjudaFicha = async (processo: any, clienteNome: string) => {
  await sendNotification({
    usuario_id: processo.vendedor_id,
    titulo: "🆘 Pedido de Ajuda: Ficha Técnica",
    mensagem: `O cliente ${clienteNome} solicitou ajuda para completar a ficha técnica do processo #${processo.protocolo}.`,
    tipo: 'PROCESS',
    vendedor_id: processo.vendedor_id,
    gestor_id: processo.gestor_id
  });
};

export const notificarStatusProcesso = async (processo: any, novoStatus: string) => {
  const mensagem = `O status do processo #${processo.protocolo} (${processo.servico_nome}) foi alterado para: ${novoStatus}.`;
  
  await sendNotification({
    usuario_id: processo.cliente_id,
    titulo: "📊 Atualização de Status",
    mensagem: mensagem,
    tipo: 'PROCESS',
    vendedor_id: processo.vendedor_id,
    gestor_id: processo.id_superior || processo.gestor_id,
    analista_id: processo.analista_id
  });
};

export const notificarNovaPendencia = async (processo: any, descricao: string) => {
  const mensagem = `Uma nova pendência foi registrada no processo #${processo.protocolo}: ${descricao}. Por favor, verifique as ações necessárias.`;
  
  await sendNotification({
    usuario_id: processo.cliente_id,
    titulo: "⚠️ Nova Pendência",
    mensagem: mensagem,
    tipo: 'PROCESS',
    vendedor_id: processo.vendedor_id,
    gestor_id: processo.id_superior || processo.gestor_id,
    analista_id: processo.analista_id
  });
};

export const playCriticalNotificationSound = () => {
  const criticalSound = 'https://assets.mixkit.co/active_storage/sfx/2190/2190-preview.mp3'; // Siren/Alarm
  const audio = new Audio(criticalSound);
  audio.play().catch(e => console.log('Audio play blocked:', e));
};

export const playNotificationSound = (type: 'BONUS' | 'STATUS_CHANGE' | 'DEFAULT') => {
  const bonusSound = 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'; // Coin/Vault
  const notifySound = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'; // Bell/Chime
  
  const url = type === 'BONUS' ? bonusSound : notifySound;
  const audio = new Audio(url);
  audio.play().catch(e => console.log('Audio play blocked:', e));
};
