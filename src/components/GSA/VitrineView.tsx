import React, { useEffect, useState } from 'react';
import { 
  PlayCircle, 
  ArrowRight, 
  Verified, 
  Clock, 
  CheckCircle2, 
  X,
  ChevronRight,
  Info,
  LayoutGrid
} from 'lucide-react';
import { ServiceData, listarServicosAtivos } from '../../services/serviceFactory';
import { solicitarOrcamentoVitrine } from '../../services/marketingService';
import { useAuth } from '../AuthContext';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { useOutletContext, useNavigate } from 'react-router-dom';

const getYoutubeId = (url: string) => {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : '';
};

export const VitrineView: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const outletContext = useOutletContext<any>() || {};
  
  const setPreSelectedService = outletContext.setPreSelectedService;

  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);
  const [filter, setFilter] = useState('Todos os Serviços');

  const isSalesRole = profile?.nivel === 'VENDEDOR' || profile?.nivel === 'GESTOR' || profile?.nivel === 'ADM_GERENTE' || profile?.nivel === 'ADM_MASTER';

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await listarServicosAtivos();
        setServices(data);
      } catch (error) {
        console.error('Erro ao carregar vitrine:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const filteredServices = services.filter(s => {
    if (filter === 'Todos os Serviços') return true;
    const search = filter.toLowerCase();
    return s.nome_servico.toLowerCase().includes(search) || s.descricao?.toLowerCase().includes(search);
  });

  const handleAction = async (service: ServiceData) => {
    if (!profile) return;

    if (isSalesRole) {
      // Redirecionar para o PDV com o serviço selecionado
      if (setPreSelectedService) {
        setPreSelectedService(service);
      }
      navigate('/vendas-internas');
      setSelectedService(null);
      return;
    }

    const result = await Swal.fire({
      title: 'Solicitar Orçamento?',
      text: `Seu consultor e o Gestor de Equipe serão notificados sobre seu interesse em: ${service.nome_servico}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, Solicitar!',
      cancelButtonText: 'Agora não',
      confirmButtonColor: '#3b82f6',
      background: '#12122b',
      color: '#fff'
    });

    if (result.isConfirmed) {
      try {
        // O vendedor_id do lead deve ser o id_superior do cliente
        const vendedorId = profile.id_superior || 'ADM';
        
        await solicitarOrcamentoVitrine(
          profile.uid,
          service.id!,
          vendedorId,
          profile.nome_completo || 'Cliente GSA'
        );

        setSelectedService(null);
        
        Swal.fire({
          title: 'Pedido Enviado!',
          html: `<div class="text-left text-xs space-y-2">
                  <p>🟢 <b>Consultor Especialista</b> notificado.</p>
                  <p>🔵 <b>Gestor de Equipe</b> notificado.</p>
                  <p>⚪ <b>ADM Master</b> ciente do interesse.</p>
                 </div>`,
          icon: 'success',
          confirmButtonColor: '#10b981',
          background: '#12122b',
          color: '#fff'
        });
      } catch (error: any) {
        Swal.fire('Erro', 'Não foi possível enviar sua solicitação. Tente novamente.', 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24">
      {/* HERO / DESTAQUE (Layout 4.0) */}
      <section className="relative h-[300px] sm:h-[350px] md:h-[450px] rounded-[2rem] sm:rounded-[3rem] md:rounded-[3.5rem] overflow-hidden flex items-center p-6 sm:p-12 md:p-20 shadow-2xl shadow-blue-900/10 group">
        <img 
          src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1200" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
          alt="Hero Background"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a2e] via-[#0a0a2e]/90 to-transparent"></div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 p-12 opacity-10 hidden md:block">
          <Verified size={200} className="text-white" />
        </div>

        <div className="relative z-10 space-y-6 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 px-4 py-1.5 rounded-full mb-6">
              <div className="size-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Tecnologia GSA IA v4.0</span>
            </div>
            
            <h2 className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-black italic uppercase leading-[0.9] text-white tracking-tighter">
              Inteligência <br/>
              <span className="text-blue-500">para o seu <br className="md:hidden"/> crédito.</span>
            </h2>
            
            <p className="text-slate-300 text-sm md:text-lg max-w-lg mt-6 leading-relaxed font-medium">
              Explore nossos serviços jurídicos e tecnológicos desenhados para proteger seu patrimônio e restaurar sua liberdade financeira.
            </p>

            <div className="flex items-center gap-4 mt-10">
              <button className="px-8 py-4 bg-white text-[#0a0a2e] rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:scale-105 transition-all">
                Ver Catálogo
              </button>
              <button className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-white/20 transition-all">
                Falar com Consultor
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* GRID DE SERVIÇOS (VITRINE) */}
      <section>
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-[#0a0a2e] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <LayoutGrid size={20} className="text-white" />
            </div>
            <h3 className="text-[12px] font-black text-[#0a0a2e] uppercase tracking-[0.3em]">Soluções Disponíveis</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar por:</span>
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white border border-slate-100 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 ring-blue-500/20 transition-all cursor-pointer"
            >
              <option>Todos os Serviços</option>
              <option>Jurídico</option>
              <option>Tecnológico</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredServices.length > 0 ? (
            filteredServices.map((s, idx) => (
              <motion.div 
                key={s.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                onClick={() => setSelectedService(s)}
                className="group bg-white rounded-[2.5rem] p-5 flex flex-col cursor-pointer border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
              >
                <div className="relative rounded-[2rem] overflow-hidden aspect-video mb-6 shadow-inner">
                  <img 
                    src={`https://img.youtube.com/vi/${getYoutubeId(s.video_youtube_url || '')}/maxresdefault.jpg`} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={s.nome_servico}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-[#0a0a2e]/20 group-hover:bg-transparent transition-all duration-500"></div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="size-16 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 shadow-2xl">
                      <PlayCircle className="text-white" size={32} />
                    </div>
                  </div>
                  <div className="absolute top-4 left-4">
                    <span className="bg-[#0a0a2e]/80 backdrop-blur-md text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-white/10">
                      SLA: {s.prazo_sla_dias}D
                    </span>
                  </div>
                </div>

                <div className="px-2 pb-2 space-y-4 flex-1 flex flex-col">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-blue-500">
                      <Verified size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Garantia GSA</span>
                    </div>
                    <h4 className="text-xl font-black italic uppercase text-[#0a0a2e] tracking-tight leading-tight group-hover:text-blue-600 transition-colors">{s.nome_servico}</h4>
                  </div>
                  
                  <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed font-medium flex-1">
                    {s.descricao || 'Descrição do serviço em processo de atualização pela nossa equipe técnica...'}
                  </p>

                  <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                        <Info size={14} />
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-[#0a0a2e] transition-colors">Detalhes Técnicos</span>
                    </div>
                    <div className="size-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-[#0a0a2e] group-hover:text-white transition-all shadow-sm">
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
              <LayoutGrid className="size-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold">Nenhum serviço disponível no momento para este filtro.</p>
            </div>
          )}
        </div>
      </section>

      {/* MODAL DE DETALHES (Layout 4.0) */}
      <AnimatePresence>
        {selectedService && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-6xl rounded-[2rem] sm:rounded-[3rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl border border-slate-100 relative max-h-[95vh] flex flex-col"
            >
              <button 
                onClick={() => setSelectedService(null)}
                className="absolute top-4 right-4 sm:top-8 sm:right-8 z-50 size-10 sm:size-12 bg-white/90 backdrop-blur-md hover:bg-white rounded-full flex items-center justify-center text-[#0a0a2e] shadow-xl border border-slate-100 transition-all"
              >
                <X size={20} className="sm:size-6" />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-12 h-full overflow-y-auto lg:overflow-hidden">
                {/* Vídeo Area */}
                <div className="lg:col-span-7 bg-black relative overflow-hidden aspect-video lg:aspect-auto lg:h-full">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${getYoutubeId(selectedService.video_youtube_url || '')}?autoplay=1&rel=0&modestbranding=1`} 
                    frameBorder="0" 
                    allow="autoplay; encrypted-media" 
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  ></iframe>
                </div>
                
                {/* Info Area */}
                <div className="lg:col-span-5 p-6 sm:p-8 md:p-10 lg:p-14 flex flex-col justify-center bg-white lg:overflow-y-auto lg:h-full">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 rounded-full">
                      <Verified size={16} className="text-blue-600" />
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Protocolo GSA IA Garantido</span>
                    </div>
                    
                    <h3 className="text-3xl md:text-4xl lg:text-5xl font-black italic uppercase text-[#0a0a2e] leading-none tracking-tighter">
                      {selectedService.nome_servico}
                    </h3>
                    
                    <div className="text-slate-500 leading-relaxed text-sm md:text-base font-medium whitespace-pre-wrap">
                      {selectedService.descricao || 'Este serviço utiliza alta tecnologia jurídica e algoritmos proprietários para garantir os melhores resultados para o seu perfil de crédito e proteção patrimonial.'}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-y border-slate-50">
                      <div className="bg-slate-50 p-4 md:p-6 rounded-[2rem] border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Prazo Médio</p>
                        <div className="flex items-center gap-3">
                          <div className="size-8 md:size-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <Clock size={18} className="text-blue-600" />
                          </div>
                          <p className="font-black text-[#0a0a2e] italic text-lg md:text-xl uppercase tracking-tight">
                            {selectedService.prazo_sla_dias} DIAS
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 md:p-6 rounded-[2rem] border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Garantia Ativa</p>
                        <div className="flex items-center gap-3">
                          <div className="size-8 md:size-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          </div>
                          <p className="font-black text-emerald-600 italic text-lg md:text-xl uppercase tracking-tight">
                            100% OK
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={() => setSelectedService(null)}
                        className="flex-1 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all"
                      >
                        Voltar
                      </button>
                      <button 
                        onClick={() => handleAction(selectedService)}
                        className="flex-[2] bg-[#0a0a2e] text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-blue-900/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 group"
                      >
                        {isSalesRole ? 'Realizar Venda' : 'Solicitar Orçamento'}
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
