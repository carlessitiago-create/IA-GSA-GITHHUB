# GSA App

## Executar localmente

### Pré-requisitos:
- Node.js (versão 18 ou superior)

### Passo a passo:

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configuração de Variáveis de Ambiente:**
   Crie um arquivo `.env.local` na raiz do projeto (ou copie o `.env.example`) e defina a sua chave de API do Gemini, além de outras variáveis de ambiente se necessário:
   ```env
   GEMINI_API_KEY=sua_chave_de_api_aqui
   ```

3. **Execute o aplicativo:**
   ```bash
   npm run dev
   ```

Isso iniciará o servidor de desenvolvimento localmente, o qual você poderá visualizar no seu navegador (geralmente em `http://localhost:3000` ou similar).
