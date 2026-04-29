const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp();
const app = admin.apps[0];

try {
  const db = getFirestore(app, 'does-not-exist-1234');
  console.log("Success! DB instance created.");
} catch (e) {
  console.log("Threw synchronously: ", e.message);
}
