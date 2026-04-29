import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Package, CreditCard, ChevronRight, ChevronLeft, 
  HelpCircle, CheckCircle, AlertTriangle, Clock, Upload, Copy, Check,
  ShoppingBag
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../components/AuthContext';
import { useServices } from '../hooks/useServices';
import { useClients } from '../hooks/useClients';
import { validateDocument, formatDocument, validatePhone, formatPhone } from '../utils/validators';
import { processarVendaSeguraFront } from '../services/vendaService';
import { verificarPropriedadeLead } from '../services/leadService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function NewSalePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { services } = useServices();
  const { clients } = useClients(profile, profile?.nivel?.startsWith('ADM'));

  // ESTADOS DO WIZARD
  const [saleStep, setSaleStep] = useState<1 | 2 | 3>(1);
  const [saleMode, setSaleMode] = useState<'CHECK' | 'SELECT'>('CHECK');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // DADOS DO CLIENTE
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState('');

  // DADOS DA VENDA
  const [selectedService, setSelectedService] = useState<any>(null);
  const [valorVenda, setValorVenda] = useState(0);
  const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'CARTEIRA'>('PIX');
  const [comprovanteUrl, setComprovanteUrl] = useState('');

  const activeServices = services.filter((s: any) => s.ativo && s.ciclo_status === 'LIBERADO');

  const handleCheckLead = async () => {
    if (!documento || !telefone) return;
    setIsSubmitting(true);
    try {
      const result = await verificarPropriedadeLead(documento, telefone, profile.uid);
      setCheckResult(result);
      if (result.status === 'DONO_PROPRIO' && result.clientId) {
          const c = clients.find((cli: any) => cli.id === result.clientId);
          if (c) setNome(c.nome);
      }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleFinalizarVenda = async () => {
    setIsSubmitting(true);
    try {
      const clientId = saleMode === 'SELECT' ? selectedClientId : checkResult?.clientId;
      
      const result = await processarVendaSeguraFront(
        clientId,
        selectedService.id,
        valorVenda,
        metodoPagamento
      );

      // Salva o managerId na venda para filtros de equipe
      if (profile) {
        try {
          const updateData: any = {
            vendedor_id: profile.uid,
            vendedor_nome: profile.nome_completo
          };
          if (profile.id_superior) {
            updateData.id_superior = profile.id_superior;
          }
          await updateDoc(doc(db, 'sales', result.saleId), updateData);
        } catch (err) {
          console.error("Erro ao vincular gestor/vendedor à venda:", err);
        }
      }

      Swal.fire('Sucesso!', `Venda registrada. Protocolo: ${result.protocolo}`, 'success');
      navigate('/processes_history');
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        {/* INDICADOR DE PASSOS */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between">
           {[1, 2, 3].map(step => (
             <div key={step} className={`flex items-center gap-3 ${saleStep >= step ? 'text-blue-600' : 'text-slate-300'}`}>
                <div className={`size-10 rounded-full flex items-center justify-center font-black ${saleStep >= step ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  {step}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">
                  {step === 1 ? 'Cliente' : step === 2 ? 'Serviço' : 'Pagamento'}
                </span>
             </div>
           ))}
        </div>

        <div className="p-10">
          {/* PASSO 1 */}
          {saleStep === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button onClick={() => setSaleMode('CHECK')} className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${saleMode === 'CHECK' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-400'}`}>Novo Lead</button>
                <button onClick={() => setSaleMode('SELECT')} className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${saleMode === 'SELECT' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-400'}`}>Minha Base</button>
              </div>

              {saleMode === 'CHECK' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Documento (CPF/CNPJ)</label>
                    <input type="text" value={documento} onChange={e => setDocumento(formatDocument(e.target.value))} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">WhatsApp</label>
                    <input type="text" value={telefone} onChange={e => setTelefone(formatPhone(e.target.value))} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="(00) 00000-0000" />
                  </div>
                  <button onClick={handleCheckLead} className="md:col-span-2 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-600/20">Verificar Carteira</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Selecione o Cliente</label>
                  <select onChange={e => {setSelectedClientId(e.target.value); setCheckResult({status: 'DONO_PROPRIO'});}} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione...</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.nome} - {c.documento}</option>)}
                  </select>
                </div>
              )}

              {checkResult && (
                <div className={`p-6 rounded-2xl border ${checkResult.status === 'LIVRE' || checkResult.status === 'DONO_PROPRIO' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                   <p className="font-black text-sm uppercase flex items-center gap-2">
                     {checkResult.status === 'LIVRE' ? <><CheckCircle className="text-emerald-600"/> Carteira Livre!</> : <><AlertTriangle className="text-red-600"/> Bloqueio de Carteira!</>}
                   </p>
                   {checkResult.status === 'LIVRE' && (
                     <button onClick={() => setSaleStep(2)} className="mt-4 w-full py-3 bg-emerald-600 text-white rounded-xl font-bold">Continuar para Serviços</button>
                   )}
                </div>
              )}
            </motion.div>
          )}

          {/* PASSO 2 */}
          {saleStep === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeServices.map((s: any) => (
                    <button key={s.id} onClick={() => {setSelectedService(s); setValorVenda(profile.nivel === 'VENDEDOR' ? s.preco_base_vendedor : s.preco_base_gestor);}} 
                      className={`p-6 rounded-3xl border-2 text-left transition-all ${selectedService?.id === s.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>
                      <p className="font-black uppercase text-sm">{s.nome_servico}</p>
                      <p className="text-[10px] text-slate-500 font-bold mt-1 italic">{s.prazo_sla_dias} dias úteis</p>
                    </button>
                  ))}
               </div>
               {selectedService && (
                 <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-[2rem] space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Valor de Venda (R$)</label>
                    <input type="number" value={valorVenda} onChange={e => setValorVenda(Number(e.target.value))} className="w-full text-3xl font-black bg-transparent border-none focus:ring-0" />
                    <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-400 uppercase">Sua Margem:</span>
                       <span className="text-lg font-black text-emerald-600">R$ {(valorVenda - (profile.nivel === 'VENDEDOR' ? selectedService.preco_base_vendedor : selectedService.preco_base_gestor)).toLocaleString('pt-BR')}</span>
                    </div>
                 </div>
               )}
               <div className="flex gap-4">
                  <button onClick={() => setSaleStep(1)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs">Voltar</button>
                  <button onClick={() => setSaleStep(3)} disabled={!selectedService} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-600/20">Próximo</button>
               </div>
            </motion.div>
          )}

          {/* PASSO 3 */}
          {saleStep === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setMetodoPagamento('PIX')} className={`p-8 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${metodoPagamento === 'PIX' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                    <CreditCard size={32} />
                    <span className="font-black uppercase text-[10px]">Pagar com PIX</span>
                 </button>
                 <button onClick={() => setMetodoPagamento('CARTEIRA')} className={`p-8 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${metodoPagamento === 'CARTEIRA' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                    <ShoppingBag size={32} />
                    <span className="font-black uppercase text-[10px]">Débito em Carteira</span>
                 </button>
               </div>

               <button onClick={handleFinalizarVenda} disabled={isSubmitting} className="w-full py-6 bg-emerald-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-600/20 hover:scale-[1.02] transition-all">
                  {isSubmitting ? 'Processando...' : 'Confirmar e Finalizar'}
               </button>
               <button onClick={() => setSaleStep(2)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest">Voltar para valores</button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}