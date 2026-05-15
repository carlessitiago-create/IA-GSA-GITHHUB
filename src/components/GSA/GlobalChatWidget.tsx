import React, { useState } from 'react';
import { MessageSquare, Phone, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

const GlobalChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Número do Whaticket / WhatsApp da Central (Exemplo, o cliente configuraria isso no sistema)
  const WHATSAPP_NUMBER = '5511999999999';

  const handleWhatsApp = () => {
    const text = encodeURIComponent('Olá, vim pelo aplicativo e preciso falar com a central!');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
    setIsOpen(false);
  };

  const handleInternalChat = () => {
    navigate('/suporte');
    setIsOpen(false);
  };

  const isAdmin = profile?.nivel === 'ADM_MASTER' || profile?.nivel === 'GESTOR' || profile?.nivel === 'ADM_GERENTE' || profile?.nivel === 'ADM_ANALISTA';

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Popover */}
      {isOpen && (
        <div className="mb-4 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 border border-slate-100 dark:border-slate-800 w-[300px] transform origin-bottom-right transition-all animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-black text-[#0a0a2e] dark:text-white uppercase tracking-widest text-xs">
              Atendimento Multi-canal
            </h4>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
              <X size={18} />
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-6 italic">
            {isAdmin 
              ? "Acesse o painel de suporte para gerenciar os tickets abertos pelos clientes ou equipe."
              : "Como prefere falar com nossa central?"}
          </p>

          <div className="space-y-3">
            {!isAdmin && (
              <button 
                onClick={handleWhatsApp}
                className="w-full flex items-center gap-4 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-2xl transition-all shadow-md hover:shadow-lg group"
              >
                <div className="bg-white/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
                  <Phone size={20} className="fill-current" />
                </div>
                <div className="text-left">
                  <p className="font-black text-xs uppercase tracking-widest">Nosso WhatsApp</p>
                  <p className="text-[10px] font-bold opacity-80">Rápido e prático</p>
                </div>
              </button>
            )}

            <button 
              onClick={handleInternalChat}
              className="w-full flex items-center gap-4 bg-[#0a0a2e] hover:bg-blue-900 text-white p-4 rounded-2xl transition-all shadow-md hover:shadow-lg group"
            >
              <div className="bg-white/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
                <MessageCircle size={20} />
              </div>
              <div className="text-left">
                <p className="font-black text-xs uppercase tracking-widest">
                  {isAdmin ? 'Painel de Chats' : 'Chat pelo App'}
                </p>
                <p className="text-[10px] font-bold opacity-80">
                  {isAdmin ? 'Responder Tickets Internos' : 'Histórico salvo no app'}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`${isOpen ? 'bg-rose-500 rotate-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:-translate-y-1'} text-white size-16 rounded-[1.5rem] flex items-center justify-center shadow-[0_10px_40px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_50px_rgba(37,99,235,0.6)] transition-all duration-300 z-50 group border-2 border-white/20`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} className="group-hover:scale-110 transition-transform duration-300" />}
      </button>
    </div>
  );
};

export default GlobalChatWidget;
