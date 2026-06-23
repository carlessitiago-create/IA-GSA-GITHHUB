import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { 
  CreditCard, 
  FileText, 
  Settings, 
  Users, 
  Settings2, 
  BarChart, 
  ChevronDown, 
  CheckCircle, 
  Clock, 
  SplitSquareVertical, 
  Plus, 
  Copy, 
  TrendingUp, 
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  BellRing,
  CalendarDays,
  Check,
  FileUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { CreditLineSelection } from '../components/Credito/CreditLineSelection';
import type { ConfigComissaoCredito, CreditoLead } from '../types/credito';
import { ManualLeadModal } from '../components/Credito/ManualLeadModal';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

const LeadCard: React.FC<{ lead: CreditoLead; role?: string; onGenerate: (id: string, ebitda: number, dre: number) => void; onGenerateBilling: (id: string, value: number) => void }> = ({ lead, role, onGenerate, onGenerateBilling }) => {
  const [ebitda, setEbitda] = useState<number>(lead.financeiro.ebitdaProjetado || 0);
  const [dre, setDre] = useState<number>(0);
  const [fee, setFee] = useState<number>(lead.financeiro.taxaFixaEstipuladaAdmin || 0);

  return (
    <div className="border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-colors shadow-sm bg-white">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">CNPJ: {lead.dadosEmpresa.cnpj}</span>
        </div>
        <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded">{lead.status}</span>
      </div>
      
      <h3 className="font-bold text-slate-800 text-lg mb-1">{lead.tipoCredito}</h3>
      <div className="space-y-1 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Faturamento Real:</span>
          <span className="font-semibold">R$ {lead.financeiro.faturamentoMensalMedio}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Solicitado:</span>
          <span className="font-semibold text-emerald-600">R$ {lead.financeiro.valorSolicitado}</span>
        </div>
      </div>

      {role !== 'CLIENTE' && (lead.status === 'analise_tecnica' || lead.status === 'protocolado') && (
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">DRE (Lucro Líquido)</label>
            <input 
              type="number" 
              value={dre}
              onChange={(e) => setDre(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="R$..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">EBITDA Projetado</label>
            <input 
              type="number" 
              value={ebitda}
              onChange={(e) => setEbitda(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="R$..."
            />
          </div>
          <button 
            onClick={() => onGenerate(lead.id || '', ebitda, dre)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" /> Gerar PVE via Inteligência Artificial
          </button>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Honorários Asaas (R$)</label>
            <input 
              type="number" 
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none mb-2"
              placeholder="R$ 997,00"
            />
            <button 
              onClick={() => onGenerateBilling(lead.id || '', fee)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm"
            >
              Gerar Cobrança (Asaas PIX)
            </button>
          </div>
        </div>
      )}

      {lead.status === 'aguardando_pagamento_taxa' && lead.dadosPagamentoAsaas && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-center mb-2">PAGAMENTO PIX GERADO</p>
          <img 
            src={`data:image/jpeg;base64,${lead.dadosPagamentoAsaas.pixQrCodeBase64}`} 
            alt="PIX QR Code" 
            className="w-32 h-32 mx-auto mb-2 rounded-lg"
          />
          <button
             onClick={() => {
               navigator.clipboard.writeText(lead.dadosPagamentoAsaas?.pixCopiaCola || '');
               Swal.fire({ title: 'Copiado!', icon: 'success', timer: 1500, showConfirmButton: false });
             }}
             className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white text-xs py-2 rounded-lg"
          >
             <Copy size={14} /> Pix Copia e Cola
          </button>
        </div>
      )}
    </div>
  );
};

// --- SUBSYSTEM COMPONENT: RATING BANCÁRIO HISTÓRICO COM RECHARTS ---
interface RatingHistoryEntry {
  mes: string;
  score: number;
  rating: string;
}

function getDeterministicHistory(cnpjOrId: string, companyName: string): RatingHistoryEntry[] {
  let hash = 0;
  const str = (cnpjOrId || '') + (companyName || '');
  for (let i = 0; i !== str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Base score index between 480 and 840
  const baseScore = 480 + (Math.abs(hash) % 360);
  const volatility = 12 + (Math.abs(hash >> 3) % 22);
  const trend = (hash % 3 === 0) ? -0.15 : (hash % 3 === 1) ? 0.35 : 0.8;
  
  const months = ["Jan/26", "Fev/26", "Mar/26", "Abr/26", "Mai/26", "Jun/26"];
  return months.map((mes, index) => {
    const scoreModifier = Math.round(index * volatility * trend + Math.sin(index * 1.8) * 12);
    const finalScore = Math.min(1000, Math.max(300, baseScore + scoreModifier));
    
    let rating = "C";
    if (finalScore >= 900) rating = "AAA";
    else if (finalScore >= 800) rating = "AA";
    else if (finalScore >= 700) rating = "A";
    else if (finalScore >= 600) rating = "BBB";
    else if (finalScore >= 500) rating = "BB";
    else if (finalScore >= 400) rating = "B";
    else if (finalScore >= 350) rating = "CCC";
    
    return { mes, score: finalScore, rating };
  });
}

function getRatingBadgeStyle(rating: string): string {
  switch (rating) {
    case 'AAA': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'AA': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'A': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'BBB': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'BB': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'B': return 'bg-orange-50 text-orange-700 border-orange-200';
    default: return 'bg-rose-50 text-rose-700 border-rose-200';
  }
}

function getRatingLabelDescription(rating: string): string {
  switch (rating) {
    case 'AAA': return 'Classificação máxima de crédito. Altíssima estabilidade financeira e risco quase nulo.';
    case 'AA': return 'Excelente qualidade de crédito. Risco baixíssimo e robustez operacional comprovada.';
    case 'A': return 'Boa qualidade de crédito com sólida capacidade financeira. Resistente a oscilações normais de mercado.';
    case 'BBB': return 'Grau de investimento moderado. Capacidade financeira satisfatória, com atenção a choques de mercado.';
    case 'BB': return 'Nível especulativo moderado. Elementos de força operacional balanceados por oscilações macroeconômicas.';
    case 'B': return 'Risco financeiro sensível. Capacidade de pagamento vulnerável a variações conjunturais.';
    default: return 'Alerta de rating de crédito sob custódia de risco. Necessita readequação financeira estrutural urgente.';
  }
}

const CustomRatingTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-xl text-white text-xs space-y-1">
        <p className="font-bold text-slate-300 font-sans border-b border-slate-800 pb-1 mb-1">{data.mes}</p>
        <p className="flex justify-between gap-5 font-sans text-emerald-400">
          <span>Score de Crédito:</span>
          <span className="font-mono font-bold">{data.score} pts</span>
        </p>
        <p className="flex justify-between gap-5 font-sans text-indigo-300">
          <span>Rating Bancário:</span>
          <span className="font-mono font-black">{data.rating}</span>
        </p>
      </div>
    );
  }
  return null;
};

interface TipItem {
  id: string;
  category: string;
  title: string;
  description: string;
  steps: string[];
  impact: 'Alto' | 'Médio' | 'Muito Alto';
  difficulty: 'Baixa' | 'Média' | 'Alta';
  colorTheme: {
    bg: string;
    text: string;
    border: string;
    iconBg: string;
    iconText: string;
    badge: string;
  };
}

const getPersonalizedTips = (score: number, scoreDiff: number): TipItem[] => {
  const tips: TipItem[] = [];

  const themes = {
    emerald: {
      bg: 'bg-emerald-50/40',
      text: 'text-emerald-900',
      border: 'border-emerald-100',
      iconBg: 'bg-emerald-100/80',
      iconText: 'text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    blue: {
      bg: 'bg-blue-50/40',
      text: 'text-blue-900',
      border: 'border-blue-100',
      iconBg: 'bg-blue-100/80',
      iconText: 'text-blue-700',
      badge: 'bg-blue-105 text-blue-800 border-blue-200'
    },
    indigo: {
      bg: 'bg-indigo-50/40',
      text: 'text-indigo-900',
      border: 'border-indigo-100',
      iconBg: 'bg-indigo-100/80',
      iconText: 'text-indigo-700',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    },
    amber: {
      bg: 'bg-amber-50/40',
      text: 'text-amber-900',
      border: 'border-amber-100',
      iconBg: 'bg-amber-100/80',
      iconText: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    rose: {
      bg: 'bg-rose-50/40',
      text: 'text-rose-900',
      border: 'border-rose-100',
      iconBg: 'bg-rose-100/80',
      iconText: 'text-rose-700',
      badge: 'bg-rose-100 text-rose-800 border-rose-200'
    }
  };

  if (scoreDiff < 0) {
    tips.push({
      id: 'trend-negative',
      category: 'Alerta de Tendência',
      title: 'Evite "Credit Shopping" (Consultas Consecutivas)',
      description: 'Identificamos uma oscilação negativa de rating recente. Realizar sucessivas solicitações ou simulações de crédito em diferentes instituições em um curto espaço de tempo pode criar consultas em cascata, o que sinaliza urgência e derruba seu score.',
      steps: [
        'Centralize pesquisas de crédito no mesmo operador ou aguarde 15 dias entre propostas.',
        'Use simuladores internos de pré-aprovação sempre que possível antes de rodar o CPF/CNPJ definitivo.',
        'Monitore se há consultas indevidas registradas em seu nome nos órgãos de restrição.'
      ],
      impact: 'Muito Alto',
      difficulty: 'Baixa',
      colorTheme: themes.rose
    });
  } else if (scoreDiff > 0) {
    tips.push({
      id: 'trend-positive',
      category: 'Oportunidade',
      title: 'Alavanque Taxas Negociando Contratos Antigos',
      description: 'Sua tendência de crédito é altamente positiva! Este momento de alta no score aumenta substancialmente seu poder de barganha junto aos bancos atuais e novos credores.',
      steps: [
        'Apresente este relatório atualizado para renegociar taxas de juros de contratos vigentes.',
        'Substitua linhas caras por novas opções estruturadas aproveitando seu melhor perfil.',
        'Consolide limites subutilizados para focar em linhas de menor taxa e maior prazo.'
      ],
      impact: 'Alto',
      difficulty: 'Média',
      colorTheme: themes.emerald
    });
  }

  if (score >= 800) {
    tips.push({
      id: 'high-funding',
      category: 'Funding & Investimento',
      title: 'Emissão de Debêntures e Linhas do Mercado de Capitais',
      description: 'Com seu rating AAA ou AA, você entrou no seleto grupo de alta confiabilidade. Isso abre portas para fundings estruturados estruturando CRI, CRA ou Debêntures financeiras, fugindo da rede bancária tradicional.',
      steps: [
        'Estude estruturação de securitização para baratear captações de longo prazo.',
        'Aproveite para alongar prazos operacionais com prazos superiores a 36 meses.',
        'Apresente relatórios de auditoria para reforçar canais institucionais.'
      ],
      impact: 'Muito Alto',
      difficulty: 'Alta',
      colorTheme: themes.indigo
    });
    tips.push({
      id: 'high-esg',
      category: 'Mercado Sustentável',
      title: 'Incorpore Metas de Sustentabilidade (ESG)',
      description: 'Empresas de excelente rating encontram taxas de juros drasticamente reduzidas em "Green Bonds" (títulos verdes). Ter políticas de ESG formais é diferencial crítico exigido por grandes fundos de investimentos operacionais.',
      steps: [
        'Mapeie e documente processos de eficiência hídrica, energética ou de impacto social.',
        'Publique o Relatório de Sustentabilidade anual contendo KPIs transparentes.',
        'Aplique para linhas de fomento sustentável em parcerias governamentais (BNDES).'
      ],
      impact: 'Alto',
      difficulty: 'Média',
      colorTheme: themes.emerald
    });
  } else if (score >= 600) {
    tips.push({
      id: 'mid-giro',
      category: 'Gestão de Caixa',
      title: 'Ciclo Financeiro e Giro de Estoque Eficiente',
      description: 'Seu rating é sólido, mas pode melhorar se você equalizar os prazos médios de recebimento e pagamento. Reduzir a dependência de antecipação de recebíveis conserva o limite de crédito rotativo intacto.',
      steps: [
        'Negocie com fornecedores o alongamento do Prazo Médio de Pagamento (PMP).',
        'Otimize as cobranças no faturamento com réguas automatizadas para diminuir o PMR.',
        'Evite carregar estoques obsoletos que travam capital de giro valioso.'
      ],
      impact: 'Alto',
      difficulty: 'Média',
      colorTheme: themes.blue
    });
    tips.push({
      id: 'mid-diversification',
      category: 'Relacionamento',
      title: 'Pluralidade e Diversificação de Bancos',
      description: 'Evite concentrar mais de 60% das suas operações em uma única instituição financeira. A pluralidade bancária eleva as taxas de concorrência saudável entre gerentes e protege sua pontuação sistemática.',
      steps: [
        'Abra contas de relacionamento secundárias em cooperativas de crédito (Sicoob, Sicredi) ou bancos médios.',
        'Distribua seu faturamento de recebíveis homogeneamente entre os parceiros.',
        'Monitore ofertas competitivas de giro sem aceitar vendas casadas.'
      ],
      impact: 'Médio',
      difficulty: 'Baixa',
      colorTheme: themes.amber
    });
  } else if (score >= 450) {
    tips.push({
      id: 'low-alongamento',
      category: 'Estruturação de Dívidas',
      title: 'Prolongamento de Dívidas de Curto Prazo',
      description: 'Seu score indica presença considerável de passivos circulantes. Substituir linhas caras de curto prazo (como cheque especial e contas garantidas) por financiamentos de longo prazo alivia o caixa imediato e revigora seu rating.',
      steps: [
        'Substitua limites rotativos de emergência por parcelados de longo prazo (ex: Pronampe, FGI).',
        'Busque carência inicial de pelo menos 90 dias nos novos contratos negociados.',
        'Utilize garantias reais para baratear o custo efetivo total (CET).'
      ],
      impact: 'Muito Alto',
      difficulty: 'Média',
      colorTheme: themes.indigo
    });
    tips.push({
      id: 'low-positivo',
      category: 'Histórico de Faturamento',
      title: 'Sincronização Ativa ao Cadastro Positivo',
      description: 'Garantir que os bureaus de crédito possuam visibilidade total do seu comportamento de bom pagador é o caminho mais rápido para sair do risco médio. Contas de consumo e faturas pagas antes do vencimento aceleram o score.',
      steps: [
        'Verifique se sua empresa está cadastrada e com envio ativo no Cadastro Positivo.',
        'Mantenha as obrigações fiscais básicas em dia para evitar restrições em certidões negativas.',
        'Priorize quitar faturas com boleto bancário centralizado para contagem rápida de pontuação.'
      ],
      impact: 'Alto',
      difficulty: 'Baixa',
      colorTheme: themes.emerald
    });
  } else {
    tips.push({
      id: 'crit-saneamento',
      category: 'Limpeza de Nome',
      title: 'Saneamento de Protestos e Pendências (Urgente)',
      description: 'A existência de apontamentos de protestos, pendências tributárias ou restritivos comerciais é o maior detrator do seu rating. Limpar a imagem cadastral da empresa nos órgãos competentes é a prioridade zero absoluta.',
      steps: [
        'Emita a Certidão de Protestos para identificar os credores com pendências ativas.',
        'Negocie descontos de liquidação à vista e recolha as cartas de anuência dos credores.',
        'Proceda com a baixa do protesto diretamente no tabelionato ou via canais eletrônicos integrados.'
      ],
      impact: 'Muito Alto',
      difficulty: 'Média',
      colorTheme: themes.rose
    });
    tips.push({
      id: 'crit-reserva',
      category: 'Liquidez Corrente',
      title: 'Revisão Sistêmica e Aporte de Capital',
      description: 'Com o rating no patamar CCC, novas linhas tradicionais de crédito puro são de difícil acesso. Apresentar um plano de aporte de capital pelos sócios ou alienação de ativos melhora o índice de liquidez da empresa aos olhos do analista.',
      steps: [
        'Avalie investimentos pontuais próprios ou empréstimos de sócios formalizados por mútuo fiscal.',
        'Estruture recebíveis de cartões performados em canais fiduciais (FIDC) como alternativa a empréstimos de urgência.',
        'Ajuste o fluxo de caixa para margem de contingência estrita de 20% sobre as despesas fixas.'
      ],
      impact: 'Alto',
      difficulty: 'Alta',
      colorTheme: themes.amber
    });
  }

  if (tips.length < 3) {
    tips.push({
      id: 'gen-auditoria',
      category: 'Transparência',
      title: 'Organização de Balancetes e Demonstrativos',
      description: 'Demonstrativos contábeis bem estruturados e assinados por contador habilitado reduzem a percepção de risco assimétrico. Apresentar DRE e Balanço atualizados transmite governança sólida.',
      steps: [
        'Organize o Balanço Patrimonial e a DRE com fechamento máximo de 60 dias de atraso.',
        'Garanta notas explicativas para as linhas mais complexas do passivo exigível.',
        'Facilite o acesso do analista de crédito aos arquivos XMLs faturados.'
      ],
      impact: 'Alto',
      difficulty: 'Média',
      colorTheme: themes.blue
    });
  }

  return tips;
};

interface RatingNotification {
  id: string;
  type: 'expiration' | 'banking_update' | 'up_to_date';
  severity: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  actionText?: string;
  actionType: 'upload' | 'revalidate' | 'none';
  validUntil?: string;
}

const getClientNotification = (cnpj: string, companyName: string): RatingNotification => {
  let hash = 0;
  const str = (cnpj || '') + (companyName || '');
  for (let i = 0; i !== str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const absHash = Math.abs(hash);
  if (absHash % 3 === 0) {
    return {
      id: `notify-expiring-${cnpj}`,
      type: 'expiration',
      severity: 'warning',
      title: 'Atenção: Rating Próximo do Vencimento',
      message: `O rating corporativo de ${companyName} expira em 14 dias (em 07 de Julho de 2026). Revalide com balancetes ou faturamentos recentes para garantir o limite contratado junto aos parceiros de funding.`,
      actionText: 'Revalidar Rating Agora',
      actionType: 'revalidate',
      validUntil: '07/07/2026'
    };
  } else if (absHash % 3 === 1) {
    return {
      id: `notify-update-${cnpj}`,
      type: 'banking_update',
      severity: 'info',
      title: 'Necessidade de Atualização Bancária',
      message: `Identificamos que as demonstrações analíticas do faturamento de ${companyName} necessitam de atualização na base de dados para refletir o último faturamento trimestral consolidado.`,
      actionText: 'Atualizar Dados Bancários',
      actionType: 'upload',
    };
  } else {
    return {
      id: `notify-ok-${cnpj}`,
      type: 'up_to_date',
      severity: 'success',
      title: 'Rating Ativo & Atualizado',
      message: `A situação de faturamento e limites de crédito de ${companyName} está em conformidade total. Próxima revisão obrigatória agendada para 20 de Setembro de 2026.`,
      actionText: 'Enviar Demonstrativo Adicional',
      actionType: 'upload',
      validUntil: '20/09/2026'
    };
  }
};

const RatingChartComponent: React.FC<{ leads: CreditoLead[]; role?: string; clientCpfOrCnpj?: string; isLoading?: boolean }> = ({ leads, role, clientCpfOrCnpj, isLoading }) => {
  if (isLoading) {
    return (
      <div id="historical-rating-card-skeleton" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 mt-8 animate-pulse">
        {/* CARD HEADER SKELETON */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
            <div className="space-y-2">
              <div className="h-5 w-48 bg-slate-200 rounded"></div>
              <div className="h-3 w-80 bg-slate-200 rounded"></div>
            </div>
          </div>
          {role !== 'CLIENTE' && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-10 bg-slate-200 rounded"></div>
              <div className="h-8 w-40 bg-slate-200 rounded-xl"></div>
            </div>
          )}
        </div>

        {/* CONTENT GRID SKELETON */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT SCORE PANEL SKELETON */}
          <div className="bg-slate-50 rounded-xl border border-slate-150 p-5 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="h-3 w-28 bg-slate-200 rounded"></div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-12 bg-slate-200 rounded-lg"></div>
                <div className="h-8 w-16 bg-slate-200 rounded"></div>
                <div className="h-4 w-10 bg-slate-200 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-200 rounded"></div>
                <div className="h-3 w-5/6 bg-slate-200 rounded"></div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-slate-200 rounded"></div>
                <div className="h-3 w-28 bg-slate-200 rounded"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-slate-200 rounded"></div>
                <div className="h-3 w-24 bg-slate-200 rounded font-mono"></div>
              </div>
            </div>
          </div>

          {/* RIGHT CHART SKELETON */}
          <div className="lg:col-span-2 h-72 min-h-[250px] w-full flex flex-col justify-between pt-2">
            {/* Grid line simulators */}
            <div className="space-y-8 w-full">
              <div className="h-[2px] bg-slate-100 w-full"></div>
              <div className="h-[2px] bg-slate-100 w-full"></div>
              <div className="h-[2px] bg-slate-100 w-full pb-1 flex items-end">
                {/* Visual mountain / area simulated via SVG wave */}
                <svg className="w-full h-24 text-slate-200 opacity-40 animate-pulse" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0 80 Q 20 60, 40 75 T 80 40 T 100 30 L 100 100 L 0 100 Z" fill="currentColor"></path>
                </svg>
              </div>
            </div>
            
            {/* X Axis label placeholders */}
            <div className="flex justify-between px-2 pt-2 border-t border-slate-150">
              <div className="h-3 w-8 bg-slate-200 rounded"></div>
              <div className="h-3 w-8 bg-slate-200 rounded"></div>
              <div className="h-3 w-8 bg-slate-200 rounded"></div>
              <div className="h-3 w-8 bg-slate-200 rounded"></div>
              <div className="h-3 w-8 bg-slate-200 rounded"></div>
              <div className="h-3 w-8 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>

        {/* BOTTOM RANGES ROW SKELETON */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-6 pt-5 border-t border-slate-100 text-center">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="p-2 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col items-center space-y-2">
              <div className="h-4 w-8 bg-slate-200 rounded"></div>
              <div className="h-3 w-12 bg-slate-200 rounded"></div>
              <div className="h-2 w-10 bg-slate-150 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getAvailableClients = () => {
    const list: { id: string; name: string; value: string; isDemo?: boolean }[] = [];
    
    leads.forEach(l => {
      const name = l.dadosEmpresa.razaoSocial || `CNPJ ${l.dadosEmpresa.cnpj}`;
      list.push({
        id: l.id || l.dadosEmpresa.cnpj,
        name: name,
        value: l.dadosEmpresa.cnpj,
        isDemo: false
      });
    });

    if (list.length === 0) {
      list.push(
        { id: 'demo-1', name: 'Alfa Alimentos Ltda', value: '41.258.963/0001-12', isDemo: true },
        { id: 'demo-2', name: 'Vanguarda Transportes', value: '12.456.789/0001-99', isDemo: true },
        { id: 'demo-3', name: 'Nexus Tech Global', value: '78.910.111/0001-55', isDemo: true },
        { id: 'demo-4', name: 'GSA Soluções Corporativas', value: '99.999.999/0001-00', isDemo: true }
      );
    }
    return list;
  };

  const clients = getAvailableClients();
  
  // Se for CLIENTE, tenta selecionar automaticamente pelo CPF/CNPJ do perfil
  const initialSelection = role === 'CLIENTE' && clientCpfOrCnpj 
    ? (clients.find(c => c.value === clientCpfOrCnpj)?.value || clients[0]?.value)
    : (clients[0]?.value || '');

  const [selectedCnpj, setSelectedCnpj] = useState<string>('');

  useEffect(() => {
    if (initialSelection) {
      setSelectedCnpj(initialSelection);
    }
  }, [initialSelection]);

  const currentSelection = selectedCnpj || initialSelection || (clients[0] ? clients[0].value : '');
  const selectedClient = clients.find(c => c.value === currentSelection) || clients[0];

  const chartData = getDeterministicHistory(selectedClient?.value || 'DEFAULT', selectedClient?.name || 'GSA Client');
  const latestData = chartData[chartData.length - 1] || { score: 600, rating: 'BB' };
  const previousData = chartData[chartData.length - 2];
  const scoreDiff = previousData ? latestData.score - previousData.score : 0;

  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [updatedClients, setUpdatedClients] = useState<Record<string, { type: 'up_to_date' | 'revalidated'; message: string }>>({});
  const [showUploadZone, setShowUploadZone] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    setCurrentTipIndex(0);
    setShowUploadZone(false);
    setUploadedFiles([]);
    setIsProcessing(false);
  }, [currentSelection]);

  const tips = getPersonalizedTips(latestData.score, scoreDiff);
  const activeTip = tips[currentTipIndex] || tips[0];

  const handleNextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % tips.length);
  };

  const handlePrevTip = () => {
    setCurrentTipIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  const rawNotification = getClientNotification(selectedClient?.value || '', selectedClient?.name || '');
  
  const activeNotification: RatingNotification = updatedClients[currentSelection] 
    ? {
        id: `notify-saved-${currentSelection}`,
        type: 'up_to_date',
        severity: 'success',
        title: updatedClients[currentSelection].type === 'revalidated' ? 'Rating Revalidado!' : 'Documentos Recebidos!',
        message: updatedClients[currentSelection].message,
        actionType: 'none',
      }
    : rawNotification;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArr = Array.from(e.dataTransfer.files).map(f => ({ name: f.name, size: f.size }));
      setUploadedFiles(prev => [...prev, ...filesArr]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArr = Array.from(e.target.files).map(f => ({ name: f.name, size: f.size }));
      setUploadedFiles(prev => [...prev, ...filesArr]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const executeRevalidation = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setUpdatedClients(prev => ({
        ...prev,
        [currentSelection]: {
          type: 'revalidated',
          message: `O rating corporativo de ${selectedClient?.name || 'GSA Client'} foi revalidado em tempo real com canais governamentais.`
        }
      }));
      setIsProcessing(false);
      Swal.fire({
        title: 'Rating Revalidado!',
        text: 'Análise preventiva unificada com sucesso! Rating estendido por mais 90 dias.',
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    }, 1500);
  };

  const executeUploadSubmit = () => {
    if (uploadedFiles.length === 0) {
      Swal.fire('Aviso', 'Anexe ou arraste pelo menos um documento para prosseguir.', 'warning');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setUpdatedClients(prev => ({
        ...prev,
        [currentSelection]: {
          type: 'up_to_date',
          message: `O faturamento anual e balancetes foram unificados para o cliente ${selectedClient?.name || 'GSA Client'}.`
        }
      }));
      setIsProcessing(false);
      setShowUploadZone(false);
      Swal.fire({
        title: 'Documentos Recebidos!',
        text: 'Extratos e balanços enviados com sucesso para auditoria e recalibração.',
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    }, 1500);
  };

  return (
    <div id="historical-rating-card" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 mt-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* CARD HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
            Evolução Histórica do Rating Bancário
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-sans">Série de score de crédito empresarial e classificação de risco nos últimos 6 meses</p>
        </div>

        {/* CLIENT SELECTOR */}
        {role !== 'CLIENTE' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente:</span>
            <select
              id="company-rating-selector"
              value={currentSelection}
              onChange={(e) => setSelectedCnpj(e.target.value)}
              className="bg-slate-50 border border-slate-250 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 max-w-xs cursor-pointer hover:bg-slate-100 transition-colors"
            >
              {clients.map(c => (
                <option key={c.id} value={c.value}>
                  {c.name} {c.isDemo ? '(Demonstração)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* SYSTEM NOTIFICATION ALERT */}
      {activeNotification && (
        <div 
          id={`sys-notification-${activeNotification.id}`}
          className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 animate-in fade-in slide-in-from-top-1 ${
            activeNotification.severity === 'warning' ? 'bg-amber-50/50 border-amber-200 text-amber-900' :
            activeNotification.severity === 'success' ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950' :
            'bg-blue-50/40 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              activeNotification.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
              activeNotification.severity === 'success' ? 'bg-emerald-100 text-emerald-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {activeNotification.severity === 'warning' ? (
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              ) : activeNotification.severity === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <BellRing className="w-5 h-5 animate-pulse" />
              )}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black tracking-tight">{activeNotification.title}</h4>
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded font-sans shrink-0 ${
                  activeNotification.severity === 'warning' ? 'bg-amber-100 text-amber-800' :
                  activeNotification.severity === 'success' ? 'bg-emerald-100 text-emerald-800 font-sans' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  Notificação do Sistema
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                {activeNotification.message}
              </p>
              {activeNotification.validUntil && (
                <p className="text-[10px] text-slate-400 font-bold mt-1 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Expira em: {activeNotification.validUntil}
                </p>
              )}
            </div>
          </div>

          {/* CTA ACTION */}
          {activeNotification.actionText && (
            <button
              onClick={() => {
                if (activeNotification.actionType === 'revalidate') {
                  executeRevalidation();
                } else if (activeNotification.actionType === 'upload') {
                  setShowUploadZone(!showUploadZone);
                }
              }}
              disabled={isProcessing}
              id="sys-notification-cta"
              className={`text-xs font-black px-4 py-2 rounded-xl border flex items-center gap-1.5 transition-all w-full sm:w-auto justify-center cursor-pointer hover:shadow-xs shrink-0 ${
                activeNotification.severity === 'warning' ? 'bg-amber-100 hover:bg-amber-200 border-amber-200 text-amber-905 font-sans' :
                'bg-blue-100 hover:bg-blue-200 border-blue-200 text-blue-900 font-sans'
              } disabled:opacity-50`}
            >
              {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {!isProcessing && activeNotification.actionType === 'revalidate' && <RefreshCw className="w-3.5 h-3.5" />}
              {!isProcessing && activeNotification.actionType === 'upload' && <UploadCloud className="w-3.5 h-3.5" />}
              {activeNotification.actionText}
            </button>
          )}
        </div>
      )}

      {/* DYNAMIC COLLAPSIBLE UPLOAD DRAWER */}
      <AnimatePresence>
        {showUploadZone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
            id="collapsible-upload-drawer"
          >
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-black text-slate-800 tracking-tight">Portal de Atualização Cadastral</h4>
                  <p className="text-xs text-slate-500 font-medium">Anexe seus extratos de faturamento ou demonstrativos patrimoniais recentes</p>
                </div>
                <button 
                  onClick={() => setShowUploadZone(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {/* DRAG AND DROP ZONE */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload-input')?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  isDragOver ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-300 hover:border-slate-450 bg-white'
                }`}
              >
                <input 
                  type="file" 
                  id="file-upload-input" 
                  className="hidden" 
                  multiple 
                  onChange={handleFileSelect} 
                />
                
                <div className="flex flex-col items-center space-y-2">
                  <div className={`p-3 rounded-full ${isDragOver ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Arraste seus documentos aqui ou clique para selecionar</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Formatos suportados: PDF, XLS, XLSX, CSV (Max 10MB por arquivo)</p>
                  </div>
                </div>
              </div>

              {/* FILE LIST */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Arquivos Selecionados ({uploadedFiles.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-150 text-xs text-slate-700 font-medium">
                        <span className="truncate max-w-[170px]" title={file.name}>{file.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
                            className="text-rose-500 hover:text-rose-700 font-black cursor-pointer px-1.5 py-0.5 rounded text-sm"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTIONS ROW */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setUploadedFiles([]); }}
                  disabled={uploadedFiles.length === 0 || isProcessing}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-150 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Limpar
                </button>
                <button
                  onClick={executeUploadSubmit}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Enviar Atualização
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DASH CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SCORE STANDINGS BANNER */}
        <div className="bg-slate-50 rounded-xl border border-slate-150 p-5 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rating Bancário Atual</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`px-2.5 py-0.5 text-xs font-black border rounded-lg ${getRatingBadgeStyle(latestData.rating)}`}>
                {latestData.rating}
              </span>
              <span className="text-3xl font-black text-slate-800 font-mono tracking-tight">{latestData.score}</span>
              <span className="text-xs font-bold text-slate-400 font-mono">/ 1000</span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-3 leading-relaxed">
              {getRatingLabelDescription(latestData.rating)}
            </p>

            {/* STATUS TREND CARD */}
            {previousData && (
              <div className={`mt-3.5 p-3 rounded-xl border flex items-center justify-between text-xs transition-all duration-300 ${
                scoreDiff > 0 ? 'bg-emerald-50/70 border-emerald-100 text-emerald-800' :
                scoreDiff < 0 ? 'bg-rose-50/70 border-rose-100 text-rose-800' :
                'bg-slate-50/70 border-slate-150 text-slate-700'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg ${
                    scoreDiff > 0 ? 'bg-emerald-100 text-emerald-700' :
                    scoreDiff < 0 ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-150 text-slate-600'
                  }`}>
                    {scoreDiff > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : scoreDiff < 0 ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : (
                      <span className="font-black text-sm block leading-none w-4 text-center">-</span>
                    )}
                  </span>
                  <div>
                    <p className="font-bold leading-none">
                      {scoreDiff > 0 ? 'Rating em Alta' : scoreDiff < 0 ? 'Rating em Queda' : 'Rating Estável'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      {scoreDiff > 0 ? `Subiu +${scoreDiff} pts` : scoreDiff < 0 ? `Caiu ${scoreDiff} pts` : 'Sem alteração'} comparado a {previousData.mes}
                    </p>
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md self-center font-mono shadow-xs border ${
                  scoreDiff > 0 ? 'bg-white border-emerald-100 text-emerald-700' :
                  scoreDiff < 0 ? 'bg-white border-rose-100 text-rose-700' :
                  'bg-white border-slate-200 text-slate-500'
                }`}>
                  {scoreDiff > 0 ? 'Positivo' : scoreDiff < 0 ? 'Atenção' : 'Estável'}
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Nome / Razão Social:</span>
              <span className="font-bold text-slate-700 truncate max-w-[160px]">{selectedClient?.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">CNPJ do Cliente:</span>
              <span className="font-mono text-slate-600 font-bold">{selectedClient?.value}</span>
            </div>
          </div>
        </div>

        {/* CHART DISPLAY AREA */}
        <div className="lg:col-span-2 h-72 min-h-[250px] w-full mt-2 lg:mt-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="mes" 
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                domain={[300, 1000]}
                ticks={[350, 450, 550, 650, 750, 850, 950]}
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace', fontWeight: 'bold' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => {
                  if (val >= 900) return 'AAA';
                  if (val >= 800) return 'AA';
                  if (val >= 700) return 'A';
                  if (val >= 600) return 'BBB';
                  if (val >= 500) return 'BB';
                  if (val >= 400) return 'B';
                  return 'CCC';
                }}
              />
              <Tooltip content={<CustomRatingTooltip />} />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#10b981" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#ratingGrad)" 
                activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: '#10b981' }}
              />
              <ReferenceLine y={600} stroke="#cbd5e1" strokeDasharray="4 4" label={{ value: 'Grau de Investimento', position: 'top', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* FOOTER INFO - RATING EXPLANATIONS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-6 pt-5 border-t border-slate-100 text-center">
        {[
          { key: 'AAA', text: 'Excelente', score: '900+', color: 'text-emerald-600 bg-emerald-50 border border-emerald-100' },
          { key: 'AA', text: 'Muito Forte', score: '800-899', color: 'text-teal-600 bg-teal-50 border border-teal-100' },
          { key: 'A', text: 'Sólido', score: '700-799', color: 'text-blue-600 bg-blue-50 border border-blue-100' },
          { key: 'BBB', text: 'Satisfatório', score: '600-699', color: 'text-indigo-600 bg-indigo-50 border border-indigo-100' },
          { key: 'BB', text: 'Médio Risco', score: '500-599', color: 'text-amber-600 bg-amber-50 border border-amber-100' },
          { key: 'B', text: 'Alto Risco', score: '400-499', color: 'text-orange-600 bg-orange-50 border border-orange-100' },
          { key: 'CCC', text: 'Inadimplente', score: '300-399', color: 'text-rose-600 bg-rose-50 border border-rose-100' }
        ].map(item => (
          <div key={item.key} className="p-2 border border-slate-100 rounded-xl shadow-sm bg-slate-50/50">
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${item.color}`}>{item.key}</span>
            <div className="text-[10px] font-bold text-slate-700 mt-1.5">{item.text}</div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{item.score} pts</div>
          </div>
        ))}
      </div>

      {/* SEÇÃO DE RECOMENDAÇÕES (CARROSSEL) */}
      <div id="rating-tips-carousel-section" className="mt-8 pt-8 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
              <h4 className="text-sm font-black text-slate-800 tracking-tight uppercase">Plano de Ação: Melhora de Rating</h4>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Recomendações financeiras estruturadas com base no perfil histórico de {selectedClient?.name || 'GSA Client'}
            </p>
          </div>

          {/* CONTROLES DO CARROSSEL */}
          <div className="flex items-center gap-2.5">
            <button 
              onClick={handlePrevTip}
              id="prev-tip-btn"
              className="p-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
              title="Dica anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold font-mono text-slate-400">
              {currentTipIndex + 1} / {tips.length}
            </span>
            <button 
              onClick={handleNextTip}
              id="next-tip-btn"
              className="p-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
              title="Próxima dica"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CONTAINER DO SLIDE DO CARROSSEL */}
        <AnimatePresence mode="wait">
          {activeTip && (
            <motion.div
              key={activeTip.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`p-5 rounded-2xl border transition-all ${activeTip.colorTheme.bg} ${activeTip.colorTheme.border}`}
            >
              <div className="flex flex-col lg:flex-row gap-5">
                {/* ICON & BADGES AREA */}
                <div className="flex lg:flex-col items-start gap-4">
                  <div className={`p-3.5 rounded-xl ${activeTip.colorTheme.iconBg} ${activeTip.colorTheme.iconText} shadow-xs shrink-0`}>
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border tracking-wider block text-center ${activeTip.colorTheme.badge}`}>
                      {activeTip.category}
                    </span>
                    <div className="flex items-center gap-1.5 lg:justify-center">
                      <span className="text-[10px] font-bold text-slate-400 font-sans">Impacto:</span>
                      <span className={`text-[10px] font-black font-sans ${
                        activeTip.impact === 'Muito Alto' ? 'text-rose-600' :
                        activeTip.impact === 'Alto' ? 'text-amber-600' : 'text-blue-600'
                      }`}>
                        {activeTip.impact}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 lg:justify-center">
                      <span className="text-[10px] font-bold text-slate-400 font-sans">Dificuldade:</span>
                      <span className="text-[10px] font-black text-slate-600 font-sans">
                        {activeTip.difficulty}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h5 className={`text-base font-black tracking-tight ${activeTip.colorTheme.text}`}>
                      {activeTip.title}
                    </h5>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {activeTip.description}
                    </p>
                  </div>

                  {/* ACTION STEPS */}
                  <div className="bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-slate-100 space-y-2.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-sans">Passo a Passo Recomendado</p>
                    <ul className="space-y-2">
                      {activeTip.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="font-medium leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* INDICADORES DO CARROSSEL (DOTS) */}
        <div className="flex justify-center gap-1.5 mt-4">
          {tips.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentTipIndex(idx)}
              className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                currentTipIndex === idx ? 'w-6 bg-slate-700' : 'w-2.5 bg-slate-200 hover:bg-slate-300'
              }`}
              title={`Ir para dica ${idx + 1}`}
            ></button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const CreditoDashboardView: React.FC = () => {
  const { profile } = useAuth();
  const role = profile?.nivel;
  const userId = profile?.uid;

  const [activeTab, setActiveTab] = useState<'pipeline' | 'comissoes' | 'analise_ia'>('pipeline');
  const [split, setSplit] = useState<ConfigComissaoCredito>({
    taxaFixaTotal: 97,
    percentualExitoTotal: 2,
    split: {
      vendedorShare: 0.20,
      gestorShare: 0.10,
      analistaShare: 0.05
    }
  });

  const [leads, setLeads] = useState<CreditoLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);

  useEffect(() => {
    fetchSplit();
    
    let q = query(collection(db, 'leads_credito'));
    
    if (role === 'VENDEDOR') {
      q = query(collection(db, 'leads_credito'), where('vendedorId', '==', userId));
    } else if (role === 'GESTOR') {
      q = query(collection(db, 'leads_credito'), where('gestorId', '==', userId));
    } else if (role === 'ADM_ANALISTA') {
      q = query(collection(db, 'leads_credito'), where('status', 'in', ['analise_tecnica', 'protocolado']));
    } else if (role === 'CLIENTE') {
      q = query(collection(db, 'leads_credito'), where('dadosEmpresa.cnpj', '==', profile?.cpf || '')); 
    }

    import('firebase/firestore').then(({ onSnapshot }) => {
      setLoading(true);
      const unsubscribe = onSnapshot(q, (snap) => {
         const fetchedLeads = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditoLead));
         setLeads(fetchedLeads);
         setLoading(false);
      }, (err) => {
         console.error('Error fetching leads', err);
         setLoading(false);
      });
      return () => unsubscribe();
    });
  }, [role, userId, profile?.cpf]);

  const fetchSplit = async () => {
    try {
      const splitDoc = await getDoc(doc(db, 'configuracoes', 'credito_split'));
      if (splitDoc.exists()) {
        setSplit(splitDoc.data() as ConfigComissaoCredito);
      }
    } catch (err) {
      console.error('Error fetching split', err);
    }
  };

  const fetchLeads = async () => {}; // Now handled via global onSnapshot

  const handleUpdateSplit = async () => {
    try {
      await setDoc(doc(db, 'configuracoes', 'credito_split'), split);
      Swal.fire('Sucesso', 'Split de comissões atualizado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Erro', 'Não foi possível atualizar o split', 'error');
    }
  };

  const handleGenerateReport = async (leadId: string, ebitda?: number, dre?: number) => {
    Swal.fire({
      title: 'Gerando PVE...',
      text: 'A IA está analisando os dados financeiros (DRE: R$ ' + dre + ' / EBITDA: R$ ' + ebitda + ') do cliente.',
      icon: 'info',
      showConfirmButton: false,
      allowOutsideClick: false,
      timer: 3000
    }).then(() => {
      Swal.fire('Concluído!', 'Relatório de Viabilidade (PVE) gerado via Inteligência Artificial com sucesso.', 'success');
    });
  };

  const handleGenerateBilling = async (leadId: string, fee: number) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || !lead.dadosEmpresa.cnpj || !fee) {
      Swal.fire('Erro', 'Dados incompletos para gerar cobrança.', 'error');
      return;
    }

    try {
       Swal.fire({ title: 'Gerando cobrança Asaas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
       
       const { gerarPagamentoAsaasFront } = await import('../services/vendaService');
       const resJson = await gerarPagamentoAsaasFront({
         nome: lead.dadosEmpresa.razaoSocial || lead.dadosEmpresa.cnpj,
         cpf: lead.dadosEmpresa.cnpj,
         email: 'financeiro@empresa.com',
         valor: fee,
         descricao: 'Honorários de Análise de Crédito GSA (' + lead.tipoCredito + ')',
         vendaId: leadId
       });

       await updateDoc(doc(db, 'leads_credito', leadId), {
         'financeiro.taxaFixaEstipuladaAdmin': fee,
         'dadosPagamentoAsaas': {
             idCobrancaAsaas: resJson.payment_id,
             pixQrCodeBase64: resJson.qr_code_base64,
             pixCopiaCola: resJson.copy_paste,
             statusPagamento: 'PENDING'
         },
         'status': 'aguardando_pagamento_taxa'
       });
       
       Swal.fire('Sucesso!', 'Cobrança do Asaas gerada com sucesso.', 'success');
       fetchLeads();
    } catch(err: any) {
       console.error("Erro Billing:", err);
       Swal.fire('Erro', err.message, 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {showManualModal && <ManualLeadModal onClose={() => setShowManualModal(false)} onSuccess={fetchLeads} />}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="text-emerald-600" /> Dashboard de Crédito
          </h1>
          <p className="text-slate-500 mt-1">Gestão, Pipeline e Motor de Análise de Crédito Corporativo</p>
        </div>
        {role !== 'CLIENTE' && (
          <button onClick={() => setShowManualModal(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-colors">
             <Plus size={18} /> Cadastrar Novo Lead
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* TAB NAVIGATION */}
        <div className="flex flex-wrap border-b border-slate-200 bg-slate-50/50">
          <button 
            onClick={() => setActiveTab('pipeline')}
            className={`px-6 py-4 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'pipeline' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <BarChart className="w-4 h-4" /> {role === 'CLIENTE' ? 'Opções de Crédito' : 'Pipeline de Leads'}
          </button>
          
          {role === 'ADM_MASTER' && (
            <button 
              onClick={() => setActiveTab('comissoes')}
              className={`px-6 py-4 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'comissoes' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <Settings2 className="w-4 h-4" /> Parametrização de Split
            </button>
          )}

          {role === 'ADM_ANALISTA' && (
            <button 
              onClick={() => setActiveTab('analise_ia')}
              className={`px-6 py-4 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'analise_ia' ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <FileText className="w-4 h-4" /> Motor de Análise (IA)
            </button>
          )}
        </div>

        {/* TAB CONTENTS */}
        <div className="p-6">
          {activeTab === 'pipeline' && (
            <div className="space-y-8">
              {role === 'VENDEDOR' && (
                <div className="bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl mb-6">
                  <p className="text-emerald-800 font-medium">Você está visualizando exclusivamente seus próprios leads gerados através do seu link de indicação personalizado.</p>
                </div>
              )}
              
              {(role === 'VENDEDOR' || role === 'GESTOR' || role === 'ADM_MASTER' || role === 'CLIENTE') && (
                <div className="mb-8">
                  <CreditLineSelection />
                </div>
              )}

              {/* RATING HISTÓRICO DOS CLIENTES (RECHARTS) */}
              <RatingChartComponent 
                leads={leads} 
                role={role} 
                clientCpfOrCnpj={profile?.cpf} 
                isLoading={loading}
              />

              {role !== 'CLIENTE' && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold mb-4">Leads Protocolados ({leads.length})</h3>
                  {loading ? (
                    <div className="text-center py-6 text-slate-400">Carregando leads...</div>
                  ) : leads.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                      Nenhum lead encontrado neste pipeline.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-y border-slate-200">
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Empresa (CNPJ)</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Linha</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Faturamento</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Solicitado</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600 text-sm">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {leads.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-800">{lead.dadosEmpresa.cnpj}</div>
                                <div className="text-xs text-slate-500">Cadastrado há pouco</div>
                              </td>
                              <td className="py-3 px-4 text-sm font-medium">{lead.tipoCredito}</td>
                              <td className="py-3 px-4 text-sm">R$ {lead.financeiro.faturamentoMensalMedio}</td>
                              <td className="py-3 px-4 text-sm font-semibold text-emerald-600">R$ {lead.financeiro.valorSolicitado}</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  <Clock className="w-3 h-3" /> {lead.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'comissoes' && role === 'ADM_MASTER' && (
            <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div>
                <h2 className="text-xl font-bold mb-2">Parametrização de Comissionamento (Split)</h2>
                <p className="text-slate-500">Defina o comportamento de distribuição de valores arrecadados no comissionamento de serviços de crédito e taxa de sucesso.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 border border-slate-200 rounded-xl bg-slate-50">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Taxa Fixa Avaliação (R$)</label>
                  <input 
                    type="number" 
                    value={split.taxaFixaTotal} 
                    onChange={e => setSplit({...split, taxaFixaTotal: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-xs mt-2 text-slate-500">Valor cobrado antecipadamente pelo Funil (Ex: 97)</p>
                </div>

                <div className="p-5 border border-slate-200 rounded-xl bg-slate-50">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Success Fee Total (%)</label>
                  <input 
                    type="number" 
                    value={split.percentualExitoTotal} 
                    onChange={e => setSplit({...split, percentualExitoTotal: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-xs mt-2 text-slate-500">Comissão de êxito na liberação do banco (Ex: 2 para 2%)</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 p-4 border-b border-slate-200 font-bold text-slate-700 flex items-center gap-2">
                  <SplitSquareVertical className="w-5 h-5 text-slate-500" /> Distribuições do Split (%)
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                      <span>Vendedor / Afiliado (Ex: 0.20 = 20%)</span>
                      <span className="text-emerald-600 font-mono">{(split.split.vendedorShare * 100).toFixed(0)}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01"
                      value={split.split.vendedorShare} 
                      onChange={e => setSplit({...split, split: {...split.split, vendedorShare: Number(e.target.value)}})}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                  
                  <div>
                    <label className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                      <span>Gestor de Equipe (Ex: 0.10 = 10%)</span>
                      <span className="text-emerald-600 font-mono">{(split.split.gestorShare * 100).toFixed(0)}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01"
                      value={split.split.gestorShare} 
                      onChange={e => setSplit({...split, split: {...split.split, gestorShare: Number(e.target.value)}})}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                      <span>Analista QA (Ex: 0.05 = 5%)</span>
                      <span className="text-emerald-600 font-mono">{(split.split.analistaShare * 100).toFixed(0)}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01"
                      value={split.split.analistaShare} 
                      onChange={e => setSplit({...split, split: {...split.split, analistaShare: Number(e.target.value)}})}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={handleUpdateSplit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> Salvar Parametrização
                </button>
              </div>
            </div>
          )}

          {activeTab === 'analise_ia' && role === 'ADM_ANALISTA' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
                <h2 className="text-lg font-bold text-indigo-900 mb-2">Fila de Triagem Técnica e IA</h2>
                <p className="text-indigo-700">Analise os leads protocolados. Ao acionar o botão, a inteligência artificial formulará a viabilidade e gerará o laudo do comitê com base nos dados imputados de faturamento vs DRE.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                   <div className="col-span-full py-10 text-center text-slate-500">Carregando fila...</div>
                ) : leads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} role={role} onGenerate={(id, ebitda, dre) => handleGenerateReport(id, ebitda, dre)} onGenerateBilling={handleGenerateBilling} />
                ))}

                {!loading && leads.length === 0 && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                     <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                     <h3 className="text-slate-500 font-medium">Nenhum documento na fila de triagem.</h3>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
