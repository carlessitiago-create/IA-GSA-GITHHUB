// src/components/GSA/ProcessModelEditor.tsx

import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Save, X, Settings2 } from 'lucide-react';
import { ProcessModel, salvarModeloProcesso } from '../../services/modelService';
import Swal from 'sweetalert2';

interface ProcessModelEditorProps {
  modelo: ProcessModel;
  onSave: (modelo: ProcessModel) => void;
  onCancel: () => void;
}

export const ProcessModelEditor: React.FC<ProcessModelEditorProps> = ({ modelo, onSave, onCancel }) => {
  const [editando, setEditando] = useState<ProcessModel>({ ...modelo });
  const [novoCampo, setNovoCampo] = useState("");
  const [novoDoc, setNovoDoc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const adicionarItem = (tipo: 'campos' | 'documentos') => {
    const valor = tipo === 'campos' ? novoCampo : novoDoc;
    if (!valor) return;

    setEditando(prev => ({
      ...prev,
      [tipo]: [...prev[tipo], valor]
    }));

    if (tipo === 'campos') setNovoCampo("");
    else setNovoDoc("");
  };

  const removerItem = (tipo: 'campos' | 'documentos', index: number) => {
    const lista = [...editando[tipo]];
    lista.splice(index, 1);
    setEditando(prev => ({ ...prev, [tipo]: lista }));
  };

  const handleSave = async () => {
    if (!editando.nome) {
      Swal.fire('Atenção', 'O nome do serviço é obrigatório.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await salvarModeloProcesso(editando);
      Swal.fire({
        icon: 'success',
        title: 'Modelo Salvo',
        text: `O modelo "${editando.nome}" foi atualizado com sucesso.`,
        timer: 2000,
        showConfirmButton: false
      });
      onSave(editando);
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase italic flex items-center gap-2">
          <Edit3 size={20} className="text-blue-600" /> Editar Requisitos: {modelo.nome}
        </h3>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Gestão de Campos de Texto */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Campos de Dados (Ficha)</label>
            <span className="text-[9px] font-bold text-slate-400 uppercase">{editando.campos.length} campos</span>
          </div>
          <div className="flex gap-2">
            <input 
              value={novoCampo} 
              onChange={e => setNovoCampo(e.target.value)}
              placeholder="Ex: Nome do Pai"
              className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20"
              onKeyPress={(e) => e.key === 'Enter' && adicionarItem('campos')}
            />
            <button 
              onClick={() => adicionarItem('campos')} 
              className="bg-blue-900 text-white p-3 rounded-xl hover:bg-blue-800 transition-colors"
            >
              <Plus size={18}/>
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {editando.campos.map((c, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl group border border-transparent hover:border-slate-200 transition-all">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c}</span>
                <button 
                  onClick={() => removerItem('campos', i)} 
                  className="text-slate-300 group-hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={16}/>
                </button>
              </div>
            ))}
            {editando.campos.length === 0 && (
              <p className="text-center text-[10px] text-slate-400 italic py-4">Nenhum campo de dados definido.</p>
            )}
          </div>
        </div>

        {/* Gestão de Documentos (Anexos) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Documentos (Anexos PDF/IMG)</label>
            <span className="text-[9px] font-bold text-slate-400 uppercase">{editando.documentos.length} docs</span>
          </div>
          <div className="flex gap-2">
            <input 
              value={novoDoc} 
              onChange={e => setNovoDoc(e.target.value)}
              placeholder="Ex: Extrato Bancário"
              className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
              onKeyPress={(e) => e.key === 'Enter' && adicionarItem('documentos')}
            />
            <button 
              onClick={() => adicionarItem('documentos')} 
              className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-500 transition-colors"
            >
              <Plus size={18}/>
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {editando.documentos.map((d, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl group border border-transparent hover:border-emerald-100 transition-all">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{d}</span>
                <button 
                  onClick={() => removerItem('documentos', i)} 
                  className="text-slate-300 group-hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={16}/>
                </button>
              </div>
            ))}
            {editando.documentos.length === 0 && (
              <p className="text-center text-[10px] text-slate-400 italic py-4">Nenhum documento obrigatório definido.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button 
          onClick={onCancel}
          className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
        >
          Cancelar
        </button>
        <button 
          onClick={handleSave}
          disabled={submitting}
          className="flex-[2] bg-blue-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-blue-900/10 disabled:opacity-50"
        >
          {submitting ? (
            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save size={20} /> Salvar Modelo de Processo
            </>
          )}
        </button>
      </div>
    </div>
  );
};
