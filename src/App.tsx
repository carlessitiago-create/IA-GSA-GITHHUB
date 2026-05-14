import React, { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./components/AuthContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { DashboardLayout } from "./components/DashboardLayout";
import { DashboardFinanceiro } from "./pages/DashboardFinanceiro";
import { MAIN_DOMAINS } from "./utils/navigation";

// Lazy Loading Views
const LoginView = lazy(() => import("./components/LoginView").then(m => ({ default: m.default })));
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
const PortalSettingsView = lazy(() => import("./components/GSA/PortalSettingsView").then(m => ({ default: m.PortalSettingsView })));
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
const AdminConsultationManagerView = lazy(() => import("./views/AdminConsultationManagerView").then(m => ({ default: m.AdminConsultationManagerView })));
const AdminConsultationHistoryView = lazy(() => import("./views/AdminConsultationHistoryView").then(m => ({ default: m.AdminConsultationHistoryView })));
const ConsultasCpfCnpjView = lazy(() => import("./views/ConsultasCpfCnpjView").then(m => ({ default: m.ConsultasCpfCnpjView })));
const ClubeMarketingView = lazy(() => import("./views/ClubeMarketingView").then(m => ({ default: m.ClubeMarketingView })));
const ClientProcessesView = lazy(() => import("./components/GSA/ClientProcessesView").then(m => ({ default: m.ClientProcessesView })));
const ClientWalletView = lazy(() => import("./components/GSA/ClientWalletView").then(m => ({ default: m.ClientWalletView })));
const ClientDashboardView = lazy(() => import("./components/GSA/ClientDashboardView").then(m => ({ default: m.ClientDashboardView })));
const TabelaCustasView = lazy(() => import("./views/TabelaCustasView").then(m => ({ default: m.TabelaCustasView })));
const VendaEmMassaView = lazy(() => import("./views/VendaEmMassaView").then(m => ({ default: m.VendaEmMassaView })));
const GerenciadorNotificacoesView = lazy(() => import("./views/GerenciadorNotificacoesView").then(m => ({ default: m.GerenciadorNotificacoes })));
const NovaVendaAdminView = lazy(() => import("./views/NovaVendaAdminView").then(m => ({ default: m.NovaVendaAdminView })));

import { PendingApproval, AccountRefused, AccountSuspended, CompleteProfile } from "./components/Auth";

// 1. Guardião Estrito (SÓ É ACIONADO SE A ROTA FOR PRIVADA)
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

// 2. Componente Raiz para redirecionar quem já fez login
const AppRoot: React.FC = () => {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  
  // Se entrou na raiz e tem usuário, manda pro painel correspondente
  if (user) {
    const isAdm = ["ADM_MASTER", "ADM_GERENTE", "ADM_ANALISTA", "GESTOR", "VENDEDOR"].includes(profile?.nivel || "");
    return <Navigate to={isAdm ? "/financeiro" : "/clube_pontos"} replace />;
  }
  
  // Se não tem login e tentou acessar a raiz do app, exibe a landing page, em vez de forçar o login
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SaaSLandingPage />
    </Suspense>
  );
};

