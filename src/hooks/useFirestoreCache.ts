import { useState, useEffect, useCallback } from "react";
import { isPersistenceEnabled, persistenceInitializationError } from "../firebase";

export interface UseFirestoreCacheResult {
  isCacheEnabled: boolean;
  isOffline: boolean;
  indexedDbSupported: boolean;
  error: string | null;
  checkCacheStatus: () => Promise<boolean>;
}

/**
 * Custom hook to monitor internal Firestore cache status, online state,
 * and IndexedDB permission restrictions inside locked sandboxes or iframes.
 */
export function useFirestoreCache(): UseFirestoreCacheResult {
  const [isCacheEnabled, setIsCacheEnabled] = useState<boolean>(isPersistenceEnabled);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [indexedDbSupported, setIndexedDbSupported] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(persistenceInitializationError);

  const checkCacheStatus = useCallback(async (): Promise<boolean> => {
    // 1. Direct verify if Firebase SDK successfully initialized local cache persistence
    if (!isPersistenceEnabled) {
      setIsCacheEnabled(false);
      setError(persistenceInitializationError || "Firestore localCache initialization requested but failed.");
      return false;
    }

    // 2. Perform a runtime check of IndexedDB permissions to detect hidden Iframe/Sandbox storage locks
    try {
      if (!window.indexedDB) {
        setIndexedDbSupported(false);
        setIsCacheEnabled(false);
        setError("IndexedDB no browser ou contêiner está indisponível.");
        return false;
      }

      // Try opening a dummy DB to ensure no Storage Sandbox security exceptions are thrown
      const request = window.indexedDB.open("gsa_cache_verify_db", 1);
      
      return await new Promise<boolean>((resolve) => {
        request.onsuccess = () => {
          setIndexedDbSupported(true);
          setIsCacheEnabled(true);
          setError(null);
          resolve(true);
        };
        request.onerror = (e) => {
          console.warn("[useFirestoreCache] Sandbox block or storage restriction detected via IndexedDB:", e);
          setIndexedDbSupported(false);
          setIsCacheEnabled(false);
          setError("Permissão para IndexedDB foi negada no Sandbox ou Iframe.");
          resolve(false);
        };
      });
    } catch (err: any) {
      console.warn("[useFirestoreCache] Failed to verify IndexedDB capability:", err);
      setIndexedDbSupported(false);
      setIsCacheEnabled(false);
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  useEffect(() => {
    // Run initial check
    checkCacheStatus();

    // Listen to standard online/offline events to enrich metadata
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodically verify cache status if not enabled, or on tab refocus
    const handleFocus = () => {
      checkCacheStatus();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkCacheStatus]);

  return {
    isCacheEnabled,
    isOffline,
    indexedDbSupported,
    error,
    checkCacheStatus
  };
}
