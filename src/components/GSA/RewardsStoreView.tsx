import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, getDoc, addDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Trophy, Gift, Star, ArrowRight, Image as ImageIcon, Lock } from 'lucide-react';
import Swal from 'sweetalert2';
import { transformImageUrl } from '../../utils/imageUtils';

interface RewardsStoreProps {
  currentProfile: any; // O perfil do usuário logado (Cliente ou Vendedor)
}

export const RewardsStoreView = ({ currentProfile }: RewardsStoreProps) => {
  const [premios, setPremios] = useState<any[]>([]);
  const [saldo, setSaldo] = useState<number>(0);
  const [saldoPendente, setSaldoPendente] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarClube = async () => {
      try {
        // 1. Puxar o saldo atualizado do usuário
        const userSnap = await getDoc(doc(db, 'usuarios', currentProfile.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setSaldo(userData.saldo_pontos || 0);
          setSaldoPendente(userData.saldo_pendente || 0);
        }

        // 2. Puxar a vitrine de prêmios configurada pelo ADM Master
        const regrasSnap = await getDoc(doc(db, 'platform_config', 'points_rules'));
        if (regrasSnap.exists()) {
          // Ordena os prêmios do menor para o maior ponto
          const premiosOrdenados = (regrasSnap.data().premios || []).sort((a: any, b: any) => a.pontos - b.pontos);
          setPremios(premiosOrdenados);
        }
      } catch (error) {
        console.error("Erro ao carregar clube:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarClube();
  }, [currentProfile.uid]);

  const handleResgatar = async (premio: any) => {
    if (saldo < premio.pontos) {
      return Swal.fire('Saldo Insuficiente', `Você precisa de mais ${premio.pontos - saldo} pontos para resgatar este item.`, 'warning');
    }

    const confirm = await Swal.fire({
      title: `Resgatar ${premio.nome}?`,
      text: `Serão debitados ${premio.pontos} pontos da sua carteira.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0a0a2e',
      confirmButtonText: 'Sim, Resgatar!',
      cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
      try {
        // 1. Debitar pontos do usuário
        await updateDoc(doc(db, 'usuarios', currentProfile.uid), {
          saldo_pontos: increment(-premio.pontos)
        });

        // 2. Criar o pedido de resgate para o ADM ver
        await addDoc(collection(db, 'reward_requests'), {
          userId: currentProfile.uid,
          userName: currentProfile.nome,
          userEmail: currentProfile.email,
          userRole: currentProfile.role,
          premio_id: premio.id,
          premio_nome: premio.nome,
          pontos_gastos: premio.pontos,
          status: 'PENDENTE',
          data_solicitacao: serverTimestamp()
        });

        // 3. Gerar Notificação Interna para o ADM
        await addDoc(collection(db, 'notifications'), {
          title: "🎁 Novo Resgate de Prêmio!",
          message: `${currentProfile.nome} solicitou o resgate de: ${premio.nome}.`,
          type: "success",
          read: false,
          createdAt: serverTimestamp(),
          targetRole: "ADM_MASTER" // Só os administradores verão isso
        });

        setSaldo(prev => prev - premio.pontos);
        Swal.fire('Parabéns!', 'O seu resgate foi solicitado. A nossa equipa entrará em contacto para a entrega.', 'success');
        
      } catch (error) {
        Swal.fire('Erro', 'Ocorreu um erro ao processar o resgate.', 'error');
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">A carregar o Clube de Pontos...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Banner de Saldo */}
      <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="text-yellow-400 size-7 sm:size-8" />
              <h2 className="text-2xl font-black uppercase italic tracking-wider">Clube GSA</h2>
            </div>
            <p className="text-blue-200 text-sm">Acumule pontos e troque por prémios exclusivos.</p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-black/30 p-6 rounded-3xl border border-white/10 text-center min-w-[160px]">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-1">Saldo Disponível</p>
              <h3 className="text-4xl font-black text-yellow-400">{saldo} <span className="text-lg">PTS</span></h3>
            </div>

            {saldoPendente > 0 && (
              <div className="bg-white/10 p-6 rounded-3xl border border-white/5 text-center min-w-[160px] backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1 flex items-center justify-center gap-1">
                  <Lock className="size-2.5" /> Saldo Pendente
                </p>
                <h3 className="text-4xl font-black text-blue-200 opacity-80">{saldoPendente} <span className="text-lg">PTS</span></h3>
                <p className="text-[8px] text-blue-300 mt-1 uppercase font-bold">Libera após pagamento</p>
              </div>
            )}
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 size-64 bg-yellow-400/10 rounded-full blur-3xl"></div>
      </div>

      {/* Vitrine de Prémios */}
      <div>
        <h3 className="text-lg font-black text-slate-800 uppercase italic mb-6 flex items-center gap-2">
          <Gift className="text-emerald-500" /> Vitrine de Resgate
        </h3>

        {premios.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <Star className="mx-auto text-slate-300 mb-4 size-10 sm:size-12" />
            <p className="text-slate-500 font-medium">Nenhum prémio disponível no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {premios.map(premio => {
              const podeResgatar = saldo >= premio.pontos;
              const progresso = Math.min(100, (saldo / premio.pontos) * 100);

              return (
                <div key={premio.id} className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                  {/* Foto Quadrada do Produto */}
                  <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden mb-4 relative">
                    {premio.foto ? (
                      <img src={transformImageUrl(premio.foto)} alt={premio.nome} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="m-auto mt-[40%] text-slate-300 size-10 sm:size-12" />
                    )}
                    
                    <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                      {premio.pontos} PTS
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-800 text-center mb-2">{premio.nome}</h4>

                  {/* Barra de Progresso */}
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                    <div 
                      className={`h-full ${podeResgatar ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                      style={{ width: `${progresso}%` }}
                    />
                  </div>

                  <div className="mt-auto">
                    <button
                      onClick={() => handleResgatar(premio)}
                      disabled={!podeResgatar}
                      className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                        podeResgatar 
                          ? 'bg-blue-900 text-white hover:bg-black shadow-lg shadow-blue-900/20' 
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {podeResgatar ? (
                        <>Resgatar Agora <ArrowRight className="size-3.5" /></>
                      ) : (
                        `Faltam ${premio.pontos - saldo} pts`
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
