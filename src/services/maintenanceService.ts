import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  query, 
  limit,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';

export interface MaintenanceLog {
  msg: string;
  type: 'info' | 'success' | 'warn' | 'error';
  timestamp: string;
}

export type MaintenanceCallback = (log: MaintenanceLog) => void;

const USERS_COLLECTION = 'usuarios';
const PROCESSES_COLLECTION = 'order_processes';

/**
 * Checks and updates the integrity of users and processes collections.
 */
export async function runSystemIntegrityMaintenance(onProgress: MaintenanceCallback) {
  const addLog = (msg: string, type: MaintenanceLog['type'] = 'info') => {
    onProgress({ msg, type, timestamp: new Date().toLocaleTimeString() });
  };

  addLog('Iniciando Manutenção de Integridade do Sistema...', 'info');

  try {
    // 1. Maintain Users
    addLog('Analisando coleção "usuarios"...', 'info');
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    addLog(`Encontrados ${usersSnap.size} usuários. Verificando consistência...`, 'info');
    
    const userBatch = writeBatch(db);
    let userChanges = 0;

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      const updates: any = {};
      let needsUpdate = false;

      // Rule: Ensure 'ativo' is boolean
      if (data.ativo === undefined) {
        updates.ativo = true;
        needsUpdate = true;
      }

      // Rule: Ensure 'status_conta' exists
      if (!data.status_conta) {
        updates.status_conta = 'APROVADO';
        needsUpdate = true;
      }

      // Rule: Normalize CPF if exists
      if (data.cpf && typeof data.cpf === 'string') {
        const clean = data.cpf.replace(/\D/g, '');
        if (clean !== data.cpf && clean.length > 0) {
          // updates.cpf = clean; // Keep original for now to avoid breaking UI masks, but maybe add a clean_cpf
        }
      }

      // Rule: Ensure default points/loyalty
      if (data.saldo_pontos === undefined) {
        updates.saldo_pontos = 0;
        needsUpdate = true;
      }

      if (needsUpdate) {
        userBatch.update(userDoc.ref, updates);
        userChanges++;
      }
    }

    if (userChanges > 0) {
      await userBatch.commit();
      addLog(`${userChanges} usuários atualizados para o novo schema.`, 'success');
    } else {
      addLog('Todos os usuários já estão em conformidade.', 'success');
    }

    // 2. Maintain Processes
    addLog('Analisando coleção "order_processes"...', 'info');
    const procSnap = await getDocs(collection(db, PROCESSES_COLLECTION));
    addLog(`Encontrados ${procSnap.size} processos. Verificando consistência...`, 'info');

    const procBatch = writeBatch(db);
    let procChanges = 0;

    for (const procDoc of procSnap.docs) {
      const data = procDoc.data();
      const updates: any = {};
      let needsUpdate = false;

      // Rule: Ensure status_atual is valid
      if (!data.status_atual) {
        updates.status_atual = 'Pendente';
        needsUpdate = true;
      }

      // Rule: Ensure protocol format integrity (basic check)
      if (!data.protocolo) {
        updates.protocolo = `#MIG-${Math.floor(Math.random() * 100000)}`;
        needsUpdate = true;
      }

      // Rule: Sincronize names/cpfs if missing but clinte_id exists
      if (data.cliente_id && data.cliente_id !== 'STANDALONE' && (!data.cliente_nome || !data.cliente_cpf_cnpj)) {
        try {
          const uSnap = await getDoc(doc(db, USERS_COLLECTION, data.cliente_id));
          if (uSnap.exists()) {
            const uData = uSnap.data();
            if (!data.cliente_nome && uData.nome_completo) {
              updates.cliente_nome = uData.nome_completo;
              needsUpdate = true;
            }
            if (!data.cliente_cpf_cnpj && uData.cpf) {
              updates.cliente_cpf_cnpj = uData.cpf;
              needsUpdate = true;
            }
          }
        } catch (e) {
          // Silent fail for single doc fetch in loop
        }
      }

      // Rule: Ensure data_venda is Timestamp
      if (data.data_venda && !(data.data_venda instanceof Timestamp)) {
          // If it's a string or other format, try to convert
          try {
              updates.data_venda = Timestamp.fromDate(new Date(data.data_venda));
              needsUpdate = true;
          } catch(e) {}
      }

      if (needsUpdate) {
        procBatch.update(procDoc.ref, updates);
        procChanges++;
      }
    }

    if (procChanges > 0) {
      await procBatch.commit();
      addLog(`${procChanges} processos atualizados para o novo schema.`, 'success');
    } else {
      addLog('Todos os processos já estão em conformidade.', 'success');
    }

    addLog('Manutenção finalizada com sucesso.', 'success');
  } catch (error: any) {
    addLog(`Erro durante manutenção: ${error.message}`, 'error');
    console.error('Maintenance Error:', error);
    throw error;
  }
}
