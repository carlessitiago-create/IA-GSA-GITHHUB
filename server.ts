import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';

// Initialize Firebase Admin first if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "gen-lang-client-0086269527"
    });
}

// We will dynamically import the functions later
// import * as myFunctions from './functions/index.js'; // Needs compilation or tsx

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Provide firebase-admin with the correct config so verifyIdToken succeeds
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: config.projectId });
  }

  // ALL EMULATOR FLAGS REMOVED: We need real token signature validation on Google's live RSA servers.
  delete process.env.FIREBASE_DEBUG_MODE;
  delete process.env.FIREBASE_DEBUG_FEATURES;
  delete process.env.FUNCTIONS_EMULATOR;

  // Removed spammy global request logger

  app.use(cors({ origin: true }));
  app.use(express.json());

  // Conforme diagnóstico: removemos a pseudo-emulação em favor do Firebase real (nuvem)

  // Mount Firebase Cloud Functions dynamically has been REMOVED. 
  // We use real deployed backend.

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
    app.get('*all', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
