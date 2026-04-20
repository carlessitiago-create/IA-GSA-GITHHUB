const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.use((req, res, next) => {
    console.log("Method:", req.method);
    console.log("Body:", req.body);
    console.log("Body.data:", req.body?.data);
    let contentType = (req.header("Content-Type") || "").toLowerCase();
    const semiColon = contentType.indexOf(";");
    if (semiColon >= 0) {
        contentType = contentType.slice(0, semiColon).trim();
    }
    console.log("Parsed CType:", contentType);
    next();
});

app.post('/test', (req, res) => {
    if (!req.body) return res.send("No body");
    if (req.method !== 'POST') return res.send("No post");
    let contentType = (req.header("Content-Type") || "").toLowerCase();
    const semiColon = contentType.indexOf(";");
    if (semiColon >= 0) {
        contentType = contentType.slice(0, semiColon).trim();
    }
    if (contentType !== "application/json") return res.send("No json");
    if (typeof req.body.data === "undefined") return res.send("No data");
    res.send("VALID");
});

const server = app.listen(3001, () => {
    const exec = require('child_process').exec;
    exec(`curl -v -s -X POST http://localhost:3001/test -H "Content-Type: application/json" -d '{"data": {"test": true}}'`, (err, stdout, stderr) => {
        console.log("CURL:", stdout);
        server.close();
        process.exit(0);
    });
});
