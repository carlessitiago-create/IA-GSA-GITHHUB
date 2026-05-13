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
import { ProposalsTable } from './ProposalsTable';

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
  const [activeTab, setActiveTab] = useState<'gerar' | 'lista'>('gerar');
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
        const qServices = query(collection(db, 'services'), where('ativo', '==', true));
        const snapServices = await getDocs(qServices);
        setServices(snapServices.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceData)));

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

  const handleValorParceladoChange = (novoValor: number) => {
    setFormData(prev => {
      return {
        ...prev,
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
        className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900"
      >
        <div className="bg-[#0a0a2e] p-6 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="size-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter">Gerador de Proposta</h2>
              <div className="flex gap-4 mt-1">
                <button 
                    onClick={() => setActiveTab('gerar')} 
                    className={`text-[10px] uppercase font-bold py-1 px-3 rounded-full transition-all ${activeTab === 'gerar' ? 'bg-blue-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'}`}
                >
                    Gerar Nova
                </button>
                <button 
                    onClick={() => setActiveTab('lista')} 
                    className={`text-[10px] uppercase font-bold py-1 px-3 rounded-full transition-all ${activeTab === 'lista' ? 'bg-blue-600 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'}`}
                >
                    Listar Propostas
                </button>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/20 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          {activeTab === 'gerar' ? (
            !generatedLink ? (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsPublic(false)} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 ${!isPublic ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                    <User size={24} className={!isPublic ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="font-bold text-sm text-slate-900">Nominal</span>
                  </button>
                  <button type="button" onClick={() => setIsPublic(true)} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 ${isPublic ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                    <Globe size={24} className={isPublic ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="font-bold text-sm text-slate-900">Pública</span>
                  </button>
                </div>

                {!isPublic && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold uppercase text-slate-500">Nome do Lead</label>
                       <input type="text" value={formData.lead_nome} onChange={e => setFormData({...formData, lead_nome: e.target.value})} className="w-full p-4 rounded-2xl border border-slate-200 text-slate-900" placeholder="Ex: João Silva" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold uppercase text-slate-500">WhatsApp</label>
                       <input type="text" value={formData.lead_telefone} onChange={e => setFormData({...formData, lead_telefone: e.target.value})} className="w-full p-4 rounded-2xl border border-slate-200 text-slate-900" placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Serviço</label>
                    <select value={formData.servico_id} onChange={e => handleServiceChange(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 text-slate-900">
                        <option value="">Selecione um serviço...</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.nome_servico}</option>)}
                    </select>
                </div>

                {/* Valores Base */}
                <div className="grid md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Valor Sugerido na Tabela</label>
                        <input type="number" readOnly value={formData.valor_sugerido} className="w-full p-4 rounded-xl border-2 border-slate-200 bg-slate-200/40 text-slate-600 font-black font-mono cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Valor Final de Venda</label>
                        <input type="number" value={formData.valor_venda} onChange={e => handleValorVendaChange(Number(e.target.value))} className="w-full p-4 rounded-xl border-2 border-blue-300 bg-blue-50 text-[#0a0a2e] font-black focus:border-blue-600 font-mono outline-none transition-all shadow-sm shadow-blue-100" />
                    </div>
                </div>

                {/* Condições à Vista */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <h3 className="font-black text-sm text-[#0a0a2e] uppercase tracking-wider">Pagamento à Vista</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Valor (R$)</label>
                            <input type="number" value={formData.opcao_vista.valor} onChange={e => setFormData({...formData, opcao_vista: {...formData.opcao_vista, valor: Number(e.target.value)}})} className="w-full p-4 rounded-xl border-2 border-slate-200 text-[#0a0a2e] font-black font-mono focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Forma</label>
                            <select value={formData.opcao_vista.forma_pagamento} onChange={e => setFormData({...formData, opcao_vista: {...formData.opcao_vista, forma_pagamento: e.target.value}})} className="w-full p-4 rounded-xl border-2 border-slate-200 text-[#0a0a2e] font-bold focus:border-blue-600 outline-none transition-all">
                                <option value="PIX">PIX</option>
                                <option value="Boleto">Boleto Bancário</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Condições Detalhadas</label>
                            <input type="text" value={formData.opcao_vista.condicoes} onChange={e => setFormData({...formData, opcao_vista: {...formData.opcao_vista, condicoes: e.target.value}})} className="w-full p-4 rounded-xl border-2 border-slate-200 text-[#0a0a2e] font-bold focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" placeholder="Ex: 5% de desconto no PIX" />
                        </div>
                    </div>
                </div>

                {/* Condições Parcelado */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <h3 className="font-black text-sm text-[#0a0a2e] uppercase tracking-wider">Pagamento Parcelado</h3>
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Valor Total Parcelado</label>
                            <input type="number" value={formData.opcao_parcelado.valor} onChange={e => handleValorParceladoChange(Number(e.target.value))} className="w-full p-4 rounded-xl border-2 border-slate-200 text-[#0a0a2e] font-black font-mono focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Entrada Inicial (R$)</label>
                            <input type="number" value={formData.opcao_parcelado.valor_entrada} onChange={e => handleEntradaChange(Number(e.target.value))} className="w-full p-4 rounded-xl border-2 border-slate-200 text-blue-600 font-black font-mono focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Nº de Parcelas</label>
                            <select value={formData.opcao_parcelado.num_parcelas} onChange={e => handleParcelasChange(Number(e.target.value))} className="w-full p-4 rounded-xl border-2 border-slate-200 text-[#0a0a2e] font-black focus:border-blue-600 outline-none transition-all">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map(n => (
                                    <option key={n} value={n}>{n}x de {(formData.opcao_parcelado.valor_parcela || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Forma Parcelamento</label>
                            <select value={formData.opcao_parcelado.forma_pagamento} onChange={e => setFormData({...formData, opcao_parcelado: {...formData.opcao_parcelado, forma_pagamento: e.target.value}})} className="w-full p-4 rounded-xl border-2 border-slate-200 text-[#0a0a2e] font-bold focus:border-blue-600 outline-none transition-all">
                                <option value="Boleto Bancário">Boleto Bancário</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                            </select>
                        </div>
                        <div className="md:col-span-4 space-y-2 mt-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Descrição das Condições</label>
                            <input type="text" value={formData.opcao_parcelado.condicoes} onChange={e => setFormData({...formData, opcao_parcelado: {...formData.opcao_parcelado, condicoes: e.target.value}})} className="w-full p-4 rounded-xl border-2 border-slate-200 text-[#0a0a2e] font-bold focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" placeholder="Ex: Entrada + Parcelas recorrentes" />
                        </div>
                        
                        <div className="md:col-span-4 mt-2 p-4 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                           <div className="text-[10px] font-black tracking-widest text-[#0a0a2e] uppercase flex flex-col sm:flex-row sm:items-center gap-2">
                              Restante a parcelar (após entrada): <span className="text-[#0a0a2e] text-sm tabular-nums">{(formData.opcao_parcelado.valor - formData.opcao_parcelado.valor_entrada).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                           </div>
                           <div className="text-[10px] font-black tracking-widest text-blue-600 uppercase flex flex-col sm:flex-row sm:items-center gap-2">
                              Valor Previsto de Cada Parcela: <span className="text-white text-lg bg-blue-600 px-4 py-2 rounded-xl border-2 border-blue-600/20 tabular-nums">{(formData.opcao_parcelado.valor_parcela || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                           </div>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={submitting} className="w-full bg-[#0a0a2e] text-white p-6 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-blue-900 transition-all flex items-center justify-center gap-3">
                  {submitting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                  Gerar Proposta
                </button>

              </form>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                  <div className="size-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle size={40} />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Proposta Criada!</h3>
                  <p className="text-slate-500">O link da proposta personalizada já está pronto.</p>
                  <div className="w-full flex gap-2">
                    <input readOnly value={generatedLink || ''} className="flex-1 p-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-mono" />
                    <button onClick={copyToClipboard} className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700">
                      <Copy size={20} />
                    </button>
                  </div>
                  <button onClick={() => setGeneratedLink(null)} className="text-blue-600 font-black uppercase text-xs">Gerar outra</button>
                </div>


            )
          ) : (
             <ProposalsTable />
          )}
        </div>
      </motion.div>
    </div>
  );
};
