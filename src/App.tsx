import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import * as Sentry from "@sentry/react";

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);
import { useAuth } from "./components/AuthContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { DashboardLayout } from "./components/DashboardLayout"; 
import { DashboardFinanceiro } from "./pages/DashboardFinanceiro";
import { SplitCommissionSettingsView } from "./views/SplitCommissionSettingsView";
import { GlobalErrorProvider } from "./components/GlobalErrorProvider";

// Robust Promise Retry Helper with Sentry Error Tracking
const retryPromise = <T,>(fn: () => Promise<T>, retries = 3, interval = 1000): Promise<T> => {
  return fn().catch((error) => {
    // Adiciona breadcrumb do Sentry para registrar tentativa de carregamento falha
    Sentry.addBreadcrumb({
      category: "chunk_loading",
      message: `Falha temporária ao carregar módulo. Tentando novamente (${retries} tentativas restantes)`,
      level: "warning",
      data: {
        error: error?.message || String(error),
      }
    });

    if (retries > 0) {
      console.warn(`Retrying import, retries left: ${retries}`);
      return new Promise<T>((resolve) => setTimeout(resolve, interval))
        .then(() => retryPromise(fn, retries - 1, interval * 2));
    }
    
    // Registra o erro definitivo de carregamento de chunk no Sentry
    Sentry.captureException(error, {
      tags: {
        category: "chunk_loading_failure",
        fatal: "true"
      },
      extra: {
        message: "Dynamic import failed after all retries",
        importFn: fn.toString()
      }
    });
    
    throw error;
  });
};

// Lazy Loading Helper with Retry
const lazyRetry = (importFn: () => Promise<any>, retries: number = 3, interval: number = 1000): React.LazyExoticComponent<any> => {
  return lazy(() => retryPromise(importFn, retries, interval));
};

// CORREÇÃO CRÍTICA DE CAMINHO: LoginView está em src/components/ e não em src/views/
const LoginView = lazyRetry(() => import("./components/LoginView").then(m => ({ default: m.LoginView })));
const PortalCliente = lazyRetry(() => import("./components/PortalCliente").then(m => ({ default: m.PortalCliente })));
const PublicPortal = lazyRetry(() => import("./views/PublicPortal").then(m => ({ default: m.PublicPortal })));
const VitrinePublicaView = lazyRetry(() => import("./views/VitrinePublicaView").then(m => ({ default: m.VitrinePublicaView })));
const ProposalLandingPage = lazyRetry(() => import("./views/ProposalLandingPage").then(m => ({ default: m.ProposalLandingPage })));
const SaaSLandingPage = lazyRetry(() => import("./views/SaaSLandingPage"));

