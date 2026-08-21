# ESTADO DO PROJETO — Cautelix (handoff entre conversas)

> Leia este arquivo no início de uma conversa nova para retomar o contexto sem
> arrastar o histórico inteiro. Mantido por Claude + Maxwel. Atualize ao concluir marcos.

## ⏰ PRÓXIMA AÇÃO (retomar por aqui — 2026-08-21)
**"Tarefas em aberto" do Gerente de Contrato + correções de UI do cockpit estão EM PRODUÇÃO**
(deploy 21/08 pela `main`, commits `6822d49` + `afc5cba`, `/health` 200; marcadores `GerenteTarefas`,
`--ink`, `dc-cols` presentes no HTML servido). Ver seção "Lote 2026-08-21" abaixo.
Falta só **teste logado com dados reais** (não temos a senha do Maxwel):
1. Entrar como `gerente` → painel → caixa **"Tarefas em aberto"** → bater **"Ciente"** numa transferência
   pendente e conferir que fica registrada (esmaece, "✓ Ciente — <nome>", contador cai).
2. Conferir o cockpit no **modo escuro** (números/tags brancos) e no **mobile** (título sem quebrar,
   lista de obras preenchendo a coluna).
Pendências operacionais antigas ainda valem: **atribuir cada obra a um líder** (aba Obras → "Líder
responsável") senão os líderes veem a lista vazia.
Deploy daqui pra frente = **`git push` na `main`** (auto-deploy do Railway). NÃO usar `railway up`
(trava com "os error 5" no Windows). Detalhes na seção "COMO O DEPLOY FUNCIONA".

### Lote 2026-08-21 (b): ciência da transferência não-expira + redesign Minha equipe + Auditoria do Diretor
> ✅ **EM PRODUÇÃO** (deploy 21/08 pela `main`). Validado: `node --check` OK · JSX compila · endpoints
> testados em banco real (persistência da transferência através do 'aceita'; auditoria do Diretor com 5
> categorias + filtro; engenheiro→403) · claro/escuro conferidos por screenshot. Falta teste logado do Maxwel.
25. **A ciência da transferência NÃO expira** (`tarefasGerente()` em `server.js`). Antes a tarefa só
    existia enquanto a transferência estava `pendente` — quando o engenheiro **aceitava**, sumia da caixa
    do Gerente mesmo sem ele ter tomado ciência. Agora a transferência fica em aberto até o **Gerente**
    reconhecer: query passou a `status IN ('pendente','aceita')` + só entra se **não** houver ciência
    registrada; ao aceitar mostra o estado "Aceita pelo engenheiro — aguardando sua ciência". Fecha
    apenas com a ciência. (Canceladas/recusadas não pedem ciência — não viraram troca real.)
26. **Redesign da aba "Minha equipe"** (`EquipePage` + CSS `.eq-*`). Saíram os cartõezinhos soltos por
    função; entrou um **banner "Aço"** com o total de colaboradores + funções em **chips**; pendências de
    transferência em painel limpo; equipe **agrupada por função** (cabeçalho + contagem) com avatar
    quadrado, nome forte e a **obra atual** de cada colaborador (ícone de prédio · obra/Volante); acordeão
    de mover/transferir no card. Alinhado à paleta Aço & Prata e a `--ink` (dark-safe).
27. **Auditoria do Diretor** (aba nova `diretor-auditoria`, só `diretor`). `GET /api/diretor/auditoria`
    monta a **trilha operacional GLOBAL** (até o nível de Gerente): retiradas, devoluções, transferências
    (ciclo completo), movimentações de obra (da tabela `auditoria`, ação `MOVER_COLABORADOR_OBRA`) e as
    **ciências do Gerente** (`gerente_ciencias`) — devolve `{eventos, pessoas}`. Front: `DiretorAuditoriaPage`
    (timeline `.aud-*`) com filtros **tipo · pessoa · período** e cor/ícone por categoria. Serve p/ auditar
    desentendimento entre as pessoas. **Engenheiro mantém** a aba "Auditoria" que já tinha (escopada à
    equipe dele) — decisão do Maxwel de não mexer.
28. **Correção — caixa "Tarefas em aberto" do Gerente não populava.** `GerenteTarefas` inicializava o
    estado com `useState(inicial||[])` **uma única vez**; como o `/api/dashboard` chega assíncrono, no 1º
    render a prop vinha `undefined` (stats={}) e o estado ficava travado em `[]` para sempre — a caixa
    aparecia **vazia** mesmo com tarefas no payload. Adicionado `useEffect(()=>setTarefas(inicial||[]),
    [inicial])` que sincroniza quando a prop muda (não interfere no update local do "Ciente", pois o
    dashboard não re-renderiza nessa ação). Sem essa correção o recurso do Gerente ficava inoperante em
    produção. (commit `3770f62`.)

### Lote 2026-08-21: "Tarefas em aberto" do Gerente (ciência de supervisão) + correções do cockpit
> ✅ **EM PRODUÇÃO** (deploy 21/08 pela `main`). Validado: `node --check server.js` OK · JSX compila
> (Babel preset-react) · endpoints testados ponta a ponta em banco real (GET/POST ciente, idempotência,
> diretor→403) · dark/light conferidos por screenshot. Falta o teste logado do Maxwel.
22. **Feature nova — caixa "Tarefas em aberto" do Gerente de Contrato** (papel `gerente`). Registro
    **paralelo e NÃO-bloqueante** de ciência: eventos operacionais que pedem o olho do gerente aparecem
    como pendência até ele bater **"Ciente"** (grava quem/quando; a operação segue pelo aceite do
    engenheiro — o ciente é só supervisão). Eventos cobertos agora: **transferências de colaborador
    pendentes** e **solicitações paradas +3d**. Só o `gerente` vê/reconhece (diretor recebe **403**).
    Backend: tabela **`gerente_ciencias`** (`UNIQUE(tipo,ref_id)` → idempotente; `CREATE TABLE IF NOT
    EXISTS`, sem migração de CHECK), helper `tarefasGerente()`, `GET /api/gerente/tarefas`, `POST
    /api/gerente/tarefas/ciente`, e `s.gerente_tarefas` no `/api/dashboard` (ramo diretor/gerente).
    Front: componente `GerenteTarefas` + estilos `.gt-*`, renderizado no painel do gerente logo após o
    Radar. Ordena pendentes acima das já-cientes, mais antigas primeiro.
23. **Correção de dark mode (estrutural).** Vários valores/títulos do cockpit usavam `var(--primary)`
    como **cor de texto** — no dark isso vira quase-preto e sumia (uns brancos, outros invisíveis).
    Criados tokens semânticos **`--ink`** (tinta forte: navy no claro, quase-branco no dark) e
    **`--mtag-fg`** (cor da tag "CAUTELA/OBRAS"), definidos nos 3 blocos de tema; todos os
    `color:var(--primary)` de texto migraram para `--ink`, e os números fortes que estavam em
    `--primary-text` também. O **card hero** (sempre escuro) deixou de depender de `--silver-light`
    (que flipava escuro no dark) — labels/tag fixados em tom claro. Estrutura evita a recaída do bug.
24. **Seções sem subtítulo + Prioridade 1 em 2 colunas.** Removido o subtítulo do canto sup. direito
    das seções (Prioridade 1 e 2) — no mobile ele espremia/quebrava o título; sem ele o título usa a
    linha toda. Prioridade 1 reestruturada em `.dc-cols` (esquerda empilha hero + aging; direita =
    "valor por obra" com `.dc-fill`/`.dc-bars`) → a lista **estica p/ preencher a altura da coluna**,
    acabando o espaço vazio quando não há "riscos individuais".

### ⏳ Pronto no branch, aguardando deploy (lote 2026-08-19, sessão do deploy)
Mudanças commitadas em `claude/ultimo-deploy-producao-bgkr5n`, **ainda não em `main`/produção**:
1. **Papel novo `gerente` (Gerente de Contrato):** mesmo acesso do Diretor (Painel + Obras + define
   líder da obra), **sem** gerenciar contas. `GESTOR_OBRAS` inclui gerente; badge/label próprios.
   Migração idempotente estende o CHECK (`... 'diretor','gerente'`), guardada por `!/'gerente'/`
   (roda 1x no banco de prod que já tem `diretor`). Log de deploy: `CHECK de role expandido (diretor, gerente)`.
2. **Hierarquia de contas:** o **Diretor** ganhou a aba **Usuários** e gerencia (criar/editar/excluir/resetar
   senha) **Gerente, líder e operário** — nunca Diretor/Almox/Master. Helper `rolesGerenciaveis(user)` no
   backend + escopo no GET/POST/PUT/DELETE `/usuarios`. Gerente não gerencia ninguém.
3. **Devolução de cautela:** removido o botão "Devolver" de líder/operário. Agora **só o Almoxarifado inicia**
   ("Registrar devolução"); o responsável (operário na direta, líder na via-líder) confirma com **login +
   assinatura** (mecanismo mantido). Endpoint `POST /cautelas/:id/devolver` = `auth(['almoxarifado'])` e
   fecha as entregas a operários em cascata. (O "Devolver" do módulo Empréstimos é outro fluxo — intacto.)
4. **Sidebar:** aba **Auditoria** movida para o fim (após Empréstimos).
Validado: `node --check` OK + JSX compila (Babel). Falta: push na `main` + verificar migração e fluxos.

### Lote 2026-08-19 (b): "Volantes" + seed das obras FMS Niterói
5. **"Sem obra" → "Volantes"** no Kanban do líder (coluna, toast, seletor mover, bucket do dashboard);
   um membro sem obra fica rotulado **"Volante"**. ("Sem obra fixa" da obra padrão do usuário foi mantido.)
6. **Seed das 27 obras do contrato FMS Niterói** (`server.js`, após o seed de líderes): 27 unidades de
   saúde em 4 zonas, cada uma com líder responsável. Líderes casados por e-mail — Anderson Rodrigues,
   Leandro Nicolau de Sá e Christian Mauricio Freitas **já existiam** no seed; **Marlon** foi adicionado
   (`marlon@markat.com`, senha padrão `Markat@2025`). Idempotente: guarda-rápida por `codigo='FMS'` +
   checagem por nome. Log de deploy: `N obra(s) do contrato FMS Niterói semeadas com líder definido`.

### Lote 2026-08-20: Almoxarifado editável pelo Master + Painel do Engenheiro (indicadores)
14. **Perfil `almoxarifado` totalmente gerenciável pelo Master** (só pelo Master). `rolesGerenciaveis`
    agora dá ao master a lista **com** `almoxarifado` (criar/editar/excluir outras contas de almox); almox
    não-master segue sem tocar em outro almox. Frontend: `perfisDisp` inclui **Almoxarifado** quando
    `user.is_master` (aparece no dropdown de criação e no filtro); botão **Excluir** aparece para almox
    quando o usuário é master. Guardas de segurança: a **conta master** (`is_master`) nunca é excluível
    pela UI/back; almox só é excluível pelo master; sem autoexclusão. `GET /usuarios` passou a devolver
    `is_master` (para a UI blindar a conta master).
15. **Painel do Engenheiro** (antes caía no "Painel do Líder", compartilhado). Título próprio
    **"Painel do Engenheiro"** e o bloco de stat-cards trocado para **indicadores de Obras + Equipe**:
    Minhas obras · Colaboradores · Cautelas ativas (em posse da equipe) · Valor em campo · Aguard. meu aval.
    O Líder mantém o painel antigo intacto (blocos separados por papel no `Dashboard`). Dashboard back
    ganhou p/ lider+engenheiro: `minhas_obras`, `equipe_colaboradores`, `equipe_cautelas`, `equipe_valor`
    (loop `posseColaborador` sobre a equipe). **Aba Obras** (`ObrasLiderPage`) ganhou a faixa de stat-cards
    que faltou no deploy do demo visual (Minhas obras/Colaboradores/Cautelas/Valor — calculados do estado
    já carregado, sem back novo). Validado: `node --check` OK + JSX compila (Babel preset-react).

### Lote 2026-08-20 (b): Equipe por função, Obras enxuta e logout no mobile
16. **Aba Minha equipe (`EquipePage`) minimalista, orientada a função.** Cards de indicadores agora são
    **Colaboradores (total) + um card por função/cargo** (contagem por `cargo`, ex.: Pedreiro de manutenção,
    Ajudante…); **removidos** os cards de Cautelas ativas e Valor em campo. A lista abaixo passou a ser
    **agrupada por seção de função** — cabeçalho da função + contagem, e sob ele **somente os nomes** de cada
    colaborador (removidos valor/cautelas e o detalhe de ferramentas). Mantido o acordeão de **mover de obra /
    passar para outro líder** (aceite) ao tocar no nome — indicador chevron que gira. `toggle` não busca mais
    `/equipe/:id/cautelas`. Agrupamento no cliente sobre `data.membros` (o `/api/equipe` já devolve `cargo`).
17. **Aba Obras (`ObrasLiderPage`) enxuta.** Faixa de indicadores reduzida a **somente "Minhas obras"**
    (removidos Colaboradores/Cautelas/Valor). No card de cada colaborador, a linha de **cautela(s)·valor** virou
    **função/cargo** (`m.cargo || 'Sem função'`). No cabeçalho de cada obra (coluna) segue o **valor** abaixo do
    nome (`N colab. · valor`, agora sempre visível).
18. **Logout no front mobile.** Antes o "Sair" só existia no sidebar, inacessível no mobile (sidebar oculta e
    sem hambúrguer); a bottom-nav não tinha logout. Adicionada **barra superior fixa mobile** (`.mobile-topbar`,
    só em `≤768px`) com marca **Cautelix** + botão **Sair** (chama o mesmo `logout`). `main-content` ganhou
    `padding-top` no mobile p/ não ficar sob a barra. z-index 90 (abaixo de modais 200 / toasts 999 / bottom-nav
    100). Validado: JSX compila (Babel preset-react).

### Lote 2026-08-20 (c): Painel do Diretor (cockpit) + scaffold de módulos por pacote
> **No branch `claude/operations-director-dashboard-0wy8dk`, ainda NÃO em `main`/produção.**
> Aprovado por mockup visual antes de codar. Validação local completa (ver abaixo); falta push na `main`
> + teste logado do Maxwel (papel `diretor`).
19. **Painel do Diretor virou cockpit de decisão** (antes eram só 3 contagens de obras). Ramo
    `diretor`/`gerente` do `GET /api/dashboard` reescrito com blocos: **Prioridade 1 — Exposição
    financeira** (valor total em campo, média/colaborador e /obra, **aging** de ferramenta em campo em
    faixas 15–30/30–60/+60d com valor, **maiores riscos individuais** = quem está há mais tempo sem
    devolver); **Prioridade 2 — Desempenho dos líderes/engenheiros** (ranking por engenheiro: obras ·
    colaboradores · cautelas · valor sob gestão · transf. pendentes · solicitações paradas +3d);
    **Contexto** (cobertura de obras, funil de solicitações, pessoas/alocação + volantes). **Radar** de
    alertas acionáveis no topo (obras sem eng., R$ em aging +60d, transf. +48h, prontas paradas +3d, EPI
    no mínimo). Front: componente `DiretorDashboard` reescrito com CSS próprio `.dc-*` (paleta Aço &
    Prata), helper `fmtBRLc` (moeda compacta). Diretor **vê valores** (é a função dele) — sem gate de master.
20. **Scaffold de módulos (comercialização por pacote).** Backend: registro `MODULOS_TODOS =
    ['cautela','obras','equipe','emprestimos','uniformes']`; **`cautela` é base (sempre ativo)**. Ativos
    definidos por **env `CAUTELIX_MODULOS`** (lista por vírgula; ex.: `obras,equipe`). **Default = TODOS**
    → Markat e qualquer deploy legado seguem idênticos. Helper `modAtivo(m)`; o painel do Diretor só
    calcula/renderiza os indicadores dos módulos ativos — **nenhum indicador zera ou quebra**. Os módulos
    ativos viajam ao front em `user.modulos` (login + `/auth/me` + troca-senha). Front: `MODULO_DA_ABA` +
    `temModulo(user,m)` + `abaAtiva()` → **sidebar e bottom-nav filtram as abas** pelos módulos contratados,
    e cada card do painel é gated por `temModulo`. Ausência de `user.modulos` (token legado) = tudo ligado.
21. **Validação local:** `node --check server.js` OK · JSX compila no Babel 7.23.2 (preset-react) ·
    **12/12 queries do painel** rodadas em schema mínimo (node:sqlite) com resultados corretos ·
    lógica do registro de módulos testada (default=todos, subset sempre inclui base, env vazio→todos).
    SW bumpado **v6→v7**. Falta: push na `main` + teste logado (não temos a senha do Maxwel).

### Lote 2026-08-19 (c): papel Engenheiro + hierarquia de comando
7. **Papel novo `engenheiro`** = todas as funcionalidades do **Líder atual**, um nível **acima do Líder** e
   **abaixo do Gerente de Contrato**. Migração idempotente estende o CHECK (`... 'gerente','engenheiro'`,
   guardada por `!/'engenheiro'/`). Log: `CHECK de role expandido (diretor, gerente, engenheiro)`.
8. **O Líder PERDE a aba Obras** (gerir obras + alocar colaboradores nas obras) — isso é do **Engenheiro
   para cima**. Kanban `ObrasLiderPage` agora é do `engenheiro`; sidebar/bottom-nav de Obras = alm/diretor/
   gerente/**engenheiro** (líder saiu). Como as obras têm `lider_id` = engenheiro, a lista de obras do líder
   fica vazia (ele não aloca obras). Líder mantém Solicitações, Minha equipe, Cautelas, Empréstimos.
9. **Engenheiro tratado como líder** em todo o backend (auth de solicitações/cautelas/entregas/equipe/
   empréstimos; escopos `role IN ('lider','engenheiro')`; `/auth/validar` trata os dois como equivalentes)
   e frontend (Painel, isLider, abas, roteamento). `GET /usuarios/lideres` e validações de responsável/
   para_lider passam a aceitar engenheiro (obras podem ter engenheiro como responsável).
10. **Os 4 responsáveis viram Engenheiro** (Anderson, Marlon, Leandro, Christian) — promoção idempotente
    (`UPDATE role='engenheiro' WHERE email IN (...) AND role='lider'`) no boot, após o seed de líderes.
11. **Dropdowns de perfil reordenados** na hierarquia: Administração · Compras · (Almoxarifado) · Diretor ·
    Gerente · Engenheiro · Líder · Operário. Diretor cria/gerencia gerente/**engenheiro**/líder/operário.
12. **Rótulo "Engenheiro responsável"** na aba Obras (gestor) e no Painel do Diretor (antes "Líder
    responsável"/"Sem líder"). O "Líder responsável" do cadastro de operário e do empréstimo (equipe do
    operário) ficou **intacto** — lá ainda é líder.
13. **Líder perdeu "Minha equipe" + a "Auditoria" da equipe** (agora só Engenheiro). Líder mantém: Painel,
    Solicitações, Nova Solicitação, Cautelas, Empréstimos. (Backend dos endpoints `/equipe` ainda aceita
    líder além de engenheiro — sem caminho na UI; se quiser travar no backend também, é rápido.)

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
- `3770f62` **fix(gerente): caixa "Tarefas em aberto" não populava (estado preso no valor inicial)** ← EM PRODUÇÃO (21/08 b)
- **feat: ciência da transferência não-expira + redesign Minha equipe + Auditoria do Diretor** ← EM PRODUÇÃO (21/08 b)
- `afc5cba` **fix(painel): dark mode legível, seções sem subtítulo e lista que preenche a coluna** ← EM PRODUÇÃO (21/08)
- `6822d49` **feat(gerente): caixa "Tarefas em aberto" com ciência de supervisão** ← EM PRODUÇÃO (21/08)
- `59d1010` feat: Diretor de Operações + Obras do líder (Kanban) e redesign da equipe
- `6f1e17d` docs: handoff — Multi-obra/Equipe do líder EM PRODUÇÃO
- `5b66159` feat: auditoria da equipe (histórico escopado aos colaboradores do líder)
- `2ed7dc0` ux: painel do líder como gestão à vista/auditoria (não custódia)
- `f4af41d` feat: equipe do líder + colaborador volátil (transferência com aceite)
