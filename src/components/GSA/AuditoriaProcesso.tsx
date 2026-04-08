// src/components/GSA/AuditoriaProcesso.tsx

import React, { useState } from 'react';
import { CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';
import { PROCESS_REQUIREMENTS } from '../../constants/processRequirements';
import { OrderProcess, abrirPendenciaCascata, registrarLogAuditoria } from '../../services/orderService';
import { updateCliente } from '../../services/leadService';
import { useAuth } from '../AuthContext';
import Swal from 'sweetalert2';
import { useRequirements } from '../../hooks/useRequirements';

interface AuditoriaProcessoProps {
  processo?: OrderProcess;
  clienteData?: any;
  onUpdate?: () => void;
  models?: Record<string, any>;
}

export const AuditoriaProcesso: React.FC<AuditoriaProcessoProps> = ({ processo, clienteData, onUpdate, models }) => {
  const { profile } = useAuth();
  const { config: requirementsConfig } = useRequirements();
  
  if (!processo || !clienteData) {
    return (
      <div className="p-12 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
        <Shield size={48} className="mx-auto text-slate-200 mb-4" />
        <h3 className="text-lg font-black text-slate-800 uppercase italic">Auditoria SLA</h3>
        <p className="text-slate-400 font-bold mt-2">Selecione um processo na Fila de Produção para iniciar a auditoria técnica.</p>
      </div>
    );
  }

  // Prioriza os requisitos salvos no processo (snapshot da venda)
  const requisitos = (processo.dados_faltantes && processo.pendencias_iniciais && 
                     (processo.dados_faltantes.length > 0 || processo.pendencias_iniciais.length > 0))
    ? { campos: processo.dados_faltantes, documentos: processo.pendencias_iniciais }
    : models?.[processo.servico_id] || PROCESS_REQUIREMENTS[processo.servico_id] || { campos: [], documentos: [] };

  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckItem = async (item: string, tipo: 'CAMPO' | 'DOCUMENTO', existe: boolean) => {
    setLoading(item);
    try {
      const label = tipo === 'CAMPO' ? requirementsConfig.field_labels[item] : requirementsConfig.document_labels[item];
      
      if (!existe) {
        // Solicitar mensagens para a pendência
        const { value: formValues } = await Swal.fire({
          title: 'Gerar Pendência',
          html:
            `<div class="space-y-4 text-left">
              <div>
                <label class="text-[10px] font-bold uppercase text-slate-400">Mensagem Interna (Analista -> Gestor)</label>
                <textarea id="swal-input-interna" class="w-full p-2 text-xs border rounded-xl" placeholder="Detalhes técnicos para o gestor..."></textarea>
              </div>
              <div>
                <label class="text-[10px] font-bold uppercase text-slate-400">Mensagem Pública (Para o Cliente)</label>
                <textarea id="swal-input-publica" class="w-full p-2 text-xs border rounded-xl" placeholder="O que o cliente deve fazer..."></textarea>
              </div>
            </div>`,
          focusConfirm: false,
          showCancelButton: true,
          confirmButtonText: 'Gerar Pendência',
          preConfirm: () => {
            return {
              interna: (document.getElementById('swal-input-interna') as HTMLTextAreaElement).value,
              publica: (document.getElementById('swal-input-publica') as HTMLTextAreaElement).value
            }
          }
        });

        if (!formValues) {
          setLoading(null);
          return;
        }

        // Criar pendência em cascata
        await abrirPendenciaCascata({
          vendaId: processo.venda_id,
          processo_id: processo.id!,
          descricao: `${tipo === 'CAMPO' ? 'Dados Faltantes' : 'Documento Faltante'}: ${label}`,
          criado_por_id: profile?.uid || '',
          mensagem_interna: formValues.interna,
          mensagem_publica: formValues.publica
        });
        
        Swal.fire({
          icon: 'success',
          title: 'Pendência Gerada',
          text: `A pendência para "${label}" foi enviada para aprovação do Gestor.`,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        // Registrar log de conferência manual
        await registrarLogAuditoria(
          processo.id!, 
          `Item "${label}" (${tipo}) conferido e validado manualmente.`,
          profile?.uid || '',
          profile?.nome_completo || 'Analista'
        );
        
        Swal.fire({
          icon: 'success',
          title: 'Item Validado',
          text: `O item "${label}" foi marcado como conferido.`,
          timer: 1500,
          showConfirmButton: false
        });
      }
      if (onUpdate) onUpdate();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateField = async (field: string, value: string) => {
    if (!value) return;
    setLoading(field);
    try {
      await updateCliente(processo.cliente_id!, { [field]: value });
      await registrarLogAuditoria(
        processo.id!, 
        `Campo "${requirementsConfig.field_labels[field] || field}" preenchido manualmente pelo analista.`,
        profile?.uid || '',
        profile?.nome_completo || 'Analista'
      );
      Swal.fire({
        icon: 'success',
        title: 'Dados Atualizados',
        timer: 1500,
        showConfirmButton: false
      });
      if (onUpdate) onUpdate();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const missingFields = requisitos.campos.filter(campo => !clienteData[campo]);
  const missingDocs = requisitos.documentos.filter(doc => !clienteData.documentos?.[doc] && !processo[`check_${doc}`]);
  const allRequirementsMet = missingFields.length === 0 && missingDocs.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Shield size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase italic">Ficha de Auditoria Inteligente</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verificação de Requisitos: {processo.servico_nome}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${allRequirementsMet ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {allRequirementsMet ? 'REQUISITOS OK' : 'REQUISITOS PENDENTES'}
        </div>
      </div>

      {!allRequirementsMet && (
        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
          <AlertCircle className="text-amber-600 shrink-0" size={16} />
          <div>
            <p className="text-[10px] font-black text-amber-800 uppercase">Trava de Análise Ativa</p>
            <p className="text-[9px] text-amber-700 mt-0.5">O status "Em Andamento" está bloqueado até que todos os itens abaixo sejam validados.</p>
          </div>
        </div>
      )}

      {/* Campos de Dados */}
      {requisitos.campos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Info size={12} /> Campos de Informação
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {requisitos.campos.map(campo => {
              const valor = clienteData[campo];
              const preenchido = !!valor;
              
              return (
                <div key={campo} className={`flex flex-col p-3 rounded-2xl border transition-all ${preenchido ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-700">{requirementsConfig.field_labels[campo] || campo}</span>
                    <div className="flex gap-2">
                      <button 
                        disabled={loading === campo}
                        onClick={() => handleCheckItem(campo, 'CAMPO', true)} 
                        className={`p-1.5 rounded-lg transition-colors ${preenchido ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        title="Validar Item"
                      >
                        <CheckCircle size={18}/>
                      </button>
                      <button 
                        disabled={loading === campo}
                        onClick={() => handleCheckItem(campo, 'CAMPO', false)} 
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Gerar Pendência"
                      >
                        <XCircle size={18}/>
                      </button>
                    </div>
                  </div>
                  
                  {!preenchido ? (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder={`Preencher ${requirementsConfig.field_labels[campo] || campo}...`}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        onBlur={(e) => handleUpdateField(campo, e.target.value)}
                      />
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-slate-500 italic truncate">{valor}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Documentos */}
      {requisitos.documentos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Paperclip size={12} /> Documentação Necessária
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {requisitos.documentos.map(doc => (
              <div key={doc} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-xs font-bold text-slate-700">{requirementsConfig.document_labels[doc] || doc}</span>
                <div className="flex gap-2">
                  <button 
                    disabled={loading === doc}
                    onClick={() => handleCheckItem(doc, 'DOCUMENTO', true)} 
                    className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Validar Documento"
                  >
                    <CheckCircle size={18}/>
                  </button>
                  <button 
                    disabled={loading === doc}
                    onClick={() => handleCheckItem(doc, 'DOCUMENTO', false)} 
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Gerar Pendência"
                  >
                    <XCircle size={18}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
        <AlertCircle className="text-amber-600 shrink-0" size={18} />
        <p className="text-[10px] font-medium text-amber-800 leading-relaxed">
          Ao marcar um item como <span className="font-bold">X (Vermelho)</span>, o sistema enviará automaticamente uma notificação de pendência para o cliente e seu especialista responsável.
        </p>
      </div>
    </div>
  );
};

// Helper components for icons
const Shield = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const Paperclip = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
