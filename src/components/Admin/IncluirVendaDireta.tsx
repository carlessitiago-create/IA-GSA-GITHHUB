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
    serverTimestamp 
} from 'firebase/firestore';
import Swal from 'sweetalert2';

export const IncluirVendaDireta = () => {
    const [nomeCliente, setNomeCliente] = useState('');
    const [cpfCliente, setCpfCliente] = useState('');
    const [nascCliente, setNascCliente] = useState('');
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
            const cleanCPF = cpfCliente.replace(/\D/g, '');

            // 1. Obter nomes para denormalização
            let servicoNome = "Serviço";
            const svcDoc = await getDoc(doc(db, 'services', servicoId));
            if (svcDoc.exists()) {
                servicoNome = svcDoc.data()?.nome_servico || svcDoc.data()?.nome || servicoNome;
            }

            let vendedorNome = "Vendedor";
            let idSuperior = finalVendedorId;
            const vendDoc = await getDoc(doc(db, 'usuarios', finalVendedorId));
            if (vendDoc.exists()) {
                vendedorNome = vendDoc.data()?.nome_completo || vendDoc.data()?.nome || vendedorNome;
                idSuperior = vendDoc.data()?.id_superior || finalVendedorId;
            }

            // 2. Criar Cliente
            const clientRef = doc(collection(db, 'clients'));
            
            const clientData: any = {
                nome: nomeCliente,
                nome_completo: nomeCliente,
                documento: cleanCPF,
                cpf: cleanCPF,
                data_nascimento: nascCliente || "",
                vendedor_id: finalVendedorId,
                especialista_id: auth.currentUser?.uid,
                created_at: timestamp,
                timestamp: timestamp,
                origem: 'ADMIN_MANUAL'
            };

            if (temCnpj) {
                const cleanCNPJ = cnpjEmpresa.replace(/\D/g, '');
                clientData.cnpj = cleanCNPJ;
                clientData.nome_empresa = nomeEmpresa;
            }

            batch.set(clientRef, clientData);

            // 3. Trava de CPF
            const lockRef = doc(db, 'documento_locks', cleanCPF);
            batch.set(lockRef, {
                documento: cleanCPF,
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
                cliente_id: clientRef.id,
                cliente_nome: nomeCliente,
                cliente_cpf_cnpj: cleanCPF,
                data_nascimento: nascCliente,
                vendedor_id: finalVendedorId,
                vendedor_nome: vendedorNome,
                id_superior: idSuperior,
                status_atual: 'Pendente',
                status_financeiro: 'PAGO',
                data_execucao: dataServico,
                data_venda: timestamp
            };

            if (temCnpj) {
                const cleanCNPJ = cnpjEmpresa.replace(/\D/g, '');
                processData.cnpj = cleanCNPJ;
                processData.nome_empresa = nomeEmpresa;
            }

            batch.set(processRef, processData);

            await batch.commit();
            
            Swal.fire('Sucesso', 'Cliente, Venda e Processo criados com sucesso!', 'success');
            setNomeCliente(''); setCpfCliente(''); setNascCliente(''); setServicoId(''); setVendedorId(''); setGestorId(''); setDataServico(''); setCnpjEmpresa(''); setNomeEmpresa(''); setTemCnpj(false);
            
        } catch (error: any) {
            console.error('Erro ao processar venda administrativa:', error);
            Swal.fire('Erro', 'Falha ao processar venda: ' + (error.message || 'Erro desconhecido'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                Novo Cliente e Venda Administrativa
            </h2>
            
            <div className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome Completo do Cliente</label>
                    <input 
                        className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500" 
                        placeholder="Ex: João da Silva" 
                        value={nomeCliente} 
                        onChange={(e) => setNomeCliente(e.target.value)} 
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">CPF do Cliente</label>
                        <input 
                            className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500" 
                            placeholder="000.000.000-00" 
                            value={cpfCliente} 
                            onChange={(e) => setCpfCliente(e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Data de Nascimento</label>
                        <input 
                            type="date" 
                            className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                            value={nascCliente} 
                            onChange={(e) => setNascCliente(e.target.value)} 
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
                        Vincular um CNPJ a este cliente (Opcional)
                    </label>
                </div>

                {temCnpj && (
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
                        onClick={handleCreate} 
                        disabled={loading}
                    >
                        {loading && (
                           <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                        )}
                        {loading ? 'Processando e Criando Fila...' : 'Cadastrar Cliente e Iniciar Produção'}
                    </button>
                </div>
            </div>
        </div>
    );
};
