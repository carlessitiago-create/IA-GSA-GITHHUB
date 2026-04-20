const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "gen-lang-client-0086269527"
    });
}

async function verifyToken(token) {
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        console.log("Token verified:", decoded.uid);
    } catch(e) {
        console.error("Token error:", e);
    }
}

// verifyToken(process.argv[2]);
