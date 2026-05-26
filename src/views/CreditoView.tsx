import React from 'react';
import { useAuth } from '../components/AuthContext';
import { CreditCard, Lock, SplitSquareVertical } from 'lucide-react';
import { CreditLineSelection } from '../components/Credito/CreditLineSelection';

export const CreditoView: React.FC = () => {
  const { profile } = useAuth();
  const role = profile?.nivel;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="text-blue-500" /> Crédito
          </h1>
          <p className="text-slate-500 mt-1">Gerenciamento de leads e pedidos de crédito</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Visão de {role}</h2>
        {/*
          admin_master: Visualiza o pipeline geral de todos os leads de crédito criados por todas as ramificações e a tela de parametrização de comissões (Split).
          gestor: Visualiza apenas os leads e métricas de crédito da sua respectiva equipe.
          vendedor: Visualiza exclusivamente seus próprios leads gerados através do seu link de indicação personalizado.
          analista: Acessa a fila de triagem de documentos e o botão de acionamento do motor da IA.
          cliente: Visualiza o status de evolução do seu pedido de crédito.
        */}
        
        {role === 'ADM_MASTER' && (
          <div className="space-y-4">
            <p className="text-slate-600">Visualiza o pipeline geral de todos os leads de crédito criados por todas as ramificações e a tela de parametrização de comissões (Split).</p>
            {/* Componente de Pipeline Geral e Split */}
          </div>
        )}

        {role === 'GESTOR' && (
          <div className="space-y-4">
            <p className="text-slate-600">Visualiza apenas os leads e métricas de crédito da sua respectiva equipe.</p>
            {/* Componente de Pipeline de Equipe */}
          </div>
        )}

        {role === 'VENDEDOR' && (
          <div className="space-y-8">
            <div className="bg-blue-50/50 p-4 border border-blue-100 rounded-xl">
              <p className="text-blue-800 font-medium">Visualiza exclusivamente seus próprios leads gerados através do seu link de indicação personalizado.</p>
            </div>
            
            <CreditLineSelection />
            
            {/* Componente de Meus Leads + Link de Indicação */}
          </div>
        )}

        {role === 'ADM_ANALISTA' && (
          <div className="space-y-4">
            <p className="text-slate-600">Acessa a fila de triagem de documentos e o botão de acionamento do motor da IA.</p>
            {/* Componente de Fila de Triagem e Motor IA */}
          </div>
        )}

        {role === 'CLIENTE' && (
          <div className="space-y-8">
            <div className="bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl">
              <p className="text-emerald-800 font-medium">Visualiza o status de evolução do seu pedido de crédito ou inicia uma nova simulação.</p>
            </div>
            
            <CreditLineSelection />
            
            {/* Componente de Status do Pedido de Crédito */}
          </div>
        )}

        {/* Fallback para outros admins caso haja outros como ADM_GERENTE */}
        {(role !== 'ADM_MASTER' && role !== 'GESTOR' && role !== 'VENDEDOR' && role !== 'ADM_ANALISTA' && role !== 'CLIENTE') && (
          <div className="space-y-8">
            <p className="text-slate-600">Acesso ao painel administrativo de crédito e geração de oportunidades manuais.</p>
            <CreditLineSelection />
          </div>
        )}
      </div>
    </div>
  );
};
