import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../../firebase";
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { MessageSquare, Send, Shield, User, CheckCircle2, Clock, Search } from "lucide-react";
import Swal from "sweetalert2";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SupportModuleProps {
  nivel: string;
}

const SupportModule: React.FC<SupportModuleProps> = ({ nivel }) => {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Lógica de Filtro por Hierarquia
    let q;
    const ticketsRef = collection(db, "tickets");

    if (nivel === "ADM_MASTER" || nivel === "ADM_ANALISTA") {
      q = query(ticketsRef, orderBy("updatedAt", "desc"));
    } else if (nivel === "GESTOR") {
      q = query(ticketsRef, where("managerId", "==", auth.currentUser.uid), orderBy("updatedAt", "desc"));
    } else if (nivel === "VENDEDOR") {
      q = query(ticketsRef, where("sellerId", "==", auth.currentUser.uid), orderBy("updatedAt", "desc"));
    } else {
      q = query(ticketsRef, where("clientId", "==", auth.currentUser.uid), orderBy("updatedAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [nivel]);

  // Busca mensagens do ticket selecionado
  useEffect(() => {
    if (!selectedTicket) return;
    const q = query(collection(db, `tickets/${selectedTicket.id}/messages`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    
    try {
        await addDoc(collection(db, `tickets/${selectedTicket.id}/messages`), {
          text: newMessage,
          senderId: auth.currentUser?.uid,
          senderName: profile?.nome_completo || nivel,
          timestamp: serverTimestamp()
        });
        
        // Update ticket header
        await updateDoc(doc(db, "tickets", selectedTicket.id), {
          lastMessage: newMessage,
          updatedAt: serverTimestamp(),
          status: nivel === 'CLIENTE' ? 'ABERTO' : 'AGUARDANDO_CLIENTE'
        });

        setNewMessage("");
    } catch (error: any) {
        console.error("Erro ao enviar mensagem:", error);
        Swal.fire("Erro", "Não foi possível enviar a mensagem.", "error");
    }
  };

  const finalizeTicket = async () => {
    if (!selectedTicket) return;
    try {
        await updateDoc(doc(db, "tickets", selectedTicket.id), {
            status: 'RESOLVIDO',
            updatedAt: serverTimestamp()
        });
        Swal.fire("Sucesso", "Ticket finalizado com sucesso!", "success");
    } catch (error: any) {
        Swal.fire("Erro", "Erro ao finalizar ticket.", "error");
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse font-black uppercase text-[10px] tracking-widest text-slate-400">Carregando suporte...</div>;

  return (
    <div className="flex flex-col lg:flex-row h-[700px] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      
      {/* Lista de Conversas */}
      <div className="w-full lg:w-1/3 border-r border-slate-50 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
        <div className="p-6 border-b bg-white dark:bg-slate-900 flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare size={14} />
            Conversas Ativas
          </h4>
          <div className="size-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
            <Search size={14} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {tickets.map(t => (
            <div 
              key={t.id} 
              onClick={() => setSelectedTicket(t)}
              className={`p-5 cursor-pointer transition-all rounded-3xl border ${
                selectedTicket?.id === t.id 
                  ? 'bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-900 shadow-md ring-1 ring-blue-500/20' 
                  : 'hover:bg-white dark:hover:bg-slate-800 border-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <p className="font-black text-slate-800 dark:text-slate-200 text-sm truncate max-w-[180px]">
                    {nivel === 'CLIENTE' ? 'Suporte GSA IA' : (t.clientNome || "Suporte Geral")}
                </p>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                    t.status === 'ABERTO' ? 'bg-amber-100 text-amber-600' :
                    t.status === 'AGUARDANDO_CLIENTE' ? 'bg-blue-100 text-blue-600' :
                    'bg-emerald-100 text-emerald-600'
                }`}>
                    {t.status}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold truncate">
                {t.lastMessage || "Inicie a conversa..."}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[8px] text-slate-300 uppercase font-black">Ticket #{t.id.slice(-5)}</span>
                {t.updatedAt && (
                    <span className="text-[8px] text-slate-300 font-bold">
                        {format(t.updatedAt.toDate(), 'dd/MM HH:mm', { locale: ptBR })}
                    </span>
                )}
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <div className="p-10 text-center text-slate-400 italic text-xs">
              Nenhuma conversa encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Área do Chat */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
        {selectedTicket ? (
          <>
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/20">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
                    <User size={24} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Ticket #{selectedTicket.id.slice(-8)}</p>
                    <h4 className="font-black text-slate-800 dark:text-slate-200 uppercase text-xs">
                        {nivel === 'CLIENTE' ? 'Atendimento Especializado' : `Auditoria: ${selectedTicket.clientNome}`}
                    </h4>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(nivel === "ADM_MASTER" || nivel === "GESTOR") && (
                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-xl border border-amber-100 dark:border-amber-800">
                        <Shield size={14} className="text-amber-600" />
                        <span className="text-[9px] font-black text-amber-600 uppercase italic tracking-widest">Modo Auditoria Ativo</span>
                    </div>
                )}
                {selectedTicket.status !== 'RESOLVIDO' && (nivel === 'ADM_MASTER' || nivel === 'VENDEDOR') && (
                    <button 
                        onClick={finalizeTicket}
                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-100"
                    >
                        Finalizar
                    </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20 dark:bg-slate-900/10">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-5 rounded-3xl shadow-sm relative ${
                    m.senderId === auth.currentUser?.uid 
                        ? 'bg-[#0a0a2e] text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'
                  }`}>
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <p className="text-[9px] font-black uppercase opacity-50 tracking-widest">{m.senderName}</p>
                        {m.timestamp && (
                            <p className="text-[8px] opacity-40 font-bold">
                                {format(m.timestamp.toDate(), 'HH:mm', { locale: ptBR })}
                            </p>
                        )}
                    </div>
                    <p className="font-medium leading-relaxed text-sm">{m.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {selectedTicket.status !== 'RESOLVIDO' && (
                <form onSubmit={sendMessage} className="p-6 border-t flex gap-4 bg-white dark:bg-slate-900">
                    <input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-blue-600 dark:text-slate-200"
                        placeholder="Digite sua mensagem ou instrução técnica..."
                    />
                    <button 
                        type="submit"
                        className="bg-[#0a0a2e] text-white size-14 rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition-all"
                    >
                        <Send size={20} />
                    </button>
                </form>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
            <div className="size-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <MessageSquare size={40} className="text-slate-200" />
            </div>
            <h4 className="text-slate-800 dark:text-slate-200 font-black uppercase text-sm tracking-widest mb-2">Central de Suporte & Auditoria</h4>
            <p className="font-bold text-xs italic text-slate-400 max-w-xs">Selecione uma conversa na lateral para auditar o atendimento ou responder ao cliente.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportModule;
