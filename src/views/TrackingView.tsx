import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  FileText, 
  Cpu, 
  CheckCircle2, 
  Activity, 
  Package, 
  ArrowLeft,
  Clock,
  ShieldCheck,
  Gift,
  Trophy,
  Zap,
  Share2,
  PlusCircle,
  Star,
  ArrowRight
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { OrderProcess, StatusHistory } from '../services/orderService';
import { UserProfile } from '../services/userService';
import { getClubRewards, ClubReward } from '../services/pointsService';
import { gerarRelatorioStatus } from '../services/statusPdfService';
import { getPublicPortalConfig, PublicPortalConfig } from '../services/configService';
import { criarIndicacao } from '../services/marketingService';
import { useAuth } from '../components/AuthContext';
import { getPublicOrigin } from '../lib/urlUtils';
import Swal from 'sweetalert2';

const ClientPointsCard = ({ saldoAtual, proximoPremio }: { saldoAtual: number, proximoPremio: ClubReward }) => {
  const progresso = Math.min((saldoAtual / proximoPremio.pontos) * 100, 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-indigo-900 to-blue-900 p-6 rounded-[2.5rem] text-white shadow-xl border border-white/10"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] font-black uppercase text-blue-300 tracking-widest">O seu Saldo GSA Club</p>
          <h4 className="text-3xl font-black italic tracking-tighter">{saldoAtual} <span className="text-sm font-bold not-italic text-blue-400">PTS</span></h4>
        </div>
        <div className="bg-yellow-400/20 p-3 rounded-2xl border border-yellow-400/30">
          <Gift className="text-yellow-400 animate-bounce" size={24} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="flex items-center gap-1"><Trophy size={10} className="text-yellow-400" /> Próximo Resgate: {proximoPremio.nome}</span>
          <span className="text-blue-300">{progresso.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/5 p-0.5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progresso}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]" 
          />
        </div>
        <p className="text-[10px] text-blue-200 italic font-medium">
          {saldoAtual >= proximoPremio.pontos 
            ? "Você já pode resgatar este prêmio!" 
            : `Faltam ${proximoPremio.pontos - saldoAtual} pontos para o seu prêmio!`}
        </p>
      </div>
    </motion.div>
  );
};

interface TrackingViewProps {
  saleId: string;
  onBack?: () => void;
}

