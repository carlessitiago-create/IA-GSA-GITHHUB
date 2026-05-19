import { writeBatch, collection, query, where, getDocs, doc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { StatusOrgao, LoteLimpaNome } from '../types/limpaNome';

function calcularProgresso(orgaos: Record<string, StatusOrgao>): number {
  const values = Object.values(orgaos);
  if (values.length === 0) return 0;
  const concluidos = values.filter(v => v === 'CONCLUIDO').length;
  return Math.round((concluidos / values.length) * 100);
}

export const atualizarOrgaoLote = async (loteId: string, orgao: string, novoStatus: StatusOrgao) => {
  const batch = writeBatch(db);
  
  // 1. Atualiza o status no documento do Lote (para fins de dashboard)
  const loteRef = doc(db, 'lotes_limpa_nome', loteId);
  batch.update(loteRef, { [`orgaos_status.${orgao}`]: novoStatus });

  // 2. Busca todos os processos vinculados a este lote
  const qProcessos = query(collection(db, 'order_processes'), where('lote_id', '==', loteId));
  const snapshot = await getDocs(qProcessos);

  snapshot.forEach((processoDoc) => {
    // 3. Verifica se completou 100% (todos os órgãos como CONCLUIDO)
    const dadosAtuais = processoDoc.data();
    const orgaosAtuais = dadosAtuais.orgaos_status || {};
    orgaosAtuais[orgao] = novoStatus;
    
    const todosConcluidos = Object.values(orgaosAtuais).every(status => status === 'CONCLUIDO');
    const progresso = calcularProgresso(orgaosAtuais); // Função auxiliar que retorna de 0 a 100

    batch.update(processoDoc.ref, {
      [`orgaos_status.${orgao}`]: novoStatus,
      progresso_baixa: progresso,
      status: todosConcluidos ? 'CONCLUIDO' : dadosAtuais.status
    });
  });

  await batch.commit();
  // As notificações Push (App) para "Baixa Lançada" devem ser disparadas aqui ou via Cloud Function
};

export const getLoteAtivo = async () => {
    const qLote = query(
      collection(db, 'lotes_limpa_nome'), 
      where('status', '==', 'ABERTO'),
      limit(1)
    );
    const snapshot = await getDocs(qLote);
    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LoteLimpaNome;
    }
    return null;
};
