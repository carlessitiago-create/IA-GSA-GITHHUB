import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  CreditCard, 
  Loader2, 
  AlertCircle,
  Package,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { processarVenda } from '../services/vendaService';
import { PagamentoModal } from '../components/GSA/PagamentoModal';

interface BulkItem {
  id: string;
  nome: string;
  documento: string;
  status: 'Pendente' | 'Validado' | 'Erro';
  error?: string;
}

export const VendaEmMassaView: React.FC = () => {
  const { profile } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isRegisteringManual, setIsRegisteringManual] = useState(false);
  const [newManualItem, setNewManualItem] = useState({ nome: '', documento: '' });
  const [batches, setBatches] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'nova' | 'historico'>('nova');

  // Fetch costs and services
  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('nome_servico', 'asc'));
    onSnapshot(q, (snapshot) => {
      const servicesData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        venda_price: profile?.nivel === 'ADM_MASTER' || profile?.nivel === 'ADM_GERENTE' ? (doc.data().preco_base_gestor || 0) :
                     profile?.nivel === 'GESTOR' ? (doc.data().preco_base_vendedor || doc.data().preco_base_gestor || 0) :
                     (doc.data().preco_base_vendedor || 0)
      }));
      setServices(servicesData);
      setLoading(false);
    });
  }, [profile]);

  // Fetch previous batches
  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'bulk_sales_batches'), 
      where('vendedor_id', '==', profile.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [profile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        const newItems: BulkItem[] = data.slice(1)
          .filter(row => row[0] || row[1])
          .map((row) => ({
            id: crypto.randomUUID(),
            nome: String(row[0] || '').trim().toUpperCase(),
            documento: String(row[1] || '').trim().replace(/[^\d]/g, ''),
            status: 'Validado'
          }));

        setItems(prev => [...prev, ...newItems]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        Swal.fire({
          title: 'Importação Concluída',
          text: `${newItems.length} itens foram adicionados à lista.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire('Erro', 'Não foi possível ler o arquivo.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleManualConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManualItem.nome || !newManualItem.documento) {
      return Swal.fire('Atenção', 'Preencha todos os campos do beneficiário.', 'warning');
    }
    
    // Validação básica de documento
    const doc = newManualItem.documento.replace(/[^\d]/g, '');
    if (doc.length !== 11 && doc.length !== 14) {
      return Swal.fire('Erro', 'CPF/CNPJ inválido (deve ter 11 ou 14 dígitos).', 'error');
    }

    setItems(prev => [{
      id: crypto.randomUUID(),
      nome: newManualItem.nome.toUpperCase(),
      documento: doc,
      status: 'Validado'
    }, ...prev]);

    setNewManualItem({ nome: '', documento: '' });
    setIsRegisteringManual(false);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const validateItems = () => {
    const validated = items.map(item => {
      if (!item.nome || item.nome.length < 3) {
        return { ...item, status: 'Erro', error: 'Nome inválido' } as BulkItem;
      }
      if (!item.documento || (item.documento.length !== 11 && item.documento.length !== 14)) {
        return { ...item, status: 'Erro', error: 'CPF/CNPJ inválido' } as BulkItem;
      }
      return { ...item, status: 'Validado', error: undefined } as BulkItem;
    });
    setItems(validated);
    return validated.every(i => i.status === 'Validado');
  };

  const handleCheckout = async () => {
    if (!selectedService) {
      return Swal.fire('Atenção', 'Selecione o serviço antes de continuar.', 'warning');
    }
    if (items.length === 0) {
      return Swal.fire('Atenção', 'Adicione pelo menos um processo à lista.', 'warning');
    }
    
    if (!validateItems()) {
      return Swal.fire('Atenção', 'Corrija os erros na lista antes de prosseguir.', 'warning');
    }

    const total = items.length * selectedService.venda_price;

    setPaymentData({
      valor: total,
      servico_nome: `ATACADO: ${items.length}x ${selectedService.nome_servico}`,
      itens_massa: items,
      servico: selectedService
    });
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (saleData: any) => {
    setIsProcessing(true);
    setShowPayment(false);
    
    try {
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      
      const protocoloBatch = `LOTE-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

      // 1. Create a Master Bulk Sale record (Batch)
      // The user wants it to stay "Aguardando ADM" after "payment" simulation?
      // "fica o registro da lista enviada, aguardando confirmação de pagamento pelo ADM"
      const batchRef = await addDoc(collection(db, 'bulk_sales_batches'), {
        vendedor_id: profile?.uid,
        vendedor_nome: profile?.nome_completo,
        valor_total: saleData.amount,
        metodo_pagamento: saleData.method,
        status_pagamento: 'Aguardando ADM', // As requested
        status_lote: 'Enviado',
        quantidade: items.length,
        servico_id: selectedService.id,
        servico_nome: selectedService.nome_servico,
        protocolo: protocoloBatch,
        timestamp: serverTimestamp(),
        data_envio: serverTimestamp(),
        itens: items // Save the items list inside the batch for record
      });

      // 2. Register individual processes (Still helpful to have them separately for tracking)
      // They will also starts as 'Aguardando Pagamento' or 'Pendente Financeiro'
      for (const item of items) {
        await addDoc(collection(db, 'order_processes'), {
          batch_id: batchRef.id,
          cliente_nome: item.nome,
          cliente_cpf_cnpj: item.documento,
          servico_id: selectedService.id,
          servico_nome: selectedService.nome_servico,
          status_atual: 'Aguardando Pagamento', // Individual items also wait
          vendedor_id: profile?.uid,
          vendedor_nome: profile?.nome_completo,
          id_superior: profile?.id_superior || profile?.uid,
          data_venda: serverTimestamp(),
          prazo_estimado_dias: selectedService.prazo_sla_dias || 7,
          protocolo: `ATAC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          tipo_emissao: 'ATACADO'
        });
      }

      Swal.fire({
        title: 'Lote Enviado!',
        text: `Protocolo: ${protocoloBatch}. Aguardando confirmação financeira do ADM.`,
        icon: 'success',
        confirmButtonColor: '#0a0a2e'
      });
      setItems([]);
      setActiveTab('historico');
    } catch (error) {
      console.error("Erro no processamento em massa:", error);
      Swal.fire('Erro', 'Ocorreu um erro ao processar a venda em massa.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 size-10" />
      </div>
    );
  }

  const totalAmount = items.length * (selectedService?.venda_price || 0);

  return (
    <div className="space-y-8 pb-24">
      {/* HEADER */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0a0a2e] p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl"
      >
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 px-4 py-1.5 rounded-full">
              <Package className="text-blue-400 size-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Venda por Atacado</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tighter leading-none">
              Emissão em <br/>
              <span className="text-blue-400">Massa.</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-6 rounded-3xl text-center">
              <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Itens na Fila</p>
              <p className="text-3xl font-black text-white">{items.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-6 rounded-3xl text-center">
              <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-1">Total Lote</p>
              <p className="text-3xl font-black text-white">R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        <TrendingUp className="absolute -right-20 -bottom-20 text-white/5 size-80 rotate-12 pointer-events-none" />
      </motion.div>

      {/* TABS */}
      <div className="flex gap-4 border-b border-slate-100 px-4">
        <button 
          onClick={() => setActiveTab('nova')}
          className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'nova' ? 'text-[#0a0a2e]' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Nova Emissão
          {activeTab === 'nova' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#0a0a2e] rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('historico')}
          className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'historico' ? 'text-[#0a0a2e]' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Histórico de Envios
          {activeTab === 'historico' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#0a0a2e] rounded-full" />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'nova' ? (
          <motion.div 
            key="nova"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* CONFIGURAÇÃO */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Package size={20} />
                  </div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight">1. Selecione o Serviço</h3>
                </div>

                <div className="space-y-4">
                  {services.map(service => (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service)}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex justify-between items-center group ${
                        selectedService?.id === service.id 
                        ? 'border-blue-600 bg-blue-50/50 shadow-lg shadow-blue-500/10' 
                        : 'border-slate-50 bg-slate-50/30 hover:border-slate-200'
                      }`}
                    >
                      <div>
                        <p className={`text-xs font-black uppercase italic tracking-tight ${selectedService?.id === service.id ? 'text-blue-700' : 'text-slate-700'}`}>
                          {service.nome_servico}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Custo: R$ {service.venda_price.toLocaleString('pt-BR')}</p>
                      </div>
                      {selectedService?.id === service.id && <CheckCircle2 className="text-blue-600 size-5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#0a0a2e] to-blue-900 p-8 rounded-[2rem] text-white shadow-xl space-y-6 relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center">
                      <Upload size={20} />
                    </div>
                    <h3 className="text-lg font-black uppercase italic">2. Importar Lista</h3>
                  </div>
                  <p className="text-xs text-blue-100/70 leading-relaxed font-medium">
                    Crie uma planilha Excel com as colunas: <br/>
                    <span className="text-white font-black italic">A: Nome/Empresa | B: CPF/CNPJ</span>
                  </p>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                  />
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-white text-blue-900 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload size={16} /> Selecionar Planilha
                  </button>
                </div>
                <FileText className="absolute -right-8 -bottom-8 size-40 text-white/5 rotate-12" />
              </div>
            </div>

            {/* LISTA DE ITENS */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col font-sans">
                <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-[#0a0a2e]">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold italic uppercase text-[#0a0a2e] tracking-tight">Lista de Processos</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Confira os dados antes de pagar</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setIsRegisteringManual(true)}
                    className="bg-[#0a0a2e] text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
                  >
                    <Plus size={14} /> Add Manual
                  </button>
                </div>

                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Beneficiário</th>
                        <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">CPF / CNPJ</th>
                        <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <AnimatePresence initial={false}>
                        {items.map((item) => (
                          <motion.tr 
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="hover:bg-slate-50/30 transition-colors group"
                          >
                            <td className="px-8 py-6">
                              <span className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight">{item.nome}</span>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-sm font-bold text-slate-600">{item.documento}</span>
                            </td>
                            <td className="px-8 py-6 text-center">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                item.status === 'Validado' ? 'bg-emerald-50 text-emerald-600' :
                                item.status === 'Erro' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {item.status === 'Erro' ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                                {item.status === 'Erro' ? item.error : 'PENDENTE'}
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button 
                                onClick={() => removeItem(item.id)}
                                className="size-8 bg-rose-50 text-rose-400 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 hover:text-white transition-all transition-opacity mx-auto"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <div className="size-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200">
                                <Search size={40} />
                              </div>
                              <p className="text-xs font-black uppercase text-slate-300 tracking-widest italic">Nenhum item na fila. <br/> Importe uma planilha ou adicione manualmente.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {items.length > 0 && (
                  <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className="text-center sm:text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtotal (Preço Unitário)</p>
                        <p className="text-xl font-black text-[#0a0a2e]">R$ {selectedService?.venda_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</p>
                      </div>
                      <div className="h-10 w-px bg-slate-200" />
                      <div className="text-center sm:text-left">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Total à Pagar</p>
                        <p className="text-2xl font-black text-blue-900 italic">R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>

                    <button 
                      onClick={handleCheckout}
                      disabled={isProcessing}
                      className="w-full sm:w-auto bg-emerald-600 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/20"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                      PAGAR E EMITIR AGORA
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="historico"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="p-8 border-b border-slate-50">
              <h3 className="text-lg font-black italic uppercase text-[#0a0a2e] tracking-tight">Histórico de Emissões em Massa</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Acompanhe seus lotes enviados</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data / Protocolo</th>
                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Itens</th>
                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Financeiro</th>
                    <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {batches.map(batch => (
                    <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-[#0a0a2e]">{batch.protocolo}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{batch.data_envio?.toDate().toLocaleString('pt-BR')}</p>
                      </td>
                      <td className="px-8 py-6 font-bold text-slate-600 text-xs uppercase">{batch.servico_nome}</td>
                      <td className="px-8 py-6 text-center font-black text-[#0a0a2e]">{batch.quantidade}</td>
                      <td className="px-8 py-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          batch.status_pagamento === 'Pago' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {batch.status_pagamento}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-[#0a0a2e]">R$ {batch.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-slate-300 italic text-sm">Nenhum lote enviado anteriormente.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CADASTRO MANUAL */}
      <AnimatePresence>
        {isRegisteringManual && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRegisteringManual(false)}
              className="absolute inset-0 bg-[#0a0a2e]/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <Plus className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-[#0a0a2e]">Cadastro Manual</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Adicionar beneficiário à lista</p>
                </div>
              </div>

              <form onSubmit={handleManualConfirm} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Nome / Nome da Empresa</label>
                  <input 
                    type="text" 
                    required
                    value={newManualItem.nome}
                    onChange={e => setNewManualItem({...newManualItem, nome: e.target.value})}
                    placeholder="Ex: João Silva ou GSA Diagnóstico"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-black uppercase italic focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">CPF / CNPJ</label>
                  <input 
                    type="text" 
                    required
                    maxLength={14}
                    value={newManualItem.documento}
                    onChange={e => setNewManualItem({...newManualItem, documento: e.target.value.replace(/[^\d]/g, '')})}
                    placeholder="Somente números"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsRegisteringManual(false)}
                    className="flex-1 bg-slate-100 text-slate-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-[#0a0a2e] text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    Confirmar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE PAGAMENTO */}
      {showPayment && paymentData && (
        <PagamentoModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
          amount={paymentData.valor}
          description={paymentData.servico_nome}
          paymentInfo={{
            vendedor_id: profile?.uid || '',
            venda_tipo: 'ATACADO',
            servico_id: paymentData.servico?.id,
            quantidade: paymentData.itens_massa.length
          }}
        />
      )}
    </div>
  );
};
