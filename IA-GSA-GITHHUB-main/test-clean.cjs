const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server.ts']);

server.stdout.on('data', d => {
  process.stdout.write(d.toString());
  if (d.toString().includes('Server running')) {
     runTest();
  }
});
server.stderr.on('data', d => process.stderr.write(d.toString()));

async function runTest() {
  try {
     const axios = require('axios');
     const res = await axios.post('http://localhost:3000/processarVendaSegura', {
        data: { clienteId: "123", servicoId: "manual", valorVendaFinal: 100, metodoPagamento: "CARTEIRA" }
     }, {
         headers: {
             "Content-Type": "application/json"
         }
     });
     console.log("Response:", res.data);
  } catch(e) {
     console.log("Error status:", e.response?.status);
     console.log("Error data:", e.response?.data);
  }
  
  setTimeout(() => {
     server.kill();
     process.exit(0);
  }, 1000);
}