const MyReferralsList = ({ referrals }: { referrals: any[] }) => {
  if (referrals.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-12 bg-blue-400/10 rounded-2xl flex items-center justify-center">
          <Activity size={24} className="text-blue-500" />
        </div>
        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Minhas Indicações</h3>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {referrals.map((ref) => (
          <div key={ref.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white uppercase">{ref.nome_indicado}</p>
              <p className="text-[10px] text-slate-500 font-bold">{ref.telefone_indicado}</p>
            </div>
            <div className="text-right">
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                ref.status_indicacao === 'Concluído' ? 'bg-emerald-100 text-emerald-700' :
                ref.bloqueado ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {ref.status_indicacao}
              </span>
              <p className="text-[9px] text-slate-400 mt-1">
                {ref.timestamp?.toDate().toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TrackingView: React.FC<TrackingViewProps> = ({ saleId, onBack }) => {
  const { profile: currentProfile } = useAuth();
  const [processes, setProcesses] = useState<OrderProcess[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
  const [nextReward, setNextReward] = useState<ClubReward | null>(null);
  const [config, setConfig] = useState<PublicPortalConfig | null>(null);
  const [myReferrals, setMyReferrals] = useState<any[]>([]);

  const handleIndicarAmigo = async () => {
    if (!currentProfile) {
      Swal.fire('Atenção', 'Você precisa estar logado para indicar amigos.', 'warning');
      return;
    }

    const { value: formValues } = await Swal.fire({
      title: 'Indique um Amigo',
      html:
        '<input id="swal-input1" class="swal2-input" placeholder="Nome do Amigo">' +
        '<input id="swal-input2" class="swal2-input" placeholder="WhatsApp (DDD + Número)">' +
        '<input id="swal-input3" class="swal2-input" placeholder="E-mail (Opcional)">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Enviar Indicação',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      preConfirm: () => {
        const nome = (document.getElementById('swal-input1') as HTMLInputElement).value;
        const telefone = (document.getElementById('swal-input2') as HTMLInputElement).value;
        const email = (document.getElementById('swal-input3') as HTMLInputElement).value;
        if (!nome || !telefone) {
          Swal.showValidationMessage('Preencha todos os campos obrigatórios!');
          return false;
        }
        return [nome, telefone, email];
      }
    });

    if (formValues) {
      const [nome, telefone, email] = formValues;
      
      try {
        Swal.fire({
          title: 'Validando...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        const cleanPhone = telefone.replace(/\D/g, '');
        if (!cleanPhone) {
          Swal.fire('Erro', 'Telefone inválido.', 'error');
          return;
        }
        if (cleanPhone.length < 10) {
          Swal.fire('Erro', 'Telefone inválido.', 'error');
          return;
        }

        // 1. Verificar se o número está na Blacklist
        const qBlacklist = query(collection(db, 'blocked_numbers'), where('telefone', '==', cleanPhone));
        const snapBlacklist = await getDocs(qBlacklist);
        if (!snapBlacklist.empty) {
          Swal.fire('Atenção', 'Este número foi identificado como inválido ou fraudulento.', 'warning');
          return;
        }

        // 2. Verificar se já é cliente ou lead existente
        const qUsers = query(collection(db, 'usuarios'), where('telefone', '==', cleanPhone));
        const qLeads = query(collection(db, 'leads'), where('telefone', '==', cleanPhone));
        const qRefs = query(collection(db, 'referrals'), where('telefone_indicado', '==', cleanPhone));
        
        const [snapUsers, snapLeads, snapRefs] = await Promise.all([
          getDocs(qUsers), 
          getDocs(qLeads),
          getDocs(qRefs)
        ]);

        if (!snapUsers.empty || !snapLeads.empty || !snapRefs.empty) {
          Swal.fire('Ops!', 'Este amigo já está em nossa base de dados.', 'info');
          return;
        }

        // 3. Criar a Indicação
        await criarIndicacao({
          cliente_origem_id: currentProfile.uid,
          origem_tipo: 'CLIENTE',
          nome_indicado: nome,
          telefone_indicado: cleanPhone,
          email_indicado: email,
          vendedor_id: clientProfile?.vendedor_id || 'SISTEMA',
          metodo_indicacao: 'MANUAL'
        });

        Swal.fire({
          title: 'Gratidão!',
          text: `Sua indicação de ${nome} foi registrada com sucesso. Agradecemos imensamente pela confiança! Você ganhará pontos assim que ele fechar o primeiro serviço.`,
          icon: 'success',
          confirmButtonColor: '#2563eb'
        });
      } catch (error: any) {
        console.error("Erro ao indicar amigo:", error);
        Swal.fire('Erro', 'Não foi possível enviar a indicação. Tente novamente.', 'error');
      }
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      const c = await getPublicPortalConfig();
      setConfig(c);
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!saleId) return;

    const qProcesses = query(collection(db, 'order_processes'), where('venda_id', '==', saleId));
    const unsubscribeProcesses = onSnapshot(qProcesses, async (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderProcess));
      setProcesses(docs);
      
      if (docs.length > 0 && docs[0].cliente_id) {
        // Fetch client points
        const clientRef = doc(db, 'usuarios', docs[0].cliente_id);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
          setClientProfile(clientSnap.data() as UserProfile);
        }

        // Fetch rewards to find the next one
        const rewards = await getClubRewards();
        if (rewards.length > 0) {
          const sortedRewards = rewards.sort((a: any, b: any) => a.pontos - b.pontos);
          const currentPoints = (clientSnap.data() as any).saldo_pontos || 0;
          const next = sortedRewards.find((r: any) => r.pontos > currentPoints) || sortedRewards[sortedRewards.length - 1];
          setNextReward(next);
        }
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'order_processes');
    });

    const qHistory = query(collection(db, 'status_history'), orderBy('timestamp', 'desc'));
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StatusHistory)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'status_history');
    });

    return () => {
      unsubscribeProcesses();
      unsubscribeHistory();
    };
  }, [saleId]);

  useEffect(() => {
    if (!currentProfile?.uid) return;
    
    const q = query(
      collection(db, 'referrals'),
      where('cliente_origem_id', '==', currentProfile.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyReferrals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'referrals');
    });

    return () => unsubscribe();
  }, [currentProfile?.uid]);

  const getProgress = (status: string) => {
    switch (status) {
      case 'Pendente': return 10;
      case 'Aguardando Aprovação': return 15;
      case 'Em Análise': return 30;
      case 'Em Andamento': return 60;
      case 'Aguardando Documentação': return 80;
      case 'Concluído': return 100;
      default: return 0;
    }
  };

  const processSteps = [
    { id: 'analise', label: 'Análise', icon: Search },
    { id: 'documentacao', label: 'Documentos', icon: FileText },
    { id: 'execucao', label: 'Execução', icon: Cpu },
    { id: 'concluido', label: 'Conclusão', icon: CheckCircle2 }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-8 animate-fade-in">
        {/* Header de Boas-Vindas (Tapete Vermelho) */}
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-12 border border-slate-100 dark:border-slate-800 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Star className="size-[80px] sm:size-[120px]" />
          </div>
          
          <div className="size-24 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="text-yellow-500 animate-pulse size-10 sm:size-12" />
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">
            Seja Bem-Vindo ao <span className="text-blue-600">Tapete Vermelho!</span>
          </h1>
          
          <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">
            Ainda não tem um processo ativo? Não se preocupe! Você já faz parte da nossa comunidade. 
            Aproveite para conhecer os nossos serviços ou ganhar prémios indicando amigos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link 
              to="/vendas" 
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              Ver Nossos Serviços <ArrowRight size={16} />
            </Link>
            {onBack && (
              <button 
                onClick={onBack}
                className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                Voltar ao Início
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card de Indicação */}
          <div className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="size-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <Share2 size={24} />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Indique e Ganhe</h3>
              </div>
              
              <p className="text-indigo-100 text-sm leading-relaxed">
                Mesmo sem processos, você pode lucrar! Indique amigos e receba bônus direto na sua carteira por cada venda fechada.
              </p>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleIndicarAmigo}
                  className="w-full py-4 bg-white text-blue-700 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <PlusCircle size={18} /> Indicar Amigo Agora
                </button>

                <button 
                  onClick={() => {
                    const refId = currentProfile?.uid || 'convite';
                    navigator.clipboard.writeText(`${getPublicOrigin()}/portal?ref=${refId}`);
                    Swal.fire('Link Copiado!', 'Partilhe com os seus amigos e ganhe bônus.', 'success');
                  }}
                  className="w-full py-4 bg-blue-500/20 text-white border border-white/20 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  Copiar Meu Link de Indicação
                </button>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 size-48 bg-white/10 rounded-full blur-3xl"></div>
          </div>

          {/* Card de Clube de Prêmios */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="size-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center">
                <Gift size={24} className="text-yellow-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Clube de Prêmios</h3>
            </div>

            <p className="text-slate-500 text-sm leading-relaxed">
              Acumule pontos através das suas interações e troque por recompensas exclusivas na nossa loja.
            </p>

            <div className="pt-4">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seu Saldo Atual</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white italic">{currentProfile?.saldo_pontos || 0} <span className="text-xs font-bold not-italic text-slate-400">PTS</span></span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
                <div className="h-full bg-yellow-400 w-0" />
              </div>
              
              <Link 
                to="/clube-recompensas" 
                className="block w-full text-center bg-slate-50 hover:bg-yellow-50 text-slate-700 hover:text-yellow-700 py-3 rounded-xl font-bold text-xs uppercase border border-slate-200 hover:border-yellow-200 transition-all"
              >
                Ver Vitrine de Prêmios
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <MyReferralsList referrals={myReferrals} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8">
      {onBack && (
        <button onClick={onBack} className="text-slate-500 font-bold flex items-center gap-2 hover:text-slate-800 transition-colors mb-4">
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      <div className="bg-[#0a0a2e] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <ShieldCheck className="size-[140px] sm:size-[200px]" />
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="px-3 py-1 bg-blue-500/20 rounded-full border border-blue-500/30">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Acompanhamento Seguro</span>
                </div>
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tight">Status do seu Processo</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Protocolo: {processes[0].protocolo}</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Previsão Geral</p>
                <p className="text-xl font-black text-blue-400">
                  {new Date(processes[0].data_venda?.toDate().getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}
                </p>
              </div>
              {clientProfile && nextReward && (
                <ClientPointsCard 
                  saldoAtual={clientProfile.saldo_pontos || 0} 
                  proximoPremio={nextReward} 
                />
              )}
            </div>
          </div>

          <div className="space-y-12">
            {processes.map((proc) => {
              const myHistory = history
                .filter(h => h.processo_id === proc.id)
                .sort((a, b) => {
                  const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
                  const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
                  return timeB - timeA;
                });

              return (
                <div key={proc.id} className="space-y-8 border-t border-white/5 pt-8 first:border-0 first:pt-0">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase">{proc.servico_nome}</h3>
                      <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">{proc.status_atual}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-white">{getProgress(proc.status_atual)}%</span>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="relative pt-4">
                    <div className="absolute top-[27px] left-6 right-6 h-0.5 bg-white/10 rounded-full" />
                    <div 
                      className="absolute top-[27px] left-6 h-0.5 bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      style={{ width: `calc(${getProgress(proc.status_atual)}% - 48px)` }}
                    />
                    
                    <div className="relative flex justify-between">
                      {processSteps.map((step, idx) => {
                        const progress = getProgress(proc.status_atual);
                        const isCompleted = progress >= (idx + 1) * 25;
                        const isCurrent = (idx === 0 && proc.status_atual === 'Pendente') ||
                                         (idx === 0 && proc.status_atual === 'Aguardando Aprovação') ||
                                         (idx === 0 && proc.status_atual === 'Em Análise') ||
                                         (idx === 1 && proc.status_atual === 'Aguardando Documentação') ||
                                         (idx === 2 && proc.status_atual === 'Em Andamento') ||
                                         (idx === 3 && proc.status_atual === 'Concluído');

                        return (
                          <div key={step.id} className="flex flex-col items-center gap-3">
                            <div className={`size-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                              isCompleted 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                : isCurrent
                                  ? 'bg-[#0a0a2e] border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                  : 'bg-white/5 border-white/10 text-slate-600'
                            }`}>
                              <step.icon size={20} />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${
                              isCompleted || isCurrent ? 'text-white' : 'text-slate-600'
                            }`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Histórico do Processo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
                      <div className="flex items-center gap-2 text-blue-400">
                        <Clock size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Linha do Tempo</span>
                      </div>
                      <div className="space-y-4">
                        {myHistory.map((h, i) => (
                          <div key={h.id || i} className="flex gap-3 relative pb-4 last:pb-0">
                            {i < myHistory.length - 1 && (
                              <div className="absolute left-[5px] top-[14px] bottom-0 w-[1px] bg-white/10" />
                            )}
                            <div className="size-[11px] rounded-full bg-blue-500 shrink-0 mt-1 z-10 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                            <div>
                              <p className="text-xs font-bold text-white">{h.novo_status}</p>
                              <p className="text-[9px] text-slate-500">{h.timestamp?.toDate().toLocaleString('pt-BR')}</p>
                            </div>
                          </div>
                        ))}
                        {proc.data_venda && (
                          <div className="flex gap-3">
                            <div className="size-[11px] rounded-full bg-emerald-500 shrink-0 mt-1 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                            <div>
                              <p className="text-xs font-bold text-white">Venda Registrada</p>
                              <p className="text-[9px] text-slate-500">{proc.data_venda.toDate().toLocaleString('pt-BR')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-3xl p-6 border border-white/10 flex flex-col justify-center items-center text-center space-y-4">
                      <div className="size-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <Activity className="text-blue-400 size-6 sm:size-8" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Próxima Etapa</p>
                        <p className="text-sm font-bold text-white">
                          {proc.status_atual === 'Concluído' ? 'Processo Finalizado' : 'Aguardando atualização operacional'}
                        </p>
                      </div>
                      {proc.status_atual === 'Concluído' && (
                        <button className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all">
                          Baixar Documentação Final
                        </button>
                      )}
                      
                      <button 
                        onClick={async () => {
                          const { gerarRelatorioStatus } = await import('../services/statusPdfService');
                          gerarRelatorioStatus(proc, config?.whatsapp_negociacao || config?.whatsapp_suporte_geral);
                        }}
                        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 border border-white/10"
                      >
                        <FileText size={14} />
                        {proc.status_financeiro === 'VENCIDO' ? 'Baixar Notificação Extrajudicial' : 'Baixar Relatório de Status'}
                      </button>
                    </div>
                  </div>

                  {/* Oferta de Retenção (Clube de Benefícios) */}
                  {proc.status_financeiro === 'VENCIDO' && (
                    <div className="mt-8 bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Zap className="size-[80px] sm:size-[120px]" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="size-10 bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-sm">
                            <Trophy size={20} />
                          </div>
                          <h3 className="text-xl font-black uppercase italic tracking-tight">Clube de Benefícios GSA</h3>
                        </div>
                        <p className="text-white/80 text-sm mb-6 leading-relaxed italic">
                          "Sabia que você pode usar suas indicações para abater sua dívida? Cada amigo que fechar conosco gera bônus direto para você!"
                        </p>
                        <button 
                          onClick={handleIndicarAmigo}
                          className="w-full p-4 bg-white text-emerald-700 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-lg mb-3"
                        >
                          <PlusCircle size={16} /> Indicar Amigo Agora
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`Olá! Estou usando a GSA para recuperar meu crédito e recomendo. Use meu link para ganhar desconto: ${getPublicOrigin()}/portal?ref=${proc.cliente_id}`);
                            Swal.fire('Link Copiado!', 'Compartilhe com seus amigos e ganhe bônus para abater sua fatura.', 'success');
                          }}
                          className="w-full p-4 bg-emerald-500/20 text-white border border-white/20 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                        >
                          <Share2 size={16} /> Copiar Meu Link de Indicação
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <MyReferralsList referrals={myReferrals} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-center space-y-4">
        <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Precisa de Ajuda?</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Se você tiver alguma dúvida sobre o andamento do seu processo, entre em contato com nosso suporte ou acesse sua área exclusiva.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button className="px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
            Falar com Suporte
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-8 py-3 bg-[#0a0a2e] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            Acessar Área do Cliente
          </button>
        </div>
      </div>
    </div>
  );
};
