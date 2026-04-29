const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server.ts']);

server.stdout.on('data', d => {
  process.stdout.write("SERVER LOG: " + d.toString());
  if (d.toString().includes('Server running')) {
     const exec = require('child_process').exec;
     
     // fetch token to trigger logic
     const mockToken = "owner";
     
     exec(`curl -v -s -X POST http://localhost:3000/processarVendaSegura -H "Content-Type: application/json" -d '{"data": {"_devToken": "${mockToken}", "clienteId": "123", "servicoId": "456", "valorVendaFinal": 100}}'`, (err, stdout, stderr) => {
         console.log("CURL STDOUT:", stdout);
         setTimeout(() => {
             server.kill();
             process.exit(0);
         }, 1000);
     });
  }
});
server.stderr.on('data', d => {
  process.stderr.write("SERVER ERR: " + d.toString());
});
