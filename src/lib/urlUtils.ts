/**
 * Utility to get the public-facing origin for sharing links.
 * In the AI Studio Build environment, 'ais-dev-' origins are protected by authentication.
 * 'ais-pre-' origins are the public-facing versions.
 */
export const getPublicOrigin = () => {
  // Check for a custom domain override in environment variables
  const customDomain = import.meta.env.VITE_CUSTOM_DOMAIN || '72hrs.online';
  
  // Ensure it has a protocol
  return customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
};

/**
 * Utility to get the dedicated SaaS diagnostic domain.
 */
export const getSaasOrigin = () => {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('72h.online')) {
    return 'https://diagnostico.72h.online';
  }
  return 'https://diagnostico.72hrs.online';
};