// Admin Views
const FinanceiroView = lazyRetry(() => import("./views/FinanceiroView").then(m => ({ default: m.FinanceiroView })));
const GestaoEquipeView = lazyRetry(() => import("./views/GestaoEquipeView").then(m => ({ default: m.GestaoEquipeView })));
const GestaoClientesView = lazyRetry(() => import("./views/GestaoClientesView").then(m => ({ default: m.GestaoClientesView })));
const IntelligenceDashboardView = lazyRetry(() => import("./views/IntelligenceDashboardView").then(m => ({ default: m.IntelligenceDashboardView })));
const VendasPDVView = lazyRetry(() => import("./views/VendasPDVView").then(m => ({ default: m.VendasPDVView })));
const LeadsCentralView = lazyRetry(() => import("./components/GSA/LeadsCentralView").then(m => ({ default: m.LeadsCentralView })));
const LeadsCNPJView = lazyRetry(() => import("./components/GSA/LeadsCNPJView").then(m => ({ default: m.LeadsCNPJView })));
const OperationalView = lazyRetry(() => import("./components/GSA/OperationalView").then(m => ({ default: m.OperationalView })));
const PendencyList = lazyRetry(() => import("./components/GSA/PendencyList").then(m => ({ default: m.PendencyList })));
const AuditoriaProcesso = lazyRetry(() => import("./components/GSA/AuditoriaProcesso").then(m => ({ default: m.AuditoriaProcesso })));
const PortalSettingsView = lazyRetry(() => import("./components/GSA/PortalSettingsView").then(m => ({ default: m.PortalSettingsView })));
const MyClubView = lazyRetry(() => import("./components/GSA/MyClubView").then(m => ({ default: m.MyClubView })));
const SupportModule = lazyRetry(() => import("./components/Support/SupportModule"));
const ServiceFactoryView = lazyRetry(() => import("./components/GSA/ServiceFactoryView").then(m => ({ default: m.ServiceFactoryView })));
const ProfileView = lazyRetry(() => import("./views/ProfileView").then(m => ({ default: m.ProfileView })));
const ProcessModelsManager = lazyRetry(() => import("./components/GSA/ProcessModelsManager").then(m => ({ default: m.ProcessModelsManager })));
const DashboardView: React.ComponentType<any> = lazyRetry(() => import("./views/DashboardView").then(m => ({ default: m.DashboardView })));
const FunnelDashboard = lazyRetry(() => import("./components/GSA/FunnelDashboard").then(m => ({ default: m.FunnelDashboard })));
const LeadsDiagnosticoView = lazyRetry(() => import("./views/LeadsDiagnosticoView").then(m => ({ default: m.LeadsDiagnosticoView })));
const AdminDiagnostico = lazyRetry(() => import("./views/AdminDiagnosticoView").then(m => ({ default: m.AdminDiagnostico })));
const ConversionDashboardView = lazyRetry(() => import("./views/ConversionDashboardView").then(m => ({ default: m.ConversionDashboardView })));
const VitrineView = lazyRetry(() => import("./components/GSA/VitrineView").then(m => ({ default: m.VitrineView })));
const AdminNotificationSettingsView = lazyRetry(() => import("./views/AdminNotificationSettingsView"));
const ConsultaPublicaView = lazyRetry(() => import("./views/ConsultaPublicaView").then(m => ({ default: m.ConsultaPublicaView })));
const ClubePontosView = lazyRetry(() => import("./views/ClubePontosView").then(m => ({ default: m.ClubePontosView })));
const AdminConsultationManagerView = lazyRetry(() => import("./views/AdminConsultationManagerView").then(m => ({ default: m.AdminConsultationManagerView })));
const AdminConsultationHistoryView = lazyRetry(() => import("./views/AdminConsultationHistoryView").then(m => ({ default: m.AdminConsultationHistoryView })));
const ConsultasCpfCnpjView = lazyRetry(() => import("./views/ConsultasCpfCnpjView").then(m => ({ default: m.ConsultasCpfCnpjView })));
const ClubeMarketingView = lazyRetry(() => import("./views/ClubeMarketingView").then(m => ({ default: m.ClubeMarketingView })));
const ClientProcessesView = lazyRetry(() => import("./components/GSA/ClientProcessesView").then(m => ({ default: m.ClientProcessesView })));
const ClientWalletView = lazyRetry(() => import("./components/GSA/ClientWalletView").then(m => ({ default: m.ClientWalletView })));
const ClientDashboardView = lazyRetry(() => import("./components/GSA/ClientDashboardView").then(m => ({ default: m.ClientDashboardView })));
const CreditoDashboardView = lazyRetry(() => import("./views/CreditoDashboardView").then(m => ({ default: m.CreditoDashboardView })));
const TabelaCustasView = lazyRetry(() => import("./views/TabelaCustasView").then(m => ({ default: m.TabelaCustasView })));
const VendaEmMassaView = lazyRetry(() => import("./views/VendaEmMassaView").then(m => ({ default: m.VendaEmMassaView })));
const GestaoLotesView = lazyRetry(() => import("./views/GestaoLotesView").then(m => ({ default: m.GestaoLotesView })));
const GerenciadorNotificacoesView = lazyRetry(() => import("./views/GerenciadorNotificacoesView").then(m => ({ default: m.GerenciadorNotificacoesView })));
const NovaVendaAdminView = lazyRetry(() => import("./views/NovaVendaAdminView").then(m => ({ default: m.NovaVendaAdminView })));
const LeadsView = lazyRetry(() => import("./components/GSA/LeadsView").then(m => ({ default: m.LeadsView })));
const CheckoutCreditoView = lazyRetry(() => import("./views/CheckoutCreditoView").then(m => ({ default: m.CheckoutCreditoView })));
const QuizCreditoPublicoView = lazyRetry(() => import("./views/QuizCreditoPublicoView").then(m => ({ default: m.QuizCreditoPublicoView })));
const AcessoTotalCreditoView = lazyRetry(() => import("./views/AcessoTotalCreditoView"));

import { PendingApproval, AccountRefused, AccountSuspended, CompleteProfile } from "./components/Auth";

const NIVEIS_ADMIN = ["ADM_MASTER", "ADM_MESTRE", "ADM_GERENTE", "ADM_ANALISTA", "GESTOR", "VENDEDOR"];

const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, logout } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  // Se não tem perfil ainda, espera (não redireciona)
  if (!profile) return <LoadingScreen />;

  const isAdmin = NIVEIS_ADMIN.includes(profile?.nivel || "");

  // Admins NUNCA vão para CompleteProfile, PendingApproval, etc.
  if (isAdmin) {
    return children ? <>{children}</> : <Outlet />;
  }

  // Clientes: verifica CPF e status
  if (!profile.cpf || profile.cpf === "") return <CompleteProfile profile={profile} />;
  if (profile.status_conta === "PENDENTE") return <PendingApproval profile={profile} onLogout={logout} />;
  if (profile.status_conta === "RECUSADO") return <AccountRefused onLogout={logout} />;
  if (profile.status_conta === "SUSPENSO" || profile.status_conta === "BLOQUEADO") {
    return <AccountSuspended status={profile.status_conta} onLogout={logout} />;
  }

  return children ? <>{children}</> : <Outlet />;
};

