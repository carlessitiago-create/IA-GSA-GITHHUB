import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { collection, getDocs, limit, query, onSnapshot } from 'firebase/firestore';
import { Wifi, WifiOff, Database, AlertTriangle, Activity, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DiagnosticLog {
  id: string;
  msg: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

export const DiagnosticPanel: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [firestoreStatus, setFirestoreStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [counts, setCounts] = useState<{ usuarios: number; processos: number }>({ usuarios: 0, processos: 0 });
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [rescuing, setRescuing] = useState(false);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string, type: DiagnosticLog['type'] = 'info') => {
    const newLog: DiagnosticLog = {
      id: Math.random().toString(36).substr(2, 9),
      msg,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const rescueData = async () => {
    const user = auth.currentUser;
    if (!user) {
      addLog('Usuário não autenticado para resgate', 'error');
      return;
    }

    setRescuing(true);
    addLog(`Iniciando resgate de dados para ${user.uid}...`, 'info');
    
    try {
      const { rescueHistoryByEmail, vincularHistoricoPublico } = await import('../../services/userService');
      
      let count = 0;
      if (user.email) {
        addLog(`Buscando por Email: ${user.email}...`, 'info');
        count += await rescueHistoryByEmail(user.uid, user.email);
      }
      
      // Se tivermos CPF no perfil de fallback ou logado, tentamos por ele também
      // Buscamos o documento do usuário para ver se tem CPF
      const { getDoc, doc } = await import('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      const cpf = userDoc.data()?.cpf;
      
      if (cpf) {
        addLog(`Buscando por CPF: ${cpf}...`, 'info');
        await vincularHistoricoPublico(user.uid, cpf);
      }

      addLog(`Resgate concluído. Registros processados.`, 'success');
      await checkConnectivity();
    } catch (e: any) {
      addLog(`Erro no resgate: ${e.message}`, 'error');
    } finally {
      setRescuing(false);
    }
  };

  const checkConnectivity = async () => {
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      addLog('Navegador reporta estado OFFLINE', 'warn');
      setFirestoreStatus('disconnected');
      return;
    }

    setLoading(true);
    addLog('Testando latência do Firestore...', 'info');
    
    try {
      const start = Date.now();
      // Setup a small listener to track metadata/connectivity
      const q = query(collection(db, 'usuarios'), limit(1));
      const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        const fromCache = snap.metadata.fromCache;
        setFirestoreStatus(fromCache ? 'reconnecting' : 'connected');
        addLog(`Sync: ${fromCache ? 'Lendo do Cache (OFFLINE)' : 'Conectado ao Servidor (LIVE)'}`, fromCache ? 'warn' : 'success');
      }, (err) => {
        addLog(`Erro de Escuta Firestore: ${err.message}`, 'error');
      });

      // Probe query for counts
      const usersSnap = await getDocs(collection(db, 'usuarios'));
      const procSnap = await getDocs(collection(db, 'order_processes'));
      
      setCounts({
        usuarios: usersSnap.size,
        processos: procSnap.size
      });
      addLog(`Capturado: ${usersSnap.size} usuários, ${procSnap.size} processos.`, 'success');

      // Cleanup listener after 1 minute or on next check
      setTimeout(() => unsubscribe(), 60000);

    } catch (error: any) {
      setFirestoreStatus('reconnecting');
      addLog(`Erro de Conexão Firestore: ${error.message}`, 'error');
      console.error('[Diagnostic] Probe Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addLog('Conexão de rede restaurada', 'success');
      checkConnectivity();
    };
    const handleOffline = () => {
      setIsOnline(false);
      addLog('Conexão de rede perdida!', 'error');
      setFirestoreStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkConnectivity();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Network Status Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="bg-slate-50 p-2 rounded-xl">
            {isOnline ? <Wifi className="text-emerald-500" /> : <WifiOff className="text-red-500" />}
          </div>
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }} 
            transition={{ repeat: Infinity, duration: 2 }}
            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
              isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {isOnline ? 'On-line' : 'Off-line'}
          </motion.div>
        </div>
        
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Status da Rede</h3>
          <p className="text-lg font-black text-slate-900 italic">
            {isOnline ? 'Conectado à Internet' : 'Sem acesso à rede'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            firestoreStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
            firestoreStatus === 'reconnecting' ? 'bg-amber-500 animate-bounce' :
            'bg-red-500'
          }`} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
            Firestore: {firestoreStatus === 'connected' ? 'Ativo & Sincronizado' : 
                        firestoreStatus === 'reconnecting' ? 'Reconectando...' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Database Counts Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="bg-slate-50 p-2 rounded-xl">
            <Database className="text-blue-500" />
          </div>
          <button 
            onClick={checkConnectivity}
            disabled={loading}
            className="text-[10px] font-black text-blue-600 hover:underline uppercase"
          >
            {loading ? 'Consultando...' : 'Atualizar'}
          </button>
        </div>

        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Integridade de Dados</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Usuários</p>
              <p className="text-2xl font-black text-slate-900">{counts.usuarios}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Processos</p>
              <p className="text-2xl font-black text-slate-900">{counts.processos}</p>
            </div>
          </div>

          <button 
            onClick={rescueData}
            disabled={rescuing}
            className={`w-full py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
              rescuing ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
            }`}
          >
            {rescuing ? 'Resgatando...' : 'Tentar Resgatar Dados Perdidos'}
          </button>
        </div>
      </div>

      {/* Logs Card */}
      <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 flex flex-col h-[200px] border border-white/5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Terminal size={14} className="text-emerald-500" /> Log de Transações
          </h3>
          <span className="text-[9px] font-mono text-white/30">{logs.length} entries</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-white/10 pr-2">
          <AnimatePresence initial={false}>
            {logs.length === 0 ? (
              <p className="text-white/20 text-[10px] italic">Iniciando monitoramento...</p>
            ) : (
              logs.map((log) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`text-[10px] font-mono p-1.5 rounded-lg flex gap-2 ${
                    log.type === 'error' ? 'text-red-400 bg-red-400/10' :
                    log.type === 'warn' ? 'text-amber-400 bg-amber-400/10' :
                    log.type === 'success' ? 'text-emerald-400 bg-emerald-400/10' :
                    'text-blue-300 bg-blue-300/5'
                  }`}
                >
                  <span className="opacity-40 shrink-0">[{log.timestamp}]</span>
                  <span className="font-bold truncate">{log.msg}</span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
