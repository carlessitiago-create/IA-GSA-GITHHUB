import React, { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./components/AuthContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { DashboardLayout } from "./components/DashboardLayout";
import { DashboardFinanceiro } from "./pages/DashboardFinanceiro";

// Lazy Loading Views
const LoginView = lazy(() => import("./components/LoginView"));
const PortalCliente = lazy(() => import("./components/PortalCliente").then(m => ({ default: m.PortalCliente })));
const PublicPortal = lazy(() => import("./views/PublicPortal").then(m => ({ default: m.PublicPortal })));
const VitrinePublicaView = lazy(() => import("./views/VitrinePublicaView").then(m => ({ default: m.VitrinePublicaView })));
const ProposalLandingPage = lazy(() => import("./views/ProposalLandingPage").then(m => ({ default: m.ProposalLandingPage })));
const SaaSLandingPage = lazy(() => import("./views/SaaSLandingPage"));

// Admin Views
const FinanceiroView = lazy(() => import("./views/FinanceiroView").then(m => ({ default: m.FinanceiroView })));
const GestaoEquipeView = lazy(() => import("./views/GestaoEquipeView").then(m => ({ default: m.GestaoEquipeView })));
const IntelligenceDashboardView = lazy(() => import("./views/IntelligenceDashboardView").then(m => ({ default: m.IntelligenceDashboardView })));
const VendasPDVView = lazy(() => import("./views/VendasPDVView").then(m => ({ default: m.VendasPDVView })));
const LeadsCentralView = lazy(() => import("./components/GSA/LeadsCentralView").then(m => ({ default: m.LeadsCentralView })));
const OperationalView = lazy(() => import("./components/GSA/OperationalView").then(m => ({ default: m.OperationalView })));
const PendencyList = lazy(() => import("./components/GSA/PendencyList").then(m => ({ default: m.PendencyList })));
const AuditoriaProcesso = lazy(() => import("./components/GSA/AuditoriaProcesso").then(m => ({ default: m.AuditoriaProcesso })));
const MyClubView = lazy(() => import("./components/GSA/MyClubView").then(m => ({ default: m.MyClubView })));
const SupportModule = lazy(() => import("./components/Support/SupportModule"));
const ServiceFactoryView = lazy(() => import("./components/GSA/ServiceFactoryView").then(m => ({ default: m.ServiceFactoryView })));
const ProfileView = lazy(() => import("./views/ProfileView").then(m => ({ default: m.ProfileView })));
const ProcessModelsManager = lazy(() => import("./components/GSA/ProcessModelsManager").then(m => ({ default: m.ProcessModelsManager })));
const DashboardView = lazy(() => import("./views/DashboardView").then(m => ({ default: m.DashboardView })));
const ConversionDashboardView = lazy(() => import("./views/ConversionDashboardView").then(m => ({ default: m.ConversionDashboardView })));
const VitrineView = lazy(() => import("./components/GSA/VitrineView").then(m => ({ default: m.VitrineView })));
const AdminNotificationSettingsView = lazy(() => import("./views/AdminNotificationSettingsView"));
const ConsultaPublicaView = lazy(() => import("./views/ConsultaPublicaView").then(m => ({ default: m.ConsultaPublicaView })));
const ClubePontosView = lazy(() => import("./views/ClubePontosView").then(m => ({ default: m.ClubePontosView })));
const ClubeMarketingView = lazy(() => import("./views/ClubeMarketingView").then(m => ({ default: m.ClubeMarketingView })));
const ClientProcessesView = lazy(() => import("./components/GSA/ClientProcessesView").then(m => ({ default: m.ClientProcessesView })));
const ClientWalletView = lazy(() => import("./components/GSA/ClientWalletView").then(m => ({ default: m.ClientWalletView })));
const TabelaCustasView = lazy(() => import("./views/TabelaCustasView").then(m => ({ default: m.TabelaCustasView })));
const VendaEmMassaView = lazy(() => import("./views/VendaEmMassaView").then(m => ({ default: m.VendaEmMassaView })));

// Auth Components
import { PendingApproval, AccountRefused, AccountSuspended, CompleteProfile } from "./components/Auth";

// 1. Guardião das Rotas Privadas
const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, logout } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user && !profile) return <LoadingScreen />;
  if (profile && !profile.cpf) return <CompleteProfile profile={profile} />;

  if (profile?.status_conta === 'PENDENTE') return <PendingApproval profile={profile} onLogout={logout} />;
  if (profile?.status_conta === 'RECUSADO') return <AccountRefused onLogout={logout} />;
  if (profile?.status_conta === 'SUSPENSO') return <AccountSuspended status="SUSPENSO" onLogout={logout} />;

  return children ? <>{children}</> : <Outlet />;
};

