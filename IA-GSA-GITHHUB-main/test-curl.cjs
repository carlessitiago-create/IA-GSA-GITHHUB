const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server.ts']);

server.stdout.on('data', d => {
  console.log("SERVER LOG:", d.toString());
  if (d.toString().includes('Server running')) {
     const exec = require('child_process').exec;
     exec(`curl -v -s -X POST http://localhost:3000/processarVendaSegura -H "Content-Type: application/json" -d '{"data": {"test": true}}'`, (err, stdout, stderr) => {
         console.log("CURL STDOUT:", stdout);
         setTimeout(() => {
             server.kill();
             process.exit(0);
         }, 500);
     });
  }
});
