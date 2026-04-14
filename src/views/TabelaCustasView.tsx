import React, { useEffect, useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Shield, 
  Users, 
  Save, 
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Package
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../components/AuthContext';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';

export const TabelaCustasView: React.FC = () => {
  const { profile } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [margins, setMargins] = useState<Record<string, number>>({});

  const role = profile?.nivel || 'CLIENTE';
  const isAdm = role.startsWith('ADM');
  const isGestor = role === 'GESTOR';
  const isVendedor = role === 'VENDEDOR';

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('nome_servico', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const servicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(servicesData);
      
      // Initialize local margins state
      const initialMargins: Record<string, number> = {};
      servicesData.forEach((s: any) => {
        if (isAdm) {
          initialMargins[s.id] = s.preco_base_gestor || 0;
        } else if (isGestor || isVendedor) {
          initialMargins[s.id] = s.preco_base_vendedor || 0;
        }
      });
      setMargins(initialMargins);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAdm, isGestor, isVendedor]);

  const handleUpdatePrice = async (serviceId: string) => {
    if (isVendedor) return;
    const newPrice = margins[serviceId];
    const service = services.find(s => s.id === serviceId);
    
    if (!service) return;

    // Validation Rules
    if (isAdm) {
      // ADM sets base cost for Gestor
      // No upper limit for ADM, but must be positive
      if (newPrice < 0) {
        return Swal.fire('Erro', 'O valor não pode ser negativo.', 'error');
      }
    } else if (isGestor) {
      // Gestor sets price for Vendedor
      const baseCost = service.preco_base_gestor || 0;
      const maxPrice = baseCost * 1.5;

      if (newPrice < baseCost) {
        return Swal.fire('Erro', `O valor de venda não pode ser menor que o custo de R$ ${baseCost.toLocaleString('pt-BR')}.`, 'error');
      }

      if (newPrice > maxPrice) {
        return Swal.fire('Erro', `A margem não pode ultrapassar 50% do valor das custas (Máximo: R$ ${maxPrice.toLocaleString('pt-BR')}).`, 'error');
      }
    }

    setSaving(serviceId);
    try {
      const updateData: any = {};
      if (isAdm) {
        updateData.preco_base_gestor = newPrice;
      } else if (isGestor) {
        updateData.preco_base_vendedor = newPrice;
      }

      await updateDoc(doc(db, 'services', serviceId), updateData);
      
      Swal.fire({
        title: 'Sucesso!',
        text: 'Tabela de custas atualizada.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        background: '#0a0a2e',
        color: '#fff'
      });
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER ESTRATÉGICO */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0a0a2e] p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl"
      >
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 px-4 py-1.5 rounded-full">
              <DollarSign className="text-blue-400 size-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Gestão de Margens e Custas</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tighter leading-none">
              Tabela de <br/>
              <span className="text-blue-400">Custas.</span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-md font-medium opacity-80">
              {isAdm 
                ? 'Defina o custo base dos processos para seus Gestores. Este valor será a base para o markup deles.' 
                : 'Defina o preço de venda para seus Vendedores. Lembre-se: a margem máxima permitida é de 50% sobre o custo base.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-6 rounded-3xl text-center">
              <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Serviços Ativos</p>
              <p className="text-3xl font-black text-white">{services.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-6 rounded-3xl text-center">
              <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-1">Margem Máxima</p>
              <p className="text-3xl font-black text-white">50%</p>
            </div>
          </div>
        </div>
        <DollarSign className="absolute -right-20 -bottom-20 text-white/5 size-80 rotate-12 pointer-events-none" />
      </motion.div>

      {/* ALERTA DE REGRAS */}
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-start gap-4">
        <div className="size-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Regras de Precificação</h4>
          <ul className="mt-2 space-y-1">
            <li className="text-xs text-amber-800 font-medium flex items-center gap-2">
              <div className="size-1 bg-amber-400 rounded-full"></div>
              O valor de venda nunca poderá ser menor que o valor de custo.
            </li>
            <li className="text-xs text-amber-800 font-medium flex items-center gap-2">
              <div className="size-1 bg-amber-400 rounded-full"></div>
              A margem de lucro (markup) não pode ultrapassar 50% do valor das custas.
            </li>
          </ul>
        </div>
      </div>

      {/* TABELA DE CUSTAS */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Package className="text-blue-600" size={20} />
            </div>
            <h3 className="text-lg font-black italic uppercase text-[#0a0a2e] tracking-tight">Catálogo de Serviços</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Custo Base (ADM)</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Preço Vendedor</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Margem Atual</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {services.map((service) => {
                const baseCost = service.preco_base_gestor || 0;
                const currentPrice = margins[service.id] || 0;
                const marginPercent = baseCost > 0 ? ((currentPrice - baseCost) / baseCost) * 100 : 0;
                const isInvalid = isGestor && (currentPrice < baseCost || marginPercent > 50);

                return (
                  <tr key={service.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight">{service.nome_servico}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SLA: {service.prazo_sla_dias} Dias</p>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="text-sm font-bold text-slate-600">
                        R$ {baseCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <div className={`relative flex items-center max-w-[160px] ${isInvalid ? 'animate-shake' : ''}`}>
                          <span className="absolute left-4 text-xs font-bold text-slate-400">R$</span>
                          <input 
                            type="number"
                            value={margins[service.id]}
                            disabled={isVendedor}
                            onChange={(e) => setMargins(prev => ({ ...prev, [service.id]: parseFloat(e.target.value) }))}
                            className={`w-full bg-slate-50 border-2 rounded-2xl py-3 pl-10 pr-4 text-sm font-black text-[#0a0a2e] outline-none transition-all ${
                              isInvalid ? 'border-rose-500 bg-rose-50' : 
                              isVendedor ? 'border-transparent bg-slate-100 cursor-not-allowed' :
                              'border-transparent focus:border-blue-600 focus:bg-white'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        marginPercent > 50 ? 'bg-rose-100 text-rose-600' : 
                        marginPercent > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {marginPercent > 0 ? <ArrowUpRight size={10} /> : null}
                        {marginPercent.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {!isVendedor && (
                        <button 
                          onClick={() => handleUpdatePrice(service.id)}
                          disabled={saving === service.id || isInvalid}
                          className={`p-3 rounded-xl transition-all ${
                            isInvalid ? 'bg-slate-100 text-slate-300 cursor-not-allowed' :
                            'bg-[#0a0a2e] text-white hover:scale-110 active:scale-95 shadow-lg shadow-blue-900/20'
                          }`}
                        >
                          {saving === service.id ? (
                            <div className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <Save size={20} />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
