import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Search } from 'lucide-react';
import { ConsultationType, RoleVisibility } from '../types/consultation';
import { getConsultationTypes, createConsultationType, updateConsultationType, deleteConsultationType } from '../services/consultationService';
import { ClientConsultationUpsell } from '../components/ClientConsultationUpsell';

const initialFormState: Omit<ConsultationType, 'id'> = {
  name: '',
  description: '',
  internal_cost: 0,
  manager_price: 0,
  seller_price: 0,
  client_price: 0,
  visibility: ['admin', 'manager', 'seller', 'client'],
  active: true,
  api_provider: 'api_padrao',
  required_input_type: 'none',
};

export const AdminConsultationManagerView: React.FC = () => {
  const [types, setTypes] = useState<ConsultationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [formData, setFormData] = useState<Partial<ConsultationType>>(initialFormState);

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    setLoading(true);
    try {
      const data = await getConsultationTypes();
      setTypes(data);
    } catch (error) {
      console.error("Erro ao carregar tipos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await updateConsultationType(formData.id, formData);
      } else {
        await createConsultationType(formData as Omit<ConsultationType, 'id'>);
      }
      setIsEditing(false);
      setFormData(initialFormState);
      loadTypes();
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir?")) {
      await deleteConsultationType(id);
      loadTypes();
    }
  };

  const toggleActive = async (type: ConsultationType) => {
    if (type.id) {
      await updateConsultationType(type.id, { active: !type.active });
      loadTypes();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciar Consultas e Check-ups</h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowTestPanel(!showTestPanel)}
            className="bg-amber-500 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-amber-600 transition"
          >
            <Search size={20} /> {showTestPanel ? 'Esconder Teste' : 'Testar Frontend'}
          </button>
          {!isEditing && (
            <button 
              onClick={() => { setFormData(initialFormState); setIsEditing(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition"
            >
              <Plus size={20} /> Nova Consulta
            </button>
          )}
        </div>
      </div>

      {showTestPanel && (
        <div className="mb-12 border-4 border-amber-200 p-4 rounded-2xl bg-amber-50/30">
          <h2 className="text-xl font-bold text-amber-800 mb-2 flex items-center gap-2">
            <Search /> Modo de Teste (Visão do Cliente)
          </h2>
          <p className="text-amber-700 text-sm mb-4">
            Aqui em baixo pode ver como as consultas ativas aparecem para o cliente logado. 
            Como Admin, ao clicar em "Gerar PIX" poderá simular todo o fluxo de pagamento para verificar se as consultas são processadas.
          </p>
          <div className="bg-slate-100 p-2 rounded-xl">
            <ClientConsultationUpsell />
          </div>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow-md border mb-8">
          <h2 className="text-xl font-semibold mb-4">{formData.id ? 'Editar Consulta' : 'Nova Consulta'}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome da Consulta</label>
              <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Provedor API</label>
              <input type="text" required value={formData.api_provider || ''} onChange={e => setFormData({...formData, api_provider: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Input Requerido do Cliente</label>
              <select value={formData.required_input_type || 'none'} onChange={e => setFormData({...formData, required_input_type: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
                <option value="none">Nenhum</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="cpf_cnpj">CPF/CNPJ</option>
                <option value="placa">Placa Veicular</option>
                <option value="nome">Nome Completo</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Descrição</label>
              <textarea required value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" rows={2} />
            </div>

            {/* Bloco de Visibilidade - Adicionar dentro da tag <form> */}
            <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border mt-4">
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Visibilidade (Quem pode comprar esta consulta?)
              </label>
              <div className="flex flex-wrap gap-6">
                {[
                  { id: 'client', label: 'Clientes (Painel do Cliente)' },
                  { id: 'seller', label: 'Vendedores (Venda Direta)' },
                  { id: 'manager', label: 'Gestores' },
                  { id: 'admin', label: 'Administradores' }
                ].map((role) => (
                  <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={formData.visibility?.includes(role.id as any) || false}
                      onChange={(e) => {
                        const currentVis = formData.visibility || [];
                        const newVis = e.target.checked
                          ? [...currentVis, role.id]
                          : currentVis.filter(r => r !== role.id);
                        setFormData({ ...formData, visibility: newVis as any });
                      }}
                    />
                    <span className="text-sm text-gray-800 font-medium">{role.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Se desmarcar "Clientes", esta consulta desaparecerá da loja avulsa deles.
              </p>
            </div>
          </div>

          <h3 className="text-lg font-medium mb-3 mt-6 border-b pb-2 text-gray-800">Tabela de Preços e Repasses</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 p-3 rounded">
              <label className="block text-sm font-medium text-red-800">Custo Interno (R$)</label>
              <input type="number" step="0.01" required value={formData.internal_cost || 0} onChange={e => setFormData({...formData, internal_cost: parseFloat(e.target.value)})} className="mt-1 w-full border p-2 rounded" />
            </div>
            <div className="bg-yellow-50 p-3 rounded">
              <label className="block text-sm font-medium text-yellow-800">Valor para Gestor (R$)</label>
              <input type="number" step="0.01" required value={formData.manager_price || 0} onChange={e => setFormData({...formData, manager_price: parseFloat(e.target.value)})} className="mt-1 w-full border p-2 rounded" />
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <label className="block text-sm font-medium text-blue-800">Valor para Vendedor (R$)</label>
              <input type="number" step="0.01" required value={formData.seller_price || 0} onChange={e => setFormData({...formData, seller_price: parseFloat(e.target.value)})} className="mt-1 w-full border p-2 rounded" />
            </div>
            <div className="bg-green-50 p-3 rounded">
              <label className="block text-sm font-medium text-green-800">Preço Final Cliente (R$)</label>
              <input type="number" step="0.01" required value={formData.client_price || 0} onChange={e => setFormData({...formData, client_price: parseFloat(e.target.value)})} className="mt-1 w-full border p-2 rounded" />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar Consulta</button>
          </div>
        </form>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-4">Carregando...</td></tr>
              ) : types.map((type) => (
                <tr key={type.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{type.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-red-600">R$ {type.internal_cost.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-green-600 font-semibold">R$ {type.client_price.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => toggleActive(type)} className={`flex items-center gap-1 ${type.active ? 'text-green-600' : 'text-gray-400'}`}>
                      {type.active ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      {type.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => { setFormData(type); setIsEditing(true); }} className="text-indigo-600 hover:text-indigo-900 mr-4">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => type.id && handleDelete(type.id)} className="text-red-600 hover:text-red-900">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
