import express from 'express';
import cors from 'cors';
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

  app.use(cors({ origin: true }));
  app.use(express.json());
  
  app.use((req, res, next) => {
    console.log(`[EXPRESS] ${req.method} ${req.url}`);
    next();
  });

  // Mount Firebase Cloud Functions dynamically
  try {
      // Execute typescript file directly using tsx or similar, but since we are running via tsx, this import works.
      const backendFunctions = await import('./functions/index.ts');
      
      const projectId = "gen-lang-client-0086269527";
      const region = "us-central1"; // Default region
      
      console.log("Mounting Firebase Cloud Functions locally...");
      for (const [name, fn] of Object.entries(backendFunctions)) {
          if (typeof fn === 'function' && (fn as any).__trigger) {
              const route1 = `/${projectId}/${region}/${name}`;
              const route2 = `/${name}`;
              app.post(route1, (req, res) => {
                  console.log(`[Local API] Calling ${name} via full path`);
                  (fn as any)(req, res);
              });
              app.post(route2, (req, res) => {
                  console.log(`[Local API] Calling ${name} via customDomain`);
                  (fn as any)(req, res);
              });
              console.log(` - Mounted: ${route1} and ${route2}`);
          } else if (typeof fn === 'function') {
              // https.onRequest fallback sometimes doesn't have __trigger in older SDKs or it's just the function itself
              const route = `/${projectId}/${region}/${name}`;
              // For webhookAsaas
              app.all(route, (req, res) => {
                  console.log(`[Local API] Calling Webhook ${name}`);
                  (fn as any)(req, res);
              });
              console.log(` - Mounted Webhook/Request: ${route}`);
          }
      }
  } catch (err) {
      console.error("Failed to mount functions locally:", err);
  }

  // Vite middleware for development (after API routes)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // const distPath = path.join(process.cwd(), 'dist');
    // app.use(express.static(distPath));
    // app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
