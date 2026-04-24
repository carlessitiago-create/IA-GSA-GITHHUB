// src/components/GSA/ProcessModelsManager.tsx

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings2, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  AlertCircle, 
  RefreshCw, 
  FileText, 
  ClipboardCheck,
  Zap
} from 'lucide-react';
import { 
  ProcessModel, 
  listarModelosProcesso, 
  excluirModeloProcesso, 
  salvarModeloProcesso 
} from '../../services/modelService';
import { PROCESS_REQUIREMENTS } from '../../constants/processRequirements';
import { ProcessModelEditor } from './ProcessModelEditor';
import Swal from 'sweetalert2';

export const ProcessModelsManager: React.FC = () => {
  const [modelos, setModelos] = useState<ProcessModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editando, setEditando] = useState<ProcessModel | null>(null);

  const carregarModelos = async () => {
    setLoading(true);
    try {
      const data = await listarModelosProcesso();
      setModelos(data);
      
      // Se não houver modelos, oferecer migração inicial
      if (data.length === 0) {
        const confirm = await Swal.fire({
          title: 'Migração Inicial',
          text: 'Deseja importar os modelos padrão do sistema para o banco de dados?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sim, Importar',
          cancelButtonText: 'Agora Não'
        });

        if (confirm.isConfirmed) {
          await migrarModelosPadrao();
        }
      }
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const migrarModelosPadrao = async () => {
    setLoading(true);
    try {
      for (const [id, req] of Object.entries(PROCESS_REQUIREMENTS)) {
        await salvarModeloProcesso({
          id,
          nome: id.replace(/_/g, ' '),
          campos: req.campos,
          documentos: req.documentos
        });
      }
      await carregarModelos();
      Swal.fire('Sucesso', 'Modelos migrados com sucesso!', 'success');
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarModelos();
  }, []);

  const handleExcluir = async (id: string) => {
    const confirm = await Swal.fire({
      title: 'Excluir Modelo?',
      text: 'Esta ação não pode ser desfeita e afetará o portal de todos os clientes deste serviço.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Sim, Excluir',
      cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
      try {
        await excluirModeloProcesso(id);
        await carregarModelos();
        Swal.fire('Excluído', 'Modelo removido com sucesso.', 'success');
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  };

  const filteredModelos = modelos.filter(m => 
    (m.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="text-blue-600 animate-spin" size={32} />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando Modelos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnimatePresence mode="wait">
        {editando ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <ProcessModelEditor 
              modelo={editando} 
              onSave={() => {
                setEditando(null);
                carregarModelos();
              }}
              onCancel={() => setEditando(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 sm:space-y-8"
          >
            {/* Header / Search */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 sm:gap-6 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
              <div className="relative flex-1 w-full group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-4 sm:size-5 transition-colors group-focus-within:text-blue-500" />
                <input 
                  type="text"
                  placeholder="Buscar modelo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300"
                />
              </div>
              <button 
                onClick={() => setEditando({ id: `MODEL_${Date.now()}`, nome: 'Novo Modelo', campos: [], documentos: [] })}
                className="w-full lg:w-auto bg-[#0a0a2e] text-white px-8 py-3.5 sm:py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-900/20"
              >
                <Plus size={16} /> 
                <span className="whitespace-nowrap">Novo Modelo</span>
              </button>
            </div>

            {/* Grid de Modelos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredModelos.map((modelo) => (
                <div 
                  key={modelo.id}
                  className="bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:rotate-12 transition-transform duration-1000 pointer-events-none">
                    <Settings2 size={120} />
                  </div>

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="size-12 sm:size-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner border border-blue-100/50">
                      <Settings2 size={24} />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditando(modelo)}
                        className="size-9 sm:size-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => handleExcluir(modelo.id)}
                        className="size-9 sm:size-10 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 mb-6 relative z-10">
                    <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-white uppercase italic leading-tight group-hover:text-blue-600 transition-colors">{modelo.nome}</h4>
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 min-w-0">
                      ID: <span className="truncate">{modelo.id}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <ClipboardCheck size={12} className="text-blue-500" />
                        <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Campos</span>
                      </div>
                      <p className="text-xl font-black text-[#0a0a2e] dark:text-slate-300 leading-none">{modelo.campos.length}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText size={12} className="text-emerald-500" />
                        <span className="text-[8px] sm:text-[9px] font-black text-emerald-600 uppercase tracking-widest">Docs</span>
                      </div>
                      <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 leading-none">{modelo.documentos.length}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <Zap size={12} className="text-amber-500 animate-pulse" />
                    <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Ativo em Tempo Real
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filteredModelos.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <div className="size-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle size={40} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-400 italic">Nenhum modelo de processo encontrado.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
