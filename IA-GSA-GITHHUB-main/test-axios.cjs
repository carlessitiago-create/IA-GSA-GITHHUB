const axios = require('axios');

async function run() {
    try {
        const res = await axios.post('http://localhost:3000/processarVendaSegura', {
            data: { clienteId: "123", servicoId: "456", valorVendaFinal: 100, metodoPagamento: "PIX", _devToken: "my-token" }
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("Success:", res.data);
    } catch (e) {
        console.log("Axios error:", e.response?.data);
    }
}
run();
