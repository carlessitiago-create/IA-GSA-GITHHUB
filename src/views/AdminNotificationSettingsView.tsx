import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Mail, ToggleLeft, ToggleRight, Send, History } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminNotificationSettingsView() {
  const [settings, setSettings] = useState({
    sale: true,
    referral: true,
    payment: true,
    overdue: true,
  });
  const [loading, setLoading] = useState(true);
  const [manualEmail, setManualEmail] = useState({ to: '', subject: '', html: '' });
  const [notifications, setNotifications] = useState<any[]>([]);

  const labelMapping: Record<string, string> = {
    sale: 'Venda',
    referral: 'Indicação',
    payment: 'Pagamento',
    overdue: 'Atraso',
  };

  useEffect(() => {
    async function fetchSettings() {
      const docRef = doc(db, 'config', 'notification_settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(prev => ({ ...prev, ...docSnap.data() }));
      }
      setLoading(false);
    }
    fetchSettings();

    const q = query(collection(db, 'sent_notifications'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const nots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNotifications(nots);
    });
    return () => unsubscribe();
  }, []);

  async function toggleSetting(key: string) {
    const newSettings = { ...settings, [key]: !settings[key as keyof typeof settings] };
    setSettings(newSettings);
    await setDoc(doc(db, 'config', 'notification_settings'), newSettings);
  }

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });

  async function sendManualEmail() {
    setIsSendingEmail(true);
    setFeedbackMsg({ text: '', type: '' });
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualEmail)
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar e-mail');
      }

      // Log manually sent notification
      await setDoc(doc(collection(db, 'sent_notifications')), {
          ...manualEmail,
          timestamp: new Date()
      });
      setFeedbackMsg({ text: 'Email enviado e registrado com sucesso!', type: 'success' });
      setManualEmail({ to: '', subject: '', html: '' }); // Limpa o formulário
    } catch (e: any) {
      console.error(e);
      setFeedbackMsg({ text: 'Erro: ' + (e.message || 'Falha ao enviar e-mail'), type: 'error' });
    } finally {
      setIsSendingEmail(false);
    }
  }

  if (loading) return <div className="text-white p-8">Carregando...</div>;

  return (
    <div className="p-8 space-y-12 bg-slate-900 min-h-screen">
      <h1 className="text-4xl font-extrabold text-white tracking-tight">Gerenciamento de Notificações</h1>
      
      <section>
        <h2 className="text-2xl font-semibold text-slate-200 mb-6">Configurações de Automatização</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(settings).map(([key, enabled]) => (
            <div key={key} className="bg-slate-800 p-6 rounded-xl flex items-center justify-between border border-slate-700 shadow-sm">
              <span className="font-semibold text-lg text-white capitalize">{labelMapping[key] || key.replace('_', ' ')}</span>
              <button 
                onClick={() => toggleSetting(key)}
                className="transition-transform hover:scale-105"
              >
                {enabled ? <ToggleRight className="text-emerald-500 size-10" /> : <ToggleLeft className="text-slate-500 size-10" />}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-800 p-8 rounded-xl border border-slate-700 space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><History className="text-amber-400" /> Histórico de Envios</h2>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-white">
                <thead>
                    <tr className="border-b border-slate-700">
                        <th className="p-4">Para</th>
                        <th className="p-4">Assunto</th>
                        <th className="p-4">Data</th>
                    </tr>
                </thead>
                <tbody>
                    {notifications.map(n => (
                        <tr key={n.id} className="border-b border-slate-700 hover:bg-slate-750">
                            <td className="p-4">{n.to}</td>
                            <td className="p-4">{n.subject}</td>
                            <td className="p-4">{n.timestamp?.toDate().toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </section>

      <section className="bg-slate-800 p-8 rounded-xl border border-slate-700 space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Mail className="text-sky-400" /> Envio Manual de Notificações</h2>
        <div className='flex flex-col gap-4'>
            <input type="email" placeholder="Para" value={manualEmail.to} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none" onChange={e => setManualEmail({...manualEmail, to: e.target.value})} />
            <input type="text" placeholder="Assunto" value={manualEmail.subject} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none" onChange={e => setManualEmail({...manualEmail, subject: e.target.value})} />
            <textarea placeholder="Conteúdo HTML" value={manualEmail.html} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-lg text-white placeholder-slate-500 h-40 focus:ring-2 focus:ring-sky-500 outline-none" onChange={e => setManualEmail({...manualEmail, html: e.target.value})} />
        </div>
        <button 
          onClick={sendManualEmail} 
          disabled={isSendingEmail}
          className={`px-8 py-4 rounded-lg text-white font-bold flex items-center gap-2 text-lg transition ${
            isSendingEmail ? 'bg-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700'
          }`}
        >
            <Send size={20} className={isSendingEmail ? "animate-pulse" : ""} /> 
            {isSendingEmail ? 'Enviando...' : 'Enviar Notificação'}
        </button>
        
        {feedbackMsg.text && (
            <div className={`p-4 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                feedbackMsg.type === 'success' ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'
            }`}>
                {feedbackMsg.text}
            </div>
        )}
      </section>
    </div>
  );
}
