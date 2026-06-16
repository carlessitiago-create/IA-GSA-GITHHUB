import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const FunnelDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'clients'), where('origem', '==', 'Landing Page SaaS'));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => doc.data());
                
                const total = data.length;
                const paid = data.filter(l => l.status_pagamento === 'Pago').length;
                const scheduled = data.filter(l => l.status_reuniao === 'Agendado' || l.status_reuniao === 'Realizado').length;
                const done = data.filter(l => l.status_reuniao === 'Realizado').length;

                setStats({
                    funnel: [
                        { name: 'Cadastrados', value: total, color: '#64748b' },
                        { name: 'Pagos', value: paid, color: '#10b981' },
                        { name: 'Agendados', value: scheduled, color: '#3b82f6' },
                        { name: 'Realizados', value: done, color: '#8b5cf6' },
                    ],
                    total,
                    paid,
                    scheduled,
                    done
                });
            } catch (error) {
                console.error("Erro ao buscar métricas:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 size-8" /></div>;

    const cards = [
        { label: 'Total de Leads', value: stats.total, icon: Users, color: 'text-slate-600' },
        { label: 'Conversão em Venda', value: stats.total ? `${Math.round((stats.paid / stats.total) * 100)}%` : '0%', icon: DollarSign, color: 'text-emerald-600' },
        { label: 'Agendamentos', value: stats.scheduled, icon: Calendar, color: 'text-blue-600' },
        { label: 'Taxa de Realização', value: stats.total ? `${Math.round((stats.done / stats.total) * 100)}%` : '0%', icon: TrendingUp, color: 'text-violet-600' },
    ];

    return (
        <div className="space-y-6 pb-20">
            <h2 className="text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Funil de Vendas e Conversão</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-2">
                        <card.icon className={`${card.color} size-6`} />
                        <p className="text-sm font-bold text-slate-500 uppercase">{card.label}</p>
                        <p className="text-3xl font-black text-slate-950">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.funnel} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="value" barSize={40}>
                            {stats.funnel.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
