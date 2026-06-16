import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

async function getSaasAdminConfig() {
    try {
        const saasRef = db.collection("platform_config").doc("saas_settings");
        const saasSnap = await saasRef.get();
        return saasSnap.data() || {};
    } catch (e) {
        console.error("Erro ao obter saas_settings:", e);
        return {};
    }
}

export const handleAsaasWebhook = async (req: any, res: any) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    // --- WEBHOOK SECURITY CHECK ---
    try {
        const config = await getSaasAdminConfig();
        const configuredSecret = config.asaas_webhook_secret || process.env.ASAAS_WEBHOOK_SECRET;
        
        if (configuredSecret) {
            const receivedToken = req.headers['asaas-access-token'];
            if (!receivedToken || receivedToken !== configuredSecret) {
                console.error("[ASAAS_WEBHOOK] [SECURITY] Token de acesso do Webhook inválido ou ausente.");
                return res.status(401).send("Unauthorized Webhook Token");
            }
        } else {
            console.warn("[ASAAS_WEBHOOK] [SECURITY WATCH] Webhook secreto (asaas_webhook_secret) não configurado. Adicione-o para evitar spoofing.");
        }
    } catch (secError) {
        console.error("[ASAAS_WEBHOOK] Erro ao validar regras de segurança do webhook:", secError);
        return res.status(500).send("Security validation failed");
    }

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