const AppRoot: React.FC = () => {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;

  if (user && !profile) {
    return <LoadingScreen />;
  }

  if (user && profile) {
    const isAdm = ["ADM_MASTER", "ADM_GERENTE", "ADM_ANALISTA", "GESTOR", "VENDEDOR"].includes(profile?.nivel || "");
    return <Navigate to={isAdm ? "/financeiro" : "/clube_pontos"} replace />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <SaaSLandingPage />
    </Suspense>
  );
};

const App: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  // Interceptador direto para a view isolada de login com tratamento de caminhos resolvidos
  if (path === '/login') {
    return (
      <GlobalErrorProvider>
        <Suspense fallback={<LoadingScreen />}>
          <SentryRoutes>
            <Route path="/login" element={<LoginView />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </SentryRoutes>
        </Suspense>
      </GlobalErrorProvider>
    );
  }

  if (path === '/diagnostico' || path === '/diagnosticos' || path.startsWith('/diagnostico/')) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <SaaSLandingPage />
      </Suspense>
    );
  }

  return (
    <GlobalErrorProvider>
      <Suspense fallback={<LoadingScreen />}>
        <SentryRoutes>
          <Route path="/" element={<AppRoot />} />
          <Route path="/login" element={<LoginView />} />
          <Route path="/consulta" element={<PublicPortal />} />
          <Route path="/credito" element={<QuizCreditoPublicoView />} />
          <Route path="/checkout-credito" element={<CheckoutCreditoView />} />
          <Route path="/vendas/p/:slug" element={<ProposalLandingPage />} />
          <Route path="/vendasp/:slug" element={<ProposalLandingPage />} />
          <Route path="/p/:slug" element={<ProposalLandingPage />} />
          <Route path="/cp/*" element={<PublicPortal />} />
          <Route path="/vitrine-publica/*" element={<VitrinePublicaView />} />
          <Route path="/vendas/*" element={<VitrinePublicaView />} />

          {/* == ROTAS PROTEGIDAS == */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/financeiro" element={<DashboardFinanceiro />} />
              <Route path="/equipe" element={<GestaoEquipeView />} />
              <Route path="/clientes" element={<GestaoClientesView />} />
              <Route path="/inteligencia" element={<IntelligenceDashboardView />} />
              <Route path="/vendas-internas" element={<VendasPDVView />} />
              <Route path="/venda-massa" element={<VendaEmMassaView />} />
              <Route path="/gestao-lotes" element={<GestaoLotesView />} />
              <Route path="/nova-venda-admin" element={<NovaVendaAdminView />} />
              <Route path="/leads" element={<LeadsCentralView />} />
              <Route path="/leads-cnpj" element={<LeadsCNPJView />} />
              <Route path="/gerenciamento-leads" element={<LeadsView />} />
              <Route path="/diagnostico-leads" element={<LeadsView />} />
              <Route path="/acesso-credito" element={<AcessoTotalCreditoView />} />
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
              <Route path="/funil-vendas" element={<FunnelDashboard />} />
              <Route path="/leads-diagnostico" element={<LeadsDiagnosticoView />} />
              <Route path="/admin-diagnostico" element={<AdminDiagnostico />} />
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/saas-settings" element={<DashboardView view="saas_settings" />} />
              <Route path="/admin_clube_settings" element={<DashboardView view="admin_clube_settings" />} />
              <Route path="/config_consulta" element={<PortalSettingsView />} />
              <Route path="/configuracoes-notificacoes" element={<AdminNotificationSettingsView />} />
              <Route path="/parametrizacao-split" element={<SplitCommissionSettingsView />} />
              <Route path="/gerenciador-notificacoes" element={<GerenciadorNotificacoesView />} />
              <Route path="/admin-consultas" element={<AdminConsultationManagerView />} />
              <Route path="/historico-consultas" element={<AdminConsultationHistoryView />} />
              <Route path="/consultas-cpf-cnpj" element={<ConsultasCpfCnpjView />} />

              {/* Rotas Portal do Cliente */}
              <Route path="/clube_pontos" element={<ClubePontosView />} />
              <Route path="/vitrine-cliente" element={<VitrineView />} />
              <Route path="/clube-cliente" element={<ClubeMarketingView />} />
              <Route path="/processos-cliente" element={<ClientProcessesView />} />
              <Route path="/carteira" element={<ClientWalletView />} />
              <Route path="/gestao-credito" element={<CreditoDashboardView />} />
              <Route path="/dashboard-cliente" element={<ClientDashboardView />} />
              <Route path="/perfil-cliente" element={<ProfileView />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </SentryRoutes>
      </Suspense>
    </GlobalErrorProvider>
  );
};

export default App;
