# 🚀 Guia de Integração e Deploy Integrado (Hostinger + Cloud Run + Firebase + GitHub)

Este guia detalha exatamente como configurar e corrigir a sua infraestrutura híbrida. Como você utiliza **Hostinger**, **Cloud Run**, **Firebase** e **GitHub**, vamos estruturar o deploy do seu ecossistema para que tudo funcione de forma integrada e sem erros de rota (como o erro 404 ao atualizar a página `/login`).

---

## 🔍 Entendendo o problema das rotas 404 na Hostinger
Por ser uma aplicação **SPA (Single-Page Application)**, o React controla as rotas no navegador via JS. Quando você acessa `https://app.72hrs.online/` e navega até `/login`, tudo funciona. No entanto, se você atualizar a página `/login` ou colar o link diretamente no navegador, a **Hostinger (que usa Apache/LiteSpeed)** tenta procurar uma pasta física chamada `/login` dentro do servidor, não a encontra e retorna **404 NOT FOUND**.

### 🛠️ Solução Aplicada
Já criamos para você o arquivo `/public/.htaccess`. Toda vez que você executar o build (`npm run build`), o Vite copiará automaticamente este arquivo para a pasta `dist/`. Ele instrui o Apache/Hostinger a redirecionar todas as rotas internas de volta para o `index.html`, permitindo que o React Router processe a página `/login` e demais caminhos perfeitamente, eliminando os erros 404!

---

## 🏗️ Duas Estratégias de Arquitetura para seu Projeto
Como você tem um servidor Express (`server.ts`) rodando no **Cloud Run** e a hospedagem na **Hostinger**, você pode optar por duas estratégias de deploy:

### Estratégia A: Apontar o domínio da Hostinger para o Cloud Run via DNS (Altamente Recomendada ⭐)
Em vez de subir arquivos estáticos via FTP para a Hostinger, você faz o deploy do container da aplicação completa no **Cloud Run** e apenas cria um **apontamento CNAME ou Custom Domain** na Hostinger direcionando para o Cloud Run.
- **Vantagem:** O servidor Node (`server.ts`) gerencia tanto as APIs `/api/*` quanto entrega os arquivos do frontend. Você evita problemas de CORS e não precisa de transferências via FTP.
- **Como configurar na Hostinger:** Vá em **Editor de Zona DNS**, crie um registro do tipo `CNAME` para o seu subdomínio (ex: `app`) apontando para o endereço fornecido pelo Google Cloud Run, ou use as instruções de domínio personalizado do Cloud Run no console do GCP.

---

### Estratégia B: Pipeline Híbrida (Frontend na Hostinger + Backend no Cloud Run)
Se você quer o Frontend estático rodando nos servidores da Hostinger e as APIs rodando no Cloud Run:

#### 1. Sincronização Automática via GitHub Actions (Criado com Sucesso!)
Criamos o arquivo `.github/workflows/deploy.yml`. Toda vez que você realizar um `git push` para a branch `main`, o GitHub compilará os arquivos da sua aplicação com Vite e fará o upload limpo para a Hostinger via FTP.

Para ativar esta automação, acesse as configurações do seu repositório no GitHub (**Settings > Secrets and variables > Actions**) e adicione os seguintes segredos (Secrets):

| Nome do Segredo | Descrição | Exemplo |
| :--- | :--- | :--- |
| `FTP_SERVER` | Endereço do host FTP da sua Hostinger | `ftp.seudominio.com` ou o IP do servidor |
| `FTP_USERNAME` | Seu usuário do FTP criado no painel Hostinger | `u123456789@access.hostinger.com` |
| `FTP_PASSWORD` | Senha da conta FTP | `MinhaSenhaSegura123` |
| `FTP_PORT` | Porta de conexão (Opcional - padrão é 21) | `21` |
| `FTP_TARGET_DIR` | Pasta de destino dentro da Hostinger | `public_html` ou `public_html/app` |

---

## ⚡ Conectando o Frontend Hostinger com as APIs do Cloud Run
Se você optar pela **Estratégia B (Híbrida)**, as chamadas de API no frontend (que hoje usam rotas relativas `/api/...`) precisam buscar o endpoint correto do Cloud Run. 

### Como configurar a URL da API no build do GitHub Actions:
Adicione o segredo `VITE_API_URL` no seu repositório GitHub para apontar para a sua instância do Cloud Run. 
* Exemplo: `VITE_API_URL=https://meu-servico-cloud-run-xyz.a.run.app`

O nosso script do GitHub Actions já está configurado para ler essa variável e injetá-la no build final do Vite de maneira otimizada!

---

## ✅ Resumo do Trabalho Realizado
1. **Remoção de Arquivos Residência**: O arquivo temporário `vercel.json` foi removido para manter o repositório limpo, respeitando sua infraestrutura exclusiva da Hostinger.
2. **Criação do `.htaccess` de Produção**: Configurado em `/public/.htaccess` para resolver definitivamente os problemas de roteamento e erros 404 durante recarregamento de páginas na Hostinger.
3. **Criação do Workflow de Integração Contínua**: O arquivo de workflow GitHub Actions em `.github/workflows/deploy.yml` foi adicionado para realizar builds automáticos e deploy na Hostinger sempre que você realizar atualizações no repositório.
