import { collection, getDocs, writeBatch, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export async function wipeSystemData(onProgress?: (msg: string) => void) {
  const collectionsToWipe = [
    'leads',
    'clients',
    'order_processes',
    'status_history',
    'sales',
    'bulk_sales_batches',
    'wallets',
    'financial_transactions',
    'pendencies',
    'conflict_logs',
    'pendency_audit_logs',
    'proposals',
    'reward_requests',
    'points_history',
    'point_transactions',
    'documento_locks',
    'notifications',
    'sent_notifications',
    'referrals',
    'showcase_leads',
  ];

  try {
    // Apagar tickets e suas mensagens (subcoleção)
    if (onProgress) onProgress('Excluindo tickets e mensagens...');
    const ticketsSnapshot = await getDocs(collection(db, 'tickets'));
    for (const ticketDoc of ticketsSnapshot.docs) {
      const messagesSnapshot = await getDocs(collection(db, 'tickets', ticketDoc.id, 'messages'));
      const batch = writeBatch(db);
      messagesSnapshot.docs.forEach((msg) => {
        batch.delete(msg.ref);
      });
      batch.delete(ticketDoc.ref);
      await batch.commit();
    }

    // Apagar as outras coleções
    for (const collName of collectionsToWipe) {
      if (onProgress) onProgress(`Excluindo ${collName}...`);
      const snapshot = await getDocs(collection(db, collName));
      
      // Batch operation in chunks of 500 (Firestore limit)
      let chunks = [];
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        chunks.push(snapshot.docs.slice(i, i + 500));
      }
      
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    }

    if (onProgress) onProgress('Limpeza finalizada com sucesso.');
    return true;
  } catch (error) {
    console.error('Erro ao realizar wipe do sistema', error);
    throw error;
  }
}
