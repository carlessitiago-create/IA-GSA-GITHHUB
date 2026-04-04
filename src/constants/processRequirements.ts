// src/constants/processRequirements.ts

export interface Requirement {
  campos: string[];
  documentos: string[];
}

export const PROCESS_REQUIREMENTS: Record<string, Requirement> = {
  'LIMPA_NOME': {
    campos: ['cpf_cnpj', 'nome_empresa'],
    documentos: []
  },
  'RATING_CPF': {
    campos: [
      'nome_completo', 
      'cpf', 
      'data_nascimento', 
      'estado_civil', 
      'endereco', 
      'telefone', 
      'renda_mensal',
      'titulo_eleitor',
      'nome_pai',
      'nome_mae',
      'banco_nome',
      'banco_agencia',
      'banco_conta'
    ],
    documentos: ['rg_cnh', 'comprovante_residencia', 'comprovante_renda']
  },
  'RATING_CNPJ': {
    campos: [
      'razao_social',
      'cnpj',
      'nome_fantasia',
      'inscricao_estadual',
      'regime_tributario',
      'bens_patrimoniais',
      'faturamento_mensal',
      'endereco_comercial'
    ],
    documentos: ['cartao_cnpj', 'contrato_social', 'comprovante_endereco_pj']
  },
  'BACEN': {
    campos: ['estado_civil', 'profissao'],
    documentos: ['rg_cnh', 'comprovante_residencia', 'comprovante_renda', 'extrato_bacen_scr']
  },
  'ANALISE_REVISIONAL': {
    campos: ['valor_pedido', 'parcelas_pagas', 'parcelas_atrasadas', 'total_parcelas_contrato'],
    documentos: ['contrato_financiamento']
  },
  'BUSCA_APREENSAO': {
    campos: ['placa_veiculo', 'chassi_veiculo', 'modelo_veiculo', 'ano_veiculo'],
    documentos: ['documento_veiculo_crlv', 'contrato_financiamento']
  },
  'INDENIZACOES': {
    campos: ['tipo_indenizacao', 'tipo_sinistro'],
    documentos: ['boletim_ocorrencia', 'laudo_medico']
  }
};

export const FIELD_LABELS: Record<string, string> = {
  'nome_completo': 'Nome Completo',
  'cpf': 'CPF',
  'cpf_cnpj': 'CPF ou CNPJ',
  'razao_social': 'Razão Social',
  'cnpj': 'CNPJ',
  'nome_empresa': 'Nome da Empresa',
  'data_nascimento': 'Data de Nascimento',
  'estado_civil': 'Estado Civil',
  'endereco': 'Endereço Residencial',
  'endereco_comercial': 'Endereço Comercial',
  'telefone': 'Telefone de Contato',
  'renda_mensal': 'Renda Mensal',
  'faturamento_mensal': 'Faturamento Mensal',
  'titulo_eleitor': 'Título de Eleitor',
  'nome_pai': 'Nome do Pai',
  'nome_mae': 'Nome da Mãe',
  'banco_nome': 'Nome do Banco',
  'banco_agencia': 'Agência',
  'banco_conta': 'Conta Bancária',
  'nome_fantasia': 'Nome Fantasia',
  'inscricao_estadual': 'Inscrição Estadual (IE)',
  'regime_tributario': 'Regime Tributário',
  'bens_patrimoniais': 'Bens Patrimoniais',
  'profissao': 'Profissão',
  'valor_pedido': 'Valor do Pedido',
  'parcelas_pagas': 'Parcelas Pagas',
  'parcelas_atrasadas': 'Parcelas Atrasadas',
  'total_parcelas_contrato': 'Total de Parcelas do Contrato',
  'tipo_indenizacao': 'Tipo de Indenização',
  'tipo_sinistro': 'Tipo de Sinistro',
  'placa_veiculo': 'Placa do Veículo',
  'chassi_veiculo': 'Chassi do Veículo',
  'modelo_veiculo': 'Modelo do Veículo',
  'ano_veiculo': 'Ano do Veículo'
};

export const DOCUMENT_LABELS: Record<string, string> = {
  'rg_cnh': 'RG ou CNH',
  'comprovante_residencia': 'Comprovante de Residência',
  'comprovante_renda': 'Comprovante de Renda',
  'extrato_bacen_scr': 'Extrato BACEN (SCR)',
  'contrato_financiamento': 'Contrato de Financiamento',
  'documento_veiculo_crlv': 'Documento do Veículo (CRLV)',
  'boletim_ocorrencia': 'Boletim de Ocorrência',
  'laudo_medico': 'Laudo Médico',
  'cartao_cnpj': 'Cartão CNPJ',
  'contrato_social': 'Contrato Social',
  'comprovante_endereco_pj': 'Comprovante de Endereço PJ'
};
