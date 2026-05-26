import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

export const QuizCreditoPublicoView = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refVendedor = searchParams.get('ref') || 'direto';
  
  const [passo, setPasso] = useState(1);
  const [desafio, setDesafio] = useState('');
  const [setor, setSetor] = useState('');
  const [temRestricao, setTemRestricao] = useState<boolean | null>(null);
  
  const [faturamento, setFaturamento] = useState('');
  const [valorCredito, setValorCredito] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  
  const [showModalWhats, setShowModalWhats] = useState(false);

  // Calcula capacidade
  const numFaturamento = Number(faturamento) || 0;
  const numValorDesejado = Number(valorCredito) || 0;
  const parcelaMaximaTolerada = numFaturamento * 0.20; 
  const prazoMeses = 60;
  const capacidadeMaxCredito = parcelaMaximaTolerada * prazoMeses * 0.85;

  const getCenario = () => {
    if (temRestricao === true) return 'C';
    if (desafio === 'C') return 'C';
    if (numValorDesejado > capacidadeMaxCredito) return 'B';
    return 'A';
  };

  const getLinhaPrioritaria = () => {
    if (setor === 'A' && (desafio === 'A' || desafio === 'B')) return 'FUNGETUR';
    return 'BNDES_PEQUENAS_EMPRESAS'; // fallback
  };

  const handleFinalizarQuiz = async (querAgendar: boolean) => {
    const cenario = getCenario();
    const tipoCredito = getLinhaPrioritaria();

    const novoLead = {
      vendedorId: refVendedor,
      origem: 'isca_digital',
      tipoCredito: tipoCredito,
      dadosEmpresa: { cnpj, razaoSocial: '', telefone, email: '', ramoAtividade: setor },
      financeiro: { faturamentoMensalMedio: numFaturamento, valorSolicitado: numValorDesejado, capacidadeMaxCredito },
      analiseIa: { cenario },
      status: 'onboarding',
      createdAt: new Date()
    };

    let docRef: any = null;
    try {
      docRef = await addDoc(collection(db, 'leads_credito'), novoLead);
    } catch (err) {
      console.error(err);
    }

    if (querAgendar && docRef) {
      navigate(`/checkout-credito?leadId=${docRef.id}&type=taxa_onboarding`);
    } else {
      setShowModalWhats(true);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4">
      {/* Container Glassmorphism Premium */}
      <div className="w-full max-w-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          {/* Barra de Progresso Visual */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className={`flex-1 text-center text-xs font-bold ${passo >= step ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {step === 1 && 'Desafio'}
                  {step === 2 && 'Setor'}
                  {step === 3 && 'Restrições'}
                  {step === 4 && 'Dados'}
                  {step === 5 && 'Diagnóstico'}
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center bg-slate-800 rounded-full h-2">
              <div 
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((passo - 1) / 3) * 100}%` }}
              ></div>
            </div>
          </div>

          {passo === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 text-slate-100">Qual o principal desafio financeiro da sua empresa hoje?</h2>
              <div className="space-y-4">
                <button onClick={() => { setDesafio('A'); setPasso(2); }} className={`w-full text-left p-5 rounded-xl border transition-all ${desafio === 'A' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}`}>
                   [A] Expandir/Reformar estrutura
                </button>
                <button onClick={() => { setDesafio('B'); setPasso(2); }} className={`w-full text-left p-5 rounded-xl border transition-all ${desafio === 'B' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}`}>
                   [B] Falta de Capital de Giro / Fluxo de Caixa
                </button>
                <button onClick={() => { setDesafio('C'); setPasso(2); }} className={`w-full text-left p-5 rounded-xl border transition-all ${desafio === 'C' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}`}>
                   [C] Negociar Dívidas e Limpar CNPJ
                </button>
              </div>
            </div>
          )}

          {passo === 2 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 text-slate-100">Qual o setor de atuação principal do seu CNPJ?</h2>
              <div className="space-y-4">
                <button onClick={() => { setSetor('A'); setPasso(3); }} className={`w-full text-left p-5 rounded-xl border transition-all ${setor === 'A' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}`}>
                   [A] Hotelaria, Pousada, Restaurante ou Transporte Turístico
                </button>
                <button onClick={() => { setSetor('B'); setPasso(3); }} className={`w-full text-left p-5 rounded-xl border transition-all ${setor === 'B' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}`}>
                   [B] Comércio Geral
                </button>
                <button onClick={() => { setSetor('C'); setPasso(3); }} className={`w-full text-left p-5 rounded-xl border transition-all ${setor === 'C' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}`}>
                   [C] Prestação de Serviços
                </button>
                <button onClick={() => { setSetor('D'); setPasso(3); }} className={`w-full text-left p-5 rounded-xl border transition-all ${setor === 'D' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}`}>
                   [D] Indústria
                </button>
              </div>
              <div className="mt-8">
                <button onClick={() => setPasso(1)} className="text-slate-400 hover:text-white transition-colors">← Voltar</button>
              </div>
            </div>
          )}

          {passo === 3 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 text-slate-100">Atualmente, a sua empresa possui alguma restrição ativa no CNPJ ou protesto em cartório?</h2>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setTemRestricao(false); setPasso(4); }} 
                  className={`w-full text-left p-4 rounded-xl border transition-all ${temRestricao === false ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/60 border-slate-700 hover:border-indigo-500'}`}
                >
                  Não, o CNPJ está 100% limpo e regular.
                </button>
                <button 
                  onClick={() => { setTemRestricao(true); setPasso(4); }} 
                  className={`w-full text-left p-4 rounded-xl border transition-all ${temRestricao === true ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/60 border-slate-700 hover:border-indigo-500'}`}
                >
                  Sim, possuímos restrições ou pendências operacionais.
                </button>
              </div>
              <div className="mt-8">
                <button onClick={() => setPasso(2)} className="text-slate-400 hover:text-white transition-colors">← Voltar</button>
              </div>
            </div>
          )}

          {passo === 4 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-4 text-slate-100">Motor de Cálculo:</h2>
              <p className="text-slate-400 text-sm mb-6">Preencha os dados abaixo para calcular sua capacidade e diagnosticar o cenário.</p>
              <div className="space-y-4">
                <input 
                  type="number" 
                  placeholder="Faturamento Bruto Médio Mensal (R$)" 
                  value={faturamento} 
                  onChange={(e) => setFaturamento(e.target.value)} 
                  className="w-full p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500" 
                />
                <input 
                  type="number" 
                  placeholder="Valor Estimado Desejado (R$)" 
                  value={valorCredito} 
                  onChange={(e) => setValorCredito(e.target.value)} 
                  className="w-full p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500" 
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="CNPJ" 
                    value={cnpj} 
                    onChange={(e) => setCnpj(e.target.value)} 
                    className="w-full p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500" 
                  />
                  <input 
                    type="text" 
                    placeholder="WhatsApp" 
                    value={telefone} 
                    onChange={(e) => setTelefone(e.target.value)} 
                    className="w-full p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500" 
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button onClick={() => setPasso(3)} className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 p-4 rounded-xl font-bold transition-colors">Voltar</button>
                <button onClick={() => setPasso(5)} disabled={!faturamento || !valorCredito || !cnpj || !telefone} className="w-2/3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-600/20">Analisar Perfil</button>
              </div>
            </div>
          )}

          {passo === 5 && (
            <div className="animate-fade-in">
              {getCenario() === 'A' && (
                <div className="text-center">
                  <div className="bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-emerald-400 mb-2">Pré-Análise Concluída: Diagnóstico Altamente Positivo.</h2>
                  <p className="text-slate-300 mb-8 leading-relaxed">
                    Com base no seu faturamento de {formatCurrency(numFaturamento)}, o sistema identificou que sua empresa tem capacidade técnica para pleitear <strong>até {formatCurrency(capacidadeMaxCredito)}</strong> com taxas reduzidas.
                  </p>
                  <p className="text-white font-medium mb-6">Deseja que nossa mesa de análise emita a folha de viabilidade oficial e monte seu projeto para o comitê do banco? Agende seu atendimento exclusivo por R$ 97,00.</p>
                </div>
              )}

              {getCenario() === 'B' && (
                <div className="text-center">
                  <div className="bg-amber-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="h-10 w-10 text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-amber-400 mb-2">Diagnóstico de Alinhamento Concluído.</h2>
                  <p className="text-slate-300 mb-8 leading-relaxed">
                    O valor de {formatCurrency(numValorDesejado)} ultrapassa o limite de risco automatizado para o seu faturamento atual. Contudo, seu CNPJ está qualificado para acessar um lote inicial de <strong>até {formatCurrency(capacidadeMaxCredito)}</strong> sem comprometer seu fluxo de caixa.
                  </p>
                  <p className="text-white font-medium mb-6">Para ajustar seu projeto financeiro ou apresentar garantias complementares que liberem o valor total, agende a avaliação com nosso especialista por R$ 97,00.</p>
                </div>
              )}

              {getCenario() === 'C' && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-amber-500/10 border border-amber-500 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    !
                  </div>
                  <h2 className="text-2xl font-black text-amber-400 mb-2">Diagnóstico de Alinhamento Necessário</h2>
                  
                  <p className="text-slate-300 text-sm leading-relaxed mb-6">
                    Para que o comitê do banco aprove o seu benefício do governo (como o <strong>FUNGETUR 2026</strong>), é obrigatório que a sua empresa esteja com a saúde fiscal 100% alinhada. 
                    <br /><br />
                    <span className="text-white font-semibold">A boa notícia é que nós cuidamos de tudo para você!</span> A GSA Soluções irá conduzir a sua empresa nesta jornada: faremos a blindagem/regularização do seu CNPJ e, simultaneamente, estruturaremos o seu Projeto de Viabilidade Econômica.
                  </p>

                  <div className="flex flex-col gap-4 mt-8">
                    <button 
                      onClick={() => handleFinalizarQuiz(true)} 
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all"
                    >
                      Iniciar Jornada e Agendar Atendimento (R$ 97,00)
                    </button>
                    <button 
                      onClick={() => handleFinalizarQuiz(false)} 
                      className="w-full bg-slate-800/40 hover:bg-slate-800/80 p-3 rounded-lg text-slate-400 text-sm transition"
                    >
                      Encerrar e falar pelo WhatsApp
                    </button>
                  </div>
                </div>
              )}
              
              {getCenario() !== 'C' && (
                <div className="flex flex-col gap-4 mt-4">
                  <button onClick={() => handleFinalizarQuiz(true)} className={`${getCenario() === 'A' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'} w-full p-4 rounded-xl font-bold text-lg text-slate-950 transition-all shadow-lg`}>
                    Agendar Avaliação Técnica (R$ 97,00)
                  </button>
                  <button onClick={() => handleFinalizarQuiz(false)} className="w-full bg-transparent border border-slate-700 hover:bg-slate-800 p-4 rounded-xl text-slate-400 font-medium transition-colors">
                    Encerrar Atendimento
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Retenção Crítica do WhatsApp */}
      {showModalWhats && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center p-4 backdrop-blur-sm z-50">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl max-w-md text-center shadow-2xl animate-fade-in relative overflow-hidden">
            {/* Decoração sutil */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-green-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <h3 className="text-3xl font-extrabold text-white mb-4 relative z-10">Não perca mais tempo!</h3>
            <p className="text-slate-300 mb-8 leading-relaxed relative z-10">Acesse seu capital de giro o mais rápido possível antes que o lote de verbas da sua agência regional se esgote.</p>
            <a 
              href={`https://api.whatsapp.com/send?phone=5554999999999&text=Vim%20do%20APP%20e%20encerrei%20o%20atendimento%3A%20Quero%20saber%20mais%20sobre%20o%20FUNGETUR`}
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center justify-center bg-[#25D366] hover:bg-[#1ebd5b] text-white font-bold p-4 rounded-xl w-full text-lg shadow-lg shadow-green-500/20 transition-transform hover:scale-[1.02] relative z-10 gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Falar com Especialista
            </a>
            <button 
              onClick={() => setShowModalWhats(false)} 
              className="mt-6 text-slate-500 hover:text-slate-400 text-sm font-medium transition-colors relative z-10"
            >
              Agora não, obrigado
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

