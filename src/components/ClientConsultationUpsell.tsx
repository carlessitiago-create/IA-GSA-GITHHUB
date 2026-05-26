import React, { useState, useEffect } from 'react';
import { ShieldCheck, Car, FileSearch, ArrowRight, CheckCircle, QrCode, Copy, Check, XCircle, Download } from 'lucide-react';
import { ConsultationType } from '../types/consultation';
import { getConsultationTypes } from '../services/consultationService';
import { doc, onSnapshot } from 'firebase/firestore';
import { generateConsultationPDF } from '../utils/pdfConsultationGenerator';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export const ClientConsultationUpsell: React.FC<{ hideHeader?: boolean }> = ({ hideHeader }) => {
  const { profile } = useAuth();
  const [consultations, setConsultations] = useState<ConsultationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationType | null>(null);
  const [isProcessingPix, setIsProcessingPix] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; requestId?: string } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'processing' | 'completed' | 'error'>('pending');
  const [copied, setCopied] = useState(false);
  const [consultationResult, setConsultationResult] = useState<any>(null);
  const [searchParam, setSearchParam] = useState('');

  useEffect(() => {
    if (profile) loadClientConsultations();
  }, [profile]);

  // Listener de atualização em tempo real (Magia do Webhook)
  useEffect(() => {
    if (!pixData?.requestId) return;

    // Fica a ouvir o documento do pedido no Firestore
    const unsubscribe = onSnapshot(doc(db, 'consultation_requests', pixData.requestId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (data.status === 'paid') {
          setPaymentStatus('approved');
        } else if (data.status === 'completed') {
          setPaymentStatus('completed');
          setConsultationResult(data.result_data);
        } else if (data.status === 'api_error') {
          setPaymentStatus('error');
        }
      }
    });

    return () => unsubscribe();
  }, [pixData?.requestId]);

  const getMappedRole = () => {
    if (!profile) return 'client';
    if (profile.nivel?.startsWith('ADM')) return 'admin';
    if (profile.nivel === 'GESTOR') return 'manager';
    if (profile.nivel === 'VENDEDOR') return 'seller';
    return 'client';
  }

  useEffect(() => {
    if (paymentStatus === 'approved' && selectedConsultation && (!selectedConsultation.required_input_type || selectedConsultation.required_input_type === 'none')) {
      setPaymentStatus('processing');
      fetch('/api/consultations/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            provider: selectedConsultation.api_provider || 'default', 
            searchParam: 'none' 
        })
      })
      .then(res => {
         if (!res.ok) throw new Error();
         return res.json();
      })
      .then(async (data) => {
         const { doc, updateDoc } = await import('firebase/firestore');
         const { db } = await import('../firebase');
         await updateDoc(doc(db, 'consultation_requests', pixData!.requestId!), {
            status: 'completed',
            result_data: data.result_data || data
         });
      })
      .catch(() => setPaymentStatus('error'));
    }
  }, [paymentStatus, selectedConsultation, pixData]);

  const getPriceForRole = (consultation: ConsultationType) => {
    const role = getMappedRole();
    if (role === 'admin') return consultation.internal_cost || 0;
    if (role === 'manager') return consultation.manager_price || consultation.client_price;
    if (role === 'seller') return consultation.seller_price || consultation.client_price;
    return consultation.client_price;
  };

  const loadClientConsultations = async () => {
    setLoading(true);
    try {
      const allTypes = await getConsultationTypes();
      const role = getMappedRole();
      
      const allowedTypes = allTypes.filter(
        type => type.active && (role === 'admin' || type.visibility.includes(role))
      );
      setConsultations(allowedTypes);
    } catch (error) {
      console.error("Erro ao carregar ofertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!consultationResult || !selectedConsultation) return;
    
    const auth = (await import('../firebase')).auth;
    const user = auth.currentUser;
    const clientName = user?.displayName || user?.email || 'Cliente GSA';

    generateConsultationPDF(selectedConsultation.name, consultationResult, clientName);
  };

  const handleGeneratePix = async (consultation: ConsultationType) => {
    setSelectedConsultation(consultation);
    setIsProcessingPix(true);
    setPaymentStatus('pending');
    setPixData(null);
    
    try {
      // Usando auth.currentUser para obter o id do cliente logado. 
      // Se não houver currentUser, usamos um placeholder ou tratamos.
      const auth = (await import('../firebase')).auth;
      const user = auth.currentUser;
      if (!user) {
        alert("Precisa estar logado para gerar PIX.");
        setSelectedConsultation(null);
        setIsProcessingPix(false);
        return;
      }

      // Import Firestore methods
      const { collection, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const db = (await import('../firebase')).db;
      const requestRef = doc(collection(db, 'consultation_requests'));
      
      const priceToCharge = getPriceForRole(consultation);

      // Se for admin, o valor pode ser 0 ou custo interno. Vamos deixar criar o PIX com o valor calculado.
      // 1. Gera o PIX pelo backend (sem aceder ao Firestore lá para evitar problemas de IAM)
      const response = await fetch('/api/consultations/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionAmount: priceToCharge,
          description: `Consulta GSA: ${consultation.name}`,
          clientEmail: user.email,
          requestId: requestRef.id
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar PIX');
      }

      // 2. Guarda no Firestore com o Client SDK (onde as Security Rules validam o utilizador)
      await setDoc(requestRef, {
        id: requestRef.id,
        client_id: user.uid,
        seller_id: null,
        manager_id: null,
        consultation_type_id: consultation.id,
        amount_paid: priceToCharge,
        commissions: {
          seller_amount: consultation.client_price - (consultation.seller_price || 0),
          manager_amount: (consultation.seller_price || 0) - (consultation.manager_price || 0),
          admin_margin: (consultation.manager_price || 0) - (consultation.internal_cost || 0)
        },
        status: 'pending_payment',
        payment_id: data.payment_id,
        created_at: serverTimestamp()
      });

      setPixData({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, requestId: requestRef.id });
    } catch (err: any) {
      console.error("Erro no PIX:", err);
      alert("Erro ao processar pagamento: " + err.message);
      setSelectedConsultation(null);
    } finally {
      setIsProcessingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Define um ícone dinâmico baseado no nome ou tipo da consulta
  const getIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('veíc') || lowerName.includes('carro')) return <Car size={32} className="text-blue-600" />;
    if (lowerName.includes('crédito') || lowerName.includes('cpf')) return <FileSearch size={32} className="text-green-600" />;
    return <ShieldCheck size={32} className="text-indigo-600" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (consultations.length === 0) return null; // Não exibe nada se não houver ofertas

  return (
    <div className={`bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl p-6 shadow-sm border border-gray-200 ${hideHeader ? '' : 'mt-8'}`}>
      {!hideHeader && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" />
            Proteja seus Negócios
          </h2>
          <p className="text-gray-600 mt-1">
            Aproveite e realize consultas detalhadas de crédito ou histórico veicular diretamente na plataforma, com liberação imediata.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {consultations.map((consultation) => (
          <div key={consultation.id} className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
            <div className="p-5 flex-grow">
              <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                {getIcon(consultation.name)}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{consultation.name}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                {consultation.description}
              </p>
              
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-500 mt-0.5" />
                  <span>Resultado em tempo real</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-500 mt-0.5" />
                  <span>Documento em PDF oficial</span>
                </li>
              </ul>
            </div>
            
            <div className="p-5 bg-gray-50 border-t mt-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">Valor único</span>
                <span className="text-2xl font-black text-gray-900">
                  R$ {getPriceForRole(consultation).toFixed(2).replace('.', ',')}
                </span>
              </div>
              
              <button 
                onClick={() => handleGeneratePix(consultation)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Gerar PIX <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Simulando o Checkout PIX */}
      {selectedConsultation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center relative overflow-hidden">
            {paymentStatus === 'error' ? (
              <div className="py-8">
                <div className="mx-auto bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                  <XCircle size={40} className="text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Recebido</h3>
                <p className="text-gray-600 mb-6">Tivemos uma instabilidade na comunicação com a base de dados oficial. A sua consulta está garantida e a nossa equipa já foi notificada para libertar o documento.</p>
                <button onClick={() => setSelectedConsultation(null)} className="w-full py-3 bg-gray-200 text-gray-800 rounded-lg font-medium">Fechar</button>
              </div>
            ) : paymentStatus === 'completed' && consultationResult ? (
              <div className="py-6 text-left">
                <div className="flex items-center justify-center mb-4 gap-2 text-green-600">
                  <CheckCircle size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Consulta Liberada!</h3>
                </div>
                
                <div className="bg-gray-50 border rounded-lg p-4 mb-6 max-h-60 overflow-y-auto">
                  <h4 className="font-bold text-gray-700 mb-3 border-b pb-2">Resultado Oficial</h4>
                  
                  {/* Loop simples para exibir qualquer JSON que a API retornar */}
                  <ul className="space-y-2 text-sm">
                    {Object.entries(consultationResult).map(([key, value]) => (
                      <li key={key} className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-100 pb-1">
                        <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-semibold text-gray-900">{String(value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleDownloadPDF} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2">
                    <Download size={20} />
                    Baixar PDF
                  </button>
                  <button onClick={() => setSelectedConsultation(null)} className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition">
                    Fechar
                  </button>
                </div>
              </div>
            ) : paymentStatus === 'approved' ? (
              <div className="py-6 text-left">
                <div className="flex items-center justify-center mb-6 gap-2 text-green-600">
                  <CheckCircle size={28} />
                  <h3 className="text-xl font-bold text-gray-900">Pagamento Confirmado!</h3>
                </div>
                
                {selectedConsultation.required_input_type && selectedConsultation.required_input_type !== 'none' ? (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                       Por favor, insira o dado para a consulta:
                    </label>
                    <input 
                      type="text" 
                      value={searchParam}
                      onChange={(e) => setSearchParam(e.target.value)}
                      placeholder={`Digite o ${selectedConsultation.required_input_type.toUpperCase()}...`}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button 
                      onClick={async () => {
                        setPaymentStatus('processing');
                        try {
                          const res = await fetch('/api/consultations/execute', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              provider: selectedConsultation.api_provider || 'default', 
                              searchParam 
                            })
                          });
                          if (!res.ok) throw new Error('Erro ao processar a consulta');
                          const data = await res.json();
                          
                          // Import Firestore dynamically
                          const { doc, updateDoc } = await import('firebase/firestore');
                          const { db } = await import('../firebase');
                          
                          // Update Firestore document with the result
                          await updateDoc(doc(db, 'consultation_requests', pixData!.requestId!), {
                            status: 'completed',
                            result_data: data.result_data || data
                          });
                        } catch (e) {
                          setPaymentStatus('error');
                        }
                      }}
                      className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                      disabled={!searchParam.trim()}
                    >
                      Executar Consulta
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4 mx-auto"></div>
                    <p className="text-gray-600">A processar o laudo junto aos órgãos oficiais...</p>
                  </div>
                )}
              </div>
            ) : paymentStatus === 'processing' ? (
              <div className="py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4 mx-auto"></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Processando...</h3>
                <p className="text-gray-600">Conectando aos órgãos oficiais, por favor aguarde.</p>
              </div>
            ) : isProcessingPix ? (
              <div className="py-12 flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900">Conectando ao Mercado Pago...</h3>
                <p className="text-gray-500 text-sm mt-2">Gerando sua chave PIX segura</p>
              </div>
            ) : pixData ? (
              <div className="py-4">
                <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <QrCode size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Pague via PIX</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Abra a app do seu banco e escaneie o código abaixo para liberar a <strong>{selectedConsultation.name}</strong>:
                </p>
                
                {/* Imagem do QR Code Base64 Retornada pelo MP */}
                <div className="flex justify-center mb-6">
                  {pixData?.qr_code_base64 ? (
                    <img src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="w-48 h-48 border rounded-lg shadow-sm object-contain" />
                  ) : (
                    <div className="w-48 h-48 border rounded-lg shadow-sm flex items-center justify-center bg-gray-50">
                      <span className="text-gray-400 text-sm font-medium">[QR Code Mercado Pago]</span>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded border p-2 flex items-center justify-between mb-6 gap-2">
                  <code className="text-xs text-gray-500 truncate">{pixData.qr_code ? pixData.qr_code.substring(0, 25) : '...'}...</code>
                  <button onClick={handleCopyPix} className="text-blue-600 flex items-center gap-1 text-sm font-bold hover:bg-blue-50 px-2 py-1 rounded">
                    {copied ? <Check size={16} className="text-green-600"/> : <Copy size={16} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded mb-6">
                  <div className="animate-pulse w-2 h-2 bg-amber-500 rounded-full"></div>
                  A aguardar confirmação de pagamento...
                </div>



                <button 
                  onClick={() => setSelectedConsultation(null)}
                  className="w-full py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
