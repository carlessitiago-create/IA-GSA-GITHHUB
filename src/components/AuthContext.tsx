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
      // Timeout de segurança para gravação (45s)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore update timeout (45s limit)')), 45000)
      );
      
      await Promise.race([
        updateDoc(docRef, data),
        timeoutPromise
      ]);
    } catch (error) {
      console.warn("[AuthContext] Erro ou Timeout ao atualizar perfil:", error);
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
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (e: any) {
        console.warn("[AuthContext] Erro ao atualizar perfil (tentando cache):", e);
        try {
          const { getDocFromCache } = await import('firebase/firestore');
          docSnap = await getDocFromCache(docRef);
        } catch (cacheErr) {
          console.warn("[AuthContext] Perfil não encontrado nem no cache durante refresh.");
          return;
        }
      }

      if (docSnap && docSnap.exists()) {
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
        // Timeout de segurança para criação de perfil (60s)
        const profileTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firestore profile creation timeout (60s limit)')), 60000)
        );

        await Promise.race([
          setDoc(doc(db, 'usuarios', newUser.uid), newProfile),
          profileTimeoutPromise
        ]);
        
        try {
          const { vincularHistoricoPublico } = await import('../services/userService');
          // Vinculação "fire and forget" para não travar o fluxo principal
          vincularHistoricoPublico(newUser.uid, cpf).catch(e => console.warn("Background link failed:", e));
        } catch (err) {
          console.warn('Erro ao carregar vincularHistoricoPublico:', err);
        }
        
        try {
          const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
          addDoc(collection(db, 'notifications'), cleanData({
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
          })).catch(e => console.warn("Background notification failed:", e));
        } catch (e) {
          console.warn("Could not send registration notification:", e);
        }
      } catch (error) {
        console.error("[AuthContext] Falha ao persistir perfil no Firestore:", error);
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
    const CACHE_KEY = 'gsa_user_profile';
    const PENDING_KEY = 'gsa_pending_profile_update';

    const loadCache = (uid: string): UserProfile | null => {
      try {
        // Tenta a chave nova primeiro, depois a chave antiga por compatibilidade
        const data = localStorage.getItem(CACHE_KEY) || localStorage.getItem(`profile_${uid}`);
        if (!data) return null;
        const parsed = JSON.parse(data) as UserProfile;
        // Valida que o cache pertence ao usuário atual
        if (parsed.uid !== uid) return null;
        return parsed;
      } catch { return null; }
    };

    const saveCache = (profile: UserProfile) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
        localStorage.setItem(`profile_${profile.uid}`, JSON.stringify(profile));
      } catch {}
    };

    const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
      try {
        const docRef = doc(db, 'usuarios', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
          saveCache(data);
          return data;
        }
      } catch (err: any) {
        console.warn("[AuthContext] fetchProfile offline ou erro:", err.message);
        // Tenta cache interno do Firestore
        try {
          const { getDocFromCache } = await import('firebase/firestore');
          const cached = await getDocFromCache(doc(db, 'usuarios', uid));
          if (cached.exists()) {
            const data = { uid: cached.id, ...cached.data() } as UserProfile;
            saveCache(data);
            return data;
          }
        } catch {}
      }
      return null;
    };

    // Restaura sessão de bypass sandbox se existir (sobrevive a HMR)
    const isSandbox = window.location.hostname.includes('run.app') || 
                      window.location.hostname.includes('localhost') ||
                      window.location.hostname.includes('ais-dev');

    if (isSandbox) {
      const savedBypass = localStorage.getItem('gsa_sandbox_bypass_active');
      if (savedBypass) {
        try {
          const parsed = JSON.parse(savedBypass);
          if (parsed?.uid) {
            setUser({ uid: parsed.uid, email: parsed.email } as any);
            setProfile(parsed);
            setRealProfile(parsed);
            setIsSimulating(true);
            setLoading(false);
            return;
          }
        } catch {}
      }
    }

    getRedirectResult(auth)
      .then((result) => { if (result) setUser(result.user); })
      .catch((error: any) => {
        if (error.code === 'auth/unauthorized-domain') {
          console.warn("[AuthContext] Domínio não autorizado no Firebase.");
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setRealProfile(null);
        setIsSimulating(false);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // ETAPA 1: cache local imediato — libera UI sem rede
      const cached = loadCache(firebaseUser.uid);
      if (cached) {
        setProfile(cached);
        setRealProfile(cached);
        setLoading(false);
        // Atualiza em background
        fetchProfile(firebaseUser.uid).then(fresh => {
          if (fresh) { setProfile(fresh); setRealProfile(fresh); }
        });
        return;
      }

      // ETAPA 2: sem cache — tenta Firestore
      setLoading(true);
      const fetched = await fetchProfile(firebaseUser.uid);
      if (fetched) {
        setProfile(fetched);
        setRealProfile(fetched);
        setLoading(false);
        return;
      }

      // ETAPA 3: Firestore offline + sem cache → verifica update pendente
      try {
        const pendingRaw = localStorage.getItem(PENDING_KEY) || 
                           localStorage.getItem('pending_profile_update');
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          if (pending.uid === firebaseUser.uid) {
            const p = { ...pending, nome_completo: pending.nome_completo || pending.nome || 'Usuário' } as UserProfile;
            setProfile(p);
            setRealProfile(p);
            setLoading(false);
            return;
          }
        }
      } catch {}

      // ETAPA 4: último recurso — admins conhecidos recebem acesso direto
      const ADMIN_EMAILS = [
        "carlessitiago@gmail.com",
        "teste@gsa.com.br",
        "nomelimpo.gsa@gmail.com",
        "atende.gsa@gmail.com",
        "admin@admin.com"
      ];
      const isKnownAdmin = ADMIN_EMAILS.includes(firebaseUser.email || "");

      const fallback: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        nome_completo: firebaseUser.displayName || "Usuário",
        nome: firebaseUser.displayName || "Usuário",
        nivel: isKnownAdmin ? "ADM_MASTER" : "CLIENTE",
        status_conta: "APROVADO",
        cpf: isKnownAdmin ? "000.000.000-00" : "",
        tem_empresa: false,
        data_cadastro: new Date()
      } as any;

      saveCache(fallback);
      setProfile(fallback);
      setRealProfile(fallback);
      setLoading(false);
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
