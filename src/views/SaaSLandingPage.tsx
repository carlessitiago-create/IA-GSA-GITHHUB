import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { db } from '../firebase';
import { cadastrarCliente } from '../services/leadService';
import { processarVenda, gerarPagamentoSaaS, registrarVendaManual } from '../services/vendaService';
import { getSaasConfig, SaasConfig } from '../services/configService';
import { LeadCaptureModal } from '../components/GSA/LeadCaptureModal';
import { trackLeadCapture, trackPurchase, trackInitiateCheckout } from '../utils/tracking';

const SaaSLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ nome: '', preco: 0 });
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pixData, setPixData] = useState<{ id: string; protocolo: string; qrcode?: string; copiaECola?: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutos em segundos
  const [copied, setCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [config, setConfig] = useState<SaasConfig | null>(null);

  // Carrega as configurações do SaaS
  useEffect(() => {
    getSaasConfig().then(setConfig).catch(err => console.error("Erro ao carregar config SaaS:", err));
  }, []);

  // Efeito de Confetis ao Confirmar Pagamento
  useEffect(() => {
    if (paymentStatus === 'PAID') {
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
      
      return () => clearInterval(interval);
    }
  }, [paymentStatus]);

  // Monitoramento de Pagamento em Tempo Real
  useEffect(() => {
    if (showPayment && pixData?.id) {
      const unsub = onSnapshot(doc(db, 'sales', pixData.id), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status_pagamento === 'Pago' || data.mp_status === 'approved') {
            setPaymentStatus('PAID');
            trackPurchase(selectedPlan.nome, selectedPlan.preco); // 🟢 Pixel: Compra Confirmada
            
            // Redireciona automaticamente após 3 segundos de sucesso
            const timer = setTimeout(() => {
              navigate('/consulta');
            }, 3000);
            
            return () => clearTimeout(timer);
          }
        }
      });
      return () => unsub();
    }
  }, [showPayment, pixData?.id, selectedPlan.nome, selectedPlan.preco, navigate]);

  const handleCopyPix = () => {
    if (pixData?.copiaECola) {
      navigator.clipboard.writeText(pixData.copiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reseta o texto após 2 segundos
    }
  };

  // Cronómetro de Urgência
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 900));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `00:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleContratar = (nome: string, preco: number) => {
    setSelectedPlan({ nome, preco });
    setIsModalOpen(true);
    trackInitiateCheckout(nome, preco); // 🟢 Pixel: Iniciou checkout
  };

  const handleFinalizePurchase = async (leadData: { nome: string; documento: string; telefone: string; data_nascimento: string; email: string }) => {
    setLoading(true);
    trackLeadCapture(); // 🟢 Pixel: Lead capturado
    
    try {
      console.log("Iniciando fluxo de contratação SaaS...", leadData);

      // 1. Cadastra o Lead
      const novoCliente = await cadastrarCliente({
        ...leadData,
        especialista_id: "SaaS_GSA_IA"
      });

      if (!novoCliente || !novoCliente.id) {
        throw new Error("O sistema não conseguiu gerar um ID para o novo cliente.");
      }
      
      console.log("Cliente cadastrado com sucesso. ID:", novoCliente.id);

      if (config?.modo_pagamento === 'MANUAL') {
        // MODO MANUAL: Registra a venda e redireciona para link externo
        console.log("Modo Manual detectado. Registrando venda...");
        await registrarVendaManual(novoCliente.id, selectedPlan);
        
        // Seleciona o link correto baseado no plano
        let linkFinal = config.links_manuais.total; // Default
        if (selectedPlan.nome === "Diagnóstico Dívidas") linkFinal = config.links_manuais.dividas;
        if (selectedPlan.nome === "Rating de Crédito") linkFinal = config.links_manuais.rating;

        console.log("Redirecionando para link manual:", linkFinal);
        
        // Alerta amigável antes do redirecionamento
        alert("Você será redirecionado para o pagamento seguro. Seu diagnóstico será liberado após a confirmação!");
        
        window.location.href = linkFinal;
        return;
      }

      // 2. Gera a venda no backend (MODO AUTOMÁTICO)
      console.log("Chamando processarVenda...");
      const result = await processarVenda(
        novoCliente.id, 
        [{ 
            servicoId: "diag_credito", 
            servicoNome: selectedPlan.nome, 
            precoBase: selectedPlan.preco, 
            precoVenda: selectedPlan.preco, 
            prazoEstimadoDias: 1 
        }],
        'PIX',
        undefined,
        leadData.nome,
        leadData.documento,
        leadData.data_nascimento
      );

      console.log("Venda processada pelo backend:", result);

      if (!result || !result.saleId) {
        throw new Error("A venda foi processada, mas o servidor não retornou um ID de venda válido.");
      }

      // 3. Gera o pagamento no Mercado Pago
      console.log("Chamando gerarPagamentoSaaS...");
      const mpResult = await gerarPagamentoSaaS({
        valor: selectedPlan.preco,
        plano: selectedPlan.nome,
        email: leadData.email,
        nome: leadData.nome,
        cpf: leadData.documento,
        clienteId: novoCliente.id,
        vendaId: result.saleId
      });
      console.log("Pagamento MP gerado:", mpResult);

      // Armazena info da venda para o próximo passo
      const info = { 
        id: result.saleId, 
        protocolo: result.protocolo || result.saleId.substring(0, 8).toUpperCase(),
        qrcode: mpResult.qr_code_base64,
        copiaECola: mpResult.copy_paste
      };
      
      setPixData(info);
      
      // 4. Sucesso: Fecha modal e mostra tela de pagamento
      setIsModalOpen(false);
      setShowPayment(true);
      
    } catch (err: any) {
      console.error("Erro crítico no fluxo SaaS:", err);
      
      let errorMessage = "Erro desconhecido";
      
      if (err.code) {
        // Erro do Firebase Functions
        errorMessage = `[${err.code}] ${err.message}`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      alert("Erro ao processar sua solicitação: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (showPayment) {
    if (paymentStatus === 'PAID') {
      return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 text-center overflow-hidden">
          <div className="max-w-xl w-full bg-slate-800/80 backdrop-blur-xl p-12 rounded-[40px] border-2 border-green-500 shadow-[0_0_80px_rgba(34,197,94,0.15)] relative">
            
            {/* Ícone Animado */}
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(34,197,94,0.4)] animate-bounce">
              <svg className="w-12 h-12 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>

            <h2 className="text-4xl font-black text-white mb-4 tracking-tight uppercase">
              PAGAMENTO CONFIRMADO!
            </h2>
            
            <p className="text-slate-300 text-lg mb-10 leading-relaxed">
              Parabéns! O seu acesso ao <span className="text-green-500 font-bold">{selectedPlan.nome}</span> já está liberado. Nossa inteligência artificial processou seus dados com sucesso.
            </p>

            <div className="space-y-4">
              <button 
                onClick={() => navigate('/consulta')}
                className="w-full bg-green-500 text-slate-900 py-5 rounded-2xl font-black text-xl hover:bg-green-400 transition transform hover:scale-105 shadow-xl"
              >
                ACESSAR MEU DIAGNÓSTICO
              </button>
              
              <p className="text-slate-500 text-xs uppercase font-bold tracking-widest">
                Acesso disponível também via Portal do Cliente
              </p>
            </div>

            {/* Detalhe Decorativo */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
        <div className="bg-slate-800 p-8 rounded-3xl border border-green-500/30 max-w-md w-full text-center shadow-2xl">
          
          {/* Header do Pagamento */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-black mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              AGUARDANDO PAGAMENTO
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Escaneie ou Copie o PIX</h2>
          </div>

          {/* QR Code Real */}
          <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-inner">
            {pixData?.qrcode ? (
              <img 
                src={`data:image/png;base64,${pixData.qrcode}`} 
                alt="QR Code PIX" 
                className="w-44 h-44"
              />
            ) : (
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixData?.copiaECola || '')}`} 
                alt="QR Code PIX" 
                className="w-44 h-44"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {/* Opção Copia e Cola */}
          <div className="text-left mb-8">
            <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Código PIX (Copia e Cola)</label>
            <div className="flex gap-2 mt-1">
              <input 
                readOnly
                value={pixData?.copiaECola || 'Gerando código...'}
                className="flex-1 bg-slate-900 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono truncate outline-none"
              />
              <button 
                onClick={handleCopyPix}
                className={`px-4 rounded-lg font-bold text-xs transition-all ${copied ? 'bg-green-500 text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
              >
                {copied ? 'COPIADO!' : 'COPIAR'}
              </button>
            </div>
          </div>

          {/* Alerta de Automação */}
          <div className="bg-green-500/5 border border-green-500/20 p-4 rounded-xl mb-8">
            <p className="text-sm text-green-500 font-medium leading-tight">
              ✅ <strong>Liberação Imediata:</strong> Após o pagamento, nosso sistema processará seu diagnóstico em poucos segundos.
            </p>
          </div>

          {/* Botão de Verificação */}
          <button 
            onClick={() => navigate('/consulta')}
            className="w-full bg-green-500 text-slate-900 py-4 rounded-xl font-black hover:bg-green-400 transition transform active:scale-95 shadow-lg shadow-green-500/20"
          >
            JÁ PAGUEI, VER DIAGNÓSTICO
          </button>
          
          <p className="mt-6 text-[10px] text-slate-600 uppercase font-bold tracking-[2px]">
            Protocolo: {pixData?.protocolo || '---'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] text-white min-h-screen font-sans selection:bg-green-500/30">
      
      {/* HERO SECTION */}
      <section className="relative pt-16 pb-20 px-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/2">
            <span className="bg-green-500/10 text-green-500 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              Tecnologia GSA-IA Ativada
            </span>
            <h1 className="text-4xl lg:text-6xl font-black mt-6 leading-tight">
              DESCUBRA O QUE ESTÁ <span className="text-green-500">TRAVANDO SEU CRÉDITO</span>
            </h1>
            <p className="text-slate-400 text-lg mt-6 mb-8">
              Utilize nossa inteligência para identificar restrições internas e recuperar seu poder de compra.
            </p>
            <button 
              onClick={() => document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-green-500 hover:bg-green-600 text-slate-900 font-bold py-4 px-10 rounded-xl transition-all shadow-lg shadow-green-500/20"
            >
              QUERO MEU DIAGNÓSTICO AGORA
            </button>
          </div>

          {/* DASHBOARD FAKE VISUAL */}
          <div className="lg:w-1/2 w-full bg-slate-800/50 p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
             <div className="flex justify-between mb-8 text-sm text-slate-400 font-mono">
                <span>ESTADO DO CRÉDITO</span>
                <span className="text-red-500 animate-pulse">● CRÍTICO</span>
             </div>
             <div className="flex justify-center mb-10">
                <div className="w-40 h-40 rounded-full border-[10px] border-red-500/20 border-t-red-500 flex items-center justify-center relative rotate-[-45deg]">
                    <span className="text-4xl font-black text-white rotate-[45deg]">432</span>
                </div>
             </div>
             <div className="space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border-l-4 border-red-500 flex justify-between">
                    <span>Restrição BACEN</span>
                    <span className="font-bold text-red-500 italic">DETECTADA</span>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border-l-4 border-red-500 flex justify-between">
                    <span>Apontamento SPC</span>
                    <span className="font-bold text-red-500">ATIVO</span>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* TIMER DE URGÊNCIA */}
      <div className="bg-red-500/10 border-y border-red-500/20 py-3 text-center">
        <p className="text-red-500 font-bold text-sm tracking-widest">
          ⚠️ OFERTA PROMOCIONAL TERMINA EM: {formatTime(timeLeft)}
        </p>
      </div>

      {/* SEÇÃO DE OFERTAS */}
      <section id="ofertas" className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Plano Básico */}
          <div className="bg-slate-800/40 border border-white/5 p-8 rounded-3xl hover:border-green-500/50 transition-all group">
            <h3 className="text-xl font-bold mb-2">Diagnóstico Dívidas</h3>
            <p className="text-slate-500 text-sm mb-6">Consulta completa SPC e Serasa.</p>
            <div className="mb-8">
               <span className="text-slate-500 line-through block text-sm">R$ 49,00</span>
               <span className="text-3xl font-black text-green-500">R$ 24,90</span>
            </div>
            <button 
              disabled={loading}
              onClick={() => handleContratar("Diagnóstico Dívidas", 24.90)}
              className="w-full bg-slate-700 group-hover:bg-green-500 group-hover:text-slate-900 py-3 rounded-xl font-bold transition-all"
            >
              CONTRATAR
            </button>
          </div>

          {/* Plano Ouro (Destaque) */}
          <div className="bg-slate-800 border-2 border-green-500 p-8 rounded-3xl relative lg:scale-110 shadow-2xl shadow-green-500/10">
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-slate-900 text-[10px] font-black px-4 py-1 rounded-full">RECOMENDADO</span>
            <h3 className="text-xl font-bold mb-2">Diagnóstico TOTAL</h3>
            <p className="text-slate-400 text-sm mb-6">BACEN + Rating + SPC + Bônus Crédito.</p>
            <div className="mb-8">
               <span className="text-slate-500 line-through block text-sm">R$ 397,00</span>
               <span className="text-3xl font-black text-green-500">R$ 297,00</span>
            </div>
            <button 
              disabled={loading}
              onClick={() => handleContratar("Diagnóstico TOTAL", 297.00)}
              className="w-full bg-green-500 text-slate-900 py-4 rounded-xl font-black transition-all hover:bg-green-400 shadow-lg shadow-green-500/20"
            >
              CONTRATAR COMPLETO
            </button>
          </div>

          {/* Plano Intermédio */}
          <div className="bg-slate-800/40 border border-white/5 p-8 rounded-3xl hover:border-green-500/50 transition-all group">
            <h3 className="text-xl font-bold mb-2">Rating de Crédito</h3>
            <p className="text-slate-500 text-sm mb-6">Descubra seu score real nos bancos.</p>
            <div className="mb-8">
               <span className="text-slate-500 line-through block text-sm">R$ 197,00</span>
               <span className="text-3xl font-black text-green-500">R$ 97,00</span>
            </div>
            <button 
              disabled={loading}
              onClick={() => handleContratar("Rating de Crédito", 97.00)}
              className="w-full bg-slate-700 group-hover:bg-green-500 group-hover:text-slate-900 py-3 rounded-xl font-bold transition-all"
            >
              CONTRATAR
            </button>
          </div>

        </div>
      </section>

      {/* Modal de Captura */}
      <LeadCaptureModal 
        isOpen={isModalOpen}
        plano={selectedPlan.nome}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleFinalizePurchase}
      />

      {loading && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-green-500/20 rounded-full"></div>
              <div className="w-20 h-20 border-4 border-green-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-green-500/20 rounded-full animate-ping"></div>
              </div>
            </div>
            <p className="mt-8 font-black text-green-500 animate-pulse tracking-[0.3em] text-sm uppercase">
              Processando Inteligência...
            </p>
            <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest">
              GSA-IA está analisando seus dados
            </p>
        </div>
      )}
    </div>
  );
};

export default SaaSLandingPage;
