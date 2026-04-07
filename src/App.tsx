import React from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./components/AuthContext";
import LoginView from "./components/LoginView";
import { DashboardFinanceiro } from "./pages/DashboardFinanceiro"; // Tela ADM
import PortalCliente from "./components/PortalCliente"; // Tela Cliente
import { PublicPortal } from "./views/PublicPortal";
import { VitrinePublicaView } from "./views/VitrinePublicaView";
import { ProposalLandingPage } from "./views/ProposalLandingPage";
import { PendingApproval, AccountRefused, AccountSuspended, CompleteProfile } from "./components/Auth";
import { LoadingScreen } from "./components/LoadingScreen";

const AppContent: React.FC = () => {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // LÓGICA DE ROTEAMENTO POR NIVEL
  if (!user) return <LoginView />;

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

  const nivel = profile?.nivel;

  // Se for ADM (Master, Gerente ou Analista), GESTOR ou VENDEDOR, mostra o Financeiro/Gestão
  if (nivel === "ADM_MASTER" || nivel === "ADM_GERENTE" || nivel === "ADM_ANALISTA" || nivel === "GESTOR" || nivel === "VENDEDOR") {
    return <DashboardFinanceiro />;
  }

  // Se for qualquer outra coisa (ou Cliente), mostra o Portal do Cliente
  return <PortalCliente />;
};

const App: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/vendas/p/:slug" element={<ProposalLandingPage />} />
      <Route path="/p/:slug" element={<ProposalLandingPage />} />
      <Route path="/vendas" element={!user ? <VitrinePublicaView /> : <AppContent />} />
      <Route path="/consulta" element={<PublicPortal />} />
      {/* Se não estiver logado, /vitrine mostra a pública. Se estiver logado, segue para AppContent que mostrará a interna */}
      <Route path="/vitrine" element={!user ? <VitrinePublicaView /> : <AppContent />} />
      <Route path="/*" element={<AppContent />} />
    </Routes>
  );
};

export default App;
