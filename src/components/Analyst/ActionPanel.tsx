import React from 'react';
import { db, auth } from "../../firebase";
import { doc, updateDoc, collection, addDoc, Timestamp } from "firebase/firestore";
import Swal from "sweetalert2";
import { AlertCircle } from 'lucide-react';

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

  return (
    <div className="flex gap-2">
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
