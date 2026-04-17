import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Package, 
  Settings, 
  Save, 
  Trash2, 
  Edit3, 
  Eye, 
  PlayCircle, 
  Clock, 
  DollarSign, 
  TrendingUp,
  Youtube,
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardCheck,
  PlusCircle,
  MinusCircle
} from 'lucide-react';
import { 
  ServiceData, 
  listarTodosServicos, 
  criarServico, 
  atualizarServico 
} from '../../services/serviceFactory';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { useRequirements } from '../../hooks/useRequirements';
import { saveRequirementsConfig } from '../../services/requirementsService';

export const ServiceFactoryView: React.FC = () => {
  const { config: requirementsConfig, loading: loadingRequirements } = useRequirements();
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isManagingRequirements, setIsManagingRequirements] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<ServiceData>>({
    nome_servico: '',
    video_youtube_id: '',
    preco_base_gestor: 0,
    preco_base_vendedor: 0,
    prazo_sla_dias: 15,
    ciclo_status: 'LIBERADO',
    ativo: true,
    possui_garantia: false,
    is_mass_sale_active: false,
    preco_massa_gestor: 0,
    preco_massa_vendedor: 0,
    pontos_cliente: 10,
    pontos_vendedor: 50,
    pontos_gestor: 20,
    requisitos_documentos: [],
    requisitos_campos: []
  });

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('nome_servico', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceData)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getYoutubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
  };

  const handleYoutubeInput = (url: string) => {
    const id = getYoutubeID(url);
    setFormData(prev => ({ ...prev, video_youtube_id: id, video_youtube_url: `https://www.youtube.com/watch?v=${id}` }));
  };

  const handleAddRequirement = async (type: 'field' | 'doc') => {
    const { value: formValues } = await Swal.fire({
      title: `Novo ${type === 'field' ? 'Campo' : 'Documento'}`,
      html:
        `<input id="swal-input1" class="swal2-input" placeholder="ID (ex: cpf_cnpj)">` +
        `<input id="swal-input2" class="swal2-input" placeholder="Rótulo (ex: CPF ou CNPJ)">`,
      focusConfirm: false,
      preConfirm: () => {
        return [
          (document.getElementById('swal-input1') as HTMLInputElement).value,
          (document.getElementById('swal-input2') as HTMLInputElement).value
        ]
      }
    });

    if (formValues && formValues[0] && formValues[1]) {
      const [id, label] = formValues;
      const newConfig = { ...requirementsConfig };
      if (type === 'field') {
        newConfig.field_labels = { ...newConfig.field_labels, [id]: label };
      } else {
        newConfig.document_labels = { ...newConfig.document_labels, [id]: label };
      }
      await saveRequirementsConfig(newConfig);
      Swal.fire('Sucesso', 'Item adicionado com sucesso!', 'success');
    }
  };

  const handleRemoveRequirement = async (type: 'field' | 'doc', id: string) => {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: "Isso removerá o item da lista de opções globais.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, remover!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const newConfig = { ...requirementsConfig };
      if (type === 'field') {
        const { [id]: _, ...rest } = newConfig.field_labels;
        newConfig.field_labels = rest;
      } else {
        const { [id]: _, ...rest } = newConfig.document_labels;
        newConfig.document_labels = rest;
      }
      await saveRequirementsConfig(newConfig);
      Swal.fire('Removido!', 'O item foi removido com sucesso.', 'success');
    }
  };

  const handleSave = async () => {
    if (!formData.nome_servico || !formData.video_youtube_id || formData.preco_base_gestor === undefined) {
      return Swal.fire('Erro', 'Preencha os campos obrigatórios e valide o vídeo.', 'error');
    }

    try {
      const slug = (formData.nome_servico || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      const dataToSave = {
        ...formData,
        slug,
        ativo: true,
      } as ServiceData;

      if (editingId) {
        await atualizarServico(editingId, dataToSave);
        Swal.fire('Sucesso', 'Serviço atualizado com sucesso!', 'success');
      } else {
        await criarServico(dataToSave);
        Swal.fire({
          title: 'Serviço Criado!',
          text: 'As regras de markup e a vitrine foram atualizadas.',
          icon: 'success',
          confirmButtonColor: '#0a0a2e'
        });
      }

      // Reset Form
      setFormData({
        nome_servico: '',
        video_youtube_id: '',
        preco_base_gestor: 0,
        preco_base_vendedor: 0,
        prazo_sla_dias: 15,
        ciclo_status: 'LIBERADO',
        ativo: true,
        possui_garantia: false,
        is_mass_sale_active: false,
        preco_massa_gestor: 0,
        preco_massa_vendedor: 0,
        pontos_cliente: 10,
        pontos_vendedor: 50,
        pontos_gestor: 20,
        requisitos_documentos: [],
        requisitos_campos: []
      });
      setEditingId(null);
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  };

  const handleEdit = (service: ServiceData) => {
    setFormData(service);
    setEditingId(service.id || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: "Esta ação não pode ser desfeita!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'services', id));
        Swal.fire('Excluído!', 'O serviço foi removido do catálogo.', 'success');
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER ESTRATÉGICO */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a0a2e] p-8 rounded-[2.5rem] text-white shadow-2xl"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-500 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest text-white">Módulo de Engenharia</span>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-tighter">Versão 3.0 SQL Ready</span>
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tight">Fábrica de Serviços</h1>
          <p className="text-blue-300 text-sm">Configure custos base, prazos de SLA e a vitrine comercial.</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right px-6 border-r border-white/10">
            <p className="text-[10px] font-black uppercase text-slate-400">Total em Catálogo</p>
            <p className="text-2xl font-black text-white">{services.length.toString().padStart(2, '0')}</p>
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({
                nome_servico: '',
                video_youtube_id: '',
                preco_base_gestor: 0,
                preco_base_vendedor: 0,
                prazo_sla_dias: 15,
                ciclo_status: 'LIBERADO',
                ativo: true,
                possui_garantia: false,
                pontos_cliente: 10,
                pontos_vendedor: 50,
                pontos_gestor: 20,
                requisitos_documentos: [],
                requisitos_campos: []
              });
            }}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
            <Plus size={16} /> Novo Serviço
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* FORMULÁRIO DE CONFIGURAÇÃO (Lado Esquerdo) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm sticky top-8">
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase italic mb-6 flex items-center gap-2">
              <Settings className="text-blue-600" size={20} /> {editingId ? 'Editar Serviço' : 'Configuração'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Nome Comercial</label>
                <input 
                  type="text" 
                  value={formData.nome_servico}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome_servico: e.target.value }))}
                  placeholder="Ex: Limpa Nome Premium" 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-600 transition-all outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Link do Vídeo (YouTube)</label>
                <input 
                  type="text" 
                  value={formData.video_youtube_url || formData.video_youtube_id}
                  onChange={(e) => handleYoutubeInput(e.target.value)}
                  placeholder="URL do YouTube" 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-600 transition-all outline-none dark:text-white"
                />
                {formData.video_youtube_id && (
                  <div className="mt-2 rounded-xl overflow-hidden aspect-video bg-slate-100 dark:bg-slate-800 relative">
                    <img 
                      src={`https://img.youtube.com/vi/${formData.video_youtube_id}/maxresdefault.jpg`} 
                      className="w-full h-full object-cover"
                      alt="Preview"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <PlayCircle className="text-white" size={40} />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Base Gestor (R$)</label>
                  <input 
                    type="number" 
                    value={formData.preco_base_gestor}
                    onChange={(e) => setFormData(prev => ({ ...prev, preco_base_gestor: parseFloat(e.target.value) }))}
                    placeholder="500,00" 
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Base Vendedor (R$)</label>
                  <input 
                    type="number" 
                    value={formData.preco_base_vendedor}
                    onChange={(e) => setFormData(prev => ({ ...prev, preco_base_vendedor: parseFloat(e.target.value) }))}
                    placeholder="750,00" 
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-600 outline-none font-bold text-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">SLA (Dias)</label>
                  <input 
                    type="number" 
                    value={formData.prazo_sla_dias}
                    onChange={(e) => setFormData(prev => ({ ...prev, prazo_sla_dias: parseInt(e.target.value) }))}
                    placeholder="15" 
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-600 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Ciclo</label>
                  <select 
                    value={formData.ciclo_status}
                    onChange={(e) => setFormData(prev => ({ ...prev, ciclo_status: e.target.value as 'LIBERADO' | 'ENCERRADO' }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-600 outline-none font-bold dark:text-white"
                  >
                    <option value="LIBERADO">LIBERADO</option>
                    <option value="ENCERRADO">ENCERRADO</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Package size={12} /> Configuração Venda em Massa
                  </p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formData.is_mass_sale_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_mass_sale_active: e.target.checked }))}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {formData.is_mass_sale_active && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Massa Gestor (R$)</label>
                      <input 
                        type="number" 
                        value={formData.preco_massa_gestor}
                        onChange={(e) => setFormData(prev => ({ ...prev, preco_massa_gestor: parseFloat(e.target.value) }))}
                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs focus:ring-1 focus:ring-emerald-600 outline-none font-bold text-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Massa Vendedor (R$)</label>
                      <input 
                        type="number" 
                        value={formData.preco_massa_vendedor}
                        onChange={(e) => setFormData(prev => ({ ...prev, preco_massa_vendedor: parseFloat(e.target.value) }))}
                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs focus:ring-1 focus:ring-blue-600 outline-none font-bold text-blue-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Descrição (Vitrine)</label>
                <textarea 
                  value={formData.mensagem_publica}
                  onChange={(e) => setFormData(prev => ({ ...prev, mensagem_publica: e.target.value }))}
                  placeholder="Descreva o que o cliente ganha com este serviço..." 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-600 outline-none dark:text-white min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Instruções Internas (ADM)</label>
                <textarea 
                  value={formData.mensagem_interna}
                  onChange={(e) => setFormData(prev => ({ ...prev, mensagem_interna: e.target.value }))}
                  placeholder="Instruções para o analista ou gerente..." 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-600 outline-none dark:text-white min-h-[80px]"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[2rem] space-y-4 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} /> Engenharia de Requisitos: Documentos
                  </p>
                  <button 
                    onClick={() => handleAddRequirement('doc')}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-colors text-blue-600"
                    title="Adicionar Novo Documento"
                  >
                    <PlusCircle size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-inner border border-blue-50 dark:border-blue-900/20">
                  {Object.entries(requirementsConfig.document_labels).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between group p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={formData.requisitos_documentos?.includes(key)}
                            onChange={(e) => {
                              const current = formData.requisitos_documentos || [];
                              if (e.target.checked) {
                                setFormData(prev => ({ ...prev, requisitos_documentos: [...current, key] }));
                              } else {
                                setFormData(prev => ({ ...prev, requisitos_documentos: current.filter(k => k !== key) }));
                              }
                            }}
                            className="size-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                          {label}
                        </span>
                      </label>
                      <button 
                        onClick={() => handleRemoveRequirement('doc', key)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all"
                        title="Excluir item da lista global"
                      >
                        <MinusCircle size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2rem] space-y-4 border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardCheck size={14} /> Engenharia de Requisitos: Dados
                  </p>
                  <button 
                    onClick={() => handleAddRequirement('field')}
                    className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-full transition-colors text-emerald-600"
                    title="Adicionar Novo Campo"
                  >
                    <PlusCircle size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-inner border border-emerald-50 dark:border-emerald-900/20">
                  {Object.entries(requirementsConfig.field_labels).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between group p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={formData.requisitos_campos?.includes(key)}
                            onChange={(e) => {
                              const current = formData.requisitos_campos || [];
                              if (e.target.checked) {
                                setFormData(prev => ({ ...prev, requisitos_campos: [...current, key] }));
                              } else {
                                setFormData(prev => ({ ...prev, requisitos_campos: current.filter(k => k !== key) }));
                              }
                            }}
                            className="size-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">
                          {label}
                        </span>
                      </label>
                      <button 
                        onClick={() => handleRemoveRequirement('field', key)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all"
                        title="Excluir item da lista global"
                      >
                        <MinusCircle size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={12} /> Configuração de Pontos (GSA Club)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Cliente</label>
                    <input 
                      type="number" 
                      value={formData.pontos_cliente}
                      onChange={(e) => setFormData(prev => ({ ...prev, pontos_cliente: parseInt(e.target.value) }))}
                      className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs focus:ring-1 focus:ring-blue-600 outline-none dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Vendedor</label>
                    <input 
                      type="number" 
                      value={formData.pontos_vendedor}
                      onChange={(e) => setFormData(prev => ({ ...prev, pontos_vendedor: parseInt(e.target.value) }))}
                      className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs focus:ring-1 focus:ring-blue-600 outline-none dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Gestor</label>
                    <input 
                      type="number" 
                      value={formData.pontos_gestor}
                      onChange={(e) => setFormData(prev => ({ ...prev, pontos_gestor: parseInt(e.target.value) }))}
                      className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs focus:ring-1 focus:ring-blue-600 outline-none dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-[#0a0a2e] text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-blue-900 transition-all flex justify-center items-center gap-2"
              >
                <Save size={16} /> {editingId ? 'Atualizar no SQL' : 'Gravar no SQL'}
              </button>
              
              {editingId && (
                <button 
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      nome_servico: '',
                      video_youtube_id: '',
                      preco_base_gestor: 0,
                      preco_base_vendedor: 0,
                      prazo_sla_dias: 15,
                      ciclo_status: 'LIBERADO',
                      ativo: true,
                      possui_garantia: false,
                      pontos_cliente: 10,
                      pontos_vendedor: 50,
                      pontos_gestor: 20
                    });
                  }}
                  className="w-full bg-slate-100 text-slate-600 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar Edição
                </button>
              )}
            </div>
          </div>
        </div>

        {/* LISTAGEM E VITRINE PREVIEW (Lado Direito) */}
        <div className="lg:col-span-8 space-y-6">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Eye size={16} /> Preview da Vitrine do Cliente
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {services.map((s) => (
                <motion.div 
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all flex flex-col group"
                >
                  <div className="relative aspect-video">
                    <img 
                      src={`https://img.youtube.com/vi/${s.video_youtube_id}/maxresdefault.jpg`} 
                      className="w-full h-full object-cover"
                      alt={s.nome_servico}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full shadow-sm">
                      <p className={`text-[9px] font-black uppercase tracking-widest ${s.ciclo_status === 'LIBERADO' ? 'text-blue-600' : 'text-rose-600'}`}>
                        {s.ciclo_status}
                      </p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayCircle className="text-white" size={48} />
                    </div>
                  </div>
                  <div className="p-8 space-y-4">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase italic leading-tight">{s.nome_servico}</h4>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase italic">
                        <Clock size={12} /> {s.prazo_sla_dias}D
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 dark:border-slate-800">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Gestor</p>
                        <p className="text-sm font-black text-emerald-600 italic">R$ {s.preco_base_gestor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Piso Vendedor</p>
                        <p className="text-sm font-black text-blue-600 italic">R$ {s.preco_base_vendedor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>

                    {s.is_mass_sale_active && (
                      <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-50 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10 px-4 -mx-4">
                        <div>
                          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Massa Gestor</p>
                          <p className="text-xs font-black text-blue-600 italic">R$ {s.preco_massa_gestor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Massa Vendedor</p>
                          <p className="text-xs font-black text-blue-600 italic">R$ {s.preco_massa_vendedor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEdit(s)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id!)}
                        className="bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-500 px-4 rounded-xl transition-all flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
