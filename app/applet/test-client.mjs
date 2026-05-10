import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import fs from 'fs';
import path from 'path';

let config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    console.log("Testing client SDK");
    await setDoc(doc(db, "consultation_requests", "tests"), { foo: "bar" });
    console.log("SUCCESS");
  } catch(e) {
    console.error("ERROR:", e.message);
  }
}
test();
