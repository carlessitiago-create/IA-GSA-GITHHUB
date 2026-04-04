import React from 'react';
import { formatDate as formatAppDate } from '../lib/dateUtils';
import { motion } from 'motion/react';
import { User, Shield, Users, Clock, CheckCircle2 } from 'lucide-react';
import { OrderProcess } from '../services/orderService';
import { UserProfile } from '../services/userService';

interface ProcessHistoryCardProps {
  proc: OrderProcess;
  allUsers: UserProfile[];
}

export const ProcessHistoryCard: React.FC<ProcessHistoryCardProps> = ({ proc, allUsers }) => {
  const salesperson = allUsers.find(u => u.uid === proc.vendedor_id);
  const manager = salesperson?.id_superior ? allUsers.find(u => u.uid === salesperson.id_superior) : null;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatAppDate(date);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div 
      layout
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5 space-y-4"
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm">{proc.servico_nome}</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocolo {proc.protocolo || `#${proc.venda_id.slice(0, 8)}`}</p>
        </div>
        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-black uppercase">
          <CheckCircle2 size={12} />
          {proc.status_atual || 'Proposta Aceita'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
            <User size={10} /> Cliente
          </p>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{proc.cliente_nome || 'N/A'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
            <Shield size={10} /> Gestor
          </p>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{manager?.nome_completo || 'N/A'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
            <Users size={10} /> Vendedor
          </p>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{salesperson?.nome_completo || 'N/A'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
            <Clock size={10} /> Data/Hora
          </p>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {formatDate(proc.data_venda)} às {formatTime(proc.data_venda)}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