// 2. Redirecionamento após login (Painel Administrativo vs Portal Cliente)
const RootRedirect: React.FC = () => {
  const { profile } = useAuth();
  const isAdm = ["ADM_MASTER", "ADM_GERENTE", "ADM_ANALISTA", "GESTOR", "VENDEDOR"].includes(profile?.nivel || "");
  return <Navigate to={isAdm ? "/financeiro" : "/clube_pontos"} replace />;
};

// 3. NOVO: Gerenciador Inteligente da Rota Raiz (Resolve o problema de domínio)
const DynamicRoot: React.FC = () => {
  const { user, loading } = useAuth();
  const hostname = window.location.hostname.toLowerCase();

  if (loading) return <LoadingScreen />;

  // Se o usuário está logado, ele SEMPRE vai pro painel, não importa o domínio.
  if (user) return <RootRedirect />;

  // --- REGRAS PARA QUEM NÃO ESTÁ LOGADO ---
  
  // A. Se estiver tentando acessar diretamente o subdomínio do App (força login)
  if (hostname.includes('app.') || hostname.includes('aplicativo.') || hostname.includes('firebaseapp.com')) {
    return <Navigate to="/login" replace />;
  }

  // B. Subdomínios Públicos Específicos
  if (hostname.includes('diagnostico') || hostname.includes('indica') || hostname.includes('xn--diagnstico-ybb')) {
    return <SaaSLandingPage />;
  }
  if (hostname.includes('consulta')) {
    return <PublicPortal />;
  }

  // C. Domínio Principal Público Padrão (ex: 72hrs.online)
  return <SaaSLandingPage />;
};

const App: React.FC = () => {
  
  useEffect(() => {
    // Matador agressivo de Service Workers para evitar caches zumbis
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach(r => r.unregister());
      });
    }
  }, []);

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        
        {/* Rota Raiz (/) -> O DynamicRoot decide qual página exibir baseado no domínio */}
        <Route path="/" element={<DynamicRoot />} />
        
        {/* ROTAS 100% PÚBLICAS (Fora de validações de usuário) */}
        <Route path="/diagnostico/*" element={<SaaSLandingPage />} />
        <Route path="/consulta/*" element={<PublicPortal />} />
        <Route path="/login" element={<LoginView />} />
        <Route path="/vendas/p/:slug" element={<ProposalLandingPage />} />
        <Route path="/p/:slug" element={<ProposalLandingPage />} />
        <Route path="/cp/*" element={<PublicPortal />} />
        <Route path="/vitrine-publica/*" element={<VitrinePublicaView />} />
        <Route path="/vendas/*" element={<VitrinePublicaView />} />

        {/* ROTAS PRIVADAS (Sistema) -> Protegidas pelo Guardião */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/financeiro" element={<DashboardFinanceiro />} />
            <Route path="/equipe" element={<GestaoEquipeView />} />
            <Route path="/inteligencia" element={<IntelligenceDashboardView />} />
            <Route path="/vendas-internas" element={<VendasPDVView />} />
            <Route path="/venda-massa" element={<VendaEmMassaView />} />
            <Route path="/leads" element={<LeadsCentralView />} />
            <Route path="/operacional" element={<OperationalView />} />
            <Route path="/pendencias" element={<PendencyList />} />
            <Route path="/auditoria" element={<AuditoriaProcesso />} />
            <Route path="/clube" element={<MyClubView />} />
            <Route path="/custas" element={<TabelaCustasView />} />
            <Route path="/consulta-interna" element={<ConsultaPublicaView />} />
            <Route path="/suporte" element={<SupportModule />} />
            <Route path="/fabrica" element={<ServiceFactoryView />} />
            <Route path="/perfil" element={<ProfileView />} />
            <Route path="/vitrine" element={<VitrineView />} />
            <Route path="/conversao" element={<ConversionDashboardView />} />
            <Route path="/processos" element={<ProcessModelsManager />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/saas-settings" element={<DashboardView view="saas_settings" />} />
            <Route path="/admin_clube_settings" element={<DashboardView view="admin_clube_settings" />} />
            <Route path="/configuracoes-notificacoes" element={<AdminNotificationSettingsView />} />

            {/* Rotas Portal do Cliente Diretas */}
            <Route path="/clube_pontos" element={<ClubePontosView />} />
            <Route path="/vitrine-cliente" element={<VitrineView />} />
            <Route path="/clube-cliente" element={<ClubeMarketingView />} />
            <Route path="/processos-cliente" element={<ClientProcessesView />} />
            <Route path="/carteira" element={<ClientWalletView />} />
            <Route path="/perfil-cliente" element={<ProfileView />} />
          </Route>
        </Route>

        {/* Trata links quebrados enviando gentilmente para o começo */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
