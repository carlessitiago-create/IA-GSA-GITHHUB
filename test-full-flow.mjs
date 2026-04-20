import fetch from 'node-fetch';

async function test() {
    const mockToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1aWQiOiJmYWtlLW1vY2sifQ.";
    
    // Simulate what Firebase SDK httpsCallable does
    const payload = {"data": {"_devToken": mockToken, "clienteId": "123", "servicoId": "456", "valorVendaFinal": 100}};
    
    console.log("Sending payload...");
    const res = await fetch('http://localhost:3000/processarVendaSegura', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
}

test();
