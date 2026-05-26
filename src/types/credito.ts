export type LinhaCredito = 'FUNGETUR' | 'BNDES_PEQUENAS_EMPRESAS' | 'ANTECIPACAO_RECEBIVEIS' | 'GARANTIA_REAL';

export interface CreditoLead {
  id?: string;
  vendedorId: string; // ID do vendedor ou 'direto'
  gestorId?: string;   // Vinculado automaticamente pela hierarquia do vendedor
  origem: 'isca_digital' | 'cadastro_manual';
  tipoCredito: 'FUNGETUR' | 'BNDES' | 'ANTECIPACAO' | 'GARANTIA_REAL';
  status: 'onboarding' | 'analise_tecnica' | 'aguardando_pagamento_taxa' | 'protocolado' | 'aprovado' | 'analise_ia' | 'recusado';
  dadosEmpresa: {
    cnpj: string;
    razaoSocial: string;
    telefone: string;
    email: string;
    ramoAtividade?: string;
    cadasturAtivo?: boolean;
  };
  financeiro: {
    faturamentoMensalMedio: number;
    valorSolicitado: number;
    ebitdaProjetado?: number;
    icsd?: number;
    taxaFixaEstipuladaAdmin?: number; // Definido dinamicamente pelo Admin/Analista
  };
  dadosPagamentoAsaas?: {
    idCobrancaAsaas: string;
    pixQrCodeBase64: string; // Para renderizar o QR Code na tela
    pixCopiaCola: string;    // String para o botão "Copiar Código"
    statusPagamento: 'PENDING' | 'RECEIVED' | 'OVERDUE';
  };
  createdAt: any;
}

export interface ConfigComissaoCredito {
  taxaFixaTotal: number; // Ex: 2997
  percentualExitoTotal: number; // Ex: 0.02 (2%)
  split: {
    vendedorShare: number; // Ex: 0.20 (20% do ganho)
    gestorShare: number;   // Ex: 0.10 (10% do ganho)
    analistaShare: number; // Ex: 0.05 (5% do ganho)
  };
}
