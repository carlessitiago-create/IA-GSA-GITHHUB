import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Trophy, Save, Image as ImageIcon, Plus, Trash2, Edit2, ArrowUp, ArrowDown, Upload } from 'lucide-react';
import Swal from 'sweetalert2';
import { transformImageUrl } from '../../utils/imageUtils';
import { storage } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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

  const uploadImage = (file: File, onProgress?: (percent: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Limite de 5MB para evitar travamentos
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('O arquivo é muito grande (máximo 5MB)'));
        return;
      }

      const storageRef = ref(storage, `club_prizes/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Timeout de 60 segundos para conexões lentas
      const timeout = setTimeout(() => {
        uploadTask.cancel();
        reject(new Error('Tempo limite de upload excedido (60s). Verifique sua conexão ou tente um arquivo menor.'));
      }, 60000);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
          console.log(`Upload do prêmio: ${progress.toFixed(0)}%`);
        }, 
        (error: any) => {
          clearTimeout(timeout);
          console.error("Erro no upload task:", error);
          
          if (error.code === 'storage/unauthorized') {
            reject(new Error('Sem permissão para salvar no Storage. Verifique as regras de segurança.'));
          } else if (error.code === 'storage/canceled') {
            reject(new Error('Upload cancelado ou tempo limite atingido.'));
          } else {
            reject(new Error('Falha na comunicação com o servidor de imagens. Verifique sua rede.'));
          }
        }, 
        async () => {
          clearTimeout(timeout);
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (err) {
            reject(new Error('Erro ao obter link da imagem após upload.'));
          }
        }
      );
    });
  };

  const adicionarPremio = () => {
    Swal.fire({
      title: 'Nova Recompensa',
      html: `
        <div class="space-y-4 text-left">
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Nome da Recompensa</label>
            <input id="swal-input1" class="swal2-input !m-0 !w-full" placeholder="Ex: iPhone 15 Pro, R$500 de Bônus">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Pontos necessários</label>
            <input id="swal-input2" class="swal2-input !m-0 !w-full" type="number" placeholder="Ex: 5000">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Imagem do Prêmio</label>
            <div class="flex flex-col gap-2">
              <input id="swal-input3" class="swal2-input !m-0 !w-full" placeholder="URL da Foto (opcional)">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-slate-400 uppercase">Ou</span>
                <label for="swal-file" class="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 px-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                  <Upload size={14} /> Anexar Arquivo
                </label>
                <input id="swal-file" type="file" accept="image/*" class="hidden">
              </div>
              <p id="file-name" class="text-[9px] text-blue-600 font-bold truncate"></p>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Ordem de Exibição</label>
            <input id="swal-input4" class="swal2-input !m-0 !w-full" type="number" placeholder="Ex: 1">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Status</label>
            <select id="swal-input5" class="swal2-input !m-0 !w-full">
              <option value="disponivel">Disponível</option>
              <option value="ultimas_unidades">Últimas Unidades</option>
              <option value="esgotado">Esgotado</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Público Alvo</label>
            <select id="swal-input6" class="swal2-input !m-0 !w-full" onchange="document.getElementById('email-wrapper').style.display = this.value === 'ESPECIFICO' ? 'block' : 'none'">
              <option value="CLIENTE">Clientes</option>
              <option value="VENDEDOR">Vendedores</option>
              <option value="GESTOR">Gestores</option>
              <option value="EQUIPE">Toda a Equipe (V+G)</option>
              <option value="TODOS">Todos os Usuários</option>
              <option value="ESPECIFICO">1 Usuário Específico (Por e-mail)</option>
            </select>
          </div>
          <div id="email-wrapper" class="space-y-1" style="display: none; padding-top: 8px;">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Email do Recompensado</label>
            <input id="swal-input7" type="email" class="swal2-input !m-0 !w-full" placeholder="Ex: joao@gsa.com">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Recompensa</label>
            <select id="swal-input8" class="swal2-input !m-0 !w-full">
              <option value="PREMIO">Prêmio / Produto</option>
              <option value="BONUS">Bônus / Saldo</option>
              <option value="DESCONTO">Desconto Específico</option>
            </select>
          </div>
        </div>
      `,
      didOpen: () => {
        const fileInput = document.getElementById('swal-file') as HTMLInputElement;
        const fileNameDisplay = document.getElementById('file-name');
        fileInput?.addEventListener('change', (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file && fileNameDisplay) {
            fileNameDisplay.textContent = `Selecionado: ${file.name}`;
          }
        });
      },
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Adicionar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0a0a2e',
      preConfirm: async () => {
        const nome = (document.getElementById('swal-input1') as HTMLInputElement).value;
        const pontos = (document.getElementById('swal-input2') as HTMLInputElement).value;
        let foto = (document.getElementById('swal-input3') as HTMLInputElement).value;
        const ordem = (document.getElementById('swal-input4') as HTMLInputElement).value;
        const status = (document.getElementById('swal-input5') as HTMLSelectElement).value;
        const publico_alvo = (document.getElementById('swal-input6') as HTMLSelectElement).value;
        const usuario_alvo_email = (document.getElementById('swal-input7') as HTMLInputElement)?.value;
        const tipo = (document.getElementById('swal-input8') as HTMLSelectElement).value;
        const fileInput = document.getElementById('swal-file') as HTMLInputElement;
        const file = fileInput.files?.[0];
        
        if (!nome || !pontos) {
          Swal.showValidationMessage('Nome e pontos são obrigatórios');
          return false;
        }

        if (publico_alvo === 'ESPECIFICO' && !usuario_alvo_email) {
          Swal.showValidationMessage('Informe o e-mail do usuário específico!');
          return false;
        }

        if (!foto && !file) {
          Swal.showValidationMessage('Informe uma URL ou anexe uma imagem');
          return false;
        }

        try {
          if (file) {
            Swal.showLoading();
            foto = await uploadImage(file, (percent) => {
              Swal.update({
                title: 'Enviando Imagem...',
                html: `
                  <div class="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                    <div class="bg-blue-600 h-full transition-all duration-300" style="width: ${percent}%"></div>
                  </div>
                  <p class="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">${percent.toFixed(0)}% CONCLUÍDO</p>
                `
              });
            });
          }
          
          return { 
            nome, 
            pontos: Number(pontos), 
            foto: transformImageUrl(foto), 
            ordem: Number(ordem) || (premios.length + 1),
            status,
            publico_alvo,
            tipo,
            usuario_alvo_email: publico_alvo === 'ESPECIFICO' ? usuario_alvo_email.toLowerCase() : null
          };
        } catch (error: any) {
          console.error("Erro no preConfirm (add):", error);
          Swal.showValidationMessage(error.message || 'Erro ao fazer upload da imagem');
          return false;
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        setPremios([...premios, { id: Date.now(), ...result.value }]);
      }
    });
  };

  const editarPremio = (premio: any) => {
    Swal.fire({
      title: 'Editar Recompensa',
      html: `
        <div class="space-y-4 text-left">
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Nome da Recompensa</label>
            <input id="swal-input1" class="swal2-input !m-0 !w-full" placeholder="Nome da recompensa" value="${premio.nome}">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Pontos necessários</label>
            <input id="swal-input2" class="swal2-input !m-0 !w-full" type="number" placeholder="Pontos necessários" value="${premio.pontos}">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Imagem do Prêmio</label>
            <div class="flex flex-col gap-2">
              <input id="swal-input3" class="swal2-input !m-0 !w-full" placeholder="URL da Foto" value="${premio.foto}">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-slate-400 uppercase">Ou</span>
                <label for="swal-file" class="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 px-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                  <Upload size={14} /> Alterar Arquivo
                </label>
                <input id="swal-file" type="file" accept="image/*" class="hidden">
              </div>
              <p id="file-name" class="text-[9px] text-blue-600 font-bold truncate"></p>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Ordem</label>
            <input id="swal-input4" class="swal2-input !m-0 !w-full" type="number" placeholder="Ordem" value="${premio.ordem || 0}">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Status</label>
            <select id="swal-input5" class="swal2-input !m-0 !w-full">
              <option value="disponivel" ${premio.status === 'disponivel' ? 'selected' : ''}>Disponível</option>
              <option value="ultimas_unidades" ${premio.status === 'ultimas_unidades' ? 'selected' : ''}>Últimas Unidades</option>
              <option value="esgotado" ${premio.status === 'esgotado' ? 'selected' : ''}>Esgotado</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Público Alvo</label>
            <select id="swal-input6" class="swal2-input !m-0 !w-full" onchange="document.getElementById('email-wrapper-edit').style.display = this.value === 'ESPECIFICO' ? 'block' : 'none'">
              <option value="CLIENTE" ${premio.publico_alvo === 'CLIENTE' ? 'selected' : ''}>Clientes</option>
              <option value="VENDEDOR" ${premio.publico_alvo === 'VENDEDOR' ? 'selected' : ''}>Vendedores</option>
              <option value="GESTOR" ${premio.publico_alvo === 'GESTOR' ? 'selected' : ''}>Gestores</option>
              <option value="EQUIPE" ${premio.publico_alvo === 'EQUIPE' ? 'selected' : ''}>Toda a Equipe (V+G)</option>
              <option value="TODOS" ${premio.publico_alvo === 'TODOS' ? 'selected' : ''}>Todos os Usuários</option>
              <option value="ESPECIFICO" ${premio.publico_alvo === 'ESPECIFICO' ? 'selected' : ''}>1 Usuário Específico (Por e-mail)</option>
            </select>
          </div>
          <div id="email-wrapper-edit" class="space-y-1" style="display: ${premio.publico_alvo === 'ESPECIFICO' ? 'block' : 'none'}; padding-top: 8px;">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Email do Recompensado</label>
            <input id="swal-input7" type="email" class="swal2-input !m-0 !w-full" placeholder="Ex: joao@gsa.com" value="${premio.usuario_alvo_email || ''}">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Recompensa</label>
            <select id="swal-input8" class="swal2-input !m-0 !w-full">
              <option value="PREMIO" ${premio.tipo === 'PREMIO' ? 'selected' : ''}>Prêmio / Produto</option>
              <option value="BONUS" ${premio.tipo === 'BONUS' ? 'selected' : ''}>Bônus / Saldo</option>
              <option value="DESCONTO" ${premio.tipo === 'DESCONTO' ? 'selected' : ''}>Desconto Específico</option>
            </select>
          </div>
        </div>
      `,
      didOpen: () => {
        const fileInput = document.getElementById('swal-file') as HTMLInputElement;
        const fileNameDisplay = document.getElementById('file-name');
        fileInput?.addEventListener('change', (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file && fileNameDisplay) {
            fileNameDisplay.textContent = `Selecionado: ${file.name}`;
          }
        });
      },
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Salvar Alterações',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0a0a2e',
      preConfirm: async () => {
        const nome = (document.getElementById('swal-input1') as HTMLInputElement).value;
        const pontos = (document.getElementById('swal-input2') as HTMLInputElement).value;
        let foto = (document.getElementById('swal-input3') as HTMLInputElement).value;
        const ordem = (document.getElementById('swal-input4') as HTMLInputElement).value;
        const status = (document.getElementById('swal-input5') as HTMLSelectElement).value;
        const publico_alvo = (document.getElementById('swal-input6') as HTMLSelectElement).value;
        const usuario_alvo_email = (document.getElementById('swal-input7') as HTMLInputElement)?.value;
        const tipo = (document.getElementById('swal-input8') as HTMLSelectElement).value;
        const fileInput = document.getElementById('swal-file') as HTMLInputElement;
        const file = fileInput.files?.[0];
        
        if (!nome || !pontos || (!foto && !file)) {
          Swal.showValidationMessage('Preencha os campos obrigatórios');
          return false;
        }

        if (publico_alvo === 'ESPECIFICO' && !usuario_alvo_email) {
          Swal.showValidationMessage('Informe o e-mail do usuário específico!');
          return false;
        }

        try {
          if (file) {
            Swal.showLoading();
            foto = await uploadImage(file, (percent) => {
              Swal.update({
                title: 'Enviando Imagem...',
                html: `
                  <div class="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                    <div class="bg-blue-600 h-full transition-all duration-300" style="width: ${percent}%"></div>
                  </div>
                  <p class="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">${percent.toFixed(0)}% CONCLUÍDO</p>
                `
              });
            });
          }
          
          return { 
            nome, 
            pontos: Number(pontos), 
            foto: transformImageUrl(foto), 
            ordem: Number(ordem),
            status,
            publico_alvo,
            tipo,
            usuario_alvo_email: publico_alvo === 'ESPECIFICO' ? usuario_alvo_email.toLowerCase() : null
          };
        } catch (error: any) {
          console.error("Erro no preConfirm (edit):", error);
          Swal.showValidationMessage(error.message || 'Erro ao fazer upload da imagem');
          return false;
        }
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
                value={rules.cadastro || 0} 
                onChange={e => setRules({...rules, cadastro: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Cliente Indicado</label>
              <input 
                type="number" 
                value={rules.indicacao || 0} 
                onChange={e => setRules({...rules, indicacao: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Pagamento em Dia</label>
              <input 
                type="number" 
                value={rules.pagamento_dia || 0} 
                onChange={e => setRules({...rules, pagamento_dia: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Pagamento Antecipado</label>
              <input 
                type="number" 
                value={rules.pagamento_antecipado || 0} 
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
                value={rules.venda_vendedor || 0} 
                onChange={e => setRules({...rules, venda_vendedor: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Venda (P/ Gestor)</label>
              <input 
                type="number" 
                value={rules.venda_gestor || 0} 
                onChange={e => setRules({...rules, venda_gestor: Number(e.target.value)})} 
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 outline-none text-sm" 
              />
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Vitrine de Objetivos */}
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="font-bold text-slate-700 uppercase text-sm sm:text-base">Catálogo de Recompensas</h3>
            <button 
              onClick={adicionarPremio} 
              className="w-full sm:w-auto text-[10px] font-black uppercase bg-blue-900 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-blue-800 transition-colors"
            >
              <Plus size={14} /> Nova Recompensa
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
                    <img src={transformImageUrl(p.foto)} className="w-full h-full object-cover" alt={p.nome} referrerPolicy="no-referrer" />
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
                  <span className="text-[8px] font-black text-blue-600 uppercase mt-1">{p.tipo || 'PREMIO'}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Público: {p.publico_alvo || 'CLIENTE'}</span>
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
