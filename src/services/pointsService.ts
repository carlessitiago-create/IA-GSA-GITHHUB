import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  doc, 
  updateDoc, 
  increment, 
  addDoc, 
  collection, 
  getDoc, 
  getDocs,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';

export interface ClubReward {
  id: string | number;
  nome: string;
  pontos: number;
  foto: string;
  ativo?: boolean;
  status?: 'disponivel' | 'ultimas_unidades' | 'esgotado';
  ordem?: number;
}

export interface PointTransaction {
  id?: string;
  userId: string;
  quantidade: number;
  tipo: 'GANHO' | 'RESGATE' | 'AJUSTE';
  motivo: string;
  data: any;
}

export interface PointsRules {
  cadastro: number;
  indicacao: number;
  pagamento_dia: number;
  pagamento_antecipado: number;
  venda_vendedor: number;
  venda_gestor: number;
}

// 1. Busca as regras que o ADM configurou
export const getPointsRules = async (): Promise<PointsRules> => {
  const docRef = doc(db, 'platform_config', 'points_rules');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    return data.valores || {
      cadastro: 50,
      indicacao: 100,
      pagamento_dia: 20,
      pagamento_antecipado: 50,
      venda_vendedor: 150,
      venda_gestor: 75
    };
  }
  
  // Valores padrão caso o ADM ainda não tenha configurado
  return {
    cadastro: 50,
    indicacao: 100,
    pagamento_dia: 20,
    pagamento_antecipado: 50,
    venda_vendedor: 150,
    venda_gestor: 75
  };
};

// 1.1 Busca os prêmios configurados
export const getClubRewards = async () => {
  try {
    const docRef = doc(db, 'platform_config', 'points_rules');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().premios || [];
    }
    return [];
  } catch (error) {
    console.error("Erro ao carregar prêmios:", error);
    return [];
  }
};

// 2. Função base para dar pontos a qualquer usuário e gerar extrato
export const addPontos = async (userId: string, quantidade: number, motivo: string) => {
  if (!userId || quantidade <= 0) return;
  
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { saldo_pontos: increment(quantidade) });

    await addDoc(collection(db, 'points_history'), {
      userId,
      quantidade,
      motivo,
      tipo: 'GANHO',
      data: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao adicionar pontos:", error);
  }
};

// 3. Lógica Inovadora: Hierarquia de Vendas (Gestores e Vendedores)
export const processarPontosDeVenda = async (vendedorId: string, gestorId: string) => {
  try {
    const regras = await getPointsRules();
    
    // Vendedor ganha pela venda dele
    if (vendedorId) {
      await addPontos(vendedorId, regras.venda_vendedor, 'Venda Realizada (Direta)');
    }
    
    // Gestor ganha a comissão de pontos pela equipe dele
    if (gestorId) {
      await addPontos(gestorId, regras.venda_gestor, 'Bônus Liderança (Venda da Equipe)');
    }
  } catch (error) {
    console.error("Erro ao processar pontos de venda:", error);
  }
};

// 4. Resgate de Prêmios
export const redeemReward = async (userId: string, reward: any) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) throw new Error('Usuário não encontrado');
    
    const userData = userSnap.data();
    const saldoAtual = userData.saldo_pontos || 0;
    
    if (saldoAtual < reward.pontos) {
      throw new Error('Saldo de pontos insuficiente');
    }
    
    // Deduz pontos
    await updateDoc(userRef, { 
      saldo_pontos: increment(-reward.pontos) 
    });
    
    // Registra transação de resgate
    await addDoc(collection(db, 'points_history'), {
      userId,
      quantidade: -reward.pontos,
      motivo: `Resgate de prêmio: ${reward.nome}`,
      tipo: 'RESGATE',
      data: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao resgatar prêmio:", error);
    throw error;
  }
};

// 5. Histórico de Pontos
export const getPointHistory = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'points_history'),
      where('userId', '==', userId),
      orderBy('data', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    return [];
  }
};

