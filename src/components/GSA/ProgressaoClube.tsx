// src/components/GSA/ProgressaoClube.tsx
import React from 'react';
import { motion } from 'motion/react'; 

interface ProgressaoClubeProps {
  pontosAtuais: number;
}

export const ProgressaoClube: React.FC<ProgressaoClubeProps> = ({ pontosAtuais }) => {
  // 1. Lógica para definir os níveis, metas e base do nível
  let nivel = "Bronze";
  let proximoNivel = "Prata";
  let meta = 500;
  let minPontos = 0;

  if (pontosAtuais > 500 && pontosAtuais <= 1500) {
    nivel = "Prata";
    proximoNivel = "Ouro";
    meta = 1500;
    minPontos = 500;
  } else if (pontosAtuais > 1500) {
    nivel = "Ouro";
    proximoNivel = "Diamante";
    meta = 3000; 
    minPontos = 1500;
  }

  // 2. Cálculo da porcentagem da barra de progresso
  const progressoNoNivelAtual = pontosAtuais - minPontos; // Pontos ganhos só neste nível
  const pontosTotaisDoNivel = meta - minPontos; // Quantidade de pontos de uma ponta a outra do nível
  
  // Impede que a porcentagem passe de 100% visualmente
  const porcentagem = Math.min((progressoNoNivelAtual / pontosTotaisDoNivel) * 100, 100);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md">
      {/* Cabeçalho do Card */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Nível Atual</p>
          <h3 className="text-2xl font-bold text-indigo-600">{nivel}</h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold text-gray-800">{pontosAtuais}</p>
          <p className="text-xs text-gray-500 font-medium">PONTOS TOTAIS</p>
        </div>
      </div>

      {/* 3. Container da Barra de Progresso */}
      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden mt-5 relative shadow-inner">
        {/* Barra Preenchida com Animação (Motion) */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${porcentagem}%` }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
        />
      </div>

      {/* Rodapé Informativo */}
      <div className="mt-4 text-sm text-gray-600 flex justify-between items-center">
        <span>
          Faltam <strong className="text-purple-600">{meta - pontosAtuais} pontos</strong> para o nível {proximoNivel}!
        </span>
        <span className="text-xs font-semibold text-gray-400">{meta} PTS</span>
      </div>
    </div>
  );
};
