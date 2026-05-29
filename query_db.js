import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-adminsdk.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const users = await db.collection('usuarios').where('cpf', '==', '055.978.690-51').get();
  console.log("Usuarios:");
  users.forEach(doc => console.log(doc.id, doc.data().cpf, "DOB:", doc.data().data_nascimento));

  const users2 = await db.collection('usuarios').where('cpf', '==', '05597869051').get();
  console.log("Usuarios sem mascara:");
  users2.forEach(doc => console.log(doc.id, doc.data().cpf, "DOB:", doc.data().data_nascimento));

  const procs = await db.collection('order_processes').where('cliente_cpf_cnpj', '==', '055.978.690-51').get();
  console.log("Processos mascara:");
  procs.forEach(doc => console.log(doc.id, doc.data().cliente_cpf_cnpj, "DOB:", doc.data().data_nascimento));

  const procs2 = await db.collection('order_processes').where('cliente_cpf_cnpj', '==', '05597869051').get();
  console.log("Processos sem mascara:");
  procs2.forEach(doc => console.log(doc.id, doc.data().cliente_cpf_cnpj, "DOB:", doc.data().data_nascimento));
}
run();
