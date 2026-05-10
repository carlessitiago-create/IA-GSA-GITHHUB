import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateConsultationPDF = (consultationName: string, resultData: any, clientName: string = 'Cliente GSA') => {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString('pt-BR');
  const time = new Date().toLocaleTimeString('pt-BR');

  // Cabeçalho - Identidade Visual GSA
  doc.setFillColor(30, 58, 138); // Azul escuro (Tailwind blue-900)
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text('GSA Diagnóstico', 14, 25);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text('Relatório Oficial de Consulta', 150, 20);
  doc.text(`Data: ${date} às ${time}`, 150, 26);

  // Título da Consulta
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(consultationName.toUpperCase(), 14, 55);

  // Dados do Solicitante
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Solicitado por: ${clientName}`, 14, 65);
  doc.text(`Documento gerado eletronicamente pela plataforma GSA.`, 14, 70);

  // Transformar o JSON do resultado em um array para a tabela
  const tableBody = Object.entries(resultData).map(([key, value]) => {
    // Formatar a chave (ex: historico_roubo_furto -> Historico Roubo Furto)
    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const formattedValue = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value);
    return [formattedKey, formattedValue];
  });

  // Tabela de Resultados
  autoTable(doc, {
    startY: 80,
    head: [['Campo Verificado', 'Resultado Oficial']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] }, // Azul padrão GSA
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { cellWidth: 'auto' }
    }
  });

  // Rodapé
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `GSA Grupo Soluções e Associados da Serra Gaúcha - Caxias do Sul / RS | Página ${i} de ${pageCount}`,
      105,
      285,
      { align: 'center' }
    );
  }

  // Descarregar o PDF
  doc.save(`GSA_Consulta_${consultationName.replace(/\s+/g, '_')}.pdf`);
};
