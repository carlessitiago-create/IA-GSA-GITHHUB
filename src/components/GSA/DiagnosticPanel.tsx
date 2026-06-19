import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { collection, getDocs, limit, query, onSnapshot } from 'firebase/firestore';
import { Wifi, WifiOff, Database, AlertTriangle, Activity, Terminal, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportCollectionToJSON, exportCollectionToCSV } from '../../services/maintenanceService';

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
  const [exporting, setExporting] = useState<string | null>(null);
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

  const handleExport = async (collection: string, format: 'json' | 'csv') => {
    const key = `${collection}_${format}`;
    setExporting(key);
    addLog(`Exportando ${collection} para ${format.toUpperCase()}...`, 'info');
    try {
      if (format === 'json') {
        await exportCollectionToJSON(collection);
      } else {
        await exportCollectionToCSV(collection);
      }
      addLog(`Exportação de ${collection} finalizada com sucesso.`, 'success');
    } catch (e: any) {
      addLog(`Erro ao exportar ${collection}: ${e.message}`, 'error');
    } finally {
      setExporting(null);
    }
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

  const seedTestAdmin = async () => {
    setLoading(true);
    addLog('Iniciando SEED do Usuário Teste Admin...', 'info');
    try {
      const { doc, setDoc, getDoc } = await import('firebase/firestore');
      const uid = "teste@gsa.com.br_uid_aqui";
      const docRef = doc(db, 'usuarios', uid);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        await setDoc(docRef, {
          uid: uid,
          email: "teste@gsa.com.br",
          nome_completo: "Teste Admin",
          nivel: "ADM_MASTER",
          status_conta: "APROVADO",
          cpf: "000.000.000-00",
          data_nascimento: "1990-01-01",
          telefone: "54999999999",
          tem_empresa: false,
          ativo: true,
          data_cadastro: new Date()
        });
        addLog(`Usuário Teste Admin criado com UID: ${uid}`, 'success');
      } else {
        addLog('Usuário Teste Admin já existe no banco.', 'warn');
      }
      await checkConnectivity();
    } catch (e: any) {
      addLog(`Erro no SEED: ${e.message}`, 'error');
    } finally {
      setLoading(false);
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            className={`w-full py-2 rounded-xl text-[10px] font-black uppercase transition-all mb-2 ${
              rescuing ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
            }`}
          >
            {rescuing ? 'Resgatando...' : 'Tentar Resgatar Dados Perdidos'}
          </button>

          <button 
            onClick={seedTestAdmin}
            disabled={loading}
            className={`w-full py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
              loading ? 'bg-slate-100 text-slate-400' : 'bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-600/20'
            }`}
          >
            {loading ? 'Processando...' : 'Seed: Criar Usuário Teste Admin'}
          </button>
        </div>
      </div>

      {/* Backup & Export Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 p-2 rounded-xl">
            <Download className="text-purple-500" />
          </div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Backup e Exportação</h3>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
              <Activity size={12} /> Coleção: Usuários
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => handleExport('usuarios', 'json')}
                disabled={exporting === 'usuarios_json'}
                className="flex-1 bg-white border border-slate-200 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
                title="Exportar como JSON"
              >
                <FileJson size={14} className="text-purple-500" /> JSON
              </button>
              <button 
                onClick={() => handleExport('usuarios', 'csv')}
                disabled={exporting === 'usuarios_csv'}
                className="flex-1 bg-white border border-slate-200 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
                title="Exportar como CSV"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" /> CSV
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
              <Activity size={12} /> Coleção: Processos
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => handleExport('order_processes', 'json')}
                disabled={exporting === 'order_processes_json'}
                className="flex-1 bg-white border border-slate-200 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
              >
                <FileJson size={14} className="text-purple-500" /> JSON
              </button>
              <button 
                onClick={() => handleExport('order_processes', 'csv')}
                disabled={exporting === 'order_processes_csv'}
                className="flex-1 bg-white border border-slate-200 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" /> CSV
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
              <AlertTriangle size={12} /> Logs de Erro/Audit
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => handleExport('conflict_logs', 'json')}
                disabled={exporting === 'conflict_logs_json'}
                className="flex-1 bg-white border border-slate-200 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
              >
                JSON
              </button>
              <button 
                onClick={() => handleExport('logs_erro', 'json')}
                disabled={exporting === 'logs_erro_json'}
                className="flex-1 bg-white border border-slate-200 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
              >
                Erros
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Card */}
      <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 flex flex-col h-[300px] md:h-auto border border-white/5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Terminal size={14} className="text-emerald-500" /> Termo-Diagnóstico
          </h3>
          <span className="text-[9px] font-mono text-white/30">{logs.length} entries</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-white/10 pr-2">
          <AnimatePresence initial={false}>
            {logs.length === 0 ? (
              <p className="text-white/20 text-[10px] italic">Monitorando transações...</p>
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
                  <span className="font-bold">{log.msg}</span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
