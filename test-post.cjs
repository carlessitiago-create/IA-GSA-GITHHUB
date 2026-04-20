async function runTest() {
  try {
     const axios = require('axios');
     console.log("Sending POST...");
     const res = await axios.post('http://localhost:3000/processarVendaSegura', {
        data: { clienteId: "123", servicoId: "manual", valorVendaFinal: 100, metodoPagamento: "CARTEIRA" }
     });
     console.log("Response:", res.data);
  } catch(e) {
     console.log("Error:", e.response ? e.response.data : e.message);
  }
}
runTest();
