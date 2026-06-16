import admin from "firebase-admin";
import path from "path";
import fs from "fs";

let db: admin.firestore.Firestore;

export function initializeFirebase() {
  if (!admin.apps.length) {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    let projectId = null;
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        projectId = config.projectId;
      } catch (err) {}
    }

    try {
      if (projectId) {
        admin.initializeApp({ projectId });
        console.log(`[FIREBASE] Initialized with config projectId: ${projectId}`);
      } else {
        admin.initializeApp();
        console.log("[FIREBASE] Initialized with default application credentials.");
      }
    } catch (e: any) {
      console.error("[FIREBASE] Failed default/project initialization", e);
    }
  }

  try {
    db = admin.firestore();
  } catch (dbError: any) {
    console.error("[FIREBASE] Failed to instantiate Firestore database:", dbError);
  }

  return { admin, db };
}

export { db };
