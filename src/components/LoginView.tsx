import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import Swal from "sweetalert2";
import { ConsultaPublicaView } from "../views/ConsultaPublicaView";
import { Search, X, Shield, Mail, Lock, User, CreditCard, Calendar, Phone, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const LoginView: React.FC = () => {
  const { login, loginWithEmail, registerWithEmail, forgotPassword } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPublicSearch, setShowPublicSearch] = useState(false);

  // Lógica para Login ou Registro
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegistering) {
        if (!name || !cpf || !dataNascimento || !telefone) {
          throw new Error("Todos os campos são obrigatórios para o cadastro.");
        }
        await registerWithEmail(email, password, name, cpf, dataNascimento, telefone);
        Swal.fire({
          icon: "success",
          title: "Cadastro realizado!",
          text: "Seu acesso está em análise pela nossa equipe.",
          confirmButtonColor: "#0a0a2e"
        });
      } else {
        await loginWithEmail(email, password);
      }
    } catch (error: any) {
      console.error("Erro na autenticação:", error);
      let mensagem = error.message || "Ocorreu um erro inesperado.";
      
      // Tradução de erros comuns do Firebase se não vierem formatados do Context
      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
        mensagem = "E-mail ou senha incorretos.";
      } else if (error.code === "auth/wrong-password") {
        mensagem = "Senha incorreta.";
      } else if (error.code === "auth/email-already-in-use") {
        mensagem = "Este e-mail já está em uso por outro usuário.";
      } else if (error.code === "auth/weak-password") {
        mensagem = "A senha deve ter pelo menos 6 caracteres.";
      }

      Swal.fire({
        icon: "error",
        title: isRegistering ? "Erro no Cadastro" : "Erro no Acesso",
        text: mensagem,
        confirmButtonColor: "#0a0a2e"
      });
    } finally {
      setLoading(false);
    }
  };

  // Lógica para Login com Google
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await login();
    } catch (error: any) {
      console.error(error);
      if (error.code !== "auth/cancelled-popup-request" && error.code !== "auth/popup-closed-by-user") {
        Swal.fire({
          icon: "error",
          title: "Erro no Google Login",
          text: "Não foi possível conectar com sua conta Google.",
          confirmButtonColor: "#0a0a2e"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const { value: emailToReset } = await Swal.fire({
      title: 'Esqueceu sua senha?',
      input: 'email',
      inputPlaceholder: 'seu@email.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar e-mail',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0a0a2e'
    });

    if (emailToReset) {
      try {
        await forgotPassword(emailToReset);
        Swal.fire({ 
          icon: 'success', 
          title: 'E-mail enviado!', 
          text: 'Verifique sua caixa de entrada para redefinir sua senha.', 
          confirmButtonColor: '#0a0a2e' 
        });
      } catch (err) {
        Swal.fire({ 
          icon: 'error', 
          title: 'Erro', 
          text: 'Não foi possível enviar o e-mail de recuperação.', 
          confirmButtonColor: '#0a0a2e' 
        });
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a2e] p-4 relative overflow-hidden">
      {/* Detalhes de Background */}
      <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full ${isRegistering ? 'max-w-2xl' : 'max-w-md'} bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-10 z-10 transition-all duration-500`}
      >
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 bg-[#0a0a2e] rounded-2xl flex items-center justify-center shadow-xl mb-4">
            <Shield className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter italic">GSA IA</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">
            {isRegistering ? 'Criação de Conta Segura' : 'Gestão e Processos'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`grid grid-cols-1 ${isRegistering ? 'md:grid-cols-2' : ''} gap-4`}>
            {isRegistering && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                    <User size={10} /> Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                    <CreditCard size={10} /> CPF
                  </label>
                  <input
                    type="text"
                    required
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                    <Calendar size={10} /> Data de Nascimento
                  </label>
                  <input
                    type="date"
                    required
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                    <Phone size={10} /> WhatsApp
                  </label>
                  <input
                    type="tel"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <Mail size={10} /> E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@gsa.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <Lock size={10} /> Senha
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {!isRegistering && (
            <div className="text-right">
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-4"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <>{isRegistering ? 'CRIAR MINHA CONTA' : 'ENTRAR NO SISTEMA'} <span className="material-symbols-outlined text-sm">{isRegistering ? 'person_add' : 'login'}</span></>
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-100"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Ou</span>
          <div className="flex-1 h-px bg-slate-100"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 w-full bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-2xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Google Workspace
        </button>

        <div className="mt-8 text-center space-y-4">
            <button 
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
            >
              {isRegistering ? (
                <span className="flex items-center gap-2 justify-center">
                  <ArrowLeft size={14} /> Já tenho uma conta. Voltar para Login.
                </span>
              ) : (
                "Não tem conta? Criar agora."
              )}
            </button>
            
            <div className="h-px w-12 bg-slate-100 mx-auto"></div>

            <button 
              onClick={() => setShowPublicSearch(true)}
              className="flex items-center gap-2 mx-auto text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-all"
            >
              <Search size={14} />
              Consulta Pública de Processo
            </button>
        </div>
      </motion.div>

      {/* MODAL DE CONSULTA PÚBLICA */}
      <AnimatePresence>
        {showPublicSearch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0a0a2e] overflow-y-auto p-4 md:p-12"
          >
            <button 
              onClick={() => setShowPublicSearch(false)}
              className="fixed top-8 right-8 text-white/50 hover:text-white transition-all z-[110]"
            >
              <X size={40} />
            </button>
            
            <div className="max-w-5xl mx-auto">
              <ConsultaPublicaView />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginView;
