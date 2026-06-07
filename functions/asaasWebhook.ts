import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export const handleAsaasWebhook = async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { event, payment } = req.body;
    console.log(`[ASAAS_WEBHOOK] Event received: ${event}`);

    try {
        if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) {
            return res.status(200).send("Ignored");
        }

        const externalReference = payment.externalReference;
        if (!externalReference) {
            console.error("[ASAAS_WEBHOOK] No externalReference found.");
            return res.status(400).send("Missing externalReference");
        }

        // 1. Atualizar o lead/cliente no Firestore
        // O user quer atualizar 'contratou_reuniao: true'
        const leadRef = db.collection('clients').doc(externalReference);
        await leadRef.update({
            contratou_reuniao: true,
            status_pagamento: 'Pago',
            status_updated_by: 'system',
            updated_at: FieldValue.serverTimestamp()
        });
        console.log(`[ASAAS_WEBHOOK] Lead ${externalReference} updated.`);

        // 2. Disparar lógica de agendamento via WhatsApp
        const leadDoc = await leadRef.get();
        const leadData = leadDoc.data();
        
        if (leadData && leadData.whatsapp) {
            console.log(`[ASAAS_WEBHOOK] Disparando agendamento via WhatsApp para ${leadData.whatsapp}`);
            // Aqui eu implementaria a chamada para a API de WhatsApp
            // Como não tenho a API específica, vou apenas logar
        }

        res.status(200).send("OK");
    } catch (error) {
        console.error("[ASAAS_WEBHOOK] Error processing webhook:", error);
        res.status(500).send("Internal Server Error");
    }
};
