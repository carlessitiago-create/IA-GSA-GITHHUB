import React, { useState } from 'react';
import { WifiOff, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFirestoreCache } from '../hooks/useFirestoreCache';

export const OfflineBanner: React.FC = () => {
  const { isCacheEnabled, isOffline, error } = useFirestoreCache();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <AnimatePresence>
      {/* Offline Banner */}
      {isOffline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium z-[100] sticky top-0"
        >
          <WifiOff className="size-4 animate-pulse" />
          <span>Você está offline. Operando em modo limitado (carregando dados do cache).</span>
        </motion.div>
      )}

      {/* Discrete Cache Failure Banner */}
      {!isCacheEnabled && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-rose-50 border-b border-rose-100 text-rose-700 px-4 py-2 flex flex-col z-[90] sticky top-0"
        >
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="size-4 text-rose-500 shrink-0" />
              <p className="text-xs font-semibold tracking-tight text-rose-900 truncate">
                Instabilidade do Cache Local: 
                <span className="text-rose-600 font-medium ml-1">
                  Persistência local do Firestore indisponível. Seus dados não serão armazenados de forma offline.
                </span>
              </p>
            </div>
            
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-[11px] font-medium underline text-rose-600 hover:text-rose-800 transition-colors whitespace-nowrap"
            >
              <Info className="size-3" />
              {showDetails ? 'Ocultar detalhes' : 'Ver motivo'}
              {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          </div>

          <AnimatePresence>
            {showDetails && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 pt-2 border-t border-rose-150 text-[11px] text-rose-600 leading-relaxed overflow-hidden"
              >
                <p className="font-semibold mb-1">Causa Técnica:</p>
                <p className="font-mono bg-rose-100/50 p-1.5 rounded text-[10px] break-all border border-rose-200/40 select-all mb-2">
                  {error || "IndexedDB está desabilitado/bloqueado em contextos de Iframe privados ou sandboxes de terceiros."}
                </p>
                <p>
                  <strong>Dica de Navegação:</strong> Sandbox IFrames (como a prévia do editor ou conexões dentro de apps de celular) impõem limites rígidos à persistência de cookies e dados. Para ter a melhor experiência com backups locais automáticos, abra o aplicativo em uma <strong>nova aba de navegador</strong>!
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

