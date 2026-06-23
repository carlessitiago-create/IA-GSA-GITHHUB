// src/utils/tracking.ts

declare global {
  interface Window {
    fbq?: any;
    gtag?: any;
    ttq?: any;
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
  if (window.ttq) {
    window.ttq.track('InitiateCheckout', {
      contents: [{
        content_name: plano,
        price: preco,
        quantity: 1
      }],
      value: preco,
      currency: 'BRL'
    });
  }
};

// Dispara evento quando o lead preenche os dados e vai para o pagamento
export const trackLeadCapture = () => {
  try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead'); } catch(e){}
  try { if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead'); } catch(e){}
  try { if (window.ttq && typeof window.ttq.track === 'function') window.ttq.track('SubmitForm'); } catch(e){}
};

// Dispara quando o pagamento é processado (ou gerado o PIX)
export const trackPurchase = async (plano: string, preco: number) => {
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
  if (window.ttq) {
    window.ttq.track('CompletePayment', {
      contents: [{
        content_name: plano,
        price: preco,
        quantity: 1
      }],
      value: preco,
      currency: 'BRL'
    });
  }

  // Despacha Conversions API
  try {
    const { getSaasConfig } = await import('../services/configService');
    const saasConfig = await getSaasConfig();
    if (saasConfig?.meta_conversions_token) {
      const pixelId = saasConfig.facebook_pixel_id || 
                     (saasConfig.meta_pixel_code ? saasConfig.meta_pixel_code.match(/fbq\(['"]init['"],\s*['"]?(\d+)['"]?\)/)?.[1] : null);
      if (pixelId) {
        await fetch("/api/meta-conversions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pixelId,
            token: saasConfig.meta_conversions_token,
            eventName: 'Purchase',
            eventTime: Math.floor(Date.now() / 1000),
            userData: {},
            customData: {
              currency: 'BRL',
              value: preco
            }
          })
        }).catch(err => console.error("Erro na Conversions API via server", err));
      }
    }
  } catch (e) {
    console.error("Erro Meta CAPI (trackPurchase):", e);
  }
};
