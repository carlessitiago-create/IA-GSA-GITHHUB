
const admin = require('firebase-admin');
const serviceAccount = require('./functions/service-account.json'); // Assumindo que existe, ou configurando de outra forma

// Esta é uma simulação, pode ser necessário adaptar para o seu ambiente
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testarCriacaoVendaAdministrativa() {
  try {
    // Simular o comportamento do Cloud Function
    const cliente = { nome: "Teste Interno", cpf: "12345678900", nasc: "1990-01-01" };
    const servicoId = "servico123";
    const vendedorId = null; // Testar com null
    const dataServico = "2026-04-22";

    const batch = db.batch();
    
    // 1. Criar novo cliente
    const clientRef = db.collection('clients').doc();
    batch.set(clientRef, {
        nome_completo: cliente.nome,
        cpf: cliente.cpf,
        data_nascimento: cliente.nasc,
        especialista_id: vendedorId,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 2. Registrar venda
    const vendaRef = db.collection('sales').doc();
    batch.set(vendaRef, {
        cliente_id: clientRef.id,
        vendedor_id: vendedorId,
        valor_total: 0,
        metodo_pagamento: 'MANUAL',
        status_pagamento: 'Confirmado',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        protocolo: `ADM-${Date.now()}`
    });

    // 3. Criar processo em produção
    const processRef = db.collection('order_processes').doc();
    batch.set(processRef, {
        venda_id: vendaRef.id,
        servico_id: servicoId,
        cliente_id: clientRef.id,
        vendedor_id: vendedorId,
        status_atual: 'Ativo',
        data_execucao: dataServico,
        data_venda: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    console.log("Sucesso: Venda administrativa criada!");
  } catch (error) {
    console.error("Erro ao simular:", error);
  }
}

testarCriacaoVendaAdministrativa();
