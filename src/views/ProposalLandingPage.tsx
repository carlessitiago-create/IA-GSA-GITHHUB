import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getProposalBySlug, ProposalData, checkCpfOwnership, updateProposalStatus } from '../services/proposalService';
import { ShowcaseService } from '../services/marketingService';
import { 
  CheckCircle, 
  Zap, 
  Calendar, 
  ShieldCheck, 
  MessageCircle, 
  ArrowRight, 
  Clock, 
  Star,
  ChevronRight,
  Loader2,
  AlertCircle,
  Banknote,
  CreditCard,
  Gift,
  Ticket,
  FastForward,
  UserPlus,
  Percent,
  Play,
  Image as ImageIcon,
  Layout
} from 'lucide-react';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';

export const ProposalLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [showcase, setShowcase] = useState<ShowcaseService | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProposal = async () => {
      if (slug) {
        const data = await getProposalBySlug(slug);
        setProposal(data);
        if (data?.showcase_service_id) {
          try {
            const snap = await getDoc(doc(db, 'showcase_services', data.showcase_service_id));
            if (snap.exists()) {
              setShowcase({ id: snap.id, ...snap.data() } as ShowcaseService);
            }
          } catch (error) {
            console.error("Erro ao buscar vitrine:", error);
          }
        }
      }
      setLoading(false);
    };
    fetchProposal();
  }, [slug]);

  const handleAccept = async (option: 'VISTA' | 'PARCELADO') => {
    const selectedOption = option === 'VISTA' ? proposal?.opcao_vista : proposal?.opcao_parcelado;
    
    const { value: formValues } = await Swal.fire({
      title: 'Ótima escolha!',
      text: `Para formalizar seu aceite da Opção ${option === 'VISTA' ? 'À Vista' : 'Parcelada'}, informe seus dados:`,
      html: `
        <div class="space-y-4 text-left">
          ${proposal?.is_public ? `
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu Nome Completo</label>
            <input id="swal-nome" class="swal2-input !mt-1 !w-full !mx-0" placeholder="Nome Completo">
          </div>
          ` : ''}
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu CPF ou CNPJ</label>
            <input id="swal-cpf" class="swal2-input !mt-1 !w-full !mx-0" placeholder="000.000.000-00">
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sua Data de Nascimento</label>
            <input id="swal-nascimento" type="date" class="swal2-input !mt-1 !w-full !mx-0">
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu WhatsApp</label>
            <input id="swal-tel" class="swal2-input !mt-1 !w-full !mx-0" placeholder="(00) 00000-0000">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Continuar para Contratação',
      confirmButtonColor: '#0a0a2e',
      cancelButtonText: 'Voltar',
      preConfirm: () => {
        const cpf = (document.getElementById('swal-cpf') as HTMLInputElement).value;
        const tel = (document.getElementById('swal-tel') as HTMLInputElement).value;
        const nascimento = (document.getElementById('swal-nascimento') as HTMLInputElement).value;
        const nome = proposal?.is_public ? (document.getElementById('swal-nome') as HTMLInputElement).value : undefined;
        
        if (!cpf || !tel || !nascimento || (proposal?.is_public && !nome)) {
          Swal.showValidationMessage('Por favor, preencha todos os campos');
          return false;
        }
        return { cpf, tel, nome, nascimento };
      }
    });

    if (formValues) {
      setLoading(true);
      try {
        // Motor de Segurança: Verificar se já existe dono para este CPF/CNPJ
        const existingOwner = await checkCpfOwnership(formValues.cpf);
        
        if (existingOwner && existingOwner.uid !== proposal?.vendedor_id) {
          await Swal.fire({
            title: 'Aviso de Segurança',
            text: `Identificamos que você já possui um especialista vinculado ao seu CPF/CNPJ. O consultor ${existingOwner.nome} entrará em contato para dar continuidade ao seu atendimento.`,
            icon: 'info',
            confirmButtonColor: '#0a0a2e'
          });
          // Notificar dono original (simulado)
          console.log(`Notificando consultor ${existingOwner.nome} sobre tentativa de aceite do lead ${formValues.cpf}`);
        } else {
          // Fluxo de Contratação
          const { isConfirmed: payOnline } = await Swal.fire({
            title: 'Como deseja prosseguir?',
            text: 'Escolha a forma de finalização do seu processo:',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Pagar Online (Liberação Imediata)',
            cancelButtonText: 'Solicitar Contato do Consultor',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#3b82f6'
          });

          if (payOnline) {
            // Checkout PIX Simulado
            await Swal.fire({
              title: 'Checkout PIX',
              html: `
                <div class="space-y-4">
                  <p class="text-sm text-slate-600">Escaneie o QR Code abaixo para pagar via PIX:</p>
                  <div class="size-48 bg-slate-100 mx-auto rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300">
                    <span class="text-[10px] font-black text-slate-400 uppercase">QR CODE PIX</span>
                  </div>
                  <p class="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Liberação imediata após o pagamento</p>
                </div>
              `,
              confirmButtonText: 'Já paguei',
              confirmButtonColor: '#10b981'
            });
            
            // Atualizar Proposta para PAGA e Criar OS
            if (slug) {
              await updateProposalStatus(slug, 'PAGA', formValues.cpf, formValues.tel, formValues.nome, formValues.nascimento);
              Swal.fire('Sucesso!', 'Pagamento identificado! Sua Ordem de Serviço foi criada e um analista já está cuidando do seu caso.', 'success');
            }
          } else {
            // Notificar Consultor
            if (slug) {
              await updateProposalStatus(slug, 'ACEITA', formValues.cpf, formValues.tel, formValues.nome, formValues.nascimento);
              Swal.fire('Sucesso!', `O consultor ${proposal?.vendedor_nome} recebeu seu aceite e entrará em contato em instantes para finalizar os detalhes!`, 'success');
            }
          }
        }
      } catch (error) {
        console.error(error);
        Swal.fire('Erro', 'Ocorreu um erro ao processar seu aceite. Tente novamente.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a2e]">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-white font-black uppercase text-[10px] tracking-widest opacity-50">Carregando sua Proposta Exclusiva...</p>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <AlertCircle className="text-rose-500 mb-4" size={64} />
        <h1 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Proposta não encontrada</h1>
        <p className="text-slate-500 mt-2">O link pode ter expirado ou está incorreto.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      {/* Botão de Acesso Restrito (Premium Floating) */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100]">
        <motion.button 
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/financeiro')}
          className="group flex items-center gap-2 bg-[#0a0a2e]/60 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-blue-500/20 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="size-6 sm:size-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:rotate-12 transition-transform">
            <UserPlus className="size-3 sm:size-4" />
          </div>
          
          <div className="text-left hidden sm:block">
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Acesso Restrito</p>
            <p className="text-[10px] font-black text-white uppercase italic tracking-tight leading-none">Área do Cliente</p>
          </div>
          <span className="text-[10px] font-black text-white uppercase italic tracking-tight sm:hidden">Entrar</span>
          
          <ChevronRight className="size-3 sm:size-4 text-white/30 group-hover:translate-x-1 transition-transform ml-1 sm:ml-2" />
        </motion.button>
      </div>

      {/* Hero Section */}
      <header className="bg-[#0a0a2e] text-white py-12 md:py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#3b82f6,transparent)] scale-150"></div>
        </div>
        
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="size-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <ShieldCheck size={20} />
            </div>
            <span className="font-black text-2xl uppercase italic tracking-tighter text-white">GSA Diagnóstico</span>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex flex-col items-center gap-2"
          >
            <div className="bg-blue-600/20 border border-blue-500/30 px-4 py-2 rounded-full flex items-center gap-2">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Proposta de Solução Exclusiva</span>
            </div>
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mt-2">
              {proposal.is_public ? 'Oportunidade Exclusiva' : `Para: ${proposal.lead_nome}`}
            </p>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter leading-none"
          >
            {proposal.servico_nome}
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-blue-200 text-lg md:text-xl font-medium max-w-2xl mx-auto"
          >
            {proposal.is_public 
              ? "Confira os detalhes desta oferta especial que preparamos para você iniciar seu processo hoje mesmo com a GSA Diagnóstico."
              : `Olá ${proposal.lead_nome.split(' ')[0]}, preparamos as melhores condições para você iniciar seu processo hoje mesmo com a GSA Diagnóstico.`}
          </motion.p>
        </div>
      </header>

      {/* Vitrine Section */}
      {showcase && (
        <section className="py-12 px-4 bg-slate-50 border-b border-slate-100">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex items-center gap-3">
              <div className="size-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Layout size={16} />
              </div>
              <h2 className="text-xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Conheça o Serviço</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
              <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl bg-slate-900 group border-4 border-white">
                {showcase.videoId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${showcase.videoId}?autoplay=0&rel=0`}
                    title={showcase.titulo}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <img 
                    src={showcase.imagem_capa_url || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80"} 
                    alt={showcase.titulo}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                )}
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter leading-tight">{showcase.titulo}</h3>
                <p className="text-slate-600 text-lg leading-relaxed font-medium">{showcase.descricao_longa}</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                    <ImageIcon size={14} /> Fotos Reais
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                    <Play size={14} /> Vídeo Demonstrativo
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Vendedor Info */}
      <section className={`py-12 px-4 ${showcase ? 'mt-0' : '-mt-10'} relative z-20`}>
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 border border-slate-100"
          >
            <div className="flex items-center gap-6">
              <div className="size-20 rounded-2xl bg-slate-100 overflow-hidden border-4 border-white shadow-lg">
                {proposal.vendedor_foto ? (
                  <img src={proposal.vendedor_foto} alt={proposal.vendedor_nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#0a0a2e] text-white font-black text-2xl">
                    {proposal.vendedor_nome.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preparado por:</p>
                <h3 className="text-xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">{proposal.vendedor_nome}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="size-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Online Agora</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validade</p>
                <p className="text-sm font-black text-rose-600 uppercase italic">Expira em 48h</p>
              </div>
              <div className="size-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <Clock size={24} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Options Section */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Escolha sua Condição</h2>
            <p className="text-slate-500 font-medium">Selecione a opção que melhor se adapta ao seu momento.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Option 1: À Vista */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="bg-white rounded-[3rem] border-2 border-emerald-100 p-10 md:p-16 flex flex-col justify-between shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                <Zap size={150} className="text-emerald-600" />
              </div>
              
              <div className="space-y-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="size-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Zap size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-emerald-600 uppercase italic tracking-tighter">À Vista</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Máxima Economia</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-medium line-through">De R$ {(proposal.opcao_vista.valor * 1.1).toLocaleString('pt-BR')}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl md:text-7xl font-black text-[#0a0a2e] italic">R$ {proposal.opcao_vista.valor.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="pt-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                      <Banknote size={12} className="text-emerald-600" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">{proposal.opcao_vista.forma_pagamento || 'PIX'}</span>
                    </div>
                  </div>
                  <div className="text-emerald-600 font-bold text-sm uppercase italic whitespace-pre-line leading-relaxed">
                    {proposal.opcao_vista.condicoes}
                  </div>
                </div>

                <button 
                  onClick={() => handleAccept('VISTA')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-3"
                >
                  ACEITAR ESTA OPÇÃO <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>

            {/* Option 2: Parcelado */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="bg-[#0a0a2e] rounded-[3rem] p-10 md:p-16 flex flex-col justify-between shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group text-white"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                <Calendar size={150} className="text-blue-600" />
              </div>
              
              <div className="space-y-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="size-14 bg-white/10 text-blue-400 rounded-2xl flex items-center justify-center">
                    <Calendar size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Parcelado</h3>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Facilidade no Pagamento</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Entrada de</p>
                    <p className="text-3xl font-black text-blue-400 italic">R$ {proposal.opcao_parcelado.valor_entrada?.toLocaleString('pt-BR') || '0,00'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Mais {proposal.opcao_parcelado.num_parcelas}x de</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl md:text-7xl font-black text-white italic">R$ {proposal.opcao_parcelado.valor_parcela?.toLocaleString('pt-BR') || '0,00'}</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                      <CreditCard size={12} className="text-blue-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-300">{proposal.opcao_parcelado.forma_pagamento || 'Boleto'}</span>
                    </div>
                  </div>
                  <div className="text-white/60 font-bold text-xs uppercase italic whitespace-pre-line leading-relaxed">
                    {proposal.opcao_parcelado.condicoes}
                  </div>
                </div>

                <button 
                  onClick={() => handleAccept('PARCELADO')}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3"
                >
                  ACEITAR ESTA OPÇÃO <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Clube de Pontos Section */}
          {proposal.clube_pontos_info && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-16 p-8 md:p-12 bg-gradient-to-br from-blue-600 to-indigo-900 rounded-[3rem] text-white shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                <Star size={120} className="fill-white" />
              </div>
              <div className="relative z-10 space-y-8">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="size-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shrink-0 shadow-xl border border-white/30">
                    <Star size={40} className="text-yellow-400 fill-yellow-400" />
                  </div>
                  <div className="space-y-4 text-center md:text-left">
                    <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Clube de Pontos GSA</h3>
                    <p className="text-blue-100 font-medium leading-relaxed max-w-3xl">
                      {proposal.clube_pontos_info}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4">
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-2">
                    <Ticket size={24} className="text-yellow-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Vale-Compras</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-2">
                    <Gift size={24} className="text-pink-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Brindes</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-2">
                    <CheckCircle size={24} className="text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Pagamento em Dia</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-2">
                    <FastForward size={24} className="text-blue-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Antecipação</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-2">
                    <UserPlus size={24} className="text-purple-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Indicações</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-2">
                    <Percent size={24} className="text-orange-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Descontos</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-12 bg-slate-50 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale">
            <div className="flex items-center gap-2">
              <ShieldCheck size={24} />
              <span className="font-black uppercase tracking-widest text-xs">Segurança Total</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={24} />
              <span className="font-black uppercase tracking-widest text-xs">Garantia de Entrega</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle size={24} />
              <span className="font-black uppercase tracking-widest text-xs">Suporte Dedicado</span>
            </div>
          </div>
          
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            <p className="text-slate-600 font-medium text-lg leading-relaxed italic">
              "Nossa missão é simplificar processos complexos através da inteligência artificial, garantindo que você tenha o melhor resultado no menor tempo possível."
            </p>
            <div className="mt-6">
              <p className="font-black text-[#0a0a2e] uppercase tracking-tighter">Equipe GSA Diagnóstico</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="size-8 bg-[#0a0a2e] rounded-lg flex items-center justify-center text-white">
            <ShieldCheck size={16} />
          </div>
          <span className="font-black text-lg uppercase tracking-tighter text-[#0a0a2e]">GSA Diagnóstico</span>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2026 GSA Diagnóstico - Todos os direitos reservados</p>
      </footer>

      {/* Floating WhatsApp Button */}
      <a 
        href={`https://wa.me/55${proposal.lead_telefone?.replace(/\D/g, '')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-8 right-8 size-16 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all z-[100] group"
      >
        <MessageCircle size={32} />
        <span className="absolute right-full mr-4 bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-bold shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
          Dúvidas? Fale comigo!
        </span>
      </a>
    </div>
  );
};
