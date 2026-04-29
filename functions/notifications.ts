import * as firestore from 'firebase-functions/v2/firestore';
import * as scheduler from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp();
}

async function getUserEmail(uid: string): Promise<string | undefined> {
    const userDoc = await admin.firestore().collection('usuarios').doc(uid).get();
    return userDoc.data()?.email;
}

async function getAdminEmails(): Promise<string[]> {
    const adminDocs = await admin.firestore().collection('usuarios')
        .where('nivel', '==', 'ADM_MASTER').get();
    return adminDocs.docs.map(doc => doc.data().email).filter(Boolean);
}

// Helper to read notification settings
async function isNotificationEnabled(type: string): Promise<boolean> {
    const configDoc = await admin.firestore().collection('config').doc('notification_settings').get();
    const settings = configDoc.data() || {};
    return settings[type] !== false; // Enable by default
}

// Helper to send email
async function sendNotificationEmail(to: string, subject: string, text: string, html: string) {
    const url = process.env.APP_URL || 'http://localhost:3000';
    try {
        await fetch(`${url}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, subject, text, html })
        });
        
        // Log notification
        await admin.firestore().collection('sent_notifications').add({
            to,
            subject,
            text,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error(`Erro ao disparar notificação para ${to}:`, e);
    }
}

// 1. Sale Created (Existing)
export const onSaleCreated = firestore.onDocumentCreated('sales/{vendaId}', async (event) => {
  if (!(await isNotificationEnabled('sale'))) return;
  const vendaData = event.data?.data();
  if (!vendaData) return;
  const { vendedor_id, id_superior, valor_total } = vendaData;
  const vendaId = event.params.vendaId;

  const emailsToNotify: string[] = [...await getAdminEmails()];
  if (id_superior) {
      const gestorEmail = await getUserEmail(id_superior);
      if (gestorEmail) emailsToNotify.push(gestorEmail);
  }
  if (vendedor_id) {
      const sellerEmail = await getUserEmail(vendedor_id);
      if (sellerEmail) emailsToNotify.push(sellerEmail);
  }

  for (const email of [...new Set(emailsToNotify)]) {
      await sendNotificationEmail(email, 'Nova Venda', `Nova venda ${vendaId}!`, `<p>Nova venda ${vendaId} realizada!</p>`);
  }
});

// 2. Referral Created
export const onReferralCreated = firestore.onDocumentCreated('referrals/{referralId}', async (event) => {
    if (!(await isNotificationEnabled('referral'))) return;
    const refData = event.data?.data();
    if (!refData) return;
    const { vendedor_id } = refData;
    
    const emailsToNotify: string[] = [...await getAdminEmails()];
    if (vendedor_id) {
        const sellerEmail = await getUserEmail(vendedor_id);
        if (sellerEmail) emailsToNotify.push(sellerEmail);
    }
    
    for (const email of [...new Set(emailsToNotify)]) {
        await sendNotificationEmail(email, 'Nova Indicação', 'Nova indicação recebida!', '<p>Nova indicação recebida no sistema!</p>');
    }
});

// 3. Payment Update (Success)
export const onSaleUpdated = firestore.onDocumentUpdated('sales/{vendaId}', async (event) => {
    if (!(await isNotificationEnabled('payment'))) return;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData) return;

    if (beforeData.status_pagamento !== 'Pago' && afterData.status_pagamento === 'Pago') {
        const { vendedor_id, id_superior } = afterData;
        const emailsToNotify: string[] = [...await getAdminEmails()];
        
        if (id_superior) {
            const gestorEmail = await getUserEmail(id_superior);
            if (gestorEmail) emailsToNotify.push(gestorEmail);
        }
        if (vendedor_id) {
            const sellerEmail = await getUserEmail(vendedor_id);
            if (sellerEmail) emailsToNotify.push(sellerEmail);
        }

        for (const email of [...new Set(emailsToNotify)]) {
            await sendNotificationEmail(email, 'Pagamento Confirmado', 'Pagamento recebido!', '<p>Pagamento recebido com sucesso!</p>');
        }
    }
});

// 4. Payment Overdue (Cron Job)
export const checkOverduePayments = scheduler.onSchedule('every 24 hours', async (event) => {
    if (!(await isNotificationEnabled('overdue'))) return;
    const overdueSales = await admin.firestore().collection('sales')
        .where('status_pagamento', '==', 'Pendente')
        .where('data_vencimento', '<', admin.firestore.Timestamp.now())
        .get();

    for (const doc of overdueSales.docs) {
        const saleData = doc.data();
        const { vendedor_id, id_superior } = saleData;
        const emailsToNotify: string[] = [...await getAdminEmails()];
        
        if (id_superior) {
            const gestorEmail = await getUserEmail(id_superior);
            if (gestorEmail) emailsToNotify.push(gestorEmail);
        }
        if (vendedor_id) {
            const sellerEmail = await getUserEmail(vendedor_id);
            if (sellerEmail) emailsToNotify.push(sellerEmail);
        }

        for (const email of [...new Set(emailsToNotify)]) {
            await sendNotificationEmail(email, 'Pagamento em Atraso', 'Pagamento em atraso detectado!', `<p>A venda ${doc.id} está com pagamento em atraso.</p>`);
        }
    }
});
