import React, { useState } from 'react';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, FileText, Clock, CheckCircle, AlertCircle, User, Calendar, ExternalLink, Info, Eye, Gift, Trophy, Share2, Star, Shield, AlertTriangle, ArrowRight, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../components/AuthContext';
import { getPublicOrigin } from '../lib/urlUtils';
import { SmartFicha } from '../components/GSA/SmartFicha';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { ClubePromoBanner } from '../components/GSA/ClubePromoBanner';

export function ConsultaPublicaView() {
  const { profile, simulateUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showSmartFicha, setShowSmartFicha] = useState<string | null>(null);
  const [indicacoes, setIndicacoes] = useState<any[]>([]);
  const [newsNome, setNewsNome] = useState('');
  const [newsWhats, setNewsWhats] = useState('');
  const [newsEmail, setNewsEmail] = useState('');
  const [newsLoading, setNewsLoading] = useState(false);

  const totalBonus = indicacoes
    .filter(ind => ind.status_indicacao === 'Concluido')
    .reduce((sum, ind) => sum + (ind.bonus_valor || 0), 0);

  const shareViaWhatsApp = () => {
    const link = `${getPublicOrigin()}?ref=${searchTerm}`;
    const text = `Olá! Estou participando do portal GSA e recomendo. Use meu link para conhecer os serviços e ganhar bônus: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsNome || !newsWhats) return;
    setNewsLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      setNewsNome('');
      setNewsWhats('');
      setNewsEmail('');
      Swal.fire('Inscrito!', 'Agora você é um cliente VIP GSA.', 'success');
    } catch (err) {
      Swal.fire('Erro', 'Tente novamente.', 'error');
    } finally {
      setNewsLoading(false);
    }
  };

  const isAdminView = profile?.nivel === 'ADM_MASTER' || 
                    profile?.nivel === 'ADM_GERENTE' || 
                    profile?.nivel === 'ADM_ANALISTA' || 
                    profile?.nivel === 'GESTOR' || 
                    profile?.nivel === 'VENDEDOR';

  const handleSimulateClient = async (clienteUid: string) => {
    if (!clienteUid) return;
    try {
      const userSnap = await getDoc(doc(db, 'usuarios', clienteUid));
      if (userSnap.exists()) {
        const userData = { uid: userSnap.id, ...userSnap.data() } as any;
        Swal.fire({
          title: 'Simulando Cliente',
          text: `Entrando no ambiente de ${userData.nome_completo}`,
          icon: 'info',
          timer: 1500,
          showConfirmButton: false,
          background: '#0a0a2e',
          color: '#fff'
        }).then(() => {
          simulateUser(userData);
        });
      }
    } catch (error) {
      console.error('Erro ao simular cliente:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm || !dataNascimento) return;

    setLoading(true);
    setSearched(true);
    try {
      const { consultaPublicaProcesso } = await import('../services/publicService');
      const process = await consultaPublicaProcesso(searchTerm, dataNascimento);
      
      if (process) {
        setResults([process]);
        // Buscar indicações relacionadas para o dashboard atrativo
        const { listarMinhasIndicacoesPublicas } = await import('../services/publicService');
        const refs = await listarMinhasIndicacoesPublicas(searchTerm, dataNascimento);
        setIndicacoes(refs);
      } else {
        setResults([]);
        setIndicacoes([]);
      }
    } catch (error) {
      console.error('Erro na consulta pública:', error);
      Swal.fire('Erro', 'Falha na conexão com o banco de dados. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-12 pb-32">
      {/* Header Informativo */}
      {isAdminView && (
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
          <div className="size-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
            <Info size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-900">Link para seus Clientes</p>
            <p className="text-xs text-blue-700 mt-1">Este painel é para uso interno e consulta rápida. Seus clientes devem acessar o portal público oficial pelo link:</p>
            <div className="mt-3 flex items-center gap-3">
              <code className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 text-xs text-blue-600 font-mono">
                {getPublicOrigin()}
              </code>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(getPublicOrigin());
                  Swal.fire('Copiado!', 'Link encaminhado para a área de transferência.', 'success');
                }}
                className="text-[10px] font-black uppercase text-blue-600 hover:underline"
              >
                Copiar Link oficial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Busca Principal */}
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="size-16 bg-[#0a0a2e] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-900/20">
            <Search size={28} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-[#0a0a2e] uppercase italic tracking-tighter leading-none">Acompanhar Processo</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">Digite os dados para acesso imediato ao status do cliente.</p>
        </div>

        <form onSubmit={handleSearch} className="bg-white p-2 rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="bg-slate-50 rounded-[calc(2.5rem-8px)] p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest flex items-center gap-2">
                <User size={12} className="text-blue-600" /> Documento ou Protocolo
              </label>
              <input 
                placeholder="Ex: 000.000.000-00"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest flex items-center gap-2">
                <Calendar size={12} className="text-blue-600" /> Data de Nascimento
              </label>
              <input 
                type="date"
                value={dataNascimento}
                onChange={e => setDataNascimento(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none [color-scheme:light]"
              />
            </div>
            <div className="md:col-span-2">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-[#0a0a2e] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl hover:bg-black flex items-center justify-center gap-3"
              >
                {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Search size={18} /> Consultar</>}
              </button>
            </div>
          </div>
        </form>
      </div>

      <AnimatePresence mode="wait">
        {searched && !loading && results.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-10 rounded-[3rem] border-2 border-amber-100 text-center space-y-4 shadow-xl max-w-2xl mx-auto"
          >
            <div className="size-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-2">
              <AlertCircle size={40} />
            </div>
            <h3 className="text-2xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Ops! Não encontramos nada</h3>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
              Verifique os dados digitados ou entre em contato com nosso suporte via WhatsApp.
            </p>
          </motion.div>
        )}

        {results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-16"
          >
            {results.map((processo) => (
              <div key={processo.id} className="space-y-16">
                {/* CARD DE RESULTADO PRINCIPAL */}
                <div className="bg-[#0a0a2e] rounded-[3rem] p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden border border-white/10 group">
                   <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                    <Star size={200} fill="currentColor" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="size-24 sm:size-32 bg-yellow-400 rounded-full flex items-center justify-center shadow-2xl shadow-yellow-400/30">
                      <Trophy className="size-12 sm:size-16 text-blue-900" />
                    </div>
                    <div className="text-center md:text-left space-y-2 flex-1">
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <span className="text-[10px] font-black bg-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">Protocolo: {processo.protocolo || processo.id}</span>
                      </div>
                      <h2 className="text-4xl sm:text-6xl font-black uppercase italic tracking-tighter leading-none">{processo.cliente_nome}</h2>
                      <p className="text-blue-400 text-lg font-black uppercase italic tracking-widest">{processo.servico_nome}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] font-black text-blue-300 uppercase opacity-50 tracking-[0.2em]">Progresso Atual</span>
                      <div className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase italic tracking-widest text-sm shadow-xl">
                        {processo.status_atual}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 relative z-10">
                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 text-center">
                      <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Calendar size={20} className="text-blue-300" />
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300 mb-1">Início</p>
                      <p className="text-lg font-black text-white">{processo.data_venda ? format(processo.data_venda.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 text-center">
                      <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Clock size={20} className="text-blue-300" />
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300 mb-1">Prazo</p>
                      <p className="text-lg font-black text-white">{processo.prazo_estimado_dias || 7} Dias Úteis</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 text-center">
                      <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <User size={20} className="text-blue-300" />
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300 mb-1">Gestor</p>
                      <p className="text-lg font-black text-white uppercase italic">{processo.vendedor_nome || 'Equipe GSA'}</p>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-center md:justify-end gap-4 overflow-hidden relative z-10">
                    {processo.cliente_uid && (
                       <button 
                         onClick={() => handleSimulateClient(processo.cliente_uid)}
                         className="flex items-center gap-2 px-6 py-3 bg-white text-[#0a0a2e] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl active:scale-95"
                       >
                         <Eye size={16} /> Ver Ambiente do Cliente
                       </button>
                    )}
                  </div>
                </div>

                {/* HUB INDIQUE E GANHE (POLISHED) */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-900 rounded-[3rem] p-1 shadow-2xl">
                  <div className="bg-[#0a0a2e] rounded-[calc(3rem-4px)] p-8 sm:p-12 text-white relative overflow-hidden h-full">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Share2 size={240} />
                    </div>
                    
                    <div className="relative z-10 space-y-12">
                      <div className="text-center space-y-4">
                        <div className="size-16 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-600/30">
                          <Gift size={32} className="text-white" />
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black uppercase italic tracking-tighter leading-none">
                          INDICAÇÃO <span className="text-blue-500">PREMIUM</span>
                        </h2>
                        <p className="text-blue-200 text-sm sm:text-lg max-w-md mx-auto opacity-80 mt-4 leading-relaxed font-semibold uppercase italic">
                          Indique um amigo e ganhe bônus de R$ 50,00 por contrato fechado diretamente na sua conta.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-md">
                        <div className="space-y-4">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`${getPublicOrigin()}?ref=${searchTerm}`);
                              Swal.fire('Link Copiado!', 'Compartilhe com seus amigos!', 'success');
                            }}
                            className="w-full p-6 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl hover:shadow-blue-500/20"
                          >
                            Copiar Meu Link Único
                          </button>
                          <button 
                            onClick={shareViaWhatsApp}
                            className="w-full p-6 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-xl hover:shadow-emerald-500/20"
                          >
                            Compartilhar No WhatsApp
                          </button>

                          <div className="pt-6 border-t border-white/10">
                            <p className="text-[10px] font-black uppercase text-blue-300 mb-4 tracking-widest">Indicar Diretamente:</p>
                            <div className="space-y-3">
                              <input 
                                placeholder="Nome do Amigo" 
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:ring-2 ring-blue-500/30"
                                id="ind_nome"
                              />
                              <input 
                                placeholder="WhatsApp do Amigo" 
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:ring-2 ring-blue-500/30"
                                id="ind_whats"
                                type="tel"
                              />
                              <button 
                                onClick={() => {
                                  const nome = (document.getElementById('ind_nome') as HTMLInputElement)?.value;
                                  const whats = (document.getElementById('ind_whats') as HTMLInputElement)?.value;
                                  if(!nome || !whats) return Swal.fire('Atenção', 'Preencha nome e whatsapp', 'warning');
                                  Swal.fire('Indicação Enviada!', 'Nossa equipe entrará em contato com seu amigo.', 'success');
                                  (document.getElementById('ind_nome') as HTMLInputElement).value = '';
                                  (document.getElementById('ind_whats') as HTMLInputElement).value = '';
                                }}
                                className="w-full p-4 bg-yellow-400 text-blue-900 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-yellow-300 transition-all shadow-xl"
                              >
                                Enviar Indicação
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/10 p-8 rounded-3xl space-y-6 text-center md:text-left h-full flex flex-col justify-center">
                          <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Bônus Acumulado</span>
                            <span className="text-3xl font-black text-emerald-400 italic">R$ {totalBonus.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Minhas Indicações</span>
                            <span className="text-3xl font-black text-white italic">{indicacoes.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VISUALIZAÇÃO DE SMARTFICHA (PENDÊNCIAS) */}
                {((processo.dados_faltantes && processo.dados_faltantes.length > 0) || (processo.pendencias_iniciais && processo.pendencias_iniciais.length > 0)) && (
                   <div className="bg-amber-50 p-10 rounded-[3rem] border-4 border-amber-200 shadow-2xl space-y-8 animate-pulse-slow">
                      <div className="flex items-center gap-4">
                        <div className="size-16 bg-amber-200 rounded-3xl flex items-center justify-center text-amber-900 shadow-xl">
                          <AlertTriangle size={40} />
                        </div>
                        <div>
                          <h3 className="text-3xl font-black text-amber-900 uppercase italic leading-none">Ação Necessária!</h3>
                          <p className="text-amber-800 text-xs font-bold uppercase tracking-widest mt-2">Resolva as pendências abaixo para não atrasar seu processo.</p>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-[2rem] p-8 border border-amber-100 shadow-inner">
                        <SmartFicha 
                          processos={[processo]} 
                          clienteDados={profile || { 
                            id: processo.cliente_id, 
                            uid: processo.cliente_id,
                            nome_completo: processo.cliente_nome,
                            cpf: processo.cliente_cpf_cnpj,
                            data_nascimento: processo.data_nascimento,
                            ...processo
                          }} 
                          onUpdate={() => handleSearch({ preventDefault: () => {} } as any)} 
                        />
                      </div>
                   </div>
                )}

                {/* CLUBE DE PONTOS / SHOWCASE */}
                <div className="space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="size-14 bg-yellow-400 rounded-2xl flex items-center justify-center text-blue-900 shadow-xl shadow-yellow-400/20">
                      <Trophy size={28} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Elite de Prêmios</h2>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Transforme pontos em presentes reais e bônus na conta.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { nome: 'VALE COMPRAS - BOTICÁRIO R$25', pts: 500, img: 'https://images.unsplash.com/photo-1596462502278-27bfdc4033c8?auto=format&fit=crop&q=80&w=400' },
                      { nome: 'VALE COMPRAS - SHOPEE R$25', pts: 500, img: 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?auto=format&fit=crop&q=80&w=400' },
                      { nome: 'VALE CRÉDITO - UBER R$25', pts: 500, img: 'https://images.unsplash.com/photo-1510605395823-530474d7490e?auto=format&fit=crop&q=80&w=400' },
                      { nome: 'VALE COMPRAS - IFOOD R$25', pts: 500, img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400' },
                      { nome: 'R$ 50 OFF - SERVIÇOS GSA', pts: 1000, img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=400' },
                      { nome: 'PIX R$100', pts: 2000, img: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&q=80&w=400' },
                      { nome: 'PIX R$200', pts: 4000, img: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&q=80&w=400' }
                    ].map((p, idx) => (
                      <motion.div 
                        whileHover={{ y: -10 }}
                        key={idx} 
                        className="bg-white rounded-[2.5rem] p-5 border border-slate-100 shadow-xl group"
                      >
                        <div className="aspect-square bg-slate-100 rounded-[2rem] overflow-hidden mb-4 relative">
                          <img src={p.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.nome} referrerPolicy="no-referrer" />
                          <div className="absolute top-3 left-3 bg-[#0a0a2e] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-2xl">
                            {p.pts} Pts
                          </div>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-800 uppercase italic truncate">{p.nome}</h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Pontos Insuficientes</p>
                      </motion.div>
                    ))}
                  </div>

                  <button 
                    onClick={() => Swal.fire('Portal de Prêmios', 'O catálogo completo será liberado para o cliente em sua área VIP exclusiva.', 'info')}
                    className="w-full py-5 bg-[#0a0a2e] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-xl"
                  >
                    Ver Catálogo Completo VIP
                  </button>
                </div>

                {/* NEWSLETTER VIP */}
                <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl relative overflow-hidden text-center space-y-8">
                  <div className="absolute inset-0 bg-blue-50 opacity-20 pointer-events-none"></div>
                  <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                    <div className="size-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30 mb-4">
                      <Star size={32} className="text-white" fill="currentColor" />
                    </div>
                    <h3 className="text-4xl font-black text-[#0a0a2e] uppercase italic tracking-tighter">Seja um Cliente VIP</h3>
                    <p className="text-slate-500 text-sm font-medium italic">Fique sabendo de novas oportunidades, bônus e notícias do mercado financeiro em primeira mão.</p>
                    
                    <form onSubmit={handleNewsletter} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input 
                        placeholder="Nome Completo" 
                        value={newsNome}
                        onChange={e => setNewsNome(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-blue-500/10 outline-none"
                      />
                      <input 
                        placeholder="WhatsApp" 
                        value={newsWhats}
                        onChange={e => setNewsWhats(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-blue-500/10 outline-none"
                      />
                      <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4">
                        <button 
                          type="submit"
                          disabled={newsLoading}
                          className="flex-3 bg-[#0a0a2e] text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-black transition-all"
                        >
                          {newsLoading ? 'Inscrevendo...' : 'Cadastrar na Lista VIP GSA'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => window.open('https://chat.whatsapp.com/ExempleGroupGSA', '_blank')}
                          className="flex-2 bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                        >
                          <MessageCircle size={16} /> Entrar na Comunidade
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
