const axios = require('axios');

async function test() {
  try {
     const res = await axios.post('http://localhost:3000/processarVendaSegura', {
        data: { clienteId: "123", servicoId: "manual", valorVendaFinal: 100, metodoPagamento: "CARTEIRA" }
     });
     console.log("Response:", res.data);
  } catch(e) {
     console.log("==== HTTP ERROR ====");
     console.log("Status:", e.response?.status);
     console.log("Data:", e.response?.data);
  }
}
test();
