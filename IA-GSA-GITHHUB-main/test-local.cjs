const admin = require('firebase-admin');
const config = require('./firebase-applet-config.json');

// Initialize admin
admin.initializeApp({
    projectId: config.projectId
});

const { processarVendaSegura, cleanDataForFirestore } = require('./functions/lib/index.js');

async function test() {
    console.log("Ready to test processarVendaSegura!");
}
test();
