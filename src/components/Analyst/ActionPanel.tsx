import React from 'react';
import { db, auth } from "../../firebase";
import { doc, updateDoc, collection, addDoc, Timestamp } from "firebase/firestore";
import Swal from "sweetalert2";
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ActionPanelProps {
  venda: any;
  onUpdate?: () => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ venda, onUpdate }) => {
  const abrirPendencia = async () => {
    const { value: texto } = await Swal.fire({
      title: "Descrever Pendência",
      input: "textarea",
      inputPlaceholder: "Explique o problema com o documento ou processo...",
      showCancelButton: true,
      confirmButtonColor: "#ef4444", // Vermelho de Alerta
      confirmButtonText: "BLOQUEAR E NOTIFICAR",
      cancelButtonText: "Cancelar",
      customClass: {
        container: 'font-sans',
        popup: 'rounded-[2rem]',
        confirmButton: 'rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest',
        cancelButton: 'rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest'
      }
    });

    if (texto) {
      try {
        // 1. Cria a pendência no banco (usando a coleção 'pendencies' padrão do projeto)
        await addDoc(collection(db, "pendencies"), {
          venda_id: venda.id,
          cliente_id: venda.cliente_id || '',
          clienteNome: venda.cliente_nome || venda.nome_cliente || 'Cliente',
          descricao: texto,
          vendedor_id: venda.vendedor_id || venda.vendedorId || '',
          vendedorNome: venda.vendedor_nome || venda.vendedorNome || 'Vendedor',
          id_superior: venda.id_superior || venda.managerId || '',
          status_pendencia: 'AGUARDANDO_GESTOR',
          criadaPor: auth.currentUser?.email,
          criadaEm: Timestamp.now(),
          criado_por_id: auth.currentUser?.uid,
          timestamp: Timestamp.now()
        });

        // 2. Trava o status da venda para 'PENDENCIA' (usando a coleção 'sales' padrão do projeto)
        await updateDoc(doc(db, "sales", venda.id), {
          status: "PENDENCIA"
        });

        Swal.fire({
          icon: "success",
          title: "Notificado!",
          text: "O Vendedor e o Gestor receberam um alerta crítico.",
          confirmButtonColor: "#0a0a2e",
          customClass: {
            popup: 'rounded-[2rem]',
            confirmButton: 'rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest'
          }
        });
        
        if (onUpdate) onUpdate();
      } catch (e: any) {
        console.error("Erro ao abrir pendência:", e);
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: e.message,
          confirmButtonColor: "#0a0a2e"
        });
      }
    }
  };

  const confirmarPagamento = async () => {
    const result = await Swal.fire({
      title: "Confirmar Recebimento?",
      text: `Você confirma que o pagamento de R$ ${venda.valor_total.toLocaleString('pt-BR')} foi recebido via ${venda.metodo_pagamento}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981", // Verde Sucesso
      confirmButtonText: "SIM, CONFIRMAR PAGAMENTO",
      cancelButtonText: "Cancelar",
      customClass: {
        container: 'font-sans',
        popup: 'rounded-[2rem]',
        confirmButton: 'rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest',
        cancelButton: 'rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest'
      }
    });

    if (result.isConfirmed) {
      try {
        // 1. Atualiza o status da venda para 'Pago'
        await updateDoc(doc(db, "sales", venda.id), {
          status_pagamento: "Pago",
          confirmado_por: auth.currentUser?.uid,
          confirmado_em: Timestamp.now()
        });

        // 2. Tenta encontrar o processo vinculado e atualizar o status financeiro dele
        const { query, collection, where, getDocs } = await import('firebase/firestore');
        const qProc = query(collection(db, 'order_processes'), where('venda_id', '==', venda.id));
        const snapProc = await getDocs(qProc);
        
        if (!snapProc.empty) {
          const procDoc = snapProc.docs[0];
          await updateDoc(doc(db, 'order_processes', procDoc.id), {
            status_financeiro: 'PAGO',
            // Se o processo estava parado por falta de pagamento, podemos avançar o status_atual
            // mas geralmente deixamos o analista decidir no OperationalView.
            // Aqui apenas garantimos que o financeiro está OK.
          });
        }

        Swal.fire({
          icon: "success",
          title: "Pagamento Confirmado!",
          text: "A venda foi marcada como Paga e o processo foi liberado.",
          confirmButtonColor: "#0a0a2e",
          customClass: {
            popup: 'rounded-[2rem]',
            confirmButton: 'rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest'
          }
        });
        
        if (onUpdate) onUpdate();
      } catch (e: any) {
        console.error("Erro ao confirmar pagamento:", e);
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: e.message,
          confirmButtonColor: "#0a0a2e"
        });
      }
    }
  };

  return (
    <div className="flex gap-2 justify-end">
      {venda.status_pagamento === 'Pendente' && (
        <button
          onClick={confirmarPagamento}
          className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-100 shadow-sm hover:shadow-md"
        >
          <CheckCircle size={14} />
          Confirmar Pagamento
        </button>
      )}
      <button
        onClick={abrirPendencia}
        className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-rose-100 shadow-sm hover:shadow-md"
      >
        <AlertCircle size={14} />
        Abrir Pendência
      </button>
    </div>
  );
};

export default ActionPanel;
