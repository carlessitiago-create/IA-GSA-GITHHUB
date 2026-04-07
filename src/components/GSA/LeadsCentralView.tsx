import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  ChevronRight, 
  UserPlus, 
  Clock, 
  CheckCircle, 
  X, 
  MessageSquare, 
  DollarSign,
  UserCheck,
  AlertCircle,
  Loader2,
  ShoppingBag,
  Target,
  Trash2,
  Send
} from 'lucide-react';
import { 
  listarLeadsVitrine, 
  atualizarStatusLeadVitrine, 
  reatribuirEspecialistaLeadVitrine,
  LeadStatus,
  ShowcaseLead,
  listarTodasIndicacoes,
  listarIndicacoesRecebidas,
  listarIndicacoesEquipe,
  listarLeadsRecebidos,
  listarLeadsEquipe,
  atualizarStatusIndicacao,
  Referral,
  PropostaDetalhes,
  excluirLeadVitrine,
  excluirIndicacao
} from '../../services/marketingService';
import { listarEspecialistas, UserProfile, createSecondaryUser } from '../../services/userService';
import { adicionarABlacklist, verificarBlacklist } from '../../services/blacklistService';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const LeadsCentralView: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'leads' | 'referrals'>('leads');
  const [leads, setLeads] = useState<ShowcaseLead[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [especialistas, setEspecialistas] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalData, setProposalData] = useState<PropostaDetalhes>({
    valorAVistaDe: '',
    valorAVistaPara: '',
    valorEntrada: '',
    parcelas: '12',
    valorParcela: '',
    detalhesExtras: ''
  });

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let leadsPromise;
      let referralsPromise;

      const isAdmin = profile.nivel === 'ADM_MASTER' || profile.nivel === 'ADM_GERENTE';
      const isGestor = profile.nivel === 'GESTOR';
      const isVendedor = profile.nivel === 'VENDEDOR';

      if (isAdmin) {
        leadsPromise = listarLeadsVitrine();
        referralsPromise = listarTodasIndicacoes();
      } else if (isGestor) {
        leadsPromise = listarLeadsEquipe(profile.uid);
        referralsPromise = listarIndicacoesEquipe(profile.uid);
      } else if (isVendedor) {
        leadsPromise = listarLeadsRecebidos(profile.uid);
        referralsPromise = listarIndicacoesRecebidas(profile.uid);
      } else {
        // Fallback for other roles if any
        leadsPromise = Promise.resolve([]);
        referralsPromise = Promise.resolve([]);
      }

      const [leadsData, referralsData, usersData] = await Promise.all([
        leadsPromise,
        referralsPromise,
        listarEspecialistas()
      ]);
      setLeads(leadsData);
      setReferrals(referralsData);
      setEspecialistas(usersData);
    } catch (error) {
      console.error("Erro ao carregar Central de Leads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const handleAssign = async (vendedor: UserProfile) => {
    if (!selectedItem) return;

    try {
      if (activeTab === 'leads') {
        await reatribuirEspecialistaLeadVitrine(selectedItem.id!, vendedor.uid);
      } else {
        const { reatribuirEspecialistaIndicacao } = await import('../../services/marketingService');
        await reatribuirEspecialistaIndicacao(selectedItem.id!, vendedor.uid);
      }
      
      const { sendNotification } = await import('../../services/notificationService');
      await sendNotification({
        usuario_id: vendedor.uid,
        titulo: '⚠️ NOVO LEAD ATRIBUÍDO',
        mensagem: `O cliente ${selectedItem.cliente_nome || selectedItem.nome_indicado} quer contratar um serviço. Prossiga com o fechamento.`,
        tipo: 'NEW_LEAD'
      });

      Swal.fire('Sucesso!', `Lead atribuído ao especialista ${vendedor.nome_completo}`, 'success');
      setShowAssignModal(false);
      setSelectedItem(null);
      
      // Refresh lists
      fetchData();
    } catch (error) {
      console.error("Erro ao atribuir lead:", error);
      Swal.fire('Erro', 'Falha ao atribuir lead.', 'error');
    }
  };

  const handleDeleteItem = async (item: any) => {
    const isLead = activeTab === 'leads';
    const title = isLead ? 'Excluir Lead' : 'Excluir Indicação';
    const text = `Tem certeza que deseja excluir ${isLead ? 'o lead de' : 'a indicação de'} ${isLead ? item.cliente_nome : item.nome_indicado}? Esta ação é irreversível.`;

    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        if (isLead) {
          await excluirLeadVitrine(item.id!);
        } else {
          await excluirIndicacao(item.id!);
        }
        Swal.fire('Excluído!', 'O registro foi removido com sucesso.', 'success');
        
        // Refresh lists
        fetchData();
      } catch (error) {
        console.error("Erro ao excluir:", error);
        Swal.fire('Erro', 'Falha ao excluir o registro.', 'error');
      }
    }
  };

  const handleSendProposal = async () => {
    if (!selectedItem) return;

    try {
      await atualizarStatusLeadVitrine(
        selectedItem.id!,
        'Proposta Enviada',
        profile!.uid,
        profile!.nome_completo,
        'Proposta comercial enviada ao cliente.',
        proposalData
      );

      Swal.fire('Sucesso!', 'Proposta enviada com sucesso ao cliente.', 'success');
      setShowProposalModal(false);
      setSelectedItem(null);
      
      // Refresh lists
      fetchData();
    } catch (error) {
      console.error("Erro ao enviar proposta:", error);
      Swal.fire('Erro', 'Falha ao enviar proposta.', 'error');
    }
  };

  const handleUpdateStatus = async (item: any, novoStatus: string) => {
    const { value: mensagem } = await Swal.fire({
      title: 'Atualizar Status',
      input: 'textarea',
      inputLabel: 'Observações (opcional)',
      inputPlaceholder: 'Digite aqui...',
      showCancelButton: true
    });

    if (mensagem !== undefined) {
      try {
        if (activeTab === 'leads') {
          await atualizarStatusLeadVitrine(
            item.id!,
            novoStatus as LeadStatus,
            profile!.uid,
            profile!.nome_completo,
            mensagem
          );
        } else {
          await atualizarStatusIndicacao(item.id!, novoStatus as Referral['status_indicacao']);
        }
        Swal.fire('Atualizado!', 'Status atualizado com sucesso.', 'success');
        
        // Refresh lists
        fetchData();
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
        Swal.fire('Erro', 'Falha ao atualizar status.', 'error');
      }
    }
  };

  const handleBlacklist = async (telefone: string, nome: string) => {
    const { value: motivo } = await Swal.fire({
      title: 'Adicionar à Blacklist',
      text: `Deseja marcar o número ${telefone} (${nome}) como inválido e adicionar à lista negra?`,
      input: 'text',
      inputPlaceholder: 'Motivo (ex: Número Inexistente, Trote)',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sim, Blacklist'
    });

    if (motivo) {
      try {
        await adicionarABlacklist(telefone, motivo, profile!.uid, profile!.nome_completo);
        Swal.fire('Blacklist!', 'Número adicionado à lista negra.', 'success');
      } catch (error) {
        Swal.fire('Erro', 'Não foi possível adicionar à blacklist.', 'error');
      }
    }
  };

  const handleRegisterClient = async (item: any) => {
    const { value: formValues } = await Swal.fire({
      title: 'Cadastrar Cliente',
      html:
        `<input id="swal-input1" class="swal2-input" placeholder="Nome Completo" value="${item.cliente_nome || item.nome_indicado}">` +
        `<input id="swal-input2" class="swal2-input" placeholder="E-mail" value="${item.cliente_email || ''}">` +
        `<input id="swal-input3" class="swal2-input" placeholder="CPF/CNPJ">` +
        `<input id="swal-input4" class="swal2-input" placeholder="Telefone" value="${item.cliente_telefone || item.telefone_indicado}">`,
      focusConfirm: false,
      preConfirm: () => {
        return [
          (document.getElementById('swal-input1') as HTMLInputElement).value,
          (document.getElementById('swal-input2') as HTMLInputElement).value,
          (document.getElementById('swal-input3') as HTMLInputElement).value,
          (document.getElementById('swal-input4') as HTMLInputElement).value
        ]
      }
    });

    if (formValues) {
      const [nome, email, documento, telefone] = formValues;
      if (!nome || !email || !documento) {
        Swal.fire('Erro', 'Nome, E-mail e CPF/CNPJ são obrigatórios.', 'error');
        return;
      }

      try {
        Swal.fire({ title: 'Cadastrando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        await createSecondaryUser({
          nome_completo: nome,
          email: email,
          nivel: 'CLIENTE',
          id_superior: profile?.uid,
          vendedor_id: profile?.uid,
          telefone: telefone,
          whatsapp: telefone,
          cpf: documento,
          status_conta: 'APROVADO'
        }, profile?.nivel || 'ADM');

        Swal.fire('Sucesso!', 'Cliente cadastrado com sucesso e vinculado a você.', 'success');
      } catch (error: any) {
        Swal.fire('Erro', error.message || 'Erro ao cadastrar cliente.', 'error');
      }
    }
  };

  const filteredItems = (activeTab === 'leads' ? leads : referrals).filter(l => {
    const name = activeTab === 'leads' ? (l as ShowcaseLead).cliente_nome : (l as Referral).nome_indicado;
    const service = activeTab === 'leads' ? (l as ShowcaseLead).servico_nome : 'Indicação Direta';
    const vendor = activeTab === 'leads' ? (l as ShowcaseLead).vendedor_nome : '';
    
    const matchesSearch = 
      (name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vendor || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const status = activeTab === 'leads' ? (l as ShowcaseLead).status : (l as Referral).status_indicacao;
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-blue-600 animate-spin size-8 sm:size-10" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando Leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-10 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 md:gap-8 bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="size-10 md:size-12 bg-[#0a0a2e] rounded-xl md:rounded-[1.2rem] flex items-center justify-center shadow-xl shadow-blue-900/20">
              <Target className="size-5 md:size-6 text-white" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">
              Central de Leads
            </h2>
          </div>
          <div className="flex gap-4 pt-2">
            <button 
              onClick={() => setActiveTab('leads')}
              className={`text-xs font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === 'leads' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
            >
              Leads da Vitrine
            </button>
            <button 
              onClick={() => setActiveTab('referrals')}
              className={`text-xs font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === 'referrals' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
            >
              Indicações de Clientes
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50/50 md:bg-white p-2 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm w-full lg:w-auto">
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
            <input 
              type="text" 
              placeholder="Buscar..."
              className="w-full pl-12 pr-4 py-3 bg-transparent border-none focus:ring-0 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-[#0a0a2e] placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="hidden sm:block h-8 w-px bg-slate-100 mx-1" />
          <select 
            className="w-full sm:w-auto bg-transparent border-none focus:ring-0 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 pr-10 cursor-pointer hover:text-[#0a0a2e] transition-colors py-3 sm:py-0"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos Status</option>
            {activeTab === 'leads' ? (
              <>
                <option value="Novo">Novo</option>
                <option value="Feito Contato">Feito Contato</option>
                <option value="Aguardando Retorno">Aguardando Retorno</option>
                <option value="Proposta Enviada">Proposta Enviada</option>
                <option value="Negociação">Negociação</option>
                <option value="Venda Concluída">Venda Concluída</option>
                <option value="Recusado">Recusado</option>
                <option value="Rejeitado Cliente">Rejeitado Cliente</option>
                <option value="Perdido">Perdido</option>
              </>
            ) : (
              <>
                <option value="Enviado">Enviado</option>
                <option value="Feito Contato">Feito Contato</option>
                <option value="Aguardando Retorno">Aguardando Retorno</option>
                <option value="Retorno Positivo">Retorno Positivo</option>
                <option value="Sem Retorno">Sem Retorno</option>
                <option value="Concluído">Concluído</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        {filteredItems.map((item: any, idx) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.5 }}
            className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-8 group"
          >
            <div className="flex items-center gap-4 md:gap-6 flex-1 w-full">
              <div className="size-14 md:size-20 bg-slate-50 rounded-[1.2rem] md:rounded-[1.8rem] flex items-center justify-center text-[#0a0a2e] font-black text-xl md:text-3xl shadow-inner border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all duration-500">
                {(item.cliente_nome || item.nome_indicado || '').substring(0, 1)}
              </div>
              <div className="space-y-1 md:space-y-2">
                <div className="flex items-center gap-2 md:gap-3">
                  <h3 className="text-lg md:text-2xl font-black text-[#0a0a2e] uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                    {item.cliente_nome || item.nome_indicado}
                  </h3>
                  <div className="size-1.5 md:size-2 bg-blue-500 rounded-full animate-pulse" />
                </div>
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                    <Clock className="text-slate-400 size-3" />
                    <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      {item.timestamp?.toDate ? format(item.timestamp.toDate(), "dd MMM, HH:mm", { locale: ptBR }) : 'Agora'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    <ShoppingBag className="text-blue-500 size-3" />
                    <span className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase tracking-widest">
                      {activeTab === 'leads' ? item.servico_nome : 'Indicação Direta'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    <MessageSquare className="text-emerald-500 size-3" />
                    <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                      {item.cliente_telefone || item.telefone_indicado}
                    </span>
                  </div>
                  {item.indicado_por && (
                    <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                      <UserPlus className="text-purple-500 size-3" />
                      <span className="text-[8px] md:text-[9px] font-black text-purple-600 uppercase tracking-widest">
                        Via Link de Indicação
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-6 md:gap-12 flex-1 w-full lg:w-auto border-y lg:border-none border-slate-50 py-6 lg:py-0">
              <div className="space-y-1">
                <span className="block text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Status</span>
                <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                  (item.status || item.status_indicacao) === 'Novo' || (item.status || item.status_indicacao) === 'Enviado' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                  (item.status || item.status_indicacao) === 'Venda Concluída' || (item.status || item.status_indicacao) === 'Concluído' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  (item.status || item.status_indicacao) === 'Perdido' || (item.status || item.status_indicacao) === 'Sem Retorno' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                  'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {item.status || item.status_indicacao}
                </span>
              </div>

              <div className="space-y-1">
                <span className="block text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Especialista</span>
                <div className="flex items-center gap-2">
                  <div className="size-6 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] font-black text-[#0a0a2e]">
                    {(item.vendedor_nome || '').substring(0, 1) || '?'}
                  </div>
                  <span className="text-[10px] font-black text-[#0a0a2e] uppercase tracking-tight truncate max-w-[80px]">{item.vendedor_nome || 'Aguardando'}</span>
                </div>
              </div>

              <div className="col-span-2 lg:col-span-1 flex flex-wrap gap-2">
                {profile?.nivel?.includes('ADM') && (
                  <button 
                    onClick={() => handleUpdateStatus(item, activeTab === 'leads' ? 'Venda Concluída' : 'Concluído')}
                    className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm"
                  >
                    Concluir
                  </button>
                )}
                <button 
                  onClick={() => {
                    const statuses = activeTab === 'leads' 
                      ? ['Feito Contato', 'Aguardando Retorno', 'Qualificado', 'Proposta Enviada', 'Negociação', 'Cliente Aceitou Proposta', 'Recusado', 'Rejeitado Cliente', 'Perdido']
                      : ['Feito Contato', 'Aguardando Retorno', 'Retorno Positivo', 'Cliente Aceitou Proposta', 'Sem Retorno'];
                    
                    Swal.fire({
                      title: 'Mudar Status',
                      input: 'select',
                      inputOptions: statuses.reduce((acc: any, s) => ({ ...acc, [s]: s }), {}),
                      inputPlaceholder: 'Selecione o novo status',
                      showCancelButton: true,
                      confirmButtonColor: '#3b82f6'
                    }).then((result) => {
                      if (result.isConfirmed) {
                        handleUpdateStatus(item, result.value);
                      }
                    });
                  }}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-sm"
                >
                  Mudar Status
                </button>
                <button 
                  onClick={() => handleRegisterClient(item)}
                  className="px-3 py-2 bg-blue-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-sm"
                >
                  Cadastrar Cliente
                </button>
                {activeTab === 'leads' && (
                  <button 
                    onClick={() => {
                      setSelectedItem(item);
                      setShowProposalModal(true);
                    }}
                    className="px-3 py-2 bg-indigo-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-sm"
                  >
                    Enviar Proposta
                  </button>
                )}
                {profile?.nivel === 'ADM_MASTER' && (
                  <button 
                    onClick={() => handleDeleteItem(item)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Trash2 size={10} />
                    Excluir
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <button 
                onClick={() => {
                  setSelectedItem(item);
                  setShowAssignModal(true);
                }}
                className="flex-1 lg:flex-none px-6 py-4 bg-[#0a0a2e] text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
              >
                <UserPlus className="size-3.5" /> 
                Atribuir
              </button>
              <button 
                onClick={() => handleBlacklist(item.cliente_telefone || item.telefone_indicado, item.cliente_nome || item.nome_indicado)}
                className="size-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 border border-slate-100 transition-all shadow-sm"
                title="Blacklist"
              >
                <AlertCircle className="size-5" />
              </button>
              <button 
                onClick={() => handleUpdateStatus(item, activeTab === 'leads' ? 'Perdido' : 'Sem Retorno')}
                className="size-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 border border-slate-100 transition-all shadow-sm"
              >
                <X className="size-5" />
              </button>
            </div>
          </motion.div>
        ))}

        {filteredItems.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[3.5rem] border-2 border-dashed border-slate-100 shadow-inner">
            <div className="size-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <AlertCircle className="text-slate-200 size-8 sm:size-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-300 uppercase tracking-tighter italic">Nenhum item encontrado</h3>
            <p className="text-slate-400 text-sm mt-2 font-medium">Tente ajustar seus filtros de busca ou status.</p>
          </div>
        )}
      </div>

      {/* Modal de Atribuição (Layout 4.0) */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Atribuir Especialista</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione quem cuidará deste lead</p>
                </div>
                <button 
                  onClick={() => setShowAssignModal(false)} 
                  className="size-12 flex items-center justify-center bg-white hover:bg-slate-100 rounded-full shadow-sm border border-slate-100 transition-all"
                >
                  <X className="text-slate-400 size-5" />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3">
                {especialistas.map((esp, idx) => (
                  <motion.button 
                    key={esp.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleAssign(esp)}
                    className="w-full p-5 flex items-center justify-between bg-white hover:bg-blue-50 rounded-[1.8rem] border border-slate-100 hover:border-blue-200 transition-all group shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-14 bg-slate-50 rounded-[1.2rem] flex items-center justify-center text-blue-600 font-black text-xl shadow-inner border border-slate-100 group-hover:bg-white transition-all">
                        {(esp.nome_completo || '').substring(0, 1)}
                      </div>
                      <div className="text-left space-y-1">
                        <p className="text-base font-black text-[#0a0a2e] uppercase tracking-tight group-hover:text-blue-600 transition-colors">{esp.nome_completo}</p>
                        <div className="inline-flex px-2 py-0.5 bg-slate-100 rounded-md">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{esp.nivel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:translate-x-1 transition-all shadow-sm">
                      <ChevronRight className="size-4.5" />
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-50">
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-[#0a0a2e] transition-all"
                >
                  Cancelar Operação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Proposta */}
      <AnimatePresence>
        {showProposalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Gerar Proposta Comercial</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Defina os valores e condições para o cliente</p>
                </div>
                <button 
                  onClick={() => setShowProposalModal(false)} 
                  className="size-12 flex items-center justify-center bg-white hover:bg-slate-100 rounded-full shadow-sm border border-slate-100 transition-all"
                >
                  <X className="text-slate-400 size-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Valor de Tabela (De)</label>
                    <input 
                      type="text" 
                      placeholder="R$ 0.000,00"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={proposalData.valorAVistaDe}
                      onChange={(e) => setProposalData({...proposalData, valorAVistaDe: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Valor com Desconto (Para)</label>
                    <input 
                      type="text" 
                      placeholder="R$ 0.000,00"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={proposalData.valorAVistaPara}
                      onChange={(e) => setProposalData({...proposalData, valorAVistaPara: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Valor de Entrada</label>
                    <input 
                      type="text" 
                      placeholder="R$ 0.000,00"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={proposalData.valorEntrada}
                      onChange={(e) => setProposalData({...proposalData, valorEntrada: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Parcelas</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        value={proposalData.parcelas}
                        onChange={(e) => setProposalData({...proposalData, parcelas: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Valor Parcela</label>
                      <input 
                        type="text" 
                        placeholder="R$ 000,00"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        value={proposalData.valorParcela}
                        onChange={(e) => setProposalData({...proposalData, valorParcela: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Detalhes Extras / Observações</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all min-h-[100px]"
                    placeholder="Condições especiais, bônus, etc..."
                    value={proposalData.detalhesExtras}
                    onChange={(e) => setProposalData({...proposalData, detalhesExtras: e.target.value})}
                  />
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex gap-4">
                <button 
                  onClick={() => setShowProposalModal(false)}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-[#0a0a2e] transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSendProposal}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
                >
                  Enviar Proposta ao Cliente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
