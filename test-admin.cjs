const admin = require('firebase-admin');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
admin.initializeApp({
    projectId: config.projectId
});

const db = admin.firestore();

async function test() {
    try {
        console.log("Fetching fake user...");
        const doc = await db.collection('usuarios').doc('fake-mock').get();
        console.log("Exists:", doc.exists);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
