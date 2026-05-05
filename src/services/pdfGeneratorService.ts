import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FIELD_LABELS, DOCUMENT_LABELS } from "../constants/processRequirements";

export const gerarDocumentoProcesso = (processo: any, cliente: any, modelo: any) => {
  const doc = new jsPDF();
  const corPrimaria = "#0a0a2e"; // Azul Marinho GSA

  // --- CABEÇALHO ---
  doc.setFillColor(corPrimaria);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("GSA IA - SISTEMA DE GESTÃO", 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`FICHA TÉCNICA: ${modelo?.nome?.toUpperCase() || processo.servico_nome?.toUpperCase() || 'PROCESSO'}`, 105, 25, { align: "center" });

  // --- DADOS DO CLIENTE ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1. INFORMAÇÕES DO CLIENTE E SERVIÇO", 15, 45);
  
  // Campos do modelo ou do processo
  const camposParaExibir = modelo?.campos || processo.dados_faltantes || [];
  
  const dadosTabela = camposParaExibir.map((key: string) => {
    const value = cliente[key] || processo[key];
    return [
      (FIELD_LABELS[key] || key.replace(/_/g, ' ')).toUpperCase(),
      value ? value : "PENDENTE DE PREENCHIMENTO"
    ];
  });

  // Adicionar dados básicos se não estiverem na lista
  if (!camposParaExibir.includes('servico')) dadosTabela.unshift(['SERVIÇO CONTRATADO', processo.servico_nome || 'Não informado']);
  if (!camposParaExibir.includes('nome')) dadosTabela.unshift(['NOME', cliente.nome || processo.cliente_nome || "PENDENTE DE PREENCHIMENTO"]);
  if (!camposParaExibir.includes('documento')) dadosTabela.unshift(['CPF/CNPJ', cliente.documento || processo.cliente_cpf_cnpj || "PENDENTE DE PREENCHIMENTO"]);

  autoTable(doc, {
    startY: 50,
    head: [['Campo', 'Informação']],
    body: dadosTabela,
    theme: 'striped',
    headStyles: { fillColor: corPrimaria, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    willDrawCell: (data) => {
      if (data.cell.raw === "PENDENTE DE PREENCHIMENTO") {
        doc.setTextColor(220, 38, 38); // Text color red for Pendente
        data.cell.styles.textColor = [220, 38, 38];
      }
    }
  });

  // --- CHECKLIST DE DOCUMENTOS ---
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("2. DOCUMENTAÇÕES EXIGIDAS", 15, finalY);

  const documentosParaExibir = modelo?.documentos || processo.pendencias_iniciais || [];
  const docsEnviados = processo.documentos_enviados || [];

  const docsTabela = documentosParaExibir.map((d: string) => [
    (DOCUMENT_LABELS[d] || d).toUpperCase(),
    docsEnviados.includes(d) ? "CONCLUÍDO (ENVIADO)" : "FALTANTE (PENDENTE)"
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Documentação Exigida', 'Status de Entrega']],
    body: docsTabela,
    theme: 'grid',
    headStyles: { fillColor: "#10b981", textColor: [255, 255, 255] }, // Verde para documentos
    willDrawCell: (data) => {
      if (data.cell.raw === "FALTANTE (PENDENTE)") {
        data.cell.styles.textColor = [220, 38, 38];
      } else if (data.cell.raw === "CONCLUÍDO (ENVIADO)") {
        data.cell.styles.textColor = [5, 150, 105];
      }
    }
  });

  // --- RODAPÉ ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado em ${new Date().toLocaleString()} - GSA IA`, 105, 285, { align: "center" });
    doc.text(`Página ${i} de ${pageCount}`, 190, 285, { align: "right" });
  }

  // Download automático
  const fileName = `FICHA_${(processo.servico_nome || 'PROCESSO').replace(/\s+/g, '_')}_${(cliente.nome || 'CLIENTE').replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};
