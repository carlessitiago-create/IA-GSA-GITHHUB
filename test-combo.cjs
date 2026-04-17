const { spawn } = require('child_process');
const axios = require('axios');

async function testServer() {
  console.log("Starting server...");
  const server = spawn('npx', ['tsx', 'server.ts']);
  
  let started = false;
  
  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log("[SERVER OUT]", output);
    if (output.includes('running on http://localhost:3000') && !started) {
      started = true;
      runTests();
    }
  });

  server.stderr.on('data', (data) => {
    console.log("[SERVER ERR]", data.toString());
  });

  async function runTests() {
    try {
      console.log("Testing /ping ...");
      const ping = await axios.get('http://localhost:3000/ping');
      console.log("PING:", ping.data);
      
      console.log("Testing POST ...");
      const res = await axios.post('http://localhost:3000/gen-lang-client-0086269527/us-central1/processarVendaSegura', {
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
