const { exec } = require('child_process');
const mockToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1aWQiOiJmYWtlLW1vY2sifQ.";
exec(`curl -v -s -X POST http://localhost:3000/processarVendaSegura -H "Content-Type: application/json" -d '{"data": {"_devToken": "${mockToken}", "clienteId": "123", "servicoId": "456", "valorVendaFinal": 100}}'`, (err, stdout, stderr) => {
    console.log("CURL OUT:", stdout);
});