// 6. Distribuição de Pontos por Serviço Específico
// Agora com lógica de pontos BLOQUEADOS até o pagamento
export const distribuirPontosPorServico = async (
  serviceId: string, 
  clienteId: string, 
  vendedorId: string, 
  gestorId: string | null,
  processoId: string // Novo: ID do processo para guardar os pontos presos
) => {
  try {
    const serviceSnap = await getDoc(doc(db, 'services', serviceId));
    if (!serviceSnap.exists()) return;

    const serviceData = serviceSnap.data();
    const pontosVendedor = serviceData.pontos_vendedor || 0;
    const pontosGestor = serviceData.pontos_gestor || 0;
    const pontosCliente = serviceData.pontos_cliente || 0;

    const batch = writeBatch(db);
    const processRef = doc(db, 'order_processes', processoId);

    // 1. Pontos do Vendedor (BLOQUEADOS)
    if (pontosVendedor > 0 && vendedorId) {
      await adicionarPontosPendentes(vendedorId, pontosVendedor, `Venda de ${serviceData.nome}`);
      // Guarda no processo quanto está bloqueado para libertar depois
      batch.update(processRef, {
        pontos_presos_vendedor: increment(pontosVendedor)
      });
    }

    // 2. Pontos do Gestor (BLOQUEADOS)
    if (pontosGestor > 0 && gestorId) {
      await adicionarPontosPendentes(gestorId, pontosGestor, `Comissão Gestor: Venda de ${serviceData.nome}`);
      batch.update(processRef, {
        pontos_presos_gestor: increment(pontosGestor)
      });
    }

    // 3. Pontos do Cliente (Geralmente libertados na hora ou via cashback)
    if (pontosCliente > 0 && clienteId) {
      await addPontos(clienteId, pontosCliente, `Compra de ${serviceData.nome}`);
    }

    await batch.commit();
  } catch (error) {
    console.error("Erro ao distribuir pontos por serviço:", error);
  }
};

// 7. Função para adicionar Pontos BLOQUEADOS (Na hora da venda)
export const adicionarPontosPendentes = async (userId: string, quantidade: number, motivo: string) => {
  if (!userId || quantidade <= 0) return;
  
  try {
    const userRef = doc(db, 'users', userId);
    const batch = writeBatch(db);

    // Incrementa o saldo pendente (bloqueado)
    batch.update(userRef, {
      saldo_pendente: increment(quantidade)
    });

    // Regista no histórico como BLOQUEADO
    const historyRef = doc(collection(db, 'points_history'));
    batch.set(historyRef, {
      userId,
      quantidade,
      tipo: 'GANHO',
      motivo,
      status: 'BLOQUEADO', // Indica que ainda não pode ser usado
      data: serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users');
  }
};

// 8. Função para LIBERTAR os pontos (Quando a fatura é paga)
export const libertarPontosPendentes = async (userId: string, quantidade: number, motivo: string) => {
  if (!userId || quantidade <= 0) return;

  try {
    const userRef = doc(db, 'users', userId);
    const batch = writeBatch(db);

    // Tira do pendente e coloca no saldo real
    batch.update(userRef, {
      saldo_pendente: increment(-quantidade),
      saldo_pontos: increment(quantidade)
    });

    // Regista a libertação no histórico
    const historyRef = doc(collection(db, 'points_history'));
    batch.set(historyRef, {
      userId,
      quantidade,
      tipo: 'GANHO',
      motivo: `LIBERADO: ${motivo}`,
      status: 'DISPONIVEL',
      data: serverTimestamp()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users');
  }
};

// 9. Entrega de Cashback (Pontos do Cliente)
export const entregarCashbackCliente = async (serviceId: string, clienteId: string) => {
  try {
    const serviceSnap = await getDoc(doc(db, 'services', serviceId));
    if (!serviceSnap.exists()) return;

    const serviceData = serviceSnap.data();
    const pontosCliente = serviceData.pontos_cliente || 0;

    if (pontosCliente > 0 && clienteId) {
      await addPontos(clienteId, pontosCliente, `Cashback por Serviço: ${serviceData.nome}`);
    }
  } catch (error) {
    console.error("Erro ao entregar cashback ao cliente:", error);
  }
};
