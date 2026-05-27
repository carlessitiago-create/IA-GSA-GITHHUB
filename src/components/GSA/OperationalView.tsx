import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, Clock, Search, Filter, ChevronRight, User, Calendar, FileText, AlertCircle, X, ExternalLink, ShieldCheck, UserCheck, FileDown, Loader2, FolderOpen, AlertTriangle, XCircle, Trash2, Edit3, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { listarTodosProcessos, OrderProcess, atualizarStatusProcesso, abrirPendenciaCascata, excluirProcesso } from '../../services/orderService';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { gerarDocumentoProcesso } from '../../services/pdfGeneratorService';
import { getClienteData } from '../../services/leadService';
import { obterModeloProcesso } from '../../services/modelService';
import { SmartFicha } from './SmartFicha';
import Swal from 'sweetalert2';
import { useAuth } from '../../components/AuthContext';
import { useRequirements } from '../../hooks/useRequirements';

export const OperationalView: React.FC = () => {
  const { profile } = useAuth();
  const isAdm = profile?.nivel?.startsWith('ADM') || profile?.nivel === 'ADM_ANALISTA';
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
    const loadClientAndSync = async () => {
      if (selectedProcess) {
        const client = await getClienteData(selectedProcess.cliente_id);
        setSelectedClient(client);

        // Auto-reparo de dados de segurança para consulta pública (Sync silencioso)
        if (client && (!selectedProcess.cliente_cpf_cnpj || !selectedProcess.data_nascimento || !selectedProcess.cliente_nome)) {
          console.log("Detectados campos de segurança ausentes no processo, sincronizando...");
          try {
            const { db } = await import('../../firebase');
            const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
            
            const updates: any = {};
            // Sincroniza CPF/CNPJ
            const documento = client.documento || (client as any).cpf;
            if (!selectedProcess.cliente_cpf_cnpj && documento) {
              updates.cliente_cpf_cnpj = documento.replace(/\D/g, '');
            }
            // Sincroniza Data de Nascimento
            if (!selectedProcess.data_nascimento && client.data_nascimento) {
              updates.data_nascimento = client.data_nascimento;
            }
            // Sincroniza Nome
            if (!selectedProcess.cliente_nome && client.nome) {
              updates.cliente_nome = client.nome;
            }

            if (Object.keys(updates).length > 0) {
              await updateDoc(fsDoc(db, 'order_processes', selectedProcess.id!), updates);
              // Atualiza o estado local para refletir a mudança
              setSelectedProcess(prev => prev?.id === selectedProcess.id ? { ...prev, ...updates } : prev);
            }
          } catch (e) {
            console.warn("Falha no auto-reparo do processo:", e);
          }
        }
      } else {
        setSelectedClient(null);
      }
    };
    loadClientAndSync();
  }, [selectedProcess]);

  const handleDownloadPDF = async (processo: OrderProcess) => {
    if (!isAdm && profile?.nivel !== 'GESTOR' && profile?.nivel !== 'VENDEDOR') {
      Swal.fire('Acesso Restrito', 'Você não tem permissão para esta ação.', 'error');
      return;
    }
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
    if (!isAdm) {
      Swal.fire('Acesso Restrito', 'Apenas administradores podem excluir processos.', 'error');
      return;
    }
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
        const data = await listarTodosProcessos(profile || undefined);
        setProcessos(data);
      } catch (error) {
        console.error("Erro ao excluir processo:", error);
        Swal.fire('Erro', 'Falha ao excluir o processo.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const selecionarResponsavel = async (role: string, field: 'vendedor' | 'gestor' | 'analista') => {
    if (!isAdm || !selectedProcess) return;
    
    try {
      const { collection, getDocs, query, where, updateDoc, doc: fsDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      let usersQuery = query(collection(db, 'usuarios'), where('nivel', '==', role));
      let snap = await getDocs(usersQuery);
      
      // If analista, include ADM_MASTER, etc.
      if (role === 'ADM_ANALISTA') {
          const snap2 = await getDocs(query(collection(db, 'usuarios'), where('nivel', '==', 'ADM_MASTER')));
          snap = { docs: [...snap.docs, ...snap2.docs] } as any;
      }
      
      let options: Record<string, string> = { "REMOVE": "Nenhum (Remover)" };
      
      snap.docs.forEach((d: any) => {
        options[d.id] = d.data().nome_completo || d.data().nome || d.id;
      });

      const { value: userId } = await Swal.fire({
        title: `Selecione o ${field.charAt(0).toUpperCase() + field.slice(1)}`,
        input: 'select',
        inputOptions: options,
        showCancelButton: true
      });

      if (userId) {
         const updates: any = {};
         
         if (userId === "REMOVE") {
            updates[`${field}_id`] = null;
            updates[`${field}_nome`] = null;
         } else {
            updates[`${field}_id`] = userId;
            updates[`${field}_nome`] = options[userId];
         }
         
         await updateDoc(fsDoc(db, 'order_processes', selectedProcess.id!), updates);
         
         const { registrarLogAuditoria } = await import('../../services/orderService');
         await registrarLogAuditoria(
           selectedProcess.id!, 
           `Responsável (${field}) alterado para: ${userId === 'REMOVE' ? 'Nenhum' : options[userId]}`, 
           profile?.uid || '', 
           profile?.nome_completo || 'Analista'
         );
         
         setSelectedProcess({ ...selectedProcess, ...updates });
         
         setProcessos(prev => prev.map(p => p.id === selectedProcess.id ? { ...p, ...updates } : p));
         
         Swal.fire('Sucesso', 'Responsável atualizado com sucesso.', 'success');
      }
    } catch (e) {
      console.warn("Erro ao buscar usuários", e);
    }
  };

  const handleMudarServico = async () => {
    if (!selectedProcess || !isAdm) return;
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const servicesSnap = await getDocs(collection(db, 'services'));
      const servicosAtivos = servicesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((s:any) => s.ativo !== false && s.nome);

      const inputOptions: Record<string, string> = {};
      servicosAtivos.forEach((s: any) => {
        inputOptions[s.id] = s.nome;
      });

      const { value: selectedServicoId } = await Swal.fire({
        title: 'Mudar Tipo de Processo',
        input: 'select',
        inputOptions,
        inputValue: selectedProcess.servico_id,
        showCancelButton: true
      });

      if (selectedServicoId && selectedServicoId !== selectedProcess.servico_id) {
        const servicoSelecionado: any = servicosAtivos.find(s => s.id === selectedServicoId);
        
        let arrCamposFaltantes = servicoSelecionado.requisitos_campos || [];
        let arrDocsFaltantes = servicoSelecionado.requisitos_documentos || [];
        const modelId = servicoSelecionado.modelo_id || "";
        
        if (modelId && (!arrCamposFaltantes.length && !arrDocsFaltantes.length)) {
          const { doc: fsDoc, getDoc } = await import('firebase/firestore');
          const modelDoc = await getDoc(fsDoc(db, 'process_models', modelId));
          if (modelDoc.exists()) {
             arrCamposFaltantes = modelDoc.data().campos || [];
             arrDocsFaltantes = modelDoc.data().documentos || [];
          }
        }
        
        const { registrarLogAuditoria } = await import('../../services/orderService');
        await updateDoc(doc(db, 'order_processes', selectedProcess.id!), {
          servico_id: selectedServicoId,
          servico_nome: servicoSelecionado.nome,
          modelo_id: modelId,
          dados_faltantes: arrCamposFaltantes,
          pendencias_iniciais: arrDocsFaltantes
        });
        
        await registrarLogAuditoria(selectedProcess.id!, `Tipo de processo alterado para: ${servicoSelecionado.nome}`, profile?.uid || '', profile?.nome_completo || 'Analista');
        
        const updatedProcess = {
          ...selectedProcess, 
          servico_id: selectedServicoId, 
          servico_nome: servicoSelecionado.nome,
          modelo_id: modelId,
          dados_faltantes: arrCamposFaltantes,
          pendencias_iniciais: arrDocsFaltantes
        };
        setSelectedProcess(updatedProcess);
        
        Swal.fire('Sucesso', 'Tipo de processo alterado.', 'success');
        
        setProcessos(prev => prev.map(p => p.id === updatedProcess.id ? updatedProcess : p));
      }
    } catch(e) {
      console.error(e);
      Swal.fire('Erro', 'Ocorreu um erro ao mudar o processo.', 'error');
    }
  };

  const handleUpdateStatus = async (processo: OrderProcess, novoStatus: OrderProcess['status_atual']) => {
    if (!isAdm) return;

    if (novoStatus !== 'Pendente' && novoStatus !== 'Aguardando Documentação' && !isProcessReady(processo)) {
      Swal.fire({
        title: 'Dados Incompletos',
        text: 'Faltam campos na Ficha Técnica ou documentos. O processo só deve avançar quando Docs estiverem OK.',
        icon: 'warning'
      });
      // Força a re-renderização para que o select volte ao "Pendente"
      setProcessos(prev => [...prev]);
      return;
    }

    const oldStatus = processo.status_atual;
    
    if (novoStatus === 'Concluído') {
      const { value: fileUrl, isConfirmed, isDenied } = await Swal.fire({
        title: 'Finalizar Processo',
        text: 'Anexe o arquivo do diagnóstico (PDF ou Imagem) ou conclua sem anexo.',
        input: 'file',
        inputAttributes: {
          'accept': 'application/pdf,image/*',
          'aria-label': 'Upload do diagnóstico'
        },
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Enviar e Concluir',
        denyButtonText: 'Concluir sem Anexo',
        confirmButtonColor: '#10b981',
        denyButtonColor: '#6b7280',
        cancelButtonText: 'Voltar',
        showLoaderOnConfirm: true,
        preConfirm: async (file) => {
          if (!file) {
            Swal.showValidationMessage('Você precisa selecionar um arquivo para anexar!');
            return false;
          }
          try {
            const { uploadFile } = await import('../../services/uploadService');
            const path = `diagnosticos/${processo.protocolo.replace('#', '')}_${Date.now()}_${file.name}`;
            const url = await uploadFile(file, path);
            return url;
          } catch (error: any) {
            Swal.showValidationMessage(`Erro no upload: ${error.message}`);
          }
        },
        allowOutsideClick: () => !Swal.isLoading()
      });

      if (isConfirmed || isDenied) {
        const urlToUse = isConfirmed ? fileUrl : null;
        try {
          await atualizarStatusProcesso(
            processo.id!,
            novoStatus,
            auth.currentUser!.uid,
            profile?.nome_completo || 'Analista', // Passando o nome
            oldStatus,
            urlToUse,
            isDenied ? 'Processo concluído sem anexo.' : 'Processo concluído com sucesso pelo analista.'
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
          const procs = await listarTodosProcessos(profile || undefined);
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
            profile?.nome_completo || 'Analista', // Passando o nome
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
          const procs = await listarTodosProcessos(profile || undefined);
          setProcessos(procs);
        } catch (error: any) {
          Swal.fire('Erro', error.message || 'Falha ao atualizar status.', 'error');
        }
      }
    }
  };

  const handleAtribuirCliente = async (processo: OrderProcess) => {
    if (!isAdm) {
      Swal.fire('Acesso Restrito', 'Apenas administradores ou analistas podem atribuir processos manualmente.', 'error');
      return;
    }

    const { value: inputCpf } = await Swal.fire({
      title: 'Atribuir a Cliente Existente',
      input: 'text',
      inputLabel: 'Informe o CPF ou CNPJ do Cliente (Ex: 000.000.000-00)',
      inputPlaceholder: 'Apenas números recomendável...',
      showCancelButton: true,
      confirmButtonText: 'Buscar e Atribuir',
      confirmButtonColor: '#4f46e5'
    });

    if (inputCpf) {
      try {
        const cleanDoc = inputCpf.replace(/\D/g, '');
        if (!cleanDoc) return;
        
        const { getDocs, query, collection, where, doc, updateDoc } = await import('firebase/firestore');
        let q = query(collection(db, 'usuarios'), where('cpf', '==', inputCpf));
        let snap = await getDocs(q);
        
        if (snap.empty) {
            q = query(collection(db, 'usuarios'), where('cpf', '==', cleanDoc));
            snap = await getDocs(q);
        }

        if (snap.empty) {
            let formattedCpf = cleanDoc;
            if (cleanDoc.length === 11) {
              formattedCpf = cleanDoc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            } else if (cleanDoc.length === 14) {
              formattedCpf = cleanDoc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
            }
            q = query(collection(db, 'usuarios'), where('cpf', '==', formattedCpf));
            snap = await getDocs(q);
        }

        if (snap.empty) {
            Swal.fire('Não Encontrado', 'Nenhum usuário localizado com este documento.', 'warning');
            return;
        }

        const userDoc = snap.docs[0].data();
        const userId = snap.docs[0].id;
        
        const { isConfirmed } = await Swal.fire({
            title: 'Confirmação',
            text: `Deseja atribuir este processo para: ${userDoc.nome_completo || userDoc.email}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Atribuir',
            confirmButtonColor: '#4f46e5'
        });

        if (isConfirmed && processo.id) {
           await updateDoc(doc(db, 'order_processes', processo.id), {
               cliente_id: userId,
               cliente_cpf_cnpj: cleanDoc,
               cliente_nome: userDoc.nome_completo
           });

           if (processo.venda_id) {
              await updateDoc(doc(db, 'sales', processo.venda_id), {
                  cliente_id: userId,
                  cliente_cpf_cnpj: cleanDoc,
                  cliente_nome: userDoc.nome_completo
              });
           }

           Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'Processo atribuído com sucesso!',
              showConfirmButton: false,
              timer: 3000
           });
           
           const procs = await listarTodosProcessos(profile || undefined);
           setProcessos(procs);
        }

      } catch (err: any) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao buscar ou atribuir o cliente.', 'error');
      }
    }
  };

  const handleAbrirPendencia = async (processo: OrderProcess) => {
    if (!isAdm) {
      Swal.fire('Acesso Restrito', 'Apenas analistas podem reprovar documentos ou abrir pendências.', 'error');
      return;
    }
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
        const procs = await listarTodosProcessos(profile || undefined);
        setProcessos(procs);
      } catch (error) {
        console.error("Erro ao carregar dados operacionais:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleConfirmarRecebimentoManual = async (processo: OrderProcess, docKey: string) => {
    const docLabel = requirementsConfig?.document_labels?.[docKey] || docKey.replace(/_/g, ' ');
    const result = await Swal.fire({
      title: 'Confirmar Recebimento',
      text: `Deseja confirmar o recebimento do documento "${docLabel}" manualmente?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, Recebido',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const currentDocs = processo.documentos_enviados || [];
        if (!currentDocs.includes(docKey)) {
          const updatedDocs = [...currentDocs, docKey];
          const updatedProcess = { ...processo, documentos_enviados: updatedDocs };
          
          if (isProcessReady(updatedProcess)) {
            if (updatedProcess.status_atual === 'Pendente' || updatedProcess.status_atual === 'Aguardando Documentação') {
              updatedProcess.status_atual = 'Em Análise';
              await updateDoc(doc(db, 'order_processes', processo.id!), {
                documentos_enviados: updatedDocs,
                status_atual: 'Em Análise'
              });
              Swal.fire('Pronto!', 'Todos os documentos e dados foram preenchidos. Processo agora está Em Análise.', 'success');
            } else {
              await updateDoc(doc(db, 'order_processes', processo.id!), {
                documentos_enviados: updatedDocs
              });
              Swal.fire('Sucesso!', 'Documento confirmado.', 'success');
            }
          } else {
            if (updatedProcess.status_atual !== 'Pendente' && updatedProcess.status_atual !== 'Aguardando Documentação') {
              updatedProcess.status_atual = 'Pendente';
              await updateDoc(doc(db, 'order_processes', processo.id!), {
                documentos_enviados: updatedDocs,
                status_atual: 'Pendente'
              });
              Swal.fire('Atenção', 'A documentação ainda está incompleta. O status retornou para Pendente.', 'warning');
            } else {
              await updateDoc(doc(db, 'order_processes', processo.id!), {
                documentos_enviados: updatedDocs
              });
              Swal.fire('Sucesso!', 'Documento confirmado. Faltam outros requisitos.', 'info');
            }
          }

          // Atualizar o estado local
          setProcessos(prev => prev.map(p => p.id === processo.id ? updatedProcess : p));
          if (selectedProcess?.id === processo.id) {
            setSelectedProcess(updatedProcess);
          }
        }
      } catch (error: any) {
        Swal.fire('Erro', 'Não foi possível confirmar: ' + error.message, 'error');
      }
    }
  };

  const getProcessProgress = (processo: OrderProcess) => {
    const reqDocs = processo.pendencias_iniciais || [];
    if (reqDocs.length === 0) return 100;
    const envDocs = processo.documentos_enviados || [];
    const count = reqDocs.filter(d => envDocs.includes(d)).length;
    return Math.round((count / reqDocs.length) * 100);
  };

  const isProcessReady = (processo: OrderProcess) => {
    const reqDocs = processo.pendencias_iniciais || [];
    const reqFields = processo.dados_faltantes || [];
    
    // Dados críticos para rastreio público
    const hasTrackingData = !!processo.cliente_cpf_cnpj && !!processo.data_nascimento;

    // Apenas OK se enviou TODOS os documentos exigidos e preencheu TODOS os campos requeridos
    const docsReady = reqDocs.every(d => (processo.documentos_enviados || []).includes(d));
    const fieldsReady = reqFields.length === 0;
    
    // Para serviços sem requisitos, mas sem documentos cadastrados de origem, pode bugar,
    // então verificamos se não há pendencias ou se as pendencias foram cumpridas.
    return docsReady && fieldsReady && hasTrackingData;
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

  const totalFila = processos.filter(p => p.status_atual !== 'Concluído').length;
  const totalPendente = processos.filter(p => p.status_atual === 'Pendente').length;
  const totalEmAnalise = processos.filter(p => p.status_atual === 'Em Análise').length;
  const totalProtocolado = processos.filter(p => p.status_atual === 'Protocolado').length;
  const totalEmAndamento = processos.filter(p => p.status_atual === 'Em Andamento').length;
  const totalAguardandoDoc = processos.filter(p => p.status_atual === 'Aguardando Documentação').length;

  const totalAtraso = processos.filter(p => {
    if (p.status_atual === 'Concluído') return false;
    const dataVenda = p.data_venda?.toDate ? p.data_venda.toDate() : new Date();
    const diffTime = Math.abs(new Date().getTime() - dataVenda.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > (p.prazo_estimado_dias || 7);
  }).length;
  const totalConcluidoHoje = processos.filter(p => {
    if (p.status_atual !== 'Concluído') return false;
    const dataConclusao = p.data_conclusao_real?.toDate ? p.data_conclusao_real.toDate() : new Date();
    const today = new Date();
    return dataConclusao.getDate() === today.getDate() &&
           dataConclusao.getMonth() === today.getMonth() &&
           dataConclusao.getFullYear() === today.getFullYear();
  }).length;

  const [displayFila, setDisplayFila] = useState(0);
  const [displayPendente, setDisplayPendente] = useState(0);
  const [displayEmAnalise, setDisplayEmAnalise] = useState(0);
  const [displayProtocolado, setDisplayProtocolado] = useState(0);
  const [displayEmAndamento, setDisplayEmAndamento] = useState(0);
  const [displayAguardandoDoc, setDisplayAguardandoDoc] = useState(0);
  const [displayAtraso, setDisplayAtraso] = useState(0);
  const [displayConcluido, setDisplayConcluido] = useState(0);

  useEffect(() => {
    if (loading) return;
    
    const animateStat = (target: number, setter: React.Dispatch<React.SetStateAction<number>>) => {
      if (target > 0) {
        let start = 0; const duration = 1000;
        const inc = target / (duration / 16);
        const timer = setInterval(() => { 
          start += inc; 
          if (start >= target) { 
            setter(target); 
            clearInterval(timer); 
          } else { 
            setter(Math.floor(start)); 
          } 
        }, 16);
        return timer;
      } else {
        setter(0);
        return null;
      }
    };

    const timers = [
      animateStat(totalFila, setDisplayFila),
      animateStat(totalPendente, setDisplayPendente),
      animateStat(totalEmAnalise, setDisplayEmAnalise),
      animateStat(totalProtocolado, setDisplayProtocolado),
      animateStat(totalEmAndamento, setDisplayEmAndamento),
      animateStat(totalAguardandoDoc, setDisplayAguardandoDoc),
      animateStat(totalAtraso, setDisplayAtraso),
      animateStat(totalConcluidoHoje, setDisplayConcluido)
    ];

    return () => {
      timers.forEach(t => t && clearInterval(t));
    };
  }, [loading, totalFila, totalPendente, totalEmAnalise, totalProtocolado, totalEmAndamento, totalAguardandoDoc, totalAtraso, totalConcluidoHoje]);

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
      {/* HEADER OPERACIONAL (Layout 4.0 Glow) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-gradient-to-br from-[#020617] to-[#0a0a2e] p-6 md:p-6 rounded-2xl md:rounded-3xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
          <Activity size={240} className="text-blue-500" />
        </div>
        
        {/* Animated Glow Elements */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none transform translate-x-1/3 -translate-y-1/3 group-hover:bg-blue-600/20 transition-all duration-1000"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-600/5 blur-[80px] rounded-full pointer-events-none transform -translate-x-1/3 translate-y-1/3"></div>

        <div className="space-y-4 relative z-10 w-full lg:w-auto">
          <div className="flex items-center gap-4">
            <div className="size-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
               <Activity className="text-blue-400" size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                { (profile?.nivel === 'GESTOR' || profile?.nivel === 'VENDEDOR') ? 'Meus Processos' : 'Fila de Produção' }
              </h1>
              <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mt-1">GSA IA Operational Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#0F172A] w-fit px-3 py-1.5 rounded-lg border border-slate-800">
            <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
            <p className="text-slate-400 text-xs font-semibold tracking-wide">
              Terminal: <span className="text-white">{auth.currentUser?.displayName || 'Analista GSA'}</span>
            </p>
          </div>
        </div>
        
        {/* MINI DASHBOARD VIP ANALISTA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3 relative z-10 w-full mt-4 lg:mt-0">
          <div className="bg-[#0B0F19] px-3 md:px-4 py-3 rounded-2xl border border-slate-800/50 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group/card shadow-[0_0_20px_rgba(0,0,0,0.5)]">
             <div className="absolute inset-0 bg-gradient-to-t from-slate-600/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
             <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 text-center whitespace-nowrap">Em Fila</p>
             <p className="text-xl md:text-2xl font-bold text-slate-400 tracking-tight drop-shadow-[0_0_10px_rgba(148,163,184,0.3)]">{displayFila.toString().padStart(2, '0')}</p>
          </div>
          <div className="bg-[#0B0F19] px-3 md:px-4 py-3 rounded-2xl border border-blue-900/20 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group/card shadow-[0_0_20px_rgba(0,0,0,0.5)]">
             <div className="absolute inset-0 bg-gradient-to-t from-blue-900/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
             <p className="text-[9px] sm:text-[10px] font-bold text-blue-500/70 uppercase tracking-widest mb-1 text-center whitespace-nowrap">Pendente</p>
             <p className="text-xl md:text-2xl font-bold text-blue-500 tracking-tight drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">{displayPendente.toString().padStart(2, '0')}</p>
          </div>
          <div className="bg-[#0B0F19] px-3 md:px-4 py-3 rounded-2xl border border-cyan-900/20 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group/card shadow-[0_0_20px_rgba(0,0,0,0.5)]">
             <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
             <p className="text-[9px] sm:text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-1 text-center whitespace-nowrap">Em Análise</p>
             <p className="text-xl md:text-2xl font-bold text-cyan-500 tracking-tight drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">{displayEmAnalise.toString().padStart(2, '0')}</p>
          </div>
          <div className="bg-[#0B0F19] px-3 md:px-4 py-3 rounded-2xl border border-amber-900/20 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group/card shadow-[0_0_20px_rgba(0,0,0,0.5)]">
             <div className="absolute inset-0 bg-gradient-to-t from-amber-900/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
             <p className="text-[9px] sm:text-[10px] font-bold text-amber-500/70 uppercase tracking-widest mb-1 text-center whitespace-nowrap">Aguar. Doc</p>
             <p className="text-xl md:text-2xl font-bold text-amber-500 tracking-tight drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">{displayAguardandoDoc.toString().padStart(2, '0')}</p>
          </div>
          <div className="bg-[#0B0F19] px-3 md:px-4 py-3 rounded-2xl border border-orange-900/20 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group/card shadow-[0_0_20px_rgba(0,0,0,0.5)]">
             <div className="absolute inset-0 bg-gradient-to-t from-orange-900/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
             <p className="text-[9px] sm:text-[10px] font-bold text-orange-500/70 uppercase tracking-widest mb-1 text-center whitespace-nowrap">Andamento</p>
             <p className="text-xl md:text-2xl font-bold text-orange-500 tracking-tight drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]">{displayEmAndamento.toString().padStart(2, '0')}</p>
          </div>
          <div className="bg-[#0B0F19] px-3 md:px-4 py-3 rounded-2xl border border-indigo-900/20 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group/card shadow-[0_0_20px_rgba(0,0,0,0.5)]">
             <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
             <p className="text-[9px] sm:text-[10px] font-bold text-indigo-500/70 uppercase tracking-widest mb-1 text-center whitespace-nowrap">Protocolo</p>
             <p className="text-xl md:text-2xl font-bold text-indigo-500 tracking-tight drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]">{displayProtocolado.toString().padStart(2, '0')}</p>
          </div>
          <div className="bg-[#0B0F19] px-3 md:px-4 py-3 rounded-2xl border border-emerald-900/20 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group/card shadow-[0_0_20px_rgba(0,0,0,0.5)]">
             <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
            <p className="text-[9px] sm:text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest mb-1 text-center whitespace-nowrap">Concluído</p>
            <p className="text-xl md:text-2xl font-bold text-emerald-500 tracking-tight drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{displayConcluido.toString().padStart(2, '0')}</p>
          </div>
          <div className="bg-[#0B0F19] px-3 md:px-4 py-3 rounded-2xl border border-rose-900/20 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group/card shadow-[0_0_20px_rgba(0,0,0,0.5)]">
             <div className="absolute inset-0 bg-gradient-to-t from-rose-900/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
            <p className="text-[9px] sm:text-[10px] font-bold text-rose-500/70 uppercase tracking-widest mb-1 text-center whitespace-nowrap">Atraso SLA</p>
            <p className="text-xl md:text-2xl font-bold text-rose-500 tracking-tight drop-shadow-[0_0_10px_rgba(225,29,72,0.3)]">{displayAtraso.toString().padStart(2, '0')}</p>
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
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
          const dataVenda = processo.data_venda?.toDate ? processo.data_venda.toDate() : new Date();
          const diffTime = Math.abs(new Date().getTime() - dataVenda.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isAtrasado = diffDays > (processo.prazo_estimado_dias || 7);
          const ready = isProcessReady(processo) && !['Pendente', 'Aguardando Documentação'].includes(processo.status_atual);

          return (
            <motion.div 
              key={processo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.5 }}
              className={`bg-white rounded-xl md:rounded-2xl border p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 transition-all hover:shadow-md hover:-translate-y-0.5 group ${
                isAtrasado ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200'
              }`}
            >
              {/* Info Cliente e Protocolo */}
              <div className="space-y-2 min-w-[200px] w-full lg:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                      #{processo.protocolo || processo.id?.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  {isAtrasado && (
                    <div className="bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                      <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">SLA Crítico</span>
                    </div>
                  )}
                  {ready ? (
                    <div className="bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Docs OK</span>
                    </div>
                  ) : (
                    <div className="bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Pendente</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-[200px] w-full lg:w-auto">
                  {(processo.cliente_cpf_cnpj && processo.cliente_cpf_cnpj.length > 11) || (processo as any).nome_empresa ? (
                    <>
                      <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors truncate max-w-full">
                        {(processo as any).nome_empresa || processo.cliente_nome}
                      </h3>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-[11px] font-medium text-slate-500">
                          CNPJ: <span className="font-mono text-slate-700">{processo.cliente_cpf_cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5")}</span>
                        </p>
                        <p className="text-[11px] font-medium text-slate-500">
                          Rep. Legal: {processo.cliente_nome}
                        </p>
                        {(processo.gestor_nome || processo.vendedor_nome) && (
                          <div className="flex gap-3 mt-1">
                            {processo.gestor_nome && (
                              <p className="text-[11px] font-medium text-slate-500">
                                Gestor: {processo.gestor_nome}
                              </p>
                            )}
                            {processo.vendedor_nome && (
                              <p className="text-[11px] font-medium text-slate-500">
                                Vendedor: {processo.vendedor_nome}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors truncate max-w-full">
                        {processo.cliente_nome}
                      </h3>
                      <div className="flex flex-col gap-1 mt-1">
                        {processo.cliente_cpf_cnpj && (
                          <p className="text-[11px] font-medium text-slate-500">
                            CPF: <span className="font-mono text-slate-700">{processo.cliente_cpf_cnpj?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, "$1.$2.$3-$4")}</span>
                          </p>
                        )}
                        {(processo.gestor_nome || processo.vendedor_nome) && (
                          <div className="flex gap-3 mt-1">
                            {processo.gestor_nome && (
                              <p className="text-[11px] font-medium text-slate-500">
                                Gestor: {processo.gestor_nome}
                              </p>
                            )}
                            {processo.vendedor_nome && (
                              <p className="text-[11px] font-medium text-slate-500">
                                Vendedor: {processo.vendedor_nome}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Informativos de Responsáveis e Tempo */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[10px] font-medium text-slate-500 mt-2">
                  <p>Vend: <span className="text-slate-800">{processo.vendedor_nome || 'N/A'}</span></p>
                  <p>Gestor: <span className="text-slate-800">{processo.gestor_nome || 'N/A'}</span></p>
                  <p>Ana: <span className="text-slate-800">{processo.analista_nome || 'N/A'}</span></p>
                  <p>Há: <span className="text-blue-600 font-semibold">
                    {processo.data_status_atual ? `${Math.ceil((new Date().getTime() - processo.data_status_atual.toDate().getTime()) / (1000 * 60 * 60 * 24))} dias` : '0 dias'}
                  </span></p>
                </div>

                {/* Alerta de Dados Faltantes Detalhado */}
                {!ready && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {!processo.cliente_cpf_cnpj && (
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 truncate">Falta CPF</span>
                    )}
                    {!processo.data_nascimento && (
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 truncate">Falta Nascimento</span>
                    )}
                    {processo.dados_faltantes?.map(f => (
                      <span key={f} className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 truncate max-w-[150px]">Falta: {requirementsConfig?.field_labels?.[f] || f.replace(/_/g, ' ')}</span>
                    ))}
                    {processo.pendencias_iniciais?.filter(d => !processo.documentos_enviados?.includes(d)).map(d => (
                      <span key={d} className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 truncate max-w-[150px]">Pendente: {requirementsConfig?.document_labels?.[d] || d.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 text-slate-500 mt-2">
                  <div className="size-1.5 bg-slate-300 rounded-full shrink-0" />
                  <p className="text-[11px] font-semibold truncate">{processo.servico_nome}</p>
                </div>
              </div>

              {/* Timeline de Status (Dropdown Master / View Only for Sales) */}
              <div className="flex-1 w-full lg:w-auto space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fluxo Operacional</p>
                {isAdm ? (
                  <div className="relative group/select">
                    <select 
                      value={processo.status_atual}
                      onChange={(e) => handleUpdateStatus(processo, e.target.value as any)}
                      className="w-full lg:w-64 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 py-2.5 pl-3 pr-8 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none transition-all hover:bg-slate-100"
                    >
                      <option value="Pendente">1. Pendente</option>
                      <option value="Em Análise">2. Em Análise</option>
                      <option value="Protocolado">3. Protocolado</option>
                      <option value="Em Andamento">4. Em Andamento</option>
                      <option value="Aguardando Documentação">5. Aguardando Doc.</option>
                      <option value="Concluído">6. CONCLUIR PROCESSO</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight size={14} className="rotate-90" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full lg:w-64 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 flex items-center justify-between">
                     <span className="text-xs font-semibold text-slate-700">
                        {processo.status_atual}
                     </span>
                     <div className="size-1.5 rounded-full bg-blue-500 animate-pulse shadow-sm"></div>
                  </div>
                )}
              </div>

              {/* Time & Team (Visible only on larger screens) */}
              <div className="hidden xl:flex items-center justify-end gap-8 border-l border-slate-100 pl-8">
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Data Início</p>
                  <div className="flex items-center justify-end gap-1.5 text-slate-700">
                    <Calendar size={12} className="text-blue-500" />
                    <p className="text-[11px] font-medium">
                      {processo.data_venda?.toDate ? format(processo.data_venda.toDate(), "dd/MM/yy") : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="grid grid-cols-2 lg:flex gap-2 w-full lg:w-auto mt-4 lg:mt-0">
                <button 
                  onClick={() => setSelectedProcess(processo)}
                  className="bg-white text-slate-600 hover:bg-slate-50 h-10 lg:w-10 rounded-lg transition-all shadow-sm flex items-center justify-center border border-slate-200" 
                  title="Ver Pasta do Cliente"
                >
                  <FolderOpen size={16} />
                  <span className="ml-2 lg:hidden text-xs font-semibold">Pasta</span>
                </button>
                {isAdm && (
                  <>
                    <button 
                      onClick={() => handleAbrirPendencia(processo)}
                      className="bg-white text-rose-500 hover:bg-rose-50 h-10 lg:w-10 rounded-lg transition-all shadow-sm flex items-center justify-center border border-rose-200" 
                      title="Abrir Pendência"
                    >
                      <AlertTriangle size={16} />
                      <span className="ml-2 lg:hidden text-xs font-semibold">Pendência</span>
                    </button>
                    <button 
                      onClick={() => handleAtribuirCliente(processo)}
                      className="bg-white text-indigo-500 hover:bg-indigo-50 h-10 lg:w-10 rounded-lg transition-all shadow-sm flex items-center justify-center border border-indigo-200" 
                      title="Atribuir a Cliente"
                    >
                      <UserPlus size={16} />
                      <span className="ml-2 lg:hidden text-xs font-semibold">Atribuir</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}

        {filteredProcessos.length === 0 && (
          <div className="py-32 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 shadow-inner">
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
              className="bg-white w-full max-w-7xl md:max-w-[90vw] max-h-[95vh] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col relative border border-slate-100"
            >
              <button 
                onClick={() => setSelectedProcess(null)}
                className="absolute top-4 right-4 md:top-8 md:right-8 z-50 size-10 md:size-12 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center text-slate-400 shadow-xl border border-slate-100 transition-all"
              >
                <X size={20} className="md:size-6" />
              </button>

              <div className="p-6 md:p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="size-12 md:size-16 bg-blue-600 rounded-2xl md:rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/20 shrink-0">
                    <ShieldCheck className="size-6 md:size-8" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg md:text-3xl font-black text-[#0a0a2e] uppercase tracking-tighter italic truncate">Auditoria</h3>
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Doc: #{selectedProcess.protocolo || selectedProcess.id?.slice(-6).toUpperCase()}</p>
                  </div>
                </div>

                {/* Botão de Excluir para ADM_MASTER */}
                {isAdm && (
                  <button 
                    onClick={() => handleDeleteProcess(selectedProcess)}
                    className="mr-16 px-6 py-3 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Trash2 size={14} />
                    Excluir Processo
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 md:space-y-10 custom-scrollbar">
                {/* Cabeçalho do Cliente */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8">
                  <div className="md:col-span-8 bg-slate-50 p-6 md:p-8 rounded-3xl md:rounded-2xl border border-slate-100 shadow-inner">
                    <div className="flex items-center gap-3 mb-4 md:mb-6">
                      <div className="size-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <UserCheck className="text-blue-600" size={16} />
                      </div>
                      <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</span>
                    </div>
                    <h4 className="text-xl md:text-3xl font-black text-[#0a0a2e] uppercase italic mb-3 md:mb-4 truncate flex items-center gap-3">
                      {selectedProcess.cliente_nome}
                      {isAdm && (
                        <button 
                          onClick={async () => {
                            const { value: novoNome } = await Swal.fire({
                              title: 'Editar Nome do Cliente',
                              input: 'text',
                              inputValue: selectedProcess.cliente_nome,
                              showCancelButton: true
                            });
                            if (novoNome && novoNome !== selectedProcess.cliente_nome) {
                              const { updateCliente } = await import('../../services/leadService');
                              const { registrarLogAuditoria } = await import('../../services/orderService');
                              const { db } = await import('../../firebase');
                              const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
                              
                              await updateCliente(selectedProcess.cliente_id, { nome: novoNome });
                              await updateDoc(fsDoc(db, 'order_processes', selectedProcess.id!), { cliente_nome: novoNome });
                              await registrarLogAuditoria(selectedProcess.id!, `Nome do cliente alterado para: ${novoNome}`, profile?.uid || '', profile?.nome_completo || 'Analista');
                              setSelectedProcess({...selectedProcess, cliente_nome: novoNome});
                              Swal.fire('Atualizado', 'Nome alterado com sucesso.', 'success');
                            }
                          }}
                          className="p-1 hover:bg-white rounded-lg text-slate-300 hover:text-blue-600 transition-all"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                    </h4>
                    <div className="flex flex-wrap gap-4 md:gap-6">
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Documento</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs md:text-sm font-black text-slate-600 uppercase tracking-tight">{selectedProcess.cliente_cpf_cnpj || 'N/A'}</p>
                          {isAdm && (
                            <button 
                              onClick={async () => {
                                const { value: novoDoc } = await Swal.fire({
                                  title: 'Editar CPF/CNPJ',
                                  input: 'text',
                                  inputValue: selectedProcess.cliente_cpf_cnpj,
                                  showCancelButton: true
                                });
                                if (novoDoc !== undefined) {
                                  const cleanDoc = novoDoc.replace(/\D/g, '');
                                  const { updateCliente } = await import('../../services/leadService');
                                  const { registrarLogAuditoria } = await import('../../services/orderService');
                                  const { db } = await import('../../firebase');
                                  const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
                                  
                                  await updateCliente(selectedProcess.cliente_id, { documento: cleanDoc });
                                  await updateDoc(fsDoc(db, 'order_processes', selectedProcess.id!), { cliente_cpf_cnpj: cleanDoc });
                                  await registrarLogAuditoria(selectedProcess.id!, `CPF/CNPJ do cliente alterado para: ${cleanDoc}`, profile?.uid || '', profile?.nome_completo || 'Analista');
                                  setSelectedProcess({...selectedProcess, cliente_cpf_cnpj: cleanDoc});
                                  Swal.fire('Atualizado', 'Documento alterado com sucesso.', 'success');
                                }
                              }}
                              className="p-1 hover:bg-white rounded-lg text-slate-300 hover:text-blue-600 transition-all"
                            >
                              <Edit3 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Nascimento</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs md:text-sm font-black text-slate-600 uppercase tracking-tight">{selectedProcess.data_nascimento || 'N/A'}</p>
                          {isAdm && (
                            <button 
                              onClick={async () => {
                                const { value: novaData } = await Swal.fire({
                                  title: 'Editar Data de Nascimento',
                                  input: 'text',
                                  inputPlaceholder: 'DD/MM/AAAA',
                                  inputValue: selectedProcess.data_nascimento,
                                  showCancelButton: true
                                });
                                if (novaData !== undefined) {
                                  const { updateCliente } = await import('../../services/leadService');
                                  const { registrarLogAuditoria } = await import('../../services/orderService');
                                  const { db } = await import('../../firebase');
                                  const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
                                  
                                  await updateCliente(selectedProcess.cliente_id, { data_nascimento: novaData });
                                  await updateDoc(fsDoc(db, 'order_processes', selectedProcess.id!), { data_nascimento: novaData });
                                  await registrarLogAuditoria(selectedProcess.id!, `Data de nascimento alterada para: ${novaData}`, profile?.uid || '', profile?.nome_completo || 'Analista');
                                  setSelectedProcess({...selectedProcess, data_nascimento: novaData});
                                  Swal.fire('Atualizado', 'Data alterada com sucesso.', 'success');
                                }
                              }}
                              className="p-1 hover:bg-white rounded-lg text-slate-300 hover:text-blue-600 transition-all"
                            >
                              <Edit3 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {isAdm && (
                        <div className="flex gap-4 md:gap-6 flex-wrap">
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">WhatsApp</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs md:text-sm font-black text-slate-600 uppercase tracking-tight">{selectedClient?.whatsapp || selectedClient?.telefone || 'N/A'}</p>
                              <button 
                                onClick={async () => {
                                  const { value: novoTel } = await Swal.fire({
                                    title: 'Editar WhatsApp do Cliente',
                                    input: 'text',
                                    inputValue: selectedClient?.whatsapp || selectedClient?.telefone,
                                    showCancelButton: true
                                  });
                                  if (novoTel !== undefined) {
                                    const cleanTel = novoTel.replace(/\D/g, '');
                                    const { updateCliente } = await import('../../services/leadService');
                                    await updateCliente(selectedProcess.cliente_id, { whatsapp: cleanTel, telefone: cleanTel });
                                    setSelectedClient({...selectedClient, whatsapp: cleanTel, telefone: cleanTel});
                                    Swal.fire('Atualizado', 'WhatsApp alterado com sucesso.', 'success');
                                  }
                                }}
                                className="p-1 hover:bg-white rounded-lg text-slate-300 hover:text-blue-600 transition-all"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">E-mail</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs md:text-sm font-black text-slate-600 uppercase tracking-tight truncate max-w-[150px]">{selectedClient?.email || 'N/A'}</p>
                              <button 
                                onClick={async () => {
                                  const { value: novoEmail } = await Swal.fire({
                                    title: 'Editar E-mail',
                                    input: 'email',
                                    inputValue: selectedClient?.email,
                                    showCancelButton: true
                                  });
                                  if (novoEmail) {
                                    const cleanEmail = novoEmail.trim();
                                    const { updateCliente } = await import('../../services/leadService');
                                    await updateCliente(selectedProcess.cliente_id, { email: cleanEmail });
                                    setSelectedClient({...selectedClient, email: cleanEmail});
                                    Swal.fire('Atualizado', 'E-mail alterado com sucesso.', 'success');
                                  }
                                }}
                                className="p-1 hover:bg-white rounded-lg text-slate-300 hover:text-blue-600 transition-all"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-4 bg-[#0a0a2e] p-6 md:p-8 rounded-3xl md:rounded-2xl text-white flex flex-col justify-center shadow-2xl shadow-blue-900/30">
                    <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1 md:mb-2">Status</span>
                    <h4 className="text-xl md:text-2xl font-black uppercase italic leading-none text-blue-400">{selectedProcess.status_atual}</h4>
                  </div>
                </div>

                {/* Bloco de Tipo de Processo */}
                <div className="bg-emerald-50 p-6 md:p-8 rounded-3xl md:rounded-2xl border border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1 md:mb-2 block">Tipo de Processo (Serviço)</span>
                    <h4 className="text-lg md:text-xl font-black text-emerald-900 uppercase italic">
                      {selectedProcess.servico_nome || 'Não definido'}
                    </h4>
                  </div>
                  {isAdm && (
                     <button onClick={handleMudarServico} className="px-5 py-2.5 bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shrink-0 whitespace-nowrap">
                       Alterar Serviço
                     </button>
                  )}
                </div>

                {/* Bloco de Responsáveis */}
                <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Vendedor</span>
                     <div className="flex items-center gap-2">
                       <p className="text-sm font-black text-slate-700 truncate">{selectedProcess.vendedor_nome || 'N/A'}</p>
                       {isAdm && (
                         <button onClick={() => selecionarResponsavel('VENDEDOR', 'vendedor')} className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-blue-600 transition-colors shrink-0">
                            <Edit3 size={12} />
                         </button>
                       )}
                     </div>
                  </div>
                  <div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Gestor</span>
                     <div className="flex items-center gap-2">
                       <p className="text-sm font-black text-slate-700 truncate">{selectedProcess.gestor_nome || 'N/A'}</p>
                       {isAdm && (
                         <button onClick={() => selecionarResponsavel('GESTOR', 'gestor')} className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-blue-600 transition-colors shrink-0">
                            <Edit3 size={12} />
                         </button>
                       )}
                     </div>
                  </div>
                  <div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Analista</span>
                     <div className="flex items-center gap-2">
                       <p className="text-sm font-black text-slate-700 truncate">{selectedProcess.analista_nome || 'N/A'}</p>
                       {isAdm && (
                         <button onClick={() => selecionarResponsavel('ADM_ANALISTA', 'analista')} className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-blue-600 transition-colors shrink-0">
                            <Edit3 size={12} />
                         </button>
                       )}
                     </div>
                  </div>
                </div>

                {/* Grid Duplo para Mobile e Desktop */}
                <div className="flex flex-col lg:flex-row gap-6 md:gap-6 h-auto lg:h-[650px] min-h-0">
                  {/* Checklist de Documentação */}
                  <div className="w-full lg:w-[35%] flex flex-col space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <div className="size-8 md:size-10 bg-slate-50 rounded-xl flex items-center justify-center shadow-sm">
                          <FileText size={18} className="text-blue-600" />
                        </div>
                        <h4 className="text-sm md:text-lg font-black text-[#0a0a2e] uppercase tracking-tighter italic whitespace-nowrap">Documentos</h4>
                      </div>
                      <div className="bg-blue-50 px-3 md:px-4 py-1.5 rounded-full border border-blue-100 shrink-0">
                        <span className="text-[8px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest">
                          {selectedProcess.documentos_enviados?.length || 0}/{selectedProcess.pendencias_iniciais?.length || 0} OK
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 grid grid-cols-1 gap-3 md:gap-4 overflow-y-visible lg:overflow-y-auto pr-0 lg:pr-4 custom-scrollbar content-start">
                      {selectedProcess.pendencias_iniciais?.map((docKey) => {
                        const isEnviado = selectedProcess.documentos_enviados?.includes(docKey);
                        return (
                          <div 
                            key={docKey}
                            className={`flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-[1.8rem] border transition-all ${
                              isEnviado 
                                ? 'bg-emerald-50 border-emerald-100 shadow-sm' 
                                : 'bg-slate-50 border-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-3 md:gap-4 min-w-0">
                              <div className={`size-10 md:size-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
                                isEnviado ? 'bg-white text-emerald-500' : 'bg-white text-slate-300'
                              }`}>
                                {isEnviado ? <CheckCircle className="size-5 md:size-6" /> : <Clock className="size-5 md:size-6" />}
                              </div>
                              <span className={`text-[10px] md:text-[11px] font-black uppercase tracking-tight truncate ${
                                isEnviado ? 'text-emerald-700' : 'text-slate-400'
                              }`}>
                                {requirementsConfig?.document_labels?.[docKey] || docKey}
                              </span>
                            </div>
                          {isEnviado ? (
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
                              {isAdm && (
                                <button 
                                  onClick={() => handleAbrirPendencia(selectedProcess)}
                                  className="size-10 bg-white text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center border border-rose-100"
                                  title="Reprovar / Abrir Pendência"
                                >
                                  <XCircle size={16} />
                                </button>
                              )}
                            </div>
                          ) : (
                            isAdm ? (
                              <button
                                onClick={() => handleConfirmarRecebimentoManual(selectedProcess, docKey)}
                                className="px-3 py-1.5 md:px-0 md:size-10 bg-white text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center border border-amber-100 shrink-0"
                                title="Confirmar Recebimento Manualmente"
                              >
                                <CheckCircle size={16} className="md:hidden mr-1.5 shrink-0" />
                                <span className="md:hidden text-[10px] uppercase font-bold tracking-widest">OK</span>
                                <CheckCircle size={16} className="hidden md:block" />
                              </button>
                            ) : null
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dados da Ficha */}
                <div className="w-full lg:w-[65%] flex flex-col overflow-y-visible lg:overflow-y-auto p-0 lg:p-4 lg:pl-10 custom-scrollbar">
                  <SmartFicha 
                    processos={[selectedProcess]} 
                    clienteDados={selectedClient || { 
                      id: selectedProcess.cliente_id, 
                      uid: selectedProcess.cliente_id,
                      nome_completo: selectedProcess.cliente_nome,
                      cpf: selectedProcess.cliente_cpf_cnpj,
                      data_nascimento: selectedProcess.data_nascimento,
                      ...selectedProcess
                    }} 
                    onUpdate={async () => {
                      setSelectedProcess(null);
                      const procs = await listarTodosProcessos(profile || undefined);
                      setProcessos(procs);
                    }} 
                    isAdm={isAdm}
                    onConfirmManual={(docKey) => handleConfirmarRecebimentoManual(selectedProcess, docKey)}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-wrap justify-center sm:justify-end gap-3 md:gap-4 shrink-0">
                <button 
                  onClick={() => setSelectedProcess(null)}
                  className="px-6 md:px-5 py-4 md:py-5 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0a0a2e] transition-all"
                >
                  Fechar
                </button>
                {!isProcessReady(selectedProcess) && isAdm && (
                  <button 
                    onClick={() => handleNotificarPendencias(selectedProcess)}
                    className="px-6 md:px-5 py-4 md:py-5 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <AlertTriangle size={14} />
                    Cobrar
                  </button>
                )}
                <button 
                  onClick={() => handleDownloadPDF(selectedProcess)}
                  disabled={generatingPdf}
                  className="px-6 md:px-5 py-4 md:py-5 bg-white border border-slate-100 text-[#0a0a2e] rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generatingPdf ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />}
                  Ficha Técnica
                </button>
                {isAdm && (
                  <button className="px-6 md:px-5 py-4 md:py-5 bg-[#0a0a2e] text-white rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 shadow-2xl shadow-blue-900/30 transition-all">
                    Protocolo Final
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
