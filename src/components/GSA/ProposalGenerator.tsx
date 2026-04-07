import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  FileText, 
  User, 
  Phone, 
  Package, 
  CreditCard, 
  Banknote, 
  Save, 
  X, 
  Link as LinkIcon, 
  Copy, 
  CheckCircle,
  Loader2,
  ArrowRight,
  Zap,
  DollarSign,
  Calendar,
  Globe,
  UserCheck,
  Layout
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { createProposal } from '../../services/proposalService';
import { ServiceData } from '../../services/serviceFactory';
import { ShowcaseService } from '../../services/marketingService';
import { getPublicOrigin } from '../../lib/urlUtils';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';

interface ProposalGeneratorProps {
  onClose: () => void;
  initialData?: {
    lead_nome?: string;
    lead_telefone?: string;
  };
}

export const ProposalGenerator: React.FC<ProposalGeneratorProps> = ({ onClose, initialData }) => {
  const { user, profile } = useAuth();
  const [services, setServices] = useState<ServiceData[]>([]);
  const [showcaseServices, setShowcaseServices] = useState<ShowcaseService[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [selectedShowcaseId, setSelectedShowcaseId] = useState<string>('');

  const CLUBE_PONTOS_INFO = "O Clube de Pontos GSA recompensa sua fidelidade! Acumule pontos e troque por vale-compras, brindes exclusivos e descontos reais em novos serviços e parcelas. Ganhe recompensas extras por pagamento em dia, bônus por pagamento antecipado e benefícios por cada indicação bem-sucedida. Sua parceria vale muito na GSA!";

  const [formData, setFormData] = useState({
    lead_nome: initialData?.lead_nome || '',
    lead_telefone: initialData?.lead_telefone || '',
    servico_id: '',
    servico_nome: '',
    valor_sugerido: 0,
    valor_venda: 0,
    opcao_vista: {
      valor: 0,
      condicoes: '5% de desconto no PIX',
      forma_pagamento: 'PIX'
    },
    opcao_parcelado: {
      valor: 0,
      condicoes: 'Entrada + Parcelas no Boleto',
      forma_pagamento: 'Boleto Bancário',
      valor_entrada: 0,
      num_parcelas: 10,
      valor_parcela: 0
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Factory Services
        const qServices = query(collection(db, 'services'), where('ativo', '==', true));
        const snapServices = await getDocs(qServices);
        setServices(snapServices.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceData)));

        // Fetch Showcase Services
        const qShowcase = query(collection(db, 'showcase_services'), where('ativo', '==', true));
        const snapShowcase = await getDocs(qShowcase);
        setShowcaseServices(snapShowcase.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShowcaseService)));
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleShowcaseChange = (showcaseId: string) => {
    setSelectedShowcaseId(showcaseId);
    const showcase = showcaseServices.find(s => s.id === showcaseId);
    if (showcase && showcase.modelo_id) {
      // Auto-select the factory service linked to this showcase product
      handleServiceChange(showcase.modelo_id);
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      const valorSugerido = service.preco_base_vendedor;
      setFormData(prev => ({
        ...prev,
        servico_id: service.id,
        servico_nome: service.nome_servico,
        valor_sugerido: valorSugerido,
        valor_venda: valorSugerido,
        opcao_vista: { 
          ...prev.opcao_vista, 
          valor: valorSugerido * 0.95 
        },
        opcao_parcelado: { 
          ...prev.opcao_parcelado, 
          valor: valorSugerido,
          valor_entrada: valorSugerido * 0.1,
          valor_parcela: (valorSugerido * 0.9) / 10
        }
      }));
    }
  };

  const handleValorVendaChange = (novoValor: number) => {
    setFormData(prev => {
      const diff = novoValor - prev.valor_sugerido;
      // Se o valor for menor que o sugerido, não aplicamos desconto automático aqui, mas permitimos
      return {
        ...prev,
        valor_venda: novoValor,
        opcao_vista: {
          ...prev.opcao_vista,
          valor: novoValor * 0.95
        },
        opcao_parcelado: {
          ...prev.opcao_parcelado,
          valor: novoValor,
          valor_parcela: (novoValor - prev.opcao_parcelado.valor_entrada) / prev.opcao_parcelado.num_parcelas
        }
      };
    });
  };

  const handleParcelasChange = (num: number) => {
    setFormData(prev => ({
      ...prev,
      opcao_parcelado: {
        ...prev.opcao_parcelado,
        num_parcelas: num,
        valor_parcela: (prev.valor_venda - prev.opcao_parcelado.valor_entrada) / num
      }
    }));
  };

  const handleEntradaChange = (entrada: number) => {
    setFormData(prev => ({
      ...prev,
      opcao_parcelado: {
        ...prev.opcao_parcelado,
        valor_entrada: entrada,
        valor_parcela: (prev.valor_venda - entrada) / prev.opcao_parcelado.num_parcelas
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPublic && !formData.lead_nome) {
      Swal.fire('Erro', 'Preencha o nome do lead.', 'error');
      return;
    }
    if (!formData.servico_id) {
      Swal.fire('Erro', 'Selecione um serviço.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const extra = Math.max(0, formData.valor_venda - formData.valor_sugerido);
      const percentualEmpresa = profile?.percentual_empresa || 0;
      const valorEmpresa = (extra * percentualEmpresa) / 100;

      const { slug } = await createProposal({
        lead_nome: isPublic ? 'Interessado' : formData.lead_nome,
        lead_telefone: isPublic ? '' : formData.lead_telefone,
        servico_id: formData.servico_id,
        servico_nome: formData.servico_nome,
        valor_sugerido: formData.valor_sugerido,
        valor_venda: formData.valor_venda,
        percentual_empresa: percentualEmpresa,
        valor_empresa: valorEmpresa,
        opcao_vista: formData.opcao_vista,
        opcao_parcelado: formData.opcao_parcelado,
        vendedor_id: profile?.uid || '',
        vendedor_nome: profile?.nome_completo || '',
        vendedor_foto: user?.photoURL || null,
        clube_pontos_info: CLUBE_PONTOS_INFO,
        showcase_service_id: selectedShowcaseId || undefined,
        is_public: isPublic
      });

      const fullUrl = `${getPublicOrigin()}/vendas/p/${slug}`;
      setGeneratedLink(fullUrl);
      
      Swal.fire({
        icon: 'success',
        title: 'Proposta Gerada!',
        text: 'O link da proposta personalizada já está disponível.',
        confirmButtonColor: '#0a0a2e'
      });
    } catch (error) {
      console.error("Erro ao gerar proposta:", error);
      Swal.fire('Erro', 'Não foi possível gerar a proposta.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      Swal.fire({
        icon: 'success',
        title: 'Copiado!',
        text: 'Link copiado para a área de transferência.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0a2e]/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-[#0a0a2e] p-8 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Gerador de Proposta</h2>
              <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest">Landing Page de Vendas Personalizada</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          {!generatedLink ? (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Tipo de Link */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Globe size={14} /> Tipo de Proposta
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${!isPublic ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400'}`}
                  >
                    <UserCheck size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Nominal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${isPublic ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400'}`}
                  >
                    <Globe size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Pública</span>
                  </button>
                </div>
              </div>

              {/* Identificação (Só se não for público) */}
              {!isPublic && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={14} /> Identificação do Lead
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Nome do Lead</label>
                      <input 
                        type="text" 
                        required={!isPublic}
                        value={formData.lead_nome}
                        onChange={e => setFormData({...formData, lead_nome: e.target.value})}
                        placeholder="Ex: João da Silva"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-medium text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Telefone (Opcional)</label>
                      <input 
                        type="tel" 
                        value={formData.lead_telefone}
                        onChange={e => setFormData({...formData, lead_telefone: e.target.value})}
                        placeholder="(00) 00000-0000"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-medium text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Vitrine (Opcional) */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Layout size={14} /> Vincular Produto da Vitrine
                </h3>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Produto da Vitrine (Opcional)</label>
                  <select 
                    value={selectedShowcaseId}
                    onChange={e => handleShowcaseChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  >
                    <option value="">Nenhum produto vinculado</option>
                    {showcaseServices.map(s => (
                      <option key={s.id} value={s.id}>{s.titulo}</option>
                    ))}
                  </select>
                  <p className="text-[8px] font-medium text-slate-400 ml-2">Vincular a um produto da vitrine permite que o cliente veja fotos e vídeos do serviço.</p>
                </div>
              </div>

              {/* Serviço */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Package size={14} /> Seleção do Serviço e Valores
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Serviço da Fábrica</label>
                    <div className="relative">
                      <select 
                        required
                        disabled={!!selectedShowcaseId}
                        value={formData.servico_id}
                        onChange={e => handleServiceChange(e.target.value)}
                        className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${selectedShowcaseId ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Selecione um serviço...</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>{s.nome_servico}</option>
                        ))}
                      </select>
                      {selectedShowcaseId && (
                        <div className="absolute right-12 top-1/2 -translate-y-1/2">
                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                            <CheckCircle size={10} /> Vinculado
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Valor de Venda (R$)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-600">R$</span>
                      <input 
                        type="number" 
                        required
                        value={formData.valor_venda}
                        onChange={e => handleValorVendaChange(Number(e.target.value))}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 pl-10 text-sm font-black text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      />
                    </div>
                    {formData.valor_sugerido > 0 && (
                      <div className="flex justify-between px-2">
                        <span className="text-[9px] font-bold text-slate-400">Sugerido: R$ {formData.valor_sugerido.toLocaleString('pt-BR')}</span>
                        {formData.valor_venda > formData.valor_sugerido && (
                          <span className="text-[9px] font-bold text-emerald-500">Excedente: R$ {(formData.valor_venda - formData.valor_sugerido).toLocaleString('pt-BR')}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opções de Preço */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Opção 1: À Vista */}
                <div className="space-y-4 p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-800/30">
                  <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                    <Zap size={14} /> Opção 1: À Vista
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Valor (R$)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600">R$</span>
                          <input 
                            type="number" 
                            value={formData.opcao_vista.valor}
                            onChange={e => setFormData({...formData, opcao_vista: {...formData.opcao_vista, valor: Number(e.target.value)}})}
                            className="w-full bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3 pl-10 text-sm font-black text-emerald-700 dark:text-emerald-400 outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Forma de Pagto</label>
                        <input 
                          type="text" 
                          value={formData.opcao_vista.forma_pagamento}
                          onChange={e => setFormData({...formData, opcao_vista: {...formData.opcao_vista, forma_pagamento: e.target.value}})}
                          className="w-full bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                          placeholder="Ex: PIX, Dinheiro"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Detalhes e Condições</label>
                      <textarea 
                        value={formData.opcao_vista.condicoes}
                        onChange={e => setFormData({...formData, opcao_vista: {...formData.opcao_vista, condicoes: e.target.value}})}
                        className="w-full bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-800 rounded-xl p-3 text-xs font-medium text-slate-900 dark:text-slate-200 outline-none min-h-[80px] resize-none"
                        placeholder="Ex: 5% de desconto no PIX&#10;Ativação imediata"
                      />
                    </div>
                  </div>
                </div>

                {/* Opção 2: Parcelado */}
                <div className="space-y-4 p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/30">
                  <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={14} /> Opção 2: Parcelado
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Entrada (R$)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-600">R$</span>
                          <input 
                            type="number" 
                            value={formData.opcao_parcelado.valor_entrada}
                            onChange={e => handleEntradaChange(Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-800 rounded-xl p-3 pl-10 text-sm font-black text-blue-700 dark:text-blue-400 outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Parcelas</label>
                        <input 
                          type="number" 
                          value={formData.opcao_parcelado.num_parcelas}
                          onChange={e => handleParcelasChange(Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-800 rounded-xl p-3 text-sm font-black text-blue-700 dark:text-blue-400 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Valor Parcela</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-600">R$</span>
                          <input 
                            type="number" 
                            readOnly
                            value={formData.opcao_parcelado.valor_parcela.toFixed(2)}
                            className="w-full bg-slate-100 dark:bg-slate-800 border border-blue-100 dark:border-blue-800 rounded-xl p-3 pl-10 text-sm font-black text-blue-700 dark:text-blue-400 outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Forma de Pagto</label>
                        <input 
                          type="text" 
                          value={formData.opcao_parcelado.forma_pagamento}
                          onChange={e => setFormData({...formData, opcao_parcelado: {...formData.opcao_parcelado, forma_pagamento: e.target.value}})}
                          className="w-full bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-800 rounded-xl p-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                          placeholder="Ex: Boleto, Cartão"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Detalhes e Condições</label>
                      <textarea 
                        value={formData.opcao_parcelado.condicoes}
                        onChange={e => setFormData({...formData, opcao_parcelado: {...formData.opcao_parcelado, condicoes: e.target.value}})}
                        className="w-full bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-800 rounded-xl p-3 text-xs font-medium text-slate-900 dark:text-slate-200 outline-none min-h-[60px] resize-none"
                        placeholder="Ex: Entrada + 10x no boleto"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0a0a2e] text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-blue-900/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                Gerar Proposta Inteligente
              </button>
            </form>
          ) : (
            <div className="py-12 flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in-95">
              <div className="size-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle size={48} />
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Proposta Criada!</h3>
                <p className="text-slate-500 text-sm mt-2">O link da Landing Page personalizada para {formData.lead_nome} está pronto.</p>
              </div>

              <div className="w-full max-w-lg bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link da Proposta</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-blue-600 break-all">
                    {generatedLink}
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className="bg-[#0a0a2e] text-white p-4 rounded-xl hover:bg-blue-900 transition-all shadow-lg"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setGeneratedLink(null)}
                  className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Gerar Outra
                </button>
                <button 
                  onClick={onClose}
                  className="px-8 py-4 bg-[#0a0a2e] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-900 transition-all shadow-xl"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
