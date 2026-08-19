# ESTADO DO PROJETO — Cautelix (handoff entre conversas)

> Leia este arquivo no início de uma conversa nova para retomar o contexto sem
> arrastar o histórico inteiro. Mantido por Claude + Maxwel. Atualize ao concluir marcos.

## ⏰ PRÓXIMA AÇÃO (retomar por aqui — 2026-08-19)
Módulo **Diretor/Kanban está EM PRODUÇÃO** (deploy do dia 19/08 pela `main`, SW v6, `/health` 200).
Faltam só **passos operacionais no app** (não é deploy):
1. **Atribuir cada obra a um líder:** aba **Obras** → abrir a obra → campo **"Líder responsável"** → Salvar.
   Enquanto não fizer, os líderes veem a lista de obras vazia (esperado do modelo novo).
2. **Teste logado com dados reais:** papel `diretor`, Kanban de obras, mover colaborador entre obras.
Deploy daqui pra frente = **`git push` na `main`** (auto-deploy do Railway). NÃO usar `railway up`
(trava com "os error 5" no Windows). Detalhes na seção "COMO O DEPLOY FUNCIONA".

## O que é
**Cautelix** — SaaS de controle de cautela de ferramentas de obra (construção civil).
Vendido pela **MindMax (Maxwel)**. Cliente ativo: **Markat Engenharia**.
- **Produção:** https://cautela.grupomarkat.com.br  (rodando, saudável)
- Stack: Node/Express + `server.js` · SQLite (better-sqlite3) · React 18 SPA em arquivo
  único `public/index.html` (Babel no navegador) · JWT · PWA (`public/sw.js`).
- Papéis: `almoxarifado`, `lider`, `operario`, `administracao`, `compras`, **`diretor`** (Diretor de Operações) + flag **`is_master`** (super-admin).

## ⚠️ COMO O DEPLOY FUNCIONA (corrigido em 2026-08-19)
- **O Railway ESTÁ conectado ao GitHub.** Serviço de produção `cautela-ferramentas`
  (projeto `cautela-ferramentas`, env `production`, volume `/app/data`, domínio
  `cautela.grupomarkat.com.br`) → **Source Repo `Maxdst/cautela-ferramentas`**, branch
  **`main`**, **auto-deploy LIGADO**. Ou seja: **push na `main` publica em produção sozinho.**
  (O handoff antigo dizia "não conectado / deploy manual via CLI" — estava **errado**.)
- **Caminho de deploy oficial = `git push` na `main`.** O Railway builda e sobe. Verificar:
  aba Deployments → Success + View logs (marcadores de migração/`SERVIDOR OK`), e `curl` no site.
- **`railway up` (CLI) NÃO funciona na máquina Windows do Maxwel:** trava em
  `Acesso negado. (os error 5)` logo após "Compressed 100%", mesmo da pasta certa, como admin,
  e com TEMP redirecionado — é antivírus/proteção de pasta bloqueando o pacote temporário.
  Não insistir no CLI; usar o push na `main`.
- Build roda no Linux do Railway (o `better-sqlite3` compila lá; **localmente não compila**
  nesta máquina Windows — falta Python/build tools). Validação local = `node --check server.js`
  + Babel no navegador (servir `public/` e checar console).
- Zero-downtime: se o build falha, o Railway mantém a versão atual (healthcheck `/health`).
- Reverter: aba Deployments do Railway → redeploy da versão anterior; ou `git revert` + push na `main`.
- Existe também o serviço `cautela-staging` (banco efêmero, sem volume) para testes.

## Railway — incidente de deploy resolvido (2026-07-30 tarde)
- Houve um **incidente da plataforma Railway** ("Builds and deployments are delayed") que pausou deploys
  dos planos **Hobby/Trial** por algumas horas. **Não era billing** do Maxwel. O site seguiu Online o tempo todo.
