const axios = require('axios');

async function testVendaSegura() {
  try {
    const res = await axios.post('http://127.0.0.1:3000/gen-lang-client-0086269527/us-central1/processarVendaSegura', {
      data: {
        clienteId: "123",
        servicoId: "manual",
        valorVendaFinal: 10,
        metodoPagamento: "CARTEIRA"
      }
    });
    console.log("Success:", res.data);
  } catch (err) {
    if (err.response) {
      console.log("Error status:", err.response.status);
      console.log("Error response:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.log("Network error:", err.message);
    }
  }
}

testVendaSegura();
