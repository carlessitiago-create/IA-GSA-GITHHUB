import React, { useState, useEffect } from 'react';
import { useAuth, UserProfile } from '../components/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { motion } from 'motion/react';
import { User, CreditCard, Mail, Calendar, Phone, Building2, Save } from 'lucide-react';
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 p-8 md:p-12 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-700">
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
            
            <div className="md:col-span-2 p-8 bg-slate-50 dark:bg-slate-900/30 rounded-[2rem] border border-slate-100 dark:border-slate-700 space-y-6">
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
            className="w-full md:w-auto bg-[#0a0a2e] text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <><Save className="size-4" /> Salvar Perfil</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
