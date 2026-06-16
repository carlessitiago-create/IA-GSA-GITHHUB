import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SplitSquareVertical, Save, Info, CheckCircle, Percent } from 'lucide-react';
import Swal from 'sweetalert2';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface SplitConfig {
  vendedor: number;
  gestor: number;
  analista: number;
}

export function SplitCommissionSettingsView() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [split, setSplit] = useState<SplitConfig>({
    vendedor: 10,
    gestor: 5,
    analista: 5
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const docRef = doc(db, 'configuracoes', 'geral_split');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as SplitConfig;
        setSplit({
          vendedor: data.vendedor ?? 0,
          gestor: data.gestor ?? 0,
          analista: data.analista ?? 0
        });
      }
    } catch (e) {
      console.error('Error fetching split config', e);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await setDoc(doc(db, 'configuracoes', 'geral_split'), split);
      
      Swal.fire({
        icon: 'success',
        title: 'Sucesso',
        text: 'Parametrização de comissões atualizada com sucesso!',
        confirmButtonColor: '#0a0a2e'
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Erro', 'Não foi possível salvar as configurações.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return (split.vendedor + split.gestor + split.analista).toFixed(1);
  };

  const restanteEmpresa = () => {
    return (100 - parseFloat(calculateTotal())).toFixed(1);
  };

  if (fetching) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="size-10 sm:size-12 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
            <SplitSquareVertical size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter italic leading-none">
              Split de Comissões
            </h1>
            <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mt-1">
              Parametrização global de repasses automatizados
            </p>
          </div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-sm"
      >
        <div className="flex bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 mb-8 gap-4">
          <Info className="text-blue-400 shrink-0" size={24} />
          <div>
            <h4 className="text-blue-400 font-bold mb-1">Como funciona o Split?</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Os percentuais definidos abaixo serão aplicados automaticamente sobre o <strong className="text-white">valor líquido pago</strong> de cada venda realizada na plataforma. 
              O valor restante da operação sempre será destinado ao Caixa da Empresa.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Card Vendedor */}
          <div className="bg-[#0a0a2e] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Percent size={48} />
            </div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Comissão do Vendedor</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={split.vendedor}
                onChange={e => setSplit({ ...split, vendedor: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 text-white text-3xl font-black rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">%</span>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-3">Responsável direto pelo fechamento.</p>
          </div>

          {/* Card Gestor */}
          <div className="bg-[#0a0a2e] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Percent size={48} />
            </div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Comissão do Gestor</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={split.gestor}
                onChange={e => setSplit({ ...split, gestor: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 text-white text-3xl font-black rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">%</span>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-3">Gestor direto da equipe do vendedor.</p>
          </div>

          {/* Card Analista */}
          <div className="bg-[#0a0a2e] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Percent size={48} />
            </div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Comissão do Analista</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={split.analista}
                onChange={e => setSplit({ ...split, analista: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 text-white text-3xl font-black rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">%</span>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-3">Responsável pela execução/backend.</p>
          </div>
        </div>

        {/* Resumo */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
          <div>
            <p className="text-slate-400 text-sm font-semibold mb-1">Resumo da Distribuição</p>
            <div className="flex items-center gap-4">
              <span className="text-emerald-400 font-black text-2xl">{calculateTotal()}%</span>
              <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Repassado</span>
              <span className="h-4 w-[1px] bg-white/20"></span>
              <span className="text-blue-400 font-black text-2xl">{restanteEmpresa()}%</span>
              <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Caixa Empresa</span>
            </div>
          </div>

          <div className="w-full sm:w-1/2 h-4 bg-[#0a0a2e] rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${split.vendedor}%` }} title="Vendedor"></div>
            <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${split.gestor}%` }} title="Gestor"></div>
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${split.analista}%` }} title="Analista"></div>
            <div className="h-full bg-indigo-500 opacity-50 transition-all duration-500" style={{ width: `${restanteEmpresa()}%` }} title="Empresa"></div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading || Number(calculateTotal()) > 100}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] sm:text-xs py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <Save size={18} />
              Salvar Parametrização
            </>
          )}
        </button>

      </motion.div>
    </div>
  );
}
