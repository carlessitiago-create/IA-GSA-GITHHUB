import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    doc, 
    getDoc, 
    writeBatch, 
    serverTimestamp,
    orderBy,
    limit
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, Download, Search, Clock, Calendar, User, FileText, CheckCircle } from 'lucide-react';

export const IncluirVendaDireta = () => {
    const [importMode, setImportMode] = useState<'manual' | 'planilha'>('manual');
    const [planilhaFile, setPlanilhaFile] = useState<File | null>(null);

    const [nomeCliente, setNomeCliente] = useState('');
    const [cpfCliente, setCpfCliente] = useState('');
    const [nascCliente, setNascCliente] = useState('');
    const [codigoInterno, setCodigoInterno] = useState('');
    const [servicoId, setServicoId] = useState('');
    const [vendedorId, setVendedorId] = useState('');
    const [dataServico, setDataServico] = useState('');
    const [servicos, setServicos] = useState<{id: string, nome: string}[]>([]);
    const [gestores, setGestores] = useState<{id: string, nome: string}[]>([]);
    const [vendedores, setVendedores] = useState<{id: string, nome: string}[]>([]);
    const [gestorId, setGestorId] = useState('');
    const [loading, setLoading] = useState(false);
    const [temCnpj, setTemCnpj] = useState(false);
    const [cnpjEmpresa, setCnpjEmpresa] = useState('');
    const [nomeEmpresa, setNomeEmpresa] = useState('');
    const [cpfVinculado, setCpfVinculado] = useState('');

    const cleanMainDoc = cpfCliente.replace(/\D/g, '');
    const isPj = cleanMainDoc.length > 11;

    const [recentProcesses, setRecentProcesses] = useState<any[]>([]);
    const [filterText, setFilterText] = useState('');
    const [loadingList, setLoadingList] = useState(true);

    const loadRecentProcesses = async () => {
        setLoadingList(true);
        try {
            const q = query(
                collection(db, 'order_processes'), 
                orderBy('data_venda', 'desc'), 
                limit(100)
            );
            const snap = await getDocs(q);
            const docsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Order again by memory if needed or rely on Firestore indexing
            setRecentProcesses(docsList);
        } catch (error) {
            console.error('Erro ao buscar processos recentes', error);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        loadRecentProcesses();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const svcSnap = await getDocs(collection(db, 'services'));
                setServicos(svcSnap.docs.map(d => ({ id: d.id, nome: d.data().nome_servico || d.data().nome })));
                
                const gestSnap = await getDocs(query(collection(db, 'usuarios'), where('nivel', '==', 'GESTOR')));
                setGestores(gestSnap.docs.map(d => ({ id: d.id, nome: d.data().nome_completo || d.data().email })));
            } catch (err) {
                console.error("Erro ao carregar dados iniciais:", err);
            }
        };
        fetchData();
    }, []);

    // Carregar vendedores quando o gestor mudar
    useEffect(() => {
        const fetchVendedores = async () => {
            if (!gestorId) {
                setVendedores([]);
                return;
            }
            try {
                const q = query(collection(db, 'usuarios'), where('id_superior', '==', gestorId), where('nivel', '==', 'VENDEDOR'));
                const vendSnap = await getDocs(q);
                setVendedores(vendSnap.docs.map(d => ({ id: d.id, nome: d.data().nome_completo || d.data().email })));
            } catch (err) {
                console.error("Erro ao carregar vendedores:", err);
            }
        };
        fetchVendedores();
    }, [gestorId]);

    const downloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                "Nome / Nome da Empresa": "João da Silva",
                "CPF / CNPJ": "000.000.000-00",
                "Serviço Adquirido / A Produzir": "Defesa SISBAJUD",
                "Data de Nascimento (PF)": "01/01/1990",
                "Codigo Interno (Obrigatorio)": "XYZ-123",
                "Data da Aprovacao (Obrigatoria)": "01/05/2026",
                "Gestor de Vendas": "",
                "Vendedor": ""
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Modelo_Atualizado_Cadastros.xlsx");
    };

    const handleMassCreate = async () => {
        if (!planilhaFile) {
            Swal.fire('Erro', 'Selecione a planilha para importação.', 'error');
            return;
        }

        const finalVendedorId = vendedorId || gestorId || auth.currentUser?.uid;
        if (!finalVendedorId) {
            Swal.fire('Erro', 'Vendedor não identificado.', 'error');
            return;
        }

        setLoading(true);

        try {
            const tokenize = (str: string) => {
                return str.normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, " ")
                          .split(/\s+/)
                          .filter(w => w.length > 1);
            };

            const allServicesSnap = await getDocs(collection(db, 'services'));
            const allServicesMap = new Map();
            allServicesSnap.forEach(d => {
                const data = d.data();
                const nm = (data.nome_servico || data.nome || "").toLowerCase().trim();
                const tokens = tokenize(nm);
                const normalizedNm = tokens.join('');
                if (normalizedNm) allServicesMap.set(normalizedNm, { ...data, id: d.id, tokens });
            });

            const allModelsSnap = await getDocs(collection(db, 'process_models'));
            const allModelsMap = new Map();
            allModelsSnap.forEach(d => allModelsMap.set(d.id, d.data()));

            const fileData = await planilhaFile.arrayBuffer();
            const wb = XLSX.read(fileData, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws);

            if (!data || data.length === 0) {
                Swal.fire('Erro', 'Planilha vazia ou em formato inválido.', 'error');
                setLoading(false);
                return;
            }

            let vendedorNomeGlobal = "Vendedor";
            let idSuperiorGlobal = finalVendedorId;
            const vendDoc = await getDoc(doc(db, 'usuarios', finalVendedorId));
            if (vendDoc.exists()) {
                vendedorNomeGlobal = vendDoc.data()?.nome_completo || vendDoc.data()?.nome || vendedorNomeGlobal;
                idSuperiorGlobal = vendDoc.data()?.id_superior || finalVendedorId;
            }

            let batch = writeBatch(db);
            let batchCount = 0;
            let sucessCount = 0;
            let errorCount = 0;

            for (const row of data as any[]) {
                const servicoRaw = row["Serviço Adquirido / A Produzir"] || row["Servico Adquirido"] || "";
                if (!servicoRaw) {
                    errorCount++;
                    continue;
                }

                const rawTokens = tokenize(String(servicoRaw));
                const normalizedServicoRaw = rawTokens.join('');
                let svcData = allServicesMap.get(normalizedServicoRaw);
                
                if (!svcData) {
                    let bestMatch = null;
                    let maxScore = 0;
                    
                    for (const [key, val] of allServicesMap.entries()) {
                        const dbTokens = val.tokens as string[];
                        
                        let matchCount = 0;
                        for (const rt of rawTokens) {
                            if (dbTokens.includes(rt)) matchCount++;
                        }
                        
                        const score = matchCount / Math.max(rawTokens.length, dbTokens.length, 1);
                        
                        if (score > maxScore && score > 0.4) {
                            maxScore = score;
                            bestMatch = val;
                        }
                    }
                    
                    if (bestMatch) {
                        svcData = bestMatch;
                    }
                }

                if (!svcData) {
                    console.error("Serviço não encontrado: ", servicoRaw);
                    errorCount++;
                    continue;
                }

                const currentServicoId = svcData.id;
                const currentServicoNome = svcData.nome_servico || svcData.nome;
                const defaultModelId = svcData.modelo_id || "";
                let arrCamposFaltantes = svcData.requisitos_campos || [];
                let arrDocsFaltantes = svcData.requisitos_documentos || [];

                if (defaultModelId && (!arrCamposFaltantes.length && !arrDocsFaltantes.length)) {
                    const modelData = allModelsMap.get(defaultModelId);
                    if (modelData) {
                        arrCamposFaltantes = modelData.campos || [];
                        arrDocsFaltantes = modelData.documentos || [];
                    }
                }

                const nomeRaw = row["Nome / Nome da Empresa"] || row["Nome do Cliente"] || row["Nome"] || "";
                const docRaw = row["CPF / CNPJ"] || row["CPF"] || row["CNPJ"] || "";
                const docClean = String(docRaw).replace(/\D/g, '');
                
                let cpf = "";
                let cnpj = "";
                let nomeEmpresa = "";
                const nome = String(nomeRaw);

                if (docClean.length === 14) {
                    cnpj = docClean;
                    nomeEmpresa = nome; // if PJ, the name is the company name
                } else {
                    cpf = docClean;
                }

                const nascRaw = row["Data de Nascimento (PF)"] || row["Data de Nascimento"] || "";
                let nasc = String(nascRaw);
                const codigo = String(row["Codigo Interno (Obrigatorio)"] || row["Codigo Interno"] || "");
                const dataIncRaw = row["Data da Aprovacao (Obrigatoria)"] || row["Data de Inclusao"] || row["Data de Inclusão"] || "";
                let dataInc = String(dataIncRaw);

                if (!nome || !docClean || !codigo || !dataInc) {
                   errorCount++;
                   continue;
                }

                if (typeof nascRaw === 'number') {
                     const date = new Date(Math.round((nascRaw - 25569) * 86400 * 1000));
                     nasc = date.toISOString().split('T')[0];
                } else if (nasc.includes('/')) {
                     const parts = nasc.split('/');
                     if (parts.length === 3) nasc = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }

                if (typeof dataIncRaw === 'number') {
                     const date = new Date(Math.round((dataIncRaw - 25569) * 86400 * 1000));
                     dataInc = date.toISOString().split('T')[0];
                } else if (dataInc.includes('/')) {
                     const parts = dataInc.split('/');
                     if (parts.length === 3) dataInc = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }

                const providedFields = ['nome_completo'];
                if (cpf) providedFields.push('cpf', 'cpf_cnpj', 'documento');
                if (nasc) providedFields.push('data_nascimento');
                if (cnpj) providedFields.push('cnpj', 'nome_empresa', 'razao_social');

                const currentCamposFaltantes = arrCamposFaltantes.filter(c => !providedFields.includes(c));

                const timestamp = serverTimestamp();
                
                const clientData: any = {
                    nome: String(nome),
                    nome_completo: String(nome),
                    documento: docClean,
                    data_nascimento: nasc,
                    codigo_interno: codigo,
                    vendedor_id: finalVendedorId,
                    especialista_id: auth.currentUser?.uid,
                    created_at: timestamp,
                    timestamp: timestamp,
                    origem: 'ADMIN_LOTE'
                };

                if (cpf) {
                    clientData.cpf = cpf;
                }

                if (cnpj) {
                    clientData.cnpj = cnpj;
                    clientData.nome_empresa = nomeEmpresa;
                }

                const clientRef = doc(collection(db, 'clients'));
                batch.set(clientRef, clientData);

                batch.set(doc(db, 'documento_locks', docClean), {
                    documento: docClean,
                    dono_id: finalVendedorId,
                    vendedor_id: finalVendedorId,
                    timestamp: timestamp
                }, { merge: true });

                const saleRef = doc(collection(db, 'sales'));
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const protocolo = `ADM-${dateStr}-${Math.floor(Math.random() * 1000000)}`;
                
                batch.set(saleRef, {
                    protocolo,
                    cliente_id: clientRef.id,
                    cliente_nome: String(nome),
                    vendedor_id: finalVendedorId,
                    vendedor_nome: vendedorNomeGlobal,
                    id_superior: idSuperiorGlobal,
                    valor_total: 0,
                    metodo_pagamento: 'MANUAL',
                    status_pagamento: 'Pago',
                    timestamp: timestamp,
                    pago_em: timestamp,
                    origem: 'ADM_INTERNAL'
                });

                const processRef = doc(collection(db, 'order_processes'));
                const processData: any = {
                    protocolo,
                    venda_id: saleRef.id,
                    servico_id: currentServicoId,
                    servico_nome: currentServicoNome,
                    modelo_id: defaultModelId,
                    cliente_id: clientRef.id,
                    cliente_nome: String(nome),
                    cliente_cpf_cnpj: docClean,
                    data_nascimento: nasc,
                    codigo_interno: codigo,
                    vendedor_id: finalVendedorId,
                    vendedor_nome: vendedorNomeGlobal,
                    id_superior: idSuperiorGlobal,
                    status_atual: (currentCamposFaltantes.length > 0 || arrDocsFaltantes.length > 0) ? 'Pendente' : 'Em Análise',
                    status_financeiro: 'PAGO',
                    data_execucao: dataInc,
                    data_venda: timestamp,
                    dados_faltantes: currentCamposFaltantes,
                    pendencias_iniciais: arrDocsFaltantes
                };

                if (cnpj) {
                    processData.cnpj = cnpj;
                    processData.nome_empresa = nomeEmpresa;
                }
                if (cpf) {
                    processData.cpf = cpf;
                }

                batch.set(processRef, processData);

                batchCount += 4;
                sucessCount++;

                if (batchCount >= 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            Swal.fire('Sucesso', `${sucessCount} registros importados com sucesso! ${errorCount} linhas ignoradas (dados incompletos).`, 'success');
            setPlanilhaFile(null);
            loadRecentProcesses();
            
        } catch (err: any) {
            console.error("Erro importação", err);
            Swal.fire('Erro', 'Falha ao importar: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!nomeCliente || !cpfCliente || !servicoId || !dataServico) {
            Swal.fire('Erro', 'Preencha os campos obrigatórios (incluindo nome, CPF e serviço).', 'error');
            return;
        }
        
        const finalVendedorId = vendedorId || gestorId || auth.currentUser?.uid;
        if (!finalVendedorId) {
            Swal.fire('Erro', 'Vendedor não identificado.', 'error');
            return;
        }

        setLoading(true);
        try {
            const batch = writeBatch(db);
            const timestamp = serverTimestamp();
            const cleanMainDoc = cpfCliente.replace(/\D/g, '');
            const isPj = cleanMainDoc.length > 11;

            let servicoNome = "Serviço";
            let defaultModelId = "";
            let requisitosCampos: string[] = [];
            let requisitosDocs: string[] = [];

            const svcDoc = await getDoc(doc(db, 'services', servicoId));
            if (svcDoc.exists()) {
                const sData = svcDoc.data();
                servicoNome = sData.nome_servico || sData.nome || servicoNome;
                defaultModelId = sData.modelo_id || "";
                requisitosCampos = sData.requisitos_campos || [];
                requisitosDocs = sData.requisitos_documentos || [];
            }
            
            // Tenta buscar as pendências do modelo
            let arrCamposFaltantes: string[] = requisitosCampos;
            let arrDocsFaltantes: string[] = requisitosDocs;
            
            if (defaultModelId && (!requisitosCampos.length && !requisitosDocs.length)) {
                try {
                    const modelDoc = await getDoc(doc(db, 'process_models', defaultModelId));
                    if (modelDoc.exists()) {
                        arrCamposFaltantes = modelDoc.data().campos || [];
                        arrDocsFaltantes = modelDoc.data().documentos || [];
                    }
                } catch (e) {
                    console.error("Erro ao buscar modelo:", e);
                }
            }

            let vendedorNome = "Vendedor";
            let idSuperior = finalVendedorId;
            const vendDoc = await getDoc(doc(db, 'usuarios', finalVendedorId));
            if (vendDoc.exists()) {
                vendedorNome = vendDoc.data()?.nome_completo || vendDoc.data()?.nome || vendedorNome;
                idSuperior = vendDoc.data()?.id_superior || finalVendedorId;
            }

            const providedFields = ['nome_completo'];
            if (cleanMainDoc) providedFields.push('cpf_cnpj', 'documento');
            if (!isPj && cleanMainDoc) providedFields.push('cpf');
            if (nascCliente) providedFields.push('data_nascimento');
            if (temCnpj && !isPj && cnpjEmpresa) providedFields.push('cnpj', 'nome_empresa', 'razao_social');
            if (isPj) providedFields.push('cnpj', 'nome_empresa', 'razao_social');
            if (temCnpj && isPj && cpfVinculado) providedFields.push('cpf');

            const currentCamposFaltantes = arrCamposFaltantes.filter(c => !providedFields.includes(c));

            // 2. Criar Cliente
            const clientRef = doc(collection(db, 'clients'));
            
            const clientData: any = {
                nome: nomeCliente,
                nome_completo: nomeCliente,
                documento: cleanMainDoc,
                data_nascimento: nascCliente || "",
                codigo_interno: codigoInterno || "",
                vendedor_id: finalVendedorId,
                especialista_id: auth.currentUser?.uid,
                created_at: timestamp,
                timestamp: timestamp,
                origem: 'ADMIN_MANUAL'
            };

            if (isPj) {
                clientData.cnpj = cleanMainDoc;
                clientData.nome_empresa = nomeCliente;
                if (temCnpj && cpfVinculado) {
                    clientData.cpf = cpfVinculado.replace(/\D/g, '');
                }
            } else {
                clientData.cpf = cleanMainDoc;
                if (temCnpj && cnpjEmpresa) {
                    clientData.cnpj = cnpjEmpresa.replace(/\D/g, '');
                    clientData.nome_empresa = nomeEmpresa;
                }
            }

            batch.set(clientRef, clientData);

            // 3. Trava de CPF/CNPJ Principal
            const lockRef = doc(db, 'documento_locks', cleanMainDoc);
            batch.set(lockRef, {
                documento: cleanMainDoc,
                dono_id: finalVendedorId,
                vendedor_id: finalVendedorId,
                timestamp: timestamp
            }, { merge: true });

            // 4. Criar Venda
            const saleRef = doc(collection(db, 'sales'));
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const protocolo = `ADM-${dateStr}-${Math.floor(Math.random() * 10000)}`;
            
            batch.set(saleRef, {
                protocolo,
                cliente_id: clientRef.id,
                cliente_nome: nomeCliente,
                vendedor_id: finalVendedorId,
                vendedor_nome: vendedorNome,
                id_superior: idSuperior,
                valor_total: 0,
                metodo_pagamento: 'MANUAL',
                status_pagamento: 'Pago',
                timestamp: timestamp,
                pago_em: timestamp,
                origem: 'ADM_INTERNAL'
            });

            // 5. Criar Processo
            const processRef = doc(collection(db, 'order_processes'));
            
            const processData: any = {
                protocolo,
                venda_id: saleRef.id,
                servico_id: servicoId,
                servico_nome: servicoNome,
                modelo_id: defaultModelId,
                cliente_id: clientRef.id,
                cliente_nome: nomeCliente,
                cliente_cpf_cnpj: cleanMainDoc,
                data_nascimento: nascCliente || "",
                codigo_interno: codigoInterno || "",
                vendedor_id: finalVendedorId,
                vendedor_nome: vendedorNome,
                id_superior: idSuperior,
                status_atual: (currentCamposFaltantes.length > 0 || arrDocsFaltantes.length > 0) ? 'Pendente' : 'Em Análise',
                status_financeiro: 'PAGO',
                data_execucao: dataServico,
                data_venda: timestamp,
                dados_faltantes: currentCamposFaltantes,
                pendencias_iniciais: arrDocsFaltantes
            };

            if (isPj) {
                processData.cnpj = cleanMainDoc;
                processData.nome_empresa = nomeCliente;
                if (temCnpj && cpfVinculado) {
                    processData.cpf = cpfVinculado.replace(/\D/g, '');
                }
            } else {
                processData.cpf = cleanMainDoc;
                if (temCnpj && cnpjEmpresa) {
                    const cleanCNPJ = cnpjEmpresa.replace(/\D/g, '');
                    processData.cnpj = cleanCNPJ;
                    processData.nome_empresa = nomeEmpresa;
                }
            }

            batch.set(processRef, processData);

            await batch.commit();
            
            Swal.fire('Sucesso', 'Cliente, Venda e Processo criados com sucesso!', 'success');
            setNomeCliente(''); setCpfCliente(''); setNascCliente(''); setCodigoInterno(''); setServicoId(''); setVendedorId(''); setGestorId(''); setDataServico(''); setCnpjEmpresa(''); setNomeEmpresa(''); setTemCnpj(false);
            loadRecentProcesses();
            
        } catch (error: any) {
            console.error('Erro ao processar venda administrativa:', error);
            Swal.fire('Erro', 'Falha ao processar venda: ' + (error.message || 'Erro desconhecido'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredProcesses = recentProcesses.filter(p => {
        if (!filterText) return true;
        const lower = filterText.toLowerCase();
        return (
            (p.cliente_nome?.toLowerCase() || '').includes(lower) ||
            (p.cliente_cpf_cnpj?.toLowerCase() || '').includes(lower) ||
            (p.vendedor_nome?.toLowerCase() || '').includes(lower) ||
            (p.servico_nome?.toLowerCase() || '').includes(lower)
        );
    });

    return (
        <div className="space-y-6">
            <div className="p-6 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    Novo Cliente e Venda Administrativa
                </h2>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                    <button 
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${importMode === 'manual' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        onClick={() => setImportMode('manual')}
                    >
                        Cadastro Manual
                    </button>
                    <button 
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${importMode === 'planilha' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        onClick={() => setImportMode('planilha')}
                    >
                        Importação em Massa
                    </button>
                </div>
            </div>
            
            <div className="space-y-5">
                {importMode === 'manual' ? (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Nome/Empresa</label>
                            <input 
                                className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500" 
                                placeholder="Ex: João da Silva ou Empresa XYZ" 
                                value={nomeCliente} 
                                onChange={(e) => setNomeCliente(e.target.value)} 
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">CPF/CNPJ</label>
                                <input 
                                    className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500" 
                                    placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                                    value={cpfCliente} 
                                    onChange={(e) => setCpfCliente(e.target.value)} 
                                />
                            </div>
                            {!isPj && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Data de Nascimento (Opcional)</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                                        value={nascCliente} 
                                        onChange={(e) => setNascCliente(e.target.value)} 
                                    />
                                </div>
                            )}
                            <div className={isPj ? "md:col-span-2" : ""}>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Código Interno (Opcional)</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500" 
                                    placeholder="Ex: XYZ-123" 
                                    value={codigoInterno} 
                                    onChange={(e) => setCodigoInterno(e.target.value)} 
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="temCnpj" 
                                checked={temCnpj} 
                                onChange={(e) => setTemCnpj(e.target.checked)} 
                                className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="temCnpj" className="text-sm font-medium text-slate-300 cursor-pointer">
                                {isPj ? "Vincular um CPF a esta empresa (Opcional)" : "Vincular um CNPJ a este cliente (Opcional)"}
                            </label>
                        </div>

                        {temCnpj && !isPj && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">CNPJ</label>
                                    <input 
                                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500" 
                                        placeholder="00.000.000/0000-00" 
                                        value={cnpjEmpresa} 
                                        onChange={(e) => setCnpjEmpresa(e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Empresa (Razão Social)</label>
                                    <input 
                                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500" 
                                        placeholder="Ex: Empresa Silva Ltda" 
                                        value={nomeEmpresa} 
                                        onChange={(e) => setNomeEmpresa(e.target.value)} 
                                    />
                                </div>
                            </div>
                        )}

                        {temCnpj && isPj && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">CPF (Representante)</label>
                                    <input 
                                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500" 
                                        placeholder="000.000.000-00" 
                                        value={cpfVinculado} 
                                        onChange={(e) => setCpfVinculado(e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Data de Nascimento (Opcional)</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                                        value={nascCliente} 
                                        onChange={(e) => setNascCliente(e.target.value)} 
                                    />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <FileSpreadsheet className="text-blue-500" size={24} />
                                    Importação via Planilha
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">Faça o download do modelo, preencha as linhas e envie abaixo.</p>
                            </div>
                            <button 
                                onClick={downloadTemplate}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white rounded-lg transition-all shadow text-sm font-medium"
                            >
                                <Download size={16} />
                                Baixar Planilha Modelo
                            </button>
                        </div>

                        <div className="border-2 border-dashed border-slate-600 hover:border-blue-500 p-8 rounded-xl text-center transition-all bg-slate-900 cursor-pointer relative group">
                            <input 
                                type="file" 
                                accept=".xlsx,.xls,.csv" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setPlanilhaFile(e.target.files[0]);
                                    }
                                }}
                            />
                            <UploadCloud className="mx-auto text-slate-400 group-hover:text-blue-500 transition-colors mb-3" size={40} />
                            {planilhaFile ? (
                                <p className="text-blue-400 font-bold">{planilhaFile.name}</p>
                            ) : (
                                <>
                                    <p className="text-slate-300 font-medium font-sans">
                                        Arraste sua planilha aqui ou clique para selecionar
                                    </p>
                                    <p className="text-slate-500 text-xs mt-2">Arquivos suportados: .xlsx, .xls, .csv</p>
                                </>
                            )}
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                            <p className="text-sm text-blue-300">
                                <strong>Regras da Planilha:</strong> O sistema criará um Processo para cada linha da planilha, vinculando-os ao <span className="text-white font-bold">Gestor e Vendedor</span> selecionados abaixo e ao <span className="text-white font-bold">Serviço</span> fornecido na planilha. Mínimo de campos exigidos por linha:
                                <br />• Nome / Nome da Empresa
                                <br />• CPF / CNPJ
                                <br />• Serviço Adquirido / A Produzir
                                <br />• Código Interno
                                <br />• Data da Aprovação
                            </p>
                        </div>
                    </div>
                )}

                {importMode === 'manual' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Serviço Adquirido / A Produzir</label>
                        <select 
                            className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                            value={servicoId} 
                            onChange={(e) => setServicoId(e.target.value)}
                        >
                            <option value="" className="text-slate-500">Selecione o Serviço...</option>
                            {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Gestor de Vendas</label>
                        <select 
                            className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50" 
                            value={gestorId} 
                            onChange={(e) => setGestorId(e.target.value)}
                        >
                            <option value="">(Sem Gestor - Administrativo)</option>
                            {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Vendedor Associado</label>
                        <select 
                            className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50" 
                            value={vendedorId} 
                            onChange={(e) => setVendedorId(e.target.value)} 
                            disabled={!gestorId}
                        >
                            <option value="">{gestorId ? 'Sem Vendedor Específico' : 'Selecione um Gestor primeiro...'}</option>
                            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Data da Aprovação / Início</label>
                    <input 
                        type="date" 
                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                        value={dataServico} 
                        onChange={(e) => setDataServico(e.target.value)} 
                    />
                </div>
                
                <div className="pt-4">
                    <button 
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                        onClick={importMode === 'manual' ? handleCreate : handleMassCreate} 
                        disabled={loading}
                    >
                        {loading && (
                           <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                        )}
                        {loading 
                            ? 'Processando e Criando Fila...' 
                            : importMode === 'manual' 
                                ? 'Cadastrar Cliente e Iniciar Produção' 
                                : 'Importar e Iniciar Produção em Lote'
                        }
                    </button>
                </div>
            </div>
            </div>
            
            {/* Seção da Tabela de Processos Recentes */}
            <div className="p-6 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Controle de Processos Cadastrados</h2>
                        <p className="text-sm text-slate-400">Relação dos últimos 100 processos administrativos criados.</p>
                    </div>
                    <div className="relative w-full md:w-64">
                        <input 
                            type="text" 
                            placeholder="Filtrar processos..." 
                            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                    </div>
                </div>

                {loadingList ? (
                    <div className="py-12 flex justify-center items-center text-slate-500">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Carregando processos...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg font-semibold">Data / Hora</th>
                                    <th className="px-4 py-3 font-semibold">Usuário (Vendedor)</th>
                                    <th className="px-4 py-3 font-semibold">Nome do Cliente</th>
                                    <th className="px-4 py-3 font-semibold">CPF / CNPJ</th>
                                    <th className="px-4 py-3 font-semibold">Tipo de Serviço</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProcesses.length > 0 ? (
                                    filteredProcesses.map(p => {
                                        let dataHora = '';
                                        if (p.data_venda) {
                                            const d = p.data_venda.toDate ? p.data_venda.toDate() : new Date(p.data_venda);
                                            dataHora = (d instanceof Date && !isNaN(d as any)) ? 
                                                `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}` : '';
                                        }

                                        return (
                                            <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-500" /> {dataHora || 'N/D'}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="flex items-center gap-1.5"><User size={14} className="text-slate-500" /> {p.vendedor_nome || 'N/D'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-white font-medium">
                                                    {p.cliente_nome || 'N/D'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-mono text-xs text-blue-300">
                                                    {p.cliente_cpf_cnpj || p.cnpj || 'N/D'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="flex items-center gap-1.5"><FileText size={14} className="text-blue-400" /> {p.servico_nome || 'N/D'}</span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                            Nenhum processo encontrado com os filtros atuais.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
