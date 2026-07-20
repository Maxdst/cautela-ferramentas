# ESTADO DO PROJETO — Cautelix (handoff entre conversas)

> Leia este arquivo no início de uma conversa nova para retomar o contexto sem
> arrastar o histórico inteiro. Mantido por Claude + Maxwel. Atualize ao concluir marcos.

## O que é
**Cautelix** — SaaS de controle de cautela de ferramentas de obra (construção civil).
Vendido pela **MindMax (Maxwel)**. Cliente ativo: **Markat Engenharia**.
- **Produção:** https://cautela.grupomarkat.com.br  (rodando, saudável)
- Stack: Node/Express + `server.js` · SQLite (better-sqlite3) · React 18 SPA em arquivo
  único `public/index.html` (Babel no navegador) · JWT · PWA (`public/sw.js`).
- Papéis: `almoxarifado`, `lider`, `operario` + flag **`is_master`** (super-admin).

## ⚠️ COMO O DEPLOY FUNCIONA (crítico — não é o padrão)
- O Railway **NÃO está conectado ao GitHub**. Deploy é manual via **CLI**:
  `railway up --detach --service cautela-ferramentas` (a partir da pasta do projeto).
- Fazer merge/push na `main` **não** publica nada sozinho. `main` = fonte, mas quem
  publica é o `railway up`. Verificar deploy: `curl` no site e procurar marcadores no HTML.
- Build roda no Linux do Railway (o `better-sqlite3` compila lá; **localmente não compila**
  nesta máquina Windows — falta Python/build tools). Por isso não dá pra rodar o app
  completo localmente; validação local = `node --check server.js` + Babel no navegador
  (servir `public/` e checar console).
- Zero-downtime: se o build falha, o Railway mantém a versão atual (healthcheck `/health`).
- Reverter: aba Implantações do Railway → redeploy da versão anterior; ou `git revert` + `railway up`.

## ⚠️ RISCO DE NEGÓCIO ABERTO
- Conta Railway em **TRIAL** (~US$ 4,83 / ~14 dias na última verificação). Se o crédito
  acabar, **o site do cliente sai do ar**. Resolver o plano é prioridade — decisão do Maxwel.

## Administrador master
- Conta: **adm@mindmax.com.br** (papel `almoxarifado` + `is_master=1`). Seed em `server.js`
  (`ADMIN_MASTER`), senha temporária `trocar123` **já trocada pelo Maxwel** (não temos a senha).
- Exclusivo do master: excluir ferramentas, ver cards financeiros do painel, botões
  Backup/Zerar (Auditoria). Blindado: invisível na lista de usuários do cliente e não
  editável por não-master (backend `requireMaster` + filtros).
- **Testes logado com dados reais dependem do Maxwel** (não manuseamos a senha dele).

## Design system "Aço & Prata" (padrão de portfólio)
- Paleta oficial no `CLAUDE.md` (`:root` do index.html). Metalizado **claro** (legível sob
  sol em campo — dark seria errado pro ICP).
- **Modelo reutilizável (alavancagem):** componentes `ListaAcordeao` + `PainelEdicao` em
  `public/index.html`. Lista compacta + edição em acordeão inline. Usados em Ferramentas e
  Usuários. Mudar o padrão = editar a peça, não cada tela.
- Tabelas viram cartões no mobile via classe `cards-mobile` (regra `:has(td[colspan])`
  evita cartão-dentro-de-cartão no estado vazio).

## Estoque × solicitações (modelo de disponibilidade)
- Disponibilidade é **calculada**, nunca armazenada:
  `disponivel = quantidade_total − reservado(solicitação 'solicitada'/'separando')
  − fora(cautela 'aguardando_retirada'/'ativa')`.
- Helpers em `server.js`: `qtdReservada`, `qtdDisponivel`, `erroDisponibilidade`.
  `GET /api/ferramentas` devolve `quantidade_disponivel` por item.
- Validação de estoque em todos os pontos de entrada (solicitação líder, por-operário,
  cautela direta, editar itens em separação, guarda no `pronta`).
- Frontend: `ItemsEditor` e "Solicitar por Operário" mostram "N disp.", limitam quantidade
  e permitem remover itens sem estoque (bolsa expande em lista editável + "Remover indisponíveis").

## Roadmap "simbiose" (do doc estratégico, ainda não implementado)
1. Resolver plano Railway (decisão Maxwel) — mais urgente.
2. Formalizar `DESIGN.md` (paleta + componentes reutilizáveis).
3. Criar subagente `.claude/agents/guardiao-design.md` (Guardião do Design System).
4. Traduzir os outros agentes do Maxwel (requisitos/oferta/pricing/onboarding) para
   subagentes/skills reais — os JSON do Gemini eram "Tools", não "Skills".
5. Provar a esteira no 2º produto de turnaround.

## Como validar um deploy (padrão que usamos)
1. `railway up --detach --service cautela-ferramentas`
2. Poll: `curl -s https://cautela.grupomarkat.com.br/ | grep <marcador da mudança>`
3. `curl` em `/health` (espera 200) e no site (espera 200).
4. Confirmar teor logado é com o Maxwel (sem credenciais).

## Últimos commits (branch main)
- `0db77f9` solicitar por operário — bolsa vira lista editável (não trava)
- `4e7bbef` estoque conectado a solicitações/cautelas (baixa e validação)
- `32ae93e` modelo de lista reutilizável, cache SW v3, admin master-only
- `6eab655` ferramentas — edição em acordeão inline
- `e4af773` administrador master + lista de ferramentas com gaveta
