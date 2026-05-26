export interface CarteiraUsuario {
  userId: string;
  saldoDisponivel: number;
  saldoBloqueado: number; // Comissões de crédito ainda não liberadas pelo banco
  historicoMovimentacoes: {
    id: string;
    tipo: 'comissao_credito' | 'resgate_manual' | 'abatimento_servico';
    valor: number;
    status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
    descricao: string;
    createdAt: Date;
  }[];
}
