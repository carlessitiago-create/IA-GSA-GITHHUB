// src/utils/tracking.ts

declare global {
  interface Window {
    fbq?: any;
    gtag?: any;
  }
}

// Dispara evento quando o lead abre o formulário
export const trackInitiateCheckout = (plano: string, preco: number) => {
  if (window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      content_name: plano,
      value: preco,
      currency: 'BRL'
    });
  }
  if (window.gtag) {
    window.gtag('event', 'begin_checkout', {
      items: [{ item_name: plano, price: preco }]
    });
  }
};

// Dispara evento quando o lead preenche os dados e vai para o pagamento
export const trackLeadCapture = () => {
  if (window.fbq) window.fbq('track', 'Lead');
  if (window.gtag) window.gtag('event', 'generate_lead');
};

// Dispara quando o pagamento é processado (ou gerado o PIX)
export const trackPurchase = (plano: string, preco: number) => {
  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      content_name: plano,
      value: preco,
      currency: 'BRL'
    });
  }
  if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: `T_${Date.now()}`,
      value: preco,
      currency: 'BRL',
      items: [{ item_name: plano, price: preco }]
    });
  }
};
