/**
 * Utility to get the public-facing origin for sharing links.
 * In the AI Studio Build environment, 'ais-dev-' origins are protected by authentication.
 * 'ais-pre-' origins are the public-facing versions.
 */
export const getConsultaOrigin = () => 'https://consulta.72hrs.online';
export const getIndicaOrigin = () => 'https://indica.72hrs.online';
export const getAppOrigin = () => 'https://app.72hrs.online';
export const getDiagnosticoOrigin = () => 'https://diagnostico.72hrs.online';

export const getPublicOrigin = () => getConsultaOrigin();
