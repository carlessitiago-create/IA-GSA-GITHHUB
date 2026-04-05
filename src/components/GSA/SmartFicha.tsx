// src/components/GSA/SmartFicha.tsx

import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, Upload, Eye, X, RefreshCw, HelpCircle } from 'lucide-react';
import { processarDadosFichaTecnica } from '../../services/orderService';
import { notificarConclusaoFicha, notificarAjudaFicha } from '../../services/notificationService';
import { PROCESS_REQUIREMENTS } from '../../constants/processRequirements';
import { FileUploader } from './FileUploader';
import { storage, db } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDoc, doc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { useRequirements } from '../../hooks/useRequirements';

import { obterModeloProcesso, ProcessModel } from '../../services/modelService';

interface SmartFichaProps {
  processos: any[];
  clienteDados: any;
  onUpdate?: () => void;
}

export const SmartFicha: React.FC<SmartFichaProps> = ({ processos, clienteDados, onUpdate }) => {
  const { config: requirementsConfig } = useRequirements();
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [requisitosDinamicos, setRequisitosDinamicos] = useState<{ campos: string[], documentos: string[] }>({ campos: [], documentos: [] });
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [requestingHelp, setRequestingHelp] = useState(false);

  useEffect(() => {
    const carregarRequisitos = async () => {
      setLoadingReqs(true);
      try {
        const todosCampos = new Set<string>();
        const todosDocs = new Set<string>();

        for (const processo of processos) {
          // 1. Prioriza requisitos salvos no processo (Snapshot da venda)
          if (processo.dados_faltantes && processo.pendencias_iniciais && 
             (processo.dados_faltantes.length > 0 || processo.pendencias_iniciais.length > 0)) {
            processo.dados_faltantes.forEach((c: string) => todosCampos.add(c));
            processo.pendencias_iniciais.forEach((d: string) => todosDocs.add(d));
          } else {
            // 2. Tenta buscar pelo modelo_id se existir no processo
            const targetId = processo.modelo_id || processo.servico_id;
            const modelo = await obterModeloProcesso(targetId);
            
            if (modelo) {
              modelo.campos.forEach(c => todosCampos.add(c));
              modelo.documentos.forEach(d => todosDocs.add(d));
            } else {
              // 3. Tenta buscar na coleção de serviços (Fábrica)
              const serviceSnap = await getDoc(doc(db, 'services', processo.servico_id));
              if (serviceSnap.exists()) {
                const serviceData = serviceSnap.data();
                if (serviceData.requisitos_campos) serviceData.requisitos_campos.forEach((c: string) => todosCampos.add(c));
                if (serviceData.requisitos_documentos) serviceData.requisitos_documentos.forEach((d: string) => todosDocs.add(d));
              } else {
                // 4. Fallback para estático se não existir no banco
                const fallback = PROCESS_REQUIREMENTS[processo.servico_id];
                if (fallback) {
                  fallback.campos.forEach(c => todosCampos.add(c));
                  fallback.documentos.forEach(d => todosDocs.add(d));
                }
              }
            }
          }
        }

        setRequisitosDinamicos({
          campos: Array.from(todosCampos),
          documentos: Array.from(todosDocs)
        });
      } catch (error) {
        console.error("Erro ao carregar requisitos dinâmicos:", error);
      } finally {
        setLoadingReqs(false);
      }
    };

    if (processos.length > 0) {
      carregarRequisitos();
    }
  }, [processos]);

  const handleFieldChange = (campo: string, valor: string) => {
    setFormData((prev: any) => ({ ...prev, [campo]: valor }));
  };

  const handleSolicitarAjuda = async () => {
    setRequestingHelp(true);
    try {
      const primeiroProcesso = processos[0];
      await notificarAjudaFicha(primeiroProcesso, clienteDados.nome || clienteDados.nome_completo || 'Cliente');
      
      Swal.fire({
        icon: 'success',
        title: 'Pedido Enviado',
        text: 'Nossa equipe técnica foi notificada e entrará em contato em breve para te auxiliar.',
        timer: 3000,
        showConfirmButton: false
      });
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setRequestingHelp(false);
    }
  };

  const handleFileUpload = async (docLabel: string, file: File) => {
    setUploading(docLabel);
    try {
      const clientId = clienteDados.id || clienteDados.uid;
      const storageRef = ref(storage, `documentos_clientes/${clientId}/${docLabel}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // Atualizar ficha com a URL do documento
      const primeiroProcesso = processos[0];
      await processarDadosFichaTecnica(primeiroProcesso.id, clientId, { [docLabel]: url });
      
      Swal.fire({
        icon: 'success',
        title: 'Documento Enviado',
        text: `${requirementsConfig.document_labels[docLabel] || docLabel} foi carregado com sucesso.`,
        timer: 2000,
        showConfirmButton: false
      });
      
      if (onUpdate) onUpdate();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setUploading(null);
    }
  };

  const submitFicha = async () => {
    if (Object.keys(formData).length === 0) return;
    
    setSubmitting(true);
    try {
      const clientId = clienteDados.id || clienteDados.uid;
      const primeiroProcesso = processos[0];
      await processarDadosFichaTecnica(primeiroProcesso.id, clientId, formData);
      
      // Notificar equipe interna
      await notificarConclusaoFicha(primeiroProcesso, clienteDados.nome || clienteDados.nome_completo || 'Cliente');

      Swal.fire({
        icon: 'success',
        title: 'Ficha Atualizada',
        text: 'Suas informações foram salvas com sucesso e o consultor responsável foi notificado.',
        timer: 3000,
        showConfirmButton: false
      });
      setFormData({});
      if (onUpdate) onUpdate();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const camposFaltantes = requisitosDinamicos.campos.filter(c => !clienteDados[c]);
  const documentosFaltantes = requisitosDinamicos.documentos;

  if (loadingReqs) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="text-blue-600 animate-spin" size={24} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Ficha Técnica...</p>
      </div>
    );
  }

  if (camposFaltantes.length === 0 && documentosFaltantes.every(d => !!clienteDados[d])) {
    return (
      <div className="p-6 md:p-8 bg-emerald-50 rounded-[2rem] md:rounded-[32px] border border-emerald-100 text-center space-y-4">
        <div className="size-12 md:size-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle className="text-emerald-600 size-6 md:size-8" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-black text-emerald-900 uppercase italic">Documentação Completa!</h3>
          <p className="text-xs md:text-sm font-medium text-emerald-700">Você já forneceu todas as informações necessárias. O processo agora está em análise pela nossa equipe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="p-4 md:p-6 bg-blue-50 rounded-[2rem] md:rounded-[32px] border border-blue-100 flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
          <AlertCircle className="text-blue-600 size-5 md:size-6" />
        </div>
        <div>
          <h3 className="text-xs md:text-sm font-black text-blue-900 uppercase italic">Formulário de Auto-preenchimento</h3>
          <p className="text-[10px] md:text-xs font-medium text-blue-700 leading-relaxed">
            Identificamos que faltam algumas informações para darmos andamento ao seu processo. 
            Por favor, complete os campos abaixo.
          </p>
        </div>
      </div>

      {/* Secção de Dados */}
      {camposFaltantes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {camposFaltantes.map(campo => (
            <div key={campo} className="space-y-1">
              <label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase ml-2">{requirementsConfig.field_labels[campo] || campo.replace(/_/g, ' ')}</label>
              <input 
                className="w-full bg-slate-50 border-none rounded-xl p-2.5 md:p-3 text-xs md:text-sm focus:ring-2 focus:ring-blue-900/10"
                placeholder={`Preencher ${requirementsConfig.field_labels[campo] || campo}...`}
                onChange={(e) => handleFieldChange(campo, e.target.value)}
                value={formData[campo] !== undefined ? formData[campo] : (clienteDados[campo] || '')}
              />
            </div>
          ))}
        </div>
      )}

      {/* Secção de Documentos */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {documentosFaltantes.map(docLabel => (
          <FileUploader 
            key={docLabel} 
            label={requirementsConfig.document_labels[docLabel] || docLabel} 
            status={clienteDados[docLabel] ? 'resolvido' : 'pendente'}
            existingUrl={clienteDados[docLabel]}
            onUpload={(file) => handleFileUpload(docLabel, file)}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button 
          onClick={submitFicha}
          disabled={submitting || Object.keys(formData).length === 0}
          className="flex-1 bg-blue-900 text-white py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-800 shadow-xl disabled:opacity-50 transition-all"
        >
          {submitting ? 'Salvando...' : 'Atualizar Ficha e Resolver Pendências'}
        </button>
        
        <button 
          onClick={handleSolicitarAjuda}
          disabled={requestingHelp}
          className="px-6 py-3.5 md:py-4 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest transition-all flex items-center justify-center gap-2"
        >
          {requestingHelp ? <RefreshCw className="animate-spin" size={14} /> : <HelpCircle size={14} />}
          Solicitar Ajuda
        </button>
      </div>
    </div>
  );
};
