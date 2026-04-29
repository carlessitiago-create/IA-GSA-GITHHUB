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

export const getConsultaOrigin = () => `https://consulta.${getBaseDomain()}`;
export const getIndicaOrigin = () => `https://indica.${getBaseDomain()}`;
export const getAppOrigin = () => {
  const hostname = window.location.hostname.toLowerCase();
  const sub = hostname.includes('aplicativo') ? 'aplicativo' : 'app';
  return `https://${sub}.${getBaseDomain()}`;
};
export const getDiagnosticoOrigin = () => `https://diagnostico.${getBaseDomain()}`;

export const getPublicOrigin = () => getConsultaOrigin();