- Ao liberar, o `railway up` do módulo Uniformes-por-tamanho publicou normalmente. Deploy volta a funcionar.
- Contexto de plano: o projeto está no **Hobby** (por isso caiu na pausa; Pro fica isento). Blindar contra
  pausas futuras por incidente = migrar para Pro (decisão de negócio, não urgente).

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

## Módulo Uniformes / EPI (✅ EM PRODUÇÃO desde 2026-07-30)
> Deploy verificado: build ok, migração do CHECK rodou sem violação de FK (log
> "Migração usuarios: CHECK de role expandido"), seed dos 8 itens ok, `/health` 200,
> endpoints `/api/uniformes/*` respondendo 401 sem token (registrados). Falta só o teste
> logado do Maxwel (criar usuário Administração/Compras + retirada de teste).
- **Aba nova "Uniformes / EPI"** na sidebar, visível só a `almoxarifado`, `administracao`,
  `compras` (líder/operário não veem). Os 3 têm acesso **total e igual** ao módulo; os papéis
  novos ficam **escopados** (só Painel + Uniformes). Só o master é ilimitado no resto do sistema.
- **Papéis novos** `administracao` e `compras`: exigiram expandir o `CHECK(role IN ...)` de
  `usuarios`. Feito com **migração guardada** que reconstrói a tabela uma vez (preserva colunas,
  UNIQUE de email e ids; FK off durante a troca + `foreign_key_check`). Base schema já cria com
  o CHECK novo; a migração só roda em bancos antigos (como o de produção).
- **Tabelas:** `uniforme_itens` (catálogo, com `estoque_minimo`, `vida_util_meses`,
  `custo_reposicao`), `uniforme_entradas` (manual/nfe), `colaboradores` (com `usuario_id`
  opcional), `uniforme_entregas` + `uniforme_entrega_itens`. Estoque **calculado** (Σ entradas −
  Σ entregas). Seed dos 8 itens do termo (Bota 8m/R$70 · Calça 6m/R$55 · Jaleco 6m/R$65 ·
  Camisa 4m/R$35 · Luva/Capacete/Óculos/Protetor sem prazo).
- **Telas** (sub-abas em `UniformesPage`): Estoque (acordeão CRUD), Retirada (colaborador +
  itens + 2 assinaturas via `SignaturePad`, gera termo, reautenticação opcional se colaborador
  tem login), Entradas (manual + **importar XML de NF-e** → mapear/confirmar → dar entrada),
  Colaboradores (CRUD + vínculo a login), Alertas (mínimo + desgaste ≤30d).
- **NF-e:** parser próprio `parseNFe` em `server.js` (sem dependência nova — evita mexer no
  lock/deps do Railway). Lê `<det>/<prod>` + `<emit>` + chave/nNF; testado ok. Só XML da nota
  (não PDF/DANFE). Dedup por chave.
- **Alertas** vão aos 3 perfis: badge na aba + toast no polling de `/notificacoes` + painel.
- **Termo** `gerarTermoUniformeHTML` reusa os estilos dos termos existentes (declaração do
  colaborador, prazos, custos, 2 assinaturas, Lei 14.063/2020, São Gonçalo/data).
- **Validação local feita:** `node --check` ok; Babel compilou o front inteiro no navegador
  (login renderiza); `parseNFe` passou em teste unitário. Falta: `railway up` + teste logado
  do Maxwel (backend completo não roda nesta máquina Windows — better-sqlite3).
- SW bumpado para `markat-cautela-v4`.

### Atualização 2026-07-30 (tarde) — estoque por tamanho + termo antes de assinar + assinatura salva
> ✅ **EM PRODUÇÃO** (deploy concluído após o incidente do Railway liberar; `/health` 200, marcadores
> "Minha assinatura"/"Revisar termo"/"Tamanhos disponíveis" no HTML, endpoints novos 401, startup "SERVIDOR OK").
> Falta o teste logado do Maxwel (configurar grades/mínimos por tamanho, entrada por tamanho, retirada
> com bloqueio + prévia do termo + assinatura salva).
- **Estoque por TAMANHO:** `uniforme_itens` ganhou `tamanhos` (grade, ex.: `P,M,G`) e `min_por_tamanho`
  (JSON de mínimos por tamanho); `uniforme_entradas` ganhou `tamanho`. Saldo agora é por `(item, tamanho)`
  — helpers `uniformeDisp(item_id, tamanho)`, `saldoPorTamanho`, `estoquePorTamanho`, `alertasMinimo`.
  Seed com grades; migração `addCol` + backfill das grades dos 8 itens (idempotente). Item sem grade =
  tamanho único (balde `—`).
