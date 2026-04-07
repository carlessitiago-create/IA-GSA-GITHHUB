import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, orderBy, updateDoc } from 'firebase/firestore';
import { db, cleanData } from '../firebase';
import { sendNotification } from './notificationService';

export interface ProposalOption {
  valor: number;
  condicoes: string;
  forma_pagamento?: string;
  valor_entrada?: number;
  num_parcelas?: number;
  valor_parcela?: number;
}

export interface ProposalData {
  id?: string;
  lead_nome: string;
  lead_telefone?: string;
  lead_cpf?: string;
  lead_whatsapp?: string;
  servico_id: string;
  servico_nome: string;
  valor_sugerido: number;
  valor_venda: number;
  percentual_empresa: number;
  valor_empresa: number;
  opcao_vista: ProposalOption;
  opcao_parcelado: ProposalOption;
  vendedor_id: string;
  vendedor_nome: string;
  vendedor_foto?: string;
  timestamp: any;
  status: 'ABERTA' | 'ACEITA' | 'RECUSADA' | 'EXPIRADA' | 'PAGA';
  slug: string;
  visualizacoes?: number;
  clube_pontos_info?: string;
  showcase_service_id?: string;
  is_public?: boolean;
}

export const createProposal = async (data: Omit<ProposalData, 'timestamp' | 'status' | 'slug'>) => {
  const slug = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const proposalData = {
    ...data,
    status: 'ABERTA',
    slug,
    timestamp: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'proposals'), cleanData(proposalData));
  return { id: docRef.id, slug };
};

export const getProposalBySlug = async (slug: string) => {
  const q = query(collection(db, 'proposals'), where('slug', '==', slug));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const docSnap = snapshot.docs[0];
  const data = docSnap.data() as ProposalData;
  
  // Incrementar visualizações
  await updateDoc(doc(db, 'proposals', docSnap.id), {
    visualizacoes: (data.visualizacoes || 0) + 1
  });

  return { id: docSnap.id, ...data, visualizacoes: (data.visualizacoes || 0) + 1 } as ProposalData;
};

export const listProposalsByVendedor = async (vendedorId: string) => {
  const q = query(
    collection(db, 'proposals'), 
    where('vendedor_id', '==', vendedorId),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProposalData));
};

export const checkCpfOwnership = async (cpf: string) => {
  const q = query(collection(db, 'documento_locks'), where('documento', '==', cpf));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const lockData = snapshot.docs[0].data();
  const userDoc = await getDoc(doc(db, 'usuarios', lockData.dono_id));
  
  if (userDoc.exists()) {
    const ownerData = userDoc.data();
    
    // Notificar dono original sobre tentativa de acesso
    await sendNotification({
      usuario_id: lockData.dono_id,
      titulo: "⚠️ Tentativa de Aceite em Lead Bloqueado",
      mensagem: `O CPF/CNPJ ${cpf} tentou aceitar uma proposta pública, mas já está vinculado a você. Entre em contato imediatamente!`,
      tipo: 'SYSTEM',
      vendedor_id: lockData.dono_id
    });

    return { uid: lockData.dono_id, nome: ownerData.nome_completo };
  }
  
  return { uid: lockData.dono_id, nome: 'Consultor GSA' };
};

export const listAllProposals = async () => {
  const q = query(collection(db, 'proposals'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProposalData));
};

export const updateProposalStatus = async (slug: string, status: ProposalData['status'], cpf: string, whatsapp: string, lead_nome?: string) => {
  const proposal = await getProposalBySlug(slug);
  if (!proposal || !proposal.id) throw new Error('Proposta não encontrada');
  
  const proposalRef = doc(db, 'proposals', proposal.id);
  const updatePayload: any = {
    status,
    lead_cpf: cpf,
    lead_whatsapp: whatsapp,
    updatedAt: serverTimestamp()
  };
  
  if (lead_nome) {
    updatePayload.lead_nome = lead_nome;
  }

  await updateDoc(proposalRef, updatePayload);

  const finalLeadNome = lead_nome || proposal.lead_nome;

  // Notificar Consultor sobre o aceite
  if (status === 'ACEITA' || status === 'PAGA') {
    await sendNotification({
      usuario_id: proposal.vendedor_id,
      titulo: status === 'PAGA' ? "💰 Proposta PAGA Online!" : "✅ Proposta ACEITA!",
      mensagem: `O lead ${finalLeadNome} (${cpf}) deu aceite na proposta de ${proposal.servico_nome}. ${status === 'PAGA' ? 'O pagamento foi confirmado via PIX.' : 'Ligue agora para fechar!'}`,
      tipo: status === 'PAGA' ? 'SALE' : 'NEW_LEAD',
      vendedor_id: proposal.vendedor_id
    });
  }

  // Se for PAGA, criar a OS (OrderProcess)
  if (status === 'PAGA') {
    const protocolo = `GSA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // 1. Criar Cliente (se não existir ou apenas para registro da venda)
    // Para simplificar, vamos criar o OrderProcess direto com os dados da proposta
    await addDoc(collection(db, 'order_processes'), {
      protocolo,
      cliente_nome: finalLeadNome,
      cliente_cpf_cnpj: cpf,
      vendedor_id: proposal.vendedor_id,
      vendedor_nome: proposal.vendedor_nome,
      servico_id: proposal.servico_id,
      servico_nome: proposal.servico_nome,
      status_atual: 'PENDENTE',
      status_financeiro: 'PAGO',
      data_venda: serverTimestamp(),
      origem: 'PROPOSTA_PUBLICA'
    });
  }
};
