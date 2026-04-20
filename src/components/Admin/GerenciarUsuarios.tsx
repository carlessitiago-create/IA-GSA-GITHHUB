import React, { useState, useEffect } from "react";
import { db, firebaseConfig } from "../../firebase"; // Importe sua config
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";
import Swal from "sweetalert2";
import { UserPlus, Mail, Lock, Shield, Users, ArrowRight, Loader2, Edit3 } from "lucide-react";
import { motion } from "motion/react";
import { UserProfile, useAuth } from "../AuthContext";

interface GerenciarUsuariosProps {
  userToEdit?: UserProfile | null;
  onSuccess?: () => void;
}

const GerenciarUsuarios: React.FC<GerenciarUsuariosProps> = ({ userToEdit, onSuccess }) => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [password, setPassword] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [role, setRole] = useState("VENDEDOR");
  const [status, setStatus] = useState("APROVADO");
  const [managerId, setManagerId] = useState("");
  const [percentualEmpresa, setPercentualEmpresa] = useState<number>(0);
  const [permissoesVenda, setPermissoesVenda] = useState<'VAREJO' | 'ATACADO' | 'AMBOS'>('VAREJO');
  const [listaGestores, setListaGestores] = useState<{id: string, nome: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const { forgotPassword, profile: currentAdminProfile } = useAuth();

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const q = query(collection(db, "usuarios"), where("nivel", "==", "GESTOR"));
        const snapshot = await getDocs(q);
        const gestores = snapshot.docs.map(doc => ({
          id: doc.id,
          nome: doc.data().nome_completo || doc.data().email
        }));
        setListaGestores(gestores);
      } catch (error) {
        console.error("Erro ao carregar gestores:", error);
      }
    };

    fetchManagers();

    if (userToEdit) {
      setNome(userToEdit.nome_completo || "");
      setEmail(userToEdit.email || "");
      setCpf(userToEdit.cpf || "");
      setTelefone(userToEdit.telefone || "");
      setDataNascimento(userToEdit.data_nascimento || "");
      setRole(userToEdit.nivel || "VENDEDOR");
      setStatus(userToEdit.status_conta || "APROVADO");
      setManagerId(userToEdit.id_superior || "");
      setPercentualEmpresa(userToEdit.percentual_empresa || 0);
      setPermissoesVenda(userToEdit.permissoes_venda || "VAREJO");
    } else {
      setNome("");
      setEmail("");
      setCpf("");
      setTelefone("");
      setDataNascimento("");
      setPercentualEmpresa(0);
      setPermissoesVenda("VAREJO");
      // Nível padrão baseado em quem está criando
      if (currentAdminProfile?.nivel === 'GESTOR') {
        setRole("VENDEDOR");
        setManagerId(currentAdminProfile.uid);
      } else if (currentAdminProfile?.nivel === 'VENDEDOR') {
        setRole("CLIENTE");
        setManagerId(currentAdminProfile.uid);
      } else {
        setRole("VENDEDOR");
        setManagerId("");
      }
      setStatus("APROVADO");
    }
  }, [userToEdit, currentAdminProfile]);

  const handleDeleteUser = async () => {
    if (!userToEdit) return;

    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: `Você está prestes a excluir o perfil de ${userToEdit.nome_completo}. Esta ação não pode ser desfeita no Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        const { deleteDoc, doc } = await import('firebase/firestore');
        await deleteDoc(doc(db, "usuarios", userToEdit.uid));
        
        Swal.fire('Excluído!', 'O perfil do usuário foi removido do sistema.', 'success');
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        Swal.fire('Erro', 'Não foi possível excluir o usuário.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (userToEdit) {
        // Atualizar usuário existente
        const userData: any = {
          nome_completo: nome,
          nivel: role,
          status_conta: status,
          cpf: cpf,
          telefone: telefone,
          data_nascimento: dataNascimento,
          percentual_empresa: Number(percentualEmpresa),
          permissoes_venda: permissoesVenda
        };

        // Preservar ou atualizar id_superior logicamente
        if (role === "VENDEDOR") {
          userData.id_superior = managerId || null;
        } else if (role === "CLIENTE") {
          // Se for cliente, mantemos o id_superior atual se não for ADM editando
          // Ou se o ADM selecionou um vendedor/gestor (embora a UI atual não mostre managerId para clientes)
          if (currentAdminProfile?.nivel === 'VENDEDOR' || currentAdminProfile?.nivel === 'GESTOR') {
            userData.id_superior = userToEdit.id_superior || currentAdminProfile.uid;
          } else {
            userData.id_superior = userToEdit.id_superior || null;
          }
        }

        await setDoc(doc(db, "usuarios", userToEdit.uid), userData, { merge: true });

        // Se o usuário editado for o próprio administrador logado, atualizamos o perfil local
        if (userToEdit.uid === currentAdminProfile?.uid) {
          window.location.reload(); // Recarrega para aplicar mudanças de nível no próprio ADM se necessário
        }

        Swal.fire({
          icon: "success",
          title: "Usuário Atualizado!",
          text: `${nome} foi atualizado com sucesso.`,
          confirmButtonColor: "#0a0a2e",
          background: '#fff',
          color: '#0a0a2e',
          customClass: {
            popup: 'rounded-[2rem] border border-slate-100 shadow-2xl'
          }
        });
        if (onSuccess) onSuccess();
      } else {
        // Criar novo usuário
        // TRUQUE: Criar um app secundário para não deslogar o ADM Master atual
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);

        // 1. Cria o usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newUser = userCredential.user;

        // 2. Salva o perfil e o nível de acesso (Role) no Firestore
        const userData: any = {
          nome_completo: nome,
          email: email,
          nivel: role,
          cpf: cpf,
          telefone: telefone,
          data_nascimento: dataNascimento,
          data_cadastro: new Date(),
          status_conta: "APROVADO",
          percentual_empresa: Number(percentualEmpresa),
          permissoes_venda: permissoesVenda
        };

        // Se for vendedor, vincula ao gestor
        if (role === "VENDEDOR" && managerId) {
          userData.id_superior = managerId;
        }

        await setDoc(doc(db, "usuarios", newUser.uid), userData);

        // Notifica o ADM Master e a Hierarquia
        try {
          const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
          
          // Notifica ADM Master (outros ADMs se houver)
          await addDoc(collection(db, 'notifications'), {
            usuario_id: 'ADM_MASTER',
            targetRole: 'ADM_MASTER',
            title: '👤 Novo Cadastro Hierárquico (Painel ADM)',
            message: `${userData.nome_completo} foi cadastrado por um administrador.`,
            tipo: 'info',
            lida: false,
            read: false,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            origem: 'hierarquia'
          });

          // Notifica o Gestor se for um vendedor
          if (role === "VENDEDOR" && managerId) {
            await addDoc(collection(db, 'notifications'), {
              usuario_id: managerId,
              title: '👥 Novo Vendedor na sua Equipe',
              message: `Um novo vendedor (${userData.nome_completo}) foi atribuído a você.`,
              tipo: 'info',
              lida: false,
              read: false,
              timestamp: serverTimestamp(),
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error("Erro ao enviar notificações de cadastro:", e);
        }

        // 3. Desloga do app secundário para limpar a memória
        await signOut(secondaryAuth);

        Swal.fire({
          icon: "success",
          title: "Usuário Criado!",
          text: `${nome} agora é um ${role.replace("_", " ")} no sistema.`,
          confirmButtonColor: "#0a0a2e",
          background: '#fff',
          color: '#0a0a2e',
          customClass: {
            popup: 'rounded-[2rem] border border-slate-100 shadow-2xl'
          }
        });

        // Limpar campos
        setNome(""); setEmail(""); setPassword("");
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error(error);
      let errorMessage = error.message;
      
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Este e-mail já está sendo utilizado por outro usuário no sistema.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "A senha é muito fraca. Use pelo menos 6 caracteres.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "O formato do e-mail é inválido.";
      }

      Swal.fire({
        icon: "error",
        title: "Erro ao cadastrar",
        text: errorMessage,
        confirmButtonColor: "#0a0a2e",
        background: '#fff',
        color: '#0a0a2e',
        customClass: {
          popup: 'rounded-[2rem] border border-slate-100 shadow-2xl'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userToEdit?.email) return;
    
    try {
      setLoading(true);
      await forgotPassword(userToEdit.email);
      Swal.fire({
        icon: "success",
        title: "E-mail Enviado!",
        text: `Um link de redefinição de senha foi enviado para ${userToEdit.email}.`,
        confirmButtonColor: "#0a0a2e",
        background: '#fff',
        color: '#0a0a2e',
        customClass: {
          popup: 'rounded-[2rem] border border-slate-100 shadow-2xl'
        }
      });
    } catch (error: any) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Erro ao enviar",
        text: "Não foi possível enviar o e-mail de redefinição. Verifique a conexão ou se o e-mail é válido.",
        confirmButtonColor: "#0a0a2e",
        background: '#fff',
        color: '#0a0a2e',
        customClass: {
          popup: 'rounded-[2rem] border border-slate-100 shadow-2xl'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetTempPassword = async () => {
    if (!userToEdit?.uid || !tempPassword) {
      Swal.fire({
        icon: "warning",
        title: "Atenção",
        text: "Digite uma senha provisória.",
        confirmButtonColor: "#0a0a2e",
      });
      return;
    }

    try {
      setLoading(true);
      const { functions } = await import('../../firebase');
      const atualizarSenha = httpsCallable(functions, 'atualizarSenhaUsuario');
      
      await atualizarSenha({ uid: userToEdit.uid, novaSenha: tempPassword });

      Swal.fire({
        icon: "success",
        title: "Senha Atualizada!",
        text: `A senha de ${userToEdit.nome_completo} foi alterada para: ${tempPassword}`,
        confirmButtonColor: "#0a0a2e",
        background: '#fff',
        color: '#0a0a2e',
        customClass: {
          popup: 'rounded-[2rem] border border-slate-100 shadow-2xl'
        }
      });
      setTempPassword("");
    } catch (error: any) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Erro ao atualizar",
        text: "Não foi possível atualizar a senha. Verifique se você tem permissões de administrador.",
        confirmButtonColor: "#0a0a2e",
        background: '#fff',
        color: '#0a0a2e',
        customClass: {
          popup: 'rounded-[2rem] border border-slate-100 shadow-2xl'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6 mb-6 sm:mb-10 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="size-12 sm:size-16 bg-[#0a0a2e] rounded-2xl sm:rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-900/20 shrink-0">
            {userToEdit ? <Edit3 size={24} className="sm:size-8" /> : <UserPlus size={24} className="sm:size-8" />}
          </div>
          <div>
            <h2 className="text-xl sm:text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter leading-none">
              {userToEdit ? 'Editar Especialista' : 'Expandir Equipe'}
            </h2>
            <p className="text-[8px] sm:text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 sm:mt-2">
              {userToEdit ? `Configurações de ${userToEdit.nome_completo}` : 'Cadastro de Especialistas GSA IA v4.0'}
            </p>
          </div>
        </div>

        {userToEdit && currentAdminProfile?.nivel === 'ADM_MASTER' && (
          <button
            type="button"
            onClick={handleDeleteUser}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
          >
            Excluir Usuário
          </button>
        )}
      </div>

      <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
            <Users size={10} className="sm:size-3" />
            Nome Completo
          </label>
          <input 
            required 
            value={nome} 
            onChange={(e) => setNome(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300" 
            placeholder="Ex: Marcos Analista"
          />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
            <Mail size={10} className="sm:size-3" />
            E-mail de Acesso
          </label>
          <input 
            required 
            type="email" 
            disabled={!!userToEdit}
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300 disabled:opacity-50" 
            placeholder="email@gsa.com"
          />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
            <Shield size={10} className="sm:size-3" />
            CPF
          </label>
          <input 
            type="text" 
            value={cpf} 
            onChange={(e) => setCpf(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300" 
            placeholder="000.000.000-00"
          />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
            <Users size={10} className="sm:size-3" />
            Telefone
          </label>
          <input 
            type="text" 
            value={telefone} 
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300" 
            placeholder="(00) 00000-0000"
          />
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
            <Users size={10} className="sm:size-3" />
            Data de Nascimento
          </label>
          <input 
            type="date" 
            value={dataNascimento} 
            onChange={(e) => setDataNascimento(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300" 
          />
        </div>

        {!userToEdit && (
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
              <Lock size={10} className="sm:size-3" />
              Senha Temporária
            </label>
            <input 
              required 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300" 
              placeholder="••••••••"
            />
          </div>
        )}

        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
            <Shield size={10} className="sm:size-3" />
            Nível de Acesso (Role)
          </label>
          <div className="relative">
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-black text-blue-600 outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 transition-all"
            >
              {currentAdminProfile?.nivel === 'ADM_MASTER' && (
                <>
                  <option value="ADM_MASTER">ADM MASTER (CONTROLE TOTAL)</option>
                  <option value="ADM_GERENTE">ADM GERENTE</option>
                  <option value="ADM_ANALISTA">ADM ANALISTA</option>
                  <option value="GESTOR">GESTOR DE EQUIPE</option>
                  <option value="VENDEDOR">VENDEDOR</option>
                  <option value="CLIENTE">CLIENTE</option>
                </>
              )}
              {currentAdminProfile?.nivel === 'ADM_GERENTE' && (
                <>
                  <option value="ADM_GERENTE">ADM GERENTE</option>
                  <option value="ADM_ANALISTA">ADM ANALISTA</option>
                  <option value="GESTOR">GESTOR DE EQUIPE</option>
                  <option value="VENDEDOR">VENDEDOR</option>
                  <option value="CLIENTE">CLIENTE</option>
                </>
              )}
              {currentAdminProfile?.nivel === 'GESTOR' && (
                <>
                  <option value="VENDEDOR">VENDEDOR</option>
                  <option value="CLIENTE">CLIENTE</option>
                </>
              )}
              {currentAdminProfile?.nivel === 'VENDEDOR' && (
                <option value="CLIENTE">CLIENTE</option>
              )}
            </select>
            <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none text-blue-600">
              <ArrowRight size={14} className="rotate-90 sm:size-[18px]" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
            <Shield size={10} className="sm:size-3" />
            Status da Conta
          </label>
          <div className="relative">
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              className={`w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-black outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 transition-all ${
                status === 'APROVADO' ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              <option value="APROVADO">APROVADO</option>
              <option value="PENDENTE">PENDENTE</option>
              <option value="BLOQUEADO">BLOQUEADO</option>
            </select>
            <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ArrowRight size={14} className="rotate-90 sm:size-[18px]" />
            </div>
          </div>
        </div>

        {/* Percentual Empresa (Comissão GSA) */}
        {['ADM_MASTER', 'ADM_GERENTE', 'GESTOR'].includes(currentAdminProfile?.nivel || '') && 
         ['GESTOR', 'VENDEDOR', 'ADM_GERENTE', 'ADM_ANALISTA'].includes(role) && (
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[8px] sm:text-[10px] font-black text-blue-600 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
              <Shield size={10} className="sm:size-3" />
              Percentual p/ Empresa (%)
            </label>
            <div className="relative">
              <input 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={percentualEmpresa} 
                onChange={(e) => setPercentualEmpresa(Number(e.target.value))}
                className="w-full bg-blue-50 border border-blue-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" 
                placeholder="Ex: 10"
              />
              <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 font-black text-xs">
                %
              </div>
            </div>
          </div>
        )}

        {['ADM_MASTER', 'ADM_GERENTE', 'GESTOR'].includes(currentAdminProfile?.nivel || '') && 
         ['GESTOR', 'VENDEDOR'].includes(role) && (
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
              <Shield size={10} className="sm:size-3" />
              Permissões de Venda
            </label>
            <div className="relative">
              <select 
                value={permissoesVenda} 
                onChange={(e) => setPermissoesVenda(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-black text-blue-600 outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              >
                <option value="VAREJO">VAREJO (INDIVIDUAL)</option>
                <option value="ATACADO">ATACADO (EM MASSA)</option>
                <option value="AMBOS">AMBOS (MASSA E INDIVIDUAL)</option>
              </select>
              <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none text-blue-600">
                <ArrowRight size={14} className="rotate-90 sm:size-[18px]" />
              </div>
            </div>
          </div>
        )}

        {role === "VENDEDOR" && !['GESTOR', 'VENDEDOR'].includes(currentAdminProfile?.nivel || '') && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-1.5 sm:space-y-2 md:col-span-2"
          >
            <label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 sm:ml-4 flex items-center gap-2">
              <Users size={10} className="sm:size-3" />
              Atribuir a um Gestor de Equipe
            </label>
            <div className="relative">
              <select 
                value={managerId} 
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-[1.5rem] p-3.5 sm:p-5 text-xs sm:text-sm font-black text-indigo-600 outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              >
                <option value="">Selecionar Gestor...</option>
                {listaGestores.map(gestor => (
                  <option key={gestor.id} value={gestor.id}>{gestor.nome}</option>
                ))}
              </select>
              <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-600">
                <ArrowRight size={14} className="rotate-90 sm:size-[18px]" />
              </div>
            </div>
          </motion.div>
        )}

        {userToEdit && (
          <div className="md:col-span-2 p-4 sm:p-8 bg-blue-50/50 rounded-[1.5rem] sm:rounded-[2.5rem] border border-blue-100/50 space-y-6 sm:space-y-8">
            <div className="flex items-center gap-4 sm:gap-6 px-2">
              <div className="size-10 sm:size-14 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                <Shield className="size-5 sm:size-7" />
              </div>
              <div>
                <h4 className="text-sm sm:text-xl font-black text-blue-900 uppercase italic tracking-tight">Segurança da Conta</h4>
                <p className="text-[9px] sm:text-xs text-blue-600/70 font-bold uppercase tracking-widest">Controle de acesso e credenciais</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Reset via Email */}
              <div className="bg-white/60 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-blue-100 flex flex-col justify-between gap-4">
                <div>
                  <h5 className="text-[10px] sm:text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Redefinição via E-mail</h5>
                  <p className="text-[9px] sm:text-[10px] text-blue-600/60 font-medium leading-relaxed">
                    Envia um link seguro para o e-mail do usuário.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="w-full bg-white text-blue-600 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest border-2 border-blue-100 hover:border-blue-600 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Mail size={14} className="sm:size-4" />
                  Enviar Link de Reset
                </button>
              </div>

              {/* Senha Provisória */}
              <div className="bg-white/60 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-blue-100 flex flex-col gap-4">
                <div>
                  <h5 className="text-[10px] sm:text-xs font-black text-blue-900 uppercase tracking-widest mb-1">Senha Provisória</h5>
                  <p className="text-[9px] sm:text-[10px] text-blue-600/60 font-medium leading-relaxed">
                    Define uma senha manualmente agora.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <input 
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="w-full bg-white border-2 border-blue-100 rounded-xl sm:rounded-2xl pl-10 pr-4 py-3 sm:py-4 text-[10px] sm:text-xs font-bold focus:border-blue-600 outline-none transition-all placeholder:text-blue-200"
                      placeholder="Nova Senha"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSetTempPassword}
                    disabled={loading || !tempPassword}
                    className="bg-blue-600 text-white px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-blue-600/20 whitespace-nowrap"
                  >
                    Definir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <button 
          disabled={loading}
          className="md:col-span-2 bg-[#0a0a2e] text-white py-4 sm:py-6 rounded-xl sm:rounded-[1.8rem] font-black uppercase text-[9px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em] shadow-2xl shadow-blue-900/30 hover:scale-[1.01] active:scale-95 transition-all flex justify-center items-center gap-3 sm:gap-4 disabled:opacity-50 disabled:scale-100"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin size-4 sm:size-5" />
              PROCESSANDO...
            </>
          ) : (
            <>
              {userToEdit ? 'SALVAR ALTERAÇÕES' : 'CRIAR CONTA DE ACESSO'}
              <ArrowRight size={16} className="sm:size-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default GerenciarUsuarios;
