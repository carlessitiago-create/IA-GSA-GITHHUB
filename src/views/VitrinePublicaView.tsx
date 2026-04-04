import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { 
  listarServicosVitrine, 
  ShowcaseService, 
  solicitarOrcamentoVitrine,
  criarIndicacao
} from '../services/marketingService';
import { listarServicosAtivos, ServiceData } from '../services/serviceFactory';
import { 
  ShoppingBag, 
  CheckCircle, 
  ArrowRight, 
  Star, 
  ShieldCheck, 
  Zap,
  MessageSquare,
  Phone,
  Mail,
  User,
  Loader2,
  ChevronRight,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export const VitrinePublicaView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const referrerId = searchParams.get('ref');
  
  const [services, setServices] = useState<ShowcaseService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ShowcaseService | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const [showcaseData, factoryData] = await Promise.all([
          listarServicosVitrine(),
          listarServicosAtivos()
        ]);
        
        // Map factory services to showcase format
        const mappedFactoryServices: ShowcaseService[] = factoryData.map(s => ({
          id: s.id,
          titulo: s.nome_servico,
          descricao_curta: s.descricao || 'Solução de alta performance GSA Intelligence.',
          descricao_longa: s.descricao || '',
          imagem_capa_url: s.video_thumbnail_url || `https://img.youtube.com/vi/${getYoutubeId(s.video_youtube_url || '')}/maxresdefault.jpg`,
          ativo: s.ativo,
          modelo_id: s.id // Use original ID as model reference
        }));

        // Combine both, avoiding duplicates if any
        const combined = [...showcaseData];
        mappedFactoryServices.forEach(fs => {
          if (!combined.find(c => c.titulo === fs.titulo)) {
            combined.push(fs);
          }
        });

        setServices(combined);
        
        if (referrerId) {
          // Note: This will only work if the user is authenticated or if 'usuarios' has public read access.
          // Since it's a public vitrine, we might need a different way to get the referrer name
          // or just ignore it if it fails due to permissions.
          try {
            const refDoc = await getDoc(doc(db, 'usuarios', referrerId));
            if (refDoc.exists()) {
              setReferrerName(refDoc.data().nome_completo);
            }
          } catch (e) {
            console.log("Could not fetch referrer name (likely permission denied for public user)");
          }
        }
      } catch (error) {
        console.error("Erro ao carregar vitrine:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const handleRequestQuote = (service: ShowcaseService) => {
    setSelectedService(service);
    setShowForm(true);
  };

  const getYoutubeId = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    setIsSubmitting(true);
    try {
      // Se houver um referrerId, podemos usar ele como vendedor_id inicial ou apenas registrar a origem
      // Por padrão, se não houver vendedor definido no serviço, usamos 'ADM'
      const vendedorId = 'ADM';

      await solicitarOrcamentoVitrine(
        'PUBLIC_LEAD', // ID temporário para leads não logados
        selectedService.id!,
        vendedorId, // Vendedor padrão para leads da vitrine
        formData.nome,
        referrerId || undefined,
        formData.email,
        formData.telefone
      );

      // Aqui criamos um registro na coleção 'referrals' se houver referrerId
      if (referrerId) {
        await criarIndicacao({
          cliente_origem_id: referrerId,
          origem_tipo: 'CLIENTE', // Assumindo que o link é de cliente
          nome_indicado: formData.nome,
          telefone_indicado: formData.telefone,
          email_indicado: formData.email,
          vendedor_id: 'ADM', // Será atribuído depois
          bonus_valor: 150, // Valor padrão ou buscar da config
          metodo_indicacao: 'VITRINE'
        });
      }

      Swal.fire({
        title: 'Solicitação Enviada!',
        text: 'Recebemos seu interesse. Um de nossos especialistas entrará em contato em breve via WhatsApp ou E-mail.',
        icon: 'success',
        confirmButtonColor: '#2563eb'
      });

      setShowForm(false);
      setFormData({ nome: '', email: '', telefone: '' });
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      Swal.fire('Erro', 'Não foi possível processar sua solicitação agora.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="size-10 text-blue-600 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando Vitrine GSA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Zap className="text-white size-6" />
            </div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
              GSA <span className="text-blue-600">Intelligence</span>
            </h1>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#servicos" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">Serviços</a>
            <a href="#sobre" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">Sobre Nós</a>
            <button className="bg-slate-900 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
              Falar com Consultor
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-3xl space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100"
            >
              <Target className="text-blue-600 size-4" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                {referrerName ? `Indicação de ${referrerName}` : 'Soluções de Alta Performance'}
              </span>
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9] text-slate-900"
            >
              Transforme sua <br />
              <span className="text-blue-600 underline decoration-blue-200 underline-offset-8">Operação Digital</span>
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-500 max-w-xl leading-relaxed"
            >
              A GSA oferece as ferramentas e inteligência necessárias para escalar seu negócio com automação, CRM e estratégias de marketing avançadas.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <a href="#servicos" className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                Ver Serviços <ArrowRight size={18} />
              </a>
            </motion.div>
          </div>
        </div>
        
        {/* Abstract Background Elements */}
        <div className="absolute right-0 top-0 w-1/2 h-full bg-slate-50 -z-0 rounded-l-[10rem] hidden lg:block" />
        <div className="absolute right-20 top-1/2 -translate-y-1/2 size-96 bg-blue-600/5 rounded-full blur-3xl -z-0" />
      </section>

      {/* SERVICES GRID */}
      <section id="servicos" className="py-20 md:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <div className="space-y-4">
              <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900">
                Nossas <span className="text-blue-600">Soluções</span>
              </h3>
              <p className="text-slate-500 max-w-md">Escolha o serviço ideal para o momento atual da sua empresa.</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                <ShieldCheck className="text-emerald-500 size-4" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Garantia GSA</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, idx) => (
              <motion.div 
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group"
              >
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src={service.imagem_capa_url || 'https://picsum.photos/seed/tech/800/600'} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    alt={service.titulo}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-lg">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                      <Zap size={12} /> Destaque
                    </span>
                  </div>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                      {service.titulo}
                    </h4>
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                      {service.descricao_curta}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 py-4 border-y border-slate-50">
                    <div className="flex -space-x-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="size-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                          <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">+150 contratações este mês</p>
                  </div>

                  <button 
                    onClick={() => handleRequestQuote(service)}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-600 transition-all flex items-center justify-center gap-3 group/btn"
                  >
                    Solicitar Orçamento <ChevronRight className="group-hover/btn:translate-x-1 transition-transform" size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="text-white size-6" />
              </div>
              <h1 className="text-xl font-black uppercase italic tracking-tighter">
                GSA <span className="text-blue-600">Intelligence</span>
              </h1>
            </div>
            <p className="text-slate-400 max-w-sm leading-relaxed">
              Líder em soluções de inteligência de negócios e automação comercial para empresas que buscam o próximo nível.
            </p>
          </div>
          
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-500">Links Úteis</h4>
            <ul className="space-y-4">
              <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Termos de Uso</a></li>
              <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Privacidade</a></li>
              <li><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Trabalhe Conosco</a></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-500">Contato</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-slate-400">
                <Phone size={16} className="text-blue-500" /> (11) 99999-9999
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-400">
                <Mail size={16} className="text-blue-500" /> contato@gsaintelligence.com
              </li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 pt-20 mt-20 border-t border-white/5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            © 2026 GSA Intelligence - Todos os direitos reservados
          </p>
        </div>
      </footer>

      {/* FORM MODAL */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Solicitar Orçamento</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Serviço: <span className="text-blue-600">{selectedService?.titulo}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setShowForm(false)} 
                  className="size-12 flex items-center justify-center bg-white hover:bg-slate-100 rounded-full shadow-sm border border-slate-100 transition-all"
                >
                  <CheckCircle className="text-slate-400 size-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Seu Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text" 
                      placeholder="Como podemos te chamar?"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="email" 
                      placeholder="exemplo@empresa.com"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">WhatsApp / Telefone</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="tel" 
                      placeholder="(00) 00000-0000"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando...' : (
                      <>
                        <ShoppingBag size={18} />
                        Confirmar Interesse
                      </>
                    )}
                  </button>
                </div>
                
                <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">
                  Ao clicar em confirmar, você concorda com nossos termos de privacidade.
                </p>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
