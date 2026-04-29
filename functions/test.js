const admin = require('firebase-admin');
admin.initializeApp({ projectId: "demo-test" });

function cleanDataForFirestore(obj, isRoot = true) {
    if (obj === null || obj === undefined) return isRoot ? {} : undefined;
    
    if (typeof obj === 'number') return isFinite(obj) ? obj : 0;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(v => cleanDataForFirestore(v, false)).filter(v => v !== undefined);
    }

    if (obj instanceof admin.firestore.FieldValue) return obj;
    if (obj instanceof admin.firestore.Timestamp || obj instanceof Date) return obj;
    
    const constructorName = obj.constructor?.name;
    if (constructorName && !['Object', 'Array'].includes(constructorName)) return obj;

    const result = {};
    let hasData = false;
    
    Object.keys(obj).forEach((key) => {
        const val = cleanDataForFirestore(obj[key], false);
        if (val !== undefined) {
            result[key] = val;
            hasData = true;
        }
    });
    
    if (!isRoot && !hasData) return undefined;
    
    return result;
}

try {
  const data = cleanDataForFirestore({
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    test: "string"
  });
  console.log("Success:", data);
} catch (e) {
  console.error("Crash:", e);
}
