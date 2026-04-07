import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  ChevronRight, 
  Trophy,
  ShieldCheck,
  Calendar,
  Loader2
} from 'lucide-react';
import { listarProcessosCliente, OrderProcess } from '../../services/orderService';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SmartFicha } from './SmartFicha';

export const ClientProcessesView: React.FC = () => {
  const { profile } = useAuth();
  const [processos, setProcessos] = useState<OrderProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<OrderProcess | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await listarProcessosCliente(profile.uid);
        setProcessos(data);
      } catch (error) {
        console.error("Erro ao carregar processos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile?.uid]);

  const getProgressWidth = (status: string) => {
    switch (status) {
      case 'Pendente': return '15%';
      case 'Aguardando Documentação': return '30%';
      case 'Em Análise': return '50%';
      case 'Protocolado': return '70%';
      case 'Em Andamento': return '85%';
      case 'Concluído': return '100%';
      default: return '15%';
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-blue-600 animate-spin" size={40} />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando seus processos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Meus Processos</h2>
        <p className="text-slate-500 font-medium text-sm">Acompanhe em tempo real a evolução dos seus serviços contratados.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {processos.map((proc) => (
          <motion.div 
            key={proc.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedProcess(proc)}
            className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
          >
            {/* Status Indicator Bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
              (proc.status_atual as string) === 'Concluído' ? 'bg-emerald-500' : 'bg-blue-500'
            }`} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={`size-14 rounded-2xl flex items-center justify-center shadow-sm ${
                  (proc.status_atual as string) === 'Concluído' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {(proc.status_atual as string) === 'Concluído' ? <CheckCircle size={28} /> : <Clock size={28} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0a0a2e] uppercase tracking-tight leading-tight">{proc.servico_nome}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">ID: {proc.protocolo}</span>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">GSA PROCESSOS</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-8">
                <div className="text-left md:text-right">
                  <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    (proc.status_atual as string) === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    <div className={`size-1.5 rounded-full animate-pulse ${
                      (proc.status_atual as string) === 'Concluído' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`} />
                    {proc.status_atual}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center md:justify-end gap-1">
                    <Calendar size={10} />
                    {proc.data_venda?.toDate ? format(proc.data_venda.toDate(), "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Recentemente'}
                  </p>
                </div>
                <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#0a0a2e] group-hover:text-white transition-all">
                  <ChevronRight size={20} />
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex justify-between items-end">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Evolução do Serviço</p>
                <p className="text-[9px] font-black text-[#0a0a2e]">{getProgressWidth(proc.status_atual as string)}</p>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: getProgressWidth(proc.status_atual as string) }}
                  className={`h-full ${proc.status_atual === 'Concluído' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                />
              </div>

              {(proc.status_atual === 'Pendente' || proc.status_atual === 'Aguardando Documentação') && 
               ((proc.dados_faltantes && proc.dados_faltantes.length > 0) || 
                (proc.pendencias_iniciais && proc.pendencias_iniciais.length > 0)) && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProcess(proc);
                  }}
                  className="mt-4 w-full bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  <FileText size={14} /> RESOLVER PENDÊNCIAS AGORA
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {processos.length === 0 && (
          <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-sm">
            <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText size={40} className="text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-400 uppercase tracking-tight">Nenhum processo ativo</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto">Solicite um orçamento na nossa Vitrine de Serviços para começar sua jornada.</p>
            <button className="mt-8 px-8 py-3 bg-[#0a0a2e] text-white rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:scale-105 transition-all">
              Explorar Vitrine
            </button>
          </div>
        )}
      </div>

      {/* Modal de Detalhes / Parabéns (Layout 4.0) */}
      <AnimatePresence>
        {selectedProcess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] md:rounded-[3rem] shadow-2xl relative border border-slate-100"
            >
              <button 
                onClick={() => setSelectedProcess(null)}
                className="absolute top-6 right-6 size-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-[#0a0a2e] rounded-full z-10 transition-all"
              >
                <X size={24} />
              </button>

              {(selectedProcess.status_atual as string) === 'Concluído' ? (
                <div className="p-6 md:p-12 text-center space-y-6 md:space-y-8">
                  <div className="relative inline-block">
                    <div className="size-24 md:size-32 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-inner">
                      <Trophy className="size-12 md:size-16" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 size-8 md:size-10 bg-yellow-400 text-white rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="size-4 md:size-5" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-3xl md:text-5xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Sucesso!</h2>
                    <p className="text-sm md:text-lg text-slate-500 font-medium leading-relaxed">
                      O serviço <span className="text-blue-600 font-black">{selectedProcess.servico_nome}</span> foi finalizado com excelência pela nossa equipe.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <div className="bg-slate-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 text-left">
                      <ShieldCheck className="text-emerald-600 mb-2 md:mb-3 size-6 md:size-7" />
                      <h4 className="font-black text-[#0a0a2e] uppercase text-[9px] md:text-[10px] tracking-widest">Garantia Ativa</h4>
                      <p className="text-slate-500 text-[8px] md:text-[9px] font-bold uppercase mt-1">12 Meses de Cobertura</p>
                    </div>
                    <div className="bg-slate-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 text-left">
                      <Calendar className="text-blue-600 mb-2 md:mb-3 size-6 md:size-7" />
                      <h4 className="font-black text-[#0a0a2e] uppercase text-[9px] md:text-[10px] tracking-widest">Concluído em</h4>
                      <p className="text-slate-500 text-[8px] md:text-[9px] font-bold uppercase mt-1">{format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
                    </div>
                  </div>

                  {selectedProcess.anexo_conclusao_url && (
                    <a 
                      href={selectedProcess.anexo_conclusao_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-4 md:py-5 bg-[#0a0a2e] text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest hover:bg-blue-900 transition-all shadow-xl shadow-blue-900/20 group"
                    >
                      <Download className="size-5 md:size-6 group-hover:translate-y-1 transition-transform" /> 
                      Baixar Certificado
                    </a>
                  )}
                </div>
              ) : (
              <div className="p-6 md:p-12 space-y-8 md:space-y-10">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                  <div className="size-16 md:size-20 bg-blue-50 text-blue-600 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center shadow-inner shrink-0">
                    <Clock size={32} className="md:hidden" />
                    <Clock size={40} className="hidden md:block" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-[#0a0a2e] uppercase tracking-tight leading-tight">{selectedProcess.servico_nome}</h2>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest">
                        {selectedProcess.status_atual}
                      </span>
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {selectedProcess.protocolo}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="size-1.5 bg-blue-500 rounded-full" />
                    Status da Operação
                  </h4>
                  <div className="relative pl-8 md:pl-10 space-y-8 md:space-y-10 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    <div className="relative">
                      <div className="absolute -left-8 md:-left-10 top-1 size-7 md:size-8 bg-blue-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                        <CheckCircle size={12} className="md:hidden text-white" />
                        <CheckCircle size={14} className="hidden md:block text-white" />
                      </div>
                      <p className="text-sm md:text-base font-black text-[#0a0a2e] uppercase tracking-tight">Processo Iniciado</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {selectedProcess.data_venda?.toDate ? format(selectedProcess.data_venda.toDate(), "dd/MM/yyyy 'às' HH:mm") : 'Recentemente'}
                      </p>
                    </div>
                    <div className="relative">
                      <div className={`absolute -left-8 md:-left-10 top-1 size-7 md:size-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${
                        selectedProcess.status_atual !== 'Pendente' ? 'bg-blue-600' : 'bg-slate-100'
                      }`}>
                        {selectedProcess.status_atual !== 'Pendente' ? (
                          <>
                            <CheckCircle size={12} className="md:hidden text-white" />
                            <CheckCircle size={14} className="hidden md:block text-white" />
                          </>
                        ) : <div className="size-1.5 md:size-2 bg-slate-300 rounded-full" />}
                      </div>
                      <p className={`text-sm md:text-base font-black uppercase tracking-tight ${
                        selectedProcess.status_atual !== 'Pendente' ? 'text-[#0a0a2e]' : 'text-slate-300'
                      }`}>Análise Técnica em Andamento</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Nossa equipe está validando os dados</p>
                    </div>
                    <div className="relative">
                      <div className={`absolute -left-8 md:-left-10 top-1 size-7 md:size-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${
                        (selectedProcess.status_atual as string) === 'Concluído' ? 'bg-blue-600' : 'bg-slate-100'
                      }`}>
                        {(selectedProcess.status_atual as string) === 'Concluído' ? (
                          <>
                            <CheckCircle size={12} className="md:hidden text-white" />
                            <CheckCircle size={14} className="hidden md:block text-white" />
                          </>
                        ) : <div className="size-1.5 md:size-2 bg-slate-300 rounded-full" />}
                      </div>
                      <p className={`text-sm md:text-base font-black uppercase tracking-tight ${
                        (selectedProcess.status_atual as string) === 'Concluído' ? 'text-[#0a0a2e]' : 'text-slate-300'
                      }`}>Finalização e Entrega</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-blue-100 flex items-start gap-3 md:gap-4">
                  <div className="size-9 md:size-10 bg-white rounded-lg md:rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <AlertCircle className="text-blue-600 size-[18px] md:size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-black text-blue-900 uppercase tracking-tight mb-1">Nota da Operação</p>
                    <p className="text-[9px] md:text-[10px] font-bold text-blue-700/70 uppercase leading-relaxed">
                      Estamos processando sua solicitação com prioridade. Você receberá notificações automáticas via WhatsApp e E-mail a cada mudança de status.
                    </p>
                  </div>
                </div>

                  {/* Smart Ficha Integration */}
                  <div className="pt-6 border-t border-slate-100">
                    <SmartFicha 
                      processos={[selectedProcess]} 
                      clienteDados={profile} 
                      onUpdate={() => {
                        // Refresh processes
                        listarProcessosCliente(profile!.uid).then(setProcessos);
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const ShoppingBag = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
    <path d="M3 6h18"></path>
    <path d="M16 10a4 4 0 0 1-8 0"></path>
  </svg>
);
