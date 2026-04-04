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
            className="space-y-6"
          >
            {/* Header / Search */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar modelo por nome ou ID..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <button 
                onClick={() => setEditando({ id: `MODEL_${Date.now()}`, nome: 'Novo Modelo', campos: [], documentos: [] })}
                className="w-full md:w-auto bg-blue-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg"
              >
                <Plus size={18} /> Criar Novo Modelo
              </button>
            </div>

            {/* Grid de Modelos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredModelos.map((modelo) => (
                <div 
                  key={modelo.id}
                  className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="size-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600">
                      <Settings2 size={24} />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditando(modelo)}
                        className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => handleExcluir(modelo.id)}
                        className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase italic mb-1">{modelo.nome}</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">ID: {modelo.id}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/50">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck size={12} className="text-blue-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase">Campos</span>
                      </div>
                      <p className="text-lg font-black text-slate-700 dark:text-slate-300">{modelo.campos.length}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={12} className="text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase">Docs</span>
                      </div>
                      <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{modelo.documentos.length}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <Zap size={12} className="text-amber-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Sincronização Ativa em Tempo Real
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
