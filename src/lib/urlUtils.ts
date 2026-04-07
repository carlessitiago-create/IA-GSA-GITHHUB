/**
 * Utility to get the public-facing origin for sharing links.
 * In the AI Studio Build environment, 'ais-dev-' origins are protected by authentication.
 * 'ais-pre-' origins are the public-facing versions.
 */
export const getPublicOrigin = () => {
  // Check for a custom domain override in environment variables
  const customDomain = import.meta.env.VITE_CUSTOM_DOMAIN;
  if (customDomain) {
    // Ensure it has a protocol
    return customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
  }

  const origin = window.location.origin;
  
  // If we are in the AI Studio Build dev environment, replace dev prefix with pre (preview) prefix
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }
  
  return origin;
};
