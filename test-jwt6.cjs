const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server.ts']);
let serverOutput = '';

server.stdout.on('data', d => {
  serverOutput += d.toString();
  if (d.toString().includes('Server running')) {
     const exec = require('child_process').exec;
     const mockToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1aWQiOiJmYWtlLW1vY2sifQ.";
     exec(`curl -v -s -X POST http://localhost:3000/processarVendaSegura -H "Content-Type: application/json" -d '{"data": {"_devToken": "${mockToken}", "clienteId": "123", "servicoId": "456", "valorVendaFinal": 100}}'`, (err, stdout, stderr) => {
         console.log("CURL STDOUT:", stdout);
         setTimeout(() => {
             server.kill();
             console.log("--- EXPRESS SERVER FULL STDOUT ---");
             console.log(serverOutput);
             process.exit(0);
         }, 1000);
     });
  }
});
server.stderr.on('data', d => {
  serverOutput += d.toString();
});
