import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Gift, Trophy, Users, TrendingUp, Star, Award, Share2, Target, UserPlus, Phone, ClipboardList, Mail } from 'lucide-react';
import { useAuth, UserProfile } from '../components/AuthContext';
import { criarIndicacao, Referral } from '../services/marketingService';
import { sendNotification } from '../services/notificationService';
import { getPublicOrigin } from '../lib/urlUtils';
import { transformImageUrl } from '../utils/imageUtils';
import Swal from 'sweetalert2';

export function ClubeMarketingView() {
  const { profile } = useAuth();
  const [topReferrers, setTopReferrers] = useState<UserProfile[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [referralGoal, setReferralGoal] = useState(10);
  const [bonusValue, setBonusValue] = useState(150);
  const [premios, setPremios] = useState<any[]>([]);
  const [rules, setRules] = useState<any>(null);
  
  const [myReferrals, setMyReferrals] = useState<Referral[]>([]);
  
  // Form state
  const [nomeIndicado, setNomeIndicado] = useState('');
  const [telefoneIndicado, setTelefoneIndicado] = useState('');
  const [emailIndicado, setEmailIndicado] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchTopReferrers = async () => {
      const q = query(
        collection(db, 'usuarios'), 
        where('nivel', '==', 'CLIENTE'),
        orderBy('saldo_pontos', 'desc'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      setTopReferrers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    };

    const fetchUserReferrals = async () => {
      if (!profile?.uid) return;
      const q = query(collection(db, 'referrals'), where('cliente_origem_id', '==', profile.uid), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const refs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Referral));
      setMyReferrals(refs);
      setReferralCount(refs.length);
    };

    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'platform_config', 'points_rules'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.premios) setPremios(data.premios);
        if (data.valores) {
          setRules(data.valores);
          setBonusValue(data.valores.indicacao || 150);
        }
      }
    };

    fetchTopReferrers();
    fetchUserReferrals();
    fetchConfig();
  }, [profile]);

  const handleIndicacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (!nomeIndicado || !telefoneIndicado) {
      Swal.fire('Erro', 'Preencha todos os campos da indicação.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await criarIndicacao({
        cliente_origem_id: profile.uid,
        origem_tipo: 'CLIENTE',
        nome_indicado: nomeIndicado,
        telefone_indicado: telefoneIndicado,
        email_indicado: emailIndicado,
        vendedor_id: profile.id_superior || 'ADM',
        bonus_valor: bonusValue,
        metodo_indicacao: 'MANUAL'
      });

      Swal.fire({
        title: 'Indicação Enviada!',
        text: 'Sua indicação foi registrada com sucesso. Acompanhe o status no seu painel.',
        icon: 'success',
        background: '#0a0a2e',
        color: '#fff',
        confirmButtonColor: '#3b82f6'
      });

      setNomeIndicado('');
      setTelefoneIndicado('');
      setEmailIndicado('');
      
      // Refresh referrals list
      const q = query(collection(db, 'referrals'), where('cliente_origem_id', '==', profile.uid), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      setMyReferrals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Referral)));
      setReferralCount(snapshot.size);
    } catch (error) {
      console.error(error);
      Swal.fire('Erro', 'Não foi possível registrar a indicação.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!profile?.uid) return;
    const link = `${getPublicOrigin()}/vendas?ref=${profile.uid}`;
    
    const copyToClipboard = (text: string) => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise<void>((res, rej) => {
          document.execCommand('copy') ? res() : rej();
          textArea.remove();
        });
      }
    };

    copyToClipboard(link).then(() => {
      Swal.fire({
        title: 'Link Copiado!',
        text: 'Seu link de indicação exclusivo foi copiado para a área de transferência. Agora é só enviar para seus amigos!',
        icon: 'success',
        background: '#0a0a2e',
        color: '#fff',
        confirmButtonColor: '#3b82f6'
      });
    }).catch(err => {
      console.error('Erro ao copiar link:', err);
      Swal.fire('Erro', 'Não foi possível copiar o link automaticamente. Tente selecionar o texto manualmente.', 'error');
    });
  };

  const progress = Math.min((referralCount / referralGoal) * 100, 100);

  return (
    <div className="space-y-8">
      {/* HERO SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
        <div className="xl:col-span-2 bg-gradient-to-br from-indigo-600 to-blue-800 p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
          <div className="relative z-10 space-y-4 sm:space-y-6">
            <h2 className="text-3xl sm:text-5xl font-black italic uppercase mb-2 tracking-tighter leading-tight">
              {profile?.nivel === 'CLIENTE' ? 'Elite de Prêmios' : 'Clube GSA Premium'}
            </h2>
            <p className="opacity-80 text-sm sm:text-lg max-w-md leading-relaxed">
              {profile?.nivel === 'CLIENTE' 
                ? 'Indique amigos e ganhe prêmios exclusivos. Acompanhe suas indicações e bônus aqui.'
                : 'Transforme suas indicações em dinheiro vivo. Gerencie seus bônus e acompanhe o ranking da elite GSA.'}
            </p>
            <div className="flex flex-wrap gap-3 sm:gap-4 pt-2 sm:pt-4">
              <div className="bg-white/10 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 flex items-center gap-3 sm:gap-4 flex-1 min-w-[140px]">
                <div className="size-10 sm:size-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <Gift className="text-white size-5" />
                </div>
                <div>
                  <p className="text-[8px] sm:text-[10px] font-black uppercase mb-0.5 sm:mb-1 opacity-70">Bônus por Indicação</p>
                  <p className="text-lg sm:text-2xl font-black">R$ {bonusValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 flex items-center gap-3 sm:gap-4 flex-1 min-w-[140px]">
                <div className="size-10 sm:size-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <Users className="text-white size-5" />
                </div>
                <div>
                  <p className="text-[8px] sm:text-[10px] font-black uppercase mb-0.5 sm:mb-1 opacity-70">Suas Indicações</p>
                  <p className="text-lg sm:text-2xl font-black">{referralCount.toString().padStart(2, '0')}</p>
                </div>
              </div>
            </div>
          </div>
          <Gift className="absolute -right-12 -bottom-12 !text-[150px] sm:!text-[250px] opacity-10 rotate-12 pointer-events-none" />
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3">
              <Target className="text-blue-600 size-6" />
              <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white uppercase italic">Meta de Indicações</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Complete a meta mensal para desbloquear bônus exclusivos e prêmios da equipe.
            </p>
          </div>
          
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-2xl sm:text-3xl font-black text-blue-600">{referralCount} <span className="text-sm text-slate-400">/ {referralGoal}</span></span>
              <span className="text-[10px] font-black text-slate-400 uppercase">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-3 sm:h-4 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">
              Faltam {Math.max(referralGoal - referralCount, 0)} indicações para bater a meta.
            </p>
          </div>
        </div>
      </div>

      {/* RANKING OR REFERRAL FORM SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 sm:space-y-8">
          {profile?.nivel === 'CLIENTE' ? (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <UserPlus className="text-blue-600 size-6 sm:size-7" />
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Indicar Novo Amigo</h3>
                </div>
                <Star className="text-amber-500 size-6" />
              </div>

              <form onSubmit={handleIndicacao} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nome do Amigo</label>
                  <div className="relative">
                    <Users className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text" 
                      placeholder="Nome completo..."
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={nomeIndicado}
                      onChange={(e) => setNomeIndicado(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">WhatsApp / Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="tel" 
                      placeholder="(00) 00000-0000"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={telefoneIndicado}
                      onChange={(e) => setTelefoneIndicado(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">E-mail (Opcional)</label>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="email" 
                      placeholder="exemplo@email.com"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={emailIndicado}
                      onChange={(e) => setEmailIndicado(e.target.value)}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 pt-2">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando...' : (
                      <>
                        <Share2 size={18} />
                        Enviar Indicação Agora
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 flex items-center gap-4">
                <div className="size-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                  <Gift className="text-blue-600" size={24} />
                </div>
                <p className="text-xs font-bold text-blue-800 dark:text-blue-200 leading-relaxed">
                  Você receberá <span className="text-blue-600 font-black">R$ {bonusValue.toLocaleString('pt-BR')}</span> em sua carteira assim que seu amigo concluir o primeiro pagamento.
                </p>
              </div>

              {/* LISTA DE MINHAS INDICAÇÕES */}
              <div className="pt-8 space-y-6">
                <div className="flex items-center gap-3">
                  <ClipboardList className="text-blue-600 size-6" />
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic">Minhas Indicações</h3>
                </div>
                
                <div className="space-y-4">
                  {myReferrals.length > 0 ? myReferrals.map((ref) => (
                    <div key={ref.id} className="p-5 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="size-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 font-bold">
                          {ref.nome_indicado.substring(0, 1)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white text-sm">{ref.nome_indicado}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{ref.telefone_indicado}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          ref.status_indicacao === 'Concluído' ? 'bg-emerald-100 text-emerald-600' :
                          ref.status_indicacao === 'Sem Retorno' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {ref.status_indicacao}
                        </span>
                        <p className="text-[8px] text-slate-400 mt-1 font-bold uppercase">
                          {ref.timestamp?.toDate().toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                      <p className="text-slate-400 text-sm italic font-medium">Você ainda não fez nenhuma indicação.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Trophy className="text-amber-500 size-6 sm:size-7" />
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Elite de Indicações</h3>
                </div>
                <TrendingUp className="text-emerald-500 hidden sm:block size-6" />
              </div>

              <div className="space-y-3 sm:space-y-4">
                {topReferrers.map((referrer, idx) => (
                  <div key={referrer.uid} className="flex items-center justify-between p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/30 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-700 hover:border-blue-300 transition-all group">
                    <div className="flex items-center gap-3 sm:gap-6">
                      <div className={`size-10 sm:size-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl shrink-0 ${
                        idx === 0 ? 'bg-amber-100 text-amber-600' : 
                        idx === 1 ? 'bg-slate-200 text-slate-600' : 
                        idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                        <div className="size-10 sm:size-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold uppercase shrink-0 text-sm sm:text-base">
                          {(referrer.nome_completo || '').substring(0, 2)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-slate-800 dark:text-white text-sm sm:text-base truncate">{referrer.nome_completo}</p>
                          <p className="text-[8px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest">Membro Premium</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl sm:text-2xl font-black text-blue-600">{referrer.saldo_pontos || 0}</p>
                      <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">Pontos</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase italic flex items-center gap-2">
              <Award className="text-indigo-600 size-5" />
              {profile?.nivel === 'CLIENTE' ? 'Elite de Prêmios' : 'Próximos Prêmios'}
            </h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
              {premios.length > 0 ? premios
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                .map((p: any) => (
                <div key={p.id} className={`p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl sm:rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3 relative ${p.status === 'esgotado' ? 'opacity-60 grayscale' : ''}`}>
                  <div className="size-10 sm:size-12 bg-white rounded-lg sm:rounded-xl overflow-hidden shrink-0 border border-indigo-100">
                    <img src={transformImageUrl(p.foto)} className="w-full h-full object-cover" alt={p.nome} referrerPolicy="no-referrer" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[8px] sm:text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mb-0.5 sm:mb-1">{p.pontos} PONTOS</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">{p.nome}</p>
                    {p.status && p.status !== 'disponivel' && (
                      <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${p.status === 'esgotado' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                        {p.status === 'esgotado' ? 'Esgotado' : 'Últimas Unidades'}
                      </span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-slate-400 italic text-sm">
                  Nenhum prêmio disponível.
                </div>
              )}
            </div>
          </div>

          {rules && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-emerald-100 dark:border-emerald-900/30 space-y-4">
              <h3 className="text-xs sm:text-sm font-black text-emerald-800 dark:text-emerald-200 uppercase italic flex items-center gap-2">
                <TrendingUp className="size-4" /> Como Ganhar Pontos?
              </h3>
              <ul className="space-y-2 sm:space-y-3">
                {profile?.nivel === 'CLIENTE' ? (
                  <>
                    <li className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                      <span>Novo Cadastro</span>
                      <span>+{rules.cadastro} pts</span>
                    </li>
                    <li className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                      <span>Indicar Amigo</span>
                      <span>+{rules.indicacao} pts</span>
                    </li>
                    <li className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                      <span>Pagamento em Dia</span>
                      <span>+{rules.pagamento_dia} pts</span>
                    </li>
                    <li className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                      <span>Pagamento Antecipado</span>
                      <span>+{rules.pagamento_antecipado} pts</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                      <span>Venda Realizada</span>
                      <span>+{rules.venda_vendedor} pts</span>
                    </li>
                    {profile?.nivel === 'GESTOR' && (
                      <li className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                        <span>Venda da Equipe</span>
                        <span>+{rules.venda_gestor} pts</span>
                      </li>
                    )}
                    <li className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                      <span>Indicação Direta</span>
                      <span>+{rules.indicacao} pts</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}

          <div className="bg-slate-900 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] text-white space-y-4 sm:space-y-6 text-center">
            <div className="size-12 sm:size-16 bg-blue-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-600/20">
              <Share2 className="size-6 sm:size-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black uppercase italic text-blue-400">Compartilhar Link</h3>
              <p className="text-[10px] sm:text-xs opacity-60 leading-relaxed">
                Envie seu link exclusivo para amigos e ganhe bônus automaticamente.
              </p>
            </div>
            <button 
              onClick={handleCopyLink}
              className="w-full bg-blue-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest hover:bg-blue-700 transition-all"
            >
              Copiar Link de Indicação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
