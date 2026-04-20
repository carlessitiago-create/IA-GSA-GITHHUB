const express = require('express');
const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const request = require('supertest');

admin.initializeApp({ projectId: 'test-project' });

const testFunction = onCall((request) => {
    return { success: true, uid: request.auth?.uid || null, data: request.data };
});

const app = express();
// firebase-functions v2 onCall handles JSON parsing natively? Actually wait, we should check if we need body-parser.
app.post('/test', testFunction); // the onCall handler is an Express handler

request(app)
    .post('/test')
    .send({ data: { message: "hello" } })
    .end((err, res) => {
        if (err) throw err;
        console.log("Response:", res.body);
    });
