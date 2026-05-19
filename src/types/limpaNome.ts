export type StatusOrgao = 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';

export interface LoteLimpaNome {
  id: string;
  status: 'ABERTO' | 'FECHADO' | 'PROCESSANDO';
  data_encerramento: any;
}
