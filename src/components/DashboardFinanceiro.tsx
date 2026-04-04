import React from "react";
import { User } from "firebase/auth";
import { DashboardFinanceiro as DashboardFinanceiroPage } from "../pages/DashboardFinanceiro";

interface DashboardFinanceiroProps {
  user: User;
  role: string | null;
}

const DashboardFinanceiro: React.FC<DashboardFinanceiroProps> = ({ user, role }) => {
  // Pass user and role if needed, or just render the page
  return <DashboardFinanceiroPage />;
};

export default DashboardFinanceiro;
