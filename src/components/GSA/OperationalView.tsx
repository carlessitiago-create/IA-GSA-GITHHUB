import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, Clock, Search, Filter, ChevronRight, User, Calendar, FileText, AlertCircle, X, ExternalLink, ShieldCheck, UserCheck, FileDown, Loader2, FolderOpen, AlertTriangle, XCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { listarTodosProcessos, OrderProcess, atualizarStatusProcesso, abrirPendenciaCascata, excluirProcesso } from '../../services/orderService';
import { auth } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { gerarDocumentoProcesso } from '../../services/pdfGeneratorService';
import { getClienteData } from '../../services/leadService';
import { obterModeloProcesso } from '../../services/modelService';
import Swal from 'sweetalert2';
import { useRequirements } from '../../hooks/useRequirements';

export const OperationalView: React.FC = () => {
  const { config: requirementsConfig } = useRequirements();
  const [processos, setProcessos] = useState<OrderProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedProcess, setSelectedProcess] = useState<OrderProcess | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  useEffect(() => {
    const loadClient = async () => {
      if (selectedProcess) {
        const client = await getClienteData(selectedProcess.cliente_id);
        setSelectedClient(client);
      } else {
        setSelectedClient(null);
      }
    };
    loadClient();
  }, [selectedProcess]);

  const handleDownloadPDF = async (processo: OrderProcess) => {
    setGeneratingPdf(true);
    try {
      let cliente = await getClienteData(processo.cliente_id);
      
      if (!cliente) {
        console.warn("Dados do cliente não encontrados na base, usando dados do processo como fallback.");
        // Fallback para dados do processo se o cliente não for encontrado em nenhuma coleção
        cliente = {
          id: processo.cliente_id,
          nome: processo.cliente_nome || 'Não informado',
          documento: processo.cliente_cpf_cnpj || 'Não informado',
          data_nascimento: processo.data_nascimento || '',
          telefone: 'Não informado',
          especialista_id: processo.vendedor_id,
          data_entrada: processo.data_venda
        } as any;
      }
      
      const modelo = processo.modelo_id ? await obterModeloProcesso(processo.modelo_id) : null;
      
      gerarDocumentoProcesso(processo, cliente, modelo);
      
      Swal.fire({
        icon: 'success',
        title: 'PDF Gerado',
        text: 'A ficha técnica foi gerada e o download deve iniciar em instantes.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      Swal.fire('Erro', error.message || 'Falha ao gerar documento.', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDeleteProcess = async (processo: OrderProcess) => {
    const result = await Swal.fire({
      title: 'Excluir Processo?',
      text: `Tem certeza que deseja excluir o processo #${processo.protocolo} de ${processo.cliente_nome}? Esta ação removerá permanentemente o processo, histórico e pendências.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir permanentemente!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        await excluirProcesso(processo.id!);
        Swal.fire('Excluído!', 'O processo foi removido com sucesso.', 'success');
        setSelectedProcess(null);
        
        // Refresh list
        const data = await listarTodosProcessos();
        setProcessos(data);
      } catch (error) {
        console.error("Erro ao excluir processo:", error);
        Swal.fire('Erro', 'Falha ao excluir o processo.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUpdateStatus = async (processo: OrderProcess, novoStatus: OrderProcess['status_atual']) => {
    const oldStatus = processo.status_atual;
    
    if (novoStatus === 'Concluído') {
      const { value: fileUrl } = await Swal.fire({
        title: 'Finalizar Processo',
        text: 'Para concluir, anexe o arquivo (Nada Consta/Comprovante). Isso liberará o resultado no Portal do Cliente.',
        input: 'url',
        inputLabel: 'URL do PDF Final',
        inputPlaceholder: 'https://...',
        showCancelButton: true,
        confirmButtonText: 'Concluir e Notificar Tudo',
        confirmButtonColor: '#10b981',
        cancelButtonText: 'Voltar',
        inputValidator: (value) => {
          if (!value) return 'A URL do arquivo é obrigatória!';
          if (!value.startsWith('http')) return 'A URL deve ser válida!';
        }
      });

      if (fileUrl) {
        try {
          await atualizarStatusProcesso(
            processo.id!,
            novoStatus,
            auth.currentUser!.uid,
            oldStatus,
            fileUrl,
            'Processo concluído com sucesso pelo analista.'
          );

          // Notificar Interessados
          const { sendNotification } = await import('../../services/notificationService');
          const notifyUsers = [processo.cliente_id, processo.vendedor_id];
          for (const uid of notifyUsers) {
            if (uid) {
              await sendNotification({
                usuario_id: uid,
                titulo: '🚀 PROCESSO CONCLUÍDO!',
                mensagem: `Seu processo de ${processo.servico_nome} foi finalizado com sucesso.`,
                tipo: 'PROCESS'
              });
            }
          }

          Swal.fire({
            title: 'PROCESSO ENTREGUE!',
            html: `<div class="text-left text-xs space-y-2">
                    <p>✅ <b>Portal do Cliente:</b> Mensagem de parabéns e garantia ativadas.</p>
                    <p>🔔 <b>Notificação Som:</b> Enviada para o Vendedor.</p>
                    <p>💰 <b>Comissão:</b> Liberada para o Gestor.</p>
                   </div>`,
            icon: 'success'
          });
          // Refresh
          const procs = await listarTodosProcessos();
          setProcessos(procs);
        } catch (error: any) {
          Swal.fire('Erro', error.message || 'Falha ao concluir processo.', 'error');
        }
      }
    } else {
      const { isConfirmed } = await Swal.fire({
        title: 'Confirmar Mudança?',
        text: `O cliente, o vendedor e o gestor serão notificados sobre o status: ${novoStatus}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, Atualizar',
        confirmButtonColor: '#2563eb'
      });

      if (isConfirmed) {
        try {
          await atualizarStatusProcesso(
            processo.id!,
            novoStatus,
            auth.currentUser!.uid,
            oldStatus,
            undefined,
            `Status alterado para ${novoStatus}`
          );

          // Notificar Interessados
          const { sendNotification } = await import('../../services/notificationService');
          const notifyUsers = [processo.cliente_id, processo.vendedor_id];
          for (const uid of notifyUsers) {
            if (uid) {
              await sendNotification({
                usuario_id: uid,
                titulo: '🚀 AVANÇO NO PROCESSO',
                mensagem: `Seu processo de ${processo.servico_nome} avançou para: ${novoStatus}.`,
                tipo: 'PROCESS'
              });
            }
          }

          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Status Atualizado e Equipe Notificada!',
            showConfirmButton: false,
            timer: 2500
          });
          // Refresh
          const procs = await listarTodosProcessos();
          setProcessos(procs);
        } catch (error: any) {
          Swal.fire('Erro', error.message || 'Falha ao atualizar status.', 'error');
        }
      }
    }
  };

  const handleAbrirPendencia = async (processo: OrderProcess) => {
    const { value: descricao } = await Swal.fire({
      title: 'Informar Pendência',
      input: 'textarea',
      inputPlaceholder: 'Descreva o problema (Ex: Documento borrado, CPF inválido no site da RF)...',
      showCancelButton: true,
      confirmButtonText: 'Notificar Vendedor e Gestor',
      confirmButtonColor: '#f59e0b'
    });

    if (descricao) {
      try {
        await abrirPendenciaCascata({
          vendaId: processo.venda_id,
          processo_id: processo.id,
          descricao,
          criado_por_id: auth.currentUser!.uid
        });

        // Notificar Cliente e Equipe
        const { notificarPendenciaManual } = await import('../../services/notificationService');
        await notificarPendenciaManual(processo, processo.cliente_id, descricao);

        Swal.fire('Pendência Aberta', 'O cliente e o vendedor responsável já receberam o alerta.', 'warning');
      } catch (error: any) {
        Swal.fire('Erro', error.message || 'Falha ao abrir pendência.', 'error');
      }
    }
  };

  const handleNotificarPendencias = async (processo: OrderProcess) => {
    const totalCampos = processo.dados_faltantes?.length || 0;
    const totalDocs = processo.pendencias_iniciais?.length || 0;
    const envDocs = processo.documentos_enviados?.length || 0;
    const faltamDocs = totalDocs - envDocs;

    if (totalCampos === 0 && faltamDocs <= 0) {
      Swal.fire('Tudo em Ordem', 'Não há pendências de ficha técnica para este processo.', 'info');
      return;
    }

    try {
      const { notificarPendenciaFicha } = await import('../../services/notificationService');
      await notificarPendenciaFicha(processo, processo.cliente_id, totalCampos, Math.max(0, faltamDocs));

      Swal.fire({
        icon: 'success',
        title: 'Cliente Cobrado!',
        text: 'Uma notificação de pendência foi enviada para o portal do cliente e para a equipe responsável.',
        timer: 3000,
        showConfirmButton: false
      });
    } catch (error: any) {
      Swal.fire('Erro', error.message || 'Falha ao enviar notificação.', 'error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const procs = await listarTodosProcessos();
        setProcessos(procs);
      } catch (error) {
        console.error("Erro ao carregar dados operacionais:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getProcessProgress = (processo: OrderProcess) => {
    const reqDocs = processo.pendencias_iniciais || [];
    if (reqDocs.length === 0) return 100;
    const envDocs = processo.documentos_enviados || [];
    const count = reqDocs.filter(d => envDocs.includes(d)).length;
    return Math.round((count / reqDocs.length) * 100);
  };

  const isProcessReady = (processo: OrderProcess) => {
    const reqDocs = processo.pendencias_iniciais || [];
    if (reqDocs.length === 0) return true;
    const envDocs = processo.documentos_enviados || [];
    return reqDocs.every(d => envDocs.includes(d));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredProcessos = processos.filter(p => {
    const matchesSearch = 
      (p.cliente_nome || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (p.protocolo || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (p.servico_nome || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || p.status_atual === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalFila: processos.filter(p => p.status_atual !== 'Concluído').length,
    totalAtraso: processos.filter(p => {
      if (p.status_atual === 'Concluído') return false;
      const dataVenda = p.data_venda?.toDate() || new Date();
      const diffTime = Math.abs(new Date().getTime() - dataVenda.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > (p.prazo_estimado_dias || 7);
    }).length,
    totalConcluidoHoje: processos.filter(p => {
      if (p.status_atual !== 'Concluído') return false;
      const dataConclusao = p.data_conclusao_real?.toDate() || new Date();
      const today = new Date();
      return dataConclusao.getDate() === today.getDate() &&
             dataConclusao.getMonth() === today.getMonth() &&
             dataConclusao.getFullYear() === today.getFullYear();
    }).length
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Activity className="text-blue-600 animate-spin" size={40} />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando Operação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* HEADER OPERACIONAL (Layout 4.0) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
          <Activity size={180} className="text-[#0a0a2e]" />
        </div>

        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-4">
            <div className="size-12 md:size-14 bg-[#0a0a2e] rounded-2xl md:rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/20">
              <Activity className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">
                Fila de Produção
              </h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">GSA IA Operational v4.0</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs md:text-sm font-medium flex items-center gap-2">
            Analista: <span className="text-blue-600 font-black uppercase tracking-tight">{auth.currentUser?.displayName || 'Analista GSA'}</span>
          </p>
        </div>
        
        {/* MINI DASHBOARD ANALISTA */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 md:gap-4 relative z-10 w-full lg:w-auto">
          <div className="bg-blue-50 px-4 md:px-8 py-3 md:py-4 rounded-[1.5rem] md:rounded-[1.8rem] border border-blue-100 text-center shadow-sm hover:shadow-md transition-all">
            <p className="text-[8px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Em Fila</p>
            <p className="text-2xl md:text-3xl font-black text-blue-700 italic tracking-tighter">{stats.totalFila.toString().padStart(2, '0')}</p>
          </div>
          <div className="bg-rose-50 px-4 md:px-8 py-3 md:py-4 rounded-[1.5rem] md:rounded-[1.8rem] border border-rose-100 text-center shadow-sm hover:shadow-md transition-all">
            <p className="text-[8px] md:text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Atraso SLA</p>
            <p className="text-2xl md:text-3xl font-black text-rose-600 italic tracking-tighter">{stats.totalAtraso.toString().padStart(2, '0')}</p>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-emerald-50 px-4 md:px-8 py-3 md:py-4 rounded-[1.5rem] md:rounded-[1.8rem] border border-emerald-100 text-center shadow-sm hover:shadow-md transition-all">
            <p className="text-[8px] md:text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Concluídos</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-700 italic tracking-tighter">{stats.totalConcluidoHoje.toString().padStart(2, '0')}</p>
          </div>
        </div>
      </div>

      {/* FILTROS E BUSCA RÁPIDA */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:flex-1 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            type="text" 
            placeholder="Buscar Protocolo ou Cliente..." 
            className="w-full pl-14 pr-6 py-4 md:py-5 bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[1.8rem] text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#0a0a2e] placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="w-full md:w-auto bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[1.8rem] px-8 py-4 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] outline-none shadow-sm text-slate-500 cursor-pointer hover:text-[#0a0a2e] transition-all"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Status: Todos</option>
          <option value="Pendente">Pendente</option>
          <option value="Em Análise">Em Análise</option>
          <option value="Protocolado">Protocolado</option>
          <option value="Em Andamento">Em Andamento</option>
          <option value="Concluído">Concluído</option>
          <option value="Aguardando Documentação">Aguardando Documentação</option>
        </select>
      </div>

      {/* LISTAGEM DE PROCESSOS (Fila Real) */}
      <div className="grid grid-cols-1 gap-6">
        {filteredProcessos.map((processo, idx) => {
          const dataVenda = processo.data_venda?.toDate() || new Date();
          const diffTime = Math.abs(new Date().getTime() - dataVenda.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isAtrasado = diffDays > (processo.prazo_estimado_dias || 7);
          const ready = isProcessReady(processo);

          return (
            <motion.div 
              key={processo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.5 }}
              className={`bg-white rounded-[2rem] md:rounded-[2.5rem] border p-6 md:p-8 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 md:gap-8 transition-all hover:shadow-2xl hover:-translate-y-1 group ${
                isAtrasado ? 'border-rose-100 bg-rose-50/10' : 'border-slate-100'
              }`}
            >
              {/* Info Cliente e Protocolo */}
              <div className="space-y-3 min-w-[250px] w-full xl:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <span className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase tracking-widest">
                      #{processo.protocolo || processo.id?.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  {isAtrasado && (
                    <div className="bg-rose-500 px-3 py-1 rounded-full shadow-lg shadow-rose-500/20 animate-pulse">
                      <span className="text-[7px] md:text-[8px] font-black text-white uppercase tracking-widest">SLA Crítico</span>
                    </div>
                  )}
                  {ready && (
                    <div className="bg-emerald-500 px-3 py-1 rounded-full shadow-lg shadow-emerald-500/20">
                      <span className="text-[7px] md:text-[8px] font-black text-white uppercase tracking-widest">Docs OK</span>
                    </div>
                  )}
                </div>
                <h3 className="text-xl md:text-2xl font-black text-[#0a0a2e] uppercase italic leading-none group-hover:text-blue-600 transition-colors">{processo.cliente_nome}</h3>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="size-1.5 bg-slate-300 rounded-full" />
                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{processo.servico_nome}</p>
                </div>
              </div>

              {/* Timeline de Status (Dropdown Master) */}
              <div className="flex-1 w-full xl:w-auto space-y-3">
                <p className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] ml-1">Fluxo Operacional</p>
                <div className="relative group/select">
                  <select 
                    value={processo.status_atual}
                    onChange={(e) => handleUpdateStatus(processo, e.target.value as any)}
                    className="w-full xl:w-72 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest text-blue-700 py-4 px-6 focus:ring-4 focus:ring-blue-500/10 cursor-pointer appearance-none transition-all hover:bg-blue-50"
                  >
                    <option value="Pendente">1. Pendente</option>
                    <option value="Em Análise">2. Em Análise</option>
                    <option value="Protocolado">3. Protocolado</option>
                    <option value="Em Andamento">4. Em Andamento</option>
                    <option value="Aguardando Documentação">5. Aguardando Doc.</option>
                    <option value="Concluído">6. CONCLUIR PROCESSO</option>
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/select:translate-y-[-40%] transition-transform">
                    <ChevronRight size={18} className="rotate-90" />
                  </div>
                </div>
              </div>

              {/* Time & Team (Visible only on larger screens) */}
              <div className="hidden xl:flex items-center gap-12 border-x border-slate-50 px-12">
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Data Início</p>
                  <div className="flex items-center gap-2 text-[#0a0a2e]">
                    <Calendar size={14} className="text-blue-500" />
                    <p className="text-xs font-black uppercase italic">
                      {processo.data_venda?.toDate ? format(processo.data_venda.toDate(), "dd/MM/yy") : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Responsável</p>
                  <div className="flex items-center gap-2 text-[#0a0a2e]">
                    <User size={14} className="text-blue-500" />
                    <p className="text-[10px] font-black uppercase tracking-tight truncate max-w-[120px]">
                      {processo.vendedor_nome || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 w-full xl:w-auto">
                <button 
                  onClick={() => setSelectedProcess(processo)}
                  className="flex-1 xl:flex-none bg-slate-50 text-slate-400 hover:bg-[#0a0a2e] hover:text-white size-12 md:size-14 rounded-2xl transition-all shadow-sm flex items-center justify-center border border-slate-100" 
                  title="Ver Pasta do Cliente"
                >
                  <FolderOpen size={20} />
                </button>
                <button 
                  onClick={() => handleAbrirPendencia(processo)}
                  className="flex-1 xl:flex-none bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white size-12 md:size-14 rounded-2xl transition-all shadow-sm flex items-center justify-center border border-amber-100" 
                  title="Abrir Pendência"
                >
                  <AlertTriangle size={20} />
                </button>
              </div>
            </motion.div>
          );
        })}

        {filteredProcessos.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[3.5rem] border-2 border-dashed border-slate-100 shadow-inner">
            <div className="size-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <AlertCircle size={40} className="text-slate-200" />
            </div>
            <h3 className="text-2xl font-black text-slate-300 uppercase tracking-tighter italic">Nenhum processo na fila de produção</h3>
            <p className="text-slate-400 text-sm mt-2 font-medium">Aguarde novas vendas concluídas para iniciar a operação.</p>
          </div>
        )}
      </div>

      {/* Modal de Auditoria Detalhada (Layout 4.0) */}
      <AnimatePresence>
        {selectedProcess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col relative border border-slate-100"
            >
              <button 
                onClick={() => setSelectedProcess(null)}
                className="absolute top-8 right-8 z-50 size-12 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center text-slate-400 shadow-xl border border-slate-100 transition-all"
              >
                <X size={24} />
              </button>

              <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-6">
                  <div className="size-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Auditoria do Processo</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo: #{selectedProcess.protocolo || selectedProcess.id?.slice(-6).toUpperCase()}</p>
                  </div>
                </div>

                {/* Botão de Excluir para ADM_MASTER */}
                {auth.currentUser?.uid && (
                  <button 
                    onClick={() => handleDeleteProcess(selectedProcess)}
                    className="mr-16 px-6 py-3 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Trash2 size={14} />
                    Excluir Processo
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                {/* Cabeçalho do Cliente */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  <div className="md:col-span-8 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="size-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <UserCheck className="text-blue-600" size={16} />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informações do Cliente</span>
                    </div>
                    <h4 className="text-3xl font-black text-[#0a0a2e] uppercase italic mb-4">{selectedProcess.cliente_nome}</h4>
                    <div className="flex flex-wrap gap-6">
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Documento</p>
                        <p className="text-sm font-black text-slate-600 uppercase tracking-tight">{selectedProcess.cliente_cpf_cnpj}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Nascimento</p>
                        <p className="text-sm font-black text-slate-600 uppercase tracking-tight">{selectedProcess.data_nascimento}</p>
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-4 bg-[#0a0a2e] p-8 rounded-[2.5rem] text-white flex flex-col justify-center shadow-2xl shadow-blue-900/20">
                    <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-2">Status Operacional</span>
                    <h4 className="text-2xl font-black uppercase italic leading-none text-blue-400">{selectedProcess.status_atual}</h4>
                    <div className="mt-8 pt-6 border-t border-white/10">
                      <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-2">Vendedor Responsável</span>
                      <p className="text-sm font-black uppercase tracking-tight">{selectedProcess.vendedor_nome || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Checklist de Documentação */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-slate-50 rounded-xl flex items-center justify-center shadow-sm">
                        <FileText size={20} className="text-blue-600" />
                      </div>
                      <h4 className="text-lg font-black text-[#0a0a2e] uppercase tracking-tighter italic">Checklist de Documentos</h4>
                    </div>
                    <div className="bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                        {selectedProcess.documentos_enviados?.length || 0} / {selectedProcess.pendencias_iniciais?.length || 0} ENVIADOS
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedProcess.pendencias_iniciais?.map((docKey) => {
                      const isEnviado = selectedProcess.documentos_enviados?.includes(docKey);
                      return (
                        <div 
                          key={docKey}
                          className={`flex items-center justify-between p-6 rounded-[1.8rem] border transition-all ${
                            isEnviado 
                              ? 'bg-emerald-50 border-emerald-100 shadow-sm' 
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`size-12 rounded-2xl flex items-center justify-center shadow-sm ${
                              isEnviado ? 'bg-white text-emerald-500' : 'bg-white text-slate-300'
                            }`}>
                              {isEnviado ? <CheckCircle size={20} /> : <Clock size={20} />}
                            </div>
                            <span className={`text-[11px] font-black uppercase tracking-tight ${
                              isEnviado ? 'text-emerald-700' : 'text-slate-400'
                            }`}>
                              {requirementsConfig.document_labels[docKey] || docKey}
                            </span>
                          </div>
                          {isEnviado && (
                            <div className="flex gap-2">
                              <a 
                                href={selectedClient?.[docKey]} 
                                target="_blank" 
                                rel="noreferrer"
                                className="size-10 bg-white text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center border border-emerald-100"
                                title="Ver Arquivo"
                              >
                                <ExternalLink size={16} />
                              </a>
                              <button 
                                onClick={() => handleAbrirPendencia(selectedProcess)}
                                className="size-10 bg-white text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center border border-rose-100"
                                title="Reprovar / Abrir Pendência"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dados da Ficha */}
                {selectedProcess.dados_faltantes && selectedProcess.dados_faltantes.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                      <div className="size-10 bg-slate-50 rounded-xl flex items-center justify-center shadow-sm">
                        <Activity size={20} className="text-blue-600" />
                      </div>
                      <h4 className="text-lg font-black text-[#0a0a2e] uppercase tracking-tighter italic">Dados da Ficha Técnica</h4>
                    </div>
                    <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-10 shadow-inner">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {selectedProcess.dados_faltantes.map(field => (
                          <div key={field} className="space-y-2">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{requirementsConfig.field_labels[field] || field}</span>
                            <div className="flex items-center gap-3">
                              <div className="size-2 bg-blue-500 rounded-full" />
                              <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight">
                                {selectedClient?.[field] || 'Não preenchido'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-4">
                <button 
                  onClick={() => setSelectedProcess(null)}
                  className="px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0a0a2e] transition-all"
                >
                  Fechar Auditoria
                </button>
                {!isProcessReady(selectedProcess) && (
                  <button 
                    onClick={() => handleNotificarPendencias(selectedProcess)}
                    className="px-10 py-5 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 shadow-sm transition-all flex items-center justify-center gap-3"
                  >
                    <AlertTriangle size={16} />
                    Cobrar Pendências
                  </button>
                )}
                <button 
                  onClick={() => handleDownloadPDF(selectedProcess)}
                  disabled={generatingPdf}
                  className="px-10 py-5 bg-white border border-slate-100 text-[#0a0a2e] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {generatingPdf ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
                  Baixar Ficha Técnica
                </button>
                <button className="px-10 py-5 bg-[#0a0a2e] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 shadow-2xl shadow-blue-900/30 transition-all">
                  Gerar Protocolo Final
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
