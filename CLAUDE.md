# CLAUDE.md — Instruções Permanentes para este Projeto

## Padrão de Criação Base (aplicar SEMPRE, implicitamente)

Toda entrega criativa, estratégica ou técnica deve seguir este processo — sem que o Maxwel precise pedir:

### 1. Diagnóstico primeiro
Antes de propor qualquer coisa, extrair o estado real atual:
- Capturar/ler o que existe (screenshots, arquivos, código)
- Identificar o que está funcionando e o que está faltando
- Nunca propor sem entender o ponto de partida

### 2. Ancoragem dupla
Qualquer proposta deve ser ancorada em:
- **Setor/domínio**: faz sentido para construção civil, engenharia, operacional?
- **ICP do decisor**: eleva valor percebido para o gestor PME que decide pelo olho?

### 3. Entrega em camadas de decisão
Estruturar para que o Maxwel decida com confiança — não só "gostei":
- *Como fica?* → visual, mockup, código
- *O que é exatamente?* → especificação, detalhes técnicos
- *Vale a pena?* → argumento estratégico, impacto no negócio

### 4. Nunca genérico
Toda escolha deve ser justificável pelo contexto do Maxwel, do produto e do cliente. "É o padrão do mercado" não é justificativa suficiente.

---

## Contexto do Projeto

**Produto**: Cautelix (nome comercial decidido; nome técnico anterior "Cautela de Ferramentas") — SaaS de controle de kits/ferramentas de obra. Domínio cautelix.com.br e Instagram @cautelixoficial já garantidos.  
**Vendedor**: MindMax Tecnologia (Maxwel)  
**Cliente ativo**: Markat Engenharia / GP Santos → cautela.grupomarkat.com.br  
**Ticket**: R$497/mês  

**Stack técnica**:
- Backend: Node.js + Express (`server.js`)
- Banco: SQLite via better-sqlite3, volume Railway em `/app/data/ferramentas.db`
- Frontend: React 18 SPA, Babel Standalone, arquivo único `public/index.html`
- Auth: JWT, bcryptjs, 3 roles: `almoxarifado`, `lider`, `operario`
- Deploy: Railway + domínio customizado
- Backup: node-cron diário às 02:00

## ICP do Produto (cliente-alvo para expansão)
- Dono ou gerente de construtora PME
- 35–55 anos, decide pelo olho antes de analisar features
- Primeiro contato frequentemente pelo celular
- Preocupação central: responsabilização financeira e rastreabilidade
- Resistência a sistemas que parecem planilha ou amadores

## Paleta Atual — "Aço & Prata" (decidida e implementada)
Confirmada em produção em `public/index.html` (`:root`), esta é a paleta oficial do produto e da marca Cautelix — usar em qualquer material novo (site, apresentações, documentos).
- Base: `#1A2535` (primary) / `#2E3F55` (primary-light) | Prata: `#8A9BB0` / `#C4CDD8`
- Fundo: `#E8ECF0` | Cards: `#F6F8FA` | Borda: `#C4CDD8`
- Accent aço azulado: `#4A90A4` (primary-accent, usado em botões primários/links) | CTA cobre premium: `#A07C4E` / hover `#8B6B3D` (accent, usado em botões de destaque)
- Sucesso: `#2E7D6B` | Perigo: `#7A2E2E` | Alerta: `#B8860B`
- Texto: `#0F1820` | Texto secundário: `#6B7B8F`

Paleta antiga (azul `#1B2D45`/`#F59E0B`) foi substituída — não usar mais em material novo.
