import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, limit, orderBy } from 'firebase/firestore';

// Helper robusto para buscar cliente público
const getPublicClient = async (documento: string, dataNascimento?: string, codigoInterno?: string) => {
  const docSemMascara = documento.replace(/[^\d]+/g, '');
  
  // Normalizar datas (Tenta YYYY-MM-DD -> DD/MM/YYYY e vice-versa)
  const datasParaTentar: string[] = [];
  if (dataNascimento) {
    datasParaTentar.push(dataNascimento);
    if (dataNascimento.includes('-')) {
      const [y, m, d] = dataNascimento.split('-');
      if (y.length === 4) datasParaTentar.push(`${d}/${m}/${y}`);
    } else if (dataNascimento.includes('/')) {
      const [d, m, y] = dataNascimento.split('/');
      if (y.length === 4) datasParaTentar.push(`${y}-${m}-${d}`);
    }
  }

  const collections = [
    { name: 'usuarios', field: 'cpf' },
    { name: 'usuarios', field: 'documento' },
    { name: 'clients', field: 'documento' }
  ];

  for (const coll of collections) {
    if (codigoInterno) {
      // Tenta por codigo interno + mascara
      let q = query(collection(db, coll.name), where(coll.field, '==', documento), where('codigo_interno', '==', codigoInterno), limit(1));
      let snap = await getDocs(q);
      if (!snap.empty) return snap.docs[0];

      // Tenta por codigo interno + sem mascara
      if (documento !== docSemMascara) {
        q = query(collection(db, coll.name), where(coll.field, '==', docSemMascara), where('codigo_interno', '==', codigoInterno), limit(1));
        snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0];
      }
    }

    if (datasParaTentar.length > 0) {
      let q = query(collection(db, coll.name), where(coll.field, '==', documento), limit(10));
      let snap = await getDocs(q);
      for (const d of snap.docs) {
         const data = d.data();
         if (!data.data_nascimento || datasParaTentar.includes(data.data_nascimento)) return d;
      }
      
      if (documento !== docSemMascara) {
         q = query(collection(db, coll.name), where(coll.field, '==', docSemMascara), limit(10));
         snap = await getDocs(q);
         for (const d of snap.docs) {
             const data = d.data();
             if (!data.data_nascimento || datasParaTentar.includes(data.data_nascimento)) return d;
         }
      }
    }
  }

  return null;
};

