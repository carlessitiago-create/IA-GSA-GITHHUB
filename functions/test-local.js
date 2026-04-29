const admin = require('firebase-admin');
const config = require('../firebase-applet-config.json');

// Initialize admin
admin.initializeApp({
    projectId: config.projectId
});

const { processarVendaSegura } = require('./lib/index.js');

async function test() {
    console.log("Ready to test processarVendaSegura!", typeof processarVendaSegura);
    try {
        const req = {
            data: {
                clienteId: "123",
                servicoId: "manual",
                valorVendaFinal: 100,
                metodoPagamento: "PIX",
                isBulk: false,
                quantidade: 1
            },
            auth: {
                uid: "admin123"
            }
        };

        const result = await processarVendaSegura.run(req);
        console.log("Result:", result);
    } catch(e) {
        console.error("Caught error:", e);
    }
}
test();
