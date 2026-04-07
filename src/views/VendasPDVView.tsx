import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ShoppingCart, User, Package, CheckCircle, Search, UserPlus, X, ShieldCheck, Loader2, CreditCard, Banknote, QrCode, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth, UserProfile } from '../components/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatDocument, formatPhone } from '../utils/validators';
import { ServiceData, validarPrecoServico } from '../services/serviceFactory';
import { ProposalGenerator } from '../components/GSA/ProposalGenerator';

interface Service {
  id: string;
  nome: string;
  preco: number;
  categoria: string;
}

export function VendasPDVView({ preSelectedService, setPreSelectedService }: { preSelectedService?: ServiceData | null, setPreSelectedService?: (service: ServiceData | null) => void }) {
  const { profile } = useAuth();
  const [services, setServices] = useState<ServiceData[]>([]);
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(preSelectedService || null);
  const [searchTermClient, setSearchTermClient] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Cliente, 2: Serviço, 3: Pagamento/Proposta
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'BOLETO' | 'CARTAO' | 'CARTEIRA'>('PIX');
  const [installments, setInstallments] = useState(1);
  const [showProposalGenerator, setShowProposalGenerator] = useState(false);

  useEffect(() => {
    if (preSelectedService) {
      setSelectedService(preSelectedService);
      setFinalPrice(preSelectedService.preco_base_vendedor || 0);
      setStep(1); // Se veio da vitrine, já tem serviço, mas ainda precisa de cliente
    }
  }, [preSelectedService]);

  useEffect(() => {
    if (selectedService) {
      setFinalPrice(selectedService.preco_base_vendedor || 0);
    }
  }, [selectedService]);

  const [isRegisteringClient, setIsRegisteringClient] = useState(false);
  const [newClient, setNewClient] = useState({
    nome_completo: '',
    cpf: '',
    email: '',
    telefone: '',
    data_nascimento: ''
  });

  const fetchClients = async () => {
    try {
      const q = query(collection(db, 'usuarios'), where('nivel', '==', 'CLIENTE'));
      const snapshot = await getDocs(q);
      const allClients = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));
      
      // Filtrar por hierarquia se não for ADM
      if (profile?.nivel === 'VENDEDOR') {
        setClients(allClients.filter(c => c.id_superior === profile.uid));
      } else if (profile?.nivel === 'GESTOR') {
        // Gestor vê seus clientes diretos e os dos seus vendedores
        // Para simplificar, vamos buscar todos os usuários para saber quem são os vendedores dele
        const usersSnap = await getDocs(collection(db, 'usuarios'));
        const myVendedoresIds = usersSnap.docs
          .filter(d => d.data().nivel === 'VENDEDOR' && d.data().id_superior === profile.uid)
          .map(d => d.id);
        
        setClients(allClients.filter(c => 
          c.id_superior === profile.uid || myVendedoresIds.includes(c.id_superior || '')
        ));
      } else {
        setClients(allClients);
      }
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    }
  };

  useEffect(() => {
    const fetchServices = async () => {
      const q = query(collection(db, 'services'), where('ativo', '==', true));
      const snapshot = await getDocs(q);
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceData)));
    };

    fetchServices();
    fetchClients();
  }, []);

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.nome_completo || !newClient.cpf || !newClient.email || !newClient.data_nascimento) {
      Swal.fire('Erro', 'Preencha os campos obrigatórios (Nome, CPF, E-mail e Data de Nascimento).', 'error');
      return;
    }

    setLoading(true);
    try {
      const qClients = query(collection(db, 'clients'), where('cpf', '==', newClient.cpf));
      const snapClients = await getDocs(qClients);
      
      const qUsers = query(collection(db, 'usuarios'), where('cpf', '==', newClient.cpf));
      const snapUsers = await getDocs(qUsers);
      
      if (!snapClients.empty || !snapUsers.empty) {
        Swal.fire('Atenção', 'Este CPF já está cadastrado no sistema.', 'warning');
        setLoading(false);
        return;
      }

      const clientData = {
        nome_completo: newClient.nome_completo,
        cpf: newClient.cpf,
        email: newClient.email,
        telefone: newClient.telefone,
        data_nascimento: newClient.data_nascimento,
        nivel: 'CLIENTE',
        status_conta: 'APROVADO',
        id_superior: profile?.uid,
        data_cadastro: serverTimestamp(),
        saldo_pontos: 0,
        tem_empresa: false
      };

      const docRef = await addDoc(collection(db, 'usuarios'), clientData);
      
      // Notifica o ADM Master e a Hierarquia
      try {
        const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
        
        // Notifica ADM
        await addDoc(collection(db, 'notifications'), {
          usuario_id: 'ADM_MASTER',
          targetRole: 'ADM_MASTER',
          title: '👤 Novo Cadastro Hierárquico',
          message: `${clientData.nome_completo} foi cadastrado por ${profile?.nome_completo} (${profile?.nivel}).`,
          tipo: 'info',
          lida: false,
          read: false,
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
          origem: 'hierarquia',
          criador_id: profile?.uid,
          criador_nome: profile?.nome_completo
        });

        // Notifica o Superior Direto (se houver e não for o próprio ADM)
        if (profile?.id_superior && profile.id_superior !== 'ADM_MASTER') {
          await addDoc(collection(db, 'notifications'), {
            usuario_id: profile.id_superior,
            title: '👥 Novo Cliente na sua Equipe',
            message: `Seu liderado ${profile.nome_completo} cadastrou um novo cliente: ${clientData.nome_completo}.`,
            tipo: 'info',
            lida: false,
            read: false,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.error("Erro ao enviar notificações de cadastro:", e);
      }
      
      Swal.fire('Sucesso', 'Cliente cadastrado com sucesso!', 'success');
      setIsRegisteringClient(false);
      setNewClient({ nome_completo: '', cpf: '', email: '', telefone: '', data_nascimento: '' });
      fetchClients();
      
      setSelectedClient({ uid: docRef.id, ...clientData } as any);
      setStep(selectedService ? 3 : 2);
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      Swal.fire('Erro', 'Não foi possível cadastrar o cliente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeSale = async (isProposal: boolean = false) => {
    if (!selectedClient || !selectedService) {
      Swal.fire('Erro', 'Selecione um cliente e um serviço para continuar.', 'error');
      return;
    }

    // Validar preço final
    const validacao = validarPrecoServico(finalPrice, selectedService, profile?.nivel || 'VENDEDOR');
    if (!validacao.valido) {
      Swal.fire('Preço Inválido', validacao.erro, 'error');
      return;
    }

    // Verificar dados críticos para acompanhamento público
    let finalCpf = selectedClient.cpf;
    let finalDob = selectedClient.data_nascimento;

    if (!isProposal && (!selectedClient.cpf || !selectedClient.data_nascimento)) {
      const { value: formValues } = await Swal.fire({
        title: 'Dados Faltantes para Acompanhamento',
        html: `
          <div class="text-left space-y-4">
            <p class="text-xs text-slate-500">O CPF e Data de Nascimento são obrigatórios para que o cliente acompanhe o processo pelo link público.</p>
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase text-slate-400 ml-1">CPF do Cliente</label>
              <input id="swal-cpf" class="swal2-input !mt-0 !w-full" placeholder="000.000.000-00" value="${selectedClient.cpf || ''}">
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase text-slate-400 ml-1">Data de Nascimento</label>
              <input id="swal-dob" class="swal2-input !mt-0 !w-full" type="date" value="${selectedClient.data_nascimento || ''}">
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Confirmar e Continuar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const cpf = (document.getElementById('swal-cpf') as HTMLInputElement).value;
          const dob = (document.getElementById('swal-dob') as HTMLInputElement).value;
          if (!cpf || !dob) {
            Swal.showValidationMessage('CPF e Data de Nascimento são obrigatórios');
            return false;
          }
          return { cpf, dob };
        }
      });

      if (formValues) {
        finalCpf = formValues.cpf;
        finalDob = formValues.dob;
        
        // Atualizar estado local corretamente sem mutação direta
        const updatedClient = { ...selectedClient, cpf: finalCpf, data_nascimento: finalDob };
        setSelectedClient(updatedClient);
        
        // Atualizar no banco em background
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'usuarios', selectedClient.uid), {
            cpf: finalCpf,
            data_nascimento: finalDob
          });
        } catch (e) {
          console.error("Erro ao atualizar dados do cliente:", e);
        }
      } else {
        return; // Cancelou
      }
    }

    setLoading(true);
    try {
      // Usar os dados mais recentes do cliente (incluindo CPF/DOB se acabaram de ser preenchidos)
      const currentClient = selectedClient; 

      let saleId = '';
      let protocolo = '';

      const isSecureMethod = paymentMethod === 'PIX' || paymentMethod === 'CARTEIRA';

      if (!isProposal && isSecureMethod) {
        // USAR SERVIÇO SEGURO (BACKEND) PARA VENDAS REAIS COM MÉTODOS SUPORTADOS
        const { processarVendaSeguraFront } = await import('../services/vendaService');
        const result = await processarVendaSeguraFront(
          currentClient.uid,
          selectedService.id,
          finalPrice,
          paymentMethod as 'PIX' | 'CARTEIRA'
        );
        saleId = result.saleId;
        protocolo = result.protocolo;
      } else {
        // PROPOSTAS OU MÉTODOS NÃO SUPORTADOS PELO BACKEND (BOLETO/CARTÃO)
        const saleData = {
          cliente_id: currentClient.uid,
          cliente_nome: currentClient.nome_completo,
          servico_id: selectedService.id,
          servico_nome: selectedService.nome_servico,
          valor_total: finalPrice,
          metodo_pagamento: paymentMethod,
          parcelas: installments,
          status_pagamento: paymentMethod === 'CARTEIRA' ? 'Pago' : 'Pendente',
          vendedor_id: profile?.uid,
          vendedor_nome: profile?.nome_completo,
          id_superior: profile?.id_superior || profile?.uid,
          timestamp: serverTimestamp(),
          data_venda: serverTimestamp(),
          protocolo: isProposal 
            ? `PROP-${Date.now().toString(36).toUpperCase()}` 
            : `GSA-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
          is_proposta: isProposal
        };

        const saleRef = await addDoc(collection(db, 'sales'), saleData);
        saleId = saleRef.id;
        protocolo = saleData.protocolo;
      }

      if (!isProposal) {
        // Buscar requisitos do serviço para definir pendências iniciais
        const { PROCESS_REQUIREMENTS } = await import('../constants/processRequirements');
        const req = PROCESS_REQUIREMENTS[selectedService.id] || { campos: [], documentos: [] };
        
        // Identificar o que já temos e o que falta
        const dadosFaltantes = req.campos.filter(campo => !currentClient[campo as keyof typeof currentClient]);
        const pendenciasIniciais = req.documentos;

        const processData = {
          venda_id: saleId,
          cliente_id: currentClient.uid,
          cliente_nome: currentClient.nome_completo,
          cliente_cpf_cnpj: finalCpf,
          data_nascimento: finalDob,
          servico_id: selectedService.id,
          servico_nome: selectedService.nome_servico,
          status_atual: (dadosFaltantes.length > 0 || pendenciasIniciais.length > 0) ? 'Aguardando Documentação' : 'Pendente',
          vendedor_id: profile?.uid,
          vendedor_nome: profile?.nome_completo,
          id_superior: profile?.id_superior || profile?.uid,
          data_venda: serverTimestamp(),
          prazo_estimado_dias: selectedService.prazo_sla_dias || 7,
          protocolo: protocolo,
          dados_faltantes: dadosFaltantes,
          pendencias_iniciais: pendenciasIniciais,
          documentos_enviados: [],
          historico_status: [{
            status: (dadosFaltantes.length > 0 || pendenciasIniciais.length > 0) ? 'Aguardando Documentação' : 'Pendente',
            data: new Date().toISOString(),
            observacao: 'Venda realizada via PDV Direto (Serviço Seguro)'
          }]
        };

        await addDoc(collection(db, 'order_processes'), processData);

        await addDoc(collection(db, 'notifications'), {
          usuario_id: 'ADM_MASTER',
          targetRole: 'ADM_MASTER',
          title: '💰 Nova Venda PDV',
          message: `${profile?.nome_completo} realizou uma venda de ${selectedService.nome_servico} para ${selectedClient.nome_completo}.`,
          tipo: 'success',
          lida: false,
          timestamp: serverTimestamp()
        });
      }

      Swal.fire({
        icon: 'success',
        title: isProposal ? 'Proposta Gerada!' : 'Venda Concluída!',
        text: isProposal 
          ? `A proposta foi gerada com sucesso para ${selectedClient.nome_completo}.`
          : `A Ordem de Serviço foi gerada com sucesso para ${selectedClient.nome_completo}.`,
        confirmButtonColor: '#0a0a2e'
      });

      setSelectedClient(null);
      setSelectedService(null);
      setPreSelectedService?.(null);
      setStep(1);
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      Swal.fire('Erro', `Não foi possível processar a venda: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    (c.nome_completo || '').toLowerCase().includes(searchTermClient.toLowerCase()) || 
    c.cpf?.includes(searchTermClient) ||
    (c.email || '').toLowerCase().includes(searchTermClient.toLowerCase())
  );

  return (
    <div className="responsive-container pb-20">
      <div className="bg-white p-4 sm:p-8 md:p-12 lg:p-16 rounded-[2rem] sm:rounded-[3rem] md:rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
          <ShoppingCart className="size-[180px] sm:size-[220px] text-[#0a0a2e]" />
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 sm:gap-10 mb-10 sm:mb-16 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="size-12 sm:size-16 bg-[#0a0a2e] rounded-2xl sm:rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl shadow-blue-900/20">
                <ShoppingCart className="size-6 sm:size-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#0a0a2e] uppercase italic tracking-tighter leading-none">
                  PDV Direto
                </h1>
                <p className="text-slate-400 text-[9px] sm:text-xs font-black uppercase tracking-widest mt-2">GSA IA Sales Engine v4.0</p>
              </div>
            </div>
            <p className="text-slate-500 text-sm sm:text-lg font-medium max-w-xl">
              Gere protocolos e ordens de serviço instantaneamente com validação criptografada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button 
              onClick={() => setShowProposalGenerator(true)}
              className="w-full sm:w-auto bg-white border-2 border-[#0a0a2e] text-[#0a0a2e] px-6 sm:px-8 py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] font-black uppercase text-[10px] sm:text-xs tracking-widest hover:bg-[#0a0a2e] hover:text-white transition-all shadow-sm flex items-center justify-center gap-3"
            >
              <FileText className="size-5 sm:size-6" />
              Gerar Proposta Personalizada
            </button>

            <div className="bg-blue-50 px-6 sm:px-8 py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] border border-blue-100 flex items-center gap-4 sm:gap-5 shadow-sm">
              <div className="size-10 sm:size-12 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                <ShieldCheck className="size-5 sm:size-6" />
              </div>
              <div>
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Ambiente Seguro</p>
                <p className="text-lg sm:text-xl font-black text-blue-700 uppercase italic leading-none">Protegido</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-12 sm:gap-16 relative z-10">
          {/* INDICADOR DE PASSOS */}
          <div className="flex items-center justify-center gap-3 sm:gap-8 mb-4">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-1.5 sm:gap-2">
                <div className={`size-7 sm:size-10 rounded-full flex items-center justify-center font-black text-[10px] sm:text-sm transition-all ${
                  step === s ? 'bg-[#0a0a2e] text-white shadow-lg' : 
                  step > s ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {step > s ? <CheckCircle className="size-3.5 sm:size-5" /> : s}
                </div>
                <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest hidden xs:block ${
                  step === s ? 'text-[#0a0a2e]' : 'text-slate-400'
                }`}>
                  {s === 1 ? 'Cliente' : s === 2 ? 'Serviço' : 'Proposta'}
                </span>
              </div>
            ))}
          </div>

          {/* PASSO 1: IDENTIFICAÇÃO DO CLIENTE */}
          {step === 1 && (
            <div className="space-y-6 sm:space-y-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4">
                <div className="flex items-center gap-4">
                  <div className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <User className="size-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-[#0a0a2e] uppercase italic tracking-tight">Identificar Cliente</h3>
                </div>
                <button 
                  onClick={() => setIsRegisteringClient(!isRegisteringClient)}
                  className={`w-full sm:w-auto px-6 sm:px-8 py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ${
                    isRegisteringClient 
                      ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100' 
                      : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'
                  }`}
                >
                  {isRegisteringClient ? <><X className="size-3.5" /> Cancelar Cadastro</> : <><UserPlus className="size-3.5" /> Novo Cliente</>}
                </button>
              </div>

              <AnimatePresence>
                {isRegisteringClient && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="overflow-hidden"
                  >
                    <form onSubmit={handleRegisterClient} className="p-4 sm:p-10 bg-slate-50/50 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 space-y-6 sm:space-y-8 mb-10 shadow-inner">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                        <div className="space-y-2">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase ml-4 sm:ml-6 tracking-widest">Nome Completo</span>
                          <input 
                            type="text" 
                            required
                            value={newClient.nome_completo}
                            onChange={e => setNewClient({...newClient, nome_completo: e.target.value})}
                            className="w-full bg-white border border-slate-100 rounded-xl sm:rounded-[1.8rem] p-3.5 sm:p-5 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300"
                            placeholder="Ex: João Silva"
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase ml-4 sm:ml-6 tracking-widest">CPF</span>
                          <input 
                            type="text" 
                            required
                            value={newClient.cpf}
                            onChange={e => setNewClient({...newClient, cpf: formatDocument(e.target.value)})}
                            className="w-full bg-white border border-slate-100 rounded-xl sm:rounded-[1.8rem] p-3.5 sm:p-5 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300"
                            placeholder="000.000.000-00"
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase ml-4 sm:ml-6 tracking-widest">E-mail</span>
                          <input 
                            type="email" 
                            required
                            value={newClient.email}
                            onChange={e => setNewClient({...newClient, email: e.target.value})}
                            className="w-full bg-white border border-slate-100 rounded-xl sm:rounded-[1.8rem] p-3.5 sm:p-5 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300"
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase ml-4 sm:ml-6 tracking-widest">WhatsApp</span>
                          <input 
                            type="tel" 
                            value={newClient.telefone}
                            onChange={e => setNewClient({...newClient, telefone: formatPhone(e.target.value)})}
                            className="w-full bg-white border border-slate-100 rounded-xl sm:rounded-[1.8rem] p-3.5 sm:p-5 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase ml-4 sm:ml-6 tracking-widest">Data de Nascimento</span>
                          <input 
                            type="date" 
                            required
                            value={newClient.data_nascimento}
                            onChange={e => setNewClient({...newClient, data_nascimento: e.target.value})}
                            className="w-full bg-white border border-slate-100 rounded-xl sm:rounded-[1.8rem] p-3.5 sm:p-5 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300"
                          />
                        </div>
                      </div>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#0a0a2e] text-white py-4 sm:py-6 rounded-xl sm:rounded-[2rem] font-black uppercase text-[10px] sm:text-xs tracking-[0.3em] shadow-2xl shadow-blue-900/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                      >
                        {loading ? 'PROCESSANDO CADASTRO...' : 'CONFIRMAR E CADASTRAR CLIENTE'}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {!isRegisteringClient && (
                <div className="space-y-6 sm:space-y-8">
                  <div className="relative">
                    <Search className="absolute left-6 sm:left-8 top-1/2 -translate-y-1/2 text-slate-300 size-5 sm:size-6" />
                    <input 
                      type="text" 
                      placeholder="Buscar por CPF, Nome ou E-mail do Cliente..." 
                      value={searchTermClient}
                      onChange={(e) => setSearchTermClient(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-[2.5rem] py-4 sm:py-6 pl-14 sm:pl-20 pr-6 sm:pr-10 text-xs sm:text-sm font-black uppercase tracking-widest text-[#0a0a2e] placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-h-[450px] overflow-y-auto pr-2 sm:pr-4 no-scrollbar pb-4">
                    {filteredClients.map(client => (
                      <motion.div 
                        key={client.uid}
                        whileHover={{ y: -5 }}
                        onClick={() => {
                          setSelectedClient(client);
                          setStep((selectedService || preSelectedService) ? 3 : 2);
                        }}
                        className={`p-6 sm:p-8 border-2 rounded-[2rem] sm:rounded-[2.5rem] flex flex-col gap-4 cursor-pointer transition-all relative overflow-hidden group ${
                          selectedClient?.uid === client.uid 
                            ? 'border-[#0a0a2e] bg-[#0a0a2e]/5 shadow-xl' 
                            : 'border-slate-50 bg-white hover:border-slate-200 hover:shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-start relative z-10">
                          <div className={`size-12 sm:size-14 rounded-xl sm:rounded-[1.2rem] flex items-center justify-center font-black text-base sm:text-lg transition-all ${
                            selectedClient?.uid === client.uid ? 'bg-[#0a0a2e] text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                          }`}>
                            {(client.nome_completo || '').substring(0, 2).toUpperCase()}
                          </div>
                          {selectedClient?.uid === client.uid && (
                            <div className="bg-[#0a0a2e] text-white p-1.5 sm:p-2 rounded-full shadow-lg">
                              <CheckCircle className="size-4 sm:size-5" />
                            </div>
                          )}
                        </div>
                        <div className="relative z-10">
                          <p className="font-black text-[#0a0a2e] uppercase italic text-sm sm:text-base leading-tight group-hover:text-blue-600 transition-colors">{client.nome_completo}</p>
                          <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">{client.cpf || 'CPF NÃO INFORMADO'}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASSO 2: SELEÇÃO DE SERVIÇO */}
          {step === 2 && (
            <div className="space-y-6 sm:space-y-8">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                  <button onClick={() => setStep(1)} className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all">
                    <ArrowLeft className="size-5" />
                  </button>
                  <div className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <Package className="size-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-[#0a0a2e] uppercase italic tracking-tight">Selecionar Serviço</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {services.map(service => (
                  <motion.div 
                    key={service.id}
                    whileHover={{ y: -5 }}
                    onClick={() => {
                      setSelectedService(service);
                      setFinalPrice(service.preco_base_vendedor);
                      setStep(3);
                    }}
                    className={`p-6 sm:p-8 border-2 rounded-[2rem] sm:rounded-[2.5rem] flex flex-col justify-between cursor-pointer transition-all relative overflow-hidden group ${
                      selectedService?.id === service.id 
                        ? 'border-[#0a0a2e] bg-[#0a0a2e]/5 shadow-xl' 
                        : 'border-slate-50 bg-white hover:border-slate-200 hover:shadow-md'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-6 sm:mb-8 relative z-10">
                      <div className={`size-12 sm:size-14 rounded-xl sm:rounded-[1.2rem] flex items-center justify-center transition-all ${
                        selectedService?.id === service.id ? 'bg-[#0a0a2e] text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                      }`}>
                        <Package className="size-6 sm:size-7" />
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] sm:text-[9px] font-black px-3 sm:px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-100">Ativo</span>
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-black text-[#0a0a2e] uppercase italic text-base sm:text-lg leading-tight group-hover:text-blue-600 transition-colors">{service.nome_servico}</h4>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">SLA ESTIMADO: {service.prazo_sla_dias} DIAS</p>
                    </div>
                    <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100 flex justify-between items-center relative z-10">
                      <span className="text-xl sm:text-2xl font-black text-[#0a0a2e] italic">R$ {service.preco_base_vendedor.toLocaleString('pt-BR')}</span>
                      {selectedService?.id === service.id && (
                        <div className="bg-[#0a0a2e] text-white p-1.5 sm:p-2 rounded-full shadow-lg">
                          <CheckCircle size={16} className="sm:size-5" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* PASSO 3: PROPOSTA E PAGAMENTO */}
          {step === 3 && selectedService && selectedClient && (
            <div className="space-y-10 sm:space-y-12">
              <div className="flex items-center gap-4 px-4">
                <button onClick={() => setStep(2)} className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all">
                  <ArrowLeft className="size-5" />
                </button>
                <div className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                  <FileText className="size-5" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#0a0a2e] uppercase italic tracking-tight">Condições da Proposta</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16">
                {/* CONFIGURAÇÃO DE PREÇO E PAGAMENTO */}
                <div className="space-y-8">
                  <div className="bg-slate-50/50 p-8 sm:p-10 rounded-[2.5rem] border border-slate-100 space-y-8">
                    <div className="space-y-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Ajustar Valor da Venda (R$)</span>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-[#0a0a2e] italic">R$</span>
                        <input 
                          type="number" 
                          value={finalPrice}
                          onChange={(e) => setFinalPrice(Number(e.target.value))}
                          className="w-full bg-white border border-slate-100 rounded-2xl p-5 pl-14 text-xl font-black italic text-[#0a0a2e] focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        />
                      </div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">
                        Mínimo Autorizado: R$ {(
                          ['ADM_MASTER', 'ADM_GERENTE', 'ADM_ANALISTA', 'GESTOR'].includes(profile?.nivel || '') 
                            ? selectedService.preco_base_gestor 
                            : selectedService.preco_base_vendedor
                        ).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Forma de Pagamento</span>
                      {/* Alerta para Métodos Manuais */}
                  {(paymentMethod === 'BOLETO' || paymentMethod === 'CARTAO') && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3"
                    >
                      <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Atenção: Método Manual</p>
                        <p className="text-[10px] text-amber-600 font-medium leading-relaxed">
                          Pagamentos via {paymentMethod} não são confirmados automaticamente. 
                          O processo ficará com status <span className="font-bold">Pendente</span> até que um administrador confirme o recebimento.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'PIX', label: 'PIX', icon: QrCode },
                          { id: 'CARTAO', label: 'Cartão', icon: CreditCard },
                          { id: 'BOLETO', label: 'Boleto', icon: Banknote },
                          { id: 'CARTEIRA', label: 'Saldo', icon: ShieldCheck },
                        ].map(m => (
                          <button 
                            key={m.id}
                            onClick={() => setPaymentMethod(m.id as any)}
                            className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                              paymentMethod === m.id 
                                ? 'border-[#0a0a2e] bg-[#0a0a2e] text-white shadow-lg' 
                                : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                            }`}
                          >
                            <m.icon size={24} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {paymentMethod === 'CARTAO' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Parcelamento</span>
                        <select 
                          value={installments}
                          onChange={(e) => setInstallments(Number(e.target.value))}
                          className="w-full bg-white border border-slate-100 rounded-2xl p-5 text-sm font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                            <option key={n} value={n}>{n}x de R$ {(finalPrice / n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* RESUMO DA PROPOSTA */}
                <div className="space-y-8">
                  <div className="bg-[#0a0a2e] p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                      <FileText size={150} />
                    </div>
                    
                    <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center">
                          <FileText size={24} className="text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black uppercase italic tracking-tighter">Resumo da Proposta</h4>
                          <p className="text-[9px] opacity-50 font-black uppercase tracking-widest">GSA IA Proposition v1.0</p>
                        </div>
                      </div>

                      <div className="space-y-6 pt-6 border-t border-white/10">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Cliente</span>
                          <span className="text-sm font-black uppercase italic">{selectedClient.nome_completo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Serviço</span>
                          <span className="text-sm font-black uppercase italic">{selectedService.nome_servico}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Pagamento</span>
                          <span className="text-sm font-black uppercase italic">{paymentMethod} {paymentMethod === 'CARTAO' ? `(${installments}x)` : ''}</span>
                        </div>
                        <div className="flex justify-between items-center pt-6 border-t border-white/10">
                          <span className="text-lg font-black uppercase italic tracking-tighter text-blue-400">Total</span>
                          <span className="text-3xl font-black italic">R$ {finalPrice.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>

                      <div className="pt-8 flex flex-col gap-4">
                        <button 
                          disabled={loading}
                          onClick={() => handleFinalizeSale(true)}
                          className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="animate-spin size-4" /> : <FileText size={18} />}
                          Apenas Gerar Proposta
                        </button>
                        <button 
                          disabled={loading}
                          onClick={() => handleFinalizeSale(false)}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="animate-spin size-4" /> : <ShieldCheck size={18} />}
                          Finalizar Venda Agora
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showProposalGenerator && (
          <ProposalGenerator onClose={() => setShowProposalGenerator(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
