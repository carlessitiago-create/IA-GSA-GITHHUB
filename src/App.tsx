import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./components/AuthContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { DashboardLayout } from "./components/DashboardLayout";

// Lazy Loading Views
const LoginView = lazy(() => import("./components/LoginView"));
const DashboardFinanceiro = lazy(() => import("./pages/DashboardFinanceiro").then(m => ({ default: m.DashboardFinanceiro })));
const PortalCliente = lazy(() => import("./components/PortalCliente").then(m => ({ default: m.PortalCliente })));
const PublicPortal = lazy(() => import("./views/PublicPortal").then(m => ({ default: m.PublicPortal })));
const VitrinePublicaView = lazy(() => import("./views/VitrinePublicaView").then(m => ({ default: m.VitrinePublicaView })));
const ProposalLandingPage = lazy(() => import("./views/ProposalLandingPage").then(m => ({ default: m.ProposalLandingPage })));

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
const ConsultaPublicaView = lazy(() => import("./views/ConsultaPublicaView").then(m => ({ default: m.ConsultaPublicaView })));
const ClubePontosView = lazy(() => import("./views/ClubePontosView").then(m => ({ default: m.ClubePontosView })));
const ClubeMarketingView = lazy(() => import("./views/ClubeMarketingView").then(m => ({ default: m.ClubeMarketingView })));
const ClientProcessesView = lazy(() => import("./components/GSA/ClientProcessesView").then(m => ({ default: m.ClientProcessesView })));
const ClientWalletView = lazy(() => import("./components/GSA/ClientWalletView").then(m => ({ default: m.ClientWalletView })));

// Auth Components (Keeping them non-lazy for now as they are small and critical)
import { PendingApproval, AccountRefused, AccountSuspended, CompleteProfile } from "./components/Auth";

// 1. Componente ProtectedRoute para lidar com a verificação de status
const ProtectedRoute: React.FC = () => {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Se não estiver logado, redireciona para login (ou renderiza LoginView)
  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <LoginView />
      </Suspense>
    );
  }

  // Se o perfil não existe ou está incompleto (sem CPF), força completar perfil
  if (profile && !profile.cpf) {
    return <CompleteProfile profile={profile} />;
  }

  // Verificação de Status da Conta
  if (profile?.status_conta === 'PENDENTE') {
    return <PendingApproval profile={profile} onLogout={logout} />;
  }

  if (profile?.status_conta === 'RECUSADO') {
    return <AccountRefused onLogout={logout} />;
  }

  if (profile?.status_conta === 'SUSPENSO') {
    return <AccountSuspended status="SUSPENSO" onLogout={logout} />;
  }

  // Se tudo estiver OK, renderiza as rotas filhas via Outlet
  return <Outlet />;
};

// 2. Componente de Redirecionamento Inicial baseado no nível do usuário
const RootRedirect: React.FC = () => {
  const { profile } = useAuth();
  const nivel = profile?.nivel;

  const isAdm = nivel === "ADM_MASTER" || nivel === "ADM_GERENTE" || nivel === "ADM_ANALISTA" || nivel === "GESTOR" || nivel === "VENDEDOR";

  if (isAdm) {
    // Redireciona para a aba padrão do Dashboard Administrativo
    return <Navigate to="/financeiro" replace />;
  }

  // Redireciona para a aba padrão do Portal do Cliente
  return <Navigate to="/clube_pontos" replace />;
};

const App: React.FC = () => {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Rotas Públicas (Acessíveis sem login) */}
        <Route path="/vendas/p/:slug" element={<ProposalLandingPage />} />
        <Route path="/p/:slug" element={<ProposalLandingPage />} />
        <Route path="/consulta" element={<PublicPortal />} />
        <Route path="/cp" element={<PublicPortal />} />
        <Route path="/vitrine-publica" element={<VitrinePublicaView />} />
        <Route path="/vendas" element={<VitrinePublicaView />} />

        {/* Rotas Protegidas (Exigem login e status OK) */}
        <Route element={<ProtectedRoute />}>
          {/* Redirecionamento Inicial */}
          <Route path="/" element={<RootRedirect />} />
          
            {/* Layout Unificado para Dashboard / Gestão / Portal */}
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<RootRedirect />} />
              
              {/* Rotas Administrativas Diretas */}
              <Route path="/financeiro" element={<DashboardFinanceiro />} />
              <Route path="/equipe" element={<GestaoEquipeView />} />
              <Route path="/inteligencia" element={<IntelligenceDashboardView />} />
              <Route path="/vendas-internas" element={<VendasPDVView />} />
              <Route path="/leads" element={<LeadsCentralView />} />
              <Route path="/operacional" element={<OperationalView />} />
              <Route path="/pendencias" element={<PendencyList />} />
              <Route path="/auditoria" element={<AuditoriaProcesso />} />
              <Route path="/clube" element={<MyClubView />} />
              <Route path="/consulta-interna" element={<ConsultaPublicaView />} />
              <Route path="/suporte" element={<SupportModule />} />
              <Route path="/fabrica" element={<ServiceFactoryView />} />
              <Route path="/perfil" element={<ProfileView />} />
              <Route path="/vitrine" element={<VitrineView />} />
              <Route path="/conversao" element={<ConversionDashboardView />} />
              <Route path="/processos" element={<ProcessModelsManager />} />
              <Route path="/dashboard" element={<DashboardView />} />

              {/* Rotas Portal do Cliente Diretas */}
              <Route path="/clube_pontos" element={<ClubePontosView />} />
              <Route path="/vitrine-cliente" element={<VitrineView />} />
              <Route path="/clube-cliente" element={<ClubeMarketingView />} />
              <Route path="/processos-cliente" element={<ClientProcessesView />} />
              <Route path="/carteira" element={<ClientWalletView />} />
              <Route path="/perfil-cliente" element={<ProfileView />} />
            </Route>
        </Route>

        {/* Fallback para rotas não encontradas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
