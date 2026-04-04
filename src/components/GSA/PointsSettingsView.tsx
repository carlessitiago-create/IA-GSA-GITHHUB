import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Trophy, Save, Image as ImageIcon, Plus, Trash2, Edit2, ArrowUp, ArrowDown } from 'lucide-react';
import Swal from 'sweetalert2';

export const PointsSettingsView = () => {
  const [rules, setRules] = useState<any>({
    cadastro: 50, 
    indicacao: 100, 
    pagamento_dia: 20, 
    pagamento_antecipado: 50, 
    venda_vendedor: 150, 
    venda_gestor: 75
  });
  const [premios, setPremios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        const snap = await getDoc(doc(db, 'platform_config', 'points_rules'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.valores) setRules(data.valores);
          if (data.premios) setPremios(data.premios);
        }
      } catch (error) {
        console.error("Erro ao carregar regras:", error);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const salvarConfiguracoes = async () => {
    try {
      // Ordenar prêmios antes de salvar
      const premiosOrdenados = [...premios].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      
      await setDoc(doc(db, 'platform_config', 'points_rules'), { 
        valores: rules, 
        premios: premiosOrdenados,
        ultima_atualizacao: new Date().toISOString()
      }, { merge: true });
      setPremios(premiosOrdenados);
      Swal.fire('Salvo!', 'Clube de Pontos atualizado com sucesso.', 'success');
    } catch (error) {
      console.error("Erro ao salvar:", error);
      Swal.fire('Erro!', 'Não foi possível salvar as configurações.', 'error');
    }
  };

  const adicionarPremio = () => {
    Swal.fire({
      title: 'Novo Prêmio',
      html: `
        <input id="swal-input1" class="swal2-input" placeholder="Nome do Produto">
        <input id="swal-input2" class="swal2-input" type="number" placeholder="Pontos necessários">
        <input id="swal-input3" class="swal2-input" placeholder="URL da Foto">
        <input id="swal-input4" class="swal2-input" type="number" placeholder="Ordem (ex: 1, 2, 3)">
        <select id="swal-input5" class="swal2-input">
          <option value="disponivel">Disponível</option>
          <option value="ultimas_unidades">Últimas Unidades</option>
          <option value="esgotado">Esgotado</option>
        </select>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Adicionar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const nome = (document.getElementById('swal-input1') as HTMLInputElement).value;
        const pontos = (document.getElementById('swal-input2') as HTMLInputElement).value;
        const foto = (document.getElementById('swal-input3') as HTMLInputElement).value;
        const ordem = (document.getElementById('swal-input4') as HTMLInputElement).value;
        const status = (document.getElementById('swal-input5') as HTMLSelectElement).value;
        
        if (!nome || !pontos || !foto) {
          Swal.showValidationMessage('Preencha os campos obrigatórios');
          return false;
        }
        
        return { 
          nome, 
          pontos: Number(pontos), 
          foto, 
          ordem: Number(ordem) || (premios.length + 1),
          status 
        };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        setPremios([...premios, { id: Date.now(), ...result.value }]);
      }
    });
  };

  const editarPremio = (premio: any) => {
    Swal.fire({
      title: 'Editar Prêmio',
      html: `
        <input id="swal-input1" class="swal2-input" placeholder="Nome do Produto" value="${premio.nome}">
        <input id="swal-input2" class="swal2-input" type="number" placeholder="Pontos necessários" value="${premio.pontos}">
        <input id="swal-input3" class="swal2-input" placeholder="URL da Foto" value="${premio.foto}">
        <input id="swal-input4" class="swal2-input" type="number" placeholder="Ordem" value="${premio.ordem || 0}">
        <select id="swal-input5" class="swal2-input">
          <option value="disponivel" ${premio.status === 'disponivel' ? 'selected' : ''}>Disponível</option>
          <option value="ultimas_unidades" ${premio.status === 'ultimas_unidades' ? 'selected' : ''}>Últimas Unidades</option>
          <option value="esgotado" ${premio.status === 'esgotado' ? 'selected' : ''}>Esgotado</option>
        </select>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Salvar Alterações',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const nome = (document.getElementById('swal-input1') as HTMLInputElement).value;
        const pontos = (document.getElementById('swal-input2') as HTMLInputElement).value;
        const foto = (document.getElementById('swal-input3') as HTMLInputElement).value;
        const ordem = (document.getElementById('swal-input4') as HTMLInputElement).value;
        const status = (document.getElementById('swal-input5') as HTMLSelectElement).value;
        
        if (!nome || !pontos || !foto) {
          Swal.showValidationMessage('Preencha os campos obrigatórios');
          return false;
        }
        
        return { 
          nome, 
          pontos: Number(pontos), 
          foto, 
          ordem: Number(ordem),
          status 
        };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        setPremios(premios.map(p => p.id === premio.id ? { ...p, ...result.value } : p));
      }
    });
  };

  const moverPremio = (idx: number, direcao: 'up' | 'down') => {
    const novosPremios = [...premios];
    const targetIdx = direcao === 'up' ? idx - 1 : idx + 1;
    
    if (targetIdx < 0 || targetIdx >= novosPremios.length) return;
    
    // Troca as ordens
    const tempOrdem = novosPremios[idx].ordem || 0;
    novosPremios[idx].ordem = novosPremios[targetIdx].ordem || 0;
    novosPremios[targetIdx].ordem = tempOrdem;
    
    // Troca as posições no array
    [novosPremios[idx], novosPremios[targetIdx]] = [novosPremios[targetIdx], novosPremios[idx]];
    
    setPremios(novosPremios);
  };

  const removerPremio = (id: number) => {
    setPremios(premios.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="responsive-card">
      <h2 className="text-2xl font-black italic text-slate-800 mb-6 flex items-center gap-2">
        <Trophy className="text-yellow-500" /> Configuração do Clube de Pontos
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LADO ESQUERDO: Regras de Pontuação */}
        <div className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl">
          <h3 className="font-bold text-slate-700 uppercase flex items-center gap-2 text-sm sm:text-base">
            Valores em Pontos
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Novo Cadastro (Cliente)</label>
              <input 
                type="number" 
                value={rules.cadastro} 
                onChange={e => setRules({...rules, cadastro: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Cliente Indicado</label>
              <input 
                type="number" 
                value={rules.indicacao} 
                onChange={e => setRules({...rules, indicacao: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Pagamento em Dia</label>
              <input 
                type="number" 
                value={rules.pagamento_dia} 
                onChange={e => setRules({...rules, pagamento_dia: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Pagamento Antecipado</label>
              <input 
                type="number" 
                value={rules.pagamento_antecipado} 
                onChange={e => setRules({...rules, pagamento_antecipado: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            
            <div className="col-span-1 sm:col-span-2 border-t border-slate-200 pt-4 mt-2">
              <p className="text-[10px] text-emerald-600 font-bold mb-2 uppercase">Pontuação Interna (Equipe)</p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Venda (P/ Vendedor)</label>
              <input 
                type="number" 
                value={rules.venda_vendedor} 
                onChange={e => setRules({...rules, venda_vendedor: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Venda (P/ Gestor)</label>
              <input 
                type="number" 
                value={rules.venda_gestor} 
                onChange={e => setRules({...rules, venda_gestor: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Vitrine de Objetivos */}
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="font-bold text-slate-700 uppercase text-sm sm:text-base">Objetivos / Prêmios</h3>
            <button 
              onClick={adicionarPremio} 
              className="w-full sm:w-auto text-[10px] font-black uppercase bg-blue-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-blue-800 transition-colors"
            >
              <Plus size={14} /> Add Prêmio
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {premios.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((p, idx) => (
              <div key={p.id} className="group relative bg-white p-3 rounded-2xl shadow-sm border border-slate-200 text-center transition-all hover:shadow-md">
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <button 
                    onClick={() => editarPremio(p)}
                    className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 shadow-sm border border-blue-100"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => removerPremio(p.id)}
                    className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 shadow-sm border border-red-100"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                  <button 
                    onClick={() => moverPremio(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 bg-white text-slate-400 rounded shadow-sm border border-slate-100 hover:bg-slate-50 disabled:opacity-30"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button 
                    onClick={() => moverPremio(idx, 'down')}
                    disabled={idx === premios.length - 1}
                    className="p-1 bg-white text-slate-400 rounded shadow-sm border border-slate-100 hover:bg-slate-50 disabled:opacity-30"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
                
                <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden mb-3 relative">
                  {p.foto ? (
                    <img src={p.foto} className="w-full h-full object-cover" alt={p.nome} referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="text-slate-300" size={32} />
                    </div>
                  )}
                  {p.status && p.status !== 'disponivel' && (
                    <div className={`absolute bottom-0 left-0 right-0 py-1 text-[8px] font-black uppercase text-white ${p.status === 'esgotado' ? 'bg-red-600' : 'bg-orange-500'}`}>
                      {p.status === 'esgotado' ? 'Esgotado' : 'Últimas Unidades'}
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-800 truncate mb-1">{p.nome}</p>
                <div className="flex flex-col items-center gap-1">
                  <div className="inline-flex items-center gap-1 text-[10px] font-black text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full">
                    <Trophy size={10} /> {p.pontos} PTS
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Ordem: {p.ordem || 0}</span>
                </div>
              </div>
            ))}
            {premios.length === 0 && (
              <div className="col-span-1 sm:col-span-2 py-12 text-center text-slate-400 italic text-sm">
                Nenhum prêmio cadastrado.
              </div>
            )}
          </div>
        </div>
      </div>
      
      <button 
        onClick={salvarConfiguracoes} 
        className="mt-8 w-full bg-blue-900 text-white font-black uppercase tracking-widest py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all text-sm sm:text-base"
      >
        <Save size={20} /> Salvar Regras e Prêmios
      </button>
    </div>
  );
};
