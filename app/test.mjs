import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

process.env.GOOGLE_CLOUD_PROJECT = config.projectId;

const firebaseApp = admin.initializeApp({
    projectId: config.projectId
});

const db = getFirestore(firebaseApp, config.firestoreDatabaseId || "(default)");

async function test() {
  try {
    const doc = await db.collection('consultation_types').limit(1).get();
    console.log("SUCCESS:", doc.docs.length);
  } catch(e) {
    console.error("ERROR:", e.message);
  }
}
test();
