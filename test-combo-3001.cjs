const { spawn } = require('child_process');
const axios = require('axios');

async function testServer() {
  console.log("Starting server on 3001...");
  const server = spawn('npx', ['tsx', 'server.ts']);
  
  let started = false;
  
  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log("[SERVER OUT]", output);
    if (output.includes('running on http://localhost:3001') && !started) {
      started = true;
      runTests();
    }
  });

  server.stderr.on('data', (data) => {
    console.log("[SERVER ERR]", data.toString());
  });

  async function runTests() {
    try {
      console.log("Testing POST on 3001 ...");
      const res = await axios.post('http://localhost:3001/gen-lang-client-0086269527/us-central1/processarVendaSegura', {
        data: { clienteId: "123", servicoId: "manual", valorVendaFinal: 10, metodoPagamento: "CARTEIRA" }
      });
      console.log("POST Success:", res.data);
    } catch(e) {
      if(e.response) {
         console.log("POST ERROR STATUS:", e.response.status);
         console.log("POST ERROR BODY:", e.response.data);
      } else {
         console.log("POST EROR:", e.message);
      }
    }
    
    server.kill();
    process.exit(0);
  }
}

testServer();
