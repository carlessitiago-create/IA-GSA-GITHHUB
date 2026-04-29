// src/hooks/useProcessModels.ts

import { useState, useEffect } from 'react';
import { ProcessModel, listarModelosProcesso } from '../services/modelService';
import { PROCESS_REQUIREMENTS } from '../constants/processRequirements';

export function useProcessModels() {
  const [models, setModels] = useState<Record<string, ProcessModel>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await listarModelosProcesso();
        const modelsMap: Record<string, ProcessModel> = {};
        
        // Preencher com dados do banco
        data.forEach(m => {
          modelsMap[m.id] = m;
        });

        // Garantir que temos fallbacks para os IDs conhecidos se não estiverem no banco
        Object.keys(PROCESS_REQUIREMENTS).forEach(id => {
          if (!modelsMap[id]) {
            modelsMap[id] = {
              id,
              nome: id.replace(/_/g, ' '),
              campos: PROCESS_REQUIREMENTS[id].campos,
              documentos: PROCESS_REQUIREMENTS[id].documentos
            };
          }
        });

        setModels(modelsMap);
      } catch (error) {
        console.error("Erro ao carregar modelos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  return { models, loading };
}