- **Retirada bloqueia sem estoque:** linha vira Item → Tamanho (mostra "42 — 3 disp.", esgotado desabilitado)
  → Qtd (limitada ao saldo do tamanho). Botão "Remover indisponíveis" + "Revisar termo" travado se houver linha inviável.
- **Termo antes de assinar:** novo passo `form → termo → assinar`. Prévia via `POST /uniformes/entregas/previa-termo`
  (reusa `montarTermoHTML`, sem gravar), renderizada em **iframe** (isola o `<style>` global do termo).
- **Assinatura salva ("lastreada"):** coluna `usuarios.assinatura`; endpoints `GET/PUT /api/perfil/assinatura`;
  sub-aba **"Minha assinatura"** em Uniformes. Na retirada, a assinatura do responsável vem automática da salva
  (com "Assinar diferente"); colaborador continua assinando ao vivo. Backend faz fallback à assinatura salva se não vier no payload.
- **Alerta por TAMANHO:** `/uniformes/alertas`, `/notificacoes` e `/dashboard` usam `alertasMinimo()` (avalia cada
  tamanho contra seu mínimo; override por tamanho ou o mínimo-padrão do item). Tabela de alertas mostra a coluna Tamanho.
- SW bumpado para `markat-cautela-v5`.

## Módulo Obras / Multi-obra (✅ EM PRODUÇÃO desde 2026-08-18)
> Habilita o tier **Enterprise** do Cautelix (painel consolidado multi-obra). Validado localmente
> (migração idempotente + fluxo ponta a ponta + JSX compila); falta `railway up` do Maxwel.
- **Modelo:** obra é dimensão **opcional** de solicitação/cautela. Almoxarifado é central — a obra é o
  **destino** da retirada; **não** altera o cálculo de disponibilidade (risco baixo). `obra_id` NULL em
  tudo = deploy de obra única segue igual (retrocompatível).
- **Schema:** nova tabela `obras` (nome, codigo, endereco, responsavel, ativo). `addCol` de `obra_id` em
  `solicitacoes`, `cautelas` e `usuarios` (obra padrão do usuário) — migração aditiva idempotente.
- **Fluxo:** solicitação carrega obra (informada ou herdada da **obra padrão** do usuário) → ao ficar
  `pronta`, a cautela **herda** a obra → dashboard soma **cautelas ativas e valor em campo por obra**.
- **Endpoints:** `GET/POST/PUT/DELETE /api/obras` (DELETE = desativa, preserva histórico); `obra_id`
  aceito em `/solicitacoes`, `/solicitacoes/por-operario`, `/cautelas/direta` e no CRUD de usuários;
  `GET /api/dashboard` ganhou `por_obra[]`. Helper `resolverObra(obraId, usuarioId)`.
- **Frontend:** nova aba **Obras** (CRUD, só almoxarifado), campo **Obra padrão** no cadastro de
  líder/operário, seletor de obra na Nova Solicitação, e seção **Consolidado por obra** no Painel
  (valor em campo só p/ master). Ícone `building`.
- **Deploy:** `railway up --detach --service cautela-ferramentas` após revisar o PR/branch. Nada muda
  para quem não cadastrar obras (a seção só aparece quando há obras ativas).

