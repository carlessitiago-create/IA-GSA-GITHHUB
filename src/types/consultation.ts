// src/types/consultation.ts

export type RoleVisibility = 'admin' | 'manager' | 'seller' | 'client';

export interface ConsultationType {
  id?: string; // Opcional na criação, preenchido pelo Firestore
  name: string;
  description: string;
  internal_cost: number;
  manager_price: number;
  seller_price: number;
  client_price: number;
  visibility: RoleVisibility[];
  active: boolean;
  api_provider: string;
  required_input_type?: string; // 'cpf', 'cnpj', 'cpf_cnpj', 'placa', 'nome'
  is_limpa_nome?: boolean; // 👈 Adicionado para identificar serviços com fluxo de Lotes
}
