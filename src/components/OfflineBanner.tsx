import React from 'react';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFirestoreCache } from '../hooks/useFirestoreCache';

export const OfflineBanner: React.FC = () => {
  const { isOffline } = useFirestoreCache();

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
    </AnimatePresence>
  );
};


