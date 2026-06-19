import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';
import { db } from './firebase';
import { AuthProvider } from './components/AuthContext.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// Initialize Sentry for real-time error tracking and crash reporting
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
Sentry.init({
  dsn: sentryDsn || "", // Sentry is active only if DSN is set, otherwise is a safe no-op
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE || "development",
});

if (sentryDsn) {
  console.log("[Sentry] Inicializado com sucesso.");
} else {
  console.log("[Sentry] DSN não configurado. Monitoramento em modo passivo.");
}

// Register Service Worker for offline capabilities
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => console.log('SW registered: ', registration.scope))
      .catch((error) => console.log('SW registration failed: ', error));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div id="debug-ready" style={{ display: 'none' }}></div>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);
