import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const shouldIgnoreError = (error: any): boolean => {
  const message = (error?.message || error?.reason || error || "").toString().toLowerCase();
  
  const ignorePatterns = [
    /resizeobserver loop limit exceeded/i,
    /script error/i,
    /chrome-extension/i,
    /extension/i,
    /net::err_failed/i, // Generic network failure in browser
    /cancel/i // User often cancels requests
  ];
  
  return ignorePatterns.some(pattern => pattern.test(message));
};

export const logErrorToFirestore = async (errorInfo: any, additionalContext: { uid?: string, route?: string } = {}) => {
  try {
    console.error("Centralized System Error:", errorInfo);
    const payload: any = {
      ...errorInfo,
      ...additionalContext,
      timestamp: serverTimestamp(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // Sanitize payload
    const sanitizedPayload = { ...payload };
    Object.keys(sanitizedPayload).forEach(key => {
      if (sanitizedPayload[key] === undefined) {
        sanitizedPayload[key] = null;
      }
    });

    if (shouldIgnoreError(sanitizedPayload.message || sanitizedPayload.reason)) {
      return;
    }

    try {
      await addDoc(collection(db, "logs_erro"), sanitizedPayload);
    } catch (err) {
      console.error("Falha ao salvar log de erro no Firestore, salvando localmente:", err);
      // Fallback: save to localStorage when offline
      const localLogs = JSON.parse(localStorage.getItem('pending_error_logs') || '[]');
      localLogs.push(sanitizedPayload);
      localStorage.setItem('pending_error_logs', JSON.stringify(localLogs));
    }
  } catch (err) {
    console.error("Erro fatal no logger:", err);
  }
};
