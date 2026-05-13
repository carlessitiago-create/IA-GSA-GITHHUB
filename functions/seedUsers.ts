import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();
const db = getFirestore(app);

const usersToSeed = [
  { email: "larissa@72hrs.online", uid: "9NqSpdb3N8bwv0DxzYaOZr4xMi73" },
  { email: "joice@72hrs.online", uid: "RWlmihQtkaNBG2Cw7I2lBX2dgQA3" },
  { email: "cristiano.clarinda@hotmail.com", uid: "p2ezrM9uD3fpxBvZPIfkrXWjKag2" },
  { email: "shallomconsultoriaevendas@gmail.com", uid: "oZiSg2RRehZUa58GwpijWi40iTj1" },
  { email: "tiago.cliente@teste.com", uid: "tEjPXxSKmOfZlCTli9YT3ilvJ1T2" },
  { email: "icarodpvat@gmail.com", uid: "Wkp37bPXXtSLV69siBb1QYt5Azt1" },
  { email: "parceirosgsa@gmail.com", uid: "uqyLiyhBEXRJQiCNNEMe1B7AuKk1" },
  { email: "atende.amgcard@gmail.com", uid: "mtKXfrdc8thzTGD9Nbd0K5m7AMD3" },
  { email: "analista@teste.com", uid: "HSAnFGgMxoMN34OmLgdFGTM80Ui1" },
  { email: "gestor@teste.com", uid: "AIrg3siNJWhXJtGVJjhbk7nGIwB2" },
  { email: "vendedor@teste.com", uid: "vAXE9L42RzNJQ4b4IafLYmWilz72" },
  { email: "cliente@teste.com", uid: "HwycYR0wDvMrLdY6EgPHnGNgd883" },
  { email: "cliente@admin.com", uid: "E38z99PAUYMhF06DmKLxEnRz1yo2" },
  { email: "nomelimpo.gsa@gmail.com", uid: "CTxusKY1q9UYw0ivCIEAJ46a6Pg2" },
  { email: "atende.gsa@gmail.com", uid: "jTzjOOpsO8NhP6XCj8lZTDBVy0I2" },
  { email: "carlessitiago@gmail.com", uid: "NquWhxPTQ3ZMX4oXR6XHMXZDPOi1" },
];

export async function seedUsers() {
  const batch = db.batch();
  for (const user of usersToSeed) {
    const userRef = db.collection('usuarios').doc(user.uid);
    batch.set(userRef, {
      ...user,
      nivel: user.email === 'carlessitiago@gmail.com' ? 'ADM_MASTER' : 'CLIENTE',
      createdAt: new Date(),
    }, { merge: true });
  }
  await batch.commit();
  console.log('Users seeded successfully');
}
