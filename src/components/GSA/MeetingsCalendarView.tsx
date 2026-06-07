import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2, Calendar, User, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const MeetingsCalendarView: React.FC = () => {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true);
      try {
        // Assuming meetings are stored in a 'meetings' collection
        // or derived from 'clients' where contratou_reuniao is true
        const q = query(
          collection(db, 'clients'),
          where('contratou_reuniao', '==', true),
          orderBy('updated_at', 'desc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMeetings(data);
      } catch (error) {
        console.error("Erro ao buscar reuniões:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 size-8" /></div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Agenda de Reuniões</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {meetings.length > 0 ? (
          meetings.map((meeting) => (
            <div key={meeting.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                    <User size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900">{meeting.nome}</h3>
                    <p className="text-xs text-slate-500">{meeting.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">
                 <Calendar size={16} />
                 {meeting.updated_at?.toDate ? format(meeting.updated_at.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Data não definida'}
              </div>
              
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span>Status: {meeting.status_reuniao || 'Agendado'}</span>
                  {meeting.status_pagamento === 'Pago' && <span className="text-emerald-600">Pago</span>}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
            <AlertCircle className="mx-auto text-slate-400 mb-2" size={48} />
            <p className="text-slate-500">Nenhuma reunião agendada encontrada.</p>
          </div>
        )}
      </div>
    </div>
  );
};