export const consultaPublicaProcesso = async (documento: string, dataNascimento?: string, codigoInterno?: string) => {
  if (!documento || (!dataNascimento && !codigoInterno)) {
    throw new Error("Documento e (Data de Nascimento ou Código Interno) são obrigatórios.");
  }

  const docSemMascara = documento.replace(/[^\d]+/g, '');
  
  // Normalizar datas (Tenta YYYY-MM-DD -> DD/MM/YYYY e vice-versa)
  const datasParaTentar: string[] = [];
  if (dataNascimento) {
    datasParaTentar.push(dataNascimento);
    if (dataNascimento.includes('-')) {
      const [y, m, d] = dataNascimento.split('-');
      if (y.length === 4) datasParaTentar.push(`${d}/${m}/${y}`);
    } else if (dataNascimento.includes('/')) {
      const [d, m, y] = dataNascimento.split('/');
      if (y.length === 4) datasParaTentar.push(`${y}-${m}-${d}`);
    }
  }

  // 1. Busca o processo diretamente pelos dados de segurança (Protocolo OU CPF/CNPJ + Nascimento/Codigo)
  // Isso evita erros de permissão ao tentar listar coleções protegidas
  let snapProc;

  // Busca por PROTOCOLO (Prioritário se o formato bater)
  const isProtocolo = documento.toUpperCase().includes('ADM-') || documento.length > 11;
  if (isProtocolo) {
    if (codigoInterno) {
      const qProt = query(
        collection(db, 'order_processes'),
        where('protocolo', '==', documento.toUpperCase()),
        where('codigo_interno', '==', codigoInterno),
        limit(1)
      );
      const res = await getDocs(qProt);
      if (!res.empty) snapProc = res;
    }
    
    if (!snapProc && datasParaTentar.length > 0) {
      const qProt = query(
        collection(db, 'order_processes'),
        where('protocolo', '==', documento.toUpperCase()),
        limit(10)
      );
      const res = await getDocs(qProt);
      for (const d of res.docs) {
         if (!d.data().data_nascimento || datasParaTentar.includes(d.data().data_nascimento)) {
             snapProc = { docs: [d], empty: false };
             break;
         }
      }
    }
  }

  // Se não achou por protocolo, tenta por CPF/CNPJ
  if (!snapProc || snapProc.empty) {
    if (codigoInterno) {
      // Tenta com Mascara
      let qProcMasc = query(
        collection(db, 'order_processes'),
        where('cliente_cpf_cnpj', '==', documento),
        where('codigo_interno', '==', codigoInterno),
        limit(5)
      );
      let resMasc = await getDocs(qProcMasc);
      if (!resMasc.empty) {
        snapProc = resMasc;
      } else if (documento !== docSemMascara) {
        // Tenta sem Mascara
        let qProcSemMasc = query(
          collection(db, 'order_processes'),
          where('cliente_cpf_cnpj', '==', docSemMascara),
          where('codigo_interno', '==', codigoInterno),
          limit(5)
        );
        let resSemMasc = await getDocs(qProcSemMasc);
        if (!resSemMasc.empty) snapProc = resSemMasc;
      }
    }

    if ((!snapProc || snapProc.empty) && datasParaTentar.length > 0) {
      const qProcMasc = query(collection(db, 'order_processes'), where('cliente_cpf_cnpj', '==', documento), limit(10));
      const resMasc = await getDocs(qProcMasc);
      let found = false;
      let validDocs = [];
      for (const d of resMasc.docs) {
          if (!d.data().data_nascimento || datasParaTentar.includes(d.data().data_nascimento)) validDocs.push(d);
      }
      if (validDocs.length > 0) {
          snapProc = { docs: validDocs, empty: false };
          found = true;
      }

      if (!found && documento !== docSemMascara) {
        const qProcSemMasc = query(collection(db, 'order_processes'), where('cliente_cpf_cnpj', '==', docSemMascara), limit(10));
        const resSemMasc = await getDocs(qProcSemMasc);
        validDocs = [];
        for (const d of resSemMasc.docs) {
            if (!d.data().data_nascimento || datasParaTentar.includes(d.data().data_nascimento)) validDocs.push(d);
        }
        if (validDocs.length > 0) {
            snapProc = { docs: validDocs, empty: false };
        }
      }
    }
  }

  // Se ainda não encontrou, tenta buscar o cliente primeiro para pegar o ID 
  // (Caso o processo não tenha CPF/Nasc gravado mas o cliente tenha)
  if (!snapProc || snapProc.empty) {
    const snapCliente = await getPublicClient(documento, dataNascimento, codigoInterno);
    if (!snapCliente) return null;

    const clienteId = snapCliente.id;
    const clienteData = snapCliente.data();
    
    // Tentar encontrar processo vinculado a este cliente
    if (codigoInterno) {
      const qProc = query(
        collection(db, 'order_processes'),
        where('cliente_id', '==', clienteId),
        where('codigo_interno', '==', codigoInterno),
        limit(10)
      );
      const res = await getDocs(qProc);
      if (!res.empty) snapProc = res;
    }

    if ((!snapProc || snapProc.empty) && datasParaTentar.length > 0) {
      const qProc = query(collection(db, 'order_processes'), where('cliente_id', '==', clienteId), limit(20));
      const res = await getDocs(qProc);
      for (const d of res.docs) {
         if (!d.data().data_nascimento || datasParaTentar.includes(d.data().data_nascimento)) {
            if (!snapProc || snapProc.empty) snapProc = { docs: [d], empty: false };
            else snapProc.docs.push(d);
         }
      }
    }

    if (!snapProc || snapProc.empty) {
      // Caso extremo: o processo existe mas está sem a data_nascimento gravada (legado)
      // Tentamos buscar SEM a data de nascimento, mas isso pode violar as regras de segurança 
      // para acesso público se não houver um índice específico ou se a regra bloquear.
      // DADO QUE AS REGRAS EXIGEM data_nascimento, esta query provavelmente retornará erro ou vazio se o campo não existir.
      try {
        const qProcFallback = query(
          collection(db, 'order_processes'),
          where('cliente_id', '==', clienteId),
          limit(5)
        );
        const resFallback = await getDocs(qProcFallback);
        if (!resFallback.empty) snapProc = resFallback;
      } catch (e) {
        console.warn("Fallback de busca por cliente_id falhou por restrições de segurança");
      }
    }
    
    if (!snapProc || snapProc.empty) return null;

    const processos = snapProc.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    processos.sort((a, b) => (b.data_venda?.seconds || 0) - (a.data_venda?.seconds || 0));

    return {
      ...processos[0],
      cliente_saldo_pontos: clienteData.saldo_pontos || 0
    };
  }

  const processos = snapProc.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
  processos.sort((a, b) => (b.data_venda?.seconds || 0) - (a.data_venda?.seconds || 0));

  // Para pegar o saldo de pontos, buscamos o cliente pelo ID do processo
  let saldoPontos = 0;
  try {
    const { getClienteData } = await import('./leadService');
    const cliente = await getClienteData(processos[0].cliente_id);
    if (cliente) saldoPontos = (cliente as any).saldo_pontos || 0;
  } catch (e) {
    console.warn("Não foi possível carregar saldo de pontos");
  }

  return {
    ...processos[0],
    cliente_saldo_pontos: saldoPontos
  };
};

