/**
 * Utility to get the public-facing origin for sharing links.
 * In the AI Studio Build environment, 'ais-dev-' origins are protected by authentication.
 * 'ais-pre-' origins are the public-facing versions.
 */
const getBaseDomain = () => {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('72h.online')) return '72h.online';
  return '72hrs.online';
};

export const getConsultaOrigin = () => {
    if (typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost'))) {
        return `${window.location.origin}/consulta`;
    }
    return `https://consulta.${getBaseDomain()}`;
};

export const getIndicaOrigin = () => {
    if (typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost'))) {
        return window.location.origin; // Will append ?ref= on usage
    }
    return `https://indica.${getBaseDomain()}`;
};

export const getAppOrigin = () => {
  if (typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost'))) {
      return window.location.origin;
  }
  const hostname = window.location.hostname.toLowerCase();
  const sub = hostname.includes('aplicativo') ? 'aplicativo' : 'app';
  return `https://${sub}.${getBaseDomain()}`;
};

export const getDiagnosticoOrigin = () => {
    if (typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost'))) {
        return `${window.location.origin}/diagnostico`;
    }
    return `https://diagnostico.${getBaseDomain()}`;
};

export const getPublicOrigin = () => {
    // If running in browser, return the current origin to ensure links work on the active domain
    if (typeof window !== 'undefined') return window.location.origin;
    return getConsultaOrigin();
};
