import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { MercadoPagoConfig, Payment } from "mercadopago";
import admin from "firebase-admin";
import { initializeFirebase } from "./src/utils/firebaseServer";
import { metaConversionsHandler } from "./src/controllers/metaController";
import fetch from "node-fetch";
import axios from "axios";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServer as createViteServer } from "vite";

const genAI_apiKey = process.env.GEMINI_API_KEY;
const genAI = genAI_apiKey ? new GoogleGenerativeAI(genAI_apiKey) : null;

async function startServer() {
  const app = express();
  
  // Confia na primeira camada de proxy reverso (essencial para Cloud Run/Express/Nginx)
  app.set("trust proxy", 1);

  const PORT = Number(process.env.PORT) || 3000;

  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // relaxed limit for sandbox/dev proxy and media/asset loading
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    validate: false, // Desativa validações redundantes de proxy do rate-limit
  });
  app.use("/api", limiter);

  // Initialize Firebase Admin once
  const { admin, db } = initializeFirebase();

  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error('Error verifying auth token:', error);
      res.status(403).json({ error: 'Forbidden' });
    }
  };

  // Load config consistently from workspace root
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      console.error("[INIT] Failed to parse firebase-applet-config.json", err);
    }
  }

  let cachedPlatformSettings: any = null;
  let lastPlatformSettingsCache = 0;
  const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async function getPlatformSettings(): Promise<any> {
    if (cachedPlatformSettings && (Date.now() - lastPlatformSettingsCache < SETTINGS_CACHE_TTL)) {
      return cachedPlatformSettings;
    }
    const db = admin.firestore();
    const configDoc = await db.collection("platform_config").doc("saas_settings").get();
    if (configDoc.exists) {
      cachedPlatformSettings = configDoc.data();
      lastPlatformSettingsCache = Date.now();
    }
    return cachedPlatformSettings;
  }

  app.use(cors({
    origin: (origin, callback) => {
      // Allow all origins for the development and preview iFrames
      callback(null, true);
    },
    credentials: true
  }));
  app.use(express.json());

  app.post("/api/send-email", async (req, res) => {
    // ... existing email code ...
    const { to, subject, text, html } = req.body;
    
    let smtpSettings = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.FROM_EMAIL
    };

    try {
      const db = admin.firestore();
      const configDoc = await db.collection("platform_config").doc("saas_settings").get();
      if (configDoc.exists) {
        const data = configDoc.data();
        if (data.smtp_host) smtpSettings.host = data.smtp_host;
        if (data.smtp_port) smtpSettings.port = parseInt(data.smtp_port);
        if (data.smtp_user) smtpSettings.user = data.smtp_user;
        if (data.smtp_pass) smtpSettings.pass = data.smtp_pass;
      }
    } catch (e) {
      console.error("[SMTP] Error fetching custom SMTP settings", e);
    }

    if (!smtpSettings.host || !smtpSettings.port || !smtpSettings.user || !smtpSettings.pass || !smtpSettings.from) {
      return res.status(500).json({ error: "SMTP configuration missing" });
    }
    
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.port === 465, // true for 465, false for other ports
      auth: { user: smtpSettings.user, pass: smtpSettings.pass },
    });
    try {
      await transporter.sendMail({ from: smtpSettings.from, to, subject, text, html });
      res.json({ success: true });
    } catch (e: any) {
      const errorMsg = e.message || "Failed to send email";
      console.warn("[SMTP Warn] Email sending failed:", errorMsg);
      let userFriendlyMsg = errorMsg;
      if (errorMsg.includes("535-5.7.8")) {
        console.warn("[SMTP Warn] SendMail rejected creds. Suppressing error to avoid loop.");
        return res.status(200).json({ success: false, suppressed: true, reason: "Bad SMTP credentials" });
      }
      res.status(500).json({ error: userFriendlyMsg });
    }
  });

  // --- BEGIN MERCADO PAGO API ---
  app.post("/api/v1/consultations/create-pix", authenticate, async (req, res, next) => {
    try {
      const { transactionAmount, description, clientEmail, requestId } =
        req.body;

      if (!transactionAmount) {
        return res.status(400).json({
          error: "Parâmetros obrigatórios em falta (transactionAmount)",
        });
      }

      const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!mpAccessToken) {
        console.warn("MERCADOPAGO_ACCESS_TOKEN não configurado no .env");
        return res.status(500).json({
          error: "MERCADOPAGO_ACCESS_TOKEN não configurado no backend.",
        });
      }

      const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });

      // 1. Criar a intenção de pagamento no Mercado Pago
      const payment = new Payment(mpClient);
      const paymentResponse = await payment.create({
        body: {
          transaction_amount: Number(transactionAmount),
          description: description || `Consulta GSA`,
          payment_method_id: "pix",
          payer: {
            email: clientEmail || "cliente@gsa.com.br",
          },
          external_reference: requestId || undefined,
        },
      });

      // 2. Retornar os dados do QR Code
      res.json({
        success: true,
        payment_id: paymentResponse.id?.toString(),
        qr_code:
          paymentResponse.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64:
          paymentResponse.point_of_interaction?.transaction_data
            ?.qr_code_base64,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // --- END MERCADO PAGO API ---

  // --- BEGIN DIRECT ADMIN API ---
  // Administrative API endpoints removed in favor of client-side operations (writeBatch)
  // which handle permissions correctly via the user's authenticated context.
  // --- END DIRECT ADMIN API ---

  // --- BEGIN ASAAS API ---
  app.post("/api/v1/asaas/create-pix", authenticate, async (req, res, next) => {
    try {
      const {
        customerName,
        customerEmail,
        customerCpfCnpj,
        value,
        description,
        externalReference,
      } = req.body;

      let asaasKey = process.env.ASAAS_API_KEY;
      let isSandbox = false;
      let source = 'env';

      // Tenta buscar do Firestore para permitir overrides
      try {
        const settings = await getPlatformSettings();
        if (settings && settings.asaas_key) {
          console.log("[ASAAS Debug] Settings loaded from Firestore:", JSON.stringify(settings));
          asaasKey = settings.asaas_key;
          // Se houver variável de ambiente, prioriza. Caso contrário, Firestore, depois padrão false.
          isSandbox = process.env.ASAAS_IS_SANDBOX !== undefined
            ? process.env.ASAAS_IS_SANDBOX === 'true'
            : (settings.is_sandbox ?? false);
          source = 'firestore';
        }
      } catch (e) {
        console.log("Não foi possível buscar as configurações ASAAS do Firestore", e);
      }

      let baseUrl = isSandbox
        ? "https://sandbox.asaas.com/api/v3"
        : "https://api.asaas.com/v3";
        
      console.log(`[ASAAS Debug] Iniciando fluxo Asaas. Origem: ${source}, Modo: ${isSandbox ? 'Sandbox' : 'Produção'}`);
      console.log(`[ASAAS Debug] Base URL: ${baseUrl}`);
      if (asaasKey) {
        console.log(`[ASAAS Debug] Chave iniciando em: ${asaasKey.substring(0, 6)}..., tamanho: ${asaasKey.length}`);
      } else {
        console.log(`[ASAAS Debug] Chave não encontrada!`);
      }
      
      if (!asaasKey) {
        return res
          .status(500)
          .json({ error: "ASAAS_API_KEY não configurada no ambiente nem no banco de dados." });
      }

      if (!value || !customerCpfCnpj || !customerName) {
        return res
          .status(400)
          .json({ error: "Parâmetros obrigatórios faltando para Asaas" });
      }

      const safeCpfCnpj = customerCpfCnpj
        ? String(customerCpfCnpj).replace(/\D/g, "")
        : "";

      // 1. Create or Find Customer
      let getCustomerUrl = safeCpfCnpj
        ? `${baseUrl}/customers?cpfCnpj=${safeCpfCnpj}`
        : `${baseUrl}/customers?email=${customerEmail}`;
        
      console.log(`[ASAAS Debug] Buscando cliente em: ${getCustomerUrl}`);
      let customerRes = await fetch(getCustomerUrl, {
        headers: { access_token: asaasKey },
      });
      
      const customerText = await customerRes.text();
      let customerJson: any;
      
      if (customerRes.status === 401) {
        console.error(`[ASAAS Error] 401 Unauthorized. Chave: ${asaasKey?.substring(0,6)}..., Sandbox: ${isSandbox}`);
        return res.status(401).json({ error: "Autenticação Asaas falhou: Unauthorized. Verifique se a API Key (Sandbox/Produção) corresponde ao Modo de Operação." });
      }

      try {
        customerJson = JSON.parse(customerText);
      } catch (e) {
        console.error("[ASAAS Error] Body não é JSON na busca:", customerText);
        throw new Error("Resposta da API Asaas não é JSON válido.");
      }

      // Auto-fallback para o ambiente correto caso de invalid_environment
      if (
        customerRes.status === 401 &&
        customerJson.errors?.[0]?.code === "invalid_environment"
      ) {
        console.log(
          "Detectado invalid_environment, mudando o sandbox flag localmente.",
        );
        isSandbox = !isSandbox;
        baseUrl = isSandbox
          ? "https://sandbox.asaas.com/api/v3"
          : "https://api.asaas.com/v3";
        getCustomerUrl = safeCpfCnpj
          ? `${baseUrl}/customers?cpfCnpj=${safeCpfCnpj}`
          : `${baseUrl}/customers?email=${customerEmail}`;

        customerRes = await fetch(getCustomerUrl, {
          headers: { access_token: asaasKey },
        });
        const customerText2 = await customerRes.text();
        customerJson = JSON.parse(customerText2);
      }

      let customerId = "";
      if (customerJson.data && customerJson.data.length > 0) {
        customerId = customerJson.data[0].id;
      } else {
        const createCustomerRes = await fetch(`${baseUrl}/customers`, {
          method: "POST",
          headers: {
            access_token: asaasKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: customerName,
            email: customerEmail,
            ...(safeCpfCnpj && { cpfCnpj: safeCpfCnpj }),
          }),
        });
        const newCustomerText = await createCustomerRes.text();
        let newCustomerJson: any;
        try {
          newCustomerJson = JSON.parse(newCustomerText);
        } catch (e) {
          console.error("Erro Asaas (Body não é JSON na criação):", newCustomerText);
          throw new Error("Resposta da API Asaas não é JSON válido.");
        }
        
        if (newCustomerJson.errors) {
          console.error("Erro Asaas (Criar Cliente):", newCustomerJson.errors);
        }
        customerId = newCustomerJson.id;
      }

      if (!customerId) {
        return res.status(500).json({
          error: "Falha ao processar solicitação no Asaas",
        });
      }

      // 2. Create Payment
      const createPaymentRes = await fetch(`${baseUrl}/payments`, {
        method: "POST",
        headers: {
          access_token: asaasKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: Number(value),
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // 2 days
          description: description || "Honorários GSA",
          externalReference: externalReference,
        }),
      });

      const paymentText = await createPaymentRes.text();
      let paymentJson: any;
      try {
        paymentJson = JSON.parse(paymentText);
      } catch (e) {
        console.error("Erro Asaas (Body não é JSON no pagamento):", paymentText);
        throw new Error("Resposta da API Asaas não é JSON válido.");
      }

      if (!paymentJson.id) {
        return res.status(500).json({
          error: "Falha ao processar pagamento no Asaas",
        });
      }

      // 3. Get Pix QR Code
      const pixQrRes = await fetch(
        `${baseUrl}/payments/${paymentJson.id}/pixQrCode`,
        {
          headers: { access_token: asaasKey },
        },
      );
      const pixQrText = await pixQrRes.text();
      let pixQrJson: any;
      try {
        pixQrJson = JSON.parse(pixQrText);
      } catch (e) {
        console.error("Erro Asaas (Body não é JSON no QR):", pixQrText);
        throw new Error("Resposta da API Asaas não é JSON válido.");
      }

      res.json({
        success: true,
        payment_id: paymentJson.id,
        invoice_url: paymentJson.invoiceUrl,
        qr_code: pixQrJson.payload,
        qr_code_base64: pixQrJson.encodedImage,
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/v1/asaas/webhook", async (req, res, next) => {
    try {
      const signature = req.headers['asaas-access-token'];
      const token = process.env.ASAAS_WEBHOOK_TOKEN;

      if (token) {
        if (!signature || signature !== token) {
          console.error("Invalid Asaas webhook token");
          return res.status(401).json({ error: "Unauthorized" });
        }
      }

      const event = req.body;
      console.log("Asaas Webhook received:", event.event);

      // We handle PAYMENT_RECEIVED or PAYMENT_CONFIRMED
      if (
        event.event === "PAYMENT_RECEIVED" ||
        event.event === "PAYMENT_CONFIRMED"
      ) {
        const payment = event.payment;
        const externalReference = payment.externalReference;

        if (externalReference) {
          // We expect externalReference to be the Firebase Lead ID
          const db = admin.firestore();
          const leadRef = db.collection("leads_credito").doc(externalReference);
          const leadDoc = await leadRef.get();

          if (leadDoc.exists) {
            const lead = leadDoc.data();

            await leadRef.update({
              "dadosPagamentoAsaas.statusPagamento": "RECEIVED",
              status: "analise_tecnica", // Transita para analise_tecnica
            });

            console.log(
              `Asaas Payment success for lead ${externalReference}. Status updated to analise_tecnica.`,
            );

            // 2. Disparar Notificação por E-mail (GSA Crédito)
            if (lead?.dadosEmpresa?.email) {
              try {
                const nodemailer = await import("nodemailer");
                const transporter = nodemailer.createTransport({
                  host: process.env.SMTP_HOST,
                  port: Number(process.env.SMTP_PORT) || 587,
                  secure: Number(process.env.SMTP_PORT) === 465,
                  auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                  },
                });

                await transporter.sendMail({
                  from:
                    process.env.FROM_EMAIL ||
                    '"GSA Soluções" <no-reply@gsasolucoes.com.br>',
                  to: lead.dadosEmpresa.email,
                  subject: "Confirmação de Pagamento - GSA Soluções",
                  text: `Olá, da equipe GSA Soluções.\n\nConfirmamos o recebimento do seu PIX. Seu projeto de crédito para a empresa ${lead.dadosEmpresa.razaoSocial || lead.dadosEmpresa.cnpj} já foi encaminhado para a mesa de análise.`,
                  html: `<b>Olá!</b><br><br>Confirmamos o recebimento do seu PIX. Seu projeto de crédito para a empresa <b>${lead.dadosEmpresa.razaoSocial || lead.dadosEmpresa.cnpj}</b> já foi encaminhado para a mesa de análise da GSA Soluções.`,
                });
                console.log(
                  "Email de confirmação enviado para",
                  lead.dadosEmpresa.email,
                );
              } catch (emailErr: any) {
                console.warn("[SMTP Warn] Erro ao enviar email de confirmação:", emailErr?.message || emailErr);
              }
            }

            // 3. Disparar Notificação por WhatsApp para o Cliente (opcional: Vendedor)
            if (lead?.dadosEmpresa?.telefone) {
              try {
                const whatsUrl = process.env.WHATSAPP_API_URL;
                const whatsToken = process.env.WHATSAPP_API_TOKEN;
                if (whatsUrl && whatsToken) {
                  const fetchUrl = `${whatsUrl}/message/sendText`;
                  const res = await fetch(fetchUrl, {
                    method: "POST",
                    headers: {
                      apikey: whatsToken,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      number: lead.dadosEmpresa.telefone.replace(/\D/g, ""),
                      options: { delay: 1200, linkPreview: false },
                      textMessage: {
                        text: `Olá! Confirmamos o recebimento do seu PIX. Seu projeto de crédito já foi encaminhado para a mesa de análise da GSA Soluções.`,
                      },
                    }),
                  });
                  if (res.ok) {
                    console.log(
                      "WhatsApp enviado com sucesso para",
                      lead.dadosEmpresa.telefone,
                    );
                  } else {
                    console.log("Falha ao enviar WhatsApp:", await res.text());
                  }
                } else {
                  console.warn(
                    "Variáveis de ambiente do WhatsApp não configuradas.",
                  );
                }
              } catch (whatsErr) {
                console.error("Erro ao enviar WhatsApp:", whatsErr);
              }
            }
          }
        }
      }
      res.json({ received: true });
    } catch (e) {
      next(e);
    }
  });
  // --- END ASAAS API ---

  // --- BEGIN EXTERNAL CONSULTATION API ---
  const ALLOWED_PROVIDERS = {
    "8c7af1aeca17302b9430d5970ba2c854525e98400b8c95fc": "EHM"
  };

  app.post("/api/v1/consultations/execute", authenticate, async (req, res, next) => {
    try {
      const { provider, searchParam } = req.body;

      console.log(
        `Executing consultation. Provider: ${provider}, Param: ${searchParam}`,
      );

      // Validate Provider
      if (!ALLOWED_PROVIDERS[provider as keyof typeof ALLOWED_PROVIDERS]) {
        throw new Error("Provedor de consulta inválido ou não autorizado.");
      }

      // Validate searchParam (CPF/CNPJ)
      const docOnly = searchParam?.replace(/\D/g, "") || "";
      if (!/^\d{11}$|^\d{14}$/.test(docOnly)) {
        throw new Error("CPF ou CNPJ inválido.");
      }

      const userToken = process.env.EHM_USER_TOKEN;
      const apiToken = process.env.EHM_TOKEN;

      if (!userToken || !apiToken) {
        throw new Error(
          "As chaves de API da EHM Consultas não estão configuradas.",
        );
      }

      const isCnpj = docOnly.length === 14;
      const url = isCnpj
        ? `https://api.ehmconsultas.com/dividas/completa_premium/pj/${docOnly}?user_token=${userToken}&token=${apiToken}`
        : `https://api.ehmconsultas.com/dividas/completa_premium/pf/${docOnly}?user_token=${userToken}&token=${apiToken}`;

      try {
        console.log(
          `Chamando EHM Consultas para ${isCnpj ? "CNPJ" : "CPF"}: ${docOnly}...`,
        );
        const resp = await axios.get(url, {
          headers: { Accept: "application/json" },
        });
        const apiData = resp.data?.data;

          if (!apiData)
            throw new Error("Dados não retornados pela API da EHM.");

          const consumidor = apiData.CONSUMIDOR || {};
          const dividas = apiData.DIVIDAS || {};

          let resultData: any = {
            "DATA E HORA DA CONSULTA": new Date().toLocaleString("pt-BR"),
            [isCnpj ? "CNPJ PESQUISADO" : "CPF PESQUISADO"]: docOnly,
          };

          if (isCnpj) {
            resultData["RAZÃO SOCIAL"] = consumidor.RAZAO_SOCIAL || "N/A";
            resultData["NOME FANTASIA"] = consumidor.NOME_FANTASIA || "N/A";
            resultData["CNPJ"] = consumidor.CNPJ || "N/A";
          } else {
            resultData["NOME"] = consumidor.NOME || "N/A";
            resultData["DATA DE NASCIMENTO"] =
              consumidor.DATA_NASCIMENTO || "N/A";
            resultData["DOCUMENTO"] = consumidor.DOCUMENTO || "N/A";
          }

          resultData["-------------------"] = "-------------------";
          resultData["DIVIDAS SPC"] = dividas.SPC?.length
            ? `${dividas.SPC.length} ocorrências`
            : "NADA CONSTA";

          (dividas.SPC || []).forEach((item: any, i: number) => {
            resultData[`SPC [${i + 1}] Entidade`] = item.NOME_ENTIDADE || "N/A";
            resultData[`SPC [${i + 1}] Valor`] = item.VALOR
              ? `R$ ${item.VALOR}`
              : "N/A";
            resultData[`SPC [${i + 1}] Vencimento`] =
              item.DATA_VENCIMENTO || "N/A";
            resultData[`SPC [${i + 1}] Contrato`] = item.CONTRATO || "N/A";
          });

          resultData["--------------------"] = "--------------------";
          resultData["DIVIDAS SERASA"] = dividas.SERASA?.length
            ? `${dividas.SERASA.length} ocorrências`
            : "NADA CONSTA";

          (dividas.SERASA || []).forEach((item: any, i: number) => {
            resultData[`SERASA [${i + 1}] Entidade`] =
              item.NOME_ENTIDADE || "N/A";
            resultData[`SERASA [${i + 1}] Valor`] = item.VALOR
              ? `R$ ${item.VALOR}`
              : "N/A";
            resultData[`SERASA [${i + 1}] Vencimento`] =
              item.DATA_VENCIMENTO || "-";
            resultData[`SERASA [${i + 1}] Contrato`] = item.CONTRATO || "-";
          });

          resultData["---------------------"] = "---------------------";
          resultData["DIVIDAS BOA VISTA"] = dividas.BOA_VISTA?.length
            ? `${dividas.BOA_VISTA.length} ocorrências`
            : "NADA CONSTA";

          (dividas.BOA_VISTA || []).forEach((item: any, i: number) => {
            resultData[`BOA VISTA [${i + 1}] Credor`] = item.CREDOR || "N/A";
            resultData[`BOA VISTA [${i + 1}] Valor`] = item.VALOR || "N/A";
            resultData[`BOA VISTA [${i + 1}] Inclusão`] =
              item.DATA_INCLUSAO || "-";
            resultData[`BOA VISTA [${i + 1}] Contrato`] = item.CONTRATO || "-";
          });

          resultData["----------------------"] = "----------------------";
          resultData["PROTESTOS (CARTÓRIO)"] = dividas.PROTESTO?.length
            ? `${dividas.PROTESTO.length} ocorrências`
            : "NADA CONSTA";

          (dividas.PROTESTO || []).forEach((item: any, i: number) => {
            resultData[`PROTESTO [${i + 1}] Cidade/UF`] =
              `${item.CIDADE || "N/A"} - ${item.UF || "N/A"}`;
            resultData[`PROTESTO [${i + 1}] Valor`] = item.VALOR
              ? `R$ ${item.VALOR}`
              : "N/A";
            resultData[`PROTESTO [${i + 1}] Cartório`] = item.CARTORIO || "N/A";
          });

          return res.json({ success: true, result_data: resultData });
        } catch (apiError: any) {
          console.error(
            "Erro EHM API:",
            apiError.response?.data || apiError.message,
          );
          return res
            .status(500)
            .json({ error: "Falha ao comunicar com API da EHM Consultas." });
        }

      // Se o provedor não estiver mapeado em produção
      throw new Error(
        `Provedor ou integração não mapeada para o sistema de produção.`,
      );
    } catch (e: any) {
      next(e);
    }
  });

  // --- BEGIN META CONVERSIONS API ---
  app.post("/api/v1/meta-conversions", metaConversionsHandler);
  // --- END META CONVERSIONS API ---

  // --- BEGIN AI PROXY API ---
  app.post("/api/v1/ai/analyzeSmartFicha", authenticate, async (req, res, next) => {
    try {
      if (!genAI) {
        return res.status(500).json({ error: "Configuração de IA Pendente." });
      }

      const leadData = req.body.leadData;
      const prompt = `
        Você é um especialista em análise de crédito e Vendas B2B/B2C (CRO).
        Analise os dados deste cliente/lead que preencheu uma ficha de triagem:
        ${JSON.stringify(leadData, null, 2)}
        
        Gere um score de urgência de 0 a 100 baseado na probabilidade dele precisar do serviço urgente (Dívidas no BACEN, restrições, etc).
        Retorne o nível urgência (BAIXA, MEDIA, ALTA, CRITICA).
        Forneça uma ação recomendada para o consultor.
        Crie um "Sales Pitch" (Argumento de Venda) curto e um poderoso gatilho mental para ser usado imediatamente por telefone/wpp.
        E forneça até 3 key insights principais sobre o perfil desse cara.
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const responseText = result.response.text();
      res.json(JSON.parse(responseText || "{}"));
    } catch (e: any) {
      next(e);
    }
  });

  app.post("/api/v1/ai/analyzeDocument", authenticate, async (req, res, next) => {
    try {
      if (!genAI) {
        return res.status(500).json({ error: "Configuração de IA Pendente." });
      }

      const { base64Data, mimeType } = req.body;
      const prompt = `
        Analise a imagem deste documento brasileiro e extraia as informações principais.
        Determine se o documento parece autêntico (não é uma montagem óbvia ou foto de tela).
        Retorne os dados no formato JSON especificado.
        Documentos suportados: RG, CNH, CPF, CNPJ, Contrato Social.
        Se for outro tipo, identifique como OUTRO.
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const resultText = response.response.text() || "{}";
      res.json(JSON.parse(resultText));
    } catch (e: any) {
      next(e);
    }
  });
  // --- END AI PROXY API ---

  // Centralized Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(JSON.stringify({
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    }));
    res.status(500).json({ error: "Internal Server Error" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const __dirname = path.resolve();
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(distPath, "index.html"));
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
