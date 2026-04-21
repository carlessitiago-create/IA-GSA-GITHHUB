const admin = require('firebase-admin');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

// Only initialize if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: config.projectId,
        databaseURL: `https://${config.projectId}.firebaseio.com`
    });
}

const db = admin.firestore();
db.settings({ databaseId: config.firestoreDatabaseId });

async function run() {
    try {
        console.log("Criando serviços SaaS no banco de dados...");
        
        await db.collection('services').doc('diag_credito').set({
            nome: 'Diagnóstico de Crédito (SaaS)',
            nome_servico: 'Diagnóstico de Crédito (SaaS)',
            preco_base_vendedor: 0,
            preco_base_gestor: 0,
            is_mass_sale_active: false,
            modelo_id: '',
            documentos: [],
            campos: [],
            descricao: 'Criado via script automático para o SaaS.',
            ativo: true
        }, { merge: true });

        await db.collection('services').doc('diag_saas').set({
            nome: 'Serviço GSA SaaS',
            nome_servico: 'Serviço GSA SaaS',
            preco_base_vendedor: 0,
            preco_base_gestor: 0,
            is_mass_sale_active: false,
            modelo_id: '',
            documentos: [],
            campos: [],
            descricao: 'Criado via script automático para o SaaS.',
            ativo: true
        }, { merge: true });

        console.log("Serviços diag_credito e diag_saas criados com sucesso!");
        process.exit(0);
    } catch (e) {
        console.error("Erro ao criar serviços:", e);
        process.exit(1);
    }
}
run();
