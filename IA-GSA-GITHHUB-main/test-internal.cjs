const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server.ts']);

server.stdout.on('data', d => {
  console.log(d.toString());
  if (d.toString().includes('Server running')) {
     runTest();
  }
});
server.stderr.on('data', d => console.error(d.toString()));

async function runTest() {
  try {
     const axios = require('axios');
     const res = await axios.post('http://localhost:3000/processarVendaSegura', {
        data: { clienteId: "123", servicoId: "manual", valorVendaFinal: 100, metodoPagamento: "CARTEIRA" }
     });
     console.log("Response:", res.data);
  } catch(e) {
     console.log("Error:", e.response ? e.response.data : e.message);
  }
  
  setTimeout(() => {
     server.kill();
     process.exit(0);
  }, 1000);
}
