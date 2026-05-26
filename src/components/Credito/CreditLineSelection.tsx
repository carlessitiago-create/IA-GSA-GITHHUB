import React, { useState } from 'react';
import { Landmark, Building2, Receipt, Home, Link as LinkIcon, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

const creditLines = [
  {
    id: 'fungetur',
    title: 'FUNGETUR 2026',
    description: 'Foco em turismo, juros de ~0,75%/mês, carência de até 5 anos.',
    icon: Landmark,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  },
  {
    id: 'bndes',
    title: 'BNDES Pequenas Empresas',
    description: 'Capital de giro para comércio e indústria geral com taxas subsidiadas.',
    icon: Building2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100'
  },
  {
    id: 'recebiveis',
    title: 'Antecipação de Recebíveis',
    description: 'Solução rápida para fluxo de caixa imediato utilizando notas fiscais futuras.',
    icon: Receipt,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
  },
  {
    id: 'garantia',
    title: 'Crédito com Garantia Real',
    description: 'Maiores volumes utilizando ativos da empresa ou dos sócios (Home/Auto Equity).',
    icon: Home,
    color: 'text-amber-600',
    bg: 'bg-amber-100'
  }
];

export const CreditLineSelection: React.FC = () => {
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const isSalesRole = profile?.nivel === 'VENDEDOR' || profile?.nivel === 'GESTOR' || profile?.nivel === 'ADM_GERENTE' || profile?.nivel === 'ADM_MASTER';

  const getInternalLink = () => {
    return `/credito?ref=${profile?.uid}&linha=${selectedLine}`;
  };

  const getExternalLink = () => {
    const basePath = window.location.origin;
    return `${basePath}${getInternalLink()}`;
  };
  
  const handleCopyLink = () => {
    if (!selectedLine || !profile?.uid) return;
    
    navigator.clipboard.writeText(getExternalLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Selecione a Linha de Crédito</h3>
        <p className="text-slate-500">Escolha a opção ideal para gerar o seu link de indicação ou solicitar a sua análise.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {creditLines.map((line) => {
          const Icon = line.icon;
          const isSelected = selectedLine === line.id;
          
          return (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={line.id}
              onClick={() => setSelectedLine(line.id)}
              className={`cursor-pointer border-2 rounded-2xl p-5 transition-all duration-200 ${
                isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${line.bg}`}>
                  <Icon className={`w-6 h-6 ${line.color}`} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{line.title}</h4>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">{line.description}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedLine && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-4 flex flex-col sm:flex-row gap-4"
          >
            {isSalesRole && (
              <button 
                onClick={handleCopyLink}
                className={`flex-1 flex justify-center items-center gap-2 font-semibold py-3 px-6 rounded-xl transition-colors ${
                  copied 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Link Copiado!
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-5 h-5" />
                    Copiar Link de Indicação
                  </>
                )}
              </button>
            )}
            
            <button 
              onClick={() => navigate(getInternalLink())}
              className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                isSalesRole 
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isSalesRole ? (
                <>
                  <ExternalLink className="w-5 h-5" />
                  Testar / Venda Manual
                </>
              ) : (
                <>
                  Continuar com {creditLines.find(l => l.id === selectedLine)?.title}
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