## Módulo Equipe do líder / Colaborador volátil (✅ EM PRODUÇÃO desde 2026-08-18)
> Evolução do multi-obra: a **obra passa a "morar" no colaborador**, não na cautela. O colaborador é
> volátil (circula entre obras e líderes carregando as ferramentas). Validado com teste de integração
> ponta a ponta (20/20 asserts) + JSX compila.
- **Conceito-chave:** a cautela está atrelada a **quem segura a ferramenta** (operário). O **valor em
  campo por obra é DINÂMICO** — atribuído pela **obra atual do colaborador** (via entregas ativas +
  cautelas diretas), não pela obra carimbada na criação. Mover o colaborador redistribui o valor sozinho.
- **Schema:** `addCol('usuarios','lider_id')` (líder responsável atual). Nova tabela `transferencias`
  (colaborador, de_lider, para_lider, obra, status pendente/aceita/recusada/cancelada, timestamps).
  Migração aditiva idempotente (Markat-safe — testado com 2º boot no mesmo DB).
- **Tela "Minha equipe" (só do líder):** lista os colaboradores dele (`lider_id = eu`) com **nº de
  cautelas ativas e valor em posse**, detalhe por colaborador (quais ferramentas), e ação **Mover**.
- **Handoff com aceite (segurança):** mover só de **obra** dentro da própria equipe = **imediato**.
  Passar para **outro líder** = **transferência PENDENTE** — o colaborador (e o valor) **continua na
  equipe de origem** até o líder que recebe **ACEITAR**. Só o destinatário pode aceitar/recusar; o
  remetente pode cancelar. Trilha auditável (`audit` em transferir/aceitar/recusar).
- **Papel do líder = gestão à vista / auditoria (não custódia):** o responsável direto por cada
  ferramenta é o **colaborador que retira**, até devolver ao almoxarifado. O painel do líder foi
  reescrito nesse tom (saiu "Minha responsabilidade"; entrou "Em campo — minha equipe"). O painel do
  **operário** mantém "Valor sob minha responsabilidade" (ali o rótulo é correto).
- **Auditoria da equipe:** aba **Auditoria** (só do líder) com o histórico — retiradas, devoluções e
  transferências — **escopado aos colaboradores da equipe dele** (`GET /api/equipe/auditoria`,
  escopo `usuarios.lider_id = líder`).
- **Endpoints:** `GET /api/equipe`, `GET /api/equipe/:id/cautelas`, `GET /api/equipe/auditoria`,
  `POST /api/equipe/mover`,
  `POST /api/equipe/transferencias/:id/{aceitar,recusar,cancelar}`. `lider_id` no CRUD de usuários;
  auto-semeadura do `lider_id` na 1ª entrega ao operário. Badge/toast em `/notificacoes`
  (`transferencias_recebidas`). Dashboard `por_obra` reescrito para atribuição dinâmica + bucket "Sem obra".
- **Frontend:** aba **Minha equipe** (sidebar + bottom-nav do líder, com badge), campo **Líder
  responsável** no cadastro de operário, ícone `users`/`handshake`.

