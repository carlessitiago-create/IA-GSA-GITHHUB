import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  FileText, 
  History, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Phone,
  Calendar,
  Briefcase
} from 'lucide-react';
import { OrderProcess } from '../../services/orderService';
import { formatDateTime } from '../../lib/dateUtils';
import { useRequirements } from '../../hooks/useRequirements';

interface ProcessDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  process: OrderProcess;
  history: any[];
  clienteData?: any;
}

export const ProcessDetailModal: React.FC<ProcessDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  process, 
  history,
  clienteData 
}) => {
  const { config: requirementsConfig } = useRequirements();

  const myHistory = history
    .filter(h => h.processo_id === process.id)
    .sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return timeB - timeA;
    });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col relative border border-slate-100 dark:border-slate-800"
        >
          {/* Header */}
          <div className="p-6 md:p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="size-12 md:size-16 bg-blue-600 rounded-2xl md:rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h3 className="text-xl md:text-3xl font-black text-[#0a0a2e] dark:text-white uppercase tracking-tighter italic">Detalhes do Processo</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo: #{process.protocolo || process.id?.slice(-6).toUpperCase()}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="size-10 md:size-12 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 shadow-xl border border-slate-100 dark:border-slate-700 transition-all"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar">
            {/* Informações do Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-8 bg-slate-50 dark:bg-slate-800/50 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-8 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center shadow-sm">
                    <User className="text-blue-600" size={16} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informações do Cliente</span>
                </div>
                <h4 className="text-2xl md:text-3xl font-black text-[#0a0a2e] dark:text-white uppercase italic mb-4">{process.cliente_nome}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Documento</p>
                    <p className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">{process.cliente_cpf_cnpj || 'Não informado'}</p>
                  </div>
                  {clienteData?.telefone && (
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">WhatsApp</p>
                      <p className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight flex items-center gap-2">
                        <Phone size={14} className="text-emerald-500" />
                        {clienteData.telefone}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-4 bg-[#0a0a2e] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] text-white flex flex-col justify-center shadow-2xl shadow-blue-900/20">
                <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-2">Status Atual</span>
                <h4 className="text-xl md:text-2xl font-black uppercase italic leading-none text-blue-400">{process.status_atual}</h4>
                <div className="mt-8 pt-6 border-t border-white/10">
                  <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-2">Serviço</span>
                  <p className="text-sm font-black uppercase tracking-tight">{process.servico_nome}</p>
                </div>
              </div>
            </div>

            {/* Requisitos e Documentos */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <div className="size-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <h4 className="text-lg font-black text-[#0a0a2e] dark:text-white uppercase tracking-tighter italic">Requisitos do Serviço</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {process.pendencias_iniciais?.map((docKey) => {
                  const isEnviado = process.documentos_enviados?.includes(docKey);
                  return (
                    <div 
                      key={docKey}
                      className={`flex items-center justify-between p-5 rounded-[1.5rem] border transition-all ${
                        isEnviado 
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30 shadow-sm' 
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`size-10 rounded-xl flex items-center justify-center shadow-sm ${
                          isEnviado ? 'bg-white dark:bg-slate-700 text-emerald-500' : 'bg-white dark:bg-slate-700 text-slate-300'
                        }`}>
                          {isEnviado ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-tight ${
                          isEnviado ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'
                        }`}>
                          {requirementsConfig.document_labels[docKey] || docKey}
                        </span>
                      </div>
                      {isEnviado && clienteData?.[docKey] && (
                        <a 
                          href={clienteData[docKey]} 
                          target="_blank" 
                          rel="noreferrer"
                          className="size-9 bg-white dark:bg-slate-700 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center border border-emerald-100 dark:border-emerald-800/30"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Histórico de Atualizações */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <div className="size-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                  <History size={20} className="text-blue-600" />
                </div>
                <h4 className="text-lg font-black text-[#0a0a2e] dark:text-white uppercase tracking-tighter italic">Histórico de Atualizações</h4>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8">
                <div className="space-y-6">
                  {myHistory.length > 0 ? (
                    myHistory.map((h, i) => (
                      <div key={h.id || i} className="flex gap-4 relative">
                        {i < myHistory.length - 1 && (
                          <div className="absolute left-[11px] top-[24px] bottom-[-24px] w-[2px] bg-slate-200 dark:bg-slate-700" />
                        )}
                        <div className="size-6 rounded-full bg-blue-600 border-4 border-white dark:border-slate-800 shrink-0 z-10" />
                        <div className="flex-1 pb-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-black text-[#0a0a2e] dark:text-white uppercase tracking-tight">
                              {h.status_anterior} <span className="text-slate-400 mx-2">→</span> {h.novo_status}
                            </p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              {formatDateTime(h.timestamp?.toDate())}
                            </span>
                          </div>
                          {h.observacao && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mt-2">
                              "{h.observacao}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="mx-auto text-slate-300 mb-2" size={32} />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma atualização registrada ainda.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 md:p-10 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button 
              onClick={onClose}
              className="px-10 py-4 bg-[#0a0a2e] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 shadow-2xl shadow-blue-900/30 transition-all"
            >
              Fechar Detalhes
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
