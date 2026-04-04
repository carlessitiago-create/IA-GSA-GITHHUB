/**
 * Utility to get the public-facing origin for sharing links.
 * In the AI Studio Build environment, 'ais-dev-' origins are protected by authentication.
 * 'ais-pre-' origins are the public-facing versions.
 */
export const getPublicOrigin = () => {
  const origin = window.location.origin;
  
  // If we are in the AI Studio Build dev environment, replace dev prefix with pre (preview) prefix
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }
  
  return origin;
};
