const { spawn } = require('child_process');

// A valid JWT format with 3 parts.
const header = Buffer.from(JSON.stringify({alg: "HS256", typ: "JWT"})).toString('base64');
const body = Buffer.from(JSON.stringify({uid: "fake-user-123", email_verified: true, sub: "fake-user"})).toString('base64');
const signature = "fake-sig";
const mockToken = `${header}.${body}.${signature}`;

const server = spawn('npx', ['tsx', 'server.ts']);

server.stdout.on('data', d => {
  process.stdout.write("SERVER: " + d.toString());
  if (d.toString().includes('Server running')) {
     const exec = require('child_process').exec;
     exec(`curl -v -s -X POST http://localhost:3000/processarVendaSegura -H "Content-Type: application/json" -d '{"data": {"_devToken": "${mockToken}", "clienteId": "123", "servicoId": "456", "valorVendaFinal": 100}}'`, (err, stdout, stderr) => {
         console.log("\n--- CURL OUT ---");
         console.log(stdout);
         setTimeout(() => {
             server.kill();
             process.exit(0);
         }, 1000);
     });
  }
});
server.stderr.on('data', d => process.stderr.write("ERR: " + d.toString()));
