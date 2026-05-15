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
      const { transactionAmount, description, clientEmail } = req.body;

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

  // --- BEGIN EXTERNAL CONSULTATION API ---
  app.post("/api/consultations/execute", async (req, res) => {
    try {
      const { provider, searchParam } = req.body;
      
      console.log(`Executing consultation. Provider: ${provider}, Param: ${searchParam}`);
      
      // Simulate API call delay
      await new Promise(r => setTimeout(r, 2000));
      
      // Mock result (in a real system, you would call the external API using Axios/Fetch and your backend API key here)
      let resultData: any = {
         status_api: "sucesso",
         data_consulta: new Date().toISOString()
      };
      
      if (searchParam && searchParam !== 'none') {
         resultData.parametro_informado = searchParam;
      }
      
      if (provider.toLowerCase().includes('veicular') || provider.toLowerCase().includes('placa')) {
          resultData = {
              ...resultData,
              veiculo: "CHEVROLET PRISMA 1.4 MT LT",
              ano: "2019/2019",
              chassi: "9BG********5432",
              renavam: "0123456789",
              restricao_roubo_furto: "NADA CONSTA",
              debito_ipva: "R$ 0,00",
              multas: "R$ 130,16",
              leilao: "NADA CONSTA",
              sinistro: "NADA CONSTA",
          };
      } else {
          resultData = {
              ...resultData,
              nome_completo: "JOÃO SILVA SAURO",
              situacao_cpf: "REGULAR",
              score_credito: "784 (Bom)",
              restricoes_spc_serasa: "0",
              valor_estimado_dividas: "R$ 0,00",
              protestos_cartorio: "NADA CONSTA"
          };
      }
      
      res.json({ success: true, result_data: resultData });
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
