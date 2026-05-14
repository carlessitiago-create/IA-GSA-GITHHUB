import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSmartNavigate } from '../utils/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import Swal from 'sweetalert2';
import { db } from '../firebase';
import { cadastrarCliente } from '../services/leadService';
import { processarVenda, registrarVendaManual } from '../services/vendaService';
import { getSaasConfig, SaasConfig } from '../services/configService';
import { LeadCaptureModal } from '../components/GSA/LeadCaptureModal';
import { trackLeadCapture, trackPurchase, trackInitiateCheckout } from '../utils/tracking';
import { 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  PlayCircle, 
  Trophy, 
  ChevronRight, 
  Star, 
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ThumbsDown,
  ShieldX,
  Gift,
  DollarSign,
  Check,
  Landmark,
  Shield,
  Search,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SaaSLandingPage: React.FC = () => {
  const hostname = window.location.hostname.toLowerCase();
  const navigate = useSmartNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');
  
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ nome: '', preco: 0 });
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pixData, setPixData] = useState<{ id: string; protocolo: string; qrcode?: string; copiaECola?: string } | null>(null);
  const [manualRedirectLink, setManualRedirectLink] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutos em segundos
  const [copied, setCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [config, setConfig] = useState<SaasConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carrega as configurações do SaaS
  useEffect(() => {
    console.log("SaaSLandingPage: Component Mounted - Path:", window.location.pathname);
    getSaasConfig().then(setConfig).catch(err => console.error("Erro ao carregar config SaaS:", err));
  }, []);

  // Inicializa o Pixel do Facebook
  useEffect(() => {
    // Função auxiliar para disparar o PageView com segurança
    const dispararPageView = () => {
      if (typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'PageView');
      }
    };

    // 1. Tenta carregar o código base completo (Script da Meta)
    if (config?.meta_pixel_code) {
      if (!document.head.innerHTML.includes('fbevents.js')) {
        const template = document.createElement('template');
        template.innerHTML = config.meta_pixel_code.trim();
        
        Array.from(template.content.childNodes).forEach((node) => {
          if (node.nodeType === 1 && node.nodeName === 'SCRIPT') {
            const scriptElement = document.createElement('script');
            const originalScript = node as HTMLScriptElement;
            
            if (originalScript.src) {
               scriptElement.src = originalScript.src;
            }
            scriptElement.textContent = originalScript.textContent;
            
            Array.from(originalScript.attributes).forEach(attr => {
               scriptElement.setAttribute(attr.name, attr.value);
            });
            
            document.head.appendChild(scriptElement);
          } else if (node.nodeType === 1 && node.nodeName === 'NOSCRIPT') {
             if (!document.head.innerHTML.includes('noscript')) {
               document.head.appendChild(node.cloneNode(true));
             }
          }
        });
      } else {
        // Se já foi carregado via meta code, disparamos o page view na montagem desta página
        dispararPageView();
      }
    } 
    // 2. Se não tem código base, tenta carregar só pelo ID
    else if (config?.facebook_pixel_id) {
      const pixelId = config.facebook_pixel_id;
      
      // Verifica se o pixel já foi inicializado
      if (!(window as any).fbq) {
        ;(function(f: any,b: any,e: any,v: any,n?: any,t?: any,s?: any) {
          if(f.fbq) return;
          n = f.fbq = function() {
            n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments)
          };
          if(!f._fbq) f._fbq = n;
          n.push = n;
          n.loaded = !0;
          n.version = '2.0';
          n.queue = [];
          t = b.createElement(e);
          t.async = !0;
          t.src = v;
          s = b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        
        (window as any).fbq('init', pixelId);
      }
      
      // Sempre dispara PageView
      dispararPageView();
    }
  }, [config?.facebook_pixel_id, config?.meta_pixel_code, location.pathname]);

  // Inicializa o Pixel do TikTok
  useEffect(() => {
    if (config?.tiktok_pixel_code) {
      if (!document.head.innerHTML.includes('ttq')) {
        const template = document.createElement('template');
        template.innerHTML = config.tiktok_pixel_code.trim();
        
        Array.from(template.content.childNodes).forEach((node) => {
          if (node.nodeType === 1 && node.nodeName === 'SCRIPT') {
            const scriptElement = document.createElement('script');
            const originalScript = node as HTMLScriptElement;
            
            if (originalScript.src) {
               scriptElement.src = originalScript.src;
            }
            scriptElement.textContent = originalScript.textContent;
            
            Array.from(originalScript.attributes).forEach(attr => {
               scriptElement.setAttribute(attr.name, attr.value);
            });
            
            document.head.appendChild(scriptElement);
          } else if (node.nodeType === 1 && node.nodeName === 'NOSCRIPT') {
             if (!document.head.innerHTML.includes('noscript')) {
               document.head.appendChild(node.cloneNode(true));
             }
          }
        });
      } else {
        if (typeof (window as any).ttq === 'object' && (window as any).ttq.page) {
          (window as any).ttq.page();
        }
      }
    }
  }, [config?.tiktok_pixel_code, location.pathname]);

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

  const handleJaPaguei = () => {
    Swal.fire({
      title: 'Pagamento em Processamento',
      text: 'Os bancos podem levar até 2 minutos para confirmar o PIX. Vamos levar-te para a Consulta Pública para acompanhares em tempo real.',
      icon: 'info',
      showCancelButton: false,
      confirmButtonText: 'Ir para Consulta Pública',
      confirmButtonColor: '#00C853'
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = '/consulta'; 
      }
    });
  };

  const handleFinalizePurchase = async (leadData: { nome: string; documento: string; telefone: string; data_nascimento: string; email: string }) => {
    setLoading(true);
    trackLeadCapture(); // 🟢 Pixel: Lead capturado
    
    setError(null);
    try {
      console.log("Iniciando fluxo de contratação SaaS...", leadData);

      // 1. Cadastra o Lead
      const novoCliente = await cadastrarCliente({
        ...leadData,
        especialista_id: refCode || "SaaS_GSA_IA"
      });

      if (!novoCliente || !novoCliente.id) {
        throw new Error("O sistema não conseguiu gerar um ID para o novo cliente.");
      }
      
      // Se houver Link de Referência (refCode), registramos uma Indicação para atar o cliente antigo ao novo Lead
      if (refCode && refCode !== "SaaS_GSA_IA") {
         try {
             const { criarIndicacao } = await import('../services/marketingService');
             const { getPublicPortalConfig } = await import('../services/configService');
             const portalConfig = await getPublicPortalConfig();
             await criarIndicacao({
                cliente_origem_id: refCode,
                origem_tipo: 'CLIENTE', // Consideramos clientes na ponta repassando o link
                nome_indicado: leadData.nome,
                telefone_indicado: leadData.telefone,
                email_indicado: leadData.email,
                vendedor_id: 'SaaS_GSA_IA',
                bonus_valor: portalConfig.bonus_indicacao || 50,
                metodo_indicacao: 'VITRINE'
             });
             console.log("Indicação auto-gerada com sucesso para", refCode);
         } catch (refError) {
             console.warn("Falha silenciosa ao gerar Indicação de convite:", refError);
         }
      }

      console.log("Cliente cadastrado com sucesso. ID:", novoCliente.id);

      if (config?.modo_pagamento === 'MANUAL') {
        // MODO MANUAL: Registra a venda e redireciona para link externo
        console.log("Modo Manual detectado. Registrando venda...");
        const saleId = await registrarVendaManual(novoCliente.id, selectedPlan);
        
        // Seleciona o link correto baseado no plano
        const links = config.links_manuais || {
          dividas: 'https://link-dividas.com',
          bacen: 'https://link-bacen.com',
          rating: 'https://link-rating.com',
          master: 'https://link-master.com'
        };

        let linkFinal = links.master; // Default
        if (selectedPlan.nome === "Diagnóstico de Dívidas") linkFinal = links.dividas;
        if (selectedPlan.nome === "Diagnóstico BACEN") linkFinal = links.bacen;
        if (selectedPlan.nome === "Rating + Dívidas") linkFinal = links.rating;
        if (selectedPlan.nome === "Consultoria Premium") linkFinal = links.master;

        console.log("Preparando redirecionamento manual:", linkFinal);
        
        setManualRedirectLink(linkFinal);
        setPixData({ id: saleId, protocolo: saleId.substring(0, 8).toUpperCase() });
        setIsModalOpen(false);
        setShowPayment(true);
        return;
      }

      // 2. Gera a venda no backend (MODO AUTOMÁTICO)
      console.log("Chamando processarVenda...");

      // AUTO-FIX: Create fallback service if missing (resolves "Serviço diag_credito não encontrado")
      try {
        const { auth, db } = await import('../firebase');
        if (auth.currentUser) {
            const { doc, getDoc, setDoc } = await import('firebase/firestore');
            
            // diag_credito
            const svcRef = doc(db, 'services', 'diag_credito');
            const svcSnap = await getDoc(svcRef);
            if (!svcSnap.exists()) {
                await setDoc(svcRef, {
                    nome: 'Diagnóstico de Crédito (SaaS)',
                    nome_servico: 'Diagnóstico de Crédito (SaaS)',
                    preco_base_vendedor: 0,
                    preco_base_gestor: 0,
                    is_mass_sale_active: false,
                    modelo_id: '',
                    documentos: [],
                    campos: [],
                    descricao: 'Serviço base para a Landing Page SaaS.',
                    ativo: true
                }, { merge: true });
                console.log("Serviço diag_credito auto-criado!");
            }

            // diag_saas
            const saasRef = doc(db, 'services', 'diag_saas');
            const saasSnap = await getDoc(saasRef);
            if (!saasSnap.exists()) {
                await setDoc(saasRef, {
                    nome: 'Diagnóstico de Dívidas (SaaS)',
                    nome_servico: 'Diagnóstico de Dívidas (SaaS)',
                    preco_base_vendedor: 0,
                    preco_base_gestor: 0,
                    is_mass_sale_active: false,
                    modelo_id: '',
                    documentos: [],
                    campos: [],
                    descricao: 'Serviço base para fluxo Manual SaaS.',
                    ativo: true
                }, { merge: true });
            }
        }
      } catch (autoFixErr) {
        console.warn("Auto-fix do diag_credito falhou - ignorando:", autoFixErr);
      }

      try {
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

        // 3. Gera o pagamento no Gateway (Asaas / Mercado Pago)
        let mpResult: any;
        if (config?.gateway_ativo === 'ASAAS') {
          console.log("Chamando gerarPagamentoAsaasFront...");
          const { gerarPagamentoAsaasFront } = await import('../services/vendaService');
          mpResult = await gerarPagamentoAsaasFront({
            valor: selectedPlan.preco,
            descricao: `Plano ${selectedPlan.nome}`,
            email: leadData.email,
            nome: leadData.nome,
            cpf: leadData.documento,
            clienteId: novoCliente.id,
            vendaId: result.saleId,
            origem: 'SAAS_LANDING_PAGE'
          });
        } else {
          console.log("Chamando gerarPagamentoPixGateway (Mercado Pago)...");
          const { gerarPagamentoPixGateway } = await import('../services/vendaService');
          mpResult = await gerarPagamentoPixGateway({
            valor: selectedPlan.preco,
            descricao: `Plano ${selectedPlan.nome}`,
            email: leadData.email,
            nome: leadData.nome,
            cpf: leadData.documento,
            clienteId: novoCliente.id,
            vendaId: result.saleId,
            origem: 'SAAS_LANDING_PAGE'
          });
        }
        
        console.log("Pagamento gerado:", mpResult);

        // Armazena info da venda para o próximo passo
        const info = { 
          id: result.saleId, 
          protocolo: result.protocolo || result.saleId.substring(0, 8).toUpperCase(),
          qrcode: mpResult.qr_code_base64,
          copiaECola: mpResult.copy_paste,
          gateway: config?.gateway_ativo || 'MERCADO_PAGO'
        };
        
        setPixData(info);
        
        // 4. Sucesso: Fecha modal e mostra tela de pagamento
        setIsModalOpen(false);
        setShowPayment(true);
      } catch (backendError: any) {
        console.error("Falha na automação (Cloud Functions).", backendError);
        
        // Se o modo for expressamente AUTOMÁTICO, não faz fallback silencioso, exibe o erro
        if (config?.modo_pagamento === 'AUTOMATICO') {
          throw backendError;
        }

        console.log("Fallback para manual...");
        const saleId = await registrarVendaManual(novoCliente.id, selectedPlan);
        const links = config?.links_manuais || {
          dividas: 'https://link-dividas.com',
          bacen: 'https://link-bacen.com',
          rating: 'https://link-rating.com',
          master: 'https://link-master.com'
        };

        let linkFinal = links.master;
        if (selectedPlan.nome === "Diagnóstico de Dívidas") linkFinal = links.dividas;
        if (selectedPlan.nome === "Diagnóstico BACEN") linkFinal = links.bacen;
        if (selectedPlan.nome === "Rating + Dívidas") linkFinal = links.rating;
        if (selectedPlan.nome === "Consultoria Premium") linkFinal = links.master;

        setManualRedirectLink(linkFinal);
        setPixData({ id: saleId, protocolo: saleId.substring(0, 8).toUpperCase() });
        setIsModalOpen(false);
        setShowPayment(true);
      }
      
    } catch (err: any) {
      console.error("Erro crítico no fluxo SaaS:", err);
      
      let errorMessage = "Erro inesperado ao processar seu pedido. Por favor, tente novamente.";
      
      if (err.message && err.message.toLowerCase() !== 'internal') {
        errorMessage = err.message;
      } else if (err.details) {
        errorMessage = typeof err.details === 'string' ? err.details : JSON.stringify(err.details);
      }
      
      const errorStr = errorMessage.toLowerCase();
      if (errorStr.includes("offline")) {
        errorMessage = "Falha na conexão com o banco de dados. Por favor, recarregue a página em alguns instantes (o banco de dados está sendo provisionado).";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (showPayment) {
    if (manualRedirectLink) {
      return (
        <div className="min-h-screen bg-[#0a0a2e] flex items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-[#161b33]/80 backdrop-blur-xl p-10 rounded-[2.5rem] border border-blue-500/50 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
            
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>

            <div className="relative z-10">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
              </div>

              <h2 className="text-3xl font-black text-white mb-6 tracking-tighter uppercase italic">
                TUDO PRONTO!
              </h2>
              
              <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl mb-6 text-left">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Seu Investimento:</p>
                <p className="text-white font-black text-lg uppercase italic tracking-tighter">
                  {selectedPlan.nome}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="size-2 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-green-500 text-[10px] font-black uppercase tracking-widest">
                    R$ {selectedPlan.preco.toFixed(2).replace('.', ',')} vira crédito imediato
                  </p>
                </div>
              </div>

              <p className="text-slate-300 text-sm mb-8 leading-relaxed font-medium">
                Clique no botão abaixo para finalizar o pagamento em nossa plataforma segura.
              </p>

              <div className="space-y-6">
                <a 
                  href={manualRedirectLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-500 transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl text-center no-underline uppercase tracking-widest"
                >
                  IR PARA O PAGAMENTO
                </a>
                
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-white/5">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Instruções</p>
                  <p className="text-slate-300 text-xs italic font-medium">
                    {config?.instrucoes_checkout || "Após o pagamento, seu diagnóstico será liberado em até 24h."}
                  </p>
                </div>

                <p className="text-slate-500 text-[9px] uppercase font-black tracking-[0.3em] opacity-50">
                  Protocolo de Registro: {pixData?.protocolo}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

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
      <div className="min-h-screen bg-[#0a0a2e] flex items-center justify-center p-6 font-sans">
        <div className="bg-[#161b33] p-10 rounded-[2.5rem] border border-green-500/30 max-w-md w-full text-center shadow-[0_0_60px_rgba(34,197,94,0.1)] relative overflow-hidden">
          
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-600/5 rounded-full blur-3xl"></div>

          {/* Header do Pagamento */}
          <div className="mb-8 relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black mb-6 border border-green-500/20 uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Aguardando Pagamento em Tempo Real
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic mb-2">Escaneie ou Copie o PIX</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              Mais de 500.000 brasileiros já realizaram este diagnóstico
            </p>
          </div>

          {/* Info de Valor e Crédito */}
          <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl mb-6 text-left">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-slate-500 uppercase">Plano Selecionado:</span>
              <span className="text-xs font-black text-white uppercase italic">{selectedPlan.nome}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-green-500 uppercase">Crédito de Volta:</span>
                <span className="text-sm font-black text-white">R$ {selectedPlan.preco.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] font-black text-amber-500 uppercase">Pontos GSA:</span>
                <span className="text-sm font-black text-white">+{Math.floor(selectedPlan.preco * 10)} PTS</span>
              </div>
            </div>
          </div>

          {/* QR Code Real */}
          <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-inner">
            {pixData?.qrcode ? (
              <img 
                src={pixData.qrcode.startsWith('data:image') ? pixData.qrcode : `data:image/png;base64,${pixData.qrcode}`}
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
            onClick={handleJaPaguei}
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
    <div className="bg-[#0f172a] text-white min-h-screen font-sans selection:bg-green-500/30 overflow-x-hidden">
      
      {/* Botão de Acesso Restrito (Premium Floating) */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[120]">
        <motion.button 
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.preventDefault();
            navigate('/login');
          }}
          disabled={isRedirecting}
          className="group flex items-center gap-2 bg-[#0a0a2e]/80 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-blue-500/20 transition-all cursor-pointer relative overflow-hidden disabled:opacity-70"
        >
          {/* Inner Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="size-6 sm:size-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:rotate-12 transition-transform">
            {isRedirecting ? (
              <div className="size-3 sm:size-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
            ) : (
              <User className="size-3 sm:size-4" />
            )}
          </div>
          
          <div className="text-left hidden sm:block">
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">
              {isRedirecting ? 'Redirecionando...' : 'Acesso Restrito'}
            </p>
            <p className="text-[10px] font-black text-white uppercase italic tracking-tight leading-none">Área do Cliente</p>
          </div>
          <span className="text-[10px] font-black text-white uppercase italic tracking-tight sm:hidden">
            {isRedirecting ? '...' : 'Entrar'}
          </span>
          
          {!isRedirecting && <ChevronRight className="size-3 sm:size-4 text-white/30 group-hover:translate-x-1 transition-transform ml-1 sm:ml-2" />}
        </motion.button>
      </div>

      {/* HERO SECTION */}
      <section className="relative pt-24 pb-20 px-6">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent opacity-50"></div>

        <div className="max-w-5xl mx-auto text-center space-y-12">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-6 py-2 bg-slate-900/50 backdrop-blur-md rounded-full border border-white/10 shadow-lg"
          >
            <div className="size-2 bg-green-500 rounded-full animate-ping"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
              Tecnologia GSA-IA Ativada
            </span>
          </motion.div>

          {/* Heading */}
          <div className="space-y-6">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] text-white"
            >
              DESCUBRA O QUE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">BLOQUEIA SEU CRÉDITO</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-xl text-slate-400 max-w-2xl mx-auto font-medium"
            >
              Nossa IA revela o que o sistema esconde de você. Descubra como ser aprovado rapidamente.
            </motion.p>
          </div>

          {/* VSL Section */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="max-w-4xl mx-auto aspect-video bg-slate-900 rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative group"
          >
            {config?.vsl_youtube_id ? (
              <iframe
                src={`https://www.youtube.com/embed/${(() => {
                  const id = config.vsl_youtube_id;
                  const match = id.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                  return match ? match[1] : id;
                })()}?autoplay=0&rel=0`}
                title="VSL GSA Diagnóstico"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full relative cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 opacity-60"></div>
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <motion.div 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="size-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.4)] group-hover:bg-green-400 transition-all"
                  >
                    <PlayCircle className="text-slate-900 size-10 fill-slate-900/20" />
                  </motion.div>
                </div>
                <img 
                  src="https://picsum.photos/seed/vsl-finance/1920/1080?blur=2" 
                  className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700"
                  alt="VSL Preview"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </motion.div>

          {/* Call to Action Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <button 
              onClick={() => document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' })}
              className="group bg-gradient-to-r from-green-500 to-emerald-600 text-slate-950 px-10 py-5 rounded-2xl font-black uppercase text-lg tracking-widest hover:scale-105 transition-all flex items-center gap-3 mx-auto shadow-[0_20px_40px_-10px_rgba(34,197,94,0.3)]"
            >
              Quero meu diagnóstico agora 
              <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* QUEBRA DE CRENÇA */}
      <section className="py-10 bg-slate-900/50 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-green-500/20 to-transparent"></div>
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-500/20 to-transparent"></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative z-10">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">
            O QUE <span className="text-green-500">REALMENTE</span> TE IMPEDE?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                text: "Não é só “nome sujo”", 
                subtext: "O problema pode estar em algoritmos de risco ocultos que você nem imagina.",
                icon: ShieldX 
              },
              { 
                text: "Não é só “score baixo”", 
                subtext: "Score é apenas o reflexo, não a causa da sua negativa bancária.",
                icon: TrendingDown 
              },
              { 
                text: "Não é só “falta de limite”", 
                subtext: "O sistema pode estar bloqueando você preventivamente por dados desencontrados.",
                icon: ThumbsDown 
              }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -8, scale: 1.02 }}
                className="relative group bg-gradient-to-b from-slate-800/60 to-slate-950/80 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-6 shadow-2xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="relative z-10">
                  <item.icon className="size-24 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                </div>

                <div className="text-center relative z-10 space-y-2">
                  <p className="text-xl font-black uppercase tracking-tighter text-white leading-tight">
                    {item.text}
                  </p>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    {item.subtext}
                  </p>
                </div>
                
                <div className="w-12 h-1 bg-green-500/30 rounded-full group-hover:w-20 transition-all duration-500"></div>
              </motion.div>
            ))}
          </div>

          <div className="inline-flex items-center gap-4 px-8 py-6 bg-green-500/10 rounded-[2rem] border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
            <Zap className="text-green-500 shrink-0" size={28} />
            <p className="text-xl md:text-2xl font-black uppercase tracking-tight text-green-500">
              Existe um sistema interno que você não vê.
            </p>
          </div>
        </div>
      </section>

      {/* ANALOGIA */}
      <section className="py-10 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-8 md:p-16 rounded-[3rem] shadow-[0_40px_100px_rgba(37,99,235,0.2)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="relative z-10 space-y-10 text-center">
            <div className="size-20 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/20">
              <Target className="text-white" size={40} />
            </div>
            <p className="text-xl md:text-4xl font-black leading-[1.2] text-white tracking-tighter uppercase">
              "Nenhum médico trata sem exame. <br />
              <span className="text-blue-200">Por que você tentaria resolver sua vida financeira no escuro?"</span>
            </p>
            <div className="w-24 h-1 bg-white/30 mx-auto rounded-full"></div>
          </div>
          <div className="absolute -right-20 -bottom-20 size-96 bg-white/10 rounded-full blur-[100px]"></div>
          <div className="absolute -left-20 -top-20 size-96 bg-blue-400/10 rounded-full blur-[100px]"></div>
        </div>
      </section>

      {/* O QUE VOCÊ RECEBE */}
      <section className="py-10 px-6 bg-slate-900/30 relative">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter">
              SUA <span className="text-green-500">RADIOGRAFIA</span> FINANCEIRA
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] sm:text-xs">Informação é poder. Veja o que entregamos:</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Dívidas (SPC/Serasa)", desc: "Relatório completo de restrições ativas e histórico detalhado de apontamentos.", icon: CheckCircle },
              { title: "BACEN (SCR)", desc: "Relacionamento bancário, prejuízos e histórico de crédito oficial do Banco Central.", icon: CheckCircle },
              { title: "Score + Rating", desc: "Sua pontuação real e como os algoritmos dos bancos te enxergam hoje.", icon: CheckCircle }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                whileHover={{ scale: 1.02 }}
                className="bg-slate-800/50 backdrop-blur-sm p-12 rounded-[3rem] border border-white/5 space-y-6 hover:border-green-500/30 transition-all shadow-2xl"
              >
                <div className="size-14 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <item.icon className="text-green-500" size={32} />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-white">{item.title}</h3>
                <p className="text-slate-400 text-base leading-relaxed font-medium">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* OFERTA IRRESISTÍVEL - O INVESTIMENTO QUE VIRA CRÉDITO */}
      <section id="ofertas" className="py-20 bg-[#0a0a2e] text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10">
          <div className="absolute top-0 left-0 w-full h-full bg-green-500/5 blur-[150px] rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6">
          
          {/* Header de Valor Real */}
          <div className="text-center mb-16 space-y-8">
            <h2 className="text-4xl md:text-9xl font-black uppercase tracking-tighter text-white leading-none">
              O INVESTIMENTO <br className="hidden md:block" />
              <span className="text-slate-400">QUE VIRA CRÉDITO</span>
            </h2>
            <p className="text-slate-400 text-lg md:text-2xl max-w-3xl mx-auto font-medium px-4 leading-relaxed">
              Não é um pagamento. É o seu primeiro passo para o crédito bancário. 100% do valor investido retorna como créditos para você usar na plataforma.
            </p>
            
            <div className="flex flex-col items-center gap-6">
              <div className="inline-flex items-center gap-4 bg-green-500/5 border border-green-500/20 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.05)]">
                <Zap className="w-6 h-6 text-green-500" />
                <p className="text-green-500 font-black text-xs md:text-base uppercase tracking-tight">
                  Todo valor pago retorna como crédito para contratar novos serviços
                </p>
              </div>

              <div className="relative bg-rose-600 border-4 border-rose-500 py-6 px-10 md:px-16 rounded-3xl w-full max-w-4xl flex items-center justify-center shadow-[0_0_50px_-10px_rgba(244,63,94,0.6)] transform transition-transform hover:scale-105 my-8 overflow-hidden group">
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-4 text-center md:text-left">
                  <div className="flex items-center justify-center relative">
                    <div className="absolute size-6 md:size-8 bg-white/30 rounded-full animate-ping"></div>
                    <div className="size-4 md:size-5 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,1)]"></div>
                  </div>
                  <p className="text-white font-black text-lg md:text-2xl lg:text-3xl tracking-[0.1em] uppercase drop-shadow-xl leading-tight">
                    Condição Promocional Expira em: <br className="md:hidden" />
                    <span className="font-mono bg-black/30 px-5 py-2 rounded-xl inline-block mt-3 md:mt-0 md:ml-4 text-white font-bold">{formatTime(timeLeft)}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Preços */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: "Diagnóstico de Dívidas",
                oldPrice: "49",
                price: "24,90",
                icon: <Search className="w-8 h-8 text-green-400" />,
                features: ["Consulta SPC / Serasa", "Restrições Ativas", "Crédito de R$ 25 de volta"],
                highlight: false
              },
              {
                name: "Diagnóstico BACEN",
                oldPrice: "89",
                price: "47",
                icon: <Landmark className="w-8 h-8 text-green-400" />,
                features: ["Diagnóstico BACEN SCR", "Relacionamento Bancário", "Restrição Interna", "Crédito de R$ 47 de volta"],
                highlight: false
              },
              {
                name: "Rating + Dívidas",
                oldPrice: "197",
                price: "97",
                icon: <TrendingUp className="w-8 h-8 text-amber-400" />,
                features: ["Score Real Bancário", "Capacidade de Pagamento", "Perfil de Risco", "Crédito de R$ 97 de volta", "Bônus: Clube de Pontos"],
                highlight: true,
                badge: "MAIS VENDIDO"
              },
              {
                name: "Consultoria Premium",
                oldPrice: "397",
                price: "297",
                icon: <Star className="w-8 h-8 text-amber-500" />,
                features: ["Tudo do Rating + Dívidas", "Consulta CADIN e Protestos", "Processos Judiciais", "Crédito de R$ 300 de volta", "Bônus: 5% OFF Vitalício"],
                highlight: false,
                premium: true
              }
            ].map((plan, index) => (
              <motion.div 
                key={index}
                whileHover={{ y: -10 }}
                className={`relative p-8 rounded-[40px] transition-all duration-500 group flex flex-col h-full ${
                  plan.highlight 
                  ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.1)]' 
                  : 'bg-white/5 border border-white/10 hover:border-green-500/30'
                } ${plan.premium ? 'border-2 border-amber-600/30' : ''}`}
              >
                {plan.badge && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-600 text-slate-900 text-[10px] font-black px-6 py-1.5 rounded-full uppercase tracking-tighter shadow-xl">
                    {plan.badge}
                  </span>
                )}

                <div className="mb-6 bg-white/5 size-14 rounded-2xl flex items-center justify-center group-hover:bg-white/10 transition-colors">
                  {plan.icon}
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-4">{plan.name}</h3>
                
                <div className="mb-8">
                  <span className="text-slate-500 line-through text-xs font-bold opacity-50 block mb-1">DE R$ {plan.oldPrice}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-green-500">R$</span>
                    <span className="text-4xl font-black text-green-500">{plan.price.split(',')[0]}</span>
                    {plan.price.includes(',') && <span className="text-xl font-black text-green-500">,{plan.price.split(',')[1]}</span>}
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest ml-2">/ único</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-400 font-medium">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => handleContratar(plan.name, parseFloat(plan.price.replace(',', '.')))}
                  className={`w-full py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl ${
                    plan.highlight 
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-600 text-slate-950 hover:scale-105 active:scale-95' 
                    : 'bg-green-500 text-slate-900 hover:bg-green-400 hover:scale-105 active:scale-95'
                  }`}
                >
                  ATIVAR MEUS CRÉDITOS
                </button>
              </motion.div>
            ))}
          </div>

          {/* Rodapé de Confiança */}
          <div className="mt-20 flex flex-col md:flex-row items-center justify-center gap-16 border-t border-white/5 pt-20">
            <div className="flex flex-col items-center gap-6">
              <div className="flex -space-x-6">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-16 h-16 rounded-full border-4 border-[#0a0a2e] bg-slate-800 overflow-hidden shadow-2xl transform hover:scale-110 transition-transform">
                    <img src={`https://i.pravatar.cc/100?img=${i+20}`} alt="User" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg text-slate-400 font-bold tracking-tight">
                  <span className="text-white font-black">+500.000</span> brasileiros já retomaram o controle.
                </p>
                <div className="flex justify-center gap-1.5">
                  {[1,2,3,4,5].map(i => <Star key={i} size={14} className="text-yellow-500 fill-yellow-500" />)}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-6 bg-white/5 p-12 rounded-[3rem] border-2 border-green-500/30 min-w-[340px] shadow-[0_0_50px_rgba(34,197,94,0.1)] group hover:border-green-500/50 transition-all relative overflow-hidden">
              <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Shield className="w-24 h-24 text-green-500 relative z-10 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-pulse-slow" />
              </div>
              <div className="text-center relative z-10">
                <p className="text-lg font-black uppercase tracking-tighter text-white italic leading-tight">Garantia Blindada</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 mt-1">GSA Soluções do Brasil</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLUBE DE PONTOS */}
      <section className="py-24 px-6 bg-[#0a0a2e] relative overflow-hidden border-t border-white/5">
        <div className="absolute top-0 left-0 w-full h-full bg-blue-600/5 blur-[120px] rounded-full -z-10"></div>
        <div className="max-w-4xl mx-auto text-center space-y-10">
          <motion.div 
            whileHover={{ rotate: 10, scale: 1.1 }}
            className="size-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-[0_20px_50px_rgba(37,99,235,0.3)]"
          >
            <Trophy className="text-white" size={56} />
          </motion.div>
          <div className="space-y-6">
            <h2 className="text-4xl md:text-8xl font-black uppercase tracking-tighter leading-none italic">
              CLUBE DE <span className="text-blue-500">PONTOS GSA</span>
            </h2>
            <p className="text-xl md:text-4xl font-black text-white tracking-tight italic opacity-90">
              "Quanto mais você resolve… <span className="text-slate-400">mais você ganha"</span>
            </p>
          </div>
          <p className="text-slate-400 text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed font-medium">
            Cada diagnóstico e serviço contratado gera pontos que podem ser trocados por prêmios, descontos agressivos e consultorias exclusivas com nossos especialistas.
          </p>
          <div className="pt-8">
            <div className="inline-flex items-center gap-3 px-8 py-4 bg-blue-500/5 rounded-full border border-blue-500/20 shadow-xl">
              <Star className="text-blue-500 size-5 fill-blue-500" />
              <span className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-blue-400">Programa de Fidelidade Inteligente</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-12 px-6 text-center space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter">
            PRONTO PARA <span className="text-green-500">MUDAR SUA REALIDADE?</span>
          </h2>
          <p className="text-slate-400 text-sm md:xl font-bold uppercase tracking-widest">O primeiro passo é o diagnóstico.</p>
        </div>

        <button 
          onClick={() => document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-green-500 text-slate-900 px-8 py-6 sm:px-16 sm:py-8 rounded-2xl sm:rounded-[2rem] font-black uppercase text-lg sm:text-xl tracking-[0.2em] shadow-2xl shadow-green-500/30 hover:bg-green-400 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 mx-auto"
        >
          QUERO DESCOBRIR MEU DIAGNÓSTICO AGORA <ChevronRight size={32} />
        </button>

        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">
          © 2026 GSA Intelligence - Segurança Bancária Garantida
        </p>
      </section>

      {/* Modal de Captura */}
      <LeadCaptureModal 
        isOpen={isModalOpen}
        plano={selectedPlan.nome}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleFinalizePurchase}
      />

      {/* Alerta de Erro */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] w-full max-w-md px-6"
          >
            <div className="bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-white/20">
              <div className="flex items-center gap-3">
                <div className="size-8 bg-white/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <p className="text-xs font-black uppercase tracking-tight">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-white/60 hover:text-white font-black text-xs">OK</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
