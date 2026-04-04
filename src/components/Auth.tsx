import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Clock, XCircle, Lock } from 'lucide-react';
import Swal from 'sweetalert2';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { formatDocument, formatPhone } from '../utils/validators';

export function Login() {
  const { login, loginWithEmail, registerWithEmail, forgotPassword } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { label: '', color: '' };
    if (pwd.length < 8) return { label: 'Muito curta', color: 'text-red-500' };
    
    let strength = 0;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    
    if (strength <= 1) return { label: 'Fraca', color: 'text-red-500' };
    if (strength === 2) return { label: 'Média', color: 'text-yellow-500' };
    return { label: 'Forte', color: 'text-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Swal.fire({ icon: 'error', title: 'E-mail inválido', text: 'Por favor, insira um endereço de e-mail válido.', confirmButtonColor: '#0a0a2e' });
      return;
    }

    if (isRegistering && password.length < 8) {
      Swal.fire({ icon: 'error', title: 'Senha muito curta', text: 'A senha deve ter pelo menos 8 caracteres.', confirmButtonColor: '#0a0a2e' });
      return;
    }

    setIsLoading(true);
    try {
      if (isRegistering) {
        if (!cpf || !dataNascimento || !telefone) {
          Swal.fire({ icon: 'error', title: 'Campos obrigatórios', text: 'CPF, Data de Nascimento e Contato são obrigatórios.', confirmButtonColor: '#0a0a2e' });
          setIsLoading(false);
          return;
        }
        await registerWithEmail(email, password, name, cpf, dataNascimento, telefone);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      let errorMessage = 'Ocorreu um erro na autenticação.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') errorMessage = 'E-mail ou senha incorretos.';
      else if (err.code === 'auth/wrong-password') errorMessage = 'Senha incorreta.';
      else if (err.code === 'auth/email-already-in-use') errorMessage = 'E-mail já está em uso.';
      
      Swal.fire({ icon: 'error', title: 'Erro de Autenticação', text: errorMessage, confirmButtonColor: '#0a0a2e' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const { value: emailToReset } = await Swal.fire({
      title: 'Esqueceu sua senha?',
      input: 'email',
      inputPlaceholder: 'seu@email.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar e-mail',
      confirmButtonColor: '#0a0a2e'
    });

    if (emailToReset) {
      try {
        await forgotPassword(emailToReset);
        Swal.fire({ icon: 'success', title: 'E-mail enviado!', text: 'Verifique sua caixa de entrada.', confirmButtonColor: '#0a0a2e' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível enviar o e-mail.', confirmButtonColor: '#0a0a2e' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a2e] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-10 rounded-[2rem] shadow-2xl max-w-md w-full text-center">
        <div className="bg-[#0a0a2e] w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-[#0a0a2e]/20">
          <Shield className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-[#0a0a2e] mb-2 tracking-tight">GSA PROCESSOS IA</h1>
        <p className="text-slate-500 mb-8">Núcleo de Governança e Segurança. Acesse para gerenciar sua carteira.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 mb-6 text-left">
          {isRegistering && (
            <>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0a0a2e]/20" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">CPF</label>
                <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0a0a2e]/20" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">Data de Nascimento</label>
                <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0a0a2e]/20" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
                <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0a0a2e]/20" />
              </div>
            </>
          )}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0a0a2e]/20" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0a0a2e]/20" />
            {!isRegistering && (
              <button type="button" onClick={handleForgotPassword} className="text-xs font-bold text-slate-400 hover:text-[#0a0a2e] hover:underline mt-2 block">
                Esqueceu sua senha?
              </button>
            )}
          </div>
          <button type="submit" disabled={isLoading} className="w-full py-4 bg-[#0a0a2e] text-white rounded-xl font-bold hover:bg-[#151542] transition-colors disabled:opacity-70">
            {isLoading ? 'Aguarde...' : (isRegistering ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <button onClick={() => login()} type="button" className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all mb-6">
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Entrar com Google
        </button>

        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-sm font-bold text-slate-900 hover:text-slate-800 hover:underline">
          {isRegistering ? 'Já tenho uma conta. Entrar.' : 'Não tem conta? Criar agora.'}
        </button>
      </motion.div>
    </div>
  );
}

export function PendingApproval({ profile, onLogout }: { profile: any, onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a2e] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center">
        <div className="bg-amber-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Clock className="text-amber-600 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-[#0a0a2e] mb-4 uppercase tracking-tight italic">Cadastro em Análise</h1>
        <p className="text-slate-600 mb-6 leading-relaxed">
          Olá, <span className="font-bold text-[#0a0a2e]">{profile.nome}</span>! Seu cadastro foi recebido com sucesso e está em fila para aprovação pela nossa equipe de governança.
        </p>
        <button onClick={onLogout} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">
          Sair da Conta
        </button>
      </motion.div>
    </div>
  );
}

export function AccountRefused({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a2e] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center">
        <div className="bg-red-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <XCircle className="text-red-600 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-[#0a0a2e] mb-4 uppercase tracking-tight italic">Cadastro Recusado</h1>
        <button onClick={onLogout} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">
          Sair da Conta
        </button>
      </motion.div>
    </div>
  );
}

export function AccountSuspended({ status, onLogout }: { status: string, onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a2e] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center">
        <div className="bg-slate-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Lock className="text-slate-600 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-[#0a0a2e] mb-4 uppercase tracking-tight italic">Conta Suspensa</h1>
        <button onClick={onLogout} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">
          Sair da Conta
        </button>
      </motion.div>
    </div>
  );
}

export function CompleteProfile({ profile }: { profile: any }) {
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/[^\d]+/g, '');
    const cleanTelefone = telefone.replace(/[^\d]+/g, '');

    if (!cleanCpf || !dataNascimento || !cleanTelefone) {
      Swal.fire({ icon: 'error', title: 'Erro', text: 'Todos os campos são obrigatórios.' });
      return;
    }

    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'usuarios', profile.uid), {
        cpf: cleanCpf,
        data_nascimento: dataNascimento,
        telefone: cleanTelefone,
        status_conta: 'PENDENTE'
      });
      window.location.reload();
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Erro', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a2e] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center">
        <h1 className="text-2xl font-black text-[#0a0a2e] mb-2 uppercase tracking-tight italic">Completar Cadastro</h1>
        <p className="text-slate-500 mb-8">Precisamos de mais algumas informações para validar seu acesso.</p>
        <form onSubmit={handleComplete} className="space-y-4 text-left">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">CPF</label>
            <input type="text" value={cpf} onChange={(e) => setCpf(formatDocument(e.target.value))} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Data de Nascimento</label>
            <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Contato (WhatsApp)</label>
            <input type="tel" value={telefone} onChange={(e) => setTelefone(formatPhone(e.target.value))} required className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm" />
          </div>
          <button type="submit" disabled={isLoading} className="w-full py-4 bg-[#0a0a2e] text-white rounded-xl font-bold hover:bg-[#151542] transition-colors disabled:opacity-70">
            {isLoading ? 'Salvando...' : 'Finalizar Cadastro'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
