const { exec } = require('child_process');
const mockToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1aWQiOiJmYWtlLW1vY2sifQ.";
exec(`curl -v -s -X POST http://localhost:3000/gerarPagamentoAsaas -H "Content-Type: application/json" -d '{"data": {"_devToken": "${mockToken}", "valor": 100, "nome": "Test", "email": "test@test.com", "cpf": "11122233344", "vendaId": "v123", "descricao": "desc"}}'`, (err, stdout, stderr) => {
    console.log("CURL OUT:", stdout);
});
