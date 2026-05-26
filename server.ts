import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Load config consistently from workspace root
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let config: any = {};
  if (fs.existsSync(configPath)) {
      try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (err) {
          console.error("[INIT] Failed to parse firebase-applet-config.json", err);
      }
  }

  app.use(cors({ origin: true }));
  app.use(express.json());

  app.post("/api/send-email", async (req, res) => {
    // ... existing email code ...
    const { to, subject, text, html } = req.body;
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.FROM_EMAIL;
    if (!host || !port || !user || !pass || !from) {
        return res.status(500).json({ error: "SMTP configuration missing" });
    }
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: { user, pass },
    });
    try {
        await transporter.sendMail({ from, to, subject, text, html });
        res.json({ success: true });
    } catch (e: any) {
        console.error("Email error:", e);
        let errorMsg = e.message || "Failed to send email";
        if (errorMsg.includes("535-5.7.8")) {
            errorMsg = "Erro de Autenticação de E-mail (535-5.7.8): As credenciais (usuário/senha) foram recusadas. Se você estiver usando o Gmail, por favor, gere uma 'Senha de App' (App Password) nas configurações de segurança da sua conta Google e atualize a variável SMTP_PASS nas configurações do projeto.";
        }
        res.status(500).json({ error: errorMsg });
    }
  });

  // --- BEGIN MERCADO PAGO API ---
  app.post("/api/consultations/create-pix", async (req, res) => {
    try {
      const { transactionAmount, description, clientEmail, requestId } = req.body;

      if (!transactionAmount) {
        return res.status(400).json({ error: "Parâmetros obrigatórios em falta (transactionAmount)" });
      }

      const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!mpAccessToken) {
          console.warn("MERCADOPAGO_ACCESS_TOKEN não configurado no .env");
          return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado no backend." });
      }

      const { MercadoPagoConfig, Payment } = await import('mercadopago');
      const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });

      // 1. Criar a intenção de pagamento no Mercado Pago
      const payment = new Payment(mpClient);
      const paymentResponse = await payment.create({
        body: {
          transaction_amount: Number(transactionAmount),
          description: description || `Consulta GSA`,
          payment_method_id: 'pix',
          payer: {
            email: clientEmail || 'cliente@gsa.com.br',
          },
          external_reference: requestId || undefined,
        }
      });

      // 2. Retornar os dados do QR Code
      res.json({
        success: true,
        payment_id: paymentResponse.id?.toString(),
        qr_code: paymentResponse.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: paymentResponse.point_of_interaction?.transaction_data?.qr_code_base64,
      });

    } catch (error: any) {
      console.error('Erro ao gerar PIX:', error);
      res.status(500).json({ error: error.message || 'Falha ao processar o pagamento.' });
    }
  });


  // --- END MERCADO PAGO API ---

  // --- BEGIN DIRECT ADMIN API ---
  // Administrative API endpoints removed in favor of client-side operations (writeBatch)
  // which handle permissions correctly via the user's authenticated context.
  // --- END DIRECT ADMIN API ---

  // --- BEGIN ASAAS API ---
  app.post("/api/asaas/create-pix", async (req, res) => {
    try {
      const { customerName, customerCpfCnpj, value, description, externalReference } = req.body;
      const asaasKey = process.env.ASAAS_API_KEY;

      if (!asaasKey) {
        return res.status(500).json({ error: "ASAAS_API_KEY não configurada." });
      }

      if (!value || !customerCpfCnpj || !customerName) {
        return res.status(400).json({ error: "Parâmetros obrigatórios faltando para Asaas" });
      }

      const fetch = (await import('node-fetch')).default;
      const baseUrl = 'https://sandbox.asaas.com/api/v3'; // or api.asaas.com

      // 1. Create or Find Customer
      const getCustomerUrl = `${baseUrl}/customers?cpfCnpj=${customerCpfCnpj}`;
      const customerRes = await fetch(getCustomerUrl, {
        headers: { access_token: asaasKey }
      });
      const customerJson = await customerRes.json() as any;
      
      let customerId = '';
      if (customerJson.data && customerJson.data.length > 0) {
        customerId = customerJson.data[0].id;
      } else {
        const createCustomerRes = await fetch(`${baseUrl}/customers`, {
          method: 'POST',
          headers: {
             'access_token': asaasKey,
             'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: customerName,
            cpfCnpj: customerCpfCnpj
          })
        });
        const newCustomerJson = await createCustomerRes.json() as any;
        customerId = newCustomerJson.id;
      }

      if (!customerId) {
        return res.status(500).json({ error: "Falha ao obter ou criar customer no Asaas" });
      }

      // 2. Create Payment
      const createPaymentRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers: {
             'access_token': asaasKey,
             'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: 'PIX',
          value: Number(value),
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days
          description: description || "Honorários GSA",
          externalReference: externalReference
        })
      });

      const paymentJson = await createPaymentRes.json() as any;
      if (!paymentJson.id) {
         return res.status(500).json({ error: "Falha ao criar pagamento no Asaas", details: paymentJson });
      }

      // 3. Get Pix QR Code
      const pixQrRes = await fetch(`${baseUrl}/payments/${paymentJson.id}/pixQrCode`, {
        headers: { access_token: asaasKey }
      });
      const pixQrJson = await pixQrRes.json() as any;

      res.json({
        success: true,
        payment_id: paymentJson.id,
        qr_code: pixQrJson.payload,
        qr_code_base64: pixQrJson.encodedImage,
      });

    } catch (error: any) {
      console.error('Erro na API Asaas:', error);
      res.status(500).json({ error: error.message || 'Falha ao processar pagamento via Asaas.' });
    }
  });

  app.post("/api/asaas/webhook", async (req, res) => {
    try {
      const event = req.body;
      console.log('Asaas Webhook received:', event.event);

      // We handle PAYMENT_RECEIVED or PAYMENT_CONFIRMED
      if (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED') {
         const payment = event.payment;
         const externalReference = payment.externalReference;
         
         if (externalReference) {
           // We expect externalReference to be the Firebase Lead ID
           const admin = await import('firebase-admin');
           if (!admin.apps.length) {
              const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
              if (fs.existsSync(serviceAccountPath)) {
                const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                admin.initializeApp({ credential: admin.credential.cert(sa) });
              } else {
                admin.initializeApp();
              }
           }
           
           const db = admin.firestore();
           const leadRef = db.collection('leads_credito').doc(externalReference);
           const leadDoc = await leadRef.get();

           if (leadDoc.exists) {
             const lead = leadDoc.data();
             
             await leadRef.update({
               'dadosPagamentoAsaas.statusPagamento': 'RECEIVED',
               'status': 'analise_tecnica' // Transita para analise_tecnica
             });

             console.log(`Asaas Payment success for lead ${externalReference}. Status updated to analise_tecnica.`);

             // 2. Disparar Notificação por E-mail (GSA Crédito)
             if (lead?.dadosEmpresa?.email) {
                 try {
                     const nodemailer = await import('nodemailer');
                     const transporter = nodemailer.createTransport({
                         host: process.env.SMTP_HOST,
                         port: Number(process.env.SMTP_PORT) || 587,
                         secure: false, // true for 465, false for other ports
                         auth: {
                             user: process.env.SMTP_USER,
                             pass: process.env.SMTP_PASS,
                         },
                     });

                     await transporter.sendMail({
                         from: process.env.FROM_EMAIL || '"GSA Soluções" <no-reply@gsasolucoes.com.br>',
                         to: lead.dadosEmpresa.email,
                         subject: "Confirmação de Pagamento - GSA Soluções",
                         text: `Olá, da equipe GSA Soluções.\n\nConfirmamos o recebimento do seu PIX. Seu projeto de crédito para a empresa ${lead.dadosEmpresa.razaoSocial || lead.dadosEmpresa.cnpj} já foi encaminhado para a mesa de análise.`,
                         html: `<b>Olá!</b><br><br>Confirmamos o recebimento do seu PIX. Seu projeto de crédito para a empresa <b>${lead.dadosEmpresa.razaoSocial || lead.dadosEmpresa.cnpj}</b> já foi encaminhado para a mesa de análise da GSA Soluções.`,
                     });
                     console.log('Email de confirmação enviado para', lead.dadosEmpresa.email);
                 } catch (emailErr) {
                     console.error('Erro ao enviar email:', emailErr);
                 }
             }

             // 3. Disparar Notificação por WhatsApp para o Cliente (opcional: Vendedor)
             if (lead?.dadosEmpresa?.telefone) {
                 try {
                     const whatsUrl = process.env.WHATSAPP_API_URL;
                     const whatsToken = process.env.WHATSAPP_API_TOKEN;
                     if (whatsUrl && whatsToken) {
                         const fetchUrl = `${whatsUrl}/message/sendText`;
                         const fetch = (await import('node-fetch')).default;
                         const res = await fetch(fetchUrl, {
                             method: 'POST',
                             headers: {
                                 'apikey': whatsToken,
                                 'Content-Type': 'application/json'
                             },
                             body: JSON.stringify({
                                 number: lead.dadosEmpresa.telefone.replace(/\D/g, ''),
                                 options: { delay: 1200, linkPreview: false },
                                 textMessage: {
                                     text: `Olá! Confirmamos o recebimento do seu PIX. Seu projeto de crédito já foi encaminhado para a mesa de análise da GSA Soluções.`
                                 }
                             })
                         });
                         if (res.ok) {
                             console.log('WhatsApp enviado com sucesso para', lead.dadosEmpresa.telefone);
                         } else {
                             console.log('Falha ao enviar WhatsApp:', await res.text());
                         }
                     } else {
                         console.warn('Variáveis de ambiente do WhatsApp não configuradas.');
                     }
                 } catch (whatsErr) {
                     console.error('Erro ao enviar WhatsApp:', whatsErr);
                 }
             }
           }
         }
      }
      res.json({ received: true });
    } catch(e) {
      console.error('Erro webhook asaas', e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  // --- END ASAAS API ---

  // --- BEGIN EXTERNAL CONSULTATION API ---
  app.post("/api/consultations/execute", async (req, res) => {
    try {
      const { provider, searchParam } = req.body;
      
      console.log(`Executing consultation. Provider: ${provider}, Param: ${searchParam}`);
      
      const docOnly = searchParam?.replace(/\D/g, '') || '';
      // Aceita o ID do CPF ou tenta inferir se possui 11 (CPF) ou 14 (CNPJ) dígitos quando o provedor não estiver estritamente mapeado.
      // Permite usar a EHM como padrão para CPF/CNPJ se o usuário criar consultas com IDs diferentes.
      if (provider === '8c7af1aeca17302b9430d5970ba2c854525e98400b8c95fc' || docOnly.length === 11 || docOnly.length === 14) {
        const userToken = process.env.EHM_USER_TOKEN;
        const apiToken = process.env.EHM_TOKEN;

        if (!userToken || !apiToken) {
           throw new Error('As chaves de API da EHM Consultas não estão configuradas.');
        }

        if (!docOnly) {
           throw new Error('CPF ou CNPJ é obrigatório para essa consulta.');
        }

        const isCnpj = docOnly.length === 14;
        const url = isCnpj 
            ? `https://api.ehmconsultas.com/dividas/completa_premium/pj/${docOnly}?user_token=${userToken}&token=${apiToken}`
            : `https://api.ehmconsultas.com/dividas/completa_premium/pf/${docOnly}?user_token=${userToken}&token=${apiToken}`;
        
        try {
           const axiosInfo = await import('axios');
           const axios = axiosInfo.default;
           console.log(`Chamando EHM Consultas para ${isCnpj ? 'CNPJ' : 'CPF'}: ${docOnly}...`);
           const resp = await axios.get(url, { headers: { 'Accept': 'application/json' } });
           const apiData = resp.data?.data;
           
           if (!apiData) throw new Error('Dados não retornados pela API da EHM.');

           const consumidor = apiData.CONSUMIDOR || {};
           const dividas = apiData.DIVIDAS || {};
           
           let resultData: any = {
              "DATA E HORA DA CONSULTA": new Date().toLocaleString('pt-BR'),
              [isCnpj ? "CNPJ PESQUISADO" : "CPF PESQUISADO"]: docOnly,
           };

           if (isCnpj) {
              resultData["RAZÃO SOCIAL"] = consumidor.RAZAO_SOCIAL || "N/A";
              resultData["NOME FANTASIA"] = consumidor.NOME_FANTASIA || "N/A";
              resultData["CNPJ"] = consumidor.CNPJ || "N/A";
           } else {
              resultData["NOME"] = consumidor.NOME || "N/A";
              resultData["DATA DE NASCIMENTO"] = consumidor.DATA_NASCIMENTO || "N/A";
              resultData["DOCUMENTO"] = consumidor.DOCUMENTO || "N/A";
           }

           resultData["-------------------"] = "-------------------";
           resultData["DIVIDAS SPC"] = dividas.SPC?.length ? `${dividas.SPC.length} ocorrências` : "NADA CONSTA";

           (dividas.SPC || []).forEach((item: any, i: number) => {
              resultData[`SPC [${i+1}] Entidade`] = item.NOME_ENTIDADE || 'N/A';
              resultData[`SPC [${i+1}] Valor`] = item.VALOR ? `R$ ${item.VALOR}` : 'N/A';
              resultData[`SPC [${i+1}] Vencimento`] = item.DATA_VENCIMENTO || 'N/A';
              resultData[`SPC [${i+1}] Contrato`] = item.CONTRATO || 'N/A';
           });

           resultData["--------------------"] = "--------------------";
           resultData["DIVIDAS SERASA"] = dividas.SERASA?.length ? `${dividas.SERASA.length} ocorrências` : "NADA CONSTA";
           
           (dividas.SERASA || []).forEach((item: any, i: number) => {
              resultData[`SERASA [${i+1}] Entidade`] = item.NOME_ENTIDADE || 'N/A';
              resultData[`SERASA [${i+1}] Valor`] = item.VALOR ? `R$ ${item.VALOR}` : 'N/A';
              resultData[`SERASA [${i+1}] Vencimento`] = item.DATA_VENCIMENTO || '-';
              resultData[`SERASA [${i+1}] Contrato`] = item.CONTRATO || '-';
           });

           resultData["---------------------"] = "---------------------";
           resultData["DIVIDAS BOA VISTA"] = dividas.BOA_VISTA?.length ? `${dividas.BOA_VISTA.length} ocorrências` : "NADA CONSTA";
           
           (dividas.BOA_VISTA || []).forEach((item: any, i: number) => {
              resultData[`BOA VISTA [${i+1}] Credor`] = item.CREDOR || 'N/A';
              resultData[`BOA VISTA [${i+1}] Valor`] = item.VALOR || 'N/A';
              resultData[`BOA VISTA [${i+1}] Inclusão`] = item.DATA_INCLUSAO || '-';
              resultData[`BOA VISTA [${i+1}] Contrato`] = item.CONTRATO || '-';
           });

           resultData["----------------------"] = "----------------------";
           resultData["PROTESTOS (CARTÓRIO)"] = dividas.PROTESTO?.length ? `${dividas.PROTESTO.length} ocorrências` : "NADA CONSTA";
           
           (dividas.PROTESTO || []).forEach((item: any, i: number) => {
              resultData[`PROTESTO [${i+1}] Cidade/UF`] = `${item.CIDADE || 'N/A'} - ${item.UF || 'N/A'}`;
              resultData[`PROTESTO [${i+1}] Valor`] = item.VALOR ? `R$ ${item.VALOR}` : 'N/A';
              resultData[`PROTESTO [${i+1}] Cartório`] = item.CARTORIO || 'N/A';
           });

           return res.json({ success: true, result_data: resultData });
        } catch (apiError: any) {
           console.error("Erro EHM API:", apiError.response?.data || apiError.message);
           return res.status(500).json({ error: 'Falha ao comunicar com API da EHM Consultas.' });
        }
      }

      // Se o provedor não estiver mapeado em produção
      throw new Error(`Provedor ou integração não mapeada para o sistema de produção.`);
    } catch (e: any) {
      console.error("Erro na integração:", e);
      res.status(500).json({ error: e.message || 'Falha ao executar consulta.' });
    }
  });

  // Vite middleware for development (after API routes)
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const __dirname = path.resolve();
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    
    // Catch-all para SPA: serve index.html para qualquer rota que não seja arquivo estático
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        next();
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
