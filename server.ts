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
import axios from "axios";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";

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

  // Configuração VAPID - Web Push Notifications
  let vapidKeys = {
    publicKey: process.env.PUBLIC_VAPID_KEY || process.env.VITE_PUBLIC_VAPID_KEY || "",
    privateKey: process.env.PRIVATE_VAPID_KEY || ""
  };

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    try {
      const generated = webpush.generateVAPIDKeys();
      vapidKeys.publicKey = generated.publicKey;
      vapidKeys.privateKey = generated.privateKey;
      console.log("⚙️ [GSA SW] Chaves VAPID dinâmicas geradas com sucesso!");
    } catch (err) {
      console.error("Falha ao gerar chaves VAPID dinâmicas:", err);
    }
  }

  if (vapidKeys.publicKey && vapidKeys.privateKey) {
    try {
      webpush.setVapidDetails(
        "mailto:financeiro@gsa.com",
        vapidKeys.publicKey,
        vapidKeys.privateKey
      );
    } catch (err) {
      console.error("Falha ao configurar detalhes do VAPID:", err);
    }
  }

  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const isPublicAiRoute = req.path.includes('/api/v1/ai/analyzeSmartFicha') || req.path.includes('/api/v1/ai/analyzeDocument');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (isPublicAiRoute) {
        (req as any).user = { uid: "GUEST", email: "guest@gsa.com", role: "GUEST" };
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
      if (isPublicAiRoute) {
        (req as any).user = { uid: "GUEST", email: "guest@gsa.com", role: "GUEST" };
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      (req as any).user = decodedToken;
      next();
    } catch (error: any) {
      if (isPublicAiRoute) {
        // Encontra erro de token mas permite prosseguir como Guest para rotas públicas
        (req as any).user = { uid: "GUEST", email: "guest@gsa.com", role: "GUEST" };
        return next();
      }
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
    try {
      const db = admin.firestore();
      const configDoc = await db.collection("platform_config").doc("saas_settings").get();
      if (configDoc.exists) {
        cachedPlatformSettings = configDoc.data();
        lastPlatformSettingsCache = Date.now();
      }
    } catch (e) {
      console.warn("[PlatformSettings Warning] Firestore API is not activated or available. Fallback to env-based local presets.", e);
      cachedPlatformSettings = {
        asaas_key: process.env.ASAAS_API_KEY,
        is_sandbox: process.env.ASAAS_IS_SANDBOX === 'true'
      };
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

  app.get("/api/backups", authenticate, async (req, res) => {
    try {
      const authData = (req as any).user;
      const userSnap = await db.collection("usuarios").doc(authData.uid).get();
      const role = userSnap.data()?.role;
      if (!["ADM_MASTER", "ADM_MESTRE", "ADM_GERENTE"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const bucket = admin.storage().bucket("ais-us-east1-5b22e4a04c234f7eb.firebasestorage.app");
      const [files] = await bucket.getFiles({ prefix: "backups/" });
      const backups = await Promise.all(
        files.filter(f => f.name.endsWith('.json')).map(async (file) => {
          const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 });
          const [metadata] = await file.getMetadata();
          return {
             name: file.name.replace('backups/', ''),
             size: metadata.size,
             timeCreated: metadata.timeCreated,
             downloadUrl: url
          };
        })
      );
      backups.sort((a,b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime());
      res.json({ backups });
    } catch (e: any) {
      console.error("[BACKUP] List error:", e);
      res.status(500).json({ error: "Falha ao listar backups", details: e.message });
    }
  });

  app.post("/api/trigger-backup", authenticate, async (req, res) => {
    try {
      const authData = (req as any).user;
      const userSnap = await db.collection("usuarios").doc(authData.uid).get();
      const role = userSnap.data()?.role;
      if (!["ADM_MASTER", "ADM_MESTRE", "ADM_GERENTE"].includes(role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const bucket = admin.storage().bucket("ais-us-east1-5b22e4a04c234f7eb.firebasestorage.app");
      const [leadsSnap, consultasSnap] = await Promise.all([
        db.collection('clients').get(),
        db.collection('consultation_requests').get()
      ]);

      const leads = leadsSnap.docs.map(d => ({id: d.id, ...d.data()}));
      const consultas = consultasSnap.docs.map(d => ({id: d.id, ...d.data()}));

      const backupData = JSON.stringify({
        leads,
        consultas,
        timestamp: new Date().toISOString(),
        geradoPor: authData.email || authData.uid
      }, null, 2);

      const fileName = `backups/backup-manual-${new Date().toISOString().replace(/:/g, '-')}.json`;
      const file = bucket.file(fileName);
      await file.save(backupData, { contentType: 'application/json' });
      
      res.json({ success: true, message: `Backup manual gerado: ${fileName}` });
    } catch (e: any) {
      console.error("[BACKUP] Manual trigger error:", e);
      res.status(500).json({ error: "Falha ao gerar backup manual", details: e.message });
    }
  });

  app.post("/api/validate-smtp", async (req, res) => {
    const { host, port, user, pass } = req.body;
    if (!host || !port || !user || !pass) {
      return res.status(400).json({ success: false, error: "Preencha todos os campos SMTP" });
    }
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: { user, pass },
    });
    try {
      await transporter.verify();
      res.json({ success: true, message: "Conexão SMTP validada com sucesso" });
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message || "Erro de conexão SMTP" });
    }
  });

  app.post("/api/send-whatsapp", async (req, res) => {
    const { to, message, processoId } = req.body;
    if (!to || !message) {
      return res.status(400).json({ success: false, error: "Parâmetros 'to' e 'message' são obrigatórios." });
    }

    // Clean phone number
    let cleanedPhone = to.replace(/\D/g, "");
    if (!cleanedPhone.startsWith("55") && cleanedPhone.length >= 10 && cleanedPhone.length <= 11) {
      cleanedPhone = "55" + cleanedPhone;
    }

    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiToken = process.env.WHATSAPP_API_TOKEN;

    let responseData = null;
    let sentReal = false;
    let errorMsg = null;

    if (apiUrl && apiToken) {
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiToken}`
          },
          body: JSON.stringify({
            number: cleanedPhone,
            message: message
          })
        });
        responseData = await response.text();
        if (response.ok) {
          sentReal = true;
        } else {
          errorMsg = `API Error: status ${response.status} - ${responseData}`;
        }
      } catch (e: any) {
        errorMsg = e.message;
        console.error("[WhatsApp REST API Failure]", e);
      }
    } else {
      console.log(`[WhatsApp simulated] to ${cleanedPhone}: "${message}"`);
      sentReal = false;
      errorMsg = "API do WhatsApp não configurada nas variáveis de ambiente. Envio simulado de forma bem sucedida.";
    }

    // Gravar log no Firestore
    try {
      const db = admin.firestore();
      await db.collection("whatsapp_logs").add({
        destinatario: cleanedPhone,
        mensagem: message,
        processo_id: processoId || "",
        status: sentReal ? "ENVIADO" : "SIMULADO",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        api_configurada: !!(apiUrl && apiToken),
        erro: errorMsg || null
      });
    } catch (dbErr: any) {
      console.warn("[WhatsApp Log DB Skip - Offine/Disabled]", dbErr.message || dbErr);
    }

    return res.json({
      success: true,
      sentReal,
      cleanedPhone,
      message,
      error: errorMsg
    });
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const { nome, email, telefone } = req.body;
      if (!nome || !email || !telefone) {
        return res.status(400).json({ error: "Nome, e-mail e telefone são obrigatórios" });
      }
      
      const leadData = {
        nome,
        email,
        telefone,
        especialista_id: 'SaaS_GSA_IA',
        origem: 'Landing Page SaaS',
        data_entrada: new Date().toISOString(),
        documento: 'N/A'
      };

      try {
        const db = admin.firestore();
        const docRef = await db.collection("clients").add({
          ...leadData,
          data_entrada: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("[Leads API] Lead saved to Cloud Firestore with ID:", docRef.id);
        return res.json({ success: true, id: docRef.id });
      } catch (firestoreErr: any) {
        console.warn("[Leads API Warning] Cloud Firestore API appears disabled or restricted. Saving lead locally as fallback:", firestoreErr.message);
        
        const localLeadsPath = path.join(process.cwd(), "local_leads.json");
        let localLeads: any[] = [];
        if (fs.existsSync(localLeadsPath)) {
          try {
            localLeads = JSON.parse(fs.readFileSync(localLeadsPath, "utf8"));
          } catch (err) {}
        }
        
        const localId = "local_" + Math.random().toString(36).substring(2, 11);
        localLeads.push({ id: localId, ...leadData });
        fs.writeFileSync(localLeadsPath, JSON.stringify(localLeads, null, 2), "utf8");
        
        console.log("[Leads API] Lead saved locally as fallback, assigned ID:", localId);
        return res.json({ success: true, id: localId, isLocal: true });
      }
    } catch (e: any) {
      console.error("[Leads API Error]", e);
      return res.status(500).json({ error: e.message || "Erro interno ao salvar lead" });
    }
  });

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
      
      const portalDoc = await db.collection("platform_config").doc("portal_publico").get();
      if (portalDoc.exists) {
        const data = portalDoc.data();
        if (data.smtp_host) smtpSettings.host = data.smtp_host;
        if (data.smtp_port) smtpSettings.port = parseInt(data.smtp_port);
        if (data.smtp_user) smtpSettings.user = data.smtp_user;
        if (data.smtp_pass) smtpSettings.pass = data.smtp_pass;
        // Se houver fallback de emissor e o form nao tem, as vezes usamos o mesmo user
        if (data.smtp_user && !smtpSettings.from) smtpSettings.from = data.smtp_user;
      }
    } catch (e: any) {
      console.warn("[SMTP Info] Skipping Firestore custom SMTP read (Firestore offline or disabled):", e.message);
    }

    const isMockSettings = !smtpSettings.host || !smtpSettings.user || !smtpSettings.pass || 
                         smtpSettings.host.includes("example.com") || smtpSettings.user.includes("placeholder");

    if (isMockSettings) {
      console.log(`[SMTP SIMULATED] Config is missing or mock settings. Simulating delivery to ${to}`);
      return res.json({ success: true, simulated: true, message: "Envio simulado com sucesso (configuração SMTP ausente/mock)." });
    }
    
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.port === 465, // true for 465, false for other ports
      auth: { user: smtpSettings.user, pass: smtpSettings.pass },
    });
    try {
      await transporter.sendMail({ from: smtpSettings.from || "no-reply@gsasolucoes.com.br", to, subject, text, html });
      res.json({ success: true });
    } catch (e: any) {
      const errorMsg = e.message || "Failed to send email";
      console.warn("[SMTP Warn] Email sending failed:", errorMsg);
      if (errorMsg.includes("535") || errorMsg.includes("accepted") || errorMsg.includes("Username") || errorMsg.includes("Timeout") || errorMsg.includes("connect") || errorMsg.includes("ENOTFOUND")) {
        console.warn("[SMTP Warn] SMTP credentials rejected or Connection timed out. Simulating successful return to prevent UI block.");
        return res.status(200).json({ success: true, simulated: true, suppressed: true, reason: errorMsg });
      }
      res.status(500).json({ error: errorMsg });
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

  // --- BEGIN PUSH NOTIFICATION ROUTES ---
  app.get("/api/v1/push/public-key", (req, res) => {
    return res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post("/api/v1/push/subscribe", async (req, res) => {
    try {
      const { subscription, userId } = req.body;
      if (!subscription) {
        return res.status(400).json({ error: "Assinatura não fornecida." });
      }

      const targetUserId = userId || "GUEST";
      const hashedEndpoint = crypto.createHash("md5").update(subscription.endpoint).digest("hex");
      const subRef = db.collection("push_subscriptions").doc(hashedEndpoint);
      
      await subRef.set({
        userId: targetUserId,
        subscription,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return res.json({ success: true, message: "Inscrição de push registrada com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao registrar assinatura de push:", err);
      return res.status(500).json({ error: "Falha ao registrar assinatura.", details: err.message });
    }
  });

  app.post("/api/v1/push/send", async (req, res) => {
    try {
      const { recipientId, title, body, data } = req.body;
      if (!recipientId) {
        return res.status(400).json({ error: "Destinatário/recipientId obrigatório." });
      }

      const subsSnapshot = await db.collection("push_subscriptions").where("userId", "==", recipientId).get();

      if (subsSnapshot.empty) {
        return res.json({ success: true, message: "Sem inscrições push ativas para este usuário.", sentCount: 0 });
      }

      let sentCount = 0;
      let expiredCount = 0;

      const payload = JSON.stringify({
        title: title || "GSA Soluções",
        body: body || "Atualização de processo",
        icon: "/icon.svg",
        badge: "/icon.svg",
        url: data?.url || "/"
      });

      const promises = subsSnapshot.docs.map(async (docSnap) => {
        const subData = docSnap.data();
        try {
          await webpush.sendNotification(subData.subscription, payload);
          sentCount++;
        } catch (pushErr: any) {
          console.warn(`[GSA SW] Erro enviando push para o token:`, pushErr.statusCode);
          // Se o statusCode for 410 (Gone) ou 404 (Not Found), a inscrição expirou e deve ser limpa
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await docSnap.ref.delete();
            expiredCount++;
          }
        }
      });

      await Promise.all(promises);

      return res.json({
        success: true,
        sentCount,
        expiredCount,
        message: `Disparo concluído: ${sentCount} enviados, ${expiredCount} removidos por expiração.`
      });
    } catch (err: any) {
      console.error("Erro ao disparar push notification via WebPush:", err);
      return res.status(500).json({ error: "Falha no disparo do push", details: err.message });
    }
  });
  // --- END PUSH NOTIFICATION ROUTES ---

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
