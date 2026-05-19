import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Layers, Plus, Info, Calendar, Clock } from 'lucide-react';

export const GestaoLotesView = () => {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ texto: string, tipo: 'sucesso' | 'erro' | '' }>({ texto: '', tipo: '' });

  // Estados para controle de prazos e datas
  const [dataEncerramentoInput, setDataEncerramentoInput] = useState('');
  const [loteIdEmProrrogacao, setLoteIdEmProrrogacao] = useState<string | null>(null);
  const [novaDataProrrogacaoInput, setNovaDataProrrogacaoInput] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'lotes_limpa_nome'), orderBy('data_abertura', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setLotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar lotes:", error);
      setFeedback({ texto: 'Erro de permissão ao ler os lotes do Firestore.', tipo: 'erro' });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const gerarNomeLoteAutomatico = () => {
    const hoje = new Date();
    const ano = String(hoje.getFullYear()).slice(-2);
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `NUP ${ano}${mes}${dia} L`;
  };

  const abrirNovoLote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dataEncerramentoInput) {
      setFeedback({ texto: 'Por favor, defina a data e hora de encerramento do lote.', tipo: 'erro' });
      return;
    }

    try {
      const nomeAutomatico = gerarNomeLoteAutomatico();
      const timestampEncerramento = new Date(dataEncerramentoInput).getTime();

      await addDoc(collection(db, 'lotes_limpa_nome'), {
        nome: nomeAutomatico,
        status: 'ABERTO',
        data_abertura: new Date().getTime(),
        data_encerramento: timestampEncerramento,
        orgaos_status: {
          spc_brasil: 'AGUARDANDO',
          serasa: 'AGUARDANDO',
          boa_vista: 'AGUARDANDO',
          cenprot_sp: 'AGUARDANDO',
          cenprot_nacional: 'AGUARDANDO'
        }
      });

      setDataEncerramentoInput('');
      setFeedback({ texto: `Lote "${nomeAutomatico}" criado com sucesso!`, tipo: 'sucesso' });
      setTimeout(() => setFeedback({ texto: '', tipo: '' }), 3000);
      
    } catch (error: any) {
      console.error("Erro ao criar lote:", error);
      setFeedback({ texto: `Falha ao criar o lote: ${error.message}`, tipo: 'erro' });
    }
  };

  const salvarProrrogacao = async (loteId: string) => {
    if (!novaDataProrrogacaoInput) {
      setFeedback({ texto: 'Por favor, selecione a nova data e hora da prorrogação.', tipo: 'erro' });
      return;
    }

    try {
      const timestampNovaData = new Date(novaDataProrrogacaoInput).getTime();
      const loteRef = doc(db, 'lotes_limpa_nome', loteId);
      
      await updateDoc(loteRef, {
        data_encerramento: timestampNovaData,
        status: 'ABERTO' // Reabre automaticamente o lote caso já estivesse encerrado
      });

      setLoteIdEmProrrogacao(null);
      setNovaDataProrrogacaoInput('');
      setFeedback({ texto: 'Prazo do lote prorrogado com sucesso!', tipo: 'sucesso' });
      setTimeout(() => setFeedback({ texto: '', tipo: '' }), 3000);
    } catch (error: any) {
      console.error("Erro ao prorrogar lote:", error);
      setFeedback({ texto: `Erro ao prorrogar: ${error.message}`, tipo: 'erro' });
    }
  };

  const atualizarStatusOrgao = async (loteId: string, orgao: string, novoStatus: string) => {
    try {
      const loteRef = doc(db, 'lotes_limpa_nome', loteId);
      await updateDoc(loteRef, {
        [`orgaos_status.${orgao}`]: novoStatus
      });
      setFeedback({ texto: `Status do ${orgao.replace('_', ' ')} atualizado!`, tipo: 'sucesso' });
      setTimeout(() => setFeedback({ texto: '', tipo: '' }), 2000);
    } catch (error: any) {
      setFeedback({ texto: `Erro ao atualizar órgão: ${error.message}`, tipo: 'erro' });
    }
  };

  const fecharLote = async (loteId: string) => {
    try {
      await updateDoc(doc(db, 'lotes_limpa_nome', loteId), { status: 'FECHADO' });
      setFeedback({ texto: 'Lote fechado para novos cadastros.', tipo: 'sucesso' });
      setTimeout(() => setFeedback({ texto: '', tipo: '' }), 3000);
    } catch (error: any) {
      setFeedback({ texto: `Erro ao fechar lote: ${error.message}`, tipo: 'erro' });
    }
  };

  if (loading) return <div className="p-6 text-white">A carregar os lotes operacionais...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto text-white">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Layers className="text-blue-500" /> Setor de Envios: Limpa Nome
        </h1>
        <p className="text-gray-400">Gere as listas de envio em massa e defina os prazos limites de captação.</p>
      </div>

      {/* Alertas de Feedback da Tela */}
      {feedback.texto && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 font-medium ${feedback.tipo === 'sucesso' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
          <Info size={20} />
          {feedback.texto}
        </div>
      )}

      {/* Painel Avançado de Abertura com Data/Hora */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
        <h2 className="text-lg font-semibold mb-2">Abrir Novo Lote de Envios</h2>
        <p className="text-sm text-gray-400 mb-4">
          O lote será gerado automaticamente (Ex: <strong>NUP {gerarNomeLoteAutomatico().split(' ')[1]} L</strong>). Escolha o momento do encerramento abaixo:
        </p>
        <form onSubmit={abrirNovoLote} className="flex flex-col sm:flex-row items-end gap-4">
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider flex items-center gap-1">
              <Calendar size={12} /> Data e Horário de Encerramento
            </label>
            <input
              type="datetime-local"
              value={dataEncerramentoInput}
              onChange={(e) => setDataEncerramentoInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 h-[42px]"
          >
            <Plus size={20} /> Gerar Lote
          </button>
        </form>
      </div>

      {/* Listagem Dinâmica dos Lotes */}
      <div className="space-y-6">
        {lotes.map(lote => (
          <div key={lote.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-700 pb-4 gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-3">
                  {lote.nome}
                  <span className={`text-xs px-2 py-1 rounded-full ${lote.status === 'ABERTO' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {lote.status}
                  </span>
                </h2>
                <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-400" /> Encerramento: {new Date(lote.data_encerramento).toLocaleString('pt-BR')}
                </p>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button 
                  onClick={() => {
                    setLoteIdEmProrrogacao(loteIdEmProrrogacao === lote.id ? null : lote.id);
                    setNovaDataProrrogacaoInput('');
                  }} 
                  className="text-sm px-4 py-2 bg-slate-900 border border-slate-700 text-gray-300 rounded hover:bg-slate-700/50 transition"
                >
                  Prorrogar Lote
                </button>
                {lote.status === 'ABERTO' && (
                  <button onClick={() => fecharLote(lote.id)} className="text-sm px-4 py-2 bg-slate-900 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition">
                    Encerrar Entrada
                  </button>
                )}
              </div>
            </div>

            {/* Painel Expansível de Prorrogação */}
            {loteIdEmProrrogacao === lote.id && (
              <div className="mb-6 p-4 bg-slate-900/60 rounded-xl border border-blue-500/30 animate-fadeIn">
                <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-1">
                  <Calendar size={14} /> Ajustar Nova Data de Encerramento
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <input 
                      type="datetime-local" 
                      value={novaDataProrrogacaoInput}
                      onChange={(e) => setNovaDataProrrogacaoInput(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => salvarProrrogacao(lote.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition flex-1 sm:flex-initial"
                    >
                      Confirmar
                    </button>
                    <button 
                      onClick={() => setLoteIdEmProrrogacao(null)}
                      className="bg-slate-800 hover:bg-slate-700 text-gray-400 text-sm px-3 py-2 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Painel de Órgãos */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Object.entries(lote.orgaos_status || {}).map(([orgao, status]) => (
                <div key={orgao} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <h3 className="font-semibold text-gray-300 uppercase text-xs mb-3">
                    {orgao.replace('_', ' ')}
                  </h3>
                  <select 
                    value={status as string}
                    onChange={(e) => atualizarStatusOrgao(lote.id, orgao, e.target.value)}
                    className={`w-full bg-slate-800 text-sm rounded p-2 outline-none border transition ${
                      status === 'CONCLUIDO' ? 'border-green-500 text-green-400' : 
                      status === 'BAIXAS_INICIADAS' ? 'border-yellow-500 text-yellow-400' : 'border-slate-600 text-gray-400'
                    }`}
                  >
                    <option value="AGUARDANDO">⏳ Aguardando</option>
                    <option value="EM_MONITORAMENTO">🔍 Monitoramento</option>
                    <option value="BAIXAS_INICIADAS">🔥 Iniciadas</option>
                    <option value="CONCLUIDO">✅ Concluído</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
        {lotes.length === 0 && (
          <div className="text-center text-gray-500 py-10 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">
            Nenhum lote criado no momento. Escolha um prazo limite acima para começar.
          </div>
        )}
      </div>
    </div>
  );
};
