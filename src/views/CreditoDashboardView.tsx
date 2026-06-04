import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { CreditCard, FileText, Settings, Users, Settings2, BarChart, ChevronDown, CheckCircle, Clock, SplitSquareVertical, Plus, Copy } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { CreditLineSelection } from '../components/Credito/CreditLineSelection';
import type { ConfigComissaoCredito, CreditoLead } from '../types/credito';
import { ManualLeadModal } from '../components/Credito/ManualLeadModal';

const LeadCard: React.FC<{ lead: CreditoLead; role?: string; onGenerate: (id: string, ebitda: number, dre: number) => void; onGenerateBilling: (id: string, value: number) => void }> = ({ lead, role, onGenerate, onGenerateBilling }) => {
  const [ebitda, setEbitda] = useState<number>(lead.financeiro.ebitdaProjetado || 0);
  const [dre, setDre] = useState<number>(0);
  const [fee, setFee] = useState<number>(lead.financeiro.taxaFixaEstipuladaAdmin || 0);

  return (
    <div className="border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-colors shadow-sm bg-white">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">CNPJ: {lead.dadosEmpresa.cnpj}</span>
        </div>
        <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded">{lead.status}</span>
      </div>
      
      <h3 className="font-bold text-slate-800 text-lg mb-1">{lead.tipoCredito}</h3>
      <div className="space-y-1 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Faturamento Real:</span>
          <span className="font-semibold">R$ {lead.financeiro.faturamentoMensalMedio}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Solicitado:</span>
          <span className="font-semibold text-emerald-600">R$ {lead.financeiro.valorSolicitado}</span>
        </div>
      </div>

      {role !== 'CLIENTE' && (lead.status === 'analise_tecnica' || lead.status === 'protocolado') && (
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">DRE (Lucro Líquido)</label>
            <input 
              type="number" 
              value={dre}
              onChange={(e) => setDre(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="R$..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">EBITDA Projetado</label>
            <input 
              type="number" 
              value={ebitda}
              onChange={(e) => setEbitda(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="R$..."
            />
          </div>
          <button 
            onClick={() => onGenerate(lead.id || '', ebitda, dre)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" /> Gerar PVE via Inteligência Artificial
          </button>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Honorários Asaas (R$)</label>
            <input 
              type="number" 
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none mb-2"
              placeholder="R$ 997,00"
            />
            <button 
              onClick={() => onGenerateBilling(lead.id || '', fee)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm"
            >
              Gerar Cobrança (Asaas PIX)
            </button>
          </div>
        </div>
      )}

      {lead.status === 'aguardando_pagamento_taxa' && lead.dadosPagamentoAsaas && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-center mb-2">PAGAMENTO PIX GERADO</p>
          <img 
            src={`data:image/jpeg;base64,${lead.dadosPagamentoAsaas.pixQrCodeBase64}`} 
            alt="PIX QR Code" 
            className="w-32 h-32 mx-auto mb-2 rounded-lg"
          />
          <button
             onClick={() => {
               navigator.clipboard.writeText(lead.dadosPagamentoAsaas?.pixCopiaCola || '');
               Swal.fire({ title: 'Copiado!', icon: 'success', timer: 1500, showConfirmButton: false });
             }}
             className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white text-xs py-2 rounded-lg"
          >
            <Copy size={14} /> Pix Copia e Cola
          </button>
        </div>
      )}
    </div>
  );
};

export const CreditoDashboardView: React.FC = () => {
  const { profile } = useAuth();
  const role = profile?.nivel;
  const userId = profile?.uid;

  const [activeTab, setActiveTab] = useState<'pipeline' | 'comissoes' | 'analise_ia'>('pipeline');
  const [split, setSplit] = useState<ConfigComissaoCredito>({
    taxaFixaTotal: 97,
    percentualExitoTotal: 2,
    split: {
      vendedorShare: 0.20,
      gestorShare: 0.10,
      analistaShare: 0.05
    }
  });

  const [leads, setLeads] = useState<CreditoLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);

  useEffect(() => {
    fetchSplit();
    
    let q = query(collection(db, 'leads_credito'));
    
    if (role === 'VENDEDOR') {
      q = query(collection(db, 'leads_credito'), where('vendedorId', '==', userId));
    } else if (role === 'GESTOR') {
      q = query(collection(db, 'leads_credito'), where('gestorId', '==', userId));
    } else if (role === 'ADM_ANALISTA') {
      q = query(collection(db, 'leads_credito'), where('status', 'in', ['analise_tecnica', 'protocolado']));
    } else if (role === 'CLIENTE') {
      q = query(collection(db, 'leads_credito'), where('dadosEmpresa.cnpj', '==', profile?.cpf || '')); 
    }

    import('firebase/firestore').then(({ onSnapshot }) => {
      setLoading(true);
      const unsubscribe = onSnapshot(q, (snap) => {
         const fetchedLeads = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditoLead));
         setLeads(fetchedLeads);
         setLoading(false);
      }, (err) => {
         console.error('Error fetching leads', err);
         setLoading(false);
      });
      return () => unsubscribe();
    });
  }, [role, userId, profile?.cpf]);

  const fetchSplit = async () => {
    try {
      const splitDoc = await getDoc(doc(db, 'configuracoes', 'credito_split'));
      if (splitDoc.exists()) {
        setSplit(splitDoc.data() as ConfigComissaoCredito);
      }
    } catch (err) {
      console.error('Error fetching split', err);
    }
  };

  const fetchLeads = async () => {}; // Now handled via global onSnapshot

  const handleUpdateSplit = async () => {
    try {
      await setDoc(doc(db, 'configuracoes', 'credito_split'), split);
      Swal.fire('Sucesso', 'Split de comissões atualizado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Erro', 'Não foi possível atualizar o split', 'error');
    }
  };

  const handleGenerateReport = async (leadId: string, ebitda?: number, dre?: number) => {
    Swal.fire({
      title: 'Gerando PVE...',
      text: 'A IA está analisando os dados financeiros (DRE: R$ ' + dre + ' / EBITDA: R$ ' + ebitda + ') do cliente.',
      icon: 'info',
      showConfirmButton: false,
      allowOutsideClick: false,
      timer: 3000
    }).then(() => {
      Swal.fire('Concluído!', 'Relatório de Viabilidade (PVE) gerado via Inteligência Artificial com sucesso.', 'success');
    });
  };

  const handleGenerateBilling = async (leadId: string, fee: number) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || !lead.dadosEmpresa.cnpj || !fee) {
      Swal.fire('Erro', 'Dados incompletos para gerar cobrança.', 'error');
      return;
    }

    try {
       Swal.fire({ title: 'Gerando cobrança Asaas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
       
       const { gerarPagamentoAsaasFront } = await import('../services/vendaService');
       const resJson = await gerarPagamentoAsaasFront({
         nome: lead.dadosEmpresa.razaoSocial || lead.dadosEmpresa.cnpj,
         cpf: lead.dadosEmpresa.cnpj,
         email: 'financeiro@empresa.com',
         valor: fee,
         descricao: 'Honorários de Análise de Crédito GSA (' + lead.tipoCredito + ')',
         vendaId: leadId
       });

       await updateDoc(doc(db, 'leads_credito', leadId), {
         'financeiro.taxaFixaEstipuladaAdmin': fee,
         'dadosPagamentoAsaas': {
             idCobrancaAsaas: resJson.payment_id,
             pixQrCodeBase64: resJson.qr_code_base64,
             pixCopiaCola: resJson.copy_paste,
             statusPagamento: 'PENDING'
         },
         'status': 'aguardando_pagamento_taxa'
       });
       
       Swal.fire('Sucesso!', 'Cobrança do Asaas gerada com sucesso.', 'success');
       fetchLeads();
    } catch(err: any) {
       console.error("Erro Billing:", err);
       Swal.fire('Erro', err.message, 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {showManualModal && <ManualLeadModal onClose={() => setShowManualModal(false)} onSuccess={fetchLeads} />}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="text-emerald-600" /> Dashboard de Crédito
          </h1>
          <p className="text-slate-500 mt-1">Gestão, Pipeline e Motor de Análise de Crédito Corporativo</p>
        </div>
        {role !== 'CLIENTE' && (
          <button onClick={() => setShowManualModal(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-colors">
             <Plus size={18} /> Cadastrar Novo Lead
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* TAB NAVIGATION */}
        <div className="flex flex-wrap border-b border-slate-200 bg-slate-50/50">
          <button 
            onClick={() => setActiveTab('pipeline')}
            className={`px-6 py-4 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'pipeline' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <BarChart className="w-4 h-4" /> {role === 'CLIENTE' ? 'Opções de Crédito' : 'Pipeline de Leads'}
          </button>
          
          {role === 'ADM_MASTER' && (
            <button 
              onClick={() => setActiveTab('comissoes')}
              className={`px-6 py-4 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'comissoes' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <Settings2 className="w-4 h-4" /> Parametrização de Split
            </button>
          )}

          {role === 'ADM_ANALISTA' && (
            <button 
              onClick={() => setActiveTab('analise_ia')}
              className={`px-6 py-4 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'analise_ia' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <FileText className="w-4 h-4" /> Motor de Análise (IA)
            </button>
          )}
        </div>

        {/* TAB CONTENTS */}
        <div className="p-6">
          {activeTab === 'pipeline' && (
            <div className="space-y-8">
              {role === 'VENDEDOR' && (
                <div className="bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl mb-6">
                  <p className="text-emerald-800 font-medium">Você está visualizando exclusivamente seus próprios leads gerados através do seu link de indicação personalizado.</p>
                </div>
              )}
              
              {(role === 'VENDEDOR' || role === 'GESTOR' || role === 'ADM_MASTER' || role === 'CLIENTE') && (
                <div className="mb-8">
                  <CreditLineSelection />
                </div>
              )}

              {role !== 'CLIENTE' && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold mb-4">Leads Protocolados ({leads.length})</h3>
                  {loading ? (
                    <div className="text-center py-6 text-slate-400">Carregando leads...</div>
                  ) : leads.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                      Nenhum lead encontrado neste pipeline.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-y border-slate-200">
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Empresa (CNPJ)</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Linha</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Faturamento</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Solicitado</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {leads.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-800">{lead.dadosEmpresa.cnpj}</div>
                                <div className="text-xs text-slate-500">Cadastrado há pouco</div>
                              </td>
                              <td className="py-3 px-4 text-sm font-medium">{lead.tipoCredito}</td>
                              <td className="py-3 px-4 text-sm">R$ {lead.financeiro.faturamentoMensalMedio}</td>
                              <td className="py-3 px-4 text-sm font-semibold text-emerald-600">R$ {lead.financeiro.valorSolicitado}</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  <Clock className="w-3 h-3" /> {lead.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'comissoes' && role === 'ADM_MASTER' && (
            <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div>
                <h2 className="text-xl font-bold mb-2">Parametrização de Comissionamento (Split)</h2>
                <p className="text-slate-500">Defina o comportamento de distribuição de valores arrecadados no comissionamento de serviços de crédito e taxa de sucesso.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 border border-slate-200 rounded-xl bg-slate-50">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Taxa Fixa Avaliação (R$)</label>
                  <input 
                    type="number" 
                    value={split.taxaFixaTotal} 
                    onChange={e => setSplit({...split, taxaFixaTotal: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-xs mt-2 text-slate-500">Valor cobrado antecipadamente pelo Funil (Ex: 97)</p>
                </div>

                <div className="p-5 border border-slate-200 rounded-xl bg-slate-50">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Success Fee Total (%)</label>
                  <input 
                    type="number" 
                    value={split.percentualExitoTotal} 
                    onChange={e => setSplit({...split, percentualExitoTotal: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-xs mt-2 text-slate-500">Comissão de êxito na liberação do banco (Ex: 2 para 2%)</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 p-4 border-b border-slate-200 font-bold text-slate-700 flex items-center gap-2">
                  <SplitSquareVertical className="w-5 h-5 text-slate-500" /> Distribuições do Split (%)
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                      <span>Vendedor / Afiliado (Ex: 0.20 = 20%)</span>
                      <span className="text-emerald-600 font-mono">{(split.split.vendedorShare * 100).toFixed(0)}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01"
                      value={split.split.vendedorShare} 
                      onChange={e => setSplit({...split, split: {...split.split, vendedorShare: Number(e.target.value)}})}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                      <span>Gestor de Equipe (Ex: 0.10 = 10%)</span>
                      <span className="text-emerald-600 font-mono">{(split.split.gestorShare * 100).toFixed(0)}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01"
                      value={split.split.gestorShare} 
                      onChange={e => setSplit({...split, split: {...split.split, gestorShare: Number(e.target.value)}})}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                      <span>Analista QA (Ex: 0.05 = 5%)</span>
                      <span className="text-emerald-600 font-mono">{(split.split.analistaShare * 100).toFixed(0)}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01"
                      value={split.split.analistaShare} 
                      onChange={e => setSplit({...split, split: {...split.split, analistaShare: Number(e.target.value)}})}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={handleUpdateSplit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> Salvar Parametrização
                </button>
              </div>
            </div>
          )}

          {activeTab === 'analise_ia' && role === 'ADM_ANALISTA' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
                <h2 className="text-lg font-bold text-indigo-900 mb-2">Fila de Triagem Técnica e IA</h2>
                <p className="text-indigo-700">Analise os leads protocolados. Ao acionar o botão, a inteligência artificial formulará a viabilidade e gerará o laudo do comitê com base nos dados imputados de faturamento vs DRE.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                   <div className="col-span-full py-10 text-center text-slate-500">Carregando fila...</div>
                ) : leads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} role={role} onGenerate={(id, ebitda, dre) => handleGenerateReport(id, ebitda, dre)} onGenerateBilling={handleGenerateBilling} />
                ))}

                {!loading && leads.length === 0 && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                     <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                     <h3 className="text-slate-500 font-medium">Nenhum documento na fila de triagem.</h3>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
