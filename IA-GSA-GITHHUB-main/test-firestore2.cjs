const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDocFromServer } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
    try {
        console.log("Start:", Date.now());
        const snap = await getDocFromServer(doc(db, 'platform_config', 'saas_settings'));
        console.log("Got Data at:", Date.now());
        process.exit(0);
    } catch (e) {
        console.error("Error: ", e);
        process.exit(1);
    }
}
test();
