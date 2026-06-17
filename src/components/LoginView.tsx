import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, Lock, Mail, Search, X, Terminal } from 'lucide-react';
import Swal from 'sweetalert2';
import { ConsultaPublicaView } from '../views/ConsultaPublicaView';

export const LoginView: React.FC = () => {
  const { login, loginWithEmail, simulateUser, user, profile, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPublicSearch, setShowPublicSearch] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);

  // Redireciona automaticamente se o usuário já estiver logado e com perfil carregado
  useEffect(() => {
    console.log("[LoginView - Redirect Hook] Verificando estado atual de autenticação:", {
      hasUser: !!user,
      uid: user?.uid,
      hasProfile: !!profile,
      nivel: profile?.nivel,
      loading
    });
    if (user && profile && !loading) {
      const isAdm = ["ADM_MASTER", "ADM_GERENTE", "ADM_ANALISTA", "GESTOR", "VENDEDOR"].includes(profile?.nivel || "");
      const targetRoute = isAdm ? "/financeiro" : "/clube_pontos";
      console.log(`[LoginView - Redirect Hook] Redirecionando Usuário Ativo (${user.email || user.uid}) -> ${targetRoute}`);
      navigate(targetRoute, { replace: true });
    }
  }, [user, profile, loading, navigate]);

  // Detecta se a aplicação está rodando dentro do ecossistema de Sandbox do Google AI Studio / Cloud Run Preview
  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const isSB = hostname.includes('run.app') || hostname.includes('localhost') || hostname.includes('aistudio');
    console.log("[LoginView - Sandbox Hook] Hostname atual:", hostname, "Ambiente Sandbox?", isSB);
    setIsSandbox(isSB);
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("========================================= [GSA LOGIN FORM SUBMIT] =========================================");
    console.log("[LoginView - handleEmailLogin] Form onSubmit event captured!");
    console.log("[LoginView - handleEmailLogin] Current input credentials:", {
      email: email,
      passwordLength: password ? password.length : 0,
    });

    if (!email || !password) {
      console.warn("[LoginView - handleEmailLogin] ERROR: Missing email or password. Aborting submission.");
      return;
    }

    console.log("[LoginView - handleEmailLogin] Local validations passed. Setting state isLoading to true...");
    setIsLoading(true);
    
    try {
      console.log("[LoginView - handleEmailLogin] Attempting AuthContext call: loginWithEmail(email, password)...");
      const startTime = Date.now();
      
      await loginWithEmail(email, password);
      
      const duration = Date.now() - startTime;
      console.log(`[LoginView - handleEmailLogin] SUCCESS! loginWithEmail promise resolved after ${duration}ms.`);
      console.log("[LoginView - handleEmailLogin] User should be logged in. Auth state changes will be handled by AuthContext onAuthStateChanged.");
      
      // We set isLoading to false just in case redirect doesn\'t happen instantly or they stay on the page
      setIsLoading(false);
    } catch (err: any) {
      console.error("========================================= [GSA LOGIN ERROR] =========================================");
      console.error("[LoginView - handleEmailLogin] FAILED! An error was caught during loginWithEmail:", {
        code: err?.code || "NO_CODE",
        message: err?.message || String(err),
        stack: err?.stack || "NO_STACK",
        fullErrorObject: err
      });
      console.error("=========================================================================================================");
      
      Swal.fire({
        icon: 'error',
        title: 'Erro de Acesso',
        text: 'E-mail ou senha inválidos. Por favor, tente novamente.',
        confirmButtonColor: '#0a0a2e'
      });
      
      console.log("[LoginView - handleEmailLogin] Disabling isLoading state back to false to unblock UI...");
      setIsLoading(false);
    }
  };

  const handleGoogleAuthClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("========================================= [GSA GOOGLE AUTH CLICK] =========================================");
    console.log("[LoginView - handleGoogleAuthClick] Click event captured on Google Sign-In button!");
    console.log("[LoginView - handleGoogleAuthClick] Current isLoading state value:", isLoading);

    if (isLoading) {
      console.warn("[LoginView - handleGoogleAuthClick] Warning: Auth process already active. Ignoring duplicate click.");
      return;
    }
    
    console.log("[LoginView - handleGoogleAuthClick] Setting isLoading state to true...");
    setIsLoading(true);

    try {
      console.log("[LoginView - handleGoogleAuthClick] Calling AuthContext: login() with GoogleAuthProvider...");
      const startTime = Date.now();
      
      await login();
      
      const duration = Date.now() - startTime;
      console.log(`[LoginView - handleGoogleAuthClick] SUCCESS! login() promise resolved after ${duration}ms.`);
      setIsLoading(false);
    } catch (err: any) {
      console.error("========================================= [GSA GOOGLE AUTH ERROR] =========================================");
      console.error("[LoginView - handleGoogleAuthClick] FAILED! Error caught during Google popup authentications:", {
        code: err?.code || "NO_CODE",
        message: err?.message || String(err),
        stack: err?.stack || "NO_STACK",
        fullErrorObject: err
      });
      console.error("============================================================================================================");
      
      setIsLoading(false);
      
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-blocked') {
        console.warn("[LoginView - handleGoogleAuthClick] Expected cancel/popup issue (User closed or browser blocked popup):", err.code);
        return;
      }
      
      let errorTitle = 'Restrição de Domínio (OAuth 400)';
      let errorText = 'O Google não permite login social se o domínio atual não estiver configurado corretamente no Console do Firebase Auth ou se o login popup estiver bloqueado. Utilize suas credenciais convencionais por e-mail e senha.';
      
      const isCustomDomain = !window.location.hostname.includes('run.app') && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('aistudio');
      
      if (err?.code === 'auth/unauthorized-domain') {
        errorTitle = 'Domínio Não Autorizado';
        errorText = `O domínio "${window.location.hostname}" não está autorizado no console do seu Firebase para autenticação do Google. Adicione este domínio nas configurações de Autenticação do seu Firebase Console para liberar o acesso.`;
      } else if (err?.code === 'auth/operation-not-allowed') {
        errorTitle = 'Login com Google Desativado';
        errorText = 'O método de login do Google não está habilitado no console do Firebase do seu projeto. Ative-o na aba "Sign-in method" em Authentication.';
      } else if (isCustomDomain) {
        errorTitle = 'Falha na Conexão do Google';
        errorText = `Não foi possível prosseguir com o login do Google: ${err?.message || String(err)} (Código: ${err?.code || 'erro_desconhecido'}). Verifique suas credenciais de integração ou utilize login convencional com e-mail/senha.`;
      }
      
      Swal.fire({
        icon: 'warning',
        title: errorTitle,
        text: errorText,
        confirmButtonColor: '#0a0a2e'
      });
    }
  };

  // Força a entrada ignorando chamadas externas de API
  const handleBypassSandbox = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("[LoginView - BypassClick] Evento de clique no botão 'Bypassar Sandbox' disparado.");
    
    const mockAdminProfile: any = {
      uid: "AIrg3siNJWhXJtGVJjhbk7nGIwB2",
      nome_completo: "Tiago Carlessi (Bypass)",
      nome: "Tiago",
      email: "carlessitiago@gmail.com",
      cpf: "000.000.000-00",
      data_nascimento: "1990-01-01",
      nivel: "ADM_MASTER",
      status_conta: "APROVADO",
      tem_empresa: true
    };

    console.log("[LoginView - BypassClick] Executando simulação forçada de perfil ADM_MASTER...");
    simulateUser(mockAdminProfile);
    console.log("[LoginView - BypassClick] Redirecionando simulador de sandbox para o painel /financeiro...");
    
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Modo Sandbox: Acesso Liberado',
      showConfirmButton: false,
      timer: 1500
    });
    
    navigate('/financeiro');
  };

  return (
    <div className="min-h-screen bg-[#0a0a2e] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full text-center"
      >
        <div className="bg-[#0a0a2e] w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-[#0a0a2e]/20">
          <Shield className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-[#0a0a2e] mb-2 tracking-tight">GSA PROCESSOS IA</h1>
        <p className="text-slate-500 mb-8">Núcleo de Governança e Segurança. Acesse para gerenciar sua carteira.</p>

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-6 text-left">
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
              <Mail size={12} /> E-mail
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#0a0a2e]/20 shadow-sm" 
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
              <Lock size={12} /> Senha
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#0a0a2e]/20 shadow-sm" 
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading} 
            className="w-full py-4 bg-[#0a0a2e] text-white rounded-xl font-bold hover:bg-[#151542] transition-colors disabled:opacity-70 shadow-lg shadow-[#0a0a2e]/10"
          >
            {isLoading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        {isSandbox && (
          <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200 text-left space-y-3">
            <div className="flex gap-2 items-start">
              <Terminal size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase">Modo Sandbox Ativo</p>
                <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
                  Como você está no ambiente de testes/preview, o login social com o Google pode exibir o erro <code>redirect_uri_mismatch</code> por restrição de Domínio Autorizado do Google Cloud.
                </p>
              </div>
            </div>
            
            <button 
              onClick={handleBypassSandbox} 
              type="button" 
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-600/10"
            >
              <Terminal size={14} /> Ativar Bypass (Entrar como Admin)
            </button>
          </div>
        )}

        <button 
          onClick={handleGoogleAuthClick} 
          type="button" 
          disabled={isLoading} 
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all mb-6 disabled:opacity-50"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          ENTRAR COM GOOGLE
        </button>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <button 
            type="button"
            onClick={() => setShowPublicSearch(true)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center justify-center gap-2 mx-auto uppercase tracking-wider"
          >
            <Search size={14} /> Consulta Pública de Processo
          </button>
        </div>

        {/* MODAL DE CONSULTA PÚBLICA */}
        {showPublicSearch && (
          <div className="fixed inset-0 z-[200] bg-[#0a0a2e] overflow-y-auto p-4 md:p-6">
            <button 
              onClick={() => setShowPublicSearch(false)}
              className="fixed top-8 right-8 text-white/50 hover:text-white transition-all z-[210] p-2 hover:bg-white/10 rounded-full"
            >
              <X size={32} />
            </button>
            <div className="max-w-5xl mx-auto py-8">
              <ConsultaPublicaView />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default LoginView;
