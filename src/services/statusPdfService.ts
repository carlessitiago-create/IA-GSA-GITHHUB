import { jsPDF } from "jspdf";

export const gerarRelatorioStatus = (processo: any, whatsappCobranca: string = "") => {
  const doc = new jsPDF();
  const isAtrasado = processo.status_financeiro === 'VENCIDO' && (processo.dias_atraso || 0) > 10;
  const corTopo = isAtrasado ? "#e11d48" : "#0a0a2e"; // Vermelho (Atraso) ou Azul (Normal)

  // --- CABEÇALHO ---
  doc.setFillColor(corTopo);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(isAtrasado ? "NOTIFICAÇÃO EXTRAJUDICIAL" : "RELATÓRIO DE STATUS", 105, 25, { align: "center" });

  // --- CORPO ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  let y = 55;
  doc.text(`Protocolo: ${processo.protocolo}`, 20, y);
  y += 10;
  doc.text(`Cliente: ${processo.cliente_nome || 'N/A'}`, 20, y);
  y += 10;
  doc.text(`Serviço: ${processo.servico_nome}`, 20, y);
  y += 10;
  doc.text(`Status Atual: ${processo.status_atual}`, 20, y);
  y += 20;

  if (isAtrasado) {
    doc.setTextColor(225, 29, 72);
    doc.setFont("helvetica", "bold");
    doc.text("AVISO DE INADIMPLÊNCIA E SUSPENSÃO", 20, y);
    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    const msg = `Identificamos um atraso de ${processo.dias_atraso} dias no pagamento dos honorários deste processo. Informamos que, conforme contrato, o processamento foi SUSPENSO e o seu CPF/CNPJ poderá ser encaminhado aos órgãos de proteção ao crédito (SPC/SERASA) em 48h caso não haja regularização.`;
    const splitMsg = doc.splitTextToSize(msg, 170);
    doc.text(splitMsg, 20, y);
    y += 30;
    doc.text("Para evitar medidas judiciais, entre em contato agora:", 20, y);
    y += 10;
    doc.setTextColor(10, 10, 46);
    doc.text(`WhatsApp de Negociação: ${whatsappCobranca}`, 20, y);
  } else {
    doc.text("Seu processo está seguindo o fluxo normal de análise.", 20, y);
    y += 10;
    doc.text("Continue acompanhando pelo portal do cliente.", 20, y);
  }

  // --- RODAPÉ ---
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em: ${new Date().toLocaleString()}`, 105, 285, { align: "center" });

  doc.save(`${isAtrasado ? 'NOTIFICACAO' : 'STATUS'}_${processo.protocolo}.pdf`);
};
