import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

// Global references
let firebaseApp: admin.app.App;

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Load config consistently from workspace root
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let config: any = {};
  if (fs.existsSync(configPath)) {
      try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          // Set essential env var for SDK to pick up project context automatically
          process.env.GOOGLE_CLOUD_PROJECT = config.projectId;
          process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: config.projectId });
          console.log(`[INIT] Project ID set from config: ${config.projectId}`);
      } catch (err) {
          console.error("[INIT] Failed to parse firebase-applet-config.json", err);
      }
  }

  // Initialize Firebase Admin with default credentials (safest for Google Cloud Run)
  if (!admin.apps.length) {
      try {
          firebaseApp = admin.initializeApp();
          console.log(`[INIT] Firebase Admin initialized with default credentials`);
      } catch (err: any) {
          console.error("[INIT] Failed to initialize Firebase Admin, trying with explicit project ID", err);
          firebaseApp = admin.initializeApp({
              projectId: config.projectId || "gen-lang-client-0086269527"
          });
      }
  } else {
      firebaseApp = admin.apps[0]!;
  }

  // Ensure emulator flags are not interfering
  delete process.env.FIREBASE_DEBUG_MODE;
  delete process.env.FIREBASE_DEBUG_FEATURES;
  delete process.env.FUNCTIONS_EMULATOR;

  app.use(cors({ origin: true }));
  app.use(express.json());

  app.post("/api/send-email", async (req, res) => {
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
    } catch (e) {
        console.error("Email error:", e);
        res.status(500).json({ error: "Failed to send email" });
    }
  });

  // --- BEGIN DIRECT ADMIN API ---
  // Administrative API endpoints removed in favor of client-side operations (writeBatch)
  // which handle permissions correctly via the user's authenticated context.
  // --- END DIRECT ADMIN API ---

  // Vite middleware for development (after API routes)
  if (process.env.NODE_ENV !== "production") {
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
