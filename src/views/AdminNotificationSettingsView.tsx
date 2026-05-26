import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Mail, ToggleLeft, ToggleRight, Send, History, Plus, Trash2, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminNotificationSettingsView() {
  const [settings, setSettings] = useState({
    sale: true,
    referral: true,
    payment: true,
    overdue: true,
  });
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [manualEmail, setManualEmail] = useState({ to: '', subject: '', html: '' });
  const [notifications, setNotifications] = useState<any[]>([]);

  const labelMapping: Record<string, string> = {
    sale: 'Nova Venda',
    referral: 'Novo Cadastro / Indicação',
    payment: 'Pagamento',
    overdue: 'Atraso',
  };

  useEffect(() => {
    async function fetchSettings() {
      const docRef = doc(db, 'config', 'notification_settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({ ...prev, ...data }));
        if (data.recipientEmails) {
          setRecipientEmails(data.recipientEmails);
        }
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
    await setDoc(doc(db, 'config', 'notification_settings'), newSettings, { merge: true });
  }

  async function addRecipientEmail() {
    if (!newEmail || !newEmail.includes('@')) return;
    if (recipientEmails.includes(newEmail)) {
      setNewEmail('');
      return;
    }
    const updated = [...recipientEmails, newEmail];
    setRecipientEmails(updated);
    await setDoc(doc(db, 'config', 'notification_settings'), { recipientEmails: updated }, { merge: true });
    setNewEmail('');
  }

  async function removeRecipientEmail(emailToRemove: string) {
    const updated = recipientEmails.filter(e => e !== emailToRemove);
    setRecipientEmails(updated);
    await setDoc(doc(db, 'config', 'notification_settings'), { recipientEmails: updated }, { merge: true });
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
    <div className="p-8 space-y-12 bg-[#020617] min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black text-white tracking-widest uppercase">Gerenciamento de Notificações</h1>
        <p className="text-slate-400 text-sm">Configure quem recebe os e-mails e quais eventos geram notificações.</p>
      </div>
      
      <section className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <Users className="text-blue-500 size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider text-sm">E-mails de Recebimento</h2>
            <p className="text-xs text-slate-400">Adicione os e-mails da equipe que devem receber alertas do sistema (ex: novas vendas, cadastros).</p>
          </div>
        </div>

        <div className="flex gap-4">
          <input 
            type="email" 
            placeholder="Digite um e-mail..." 
            value={newEmail} 
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRecipientEmail()}
            className="flex-1 bg-slate-950 border border-slate-800 p-4 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
          />
          <button 
            onClick={addRecipientEmail}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Adicionar
          </button>
        </div>

        {recipientEmails.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {recipientEmails.map(email => (
              <div key={email} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between group h-14">
                <span className="text-sm font-medium text-slate-300 truncate pr-4">{email}</span>
                <button 
                  onClick={() => removeRecipientEmail(email)}
                  className="text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remover e-mail"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <ToggleRight className="text-emerald-500 size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider text-sm">Eventos do Sistema</h2>
            <p className="text-xs text-slate-400">Ative ou desative o envio de notificações para a lista de e-mails acima.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(settings).map(([key, enabled]) => (
            <div key={key} className="bg-slate-900 p-6 rounded-2xl flex items-center justify-between border border-slate-800 transition-colors">
              <span className="font-semibold text-sm tracking-wider text-white uppercase">{labelMapping[key] || key.replace('_', ' ')}</span>
              <button 
                onClick={() => toggleSetting(key)}
                className="transition-transform hover:scale-105"
              >
                {enabled ? <ToggleRight className="text-emerald-500 size-8 w-12" /> : <ToggleLeft className="text-slate-600 size-8 w-12" />}
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <History className="text-amber-500 size-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider text-sm">Histórico de Envios</h2>
              <p className="text-xs text-slate-400">Últimos disparos manuais realizados pelo sistema.</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                  <thead>
                      <tr className="border-b border-slate-800 text-xs font-black uppercase tracking-widest text-slate-500">
                          <th className="pb-4 font-medium">Data</th>
                          <th className="pb-4 font-medium">Assunto</th>
                      </tr>
                  </thead>
                  <tbody>
                      {notifications.map(n => (
                          <tr key={n.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                              <td className="py-4 text-xs whitespace-nowrap">{n.timestamp?.toDate().toLocaleString()}</td>
                              <td className="py-4 font-medium text-white truncate max-w-[200px]">{n.subject}</td>
                          </tr>
                      ))}
                      {notifications.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-8 text-center text-slate-500 text-xs italic">Nenhum envio recente.</td>
                        </tr>
                      )}
                  </tbody>
              </table>
          </div>
        </section>

        <section className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-sky-500/10 rounded-xl">
              <Mail className="text-sky-500 size-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider text-sm">Envio Manual</h2>
              <p className="text-xs text-slate-400">Dispare uma nova mensagem para um destinatário específico.</p>
            </div>
          </div>

          <div className='flex flex-col gap-4'>
              <input type="email" placeholder="Para (e-mail)" value={manualEmail.to} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none text-sm transition-all" onChange={e => setManualEmail({...manualEmail, to: e.target.value})} />
              <input type="text" placeholder="Assunto" value={manualEmail.subject} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none text-sm transition-all" onChange={e => setManualEmail({...manualEmail, subject: e.target.value})} />
              <textarea placeholder="Conteúdo HTML ou Texto" value={manualEmail.html} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white placeholder-slate-500 h-32 focus:ring-2 focus:ring-sky-500 outline-none text-sm transition-all resize-none" onChange={e => setManualEmail({...manualEmail, html: e.target.value})} />
          </div>
          <button 
            onClick={sendManualEmail} 
            disabled={isSendingEmail}
            className={`w-full py-4 rounded-xl text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
              isSendingEmail ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 shadow-lg hover:shadow-sky-500/20'
            }`}
          >
              {isSendingEmail ? (
                <>
                  <div className="size-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={16} /> 
                  Enviar Mensagem
                </>
              )}
          </button>
          
          {feedbackMsg.text && (
              <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                  feedbackMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              }`}>
                  {feedbackMsg.text}
              </div>
          )}
        </section>
      </div>
    </div>
  );
}
