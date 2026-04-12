import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './GSA/Sidebar';
import { Header } from './GSA/Header';
import { useAuth } from './AuthContext';
import { LoadingScreen } from './LoadingScreen';
import { collection, query, where, onSnapshot, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { confirmarTransacao, marcarFaturaVencida } from '../services/financialService';
import { sendNotification } from '../services/notificationService';
import { listarTodosUsuarios } from '../services/userService';

export const DashboardLayout: React.FC = () => {
  const { user, profile, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Estados de Dados (Movidos do DashboardFinanceiro)
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [showcaseLeads, setShowcaseLeads] = useState<any[]>([]);
  const [pendencies, setPendencies] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isConfirmingTransaction, setIsConfirmingTransaction] = useState<string | null>(null);
  const [transactionReceipt, setTransactionReceipt] = useState('');
  const [preSelectedService, setPreSelectedService] = useState<any>(null);

  useEffect(() => {
    if (!user || !profile) return;

    const nivel = profile.nivel;
    const uid = profile.uid;

    // Migração de Serviços (Pontos) - Apenas ADM_MASTER
    if (nivel === 'ADM_MASTER') {
      const migrateServices = async () => {
        try {
          const q = query(collection(db, 'services'));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(async (serviceDoc) => {
            const data = serviceDoc.data();
            if (data.pontos_cliente === undefined) {
              await updateDoc(doc(db, 'services', serviceDoc.id), {
                pontos_cliente: 10,
                pontos_vendedor: 50,
                pontos_gestor: 20
              });
            }
          });
        } catch (error) {
          console.error("Erro na migração de serviços:", error);
        }
      };
      migrateServices();
    }

    // Fetch pending transactions
    let qTrans = null;
    if (nivel === 'ADM_MASTER' || nivel === 'ADM_GERENTE') {
      qTrans = query(
        collection(db, 'financial_transactions'),
        where('confirmado_pelo_administrador', '==', false),
        orderBy('timestamp', 'desc')
      );
    } else if (nivel === 'GESTOR' && uid) {
      qTrans = query(
        collection(db, 'financial_transactions'),
        where('confirmado_pelo_administrador', '==', false),
        where('id_superior', '==', uid),
        orderBy('timestamp', 'desc')
      );
    } else if (nivel === 'VENDEDOR' && uid) {
      qTrans = query(
        collection(db, 'financial_transactions'),
        where('confirmado_pelo_administrador', '==', false),
        where('vendedor_id', '==', uid),
        orderBy('timestamp', 'desc')
      );
    } else if (uid) {
      qTrans = query(
        collection(db, 'financial_transactions'),
        where('confirmado_pelo_administrador', '==', false),
        where('cliente_id', '==', uid),
        orderBy('timestamp', 'desc')
      );
    }

    let unsubTrans = () => {};
    if (qTrans) {
      unsubTrans = onSnapshot(qTrans, (snapshot) => {
        setPendingTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Erro de permissão no Firestore (transactions): ", error);
      });
    }

    // Fetch sales
    let qSales = null;
    if (nivel === 'ADM_MASTER' || nivel === 'ADM_GERENTE' || nivel === 'ADM_ANALISTA') {
      qSales = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
    } else if (nivel === 'GESTOR' && uid) {
      qSales = query(collection(db, 'sales'), where('id_superior', '==', uid), orderBy('timestamp', 'desc'));
    } else if (nivel === 'VENDEDOR' && uid) {
      qSales = query(collection(db, 'sales'), where('vendedor_id', '==', uid), orderBy('timestamp', 'desc'));
    } else if (uid) {
      qSales = query(collection(db, 'sales'), where('cliente_id', '==', uid), orderBy('timestamp', 'desc'));
    }

    let unsubSales = () => {};
    if (qSales) {
      unsubSales = onSnapshot(qSales, (snapshot) => {
        setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Erro de permissão no Firestore (sales): ", error);
      });
    }

    // Fetch processes
    let qProc = null;
    if (nivel === 'ADM_MASTER' || nivel === 'ADM_GERENTE') {
      qProc = query(collection(db, 'order_processes'), orderBy('data_venda', 'desc'));
    } else if (nivel === 'GESTOR' && uid) {
      qProc = query(collection(db, 'order_processes'), where('id_superior', '==', uid), orderBy('data_venda', 'desc'));
    } else if (nivel === 'VENDEDOR' && uid) {
      qProc = query(collection(db, 'order_processes'), where('vendedor_id', '==', uid), orderBy('data_venda', 'desc'));
    } else if (uid) {
      qProc = query(collection(db, 'order_processes'), where('cliente_id', '==', uid), orderBy('data_venda', 'desc'));
    }
    
    let unsubProc = () => {};
    if (qProc) {
      unsubProc = onSnapshot(qProc, (snapshot) => {
        setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Erro de permissão no Firestore (processes): ", error);
      });
    }

    // Fetch showcase leads
    let qShowcase = null;
    if (nivel === 'ADM_MASTER' || nivel === 'ADM_GERENTE') {
      qShowcase = query(collection(db, 'showcase_leads'), orderBy('timestamp', 'desc'));
    } else if (nivel === 'GESTOR' && uid) {
      qShowcase = query(collection(db, 'showcase_leads'), where('vendedor_id', '==', uid), orderBy('timestamp', 'desc'));
    } else if (nivel === 'VENDEDOR' && uid) {
      qShowcase = query(collection(db, 'showcase_leads'), where('vendedor_id', '==', uid), orderBy('timestamp', 'desc'));
    } else if (uid) {
      qShowcase = query(collection(db, 'showcase_leads'), where('cliente_id', '==', uid), orderBy('timestamp', 'desc'));
    }

    let unsubShowcase = () => {};
    if (qShowcase) {
      unsubShowcase = onSnapshot(qShowcase, (snapshot) => {
        setShowcaseLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Erro de permissão no Firestore (showcase): ", error);
      });
    }

    // Fetch pendencies
    let qPend = null;
    if (nivel === 'ADM_MASTER' || nivel === 'ADM_GERENTE') {
      qPend = query(collection(db, 'pendencies'), where('status_pendencia', '!=', 'RESOLVIDO'));
    } else if (nivel === 'GESTOR' && uid) {
      qPend = query(collection(db, 'pendencies'), where('id_superior', '==', uid), where('status_pendencia', '!=', 'RESOLVIDO'));
    } else if (nivel === 'VENDEDOR' && uid) {
      qPend = query(collection(db, 'pendencies'), where('vendedor_id', '==', uid), where('status_pendencia', '!=', 'RESOLVIDO'));
    } else if (uid) {
      qPend = query(collection(db, 'pendencies'), where('cliente_id', '==', uid), where('status_pendencia', '!=', 'RESOLVIDO'));
    }

    let unsubPend = () => {};
    if (qPend) {
      unsubPend = onSnapshot(qPend, (snapshot) => {
        setPendencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Erro de permissão no Firestore (pendencies): ", error);
      });
    }

    // Fetch status history
    let qHistory = null;
    if (nivel === 'ADM_MASTER' || nivel === 'ADM_GERENTE' || nivel === 'ADM_ANALISTA') {
      qHistory = query(collection(db, 'status_history'), orderBy('timestamp', 'desc'));
    } else if (uid) {
      qHistory = query(
        collection(db, 'status_history'),
        where('visibilidade_uids', 'array-contains', uid),
        orderBy('timestamp', 'desc')
      );
    }

    let unsubHistory = () => {};
    if (qHistory) {
      unsubHistory = onSnapshot(qHistory, (snapshot) => {
        setStatusHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Erro de permissão no Firestore (history): ", error);
      });
    }

    listarTodosUsuarios().then(users => {
      const filtered = users.filter(u => {
        if (nivel === 'ADM_MASTER' || nivel === 'ADM_GERENTE') return true;
        if (nivel === 'GESTOR') {
          const isSelf = u.uid === uid;
          const isMyVendedor = u.nivel === 'VENDEDOR' && u.id_superior === uid;
          const isMyDirectClient = u.nivel === 'CLIENTE' && u.id_superior === uid;
          const myVendedoresIds = users.filter(v => v.nivel === 'VENDEDOR' && v.id_superior === uid).map(v => v.uid);
          const isMyVendedorClient = u.nivel === 'CLIENTE' && myVendedoresIds.includes(u.id_superior || '');
          return isSelf || isMyVendedor || isMyDirectClient || isMyVendedorClient;
        }
        if (nivel === 'VENDEDOR') {
          const isSelf = u.uid === uid;
          const isMyClient = u.nivel === 'CLIENTE' && u.id_superior === uid;
          return isSelf || isMyClient;
        }
        return u.uid === uid;
      });
      setAllUsers(filtered);
    }).catch(err => {
      console.error("Erro ao listar usuários: ", err);
    });

    return () => {
      unsubTrans();
      unsubSales();
      unsubProc();
      unsubShowcase();
      unsubPend();
      unsubHistory();
    };
  }, [user, profile]);

  if (loading) return <LoadingScreen />;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  // Get current view from path
  const currentView = location.pathname.substring(1) || 'dashboard';

  const totalPending = pendingTransactions.reduce((acc, curr) => acc + curr.valor, 0);
  const totalOpenInvoices = sales.filter(s => s.status_pagamento === 'Pendente' || s.status_pagamento === 'Vencida').reduce((acc, curr) => acc + curr.valor_total, 0);

  const contextProps = {
    pendingTransactions,
    clients: allUsers.filter(u => u.nivel === 'CLIENTE'),
    confirmarTransacao,
    sendNotification,
    sales,
    allUsers,
    setNotification,
    setIsConfirmingTransaction,
    setTransactionReceipt,
    currentProfile: profile,
    marcarFaturaVencida,
    totalPending,
    totalOpenInvoices,
    processes,
    pendencies,
    showcaseLeads,
    statusHistory,
    preSelectedService,
    setPreSelectedService
  };

  // Props for Header
  const headerProps = {
    view: currentView,
    currentProfile: profile,
    onMenuToggle: toggleSidebar,
    onLogout: logout,
    managerPhone: null,
    walletBalance: profile?.saldo_carteira || 0, 
    pointsBalance: profile?.saldo_pontos || 0,
    isNotificationOpen,
    setIsNotificationOpen,
    notifications: [], 
    markAsRead: () => {},
    setView: (v: string) => navigate(`/${v}`),
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar currentProfile={profile} logout={logout} onClose={closeSidebar} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header {...headerProps} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50/50">
          <div className="max-w-[1600px] mx-auto">
            <Outlet context={contextProps} />
          </div>
        </main>
      </div>
    </div>
  );
};