// Listar Indicações do Cliente (para o Portal Público)
export const listarMinhasIndicacoesPublicas = async (documento: string, dataNascimento?: string, codigoInterno?: string) => {
  const snapCliente = await getPublicClient(documento, dataNascimento, codigoInterno);
  if (!snapCliente) return [];
  const clienteId = snapCliente.id;

  // 2. Busca as indicações vinculadas a este cliente (pelo ID ou pelo Documento)
  const qReferrals = query(
    collection(db, 'referrals'),
    where('cliente_origem_id', 'in', [clienteId, documento]),
    orderBy('timestamp', 'desc'),
    limit(20)
  );

  const snapReferrals = await getDocs(qReferrals);
  return snapReferrals.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Listar Pendências de um Cliente (para o Portal Público)
export const listarPendenciasPublicas = async (clienteId: string) => {
  // 1. Primeiro buscamos os IDs dos processos do cliente
  const qProc = query(
    collection(db, 'order_processes'),
    where('cliente_id', '==', clienteId),
    limit(20)
  );
  const snapProc = await getDocs(qProc);
  if (snapProc.empty) return [];
  
  const processoIds = snapProc.docs.map(doc => doc.id);

  // 2. Buscamos todas as pendências vinculadas a esses processos
  // Dividimos em chunks de 10 devido ao limite do 'in' no Firestore
  const pendencias: any[] = [];
  for (let i = 0; i < processoIds.length; i += 10) {
    const chunk = processoIds.slice(i, i + 10);
    const qPend = query(
      collection(db, 'pendencies'),
      where('processo_id', 'in', chunk)
    );
    const snapPend = await getDocs(qPend);
    pendencias.push(...snapPend.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  return pendencias;
};

// Listar Notificações do Cliente (para o Portal Público)
export const listarNotificacoesPublicas = async (clienteId: string) => {
  const qNotif = query(
    collection(db, 'notifications'),
    where('usuario_id', '==', clienteId),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  const snapNotif = await getDocs(qNotif);
  return snapNotif.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Registrar Indicação vinda da área pública
// Registrar interesse em novidades (Newsletter)
export const registrarNovidadePublica = async (nome: string, whatsapp: string, email: string) => {
  await addDoc(collection(db, 'newsletter_subscribers'), {
    nome,
    whatsapp,
    email,
    timestamp: serverTimestamp(),
    origem: 'PORTAL_PUBLICO'
  });
};

export const registrarIndicacaoPublica = async (documento: string, dataNascimento: string | undefined, codigoInterno: string | undefined, nomeAmigo: string, whatsAmigo: string, emailAmigo: string = '', bonusValor: number = 50) => {
  const snapCliente = await getPublicClient(documento, dataNascimento, codigoInterno);
  const clienteId = snapCliente ? snapCliente.id : documento;

  await addDoc(collection(db, 'referrals'), {
    nome_indicado: nomeAmigo,
    telefone_indicado: whatsAmigo,
    email_indicado: emailAmigo,
    cliente_origem_id: clienteId,
    origem_tipo: 'CLIENTE',
    vendedor_id: 'ADM',
    status_indicacao: 'Enviado',
    timestamp: serverTimestamp(),
    cadastrado: false,
    bloqueado: false,
    origem: 'PORTAL_PUBLICO',
    bonus_valor: bonusValor
  });
};
