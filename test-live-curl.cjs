const exec = require('child_process').exec;
exec(`curl -v -s -X POST http://localhost:3000/processarVendaSegura -H "Content-Type: application/json" -d '{"data": {"test": true}}'`, (err, stdout, stderr) => {
   console.log("CURL STDOUT:", stdout);
});
