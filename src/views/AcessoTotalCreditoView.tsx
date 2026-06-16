import React, { useState, useEffect } from 'react';
import { CheckCircle2, Download, Users, Phone, Building2, Calendar, ShieldCheck, ArrowRight, HelpCircle, TrendingUp, Award, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import { LeadCaptureModal } from '../components/GSA/LeadCaptureModal';
import { salvarLeadSimples, sendThankYouEmail } from '../services/leadService';
import { registrarVendaManual, processarVenda, gerarPagamentoAsaasFront, gerarPagamentoPixGateway } from '../services/vendaService';
import { getSaasConfig } from '../services/configService';
import { trackInitiateCheckout, trackPurchase, trackLeadCapture } from '../utils/tracking';


export default function AcessoTotalCreditoView() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    whatsapp: ''
  });

  const [empresasAtendidas, setEmpresasAtendidas] = useState(0);
  const [volumeCredito, setVolumeCredito] = useState(0);
  const [taxaSucesso, setTaxaSucesso] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState({ nome: '', preco: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pixData, setPixData] = useState<{ id: string; protocolo: string; qrcode?: string; copiaECola?: string; invoiceUrl?: string; gateway?: string } | null>(null);
  const [manualRedirectLink, setManualRedirectLink] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Existing state for stats and faq ... (the existing code will stay, I'll just add these)
  // [I must NOT remove existing state]

  useEffect(() => {
    let start = 0;
    const endEmpresas = 2487;
    const endVolume = 42; // Millions
    const endTaxa = 94.2; // Percent
    const duration = 2000; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutExpo function for extremely smooth final adjustment
      const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      setEmpresasAtendidas(Math.floor(easedProgress * endEmpresas));
      setVolumeCredito(Math.floor(easedProgress * endVolume));
      setTaxaSucesso(Number((easedProgress * endTaxa).toFixed(1)));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    let formattedValue = value;
    if (name === 'whatsapp') {
      formattedValue = value.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'whatsapp' ? formattedValue.substring(0, 15) : value
    }));
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Swal.fire('Atenção', 'Por favor, insira um e-mail válido.', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      // 1. Cadastrar lead
      await salvarLeadSimples({
        nome: formData.nome,
        email: formData.email,
        telefone: formData.whatsapp,
      });

      // 2. Enviar email
      await sendThankYouEmail(formData.email, formData.nome);
      
      await trackLeadCapture();

      const result = await Swal.fire({
        title: 'Cadastro realizado com sucesso!',
        html: '<p>Parabéns pela sua decisão. O próximo passo agora é agendar uma reunião com nossa equipe e gerar o diagnóstico geral sobre a empresa para descobrirmos o que está barrando a empresa de ter crédito e como podemos melhorar o perfil de crédito da empresa.</p>',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Agendar agora por R$ 197',
        cancelButtonText: 'Continuar no site',
        confirmButtonColor: '#2563eb'
      });

      if (result.isConfirmed) {
        setSelectedPlan({ nome: 'Recuperação de Crédito', preco: 197 });
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Erro', 'Ocorreu um erro ao processar seu cadastro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-blue-600 selection:text-white">
      
      {/* 1. Cabeçalho Minimalista */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white font-bold text-xl tracking-wider">GSA</div>
            <span className="font-semibold text-lg tracking-tight hidden sm:inline">Câmara Grupo Soluções</span>
          </div>
          <button className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Área do Cliente
          </button>
        </div>
      </header>

      {/* 2. Seção Hero (Título Agressivo + Formulário) */}
      <section className="px-6 py-16 lg:py-24 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <span className="bg-blue-500/10 text-blue-400 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border border-blue-500/20">
            Acesso Total ao Crédito B2B
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            CHEGA DE VER O SEU CNPJ SENDO <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">REJEITADO</span> PELOS BANCOS!
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            O problema não é o banco não ter dinheiro. O problema é como o seu pedido está sendo feito. 
            Mais de 80% dos empresários têm limite potencial, mas perdem a oportunidade por erros bobos de documentação, 
            enquadramento ou pendências ocultas no e-CAC e CND. Nós não somos um banco; somos a consultoria especializada que prepara você para a aprovação.
          </p>

          {/* Animated Counter Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-sm shadow-inner">
            <div className="text-center sm:text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Empresas</span>
              <span className="text-xl sm:text-2xl font-black text-blue-500 font-mono tracking-tight">{empresasAtendidas.toLocaleString('pt-BR')}+</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Diagnosticadas</span>
            </div>
            <div className="text-center sm:text-left border-l border-slate-800 pl-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Crédito</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-500 font-mono tracking-tight">R$ {volumeCredito}M+</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Viabilizado</span>
            </div>
            <div className="text-center sm:text-left border-l border-slate-800 pl-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Sucesso</span>
              <span className="text-xl sm:text-2xl font-black text-amber-500 font-mono tracking-tight">{taxaSucesso}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Aprovação</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2 text-sm text-slate-400">
            <span className="flex items-center gap-2"><ShieldCheck className="text-emerald-500" size={18} /> Análise rápida e segura</span>
            <span className="flex items-center gap-2"><ShieldCheck className="text-emerald-500" size={18} /> Metodologia em conformidade com o SISBACEN</span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-900 border border-slate-800/80 p-8 rounded-2xl shadow-xl space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Comece Agora o Seu Processo</h3>
            <p className="text-xs text-slate-400">Preencha abaixo para realizar a simulação consultiva.</p>
          </div>
          
          <form onSubmit={handleSubmitLead} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome Completo</label>
              <input type="text" name="nome" required value={formData.nome} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-4 py-2.5 text-white outline-none transition-colors" placeholder="Ex: João da Silva" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">E-mail Corporativo</label>
              <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-4 py-2.5 text-white outline-none transition-colors" placeholder="joao@suaempresa.com" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp</label>
                <input type="tel" name="whatsapp" required value={formData.whatsapp} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-4 py-2.5 text-white outline-none transition-colors" placeholder="(54) 99999-9999" />
              </div>
            </div>

            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-lg transition-colors shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 group">
              QUERO SIMULAR MEU LIMITE POTENCIAL AGORA
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Timeline of Steps After Payment */}
          <div className="pt-6 border-t border-slate-800">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Etapas Após Diagnóstico & Pagamento de R$ 197
            </h4>
            <div className="relative border-l border-blue-500/30 ml-2 pl-4 space-y-5 text-xs">
              <div className="relative">
                <div className="absolute -left-[21px] top-0 bg-blue-500 rounded-full w-2.5 h-2.5 ring-4 ring-slate-900"></div>
                <p className="font-bold text-white">1. Geração do Relatório Customizado</p>
                <p className="text-slate-400 mt-1">Nossos algoritmos consolidam as informações do seu CNPJ para estimar seu Limite Potencial Real.</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[21px] top-0 bg-blue-500/50 rounded-full w-2.5 h-2.5 ring-4 ring-slate-900"></div>
                <p className="font-bold text-white">2. Auditoria e-CAC e Emissão de CNDs</p>
                <p className="text-slate-400 mt-1">Cruzamos dados fiscais para identificar e organizar impeditivos, pendências ou restrições ativas.</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[21px] top-0 bg-emerald-500 rounded-full w-2.5 h-2.5 ring-4 ring-slate-900 animate-pulse"></div>
                <p className="font-bold text-emerald-400">3. Reunião Estratégica con Especialista</p>
                <p className="text-slate-400 mt-1">Apresentação dos caminhos comerciais viáveis para obter a melhor taxa e prazo para a captação.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Seção do Problema */}
      <section className="bg-slate-900/40 border-y border-slate-900 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Por que você continua ouvindo 'Não' quando mais precisa de faturamento?</h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed text-justify sm:text-center">
            Muitos empresários perdem noites de sono buscando capital de giro para reorganizar dívidas, investir em estoque ou expandir a operação. 
            Você sabe que sua empresa tem potencial, faturamento compatível e atividade regular, mas ao solicitar o Pronampe ou qualquer outra linha, 
            o banco simplesmente recusa sem explicar o motivo real. A verdade amarga? O gerente do banco não tem tempo (e muitas vezes não tem interesse) 
            para te ajudar a corrigir seu perfil. Ele só processa os 'pré-aprovados'. Você está à mercê do sistema bancário, operando no escuro.
          </p>
        </div>
      </section>

      {/* 4. Seção da Solução: O Diagnóstico de Crédito */}
      <section className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-white">A Primeira Etapa da Aprovação: O Diagnóstico de Crédito CNPJ Pro</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">Nossos especialistas utilizam a mesma metodologia de análise consultiva dos bancos, mas focada em você, empresário.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            { t: 'Cálculo do Limite Potencial Real', d: 'Saiba exatamente quanto sua empresa pode solicitar antes de bater na porta do gerente.' },
            { t: 'Análise de Enquadramento', d: 'Verifique se você atende aos critérios exatos do Pronampe 2026 (até 50% do faturamento anual) ou outras linhas de capital de giro.' },
            { t: 'Confecção da Matriz de Risco do Banco', d: 'Antecipe o algoritmo do banco e saiba quais pontos de segurança a mesa de crédito vai analisar no seu perfil.' },
            { t: 'Auditoria Completa de Pendências (e-CAC, CND)', d: 'Identifique com precisão quais dívidas vencidas, falta de autorização ou documentação incompleta estão gerando bloqueios no seu CNPJ.' }
          ].map((item, index) => (
            <div key={index} className="flex gap-4 p-6 bg-slate-900/60 rounded-xl border border-slate-900 hover:border-slate-800 transition-colors">
              <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
              <div className="space-y-1.5">
                <h4 className="text-lg font-bold text-white">{item.t}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{item.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. A Recuperação de Crédito por R$ 397 (O Upsell) */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="bg-gradient-to-b from-blue-950/40 to-slate-900 border-2 border-blue-500/30 p-8 sm:p-12 rounded-3xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl pointer-events-none"></div>
          <h2 className="text-2xl sm:text-4xl font-black text-white">CNPJ sem crédito?</h2>
          <p className="text-slate-400 max-w-3xl mx-auto text-sm sm:text-base leading-relaxed">
            Nós buscamos as melhores opções para sua empresa. Agende uma reunião com nossos especialistas por R$ 197 e receba um relatório de como está sua empresa e quais caminhos podemos direcionar para o alinhamento de crédito.
          </p>
          <div className="pt-4">
            <button onClick={() => {
              setSelectedPlan({ nome: 'Recuperação de Crédito', preco: 197 });
              setIsModalOpen(true);
            }} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black px-8 py-4 rounded-xl transition-all shadow-xl shadow-orange-950/20 text-sm sm:text-base tracking-wide">
              QUERO RECUPERAR MEU CRÉDITO AGORA POR R$ 197
            </button>
          </div>
          <p className="text-xs text-slate-500">Garantia integral de satisfação de 7 dias protegida por contrato.</p>
        </div>
      </section>

      {/* 6. O Agendamento com Especialista (Main Offer) */}
      <section className="bg-slate-900/20 border-t border-slate-900 py-20 px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-white">Da Simulação à Liberação, Montamos o Seu Projeto com Estratégia B4B</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Acompanhe a jornada completa da sua empresa até a atração do capital estruturado de alto valor.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { n: '1', t: 'Diagnóstico Realizado', d: 'Mapeamento total da situação do CNPJ e identificação das barreiras fiscais.' },
              { n: '2', t: 'Regularização Ativa', d: 'CNPJ limpo, CNDs emitidas e perfil reabilitado na praça.' },
              { n: '3', t: 'Alinhamento Consultivo', d: 'Reunião estratégica e customizada com o consultor sênior da GSA.' },
              { n: '4', t: 'Confecção do Projeto', d: 'Enquadramento tributário completo e escolha direcionada do banco parceiro ideal.' },
              { n: '5', t: 'Mesa de Crédito', d: 'Protocolo assistido do projeto estruturado até o depósito em conta.' }
            ].map((step, i) => (
              <div key={i} className="bg-slate-900 p-6 rounded-xl border border-slate-800/60 relative space-y-3">
                <span className="absolute -top-4 -left-2 w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-sm">{step.n}</span>
                <h5 className="font-bold text-white pt-2">{step.t}</h5>
                <p className="text-xs text-slate-400 leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>

          <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Agende sua Reunião Estratégica</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Dependente de análise de crédito e perfil, este projeto é a rota estratégica para acessar os melhores benefícios governamentais e capital de giro.</p>
            </div>
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-slate-500 text-sm flex flex-col items-center justify-center gap-2 py-10">
              <Calendar size={32} className="text-slate-600" />
              <span>[Espaço Reservado para o Widget do Calendly / Agendador]</span>
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg transition-colors">
              QUERO AGENDAR MINHA CONSULTORIA ESTRATÉGICA
            </button>
          </div>
        </div>
      </section>

      {/* 7. O que é o Pronampe 2026? (FAQ/Cards) */}
      <section className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white">A Melhor Oportunidade para sua Empresa: O Novo Pronampe 2026</h2>
          <p className="text-slate-400">Entenda os benefícios e regras vigentes do principal programa de fomento governamental.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { t: 'Até 50% do Faturamento', d: 'Limite máximo estimado com base no faturamento bruto anual declarado pela sua empresa.' },
            { t: 'Teto de Até R$ 500 Mil', d: 'Possibilidade de contratar valores expressivos e robustos para alavancagem por CNPJ.' },
            { t: 'Prazo de Até 96 Meses', d: 'Parcelamento estendido e diluído a longo prazo para preservar seu fluxo de caixa.' },
            { t: 'Carência de Até 24 Meses', d: 'Fôlego financeiro inicial para organizar o caixa antes do vencimento da primeira parcela.' },
            { t: 'Reorganizar Dívidas', d: 'Permissão legal em cenários elegíveis para reestruturar e unificar passivos onerosos.' },
            { t: 'Sujeito à Análise Bancária', d: 'As condições e a liberação dependem estritamente do agente operador e das regras de compliance vigentes.' }
          ].map((card, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800/40 p-6 rounded-xl space-y-2 hover:bg-slate-900/80 transition-colors">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                {card.t}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">{card.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 max-w-4xl mx-auto space-y-12 border-t border-slate-900">
        <div className="text-center space-y-3">
          <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">FAQ</span>
          <h2 className="text-3xl font-black text-white tracking-tight">Perguntas Frequentes sobre Recuperação de Crédito</h2>
          <p className="text-slate-400">Esclareça suas dúvidas sobre o funcionamento do nosso diagnóstico, plano de ação e direcionamento comercial.</p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: 'O que é o Diagnóstico de Crédito CNPJ Pro?',
              a: 'O Diagnóstico é um mapeamento completo e minucioso da situação fiscal, cadastral e de risco do seu CNPJ. Nós analisamos seu perfil com a mesma metodologia de análise consultiva dos grandes bancos para identificar o seu limite potencial real de crédito e qualquer pendência (no e-CAC, faturamento ou restrições) que possa impedir a aprovação.'
            },
            {
              q: 'Como funciona o processo de recuperação de crédito por R$ 197?',
              a: 'Caso nosso diagnóstico identifique restrições tributárias ou pendências cadastrais no seu CNPJ, elaboramos por apenas R$ 197 um plano de ação estratégico personalizado. Nossos analistas especializados vão traçar a rota exata para regularizar suas pendências fiscais da forma mais em conta, organizar as certidões CNDs necessárias e reabilitar seu perfil na praça para que você possa voltar a captar crédito.'
            },
            {
              q: 'Quais são os principais fatores que geram a recusa do crédito nos bancos?',
              a: 'Os bancos costumam negar crédito devido a faturamento inconsistente, falta de certidões negativas (CNDs), pendências ocultas no e-CAC/CADIN, inadequação para enquadramento do Pronampe ou simplesmente uma baixa pontuação cadastral. O nosso plano de recuperação resolve esses problemas na raiz.'
            },
            {
              q: 'O agendamento da reunião com o especialista está incluso?',
              a: 'Sim! Ao adquirir a nossa consultoria de recuperação, você terá acesso ao agendamento de uma reunião de alinhamento estratégico com um profissional sênior da GSA para analisar o relatório de sua empresa e receber um direcionamento completo sobre os caminhos ideais.'
            },
            {
              q: 'Há alguma garantia contratual de satisfação?',
              a: 'Sim, nós oferecemos uma garantia integral de satisfação de 7 dias protegida por contrato. Se dentro deste prazo você julgar que nosso relatório e plano de ação não trouxeram clareza e soluções viáveis para reabilitação do seu CNPJ, garantimos a devolução do valor pago integralmente.'
            }
          ].map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={idx} className="bg-slate-900 border border-slate-800/60 rounded-xl overflow-hidden transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full flex justify-between items-center px-6 py-5 text-left font-bold text-white hover:bg-slate-900/80 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-xl"
                >
                  <span className="text-base sm:text-lg tracking-tight pr-4">{faq.q}</span>
                  <ChevronDown
                    size={20}
                    className={`text-blue-500 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-350 ease-in-out ${
                    isOpen ? 'max-h-[500px] border-t border-slate-800/40' : 'max-h-0'
                  }`}
                >
                  <div className="px-6 py-5 text-slate-400 text-sm sm:text-base leading-relaxed text-justify">
                    {faq.a}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. Rodapé Institucional */}
      <footer className="bg-slate-950 border-t border-slate-900 px-6 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6 text-center sm:text-left">
          <div className="space-y-1">
            <p className="font-bold text-slate-400">GSA Grupo Soluções e Associados</p>
            <p>Contato: suporte@gsasolucoes.com.br | Garibaldi - RS</p>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-300 transition-colors">Política de Privacidade</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Termos de Uso</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-900/60 text-center text-[10px] leading-relaxed">
          Disclaimer: As condições comerciais, prazos, carências e aprovação final estão estritamente sujeitos à análise de risco de crédito, compliance fiscal e políticas internas de cada instituição financeira parceira operadora.
        </div>
      </footer>

      {isModalOpen && (
        <LeadCaptureModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={async (data) => {
            setIsModalOpen(false);
            setLoading(true);
            try {
              // Registrar venda
              const vendaId = await registrarVendaManual('temp_unregistered', { nome: selectedPlan.nome, preco: selectedPlan.preco });
              
              // Gerar Pagamento
              const paymentResult = await gerarPagamentoAsaasFront({
                nome: data.nome,
                email: data.email,
                cpf: data.documento,
                valor: selectedPlan.preco,
                descricao: `Diagnóstico ${selectedPlan.nome}`,
                vendaId: vendaId
              });
              
              setPixData({
                id: paymentResult.payment_id,
                protocolo: vendaId,
                qrcode: paymentResult.qr_code_base64,
                copiaECola: paymentResult.copy_paste,
                invoiceUrl: paymentResult.invoice_url,
                gateway: 'ASAAS'
              });
              setShowPayment(true);
            } catch (err) {
              console.error(err);
              Swal.fire('Erro', 'Não foi possível gerar o pagamento.', 'error');
            } finally {
              setLoading(false);
            }
          }}
          plano={selectedPlan.nome}
        />
      )}

      {showPayment && pixData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-sm space-y-4 text-center border border-slate-700">
            <h2 className="text-xl font-black text-white">Pagamento PIX</h2>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left space-y-2">
              <p className="text-xs text-slate-400">Você está pagando por:</p>
              <p className="text-sm font-bold text-white">Diagnóstico de Crédito e reunião com especialista</p>
              <p className="text-xl font-black text-emerald-500">R$ 197,00</p>
            </div>

            <img src={`data:image/png;base64,${pixData.qrcode}`} alt="QR Code PIX" className="w-52 h-52 mx-auto rounded-lg bg-white p-1"/>
            
            <button 
              onClick={() => { navigator.clipboard.writeText(pixData.copiaECola || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="w-full bg-blue-600 p-3 rounded-lg text-sm font-bold text-white">
              {copied ? 'Copiado!' : 'Copiar Código PIX'}
            </button>
            <button 
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch(`https://gsa-diagn-stico-recupera-o-de-cr-dito-165811949193.us-west1.run.app/api/asaas/check-payment/${pixData.id}`);
                  const data = await res.json();
                  if (data.status === 'PAID') {
                    setPaymentStatus('PAID');
                    Swal.fire('Sucesso!', 'Pagamento confirmado!', 'success');
                    setShowPayment(false);
                  } else {
                    Swal.fire('Ops', 'Pagamento ainda não identificado. Tente novamente em instantes.', 'info');
                  }
                } catch (e) {
                  Swal.fire('Erro', 'Falha ao consultar pagamento.', 'error');
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full bg-emerald-600 p-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Consultando...' : 'Já fiz o pagamento'}
            </button>

            <div className="text-[10px] text-slate-500 space-y-1">
                <p>✅ Compra 100% segura e protegida.</p>
                <p>Após o pagamento, você será direcionado para o agendamento da reunião.</p>
            </div>

            <button onClick={() => setShowPayment(false)} className="w-full text-slate-500 text-sm font-bold pt-2">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
