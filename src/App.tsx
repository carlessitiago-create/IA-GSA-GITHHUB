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
        <Route path="/vitrine-publica" element={<VitrinePublicaView />} />
        <Route path="/vendas" element={<VitrinePublicaView />} />

        {/* Rotas Protegidas (Exigem login e status OK) */}
        <Route element={<ProtectedRoute />}>
          {/* Redirecionamento Inicial */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Layout Unificado para Dashboard / Gestão / Portal */}
          <Route element={<DashboardLayout />}>
            {/* Rotas Administrativas */}
            <Route path="/financeiro" element={<DashboardFinanceiro />} />
            <Route path="/equipe" element={<DashboardFinanceiro />} />
            <Route path="/inteligencia" element={<DashboardFinanceiro />} />
            <Route path="/vendas-internas" element={<DashboardFinanceiro />} />
            <Route path="/leads" element={<DashboardFinanceiro />} />
            <Route path="/operacional" element={<DashboardFinanceiro />} />
            <Route path="/pendencias" element={<DashboardFinanceiro />} />
            <Route path="/auditoria" element={<DashboardFinanceiro />} />
            <Route path="/clube" element={<DashboardFinanceiro />} />
            <Route path="/consulta-interna" element={<DashboardFinanceiro />} />
            <Route path="/suporte" element={<DashboardFinanceiro />} />
            <Route path="/fabrica" element={<DashboardFinanceiro />} />
            <Route path="/perfil" element={<DashboardFinanceiro />} />
            <Route path="/vitrine" element={<DashboardFinanceiro />} />
            <Route path="/conversao" element={<DashboardFinanceiro />} />
            <Route path="/processos" element={<DashboardFinanceiro />} />

            {/* Rotas Portal do Cliente */}
            <Route path="/clube_pontos" element={<PortalCliente />} />
            <Route path="/vitrine-cliente" element={<PortalCliente />} />
            <Route path="/clube-cliente" element={<PortalCliente />} />
            <Route path="/processos-cliente" element={<PortalCliente />} />
            <Route path="/carteira" element={<PortalCliente />} />
            <Route path="/perfil-cliente" element={<PortalCliente />} />
          </Route>
        </Route>

        {/* Fallback para rotas não encontradas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
