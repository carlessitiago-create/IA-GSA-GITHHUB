import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { CheckCircle, Copy, Loader2, ShieldCheck, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

export const CheckoutCreditoView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'RECEIVED' | 'OVERDUE' | null>(null);
  const [leadDataState, setLeadDataState] = useState<any>(null);
  
  const [protocolNumber] = useState(`GSA-CRED-2026-${Math.floor(10000 + Math.random() * 90000)}`);
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60 - 1); // 23:59:59

  useEffect(() => {
    if (paymentStatus === 'RECEIVED') {
      const interval = setInterval(() => {
        setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [paymentStatus]);

  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const leadId = queryParams.get('leadId');
  const type = queryParams.get('type') || 'taxa_onboarding'; // 'taxa_onboarding' or 'fee'
  const valueParam = queryParams.get('value');

  useEffect(() => {
    if (!leadId) {
      setError('Lead ID não encontrado.');
      setLoading(false);
      return;
    }

    const value = type === 'taxa_onboarding' ? 97.00 : Number(valueParam);

    const generatePix = async () => {
      try {
        const response = await fetch('/api/asaas/create-pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'Cliente Novo', // We should ideally pass real details here if possible, but Asaas requires it.
            customerCpfCnpj: '00000000000', // We might not have CPF/CNPJ yet if it's the beginning, but wait, quiz asks for CNPJ! Let's just pass some dummy if missing or fetch lead.
            value,
            description: type === 'taxa_onboarding' ? 'Taxa de Diagnóstico GSA' : 'Honorários de Consultoria GSA',
            externalReference: leadId
          })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Falha ao gerar PIX');
        
        setPaymentData(data);
        setPaymentStatus('PENDING');

        // Escuta as alterações no Firebase em tempo real
        const unsubscribe = onSnapshot(doc(db, 'leads_credito', leadId), (docSnap) => {
          if (docSnap.exists()) {
             const lead = docSnap.data();
             if (lead.dadosPagamentoAsaas?.statusPagamento === 'RECEIVED') {
                setPaymentStatus('RECEIVED');
                Swal.fire({
                  title: 'Pagamento Confirmado!',
                  text: 'Recebemos seu PIX com sucesso.',
                  icon: 'success'
                });
             }
          }
        });

        return () => unsubscribe();
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Ocorreu um erro ao gerar o pagamento.');
      } finally {
        setLoading(false);
      }
    };

    // Need to fetch lead first to get CNPJ
    const fetchLeadRef = doc(db, 'leads_credito', leadId);
    onSnapshot(fetchLeadRef, (docSnap) => {
      if (docSnap.exists()) {
        setLeadDataState(docSnap.data());
      }
    });

  }, [leadId, type, valueParam]);

  // Actual generation effect
  useEffect(() => {
     if (leadId) {
       generatePaymentAsaas();
     }
  }, [leadId]);

  const generatePaymentAsaas = async () => {
    if (!leadId) return;
    setLoading(true);
    
    // Fetch lead details first
    const { getDoc, doc } = await import('firebase/firestore');
    const leadDoc = await getDoc(doc(db, 'leads_credito', leadId));
    
    if (!leadDoc.exists()) {
       setError('Lead não encontrado.');
       setLoading(false);
       return;
    }
    
    const leadData = leadDoc.data();
    setLeadDataState(leadData);
    const cnpj = leadData.dadosEmpresa?.cnpj?.replace(/\D/g, '') || '00000000000100'; // Default valid CNPJ format
    const rs = leadData.dadosEmpresa?.razaoSocial || `Empresa ${cnpj}`;
    const value = type === 'taxa_onboarding' ? 97.00 : (leadData.financeiro?.taxaFixaEstipuladaAdmin || Number(valueParam) || 0);

    if (value <= 0) {
      setError("Valor inválido para cobrança.");
      setLoading(false);
      return;
    }

    try {
      const { gerarPagamentoAsaasFront } = await import('../services/vendaService');
      const data = await gerarPagamentoAsaasFront({
        nome: rs,
        cpf: cnpj,
        email: leadData.email || 'financeiro@empresa.com',
        valor: value,
        descricao: type === 'taxa_onboarding' ? 'Taxa de Diagnóstico GSA' : 'Honorários de Consultoria GSA',
        vendaId: leadId
      });
      
      setPaymentData({
        qr_code: data.copy_paste,
        qr_code_base64: data.qr_code_base64,
        payment_id: data.payment_id
      });
      setPaymentStatus('PENDING');

      // Escuta as alterações no Firebase em tempo real
      const unsubscribe = onSnapshot(doc(db, 'leads_credito', leadId), (docSnap) => {
        if (docSnap.exists()) {
            const lead = docSnap.data();
            if (lead.dadosPagamentoAsaas?.statusPagamento === 'RECEIVED') {
              setPaymentStatus('RECEIVED');
              Swal.fire({
                title: 'Pagamento Confirmado!',
                text: 'Recebemos seu PIX com sucesso.',
                icon: 'success'
              });
            }
        }
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao gerar o pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (paymentData?.qr_code) {
      navigator.clipboard.writeText(paymentData.qr_code);
      Swal.fire({ title: 'Copiado!', icon: 'success', timer: 1500, showConfirmButton: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium">Gerando cobrança segura via Asaas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
       <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
         <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Erro na Cobrança</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button onClick={() => navigate(-1)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2 rounded-xl transition">Voltar</button>
         </div>
       </div>
    );
  }

  if (paymentStatus === 'RECEIVED') {
     const hours = Math.floor(timeLeft / 3600);
     const minutes = Math.floor((timeLeft % 3600) / 60);
     const seconds = timeLeft % 60;
     const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

     const baseText = 'Vim do site, efetuei o pagamento de 97 para análise do meu caso de benefícios do governo';
     const restrictionText = 'Vim do site, efetuei o pagamento de 97 e quero iniciar a jornada de alinhamento e viabilidade do meu benefício';
     
     const textToUse = leadDataState?.analiseIa?.cenario === 'C' ? restrictionText : baseText;
     const whatsAppText = encodeURIComponent(textToUse);
     const whatsAppUrl = `https://api.whatsapp.com/send?phone=5554999999999&text=${whatsAppText}`;

     return (
       <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
         {/* Decorative Blurs */}
         <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

         <motion.div 
           initial={{ scale: 0.9, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="bg-slate-900/60 backdrop-blur-md p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center border border-slate-700/50 relative z-10"
         >
            <div className="bg-emerald-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
               <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>
            
            <h2 className="text-3xl font-black text-white mb-4">Pagamento Confirmado!</h2>
            <p className="text-slate-300 font-medium text-lg mb-8 leading-relaxed">
               Parabéns pelo primeiro passo para destravar o crescimento da sua empresa. Nossa equipe técnica já recebeu seus dados financeiros e fiscais.
            </p>

            <div className="bg-slate-800/80 rounded-2xl p-6 mb-8 border border-slate-700">
               <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="bg-slate-900 px-6 py-2 rounded-lg border border-slate-600">
                     <span className="text-sm text-slate-400 font-mono block mb-1">PROTOCOLO OFICIAL</span>
                     <span className="text-lg text-emerald-400 font-bold tracking-wider">{protocolNumber}</span>
                  </div>
                  
                  <div className="text-center mt-4">
                     <p className="text-sm text-slate-400 mb-2">PRAZO LIMITE DA ANÁLISE TÉCNICA:</p>
                     <div className="text-4xl font-black text-white font-mono tracking-widest">{timeString}</div>
                     <p className="text-xs text-slate-500 mt-2">A mesa de análise tem 24h para emitir o relatório de viabilidade.</p>
                  </div>
               </div>
            </div>

            <p className="text-slate-300 mb-6 text-sm">
               Clique no botão abaixo para anexar documentos complementares ou falar direto com seu especialista pelo WhatsApp.
            </p>

            <a 
               href={whatsAppUrl}
               target="_blank"
               rel="noopener noreferrer"
               className="group relative w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-5 rounded-2xl transition-all shadow-lg shadow-emerald-500/30 overflow-hidden"
            >
               {/* Pulsing effect */}
               <div className="absolute inset-0 w-full h-full bg-white/20 animate-ping opacity-0 group-hover:opacity-100 rounded-2xl"></div>
               
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c-.003 1.396.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
               </svg>
               Acionar Especialista no WhatsApp
            </a>
         </motion.div>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex justify-center">
       <div className="w-full max-w-md">
          <div className="text-center mb-8">
             <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 relative">
                <CreditCard className="w-8 h-8 text-blue-600" />
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-1 border-2 border-slate-50">
                   <ShieldCheck className="w-4 h-4 text-white" />
                </div>
             </div>
             <h1 className="text-2xl font-extrabold text-slate-900">Finalizar Contratação</h1>
             <p className="text-slate-500 mt-2">Ambiente seguro verificado. Pague via PIX para liberação instantânea.</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
             <div className="p-6 bg-slate-900 text-white text-center">
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Valor Total</h3>
                <div className="text-4xl font-black">R$ {type === 'taxa_onboarding' ? '97,00' : 'Hono.'}</div>
             </div>
             
             <div className="p-8">
                <div className="flex flex-col items-center">
                   <p className="font-semibold text-slate-800 mb-4">Escaneie o QR Code</p>
                   {paymentData?.qr_code_base64 && (
                      <div className="p-2 bg-white rounded-2xl border-2 border-slate-100 shadow-sm mb-6">
                         <img 
                           src={`data:image/jpeg;base64,${paymentData.qr_code_base64}`} 
                           alt="PIX QR Code" 
                           className="w-48 h-48"
                         />
                      </div>
                   )}

                   <div className="w-full relative flex items-center py-4">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">Ou use o Copia e Cola</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                   </div>

                   <button 
                     onClick={handleCopy}
                     className="w-full mt-2 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors group"
                   >
                     <Copy className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                     Pix Copia e Cola
                   </button>
                </div>
             </div>

             <div className="bg-blue-50 p-6 flex flex-col items-center text-center">
                <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
                   <Loader2 className="w-5 h-5 animate-spin" /> Aguardando Pagamento...
                </div>
                <p className="text-sm text-blue-600/80">
                   Esta tela atualizará automaticamente assim que o pagamento for confirmado pelo banco.
                </p>
             </div>
          </div>
       </div>
    </div>
  );
};
