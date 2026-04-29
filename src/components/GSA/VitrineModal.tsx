import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';

interface VitrineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (service: any) => void;
  service: any;
  isSubmitting?: boolean;
}

export const VitrineModal: React.FC<VitrineModalProps> = ({ isOpen, onClose, onConfirm, service, isSubmitting }) => {
  if (!isOpen || !service) return null;

  const getYTId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = service.video_url ? getYTId(service.video_url) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl mx-4"
      >
        <div className="aspect-video bg-black relative">
          {videoId ? (
            <iframe 
              className="w-full h-full" 
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} 
              frameBorder="0" 
              allow="autoplay; encrypted-media" 
              allowFullScreen
            ></iframe>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
              <span className="text-slate-400 font-bold italic">Vídeo não disponível</span>
            </div>
          )}
        </div>
        <div className="p-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2 italic uppercase">{service.nome}</h3>
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase">
                <span className="material-symbols-outlined text-sm">verified</span>
                Serviço com Garantia GSA
              </div>
            </div>
            <button onClick={onClose} className="size-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-red-100 hover:text-red-600 transition-all">
              <X size={20} />
            </button>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg mb-10">{service.descricao}</p>
          <div className="flex gap-4">
            <button 
              onClick={() => onConfirm(service)}
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white px-8 py-5 rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-1 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Solicitando...' : 'Solicitar Orçamento Agora'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