const App: React.FC = () => {
  const location = useLocation();
  const hostname = window.location.hostname.toLowerCase();
  const path = location.pathname.toLowerCase();

  // FORCED LOGGING - Will definitely appear in console
  console.log("CRITICAL: GSA App Hostname detected:", hostname, "Path:", path);

  // SHORT-CIRCUIT DE SEGURANÇA PARA A LANDING PAGE ABRIR SEMPRE INDEPENDENTE DO DOMÍNIO OU LOGIN.
  // Isso força com que app.72hrs.online/diagnostico sempre seja a landing page.
  if (path === '/diagnostico' || path === '/diagnosticos' || path.startsWith('/diagnostico/')) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <SaaSLandingPage />
      </Suspense>
    );
  }

  // 1. Definição de domínio de aplicação (Onde o login e painel residem)
  const isAppDomain = hostname.startsWith('app.') || hostname.includes('localhost') || hostname.includes('ais-dev') || hostname.includes('ais-pre') || hostname.includes('run.app');
  const isPublicSubdomain = !isAppDomain;

  // AUTO-REDIRECT removido para permitir que os painéis funcionem mesmo em subdomínios como diagnostico.72hrs.online
  // caso o cliente não tenha DNS configurado para app.72hrs.online
  /*
  useEffect(() => {
    // Rotas consideradas "seguras" para domínios públicos
    const isPublicPath = path === '/' || path === '' || path === '/consulta' || path.startsWith('/cp/') || path.startsWith('/diagnostico');

    if (isPublicSubdomain && !isPublicPath) {
      let targetDomain = MAIN_DOMAINS[0];
      
      if (hostname.includes('run.app')) {
        targetDomain = hostname;
      } else {
        if (hostname.includes('app.')) {
          targetDomain = hostname;
        } else {
          const baseDomain = MAIN_DOMAINS.find(d => hostname.endsWith(d.replace('app.', ''))) || '72hrs.online';
          const cleanBase = baseDomain.replace('app.', '');
          targetDomain = `app.${cleanBase}`;
        }
      }

      const protocol = window.location.protocol;
      console.log(`[AUTO-REDIRECT] ${hostname}${path} -> ${targetDomain}${path}`);
      window.location.replace(`${protocol}//${targetDomain}${path}`);
    }
  }, [isPublicSubdomain, path, hostname]);
  */

  // Se estiver em domínio público e acessando a raiz ou consulta
  if (isPublicSubdomain && (path === '/' || path === '' || path === '/consulta' || path.startsWith('/diagnostico'))) {
    const isConsulta = hostname.includes('consulta') || path === '/consulta';
    return (
      <Suspense fallback={<LoadingScreen />}>
        {isConsulta ? <PublicPortal /> : <SaaSLandingPage />}
      </Suspense>
    );
  }

  // 2. Domínio PRINCIPAL na raiz (ex: 72hrs.online/): Exibe Landing Page
  const isMainDomainRoot = (
    hostname === '72h.online' || 
    hostname === '72hrs.online' || 
    hostname === 'www.72h.online' || 
    hostname === 'www.72hrs.online'
  ) && (path === '/' || path === '' || path.startsWith('/diagnostico'));

  if (isMainDomainRoot) {
     return (
      <Suspense fallback={<LoadingScreen />}>
        <SaaSLandingPage />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<AppRoot />} />
        
        {/* O Login só é acionado se digitado explicitamente (/login) ou caso não tenha sessão nas rotas abaixo */}
        <Route path="/login" element={<LoginView />} />
        <Route path="/consulta" element={<PublicPortal />} />
        <Route path="/vendas/p/:slug" element={<ProposalLandingPage />} />
        <Route path="/vendasp/:slug" element={<ProposalLandingPage />} />
        <Route path="/p/:slug" element={<ProposalLandingPage />} />
        <Route path="/cp/*" element={<PublicPortal />} />
        <Route path="/vitrine-publica/*" element={<VitrinePublicaView />} />
        <Route path="/vendas/*" element={<VitrinePublicaView />} />
        <Route path="/diagnostico" element={<SaaSLandingPage />} />
        <Route path="/diagnosticos" element={<SaaSLandingPage />} />
        <Route path="/diagnostico/*" element={<SaaSLandingPage />} />

        {/* == ROTAS PROTEGIDAS (Exigem Autenticação) == */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/financeiro" element={<DashboardFinanceiro />} />
            <Route path="/equipe" element={<GestaoEquipeView />} />
            <Route path="/inteligencia" element={<IntelligenceDashboardView />} />
            <Route path="/vendas-internas" element={<VendasPDVView />} />
            <Route path="/venda-massa" element={<VendaEmMassaView />} />
            <Route path="/nova-venda-admin" element={<NovaVendaAdminView />} />
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
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/saas-settings" element={<DashboardView view="saas_settings" />} />
            <Route path="/admin_clube_settings" element={<DashboardView view="admin_clube_settings" />} />
            <Route path="/config_consulta" element={<PortalSettingsView />} />
            <Route path="/configuracoes-notificacoes" element={<AdminNotificationSettingsView />} />
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
            <Route path="/dashboard-cliente" element={<ClientDashboardView />} />
            <Route path="/perfil-cliente" element={<ProfileView />} />
          </Route>
        </Route>

        {/* Links não encontrados jogam gentilmente para o começo do App */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
