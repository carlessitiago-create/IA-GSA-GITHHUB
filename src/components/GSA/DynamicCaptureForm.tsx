// src/components/GSA/DynamicCaptureForm.tsx

import React, { useState, useEffect } from 'react';
import { Upload, Save, CheckCircle, AlertCircle, FileText, User, MapPin, CreditCard } from 'lucide-react';
import { PROCESS_REQUIREMENTS } from '../../constants/processRequirements';
import { OrderProcess } from '../../services/orderService';
import { updateCliente } from '../../services/leadService';
import { useAuth } from '../AuthContext';
import { sendNotification } from '../../services/notificationService';
import { storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Swal from 'sweetalert2';
import { useRequirements } from '../../hooks/useRequirements';

interface DynamicCaptureFormProps {
  processos: OrderProcess[];
  clienteData: any;
  onUpdate?: () => void;
}

export const DynamicCaptureForm: React.FC<DynamicCaptureFormProps> = ({ processos, clienteData, onUpdate }) => {
  const { profile } = useAuth();
  const { config: requirementsConfig } = useRequirements();
  
  // Agrega todos os requisitos de todos os processos ativos do cliente
  const todosRequisitos = processos.reduce((acc, proc) => {
    const req = PROCESS_REQUIREMENTS[proc.servico_id] || { campos: [], documentos: [] };
    return {
      campos: Array.from(new Set([...acc.campos, ...req.campos])),
      documentos: Array.from(new Set([...acc.documentos, ...req.documentos]))
    };
  }, { campos: [] as string[], documentos: [] as string[] });

  const [formData, setFormData] = useState<any>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtrar apenas o que está faltando
  const camposFaltantes = todosRequisitos.campos.filter(c => !clienteData[c]);
  const documentosFaltantes = todosRequisitos.documentos; // Documentos sempre mostramos para upload se for o caso

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (field: string, file: File) => {
    setUploading(field);
    try {
      const clientId = clienteData.id || clienteData.uid;
      const storageRef = ref(storage, `documentos_clientes/${clientId}/${field}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // Atualizar o cliente com a URL do documento
      await updateCliente(clientId, { [field]: url });
      
      // Notificar especialistas
      for (const proc of processos) {
        if (proc.vendedor_id) {
          await sendNotification({
            usuario_id: proc.vendedor_id,
            titulo: 'Documento Recebido',
            mensagem: `O cliente ${clienteData.nome || 'N/A'} anexou o documento: ${requirementsConfig.document_labels[field] || field}.`,
            tipo: 'PROCESS'
          });
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Documento Enviado',
        text: `${requirementsConfig.document_labels[field] || field} foi carregado com sucesso.`,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(formData).length === 0) return;
    
    setSubmitting(true);
    try {
      const clientId = clienteData.id || clienteData.uid;
      await updateCliente(clientId, formData);

      // Notificar especialistas
      const fieldsUpdated = Object.keys(formData).map(f => requirementsConfig.field_labels[f] || f).join(', ');
      for (const proc of processos) {
        if (proc.vendedor_id) {
          await sendNotification({
            usuario_id: proc.vendedor_id,
            titulo: 'Dados Atualizados pelo Cliente',
            mensagem: `O cliente ${clienteData.nome || 'N/A'} preencheu os campos: ${fieldsUpdated}.`,
            tipo: 'PROCESS'
          });
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Dados Salvos',
        text: 'Suas informações foram atualizadas com sucesso.',
        timer: 2000,
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

  if (camposFaltantes.length === 0 && documentosFaltantes.length === 0) {
    return (
      <div className="p-8 bg-emerald-50 rounded-[32px] border border-emerald-100 text-center space-y-4">
        <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-emerald-900 uppercase italic">Tudo Pronto!</h3>
          <p className="text-sm font-medium text-emerald-700">Você já forneceu todas as informações necessárias para este serviço.</p>
        </div>
      </div>
    );
  }

  const servicosNomes = Array.from(new Set(processos.map(p => p.servico_nome))).join(', ');

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="p-6 bg-blue-50 rounded-[32px] border border-blue-100 flex gap-4">
        <div className="size-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
          <AlertCircle size={24} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-black text-blue-900 uppercase italic">Formulário de Auto-preenchimento</h3>
          <p className="text-xs font-medium text-blue-700 leading-relaxed">
            Identificamos que faltam algumas informações para darmos andamento ao seu processo de <span className="font-bold">{servicosNomes}</span>. 
            Por favor, complete os campos abaixo.
          </p>
        </div>
      </div>

      {/* Campos de Dados */}
      {camposFaltantes.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
            <User size={12} /> Informações Pessoais / Cadastrais
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {camposFaltantes.map(campo => (
              <div key={campo} className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">
                  {requirementsConfig.field_labels[campo] || campo}
                </label>
                <div className="relative group">
                  <input 
                    type="text"
                    required
                    value={formData[campo] || ''}
                    onChange={(e) => handleInputChange(campo, e.target.value)}
                    placeholder={`Digite seu ${requirementsConfig.field_labels[campo] || campo}...`}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documentos */}
      {documentosFaltantes.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
            <FileText size={12} /> Documentação Digital
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documentosFaltantes.map(doc => {
              const jaEnviado = !!clienteData[doc];
              
              return (
                <div key={doc} className={`p-4 rounded-[24px] border transition-all ${jaEnviado ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase italic">{requirementsConfig.document_labels[doc] || doc}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {jaEnviado ? 'DOCUMENTO RECEBIDO' : 'AGUARDANDO ENVIO'}
                      </p>
                    </div>
                    {jaEnviado && <CheckCircle size={18} className="text-emerald-600" />}
                  </div>
                  
                  <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${jaEnviado ? 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50' : 'border-slate-200 bg-white text-slate-400 hover:border-blue-400 hover:text-blue-600'}`}>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(doc, e.target.files[0])}
                      disabled={uploading === doc}
                    />
                    {uploading === doc ? (
                      <div className="size-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {jaEnviado ? 'Substituir Arquivo' : 'Selecionar Arquivo'}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {camposFaltantes.length > 0 && (
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-900 text-white py-4 rounded-[24px] font-black uppercase italic tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
        >
          {submitting ? (
            <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={20} />
              Salvar Informações
            </>
          )}
        </button>
      )}
    </form>
  );
};
