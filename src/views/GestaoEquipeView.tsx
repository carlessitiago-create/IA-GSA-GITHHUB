import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import GerenciarUsuarios from '../components/Admin/GerenciarUsuarios';
import { User, Shield, Eye, UserPlus, Search, Users, Edit3, MoreVertical, X } from 'lucide-react';
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
    <div className="responsive-container pb-10 sm:pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sm:gap-8 bg-white p-6 sm:p-10 md:p-12 rounded-[2rem] sm:rounded-[3rem] md:rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden group mb-6 sm:mb-10">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
          <Users className="size-[120px] sm:size-[180px] text-[#0a0a2e]" />
        </div>

        <div className="space-y-2 sm:space-y-4 relative z-10 w-full lg:w-auto">
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="size-10 sm:size-16 bg-[#0a0a2e] rounded-xl sm:rounded-[1.8rem] flex items-center justify-center shadow-2xl shadow-blue-900/20 shrink-0">
              <Shield size={20} className="sm:size-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-5xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none truncate">
                {getTitle()}
              </h1>
              <p className="text-slate-400 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-0.5 sm:mt-1 truncate">GSA Access Control v4.0</p>
            </div>
          </div>
          <p className="text-slate-500 text-[10px] sm:text-base font-medium leading-relaxed max-w-xl">
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
          className="relative z-10 w-full lg:w-auto bg-[#0a0a2e] text-white px-6 sm:px-12 py-4 sm:py-6 rounded-xl sm:rounded-[2rem] font-black text-[9px] sm:text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 sm:gap-4 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-blue-900/30 group"
        >
          {showAddUser ? (
            <><X size={18} className="group-hover:rotate-90 transition-transform" /> CANCELAR</>
          ) : (
            <><UserPlus size={18} className="group-hover:scale-110 transition-transform" /> {profile?.nivel === 'VENDEDOR' ? 'NOVO CLIENTE' : 'ADICIONAR'}</>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showAddUser && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden mb-10 border border-slate-100"
          >
            <div className="p-1 px-2 pb-2">
              <GerenciarUsuarios 
                userToEdit={userToEdit} 
                onSuccess={handleSuccess} 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl sm:rounded-[3.5rem] border border-slate-100 overflow-hidden shadow-xl transition-all">
        <div className="p-6 sm:p-12 border-b border-slate-50 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-center gap-6 sm:gap-10">
          <div className="flex items-center gap-4 sm:gap-8 w-full lg:w-auto">
            <div className="size-12 sm:size-20 bg-blue-600 rounded-xl sm:rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 group transition-all shrink-0">
              <Users className="size-6 sm:size-10 group-hover:scale-110 transition-transform" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl sm:text-3xl font-black text-[#0a0a2e] uppercase italic tracking-tighter leading-none truncate">Usuários</h3>
              <div className="mt-1.5 sm:mt-3 flex items-center gap-2 truncate">
                <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[8px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">{users.length} ATIVOS NO NÚCLEO</span>
              </div>
            </div>
          </div>
          
          <div className="relative w-full lg:w-[500px]">
            <Search className="absolute left-6 sm:left-8 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou e-mail..."
              className="w-full bg-white border border-slate-100 rounded-xl sm:rounded-[2rem] py-4 sm:py-6 pl-14 sm:pl-18 pr-6 sm:pr-10 text-[10px] sm:text-[13px] font-bold text-[#0a0a2e] placeholder:text-slate-300 focus:ring-8 focus:ring-blue-500/5 outline-none shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* TABLE VIEW (Desktop/Tablet) */}
        <div className="hidden lg:block overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-white text-slate-400 border-b border-slate-50">
                <th className="px-12 py-8 font-black uppercase text-[10px] tracking-[0.3em]">Identidade Digital</th>
                <th className="px-12 py-8 font-black uppercase text-[10px] tracking-[0.3em]">Nível Estratégico</th>
                <th className="px-12 py-8 font-black uppercase text-[10px] tracking-[0.3em]">Status</th>
                <th className="px-12 py-8 font-black uppercase text-[10px] tracking-[0.3em] text-right">Ações de Comando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-12 py-10">
                    <div className="flex items-center gap-6">
                      <div className="size-16 bg-slate-100 rounded-2xl flex items-center justify-center text-[#0a0a2e] font-black text-xl group-hover:bg-[#0a0a2e] group-hover:text-white transition-all shadow-sm ring-4 ring-slate-100 group-hover:ring-[#0a0a2e]/10">
                        {(user.nome_completo || '??').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-[#0a0a2e] text-lg uppercase italic tracking-tight group-hover:text-blue-600 transition-colors truncate">{user.nome_completo}</p>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.05em] mt-1 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-12 py-10">
                    <span className="bg-blue-50 text-blue-700 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2.5 w-fit border border-blue-100 shadow-sm">
                      <Shield size={16} />
                      {user.nivel.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-12 py-10">
                    <span className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] border shadow-sm flex items-center gap-2 w-fit ${
                      user.status_conta === 'APROVADO' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      <div className={`size-1.5 rounded-full ${user.status_conta === 'APROVADO' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                      {user.status_conta || 'PENDENTE'}
                    </span>
                  </td>
                  <td className="px-12 py-10 text-right">
                    <div className="flex items-center justify-end gap-3 sm:gap-4">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="size-12 bg-white border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm hover:shadow-lg group"
                        title="Editar"
                      >
                        <Edit3 size={20} className="group-hover:rotate-12 transition-transform" />
                      </button>
                      <button 
                        onClick={() => handleSimularAcesso(user)}
                        className="inline-flex items-center gap-4 bg-white border border-slate-100 text-[#0a0a2e] px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#0a0a2e] hover:text-white hover:border-[#0a0a2e] transition-all shadow-sm hover:shadow-2xl hover:-translate-y-1"
                      >
                        <Eye size={18} />
                        {profile?.nivel === 'VENDEDOR' ? 'Acessar' : 'Simular'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CARD VIEW (Mobile/Compact) */}
        <div className="lg:hidden p-4 space-y-4 bg-slate-50/30">
          {filteredUsers.map((user) => (
            <div key={user.uid} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-md space-y-6 relative overflow-hidden group">
              <div className="flex items-start justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="size-14 sm:size-16 bg-[#0a0a2e] text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ring-4 ring-[#0a0a2e]/5 shrink-0">
                    {(user.nome_completo || '??').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-[#0a0a2e] text-base sm:text-lg uppercase italic tracking-tight truncate line-clamp-1">{user.nome_completo}</h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-widest truncate">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleEditUser(user)}
                  className="size-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm active:scale-90 transition-transform shrink-0"
                >
                  <Edit3 size={20} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-slate-100">
                <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-100">
                  <Shield size={12} />
                  {user.nivel.replace('_', ' ')}
                </span>
                <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
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
                  className="w-full bg-[#0a0a2e] text-white py-4 sm:py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-blue-900/30"
                >
                  <Eye size={18} />
                  {profile?.nivel === 'VENDEDOR' ? 'ENTRAR' : 'SIMULAR ACESSO'}
                </button>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <Users className="size-16 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 font-black uppercase text-sm italic">Nenhum registro encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
