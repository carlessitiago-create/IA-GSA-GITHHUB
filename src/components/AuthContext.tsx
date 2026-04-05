import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
import { auth, db, OperationType, handleFirestoreError } from '../firebase';

export interface UserProfile {
  uid: string;
  nome_completo: string;
  email: string;
  cpf: string;
  data_nascimento: string;
  telefone?: string;
  whatsapp?: string;
  nivel: 'ADM_MASTER' | 'ADM_GERENTE' | 'ADM_ANALISTA' | 'GESTOR' | 'VENDEDOR' | 'CLIENTE';
  id_superior?: string;
  tem_empresa: boolean;
  nome_empresa?: string;
  cnpj?: string;
  status_conta: 'APROVADO' | 'PENDENTE' | 'RECUSADO' | 'SUSPENSO' | 'BLOQUEADO';
  data_cadastro?: any;
  saldo_pontos?: number; // Keep for legacy or points system
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

  const loadingRef = useRef(true);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    console.log("AuthContext: Initializing onAuthStateChanged...");
    
    // Safety timeout to prevent infinite loading - Increased to 15s for mobile
    const safetyTimeout = setTimeout(() => {
      if (loadingRef.current) {
        console.warn("AuthContext: Loading timed out after 15s. Forcing loading to false.");
        setLoading(false);
      }
    }, 15000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("AuthContext: onAuthStateChanged triggered. User:", user?.email || "null", "UID:", user?.uid);
      try {
        setUser(user);
        if (user) {
          const docRef = doc(db, 'usuarios', user.uid);
          let docSnap;
          try {
            console.log("AuthContext: Fetching profile for UID:", user.uid);
            docSnap = await getDoc(docRef);
          } catch (error) {
            console.error("AuthContext: Error fetching profile for UID", user.uid, ":", error);
            handleFirestoreError(error, OperationType.GET, 'usuarios/' + user.uid);
          }
          
          if (docSnap && docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            console.log("AuthContext: Profile found for UID", user.uid, ":", data.nivel, "Status:", data.status_conta);
            const isAdminEmail = (user.email === 'carlessitiago@gmail.com' || user.email === 'nomelimpo.gsa@gmail.com' || user.email === 'atende.gsa@gmail.com');
            
            if (isAdminEmail && data.nivel !== 'ADM_MASTER') {
              data.nivel = 'ADM_MASTER';
              data.status_conta = 'APROVADO';
              try {
                await updateDoc(docRef, { nivel: 'ADM_MASTER', status_conta: 'APROVADO' });
              } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, 'usuarios/' + user.uid);
              }
            }
            setProfile(data);
            setRealProfile(data);
          } else {
            console.log("AuthContext: Profile not found. Creating default profile...");
            // Create default profile if not exists (usually for first login)
            const isAdmin = (user.email === 'carlessitiago@gmail.com' || user.email === 'nomelimpo.gsa@gmail.com' || user.email === 'atende.gsa@gmail.com');
            const newProfile: UserProfile = {
              uid: user.uid,
              nome_completo: user.displayName || 'Usuário',
              email: user.email || '',
              cpf: '',
              data_nascimento: '',
              nivel: isAdmin ? 'ADM_MASTER' : 'CLIENTE',
              status_conta: 'APROVADO',
              tem_empresa: false,
              data_cadastro: new Date()
            };
            try {
              await setDoc(docRef, newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, 'usuarios/' + user.uid);
            }

            // Notifica o ADM Master - Cadastro Público via Google
            try {
              const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
              await addDoc(collection(db, 'notifications'), {
                usuario_id: 'ADM_MASTER',
                targetRole: 'ADM_MASTER',
                title: '👤 Novo Cadastro Público (Google)',
                message: `${newProfile.nome_completo} acabou de se cadastrar no sistema via Google.`,
                tipo: 'info',
                lida: false,
                read: false,
                timestamp: serverTimestamp(),
                createdAt: serverTimestamp(),
                origem: 'publico'
              });
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, 'notifications');
            }

            setProfile(newProfile);
            setRealProfile(newProfile);
          }
        } else {
          console.log("AuthContext: No user authenticated.");
          setProfile(null);
          setRealProfile(null);
          setIsSimulating(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        console.log("AuthContext: Setting loading to false.");
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, name: string, cpf: string, dataNascimento: string, telefone: string): Promise<UserCredential> => {
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
        
        // Notifica o ADM Master - Cadastro Público via E-mail
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'notifications'), {
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
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'usuarios/' + newUser.uid);
      }

      // Notifica o ADM Master
      try {
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'notifications'), {
          usuario_id: 'ADM_MASTER',
          targetRole: 'ADM_MASTER',
          title: '👤 Novo Cliente na Base',
          message: `${name} acabou de se cadastrar no sistema e está pendente de aprovação.`,
          tipo: 'info',
          lida: false,
          read: false,
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, 'notifications');
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
    setProfile(prev => prev ? { ...prev, ...data } : null);
    setRealProfile(prev => prev ? { ...prev, ...data } : null);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const simulateUser = (simProfile: UserProfile) => {
    setProfile(simProfile);
    setIsSimulating(true);
  };

  const stopSimulation = () => {
    setProfile(realProfile);
    setIsSimulating(false);
  };

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
