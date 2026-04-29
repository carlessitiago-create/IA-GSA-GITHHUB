const admin = require('firebase-admin');
admin.initializeApp({projectId: "test"});

const authInstance1 = admin.auth();
authInstance1.verifyIdToken = async () => "patched";

const authInstance2 = admin.auth();
authInstance2.verifyIdToken().then(res => console.log("Result:", res));
