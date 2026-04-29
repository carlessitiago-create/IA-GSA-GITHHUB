const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server.ts']);

server.stdout.on('data', d => {
  process.stdout.write("SERVER LOG: " + d.toString());
});
server.stderr.on('data', d => {
  process.stderr.write("SERVER ERR: " + d.toString());
});
