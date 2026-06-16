import React, { useState, useEffect } from 'react';
import { useAuth, UserProfile } from '../components/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { motion } from 'motion/react';
import { User, CreditCard, Mail, Calendar, Phone, Building2, Save, Download, ShieldAlert, Trash2 } from 'lucide-react';
import { formatDocument, formatPhone } from '../utils/validators';

export const ProfileView: React.FC = () => {
  const { profile, updateUserProfile } = useAuth();
  const [formData, setFormData] = useState({
    nome_completo: '',
    cpf: '',
    email: '',
    data_nascimento: '',
    telefone: '',
    whatsapp: '',
    tem_empresa: false,
    nome_empresa: '',
    cnpj: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        nome_completo: profile.nome_completo || '',
        cpf: profile.cpf || '',
        email: profile.email || '',
        data_nascimento: profile.data_nascimento || '',
        telefone: profile.telefone || '',
        whatsapp: profile.whatsapp || '',
        tem_empresa: profile.tem_empresa || false,
        nome_empresa: profile.nome_empresa || '',
        cnpj: profile.cnpj || ''
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updateData: any = {
        nome_completo: formData.nome_completo,
        cpf: formData.cpf,
        data_nascimento: formData.data_nascimento,
        telefone: formData.telefone,
        whatsapp: formData.whatsapp,
        tem_empresa: formData.tem_empresa,
      };

      if (formData.tem_empresa) {
        updateData.nome_empresa = formData.nome_empresa;
        updateData.cnpj = formData.cnpj;
      } else {
        updateData.nome_empresa = '';
        updateData.cnpj = '';
      }

      await updateUserProfile(updateData);
      
      Swal.fire({
        icon: 'success',
        title: 'Perfil Atualizado!',
        text: 'Suas informações foram salvas com sucesso.',
        confirmButtonColor: '#0a0a2e'
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao salvar',
        text: error.message,
        confirmButtonColor: '#0a0a2e'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `meus_dados_lgpd_${formData.cpf || 'usuario'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      Swal.fire({
        icon: 'success',
        title: 'Portabilidade LGPD',
        text: 'Seus dados pessoais foram reunidos e exportados com sucesso em formato JSON.',
        confirmButtonColor: '#0a0a2e'
      });
    } catch (e: any) {
      Swal.fire({
        icon: 'error',
        title: 'Erro na exportação',
        text: e.message,
        confirmButtonColor: '#0a0a2e'
      });
    }
  };

  const handleErasureRequest = async () => {
    const { value: confirmText } = await Swal.fire({
      title: 'Direito ao Esquecimento (LGPD)',
      html: `<div class="text-left text-xs text-slate-500 space-y-3 leading-relaxed">
        <p>Pelo <strong>Artigo 18, Inciso IV</strong> da Lei Geral de Proteção de Dados (LGPD), você tem o direito de solicitar a eliminação dos dados pessoais tratados com o seu consentimento anterior.</p>
        <p class="font-semibold text-red-600">⚠️ Esta ação é irreversível e irá purgar ou anonimizar permanentemente suas informações no sistema.</p>
        <p>Para prosseguir, digite exatamente <strong>EXCLUIR COMPROMISSO</strong> abaixo:</p>
      </div>`,
      input: 'text',
      inputPlaceholder: 'EXCLUIR COMPROMISSO',
      showCancelButton: true,
      confirmButtonText: 'Confirmar e Apagar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
    });

    if (confirmText === 'EXCLUIR COMPROMISSO') {
      setLoading(true);
      try {
        if (!profile?.uid) throw new Error("Usuário não logado ou indisponível.");
        
        await addDoc(collection(db, "solicitacoes_lgpd"), {
          usuario_id: profile.uid,
          tipo_requisicao: "eliminacao_dados",
          data_requisicao: new Date().toISOString(),
          status: "concluido",
          origem: "self_service_perfil",
          log: `Direito ao esquecimento acionado pelo titular.`
        });

        const userRef = doc(db, 'usuarios', profile.uid);
        await updateDoc(userRef, {
          nome_completo: "TITULAR ANÔNIMO (RESTRITO LGPD)",
          cpf: "000.000.000-00",
          email: `anonimizado_lgpd_${profile.uid}@esquecimento.org`,
          data_nascimento: "1970-01-01",
          telefone: "",
          whatsapp: "",
          nome_empresa: "",
          cnpj: "",
          ativo: false,
          status_conta: "BLOQUEADO"
        });

        await Swal.fire({
          icon: 'success',
          title: 'Dados Pessoais Purmados',
          text: 'Seus dados pessoais identificáveis foram removidos com sucesso. A plataforma será recarregada.',
          confirmButtonColor: '#0a0a2e'
        });

        window.location.reload();
      } catch (err: any) {
        Swal.fire({
          icon: 'error',
          title: 'Erro ao processar',
          text: err.message,
          confirmButtonColor: '#0a0a2e'
        });
      } finally {
        setLoading(false);
      }
    } else if (confirmText !== undefined) {
      Swal.fire({
        icon: 'warning',
        title: 'Verificação incorreta',
        text: 'Não foi possível apagar. O texto digitado difere da confirmação exigida.',
        confirmButtonColor: '#0a0a2e'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 p-8 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-4 mb-10">
          <div className="size-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <User className="size-7 sm:size-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Dados do Especialista</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Mantenha seu perfil atualizado para governança</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <User className="size-2.5 sm:size-3" /> Nome Completo
              </label>
              <input 
                type="text" 
                value={formData.nome_completo}
                onChange={(e) => setFormData({...formData, nome_completo: e.target.value})}
                placeholder="Seu nome" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <CreditCard className="size-2.5 sm:size-3" /> CPF
              </label>
              <input 
                type="text" 
                value={formData.cpf}
                onChange={(e) => setFormData({...formData, cpf: formatDocument(e.target.value)})}
                placeholder="000.000.000-00" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <Mail className="size-2.5 sm:size-3" /> E-mail
              </label>
              <input 
                type="email" 
                value={formData.email}
                disabled
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <Calendar className="size-2.5 sm:size-3" /> Data de Nascimento
              </label>
              <input 
                type="date" 
                value={formData.data_nascimento}
                onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                <Phone className="size-2.5 sm:size-3" /> WhatsApp
              </label>
              <input 
                type="tel" 
                value={formData.whatsapp}
                onChange={(e) => setFormData({...formData, whatsapp: formatPhone(e.target.value)})}
                placeholder="(00) 00000-0000" 
              />
            </div>
            
            <div className="md:col-span-2 p-8 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-6">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="toggleEmpresa" 
                  checked={formData.tem_empresa}
                  onChange={(e) => setFormData({...formData, tem_empresa: e.target.checked})}
                  className="size-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="toggleEmpresa" className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Eu possuo empresa / CNPJ</label>
              </div>
              
              <motion.div 
                initial={false}
                animate={{ height: formData.tem_empresa ? 'auto' : 0, opacity: formData.tem_empresa ? 1 : 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                      <Building2 className="size-2.5 sm:size-3" /> Nome da Empresa
                    </label>
                    <input 
                      type="text" 
                      value={formData.nome_empresa}
                      onChange={(e) => setFormData({...formData, nome_empresa: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1">
                      <CreditCard className="size-2.5 sm:size-3" /> CNPJ
                    </label>
                    <input 
                      type="text" 
                      value={formData.cnpj}
                      onChange={(e) => setFormData({...formData, cnpj: formatDocument(e.target.value)})}
                      placeholder="00.000.000/0001-00" 
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full md:w-auto bg-[#0a0a2e] text-white px-6 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <><Save className="size-4" /> Salvar Perfil</>
            )}
          </button>
        </form>
      </div>

      {/* LGPD & DATA PRIVACY ADVANCED MANAGEMENT PANEL */}
      <div className="bg-white dark:bg-slate-800 p-8 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-6">
        <div className="flex items-center gap-4">
          <div className="size-12 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center">
            <ShieldAlert className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Centro de Privacidade e LGPD</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest text-left">Controle total sobre seus dados pessoais (Lei nº 13.709)</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed dark:text-slate-400 text-left">
          Nós respeitamos a sua soberania de dados. Como titular, a Lei Geral de Proteção de Dados (LGPD) lhe assegura direitos de informação, portabilidade e remoção sobre as informações armazenadas em nosso ecossistema.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Export card */}
          <div className="p-5 border border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col justify-between bg-slate-50/50 dark:bg-slate-900/10 space-y-4 text-left">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Download className="size-4 text-indigo-600" /> Direito de Portabilidade
              </h4>
              <p className="text-[11px] text-slate-400 leading-normal">
                Faça o download instantâneo de todas as suas informações cadastrais estruturadas em arquivo de formato aberto (JSON).
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportData}
              className="w-full md:w-auto self-start text-xs font-black text-slate-700 hover:text-indigo-600 border border-slate-200 dark:border-slate-600 bg-white hover:bg-slate-50 transition-colors py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="size-3.5" /> Exportar meus Dados
            </button>
          </div>

          {/* Erasure card */}
          <div className="p-5 border border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col justify-between bg-slate-50/50 dark:bg-slate-900/10 space-y-4 text-left">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
                <Trash2 className="size-4" /> Direito ao Esquecimento
              </h4>
              <p className="text-[11px] text-slate-400 leading-normal">
                Solicite a exclusão definitiva ou anonimização imediata dos seus dados em nossa base ativa, revogando o seu termo de consentimento.
              </p>
            </div>
            <button
              type="button"
              onClick={handleErasureRequest}
              className="w-full md:w-auto self-start text-xs font-black text-red-600 hover:text-white border border-red-200 hover:border-red-600 bg-white hover:bg-red-600 transition-all py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="size-3.5" /> Excluir Conta (LGPD)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
