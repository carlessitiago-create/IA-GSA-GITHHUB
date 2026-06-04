export interface ILead {
  id?: string;
  data_solicitacao: any; // Date | Timestamp
  nome: string;
  email: string;
  whatsapp: string;
  status_pagamento: 'pendente' | 'pago';
  valor_venda: number;
  pacote_escolhido: string;
  gateway_usado: 'asaas' | 'mercadopago';
  identificador_pagamento: string;
}

export interface IConfigNotificacoes {
  emails_admin: string[];
}
