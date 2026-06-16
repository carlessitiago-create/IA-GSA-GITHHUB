import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Check, AlertCircle, Save } from 'lucide-react';
import { OrderProcess, atualizarProcesso } from '../../services/orderService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Swal from 'sweetalert2';

interface AbrirPendenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  processo: OrderProcess;
  onPendenciaCriada: (descricao: string, tipo: string) => Promise<void>;
}

export const AbrirPendenciaModal: React.FC<AbrirPendenciaModalProps> = ({ isOpen, onClose, processo, onPendenciaCriada }) => {
  const [loading, setLoading] = useState(false);
  const [descricaoPendencia, setDescricaoPendencia] = useState('');
  const [tipoPendencia, setTipoPendencia] = useState<'DOCUMENTAL' | 'FINANCEIRA' | 'AMBAS'>('DOCUMENTAL');
  
  // Local state for editable fields
  const [dadosPreenchidos, setDadosPreenchidos] = useState<{ [key: string]: any }>(processo.dados_preenchidos || {});

  const handleFieldChange = (key: string, value: any) => {
    setDadosPreenchidos(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveFields = async () => {
    try {
      setLoading(true);
      await atualizarProcesso(processo.id, {
        dados_preenchidos: dadosPreenchidos
      });
      Swal.fire('Sucesso', 'Dados do cliente atualizados com sucesso.', 'success');
    } catch (e: any) {
      Swal.fire('Erro', 'Falha ao salvar dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarPendencia = async () => {
    if (!descricaoPendencia.trim()) {
      Swal.fire('Atenção', 'A descrição da pendência é obrigatória.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await onPendenciaCriada(descricaoPendencia, tipoPendencia);
      onClose();
    } catch (error) {
      // erro tratado no componente pai
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-2xl md:rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]"
        >
          {/* Lado Esquerdo: Conferência de Dados / Documentos */}
          <div className="flex-1 border-r border-slate-100 dark:border-slate-800 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
            <div className="p-6 md:p-8 bg-white dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="text-blue-500" />
                Conferência de Dados Enviados
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Verifique as informações preenchidas pelo cliente ou edite-as.</p>
            </div>
            
            <div className="p-6 md:p-8 space-y-8">
              {/* DADOS COMPLEMENTARES */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Campos Preenchidos</h3>
                  <button onClick={handleSaveFields} disabled={loading} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 flex items-center gap-1">
                    <Save size={14} /> Salvar Edições
                  </button>
                </div>
                
                {Object.keys(dadosPreenchidos).length === 0 ? (
                  <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl text-center text-sm text-slate-500 border border-slate-200 dark:border-slate-700 border-dashed">
                    Nenhum dado complementar foi preenchido.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(dadosPreenchidos).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">{key.replace(/_/g, ' ')}</label>
                        <input 
                          type="text" 
                          value={value as string}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all shadow-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* DOCUMENTOS */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Documentos Enviados</h3>
                {(!processo.documentos_enviados || processo.documentos_enviados.length === 0) ? (
                  <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl text-center text-sm text-slate-500 border border-slate-200 dark:border-slate-700 border-dashed">
                    Nenhum documento anexado.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {processo.documentos_enviados.map((docKey, i) => {
                      const url = processo[docKey as keyof OrderProcess] as string;
                      if (!url || typeof url !== 'string') return null;
                      return (
                        <div key={i} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                              <Check size={16} />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{docKey.replace(/_/g, ' ')}</span>
                          </div>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600">
                            Visualizar
                          </a>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Lado Direito: Ação de Pendência */}
          <div className="flex-1 md:max-w-md flex flex-col bg-white dark:bg-slate-900 border-l border-slate-50 dark:border-slate-800/50">
            <div className="p-6 md:p-8 flex items-center justify-between">
              <h2 className="text-xl font-bold text-red-600 dark:text-red-500 flex items-center gap-2">
                <AlertCircle />
                Nova Pendência
              </h2>
              <button 
                onClick={onClose}
                className="size-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-2xl flex items-center justify-center transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 flex-1 flex flex-col space-y-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Se você encontrou algo errado na documentação ou nas informações preenchidas acima, descreva o problema abaixo para que o vendedor e o cliente sejam notificados.
              </p>

              <div className="flex flex-col space-y-4 flex-1">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Tipo de Pendência</label>
                  <select
                    value={tipoPendencia}
                    onChange={(e) => setTipoPendencia(e.target.value as 'DOCUMENTAL' | 'FINANCEIRA' | 'AMBAS')}
                    className="w-full h-12 px-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:text-white transition-all shadow-sm outline-none"
                  >
                    <option value="DOCUMENTAL">Documental</option>
                    <option value="FINANCEIRA">Financeira</option>
                    <option value="AMBAS">Ambas (Documental e Financeira)</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-2 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Descrição do Problema</label>
                  <textarea 
                    value={descricaoPendencia}
                    onChange={(e) => setDescricaoPendencia(e.target.value)}
                    placeholder="Ex: CNH está com a frente ilegível, favor reenviar foto da frente com mais luz e foco."
                    className="w-full flex-1 min-h-[160px] p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:text-white transition-all shadow-inner resize-none outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleEnviarPendencia}
                  disabled={loading || !descricaoPendencia.trim()}
                  className="w-full h-12 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20"
                >
                  {loading ? 'Processando...' : 'Abrir Pendência Oficial'}
                </button>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="w-full h-10 mt-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
