import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
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
    } catch (error: any) {
      console.error("[AuthContext - login] Erro retornado de signInWithPopup:", {
        code: error.code,
        message: error.message,
        customData: error.customData,
        credential: error.credential
      });
      if (
        error.code === "auth/popup-blocked" || 
        error.code === "auth/cancelled-popup-request" || 
        error.code === "auth/popup-closed-by-user"
      ) {
        console.warn("[AuthContext - login] O Login com Google foi cancelado/bloqueado por popup no navegador:", error.code);
      } else {
        console.error("[AuthContext - login] Erro inesperado no login do Google:", error);
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
      
      // Carrega do cache primeiro para exibição instantânea offline-first
      const cachedProfile = localStorage.getItem(`profile_${currentUser.uid}`);
      let cachedData = null;
      if (cachedProfile) {
        try {
          cachedData = JSON.parse(cachedProfile);
          console.log("[AuthContext] Perfil carregado do cache síncrono. Desbloqueando visualização da UI.");
          setProfile(cachedData);
          setRealProfile(cachedData);
          setLoading(false); // UI desbloqueada imediatamente usando cache!
        } catch (e) {
          console.error("Erro ao carregar cache do perfil:", e);
        }
      }

      // Se não houver cache de perfil pré-existente, inicia o loading de segurança
      if (!cachedData) {
        console.log("[AuthContext - onAuthStateChanged] Nenhum perfil em cache localizado. Ativando loading de segurança.");
        setLoading(true);
      }

      try {
        const startTime = Date.now();
        console.log("[AuthContext - onAuthStateChanged] Iniciando sincronização remota do perfil no Firestore para UID:", currentUser.uid);
        const docRef = doc(db, 'usuarios', currentUser.uid);
        
        const fetchPromise = getDoc(docRef);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firestore Sync timeout (6s limit reached)')), 6000)
        );

        console.log("[AuthContext - onAuthStateChanged] Executando corrida contra timeout de 6 segundos...");
        const docSnap = (await Promise.race([fetchPromise, timeoutPromise])) as any;
        const duration = Date.now() - startTime;
        console.log(`[AuthContext - onAuthStateChanged] Resposta Firestore obtida em ${duration}ms!`);

        if (docSnap && docSnap.exists()) {
          const remoteData = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
          console.log("[AuthContext - onAuthStateChanged] Perfil remoto encontrado no documento:", remoteData);
          setProfile(remoteData);
          setRealProfile(remoteData);
          localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(remoteData));
          console.log("[AuthContext - onAuthStateChanged] Perfil remoto persistido localmente e estado redefinido.");
        } else {
          console.warn("[AuthContext - onAuthStateChanged] Usuário autenticado, mas documento de perfil não existe no Firestore!");
          // Se o usuário autenticado não possui registro no Firestore, cria um provisório CLIENTE
          const tempProfile: UserProfile = {
            uid: currentUser.uid,
            nome_completo: currentUser.displayName || 'Usuário GSA',
            email: currentUser.email || '',
            cpf: '',
            data_nascimento: '',
            nivel: 'CLIENTE',
            status_conta: 'APROVADO',
            tem_empresa: false
          } as UserProfile;
          setProfile(tempProfile);
          setRealProfile(tempProfile);
          localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(tempProfile));
          console.log("[AuthContext - onAuthStateChanged] Perfil provisório cadastrado em cache:", tempProfile);
        }
      } catch (err: any) {
        console.error("[AuthContext - onAuthStateChanged] Falha ou timeout na sincronização remota do perfil:", err);
        console.warn("[AuthContext - onAuthStateChanged] Ativando estratégia de fallback para não travar o cliente.");
        
        // Se após a falha de sincronização de rede o usuário ainda não tiver nenhum perfil carregado pelo cache
        if (!cachedData) {
          const fallbackProfile: UserProfile = {
            uid: currentUser.uid,
            nome_completo: currentUser.displayName || 'Usuário Sandbox',
            email: currentUser.email || 'user@sandbox.com',
            nivel: isSandbox ? 'ADM_MASTER' : 'CLIENTE',
            status_conta: 'APROVADO',
            cpf: '',
            data_nascimento: '',
            tem_empresa: false
          } as UserProfile;
          console.log("[AuthContext - onAuthStateChanged] Construído perfil de fallback emergencial:", fallbackProfile);
          setProfile(fallbackProfile);
          setRealProfile(fallbackProfile);
        } else {
          console.log("[AuthContext - onAuthStateChanged] Preservando perfil de cache síncrono existente:", cachedData);
        }
      } finally {
        console.log("[AuthContext - onAuthStateChanged] Finalizando ciclo. Definindo loading = false.");
        setLoading(false); // Encerra sempre o loading independente do sucesso ou timeout
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
