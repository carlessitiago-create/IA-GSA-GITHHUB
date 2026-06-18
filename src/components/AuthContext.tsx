import React, { createContext, useContext, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
  UserCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError, cleanData } from '../firebase';

export interface UserProfile {
  uid: string;
  nome_completo: string;
  nome?: string; 
  email: string;
  cpf: string;
  data_nascimento: string;
  telefone?: string;
  whatsapp?: string;
  nivel: 'ADM_MASTER' | 'ADM_GERENTE' | 'ADM_ANALISTA' | 'GESTOR' | 'VENDEDOR' | 'CLIENTE';
  id_superior?: string;
  vendedor_id?: string;
  documento?: string;
  timestamp?: any;
  tem_empresa: boolean;
  nome_empresa?: string;
  cnpj?: string;
  status_conta: 'APROVADO' | 'PENDENTE' | 'RECUSADO' | 'SUSPENSO' | 'BLOQUEADO';
  data_cadastro?: any;
  saldo_pontos?: number; 
  saldo_carteira?: number;
  percentual_empresa?: number;
  permissoes_venda?: 'VAREJO' | 'ATACADO' | 'AMBOS';
  modelo_comissao?: 'PADRAO' | 'TAXA_SERVICO' | 'COMISSAO_ESPECIAL';
  taxa_servico_fixa?: number;
  comissao_especial_percentual?: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, cpf: string, dataNascimento: string, telefone: string) => Promise<UserCredential>;
  forgotPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  simulateUser: (profile: UserProfile) => void;
  stopSimulation: () => void;
  isSimulating: boolean;
  realProfile: UserProfile | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [realProfile, setRealProfile] = useState<UserProfile | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Função de simulação (Bypass do Sandbox)
  const simulateUser = (mockProfile: UserProfile) => {
    console.log("[AuthContext - simulateUser] Iniciando simulação de usuário no sandbox para:", mockProfile.email);
    console.log("[AuthContext - simulateUser] Detalhes do Perfil Simulado:", {
      uid: mockProfile.uid,
      nome_completo: mockProfile.nome_completo,
      nivel: mockProfile.nivel,
      status_conta: mockProfile.status_conta
    });
    
    try {
      setUser({ uid: mockProfile.uid, email: mockProfile.email } as any);
      setProfile(mockProfile);
      setRealProfile(mockProfile);
      setIsSimulating(true);
      localStorage.setItem('gsa_sandbox_bypass_active', JSON.stringify(mockProfile));
      setLoading(false); // Destrava a UI imediatamente
      console.log("[AuthContext - simulateUser] Simulação de usuário aplicada com sucesso e localStorage atualizado.");
    } catch (err) {
      console.error("[AuthContext - simulateUser] Erro ao aplicar simulação de usuário:", err);
    }
  };

  const stopSimulation = () => {
    console.log("[AuthContext - stopSimulation] Removendo sessão simulada de bypass.");
    localStorage.removeItem('gsa_sandbox_bypass_active');
    setProfile(realProfile);
    setIsSimulating(false);
    console.log("[AuthContext - stopSimulation] Simulação desativada. Perfil real restaurado:", realProfile);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    console.log("[AuthContext - loginWithEmail] Promessa iniciada. Tentando autenticar com e-mail:", email);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, pass);
      console.log("[AuthContext - loginWithEmail] signInWithEmailAndPassword resolvida com sucesso!");
      console.log("[AuthContext - loginWithEmail] Usuário retornado:", {
        uid: credential.user.uid,
        email: credential.user.email,
        emailVerified: credential.user.emailVerified
      });
      setUser(credential.user);
    } catch (error: any) {
      console.error("[AuthContext - loginWithEmail] Erro na promessa signInWithEmailAndPassword:", error);
      throw error;
    }
  };

  const login = async () => {
    console.log("[AuthContext - login] Promessa de login (Google Auth Popup) iniciada.");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    console.log("[AuthContext - login] Configurações do GoogleAuthProvider definidas:", provider);
    
    // Detectar se está rodando dentro de um iframe (ex: Sandbox do Google AI Studio)
    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
    })();

    const isDevelopmentPreview = window.location.hostname.includes('run.app') || 
                                  window.location.hostname.includes('localhost') || 
                                  window.location.hostname.includes('aistudio') ||
                                  isInIframe;

    console.log("[AuthContext - login] Estado do Ambiente:", {
      hostname: window.location.hostname,
      isInIframe,
      isDevelopmentPreview
    });

    // Se estiver em ambiente sandbox/preview, use estritamente Popup para evitar o erro 403 de X-Frame-Options doremitido pelo redirect do Google
    if (isDevelopmentPreview) {
      console.log("[AuthContext - login] Executando login Google estrito por Popup para Sandbox/Preview.");
      try {
        console.log("[AuthContext - login] Disparando signInWithPopup...");
        const credential = await signInWithPopup(auth, provider);
        console.log("[AuthContext - login] signInWithPopup resolvida com sucesso!");
        console.log("[AuthContext - login] Credenciais retornadas:", {
          uid: credential.user.uid,
          email: credential.user.email,
          displayName: credential.user.displayName
        });
        setUser(credential.user);
        return;
      } catch (error: any) {
        const isPopupCancel = error.code === "auth/popup-blocked" || 
                              error.code === "auth/popup-closed-by-user" || 
                              error.code === "auth/cancelled-popup-request";

        if (isPopupCancel) {
          console.warn("[AuthContext - login] O login popup do Google foi cancelado ou bloqueado pelo usuário:", error.code);
          Swal.fire({
            icon: 'warning',
            title: 'Popup Bloqueado',
            html: 'Para fazer login com o Google dentro do Preview, o navegador precisa permitir popups.<br/><br/>Alternativamente, clique em <b>"Preview" (no canto superior direito do painel) para abrir o app em uma Nova Guia</b>, ou utilize e-mail e senha convencionais.',
            confirmButtonColor: '#0a0a2e'
          });
        } else {
          console.error("[AuthContext - login] Erro retornado de signInWithPopup no Preview:", error);
          if (error.code === 'auth/unauthorized-domain') {
            Swal.fire({
              icon: 'error',
              title: 'Domínio Não Autorizado',
              text: `O domínio "${window.location.hostname}" não está autorizado no Firebase Console. Para permitir login do Google neste preview, adicione este domínio à lista de domínios autorizados nas configurações do OAuth do Firebase.`,
              confirmButtonColor: '#0a0a2e'
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Falha no Login',
              text: `Não foi possível autenticar: ${error.message || String(error)} (Código: ${error.code || 'erro_desconhecido'})`,
              confirmButtonColor: '#0a0a2e'
            });
          }
        }
        throw error;
      }
    }

    // Fluxo convencional de produção (fora de iFrame e com domínio customizado definitivo)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      console.log("[AuthContext - login] Usuário Mobile em produção. Iniciando signInWithRedirect.");
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError: any) {
        console.error("[AuthContext - login] Falha no redirecionamento Google (Mobile):", redirectError);
        throw redirectError;
      }
    }

    try {
      console.log("[AuthContext - login] Disparando popup convencional de produção...");
      const credential = await signInWithPopup(auth, provider);
      setUser(credential.user);
    } catch (error: any) {
      console.error("[AuthContext - login] Erro no popup de produção:", error);
      const isPopupCancel = error.code === "auth/popup-blocked" || 
                            error.code === "auth/cancelled-popup-request" || 
                            error.code === "auth/popup-closed-by-user";

      if (isPopupCancel) {
        console.warn("[AuthContext - login] Popup bloqueado ou fechado na produção. Iniciando fallback de redirect...");
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: any) {
          console.error("[AuthContext - login] Erro no fallback de redirect de produção:", redirectError);
          throw redirectError;
        }
      }
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('gsa_sandbox_bypass_active');
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setRealProfile(null);
    setIsSimulating(false);
  };

  const forgotPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const docRef = doc(db, 'usuarios', user.uid);
    try {
      await updateDoc(docRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'usuarios/' + user.uid);
    }
    const updated = profile ? { ...profile, ...data } : null;
    setProfile(updated);
    setRealProfile(realProfile ? { ...realProfile, ...data } : null);
    if (updated) {
      localStorage.setItem(`profile_${user.uid}`, JSON.stringify(updated));
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
        setProfile(data);
        setRealProfile(data);
        localStorage.setItem(`profile_${user.uid}`, JSON.stringify(data));
      }
    } catch (error) {
      console.error("AuthContext: Error refreshing profile:", error);
    }
  };

  const registerWithEmail = async (
    email: string, 
    pass: string, 
    name: string, 
    cpf: string, 
    dataNascimento: string, 
    telefone: string
  ): Promise<UserCredential> => {
    try {
      if (pass.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = userCredential.user;
      
      const isAdmin = (email === 'carlessitiago@gmail.com' || email === 'nomelimpo.gsa@gmail.com' || email === 'atende.gsa@gmail.com');
      const newProfile: UserProfile = {
        uid: newUser.uid,
        nome_completo: name,
        email: newUser.email || email,
        cpf: cpf,
        data_nascimento: dataNascimento,
        telefone: telefone,
        nivel: isAdmin ? 'ADM_MASTER' : 'CLIENTE',
        status_conta: 'APROVADO',
        tem_empresa: false,
        saldo_pontos: 0,
        data_cadastro: new Date()
      };
      
      try {
        await setDoc(doc(db, 'usuarios', newUser.uid), newProfile);
        
        try {
          const { vincularHistoricoPublico } = await import('../services/userService');
          await vincularHistoricoPublico(newUser.uid, cpf);
        } catch (err) {
          console.warn('Erro ao chamar vincularHistoricoPublico:', err);
        }
        
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'notifications'), cleanData({
          usuario_id: 'ADM_MASTER',
          targetRole: 'ADM_MASTER',
          title: '👤 Novo Cadastro Público (E-mail)',
          message: `${newProfile.nome_completo} acabou de se cadastrar no sistema via e-mail/senha.`,
          tipo: 'info',
          lida: false,
          read: false,
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
          origem: 'publico'
        }));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'usuarios/' + newUser.uid);
      }

      setProfile(newProfile);
      setRealProfile(newProfile);
      return userCredential;
    } catch (error: any) {
      console.error("Erro no registro:", error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Este e-mail já está em uso. Tente fazer login ou use outro e-mail.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('O formato do e-mail é inválido.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('A senha é muito fraca. Use pelo menos 6 caracteres.');
      }
      throw error;
    }
  };

  useEffect(() => {
    const isSandbox = window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost');
    
    // Tenta recuperar sessão simulada anterior para não deslogar no HMR do preview
    if (isSandbox) {
      const savedBypass = localStorage.getItem('gsa_sandbox_bypass_active');
      if (savedBypass) {
        console.log("[AuthContext] Restaurando sessão de bypass ativa.");
        try {
          const parsed = JSON.parse(savedBypass);
          if (parsed) {
            setUser({ uid: parsed.uid, email: parsed.email } as any);
            setProfile(parsed);
            setRealProfile(parsed);
            setIsSimulating(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Erro ao restaurar bypass do local storage:", e);
        }
      }
    }

    // Processar resultados de signInWithRedirect (necessário após retorno de redirecionamento no celular)
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("[AuthContext - useEffect] Sucesso no retorno do redirect do Google!", result.user.email);
          setUser(result.user);
        }
      })
      .catch((error: any) => {
        console.error("[AuthContext - useEffect] Erro capturado no retorno do redirect Google:", error);
        if (error.code === 'auth/unauthorized-domain') {
          Swal.fire({
            icon: 'error',
            title: 'Domínio Não Autorizado',
            text: `O domínio "${window.location.hostname}" não está autorizado no seu Firebase Console para autenticação do Google.`,
            confirmButtonColor: '#0a0a2e'
          });
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        console.log("[AuthContext] Nenhum usuário autenticado no Firebase.");
        setUser(null);
        setProfile(null);
        setRealProfile(null);
        setIsSimulating(false);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      
      // ETAPA 1: Carrega do cache primeiro para exibição instantânea offline-first (Evita travar a UI)
      const cachedProfile = localStorage.getItem(`profile_${currentUser.uid}`);
      let cachedData: UserProfile | null = null;
      if (cachedProfile) {
        try {
          cachedData = JSON.parse(cachedProfile);
          console.log("[AuthContext] Perfil de cache encontrado. Desbloqueando UI imediatamente.");
          setProfile(cachedData);
          setRealProfile(cachedData);
          setLoading(false);
        } catch (e) {
          console.error("Erro ao carregar cache do perfil:", e);
        }
      }

      // Função interna para buscar perfil de forma remota/cache do Firestore
      const updateProfileAsync = async () => {
        try {
          const docRef = doc(db, 'usuarios', currentUser.uid);
          let docSnap;
          
          try {
            // Tenta o Firebase remoto primeiro com timeout de 12 segundos para evitar travamentos em conexões lentas
            const getDocPromise = getDoc(docRef);
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Firestore Sync timeout (12s limit reached)')), 12000);
            });
            docSnap = await Promise.race([getDocPromise, timeoutPromise]);
          } catch (getDocErr: any) {
            const isOfflineError = 
              getDocErr?.message?.toLowerCase().includes('offline') || 
              getDocErr?.message?.toLowerCase().includes('timeout') || 
              getDocErr?.code === 'unavailable' || 
              getDocErr?.code === 'failed-precondition';
            
            if (isOfflineError) {
              console.log("[AuthContext] Sincronização offline ou lenta. Buscando perfil do cache do Firestore...");
              try {
                const { getDocFromCache } = await import('firebase/firestore');
                docSnap = await getDocFromCache(docRef);
              } catch (cacheErr) {
                console.warn("[AuthContext] Perfil não localizado no cache offline do Firestore:", cacheErr);
                throw getDocErr;
              }
            } else {
              throw getDocErr;
            }
          }

          if (docSnap && docSnap.exists()) {
            const remoteData = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
            console.log("[AuthContext] Sincronização em background: perfil obtido do Firestore.", remoteData);
            setProfile(remoteData);
            setRealProfile(remoteData);
            localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(remoteData));
          } else {
            console.warn("[AuthContext] Usuário autenticado, mas sem documento de perfil no Firestore.");
            const isUserEmailAdmin = !!(currentUser.email && (
              currentUser.email === 'carlessitiago@gmail.com' ||
              currentUser.email === 'nomelimpo.gsa@gmail.com' ||
              currentUser.email === 'atende.gsa@gmail.com' ||
              currentUser.email === 'admin@admin.com'
            ));
            const tempProfile: UserProfile = {
              uid: currentUser.uid,
              nome_completo: currentUser.displayName || 'Usuário GSA',
              email: currentUser.email || '',
              cpf: '',
              data_nascimento: '',
              nivel: isUserEmailAdmin ? 'ADM_MASTER' : 'CLIENTE',
              status_conta: 'APROVADO',
              tem_empresa: false
            } as UserProfile;
            setProfile(tempProfile);
            setRealProfile(tempProfile);
            localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(tempProfile));
          }
        } catch (err: any) {
          const isOfflineErr = 
            err?.message?.toLowerCase().includes('offline') || 
            err?.message?.toLowerCase().includes('timeout') || 
            err?.code === 'unavailable' || 
            err?.code === 'failed-precondition';

          if (isOfflineErr) {
            console.warn("[AuthContext] Falha de conexão ou timeout com Firestore (Offline/Slow):", err.message || err);
          } else {
            console.error("[AuthContext] Falha ao sincronizar perfil remoto:", err);
          }
          
          // Se não houver nenhum cache carregado anteriormente, usa o fallback emergencial
          if (!cachedData) {
            const isUserEmailAdmin = !!(currentUser.email && (
              currentUser.email === 'carlessitiago@gmail.com' ||
              currentUser.email === 'nomelimpo.gsa@gmail.com' ||
              currentUser.email === 'atende.gsa@gmail.com' ||
              currentUser.email === 'admin@admin.com'
            ));

            const fallbackProfile: UserProfile = {
              uid: currentUser.uid,
              nome_completo: currentUser.displayName || 'Usuário GSA',
              email: currentUser.email || 'user@sandbox.com',
              nivel: isUserEmailAdmin ? 'ADM_MASTER' : (isSandbox ? 'ADM_MASTER' : 'CLIENTE'),
              status_conta: 'APROVADO',
              cpf: '',
              data_nascimento: '',
              tem_empresa: false
            } as UserProfile;
            console.log("[AuthContext] Criado perfil de fallback de emergência:", fallbackProfile);
            setProfile(fallbackProfile);
            setRealProfile(fallbackProfile);
          } else {
            // Se já tem cache, garante que o nível de email admin está atualizado se for o caso
            const isUserEmailAdmin = !!(currentUser.email && (
              currentUser.email === 'carlessitiago@gmail.com' ||
              currentUser.email === 'nomelimpo.gsa@gmail.com' ||
              currentUser.email === 'atende.gsa@gmail.com' ||
              currentUser.email === 'admin@admin.com'
            ));
            if (isUserEmailAdmin && cachedData && cachedData.nivel !== 'ADM_MASTER') {
              console.log("[AuthContext] Atualizando perfil de cache existente do admin para ADM_MASTER.");
              const updatedCache = { ...cachedData, nivel: 'ADM_MASTER' as const };
              setProfile(updatedCache);
              setRealProfile(updatedCache);
            }
          }
        } finally {
          setLoading(false);
        }
      };

      if (cachedData) {
        // Se já carregamos do cache, buscamos em background de forma assíncrona, SEM prender a UI em loading=true
        updateProfileAsync();
      } else {
        // Sem cache, precisamos de um loading inicial de segurança enquanto tentamos obter as informações
        setLoading(true);
        await updateProfileAsync();
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      login, 
      loginWithEmail, 
      registerWithEmail, 
      forgotPassword, 
      updateUserProfile, 
      refreshProfile,
      logout,
      simulateUser,
      stopSimulation,
      isSimulating,
      realProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
