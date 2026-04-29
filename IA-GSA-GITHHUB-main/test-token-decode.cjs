const admin = require('firebase-admin');

// We test parsing a token inside the server logic:
const originalVerify = admin.auth().verifyIdToken;

admin.auth().verifyIdToken = async (idToken) => {
    try {
        const payloadString = Buffer.from(idToken.split('.')[1], 'base64').toString();
        const payload = JSON.parse(payloadString);
        return payload;
    } catch(e) {
        throw new Error("Invalid format");
    }
};

const tokenBase = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1aWQiOiIxMjMifQ.";
admin.auth().verifyIdToken(tokenBase).then(console.log).catch(console.error);

