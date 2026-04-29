import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const generateProcessPdf = (processo: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Header
  doc.setFillColor(10, 10, 46); // #0a0a2e
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('GSA IA - RELATÓRIO DE PROCESSO', margin, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Protocolo: ${processo.protocolo || 'N/A'}`, pageWidth - margin - 50, 25);

  // Body
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Informações do Cliente', margin, 55);
  
  autoTable(doc, {
    startY: 60,
    margin: { left: margin },
    theme: 'striped',
    headStyles: { fillColor: [10, 10, 46] },
    body: [
      ['Nome Completo', processo.cliente_nome || 'N/A'],
      ['CPF/CNPJ', processo.cliente_cpf || 'N/A'],
      ['Data de Nascimento', processo.cliente_data_nascimento || 'N/A'],
      ['E-mail', processo.cliente_email || 'N/A'],
      ['Telefone', processo.cliente_telefone || 'N/A'],
    ],
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhes do Processo', margin, finalY);

  autoTable(doc, {
    startY: finalY + 5,
    margin: { left: margin },
    theme: 'grid',
    headStyles: { fillColor: [10, 10, 46] },
    body: [
      ['Serviço', processo.servico_nome || 'N/A'],
      ['Status Atual', processo.status_atual || 'N/A'],
      ['Data de Início', processo.data_venda ? format(processo.data_venda.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'],
      ['Prazo Estimado', `${processo.prazo_estimado_dias || 7} Dias Úteis`],
      ['Consultor Responsável', processo.vendedor_nome || 'Equipe GSA'],
    ],
  });

  const finalY2 = (doc as any).lastAutoTable.finalY + 15;

  if (processo.historico_status && processo.historico_status.length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Histórico de Atualizações', margin, finalY2);

    autoTable(doc, {
      startY: finalY2 + 5,
      margin: { left: margin },
      theme: 'striped',
      headStyles: { fillColor: [10, 10, 46] },
      head: [['Data', 'Status', 'Observação']],
      body: processo.historico_status.map((h: any) => [
        format(new Date(h.data), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        h.status,
        h.observacao || '-'
      ]),
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - GSA IA - Gestão e Processos`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin - 20,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  doc.save(`processo_${processo.protocolo || 'gsa'}.pdf`);
};
