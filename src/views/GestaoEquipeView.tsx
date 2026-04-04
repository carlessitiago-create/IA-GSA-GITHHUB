import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import GerenciarUsuarios from '../components/Admin/GerenciarUsuarios';
import { User, Shield, Eye, UserPlus, Search, Users, Edit3, MoreVertical } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth, UserProfile } from '../components/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export function GestaoEquipeView() {
  const { profile, simulateUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'usuarios'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });
    return () => unsubscribe();
  }, []);

  const handleSimularAcesso = (user: UserProfile) => {
    Swal.fire({
      title: 'Iniciando Simulação',
      text: `Você está entrando no ambiente do ${user.nome_completo} (${user.nivel}). Você verá apenas as permissões dele.`,
      icon: 'info',
      timer: 2000,
      showConfirmButton: false,
      background: '#0a0a2e',
      color: '#fff'
    }).then(() => {
      simulateUser(user);
    });
  };

  const handleEditUser = (user: UserProfile) => {
    setUserToEdit(user);
    setShowAddUser(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSuccess = () => {
    setShowAddUser(false);
    setUserToEdit(null);
  };

  const filteredUsers = users.filter(u => {
    // Se for ADM, vê todos
    if (profile?.nivel === 'ADM_MASTER' || profile?.nivel === 'ADM_GERENTE') {
      return (u.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
             (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    }
    
    // Se for GESTOR, vê a si mesmo, seus vendedores e seus clientes (diretos ou dos seus vendedores)
    if (profile?.nivel === 'GESTOR') {
      const isSelf = u.uid === profile.uid;
      const isMyVendedor = u.nivel === 'VENDEDOR' && u.id_superior === profile.uid;
      const isMyDirectClient = u.nivel === 'CLIENTE' && u.id_superior === profile.uid;
      
      // Para ver clientes de seus vendedores, precisamos checar se o id_superior do cliente é um dos seus vendedores
      const myVendedoresIds = users.filter(v => v.nivel === 'VENDEDOR' && v.id_superior === profile.uid).map(v => v.uid);
      const isMyVendedorClient = u.nivel === 'CLIENTE' && myVendedoresIds.includes(u.id_superior || '');

      if (isSelf || isMyVendedor || isMyDirectClient || isMyVendedorClient) {
        return (u.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
               (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    }

    // Se for VENDEDOR, vê a si mesmo e seus clientes
    if (profile?.nivel === 'VENDEDOR') {
      const isSelf = u.uid === profile.uid;
      const isMyClient = u.nivel === 'CLIENTE' && u.id_superior === profile.uid;
      
      if (isSelf || isMyClient) {
        return (u.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
               (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    }

    return false;
  });

  const getTitle = () => {
    if (profile?.nivel === 'VENDEDOR') return 'Meus Clientes';
    if (profile?.nivel === 'GESTOR') return 'Minha Equipe';
    return 'Gestão de Equipe';
  };

  const getSubtitle = () => {
    if (profile?.nivel === 'VENDEDOR') return 'Gerencie seus clientes e acompanhe seus processos.';
    if (profile?.nivel === 'GESTOR') return 'Gerencie seus vendedores e clientes da sua rede.';
    return 'Controle de acessos e níveis hierárquicos do ecossistema.';
  };

  return (
    <div className="responsive-container pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-6 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
          <Users className="size-[140px] sm:size-[180px] text-[#0a0a2e]" />
        </div>

        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-4">
            <div className="size-12 md:size-14 bg-[#0a0a2e] rounded-2xl md:rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/20">
              <Shield size={24} className="md:size-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">
                {getTitle()}
              </h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">GSA IA Access Control v4.0</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            {getSubtitle()}
          </p>
        </div>

        <button 
          onClick={() => {
            if (showAddUser) {
              setShowAddUser(false);
              setUserToEdit(null);
            } else {
              setShowAddUser(true);
            }
          }}
          className="relative z-10 w-full lg:w-auto bg-[#0a0a2e] text-white px-8 sm:px-10 py-4 sm:py-5 rounded-2xl sm:rounded-[1.8rem] font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-blue-900/30"
        >
          <UserPlus size={18} />
          {showAddUser ? 'CANCELAR' : profile?.nivel === 'VENDEDOR' ? 'NOVO CLIENTE' : 'NOVO USUÁRIO'}
        </button>
      </div>

      <AnimatePresence>
        {showAddUser && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="responsive-card shadow-xl overflow-hidden mb-8"
          >
            <GerenciarUsuarios 
              userToEdit={userToEdit} 
              onSuccess={handleSuccess} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm transition-all hover:shadow-md">
        <div className="p-6 sm:p-8 md:p-10 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8">
          <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
            <div className="size-14 sm:size-16 bg-blue-600 rounded-2xl sm:rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
              <Users className="size-7 sm:size-8" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-[#0a0a2e] uppercase italic tracking-tighter leading-none">Usuários Ativos</h3>
              <div className="mt-2 flex items-center gap-2">
                <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{users.length} COLABORADORES NO SISTEMA</span>
              </div>
            </div>
          </div>
          
          <div className="relative w-full md:w-[400px] lg:w-[450px]">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou e-mail..."
              className="w-full bg-white border border-slate-100 rounded-2xl sm:rounded-[1.8rem] py-4 sm:py-5 pl-14 sm:pl-16 pr-6 sm:pr-8 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#0a0a2e] placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* TABLE VIEW (Desktop) */}
        <div className="hidden md:block overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white text-slate-400 border-b border-slate-50">
                <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Identificação</th>
                <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Nível de Acesso</th>
                <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Status Conta</th>
                <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em] text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className="size-14 bg-slate-100 rounded-[1.2rem] flex items-center justify-center text-[#0a0a2e] font-black text-lg group-hover:bg-[#0a0a2e] group-hover:text-white transition-all shadow-sm">
                        {(user.nome_completo || '').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-[#0a0a2e] text-base uppercase italic tracking-tight group-hover:text-blue-600 transition-colors">{user.nome_completo}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <span className="bg-blue-50 text-blue-700 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit border border-blue-100 shadow-sm">
                      <Shield size={14} />
                      {user.nivel.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-10 py-8">
                    <span className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                      user.status_conta === 'APROVADO' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {user.status_conta || 'PENDENTE'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="size-10 bg-white border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                        title="Editar Usuário"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => handleSimularAcesso(user)}
                        className="inline-flex items-center gap-3 bg-white border border-slate-100 text-slate-400 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#0a0a2e] hover:text-white hover:border-[#0a0a2e] transition-all shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                      >
                        <Eye size={16} />
                        {profile?.nivel === 'VENDEDOR' ? 'Acessar Portal' : 'Simular'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CARD VIEW (Mobile) */}
        <div className="md:hidden divide-y divide-slate-50">
          {filteredUsers.map((user) => (
            <div key={user.uid} className="p-6 space-y-6 bg-white hover:bg-slate-50/30 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="size-14 bg-[#0a0a2e] text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-blue-900/20 shrink-0">
                    {(user.nome_completo || '').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-[#0a0a2e] text-base uppercase italic tracking-tight truncate">{user.nome_completo}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest truncate">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleEditUser(user)}
                  className="size-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm active:scale-90 transition-transform shrink-0"
                  title="Editar Usuário"
                >
                  <Edit3 size={20} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-100 shadow-sm">
                  <Shield size={12} />
                  {user.nivel.replace('_', ' ')}
                </span>
                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                  user.status_conta === 'APROVADO' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {user.status_conta || 'PENDENTE'}
                </span>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => handleSimularAcesso(user)}
                  className="w-full bg-[#0a0a2e] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-blue-900/20"
                >
                  <Eye size={16} />
                  {profile?.nivel === 'VENDEDOR' ? 'Acessar Portal do Cliente' : 'Simular Acesso'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
