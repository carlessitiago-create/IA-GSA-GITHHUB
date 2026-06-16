import { useNavigate as useHookNavigate } from 'react-router-dom';

export const MAIN_DOMAINS = ['app.72hrs.online', '72hrs.online', '72h.online', 'app.72horas.online', '72horas.online'];

export const useSmartNavigate = () => {
  const navigate = useHookNavigate();
  const hostname = window.location.hostname.toLowerCase();

  const isAppDomain = hostname.startsWith('app.') || hostname.includes('localhost') || hostname.includes('ais-dev') || hostname.includes('ais-pre') || hostname.includes('run.app');
  const isPublicSubdomain = !isAppDomain;

  const smartNavigate = (targetPath: string, options?: { replace?: boolean }) => {
    // Rotas que DEVEM permanecer no subdomínio (Portal Público)
    // Adicionado log para rastrear a decisão de navegação
    console.log(`SmartNavigate: Navigating to ${targetPath} from ${hostname}`);

    const isPublicPath = targetPath === '/' || targetPath === '' || targetPath === '/consulta' || targetPath.startsWith('/cp/');
    
    // Se estivermos em um subdomínio público e a rota NÃO for pública, 
    // redirecionamos para o domínio principal via href.
    if (isPublicSubdomain && !isPublicPath && !targetPath.startsWith('http')) {
      const parts = hostname.split('.');
      
      // Lógica Inteligente para Domínio Base
      // Favorizamos 'app.' como o domínio de aplicação
      let targetDomain = MAIN_DOMAINS[0];
      
      const isRunApp = hostname.includes('run.app');
      if (isRunApp) {
        // No Cloud Run, mantemos o mesmo hostname para evitar quebra de fluxos de teste
        targetDomain = hostname;
      } else {
        // Encontra o domínio base (72hrs.online ou 72h.online)
        // Se já contiver 'app.', não adicionamos de novo
        if (hostname.includes('app.')) {
          targetDomain = hostname;
        } else {
          const baseItem = MAIN_DOMAINS.find(d => hostname.endsWith(d.replace('app.', ''))) || '72hrs.online';
          const cleanBase = baseItem.replace('app.', '');
          targetDomain = `app.${cleanBase}`;
        }
      }

      const protocol = window.location.protocol;
      let finalPath = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
      if (finalPath !== '/' && finalPath !== '') {
        finalPath = '/#' + finalPath;
      }
      const finalUrl = `${protocol}//${targetDomain}${finalPath}`;
      
      console.log(`SmartNavigate: [REDIRECTING] ${hostname} -> ${finalUrl}`);
      
      // Feedback visual antes de redirecionar
      try {
        window.location.assign(finalUrl);
      } catch (err) {
        console.error("Redirection error:", err);
        window.location.href = finalUrl;
      }
      return;
    }

    // Se estivermos no domínio principal e formos para uma rota pública conhecida, 
    // poderíamos opcionalmente mandar para o subdomínio, mas por ora vamos deixar o SPA lidar.
    console.log(`SmartNavigate: [SPA] Navigating internally to ${targetPath}`);
    navigate(targetPath, options);
  };

  return smartNavigate;
};
