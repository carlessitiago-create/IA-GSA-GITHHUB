async function testVendaSegura() {
  try {
    const res = await fetch('http://localhost:3000/gen-lang-client-0086269527/us-central1/processarVendaSegura', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          clienteId: "123",
          servicoId: "manual",
          valorVendaFinal: 10,
          metodoPagamento: "CARTEIRA"
        }
      })
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (err) {
    console.log("Network error:", err.message);
  }
}

testVendaSegura();
