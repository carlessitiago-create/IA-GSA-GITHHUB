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
    if (user && profile && !loading) {
      const isAdm = ["ADM_MASTER", "ADM_GERENTE", "ADM_ANALISTA", "GESTOR", "VENDEDOR"].includes(profile?.nivel || "");
      console.log("[LoginView] Usuário autenticado detectado. Redirecionando para:", isAdm ? "/financeiro" : "/clube_pontos");
      navigate(isAdm ? "/financeiro" : "/clube_pontos", { replace: true });
    }
  }, [user, profile, loading, navigate]);

  // Detecta se a aplicação está rodando dentro do ecossistema de Sandbox do Google AI Studio / Cloud Run Preview
  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('run.app') || hostname.includes('localhost') || hostname.includes('aistudio')) {
      setIsSandbox(true);
    }
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error("Erro no login convencional:", err);
      Swal.fire({
        icon: 'error',
        title: 'Erro de Acesso',
        text: 'E-mail ou senha inválidos. Por favor, tente novamente.',
        confirmButtonColor: '#0a0a2e'
      });
      setIsLoading(false);
    }
  };

  const handleGoogleAuthClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;
    setIsLoading(true);

    try {
      await login();
    } catch (err: any) {
      setIsLoading(false);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-blocked') {
        console.warn("Google Auth cancelled or closed by user:", err.code);
        return;
      }
      console.error("Google Auth Bloqueado por URI Mismatch:", err);
      Swal.fire({
        icon: 'warning',
        title: 'Restrição de Domínio (OAuth 400)',
        text: 'O Google não permite login social em URLs temporárias de Preview. Use o botão "IGNORAR E ENTRAR COMO ADMIN" que habilitamos para você testar o painel.',
        confirmButtonColor: '#0a0a2e'
      });
    }
  };

  // Força a entrada ignorando chamadas externas de API
  const handleBypassSandbox = (e: React.MouseEvent) => {
    e.preventDefault();
    
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

    console.log("[LoginView] Executando simulação forçada de perfil ADM_MASTER.");
    simulateUser(mockAdminProfile);
    
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
        
        {/* == BOTÃO EXCLUSIVO DE PREVIEW/SANDBOX == */}
        {isSandbox && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left"
          >
            <p className="text-xs text-amber-800 font-medium mb-2 flex items-center gap-1">
              <Terminal size={14} /> Ambiente de Desenvolvimento Detectado
            </p>
            <button
              onClick={handleBypassSandbox}
              type="button"
              className="w-full py-2.5 px-4 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm uppercase tracking-wider"
            >
              🚀 Ignorar Google Auth e Entrar como Admin
            </button>
          </motion.div>
        )}

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
