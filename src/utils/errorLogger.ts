import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import * as Sentry from "@sentry/react";

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

    // Set user context in Sentry with rich metadata if available
    const uid = additionalContext.uid || (window as any).__gsa_current_user_id__;
    const route = additionalContext.route || (window as any).__gsa_current_route__;
    const profile = (window as any).__gsa_current_user_profile__;
    const isSimulating = (window as any).__gsa_is_simulating__;

    if (uid) {
      Sentry.setUser({ 
        id: uid,
        email: profile?.email || undefined,
        username: profile?.nome_completo || undefined,
      });

      Sentry.setContext("session_state", {
        nivel: profile?.nivel || "CLIENTE",
        status_conta: profile?.status_conta || "PENDENTE",
        isSimulating: !!isSimulating,
        hasCompany: !!profile?.tem_empresa,
        companyName: profile?.nome_empresa || null,
        saldo_carteira: profile?.saldo_carteira || 0,
        online_status: navigator.onLine ? "online" : "offline",
        current_route: route || window.location.pathname,
        last_active: new Date().toISOString()
      });

      Sentry.setTags({
        user_role: profile?.nivel || "unknown",
        account_status: profile?.status_conta || "unknown",
        is_simulating: String(!!isSimulating),
        route: route || window.location.pathname,
        error_type: errorInfo?.type || "unknown_error"
      });
    } else {
      Sentry.setUser(null);
      Sentry.setContext("session_state", {
        isSimulating: false,
        online_status: navigator.onLine ? "online" : "offline",
        current_route: route || window.location.pathname,
        last_active: new Date().toISOString()
      });
      Sentry.setTags({
        user_role: "anonymous",
        route: route || window.location.pathname,
        error_type: errorInfo?.type || "unknown_error"
      });
    }

    // Capture error in Sentry
    const errorToCapture = errorInfo instanceof Error 
      ? errorInfo 
      : new Error(sanitizedPayload.message || sanitizedPayload.reason || "Erro do Sistema");
      
    Sentry.captureException(errorToCapture, {
      extra: {
        ...sanitizedPayload,
        session_metrics: {
          isOnline: navigator.onLine,
          currentPath: window.location.pathname,
          referrer: document.referrer,
          simulatedUserActive: !!isSimulating
        }
      },
      tags: {
        error_type: errorInfo?.type || "unknown_error",
        route: route || "unknown_route",
      }
    });

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
