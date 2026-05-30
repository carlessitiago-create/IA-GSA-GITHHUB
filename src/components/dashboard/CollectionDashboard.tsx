import React from 'react';
import { Mail, MessageCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';
import Swal from 'sweetalert2';

export const CollectionDashboard = ({ sales, clients }: any) => {
  // Filtrar faturas vencidas
  const overdueInvoices = sales.filter((s: any) => s.status_pagamento === 'Vencida');

  // Agrupar por cliente
  const clientDebts = overdueInvoices.reduce((acc: any, curr: any) => {
    const clientId = curr.cliente_id;
    if (!acc[clientId]) {
      acc[clientId] = {
        cliente_nome: curr.cliente_nome,
        cliente_telefone: curr.cliente_telefone || '',
        cliente_email: curr.cliente_email || '',
        total_devido: 0,
        faturas_vencidas: 0,
        dias_maior_atraso: 0,
        faturas: []
      };
    }
    acc[clientId].total_devido += curr.valor_total;
    acc[clientId].faturas_vencidas += 1;
    acc[clientId].faturas.push(curr);
    if (curr.dias_atraso && curr.dias_atraso > acc[clientId].dias_maior_atraso) {
      acc[clientId].dias_maior_atraso = curr.dias_atraso;
    }
    return acc;
  }, {});

  const ranking = Object.values(clientDebts).sort((a: any, b: any) => b.total_devido - a.total_devido);

  const handleWhatsApp = (client: any) => {
    if (!client.cliente_telefone) {
      Swal.fire('Telefone não encontrado', 'O cliente não possui um telefone cadastrado.', 'warning');
      return;
    }
    const phone = client.cliente_telefone.replace(/\D/g, '');
    let text = `Olá, ${client.cliente_nome}. Identificamos que há ${client.faturas_vencidas > 1 ? 'faturas vencidas' : 'uma fatura vencida'} no valor total de R$ ${client.total_devido.toFixed(2).replace('.', ',')}. Por favor, regularize sua situação para evitar o bloqueio dos serviços.`;
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleEmail = (client: any) => {
    if (!client.cliente_email) {
      Swal.fire('E-mail não encontrado', 'O cliente não possui um e-mail cadastrado.', 'warning');
      return;
    }
    const subject = `Aviso de Fatura Vencida - GSA`;
    let body = `Olá, ${client.cliente_nome}.\n\nIdentificamos que há ${client.faturas_vencidas > 1 ? 'faturas vencidas' : 'uma fatura vencida'} no valor total de R$ ${client.total_devido.toFixed(2).replace('.', ',')}.\n\nPor favor, regularize sua situação o mais breve possível para não ter seus processos paralisados.\n\nAtenciosamente,\nFinanceiro GSA`;
    const url = `mailto:${client.cliente_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  if (ranking.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl sm:rounded-2xl border border-rose-100 overflow-hidden shadow-sm transition-all hover:shadow-md mb-8">
      <div className="p-6 sm:p-8 md:p-6 border-b border-rose-50 bg-rose-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 bg-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">Ranking de Inadimplência</h3>
            <p className="text-rose-500 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-1 sm:mt-2">Top Clientes Devedores</p>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-white text-slate-400 border-b border-slate-50">
               <th className="px-5 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-center w-12">Rank</th>
               <th className="px-5 py-4 font-black uppercase text-[10px] tracking-[0.2em]">Cliente</th>
               <th className="px-5 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-right">Valor em Aberto</th>
               <th className="px-5 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-center">Faturas</th>
               <th className="px-5 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-center">Maior Atraso</th>
               <th className="px-5 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-right">Notificação Expressa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ranking.map((client: any, index: number) => (
              <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-5 py-4 text-center">
                  <span className={`text-[12px] font-black px-3 py-1 rounded border uppercase tracking-widest ${
                    index === 0 ? 'bg-rose-100 text-rose-700 border-rose-200' :
                    index === 1 ? 'bg-orange-100 text-orange-700 border-orange-200' : 
                    index === 2 ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                    'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    #{index + 1}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight">{client.cliente_nome}</p>
                </td>
                <td className="px-5 py-4 text-right">
                  <p className="text-base font-black text-rose-600 italic tracking-tighter">R$ {client.total_devido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </td>
                <td className="px-5 py-4 text-center">
                   <span className="text-xs font-black text-slate-600">{client.faturas_vencidas} pendentes</span>
                </td>
                <td className="px-5 py-4 text-center">
                   <span className="text-xs font-black text-rose-600">{client.dias_maior_atraso} dias</span>
                </td>
                <td className="px-5 py-4 text-right">
                   <div className="flex items-center justify-end gap-2">
                     <button
                       onClick={() => handleWhatsApp(client)}
                       className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-100"
                       title="Cobrar via WhatsApp"
                     >
                       <MessageCircle size={18} />
                     </button>
                     <button
                       onClick={() => handleEmail(client)}
                       className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-blue-100"
                       title="Cobrar via E-mail"
                     >
                       <Mail size={18} />
                     </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
