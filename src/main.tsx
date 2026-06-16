import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { db } from './firebase';
import { AuthProvider } from './components/AuthContext.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

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
