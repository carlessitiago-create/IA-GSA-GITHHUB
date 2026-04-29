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
            batch.set(clientRef, {
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
            });

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
            batch.set(processRef, {
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
            });

            await batch.commit();
            
            Swal.fire('Sucesso', 'Cliente, Venda e Processo criados com sucesso!', 'success');
            setNomeCliente(''); setCpfCliente(''); setNascCliente(''); setServicoId(''); setVendedorId(''); setGestorId(''); setDataServico('');
            
        } catch (error: any) {
            console.error('Erro ao processar venda administrativa:', error);
            Swal.fire('Erro', 'Falha ao processar venda: ' + (error.message || 'Erro desconhecido'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border rounded shadow bg-white">
            <h2 className="text-xl font-bold mb-4">Novo Cliente e Venda Administrativa</h2>
            <input className="w-full p-2 mb-2 border rounded" placeholder="Nome do Cliente" value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} />
            <input className="w-full p-2 mb-2 border rounded" placeholder="CPF" value={cpfCliente} onChange={(e) => setCpfCliente(e.target.value)} />
            <input type="date" className="w-full p-2 mb-2 border rounded" value={nascCliente} onChange={(e) => setNascCliente(e.target.value)} title="Data de Nascimento" />
            
            <select className="w-full p-2 mb-2 border rounded" value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
                <option value="">Selecione o Serviço</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            
            <select className="w-full p-2 mb-2 border rounded" value={gestorId} onChange={(e) => setGestorId(e.target.value)}>
                <option value="">Selecione o Gestor</option>
                {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>

            <select className="w-full p-2 mb-2 border rounded" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} disabled={!gestorId}>
                <option value="">Sem Vendedor</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
            
            <input type="date" className="w-full p-2 mb-4 border rounded" value={dataServico} onChange={(e) => setDataServico(e.target.value)} />
            
            <button className="w-full bg-blue-600 text-white p-2 rounded" onClick={handleCreate} disabled={loading}>
                {loading ? 'Criando...' : 'Cadastrar e Produzir'}
            </button>
        </div>
    );
};
