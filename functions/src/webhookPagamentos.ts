import { onRequest } from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';

// Inicializa o admin caso ainda não tenha sido inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

export const webhookPagamentos = onRequest(async (req, res) => {
  try {
    const body = req.body;

    // 1. IDENTIFICAÇÃO DO GATEWAY: ASAAS
    if (body.event && body.payment) {
      console.log('Webhook Asaas recebido:', body.event);

      // O Asaas confirma o pagamento com o evento PAYMENT_RECEIVED ou PAYMENT_CONFIRMED
      if (body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED') {
        const paymentId = body.payment.id;
        const value = body.payment.value;

        // Procura o lead que possui este ID de transação salvo
        const leadsSnapshot = await db.collection('leads_diagnostico')
          .where('identificador_pagamento', '==', paymentId)
          .limit(1)
          .get();

        if (!leadsSnapshot.empty) {
          const leadDoc = leadsSnapshot.docs[0];
          await leadDoc.ref.update({
            status_pagamento: 'pago',
            valor_venda: value,
            gateway_usado: 'asaas'
          });

          await enviarNotificacaoAdmin(leadDoc.data(), value, 'Asaas');
        } else {
          console.log(`Lead não encontrado para o pagamento Asaas ID: ${paymentId}`);
        }
      }
      res.status(200).send({ received: true });
      return;
    }

    // 2. IDENTIFICAÇÃO DO GATEWAY: MERCADO PAGO
    if (body.action && body.action.startsWith('payment.')) {
      console.log('Webhook Mercado Pago recebido:', body.action);

      const paymentId = body.data?.id;

      if (body.action === 'payment.created' || body.action === 'payment.updated') {
        // Como o Mercado Pago só envia o ID, precisamos buscar os detalhes usando o Token
        const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        
        if (!mpToken) {
          console.error('MERCADOPAGO_ACCESS_TOKEN não configurado nas variáveis de ambiente.');
          res.status(500).send('Erro de configuração interna');
          return;
        }

        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${mpToken}` }
        });

        if (response.ok) {
          const paymentData = await response.json();

          // Verifica se o status do pagamento está aprovado
          if (paymentData.status === 'approved') {
            const emailCliente = paymentData.payer?.email;
            const value = paymentData.transaction_amount;

            // Busca o lead pelo e-mail associado no formulário
            const leadsSnapshot = await db.collection('leads_diagnostico')
              .where('email', '==', emailCliente)
              .limit(1)
              .get();

            if (!leadsSnapshot.empty) {
              const leadDoc = leadsSnapshot.docs[0];
              await leadDoc.ref.update({
                status_pagamento: 'pago',
                valor_venda: value,
                gateway_usado: 'mercadopago',
                identificador_pagamento: paymentId.toString()
              });

              await enviarNotificacaoAdmin(leadDoc.data(), value, 'Mercado Pago');
            }
          }
        }
      }
      res.status(200).send({ received: true });
      return;
    }

    // Se a chamada não se encaixar em nenhum padrão
    res.status(400).send('Gateway não identificado ou payload inválido');
  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Função auxiliar para disparar e-mail para a equipe admin da Câmara GSA
async function enviarNotificacaoAdmin(leadData: any, valor: number, gateway: string) {
  try {
    const configDoc = await db.collection('configs').doc('notificacoes').get();
    const emailsAdmin = configDoc.data()?.emailsAdmin || [];

    if (emailsAdmin.length === 0) return;

    // Configuração de transporte de e-mail (ajuste com suas credenciais do SMTP/Gmail)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: '"GSA Diagnóstico" <nao-responda@gsa.com>',
      to: emailsAdmin.join(','),
      subject: '🔥 Nova Venda de Diagnóstico Aprovada!',
      html: `
        <h3>Venda Confirmada no Funil</h3>
        <p><strong>Cliente:</strong> ${leadData.nome || 'Não informado'}</p>
        <p><strong>WhatsApp:</strong> ${leadData.whatsapp || 'Não informado'}</p>
        <p><strong>E-mail:</strong> ${leadData.email || 'Não informado'}</p>
        <p><strong>Valor:</strong> R$ ${valor.toFixed(2).replace('.', ',')}</p>
        <p><strong>Gateway:</strong> ${gateway}</p>
        <br/>
        <p>Acesse o painel administrativo da GSA para conferir os detalhes.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('E-mails de notificação enviados com sucesso para os admins.');
  } catch (err) {
    console.error('Erro ao enviar e-mail de notificação:', err);
  }
}
