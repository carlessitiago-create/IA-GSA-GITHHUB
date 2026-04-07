import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { FinanceiroView } from '../views/FinanceiroView';
import { GestaoEquipeView } from '../views/GestaoEquipeView';
import { IntelligenceDashboardView } from '../views/IntelligenceDashboardView';
import { PendencyList } from '../components/GSA/PendencyList';
import AlertCenter from '../components/GSA/AlertCenter';
import EfficiencyReport from '../components/Admin/EfficiencyReport';
import SupportModule from '../components/Support/SupportModule';
import { LeadsCentralView } from '../components/GSA/LeadsCentralView';
import { OperationalView } from '../components/GSA/OperationalView';
import { VendasPDVView } from '../views/VendasPDVView';
import { ConsultaPublicaView } from '../views/ConsultaPublicaView';
import { ClubeMarketingView } from '../views/ClubeMarketingView';
import { ServiceFactoryView } from '../components/GSA/ServiceFactoryView';
import { ProfileView } from '../views/ProfileView';
import { PointsSettingsView } from '../components/GSA/PointsSettingsView';
import { VitrineView } from '../components/GSA/VitrineView';
import { confirmarTransacao, marcarFaturaVencida } from '../services/financialService';
import { sendNotification } from '../services/notificationService';
import { listarTodosUsuarios } from '../services/userService';
import { useNavigate, useLocation } from 'react-router-dom';
import { ConversionDashboardView } from '../views/ConversionDashboardView';
import { ClientDashboardView } from '../views/ClientDashboardView';
import { 
  LayoutDashboard, 
  Users, 
  Brain, 
  ShoppingCart, 
  Target, 
  Activity, 
  AlertTriangle, 
  ShieldCheck, 
  Gift, 
  Search, 
  LifeBuoy, 
  Factory, 
  UserCircle,
  ClipboardList,
  Bell,
  ShieldHalf,
  User,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TabType = 'financeiro' | 'equipe' | 'inteligencia' | 'vendas' | 'leads' | 'operacional' | 'pendencias' | 'auditoria' | 'clube' | 'consulta' | 'suporte' | 'fabrica' | 'perfil' | 'vitrine' | 'conversao' | 'processos';

import { Sidebar } from '../components/Sidebar';
import { Outlet } from 'react-router-dom';

export function DashboardFinanceiro() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('financeiro');

  // Sincroniza a aba com a URL
  useEffect(() => {
    const path = location.pathname.substring(1); // Remove a barra inicial
    const validTabs: TabType[] = ['financeiro', 'equipe', 'inteligencia', 'vendas', 'leads', 'operacional', 'pendencias', 'auditoria', 'clube', 'consulta', 'suporte', 'fabrica', 'perfil', 'vitrine', 'conversao', 'processos'];
    
    if (path && (validTabs as string[]).includes(path)) {
      setActiveTab(path as TabType);
    }
  }, [location.pathname]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`/${tab}`);
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

    // Migração de Serviços (Pontos)
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

    if (nivel === 'ADM_ANALISTA' && activeTab === 'financeiro') {
      handleTabChange('operacional');
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

    // Fetch status history for activities
    const qHistory = query(collection(db, 'status_history'), orderBy('timestamp', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      setStatusHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Erro de permissão no Firestore (history): ", error);
    });

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

  const tabs: { id: TabType, label: string, icon: any, roles?: string[], color?: string }[] = [
    { id: 'financeiro', label: 'Financeiro', icon: LayoutDashboard, roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    { id: 'vendas', label: 'Vendas (PDV)', icon: ShoppingCart, roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'], color: 'border-emerald-100 text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
    { id: 'processos', label: 'Meus Processos', icon: ClipboardList, roles: ['CLIENTE'] },
    { id: 'equipe', label: profile?.nivel === 'VENDEDOR' ? 'Meus Clientes' : profile?.nivel === 'GESTOR' ? 'Minha Equipe' : 'Equipe', icon: Users, roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    { id: 'leads', label: 'Leads', icon: Target, roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    { id: 'operacional', label: 'Operacional', icon: Activity, roles: ['ADM_MASTER', 'ADM_GERENTE', 'ADM_ANALISTA'] },
    { id: 'pendencias', label: 'Pendências', icon: AlertTriangle, color: 'border-amber-100 text-amber-600 bg-amber-50 hover:bg-amber-100' },
    { id: 'inteligencia', label: 'Inteligência', icon: Brain, roles: ['ADM_MASTER', 'GESTOR'] },
    { id: 'conversao', label: 'Conversão', icon: Target, roles: ['ADM_MASTER', 'GESTOR'], color: 'border-indigo-100 text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
    { id: 'auditoria', label: 'Auditoria SLA', icon: ShieldCheck, roles: ['ADM_MASTER'] },
    { id: 'clube', label: 'Clube', icon: Gift },
    { id: 'vitrine', label: 'Vitrine', icon: ShoppingCart },
    { id: 'fabrica', label: 'Fábrica', icon: Factory, roles: ['ADM_MASTER', 'ADM_GERENTE'] },
    { id: 'consulta', label: 'Consulta', icon: Search, roles: ['ADM_MASTER', 'ADM_GERENTE', 'ADM_ANALISTA', 'GESTOR', 'VENDEDOR'] },
    { id: 'suporte', label: 'Suporte', icon: LifeBuoy },
    { id: 'perfil', label: 'Perfil', icon: UserCircle },
  ];

  const totalPending = pendingTransactions.reduce((acc, curr) => acc + curr.valor, 0);
  const totalOpenInvoices = sales.filter(s => s.status_pagamento === 'Pendente' || s.status_pagamento === 'Vencida').reduce((acc, curr) => acc + curr.valor_total, 0);

  const props = {
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
    setPreSelectedService,
    setActiveTab
  };

  return (
    <div className="w-full space-y-8">
      <AlertCenter onResolveClick={() => handleTabChange('pendencias')} />

      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl font-bold text-sm shadow-sm border ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-red-50 border-red-100 text-red-800'
          }`}
        >
          {notification.message}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'financeiro' && <FinanceiroView {...props} />}
          {activeTab === 'equipe' && <GestaoEquipeView />}
          {activeTab === 'inteligencia' && (
            <IntelligenceDashboardView 
              sales={sales}
              processes={processes}
              pendencies={pendencies}
              allUsers={allUsers}
              statusHistory={statusHistory}
            />
          )}
          {activeTab === 'processos' && <ClientDashboardView processes={processes} pendencies={pendencies} showcaseLeads={showcaseLeads} />}
          {activeTab === 'conversao' && <ConversionDashboardView />}
          {activeTab === 'vendas' && <VendasPDVView preSelectedService={preSelectedService} setPreSelectedService={setPreSelectedService} />}
          {activeTab === 'leads' && <LeadsCentralView />}
          {activeTab === 'operacional' && <OperationalView />}
          {activeTab === 'pendencias' && <PendencyList />}
          {activeTab === 'auditoria' && <EfficiencyReport />}
          {activeTab === 'clube' && (profile?.nivel?.startsWith('ADM') ? <PointsSettingsView /> : <ClubeMarketingView />)}
          {activeTab === 'vitrine' && <VitrineView setActiveTab={handleTabChange} setPreSelectedService={setPreSelectedService} />}
          {activeTab === 'fabrica' && <ServiceFactoryView />}
          {activeTab === 'consulta' && <ConsultaPublicaView />}
          {activeTab === 'suporte' && profile && <SupportModule nivel={profile.nivel} />}
          {activeTab === 'perfil' && <ProfileView />}
          <Outlet context={props} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