## Módulo Diretor de Operações + Obras do líder (Kanban) (✅ EM PRODUÇÃO desde 2026-08-19)
> **Deploy verificado hoje:** `main` (commit `c9e1f66`) publicou via **auto-deploy do GitHub** →
> Deployment **successful**, `/health` **200**, e o marcador `ObrasLiderPage` (Kanban do líder) aparece
> no HTML servido. O deploy saiu **pelo push na `main`**, não pelo `railway up` (que trava com "Acesso
> negado" na máquina Windows — ver seção COMO O DEPLOY FUNCIONA). Validação prévia: `node --check` OK,
> migração guardada do papel `diretor` (`CHECK ... 'diretor'`, guardada por `!/'diretor'/`), JSX compila.
> **SW bumpado v5→v6** (purga limpa de cache nos PWAs) foi pra `main` num commit seguinte — redeploy automático.
> **Pendências operacionais do Maxwel (não são deploy):**
> 1. Atribuir cada obra a um líder (ver ⚠️ pós-deploy abaixo) — obras existentes ficaram sem líder.
> 2. Teste logado com dados reais (papel `diretor`, Kanban, mover colaborador entre obras).
- **Papel novo `diretor` (Diretor de Operações):** cria obras e **define qual líder responde por cada
  obra**. Migração segura (reconstrói `usuarios` reaproveitando o próprio `CREATE` — preserva TODAS as
  colunas/dados, só amplia o `CHECK`; idempotente, guardada por `!/'diretor'/`). Base schema já nasce com
  `diretor` → em banco novo (ex.: staging efêmero) a migração **nem roda** (por isso não aparece a linha
  "CHECK expandido" lá; ela só entra em **banco existente**, como produção). Procurar no deploy log de
  **produção:** `Migração usuarios: CHECK de role expandido (diretor)`.
- **Modelo obra↔líder = 1 líder por obra** (decisão do Maxwel): `addCol('obras','lider_id')`. O líder só
  **enxerga** as obras atribuídas a ele (leitura); quem atribui é o Diretor/Almoxarifado/Master.
- **Escopo do líder na obra = custódia** (decisão do Maxwel): vê só os colaboradores **da equipe dele**
  (`lider_id = eu`) naquela obra. Passar p/ outro líder segue com **aceite** (aba Minha equipe).
- **Endpoints:** `GET /api/obras` escopado por papel (líder → só as dele, com `lider_nome`; gestor → todas
  +`?all=1`). `POST/PUT/DELETE /api/obras` liberados a **almoxarifado+diretor** (`GESTOR_OBRAS`), com
  `lider_id` validado (`normalizarLiderObra`). Novo `GET /api/obras/:id/equipe` (drill-in do líder).
  `POST /api/usuarios` aceita `diretor`. Ramo `diretor` no `/api/dashboard` (obras ativas/com líder/sem líder).
- **Frontend:** aba **Obras** no sidebar/bottom-nav do **líder** e do **diretor**. `ObrasLiderPage` = **Kanban
  (Opção B escolhida)**: colunas = obras dele (+ "Sem obra"), cards = colaboradores; **arrasta** entre obras
  (HTML5 DnD) **ou** seletor "Mover para…" no card (mobile) → imediato via `/equipe/mover`. `ObrasPage` (gestor)
  ganhou campo **"Líder responsável"** + alerta **"Sem líder"** na lista. Painel próprio do Diretor. Aba
  **Minha equipe** redesenhada (stat-cards + avatares de iniciais). Helper `iniciais()`. Roteamento: `obras`
  → `ObrasLiderPage` p/ líder, `ObrasPage` p/ o resto.
- **⚠️ Pós-deploy de produção:** as obras existentes ficam com `lider_id = NULL` → **líderes veem a lista
  de obras vazia até o Diretor/Almox atribuir** cada obra a um líder. Isso também esvazia o seletor "mover
  para obra" da aba equipe e o de Nova Solicitação p/ o líder até a atribuição. É o comportamento esperado
  do modelo novo — fazer a atribuição inicial uma vez.
- **Staging:** banco **efêmero e separado** da produção (`/app/ferramentas.db`, sem volume) → some a cada
  deploy; seguro pra testar. Credenciais que o boot semeia: master `adm@mindmax.com.br`/`master123`,
  líderes Markat senha `Markat@2025`, admin `admin@teste.com`/`teste123` (todas temporárias).

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
1. ~~Resolver plano Railway~~ ✅ feito (plano pago desde 2026-07-30).
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
- `59d1010` **feat: Diretor de Operações + Obras do líder (Kanban) e redesign da equipe** ← NO STAGING
- `6f1e17d` docs: handoff — Multi-obra/Equipe do líder EM PRODUÇÃO
- `5b66159` feat: auditoria da equipe (histórico escopado aos colaboradores do líder)
- `2ed7dc0` ux: painel do líder como gestão à vista/auditoria (não custódia)
- `f4af41d` feat: equipe do líder + colaborador volátil (transferência com aceite)
