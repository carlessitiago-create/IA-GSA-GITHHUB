import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Shield, Activity, RefreshCw, Database, User, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export const AdminDiagnostico: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'error' | 'warn'; time: string }[]>([]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    setLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  };

  const runCheck = async () => {
    setLoading(true);
    addLog('Iniciando Diagnóstico Multi-Camada...', 'info');
    
    try {
      // 1. Check Auth State
      const currentUser = auth.currentUser;
      if (!currentUser) {
        addLog('ERRO: Usuário não autenticado no Firebase Auth.', 'error');
        setDiagnostico(null);
        return;
      }
      addLog(`Auth OK: UID ${currentUser.uid} (${currentUser.email})`, 'success');

      // 2. Check Firestore Doc
      addLog('Consultando Firestore: coleção "usuarios"...', 'info');
      const docRef = doc(db, 'usuarios', currentUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        addLog(`Documento encontrado! Nível: ${data.nivel || 'N/A'}, Status: ${data.status_conta || 'N/A'}`, 'success');
        setDiagnostico({
          uid: currentUser.uid,
          email: currentUser.email,
          ...data,
          lastCheck: new Date().toISOString()
        });
      } else {
        addLog('AVISO: Documento não encontrado na coleção "usuarios".', 'warn');
        setDiagnostico({
          uid: currentUser.uid,
          email: currentUser.email,
          error: 'Documento ausente no Firestore',
          lastCheck: new Date().toISOString()
        });
      }

      // 3. Database Integrity Check
      addLog('Verificando coleções principais...', 'info');
      const collections = ['order_processes', 'clients', 'sales', 'pendencies'];
      for (const coll of collections) {
        try {
          const q = query(collection(db, coll), limit(1));
          const snap = await getDocs(q);
          addLog(`Coleção ${coll}: ${snap.empty ? 'Vazia ou Ilegível' : 'Online'}`, snap.empty ? 'warn' : 'success');
        } catch (e: any) {
          addLog(`ERRO ao ler ${coll}: ${e.message}`, 'error');
        }
      }

    } catch (error: any) {
      addLog(`Erro Crítico no Diagnóstico: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      addLog('Diagnóstico finalizado.', 'info');
    }
  };

  const forceSync = async () => {
    const confirm = await Swal.fire({
      title: 'Forçar Ressincronização?',
      text: 'Isso irá limpar o cache local e buscar todos os dados diretamente do Firestore.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, Resincronizar',
      confirmButtonColor: '#0a0a2e'
    });

    if (confirm.isConfirmed) {
      setLoading(true);
      addLog('Limpando LocalStorage...', 'warn');
      localStorage.removeItem(`profile_${user?.uid}`);
      localStorage.removeItem('pwa_cache_version');
      
      addLog('Acionando refreshProfile do AuthContext...', 'info');
      if (refreshProfile) {
        await refreshProfile();
        addLog('Ressincronização completa. Recarregando dados locais...', 'success');
        await runCheck();
      } else {
        addLog('Erro: refreshProfile não disponível no contexto.', 'error');
      }
      setLoading(false);
      
      Swal.fire('Sincronizado!', 'Os dados foram atualizados com o banco de dados.', 'success');
    }
  };

  const reLinkCpfData = async () => {
    if (!profile?.cpf) {
      Swal.fire('Aviso', 'Você precisa ter um CPF no perfil para vincular dados.', 'warning');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Vincular Dados Legados?',
      text: `Tentaremos encontrar processos e vendas associados ao CPF ${profile.cpf} e vinculá-los a este UID (${profile.uid}).`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Iniciar Vinculação',
      confirmButtonColor: '#0a0a2e'
    });

    if (confirm.isConfirmed) {
      setLoading(true);
      addLog(`Iniciando vinculação para CPF: ${profile.cpf}...`, 'info');
      try {
        const { vincularHistoricoPublico } = await import('../services/userService');
        await vincularHistoricoPublico(profile.uid, profile.cpf);
        addLog('Processo de vinculação finalizado.', 'success');
        Swal.fire('Vinculação Concluída', 'Se existiam dados órfãos associados ao seu CPF, eles foram vinculados à sua conta.', 'success');
      } catch (e: any) {
        addLog(`Erro ao vincular: ${e.message}`, 'error');
        Swal.fire('Erro', 'Falha ao vincular histórico.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const syncAllUsersHistory = async () => {
    const confirm = await Swal.fire({
      title: 'Resincronizar TODOS os Usuários?',
      text: 'Isso irá percorrer todos os usuários com CPF cadastrado e tentar vincular processos órfãos. Esta operação pode levar algum tempo.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, Sincronizar Sistema',
      confirmButtonColor: '#e11d48'
    });

    if (confirm.isConfirmed) {
      setLoading(true);
      addLog('Iniciando Sincronização Global...', 'warn');
      try {
        const { listarTodosUsuarios, vincularHistoricoPublico } = await import('../services/userService');
        const users = await listarTodosUsuarios();
        addLog(`Encontrados ${users.length} usuários. Filtrando quem possui CPF...`, 'info');
        
        const usersWithCpf = users.filter(u => u.cpf);
        addLog(`${usersWithCpf.length} usuários qualificados para vinculação.`, 'info');

        let successCount = 0;
        for (const u of usersWithCpf) {
          try {
            addLog(`Sincronizando ${u.nome_completo || u.email}...`, 'info');
            await vincularHistoricoPublico(u.uid, u.cpf!);
            successCount++;
          } catch (err) {
            addLog(`Erro ao sincronizar ${u.email}: ${err instanceof Error ? err.message : 'Erro'}`, 'error');
          }
        }
        
        addLog(`Sincronização global finalizada! ${successCount} usuários processados.`, 'success');
        Swal.fire('Sucesso!', `Sistema sincronizado com ${successCount} usuários atualizados.`, 'success');
      } catch (e: any) {
        addLog(`Erro Global: ${e.message}`, 'error');
        Swal.fire('Erro', 'Falha na sincronização global.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const runMaintenance = async () => {
    const confirm = await Swal.fire({
      title: 'Executar Manutenção de Dados?',
      text: 'Isso irá verificar todos os documentos por inconsistências e atualizá-los para os schemas mais recentes.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Iniciar Manutenção',
      confirmButtonColor: '#0f172a'
    });

    if (confirm.isConfirmed) {
      setLoading(true);
      try {
        const { runSystemIntegrityMaintenance } = await import('../services/maintenanceService');
        await runSystemIntegrityMaintenance((log) => {
          addLog(log.msg, log.type);
        });
        Swal.fire('Concluído', 'Manutenção de integridade finalizada.', 'success');
      } catch (e: any) {
        addLog(`Erro na Manutenção: ${e.message}`, 'error');
        Swal.fire('Erro', 'Falha na manutenção de dados.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Shield size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
                <Activity className="text-blue-400" size={24} />
              </div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Painel de Diagnóstico</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium">Monitoramento em tempo real do ecossistema GSA Diagnostics.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={runCheck}
              disabled={loading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest border border-white/5"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recarregar
            </button>
            <button 
              onClick={forceSync}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20"
            >
              <Database size={14} /> Forçar Sync
            </button>
            <button 
              onClick={reLinkCpfData}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20"
            >
              <Search size={14} /> Retomar Dados (CPF)
            </button>
            <button 
              onClick={syncAllUsersHistory}
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-600/20"
            >
              <RefreshCw size={14} /> Sincronização Global
            </button>
            <button 
              onClick={runMaintenance}
              disabled={loading}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg"
            >
              <Shield size={14} /> Manutenção de Dados
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <User size={14} className="text-blue-600" /> Status do Usuário
            </h3>
            
            {diagnostico ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">UID Firebase</p>
                  <p className="text-xs font-mono font-bold text-slate-700 break-all">{diagnostico.uid}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nível</p>
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black">{diagnostico.nivel}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {diagnostico.status_conta === 'APROVADO' ? (
                        <CheckCircle size={14} className="text-emerald-500" />
                      ) : (
                        <AlertCircle size={14} className="text-amber-500" />
                      )}
                      <span className="text-xs font-bold text-slate-700">{diagnostico.status_conta}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">CPF Vinculado</p>
                  <p className="text-xs font-bold text-slate-700">{diagnostico.cpf || 'Não informado'}</p>
                </div>

                {diagnostico.error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0" size={18} />
                    <p className="text-xs font-bold text-red-700 leading-tight">ATENÇÃO: {diagnostico.error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-4">
                <Activity size={48} className="animate-pulse opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Aguardando Diagnóstico...</p>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Logs */}
        <div className="lg:col-span-2">
          <div className="bg-white h-[500px] flex flex-col rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Database size={14} className="text-blue-600" /> Log de Sistema (Console)
              </h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-[9px] font-black uppercase">Tempo Real</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono scroll-smooth">
              <AnimatePresence initial={false}>
                {logs.length === 0 ? (
                  <p className="text-slate-300 text-xs italic text-center mt-10">Nenhum log registrado ainda.</p>
                ) : (
                  logs.map((log, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`text-[11px] p-2 rounded-lg flex gap-3 ${
                        log.type === 'error' ? 'bg-red-50 text-red-700' :
                        log.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                        log.type === 'warn' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="opacity-40 shrink-0">[{log.time}]</span>
                      <span className="font-bold">{log.msg}</span>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
