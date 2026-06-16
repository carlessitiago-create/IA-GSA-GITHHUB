import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logErrorToFirestore } from '../utils/errorLogger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Helper function to log errors
const logReactError = async (error: Error, errorInfo: React.ErrorInfo) => {
  await logErrorToFirestore({
    type: 'react_render_error',
    message: error.message,
    stack: error.stack || null,
    componentStack: errorInfo.componentStack || null
  });
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    logReactError(error, errorInfo);

    // Auto-reload on dynamic import / chunk load errors
    const errorMsg = error?.message || '';
    if (
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('ChunkLoadError') ||
      errorMsg.includes('error loading dynamically imported')
    ) {
      const lastReload = sessionStorage.getItem('gsa_last_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        sessionStorage.setItem('gsa_last_chunk_reload', String(now));
        console.warn('Auto-reloading on dynamic import failure caught by ErrorBoundary...');
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      let isPermissionError = false;

      try {
        if (this.state.error?.message) {
          errorMessage = this.state.error.message;
          try {
            const parsed = JSON.parse(this.state.error.message);
            if (parsed.error && parsed.error.includes('permission-denied')) {
              errorMessage = 'Você não tem permissão para acessar estes dados ou sua sessão expirou.';
              isPermissionError = true;
            }
          } catch (e) {
            // Not a JSON error
          }
        }
      } catch (e) {
        // Fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
            <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Ops! Algo deu errado</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-[#0a0a2e] text-white rounded-xl font-bold hover:bg-opacity-90 transition-all"
              >
                <RefreshCw size={18} />
                Recarregar Página
              </button>
              {isPermissionError && (
                <button
                  onClick={() => {
                    localStorage.clear();
                    window.location.href = '/';
                  }}
                  className="w-full py-3 px-6 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Voltar ao Início
                </button>
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-50">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Módulo de Segurança GSA</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
