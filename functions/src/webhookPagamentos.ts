import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { MercadoPagoConfig, Payment } from "mercadopago";
import * as nodemailer from "nodemailer";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore();

// Helper para inicializar o cliente do Mercado Pago v2
const getMPClient = async () => {
  const configDoc = await db.collection("platform_settings").doc("saas").get();
  const mpAccessToken = configDoc.data()?.mercadopago_access_token;
  if (!mpAccessToken) {
    throw new Error("Token do Mercado Pago não configurado no Firestore.");
  }
  const client = new MercadoPagoConfig({
    accessToken: mpAccessToken,
    options: { timeout: 5000 },
  });
  return {
    client,
    payment: new Payment(client),
  };
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: "teu-email@gmail.com", pass: "tua-senha-de-app" },
});

export const webhookPagamentos = onRequest(
  { invoker: "public" },
  async (req: any, res: any) => {
    try {
      const body = req.body;
      let gateway = "";
      let status = "";
      let valor = 0;
      let email = "";
      let transactionId = "";

      // 1. Identificar gateway pelo payload
      if (body?.payment?.id !== undefined || body?.event?.includes("PAYMENT")) {
        // Padrão Asaas
        gateway = "asaas";
        const asaasPayment = body?.payment;
        transactionId = String(asaasPayment?.id);
        valor = asaasPayment?.value || 0;

        if (
          asaasPayment?.status === "RECEIVED" ||
          asaasPayment?.status === "CONFIRMED"
        ) {
          status = "aprovado";
        } else {
          status = "pendente";
        }

        email = asaasPayment?.customerEmail || req.query.email || ""; // fallback
      } else if (
        body?.data?.id ||
        body?.type === "payment" ||
        req.query["data.id"]
      ) {
        // Padrão Mercado Pago
        gateway = "mercadopago";
        transactionId = body?.data?.id || body?.id || req.query["data.id"];

        if (transactionId) {
          // No Mercado Pago o payload completo não vem no webhook, então buscamos via API
          const { payment: mpPayment } = await getMPClient();
          const paymentInfo = await mpPayment.get({
            id: String(transactionId),
          });
          status = paymentInfo.status === "approved" ? "aprovado" : "pendente";
          valor = paymentInfo.transaction_amount || 0;
          email = paymentInfo.payer?.email || "";
        }
      } else {
        return res.status(400).send({ error: "Gateway não identificado" });
      }

      // 2. Extrair Status e Email
      if (!email) {
        // Se não encontrou email, aborta pra não bugar buscaremos o lead
        console.log("Email não encontrado no payload de", gateway);
        return res.status(200).send("Ignorado - Sem Email associado");
      }

      // 3. Verifica se foi pago e atualiza
      if (status === "aprovado" || status === "pago") {
        console.log(`Buscando lead com email: ${email}`);
        const leadsRef = db.collection("leads");
        const querySnapshot = await leadsRef.where("email", "==", email).get();

        if (!querySnapshot.empty) {
          for (const doc of querySnapshot.docs) {
            const leadData = doc.data();
            const pacote = leadData.pacote_escolhido || "Pacote Padrão";

            // Atualiza Lead
            await doc.ref.update({
              status_pagamento: "pago",
              gateway_usado: gateway,
              identificador_pagamento: transactionId,
              updatedAt: FieldValue.serverTimestamp(),
            });

            // Trigger Meta Conversions API Backend-to-Backend
            try {
              const saasDoc = await db.collection("configs").doc("saas_settings").get();
              if (saasDoc.exists) {
                const saasConfig = saasDoc.data();
                const token = saasConfig?.meta_conversions_token;
                const pixelId = saasConfig?.facebook_pixel_id || (saasConfig?.meta_pixel_code ? saasConfig.meta_pixel_code.match(/fbq\('init',\s*'(\d+)'\)/)?.[1] : null);
                
                if (token && pixelId) {
                  const url = `https://graph.facebook.com/v19.0/${pixelId}/events`;
                  // Use crypto for hashing
                  const crypto = require("crypto");
                  const hashData = (val: string) => {
                    if (!val) return "";
                    return crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
                  };

                  let em = leadData.email ? hashData(leadData.email) : undefined;
                  let ph = leadData.whatsapp ? hashData(leadData.whatsapp.replace(/\D/g, "")) : undefined;

                  const payload = {
                    data: [
                      {
                        event_name: "Purchase",
                        event_time: Math.floor(Date.now() / 1000),
                        action_source: "website",
                        event_source_url: "https://plataforma-gsa.com.br", // fallback if no specific URL
                        user_data: { em, ph },
                        custom_data: {
                          value: valor || leadData.valor_venda,
                          currency: "BRL",
                          content_name: pacote
                        }
                      }
                    ]
                  };

                  const response = await fetch(url, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                  });
                  const jsonResp = await response.json();
                  if (!response.ok) {
                    console.error("Meta CAPI Error in webhook:", JSON.stringify(jsonResp));
                  } else {
                    console.log("Meta CAPI Purchase Sent Successfully in webhook");
                  }
                }
              }
            } catch (capiError) {
              console.error("Erro disparando Meta CAPI no Webhook:", capiError);
            }

            // 4. Buscar configs e notificar
            const configSnap = await db
              .collection("configs")
              .doc("notificacoes")
              .get();
            const emailsAdmin: string[] = configSnap.exists
              ? configSnap.data()?.emails_admin || []
              : [];

            if (emailsAdmin.length > 0) {
              const mailOptions = {
                from: '"GSA Diagnóstico" <noreply@camaragsa.com.br>',
                to: emailsAdmin.join(", "),
                subject: "Venda Aprovada! 🚀",
                text: `Venda Aprovada! Pacote: ${pacote}, Valor: R$ ${valor}, Gateway: ${gateway}`,
              };

              try {
                await transporter.sendMail(mailOptions);
                console.log("E-mail de notificação enviado para admins");
              } catch (err) {
                console.error("Erro ao enviar e-mail:", err);
              }
            }
          }
        } else {
          console.log(`Nenhum lead pendente encontrado com o e-mail: ${email}`);
        }
      }

      return res.status(200).send("OK");
    } catch (error) {
      console.error("Erro no webhookPagamentos:", error);
      return res.status(500).send("Erro interno no webhook");
    }
  },
);
