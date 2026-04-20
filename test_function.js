const http = require('http');

const req = http.request('http://127.0.0.1:5001/gsa-firebase-project/us-central1/processarVendaSegura', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => console.log('Response:', data));
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(JSON.stringify({ data: { clienteId: '123', servicoId: 'manual', valorVendaFinal: 100, metodoPagamento: 'PIX'} }));
req.end();
