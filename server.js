const express = require('express')
const Database = require('better-sqlite3')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const path = require('path')
const fs = require('fs')
const rateLimit = require('express-rate-limit')
const cron = require('node-cron')

const app = express()
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'ferramentas.db')
const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

const db = new Database(DB_PATH)

// ─── BACKUP AUTOMÁTICO ────────────────────────────────────────────────────────
const BACKUP_DIR = path.join(dbDir, 'backups')
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

function criarBackup() {
  try {
    const data = new Date().toISOString().slice(0, 10)
    const dest = path.join(BACKUP_DIR, `backup-${data}.db`)
    fs.copyFileSync(DB_PATH, dest)
    console.log(`✅ Backup criado: ${dest}`)
    // Manter apenas os últimos 30 backups
    const arquivos = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .sort()
    if (arquivos.length > 30) {
      arquivos.slice(0, arquivos.length - 30).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f))
        console.log(`🗑 Backup antigo removido: ${f}`)
      })
    }
  } catch (e) { console.error('Erro no backup:', e.message) }
}

// Backup diário às 02:00
cron.schedule('0 2 * * *', criarBackup)
console.log('⏰ Backup automático agendado (diário às 02:00)')

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // janela de 15 minutos
  max: 10,                      // máximo 10 tentativas por IP
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
})
const SECRET = process.env.JWT_SECRET || (() => {
  console.warn('⚠️  AVISO: JWT_SECRET não definido como variável de ambiente. Use uma chave segura em produção.')
  return 'cautela-obras-2024-secret-TROCAR-EM-PRODUCAO'
})()

const EMPRESA = {
  // Nome de exibição (curto, nome fantasia) — usado na UI: tela de login, sidebar, header.
  // Manter curto e sem sufixo societário (LTDA/ME/EIRELI) para não pesar visualmente no primeiro contato.
  nome:     process.env.EMPRESA_NOME     || 'EMPRESA NÃO CONFIGURADA (definir EMPRESA_NOME)',
  // Razão social completa — usada só nos textos legais (Termo de Responsabilidade, cláusulas de isenção).
  // Se não for definida, cai no nome de exibição (comportamento antigo, sem quebra).
  razaoSocial: process.env.EMPRESA_RAZAO_SOCIAL || process.env.EMPRESA_NOME || 'EMPRESA NÃO CONFIGURADA (definir EMPRESA_NOME)',
  cnpj:     process.env.EMPRESA_CNPJ     || 'XX.XXX.XXX/XXXX-XX',
  endereco: process.env.EMPRESA_ENDERECO || 'Endereço não configurado (definir EMPRESA_ENDERECO)',
  cidade:   process.env.EMPRESA_CIDADE   || 'Cidade não configurada (definir EMPRESA_CIDADE)',
  // Logo customizada é opcional — por padrão o produto usa o wordmark "Cautelix".
  // Definir EMPRESA_LOGO_URL só para clientes que queiram manter uma logo própria (ex.: migração de sistema anterior).
  logoUrl:  process.env.EMPRESA_LOGO_URL || null
}

app.use(express.json({ limit: '10mb' }))
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }
  }
}))

// ─── SCHEMA BASE ─────────────────────────────────────────────────────────────
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    cargo TEXT,
    role TEXT NOT NULL CHECK(role IN ('almoxarifado','lider','operario')),
    ativo INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS ferramentas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    codigo TEXT UNIQUE,
    categoria TEXT,
    descricao TEXT,
    quantidade_total INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS bolsas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    ativa INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS bolsa_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bolsa_id INTEGER NOT NULL REFERENCES bolsas(id) ON DELETE CASCADE,
    ferramenta_id INTEGER NOT NULL REFERENCES ferramentas(id),
    quantidade INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS solicitacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE,
    lider_id INTEGER NOT NULL REFERENCES usuarios(id),
    bolsa_id INTEGER REFERENCES bolsas(id),
    status TEXT NOT NULL DEFAULT 'solicitada',
    obs TEXT,
    obs_almoxarifado TEXT,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS solicitacao_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
    ferramenta_id INTEGER NOT NULL REFERENCES ferramentas(id),
    quantidade INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS cautelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE,
    solicitacao_id INTEGER REFERENCES solicitacoes(id),
    lider_id INTEGER NOT NULL REFERENCES usuarios(id),
    status TEXT NOT NULL DEFAULT 'aguardando_retirada',
    valor_total REAL DEFAULT 0,
    assinatura_lider TEXT,
    ip_lider TEXT,
    data_retirada TEXT,
    data_devolucao TEXT,
    obs_devolucao TEXT,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS cautela_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cautela_id INTEGER NOT NULL REFERENCES cautelas(id) ON DELETE CASCADE,
    ferramenta_id INTEGER NOT NULL REFERENCES ferramentas(id),
    quantidade INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS cautela_entregas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cautela_id INTEGER NOT NULL REFERENCES cautelas(id),
    operario_id INTEGER NOT NULL REFERENCES usuarios(id),
    status TEXT NOT NULL DEFAULT 'ativa',
    assinatura_operario TEXT,
    ip_operario TEXT,
    data_entrega TEXT DEFAULT (datetime('now','localtime')),
    data_devolucao TEXT,
    obs TEXT,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS cautela_entrega_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entrega_id INTEGER NOT NULL REFERENCES cautela_entregas(id) ON DELETE CASCADE,
    ferramenta_id INTEGER NOT NULL REFERENCES ferramentas(id),
    quantidade INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS emprestimos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitante_id INTEGER NOT NULL REFERENCES usuarios(id),
    tomador_id INTEGER NOT NULL REFERENCES usuarios(id),
    lider_id INTEGER REFERENCES usuarios(id),
    status TEXT NOT NULL DEFAULT 'aguardando_tomador',
    assinatura_lider TEXT,
    ip_lider TEXT,
    data_emprestimo TEXT,
    data_devolucao TEXT,
    obs TEXT,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS emprestimo_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emprestimo_id INTEGER NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
    ferramenta_id INTEGER NOT NULL REFERENCES ferramentas(id),
    quantidade INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id),
    acao TEXT NOT NULL,
    tabela TEXT,
    registro_id INTEGER,
    detalhe TEXT,
    criado_em TEXT DEFAULT (datetime('now','localtime'))
  );
`)

// ─── MIGRAÇÕES ────────────────────────────────────────────────────────────────
;(function migrate() {
  const addCol = (t, c, def) => { try { db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`) } catch {} }

  // Recria tabelas de schema antigo ANTES de rodar os addCol, preservando histórico.
  // (rodar addCol depois garante que colunas novas não fiquem faltando na tabela recriada)

  // Se cautelas ainda tem schema antigo (operario_id), recria preservando histórico
  const hasOldCautela = db.prepare("SELECT * FROM pragma_table_info('cautelas') WHERE name='operario_id'").get()
  if (hasOldCautela) {
    db.transaction(() => {
      const old = db.prepare('SELECT * FROM cautelas').all()
      const oldItens = db.prepare('SELECT * FROM cautela_itens').all()
      db.exec('DROP TABLE IF EXISTS cautela_itens')
      db.exec('DROP TABLE IF EXISTS cautelas')
      db.exec(`CREATE TABLE cautelas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, numero TEXT UNIQUE,
        solicitacao_id INTEGER REFERENCES solicitacoes(id),
        lider_id INTEGER NOT NULL REFERENCES usuarios(id),
        status TEXT NOT NULL DEFAULT 'aguardando_retirada',
        valor_total REAL DEFAULT 0, assinatura_lider TEXT, ip_lider TEXT,
        data_retirada TEXT, data_devolucao TEXT, obs_devolucao TEXT,
        data_prevista_devolucao_legado TEXT,
        operario_id_legado INTEGER REFERENCES usuarios(id),
        criado_em TEXT DEFAULT (datetime('now','localtime')))`)
      db.exec(`CREATE TABLE cautela_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cautela_id INTEGER NOT NULL REFERENCES cautelas(id) ON DELETE CASCADE,
        ferramenta_id INTEGER NOT NULL REFERENCES ferramentas(id),
        quantidade INTEGER NOT NULL DEFAULT 1)`)
      const insC = db.prepare(`INSERT INTO cautelas
        (id,numero,lider_id,status,valor_total,assinatura_lider,ip_lider,data_retirada,data_devolucao,obs_devolucao,data_prevista_devolucao_legado,operario_id_legado,criado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      const insI = db.prepare('INSERT INTO cautela_itens (id,cautela_id,ferramenta_id,quantidade) VALUES (?,?,?,?)')
      const insE = db.prepare('INSERT INTO cautela_entregas (cautela_id,operario_id,status,assinatura_operario,data_entrega,data_devolucao,obs,criado_em) VALUES (?,?,?,?,?,?,?,?)')
      const insEI = db.prepare('INSERT INTO cautela_entrega_itens (entrega_id,ferramenta_id,quantidade) VALUES (?,?,?)')
      for (const c of old) {
        const st = c.status === 'aguardando_operario' ? 'aguardando_retirada' : (c.status || 'aguardando_retirada')
        insC.run(
          c.id, c.numero, c.lider_id, st, c.valor_total || 0, c.assinatura_lider, c.ip_lider ?? null,
          c.data_emissao ?? null, c.data_devolucao, c.obs_devolucao,
          c.data_prevista_devolucao ?? null, c.operario_id ?? null, c.criado_em
        )
        const itensDaCautela = oldItens.filter(i => i.cautela_id === c.id)
        for (const i of itensDaCautela) insI.run(i.id, i.cautela_id, i.ferramenta_id, i.quantidade)
        // Schema antigo já vinha com líder+operário resolvidos numa única cautela.
        // Só existe "entrega" de fato se o processo já tinha avançado (ativa/devolvida) —
        // se ainda estava aguardando, o operário pretendido fica preservado em operario_id_legado.
        if (c.operario_id && (c.status === 'ativa' || c.status === 'devolvida')) {
          const entregaId = insE.run(c.id, c.operario_id, c.status, c.assinatura_operario, c.data_emissao, c.data_devolucao, c.obs, c.criado_em).lastInsertRowid
          for (const i of itensDaCautela) insEI.run(entregaId, i.ferramenta_id, i.quantidade)
        }
      }
    })()
    console.log('  Migração cautelas: concluída (histórico de operário preservado em cautela_entregas / operario_id_legado)')
  }

  // Se emprestimos tem schema antigo (emprestador_id), recria preservando histórico
  const hasOldEmp = db.prepare("SELECT * FROM pragma_table_info('emprestimos') WHERE name='emprestador_id'").get()
  if (hasOldEmp) {
    db.transaction(() => {
      const old = db.prepare('SELECT * FROM emprestimos').all()
      const oldItens = db.prepare('SELECT * FROM emprestimo_itens').all()
      db.exec('DROP TABLE IF EXISTS emprestimo_itens')
      db.exec('DROP TABLE IF EXISTS emprestimos')
      db.exec(`CREATE TABLE emprestimos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        solicitante_id INTEGER NOT NULL REFERENCES usuarios(id),
        tomador_id INTEGER NOT NULL REFERENCES usuarios(id),
        lider_id INTEGER REFERENCES usuarios(id),
        status TEXT NOT NULL DEFAULT 'aguardando_tomador',
        assinatura_lider TEXT, ip_lider TEXT,
        assinatura_tomador_legado TEXT,
        data_emprestimo TEXT, data_devolucao TEXT, obs TEXT,
        criado_em TEXT DEFAULT (datetime('now','localtime')))`)
      db.exec(`CREATE TABLE emprestimo_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emprestimo_id INTEGER NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
        ferramenta_id INTEGER NOT NULL REFERENCES ferramentas(id),
        quantidade INTEGER NOT NULL DEFAULT 1)`)
      const insE = db.prepare(`INSERT INTO emprestimos
        (id,solicitante_id,tomador_id,status,assinatura_lider,assinatura_tomador_legado,data_emprestimo,data_devolucao,obs,criado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?)`)
      const insI = db.prepare('INSERT INTO emprestimo_itens (id,emprestimo_id,ferramenta_id,quantidade) VALUES (?,?,?,?)')
      for (const e of old) {
        insE.run(
          e.id, e.emprestador_id, e.tomador_id, e.status || 'aguardando_tomador',
          e.assinatura_emprestador ?? null, e.assinatura_tomador ?? null,
          e.data_emprestimo, e.data_devolucao, e.obs, e.criado_em
        )
      }
      for (const i of oldItens) insI.run(i.id, i.emprestimo_id, i.ferramenta_id, i.quantidade)
    })()
    console.log('  Migração empréstimos: concluída (histórico preservado; assinatura do tomador movida para assinatura_tomador_legado)')
  }

  addCol('usuarios', 'cpf_cnpj', 'TEXT')
  addCol('usuarios', 'empresa', 'TEXT')
  addCol('usuarios', 'endereco', 'TEXT')
  addCol('usuarios', 'telefone', 'TEXT')
  addCol('ferramentas', 'valor_unitario', 'REAL DEFAULT 0')
  addCol('usuarios', 'primeiro_acesso', 'INTEGER DEFAULT 0')
  addCol('cautelas', 'assinatura_devolucao', 'TEXT')
  addCol('cautelas', 'ip_devolucao', 'TEXT')
  addCol('cautelas', 'cautela_tipo', "TEXT DEFAULT 'lider'")
  addCol('cautelas', 'data_prevista_devolucao_legado', 'TEXT')
  addCol('cautelas', 'operario_id_legado', 'INTEGER REFERENCES usuarios(id)')
  addCol('solicitacoes', 'assinatura_solicitante', 'TEXT')
  addCol('solicitacoes', 'ip_solicitante', 'TEXT')
  addCol('emprestimos', 'assinatura_tomador_legado', 'TEXT')
})()

// Usuário admin padrão de uma instalação nova (genérico — cada cliente completa os próprios dados
// no primeiro acesso, através do fluxo de troca de senha + aceite de termos que já existe no sistema).
const ADMIN_PADRAO = {
  nome: process.env.ADMIN_NOME || 'Administrador',
  empresa: process.env.EMPRESA_NOME || '',
  cpf_cnpj: process.env.EMPRESA_CNPJ || '',
  endereco: process.env.EMPRESA_ENDERECO || '',
  cargo: 'Almoxarifado',
  email: process.env.ADMIN_EMAIL || 'admin@empresa.com',
  senha: process.env.ADMIN_SENHA || 'trocar123',
  role: 'almoxarifado'
}
if (!db.prepare("SELECT id FROM usuarios WHERE role='almoxarifado'").get()) {
  db.prepare('INSERT INTO usuarios (nome,email,senha_hash,cargo,role,empresa,cpf_cnpj,endereco,primeiro_acesso) VALUES (?,?,?,?,?,?,?,?,1)')
    .run(ADMIN_PADRAO.nome, ADMIN_PADRAO.email, bcrypt.hashSync(ADMIN_PADRAO.senha, 10), ADMIN_PADRAO.cargo, ADMIN_PADRAO.role, ADMIN_PADRAO.empresa, ADMIN_PADRAO.cpf_cnpj, ADMIN_PADRAO.endereco)
  console.log(`  Usuário padrão criado: ${ADMIN_PADRAO.email} / ${ADMIN_PADRAO.senha} (senha temporária — troca obrigatória no primeiro acesso)`)
}
// ─── SEED DE LÍDERES (Markat Engenharia) ──────────────────────────────────────
;(() => {
  const SENHA_PADRAO = 'Markat@2025'
  const lideresMarkat = [
    { nome: 'Alex Sandre da Assuncao Amancio', email: 'alex.amancio@markat.com',       cargo: 'Eletricista',    cnpj: '23.626.842/0001-59' },
    { nome: 'Roberto Pinto dos Santos Junior',  email: 'roberto.santos@markat.com',     cargo: 'Refrigeração',   cnpj: '31.573.523/0001-50' },
    { nome: 'Leonardo de Sousa Nascimento',     email: 'leonardo.nascimento@markat.com',cargo: 'Vidraceiro',     cnpj: '35.637.848/0001-00' },
    { nome: 'Diego Melo Bizareli',              email: 'diego.bizareli@markat.com',     cargo: 'Motorista',      cnpj: '51.431.931/0001-85' },
    { nome: 'Marco Andre',                      email: 'marco.andre@markat.com',        cargo: 'Motorista',      cnpj: '52.066.178/0001-39' },
    { nome: 'Lucas dos Santos Nunes',           email: 'lucas.nunes@markat.com',        cargo: 'Refrigeração',   cnpj: '53.681.176/0001-12' },
    { nome: 'Matheus Cardoso de Araujo',        email: 'matheus.araujo@markat.com',     cargo: 'Administrativo', cnpj: '55.434.554/0001-99' },
    { nome: 'Beatriz Mota de Souza',            email: 'beatriz.souza@markat.com',      cargo: 'Almoxarifado',   cnpj: '55.439.155/0001-10' },
    { nome: 'Leandro Nicolau de Sa',            email: 'leandro.sa@markat.com',         cargo: 'Encarregado',    cnpj: '55.458.387/0001-16' },
    { nome: 'Anderson Rodrigues',               email: 'anderson.rodrigues@markat.com', cargo: 'Engenheiro',     cnpj: '55.517.776/0001-75' },
    { nome: 'Christian Mauricio Freitas',       email: 'christian.freitas@markat.com',  cargo: 'Engenheiro',     cnpj: '55.951.877/0001-50' },
    { nome: 'Gabriela Peixoto da Cunha',        email: 'gabriela.cunha@markat.com',     cargo: 'Arquiteta',      cnpj: '56.427.813/0001-17' },
    { nome: 'Aline Pinheiro de Almeida',        email: 'aline.almeida@markat.com',      cargo: 'Arquiteta',      cnpj: '60.217.063/0001-26' },
    { nome: 'Thiago Almeida Santos de Sena',    email: 'thiago.sena@markat.com',        cargo: 'Motorista',      cnpj: '60.443.674/0001-92' },
    { nome: 'Paulo Henrique Praca Velozo',      email: 'paulo.velozo@markat.com',       cargo: 'Engenheiro',     cnpj: '60.456.309/0001-12' },
    { nome: 'Elvis Carlos Cardoso da Silva',    email: 'elvis.silva@markat.com',        cargo: 'Poda',           cnpj: '62.087.450/0001-10' },
    { nome: 'Ezequiel',                         email: 'ezequiel@markat.com',           cargo: 'Encarregado',    cnpj: '66.329.560/0001-00' },
    { nome: 'Maycon Antonio Mende da Rocha',    email: 'maycon.rocha@markat.com',       cargo: 'Motorista',      cnpj: '66.412.828/0001-65' },
    { nome: 'Maxwel Pedro Silva Tavares',       email: 'maxwel.tavares@markat.com',     cargo: 'Administrativo', cnpj: '66.669.220/0001-10' },
    { nome: 'Daniel Vitto',                     email: 'daniel.vitto@markat.com',       cargo: 'Engenheiro',     cnpj: '62.733.991/0001-79' },
    { nome: 'Bryan Matos Belbuche Soares',      email: 'bryan.soares@markat.com',       cargo: 'Apontador',      cnpj: null },
    { nome: 'Claudio Luiz Alves',               email: 'claudio.alves@markat.com',      cargo: 'Engenheiro',     cnpj: null },
    { nome: 'Thiago Bruno Bezerra',             email: 'thiago.bezerra@markat.com',     cargo: 'Encarregado',    cnpj: null },
  ]
  const hash = bcrypt.hashSync(SENHA_PADRAO, 10)
  const stmt = db.prepare("INSERT OR IGNORE INTO usuarios (nome,email,senha_hash,cargo,role,cpf_cnpj,primeiro_acesso) VALUES (?,?,?,?,?,?,1)")
  let criados = 0
  for (const l of lideresMarkat) {
    const r = stmt.run(l.nome, l.email, hash, l.cargo, 'lider', l.cnpj || null)
    if (r.changes) criados++
  }
  if (criados > 0) console.log(`  ✅ ${criados} líder(es) Markat criados. Senha padrão: ${SENHA_PADRAO}`)
})()

// Nada de sobrescrever os dados do admin em toda inicialização — antes isso apagava qualquer edição
// feita pelo cliente (ex.: nome/empresa reais) a cada restart/deploy, sempre voltando para os dados da Markat.

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function auth(roles = []) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Não autenticado' })
    try {
      req.user = jwt.verify(token, SECRET)
      if (roles.length && !roles.includes(req.user.role))
        return res.status(403).json({ error: 'Sem permissão' })
      next()
    } catch { res.status(401).json({ error: 'Token inválido' }) }
  }
}

function audit(uid, acao, tabela, id, detalhe) {
  try {
    db.prepare('INSERT INTO auditoria (usuario_id,acao,tabela,registro_id,detalhe) VALUES (?,?,?,?,?)')
      .run(uid, acao, tabela, id || null, typeof detalhe === 'object' ? JSON.stringify(detalhe) : (detalhe || null))
  } catch {}
}

function getIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
}

function gerarNumero(prefix) {
  const tbl = prefix === 'SOL' ? 'solicitacoes' : 'cautelas'
  const n = db.prepare(`SELECT COUNT(*) n FROM ${tbl}`).get().n + 1
  return `${prefix}-${String(n).padStart(4, '0')}`
}

function fmtBRL(v) {
  if (!v) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtData(d) {
  if (!d) return '—'
  const [y, m, dd] = d.split('T')[0].split('-')
  return `${dd}/${m}/${y}`
}

// ─── GERAÇÃO DE TERMOS JURÍDICOS ─────────────────────────────────────────────
function gerarTermoHTML(cautela_id, tipo) {
  const c = db.prepare(`
    SELECT c.*, l.nome lider_nome, l.email lider_email, l.cargo lider_cargo,
      l.cpf_cnpj lider_cpf_cnpj, l.empresa lider_empresa, l.endereco lider_endereco
    FROM cautelas c JOIN usuarios l ON l.id=c.lider_id WHERE c.id=?`).get(cautela_id)
  if (!c) return null

  const itens = db.prepare(`
    SELECT ci.quantidade, f.nome, f.codigo, f.categoria,
      COALESCE(f.valor_unitario,0) valor_unitario,
      (ci.quantidade * COALESCE(f.valor_unitario,0)) valor_item
    FROM cautela_itens ci JOIN ferramentas f ON f.id=ci.ferramenta_id
    WHERE ci.cautela_id=?`).all(cautela_id)

  const valorTotal = itens.reduce((s, i) => s + (i.valor_item || 0), 0)
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const styles = `<style>
    @page{margin:2cm}*{box-sizing:border-box}
    body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000;line-height:1.6}
    h1{font-size:14pt;text-align:center;text-transform:uppercase;margin-bottom:4px}
    h2{font-size:11pt;text-align:center;margin-bottom:20px;color:#444}
    .hdr{text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px}
    .hdr .co{font-size:15pt;font-weight:bold}
    .partes{margin:20px 0;padding:12px;border:1px solid #ccc;background:#f9f9f9;border-radius:4px}
    .cl{margin:16px 0}.cl h4{font-size:12pt;font-weight:bold;margin-bottom:6px}
    .cl ul{padding-left:24px}.cl li{margin-bottom:4px}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11pt}
    th{background:#1B2D45;color:#fff;padding:6px 8px;text-align:left}
    td{padding:5px 8px;border-bottom:1px solid #ddd}
    tr:nth-child(even) td{background:#f5f5f5}
    .tr-total td{font-weight:bold;border-top:2px solid #000}
    .assinaturas{margin-top:40px;display:flex;justify-content:space-around;gap:40px}
    .asb{flex:1;text-align:center}
    .asb img{max-width:200px;max-height:80px;display:block;margin:0 auto 4px}
    .audit{margin-top:30px;padding:10px;border:1px solid #ccc;background:#f0f0f0;font-size:9pt;font-family:monospace}
    .no-print{text-align:center;margin-top:20px}
    @media print{.no-print{display:none}}
  </style>`

  const tabelaItens = `<table>
    <thead><tr><th>#</th><th>Ferramenta</th><th>Código</th><th>Qtd.</th><th style="text-align:right">Valor Unit.</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itens.map((i, n) => `<tr><td>${n+1}</td><td>${i.nome}</td><td>${i.codigo||'—'}</td>
      <td style="text-align:center">${i.quantidade}</td>
      <td style="text-align:right">${fmtBRL(i.valor_unitario)}</td>
      <td style="text-align:right">${fmtBRL(i.valor_item)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="tr-total"><td colspan="5" style="text-align:right">VALOR TOTAL:</td>
      <td style="text-align:right">${fmtBRL(valorTotal)}</td></tr></tfoot>
  </table>`

  const printBtn = `<div class="no-print"><button onclick="window.print()"
    style="padding:10px 30px;background:#1B2D45;color:#fff;border:none;cursor:pointer;font-size:14px;border-radius:6px">
    Imprimir / Salvar PDF</button></div>`

  if (tipo === 'comodato') {
    const cnpj = c.lider_cpf_cnpj || 'CPF/CNPJ não informado'
    const empresa = c.lider_empresa || c.lider_nome
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Termo de Comodato — ${c.numero}</title>${styles}</head><body>
<div class="hdr"><div class="co">${EMPRESA.razaoSocial}</div><div>Sistema de Controle de Ferramentas</div></div>
<h1>Termo de Comodato de Ferramentas e Equipamentos</h1>
<h2>Cautela nº ${c.numero} — Retirada em ${fmtData(c.data_retirada || c.criado_em)}</h2>
<div class="partes"><h3>IDENTIFICAÇÃO DAS PARTES</h3>
<p><strong>COMODANTE:</strong> ${EMPRESA.razaoSocial}, CNPJ nº ${EMPRESA.cnpj}, com sede em ${EMPRESA.endereco}.</p>
<p><strong>COMODATÁRIA:</strong> ${empresa}, CNPJ/CPF nº ${cnpj}${c.lider_endereco ? ', ' + c.lider_endereco : ''}, representada por ${c.lider_nome} (${c.lider_email}).</p>
</div>
<div class="cl"><h4>CLÁUSULA 1ª – DO OBJETO</h4>
<p>A COMODANTE entrega à COMODATÁRIA, em regime de comodato gratuito nos termos dos Arts. 579–585 do Código Civil, os itens abaixo:</p>
${tabelaItens}</div>
<div class="cl"><h4>CLÁUSULA 2ª – DO PRAZO</h4>
<p>Prazo indeterminado, enquanto durar a relação contratual, podendo ser encerrado com 48h de antecedência ou imediatamente em caso de descumprimento.</p></div>
<div class="cl"><h4>CLÁUSULA 3ª – DAS OBRIGAÇÕES</h4><ul>
<li>Zelar pela conservação e guarda, usando exclusivamente para os fins destinados;</li>
<li>Não ceder, sublocar ou transferir a terceiros sem autorização formal registrada no sistema;</li>
<li>Comunicar avarias, extravios ou necessidade de manutenção em até <strong>24 horas</strong>;</li>
<li>Devolver em perfeitas condições em até 48h após encerramento do comodato.</li>
</ul></div>
<div class="cl"><h4>CLÁUSULA 4ª – DA RESPONSABILIDADE</h4><ul>
<li>Responde por danos causados por uso inadequado, negligência ou imperícia pelo <strong>valor de reposição declarado</strong>;</li>
<li><strong>Desgaste natural</strong> pelo uso correto <strong>não gera responsabilidade</strong>;</li>
<li>Em caso de furto, apresentar BO em até 48h;</li>
<li>Responsabilidade total: <strong>${fmtBRL(valorTotal)}</strong>.</li>
</ul></div>
<div class="cl"><h4>CLÁUSULA 5ª – DA CLÁUSULA PENAL</h4>
<p>Multa de <strong>20%</strong> sobre o valor dos itens não devolvidos ou danificados, sem prejuízo da reposição integral e perdas e danos.</p></div>
<div class="cl"><h4>CLÁUSULA 6ª – DA ASSINATURA ELETRÔNICA</h4>
<p>Validade jurídica plena nos termos da <strong>Lei nº 14.063/2020</strong> e <strong>MP nº 2.200-2/2001</strong>.</p></div>
<div class="cl"><h4>CLÁUSULA 7ª – DO FORO</h4>
<p>Foro da comarca de <strong>${EMPRESA.cidade}</strong>, com renúncia a qualquer outro.</p></div>
<p style="text-align:center;margin-top:30px">${EMPRESA.cidade}, ${hoje}</p>
<div class="assinaturas">
  <div class="asb">
    <div style="height:70px;border-bottom:1px solid #000"></div>
    <div><strong>COMODANTE</strong></div><div>${EMPRESA.razaoSocial}</div><div>CNPJ: ${EMPRESA.cnpj}</div>
  </div>
  <div class="asb">
    ${c.assinatura_lider ? `<img src="${c.assinatura_lider}" height="80" alt="Assinatura">` : '<div style="height:70px;border-bottom:1px solid #000"></div>'}
    <div><strong>COMODATÁRIA</strong></div><div>${empresa}</div><div>CNPJ/CPF: ${cnpj}</div><div>Por: ${c.lider_nome}</div>
  </div>
</div>
<div class="audit"><h5>REGISTRO DE AUTENTICIDADE</h5>
<p>Cautela: ${c.numero} | ID: ${c.id} | Sistema: Controle de Ferramentas — ${EMPRESA.razaoSocial}</p>
<p>Líder: ${c.lider_nome} &lt;${c.lider_email}&gt;</p>
${c.ip_lider ? `<p>IP dispositivo: ${c.ip_lider}</p>` : ''}
<p>Criado em: ${c.criado_em} | Lei 14.063/2020 e MP 2.200-2/2001</p></div>
${printBtn}</body></html>`
  }

  // tipo === 'devolucao' — Recibo de devolução
  if (tipo === 'devolucao') {
    if (c.status !== 'devolvida' || !c.assinatura_devolucao) return null
    const hoje = new Date(c.data_devolucao || c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Recibo de Devolução — ${c.numero}</title>${styles}</head><body>
<div class="hdr"><div class="co">${EMPRESA.razaoSocial}</div><div>Recibo de Devolução de Ferramentas</div></div>
<h1>Recibo de Devolução</h1>
<h2>Cautela nº ${c.numero} — Devolvida em ${hoje}</h2>
<div class="partes">
<p><strong>EMPRESA:</strong> ${EMPRESA.razaoSocial}, CNPJ nº ${EMPRESA.cnpj}.</p>
<p><strong>LÍDER RESPONSÁVEL:</strong> ${c.lider_nome} (${c.lider_email})${c.lider_cpf_cnpj ? ' — CPF/CNPJ: ' + c.lider_cpf_cnpj : ''}.</p>
</div>
<p style="margin:12px 0">O Líder identificado acima declara ter devolvido ao almoxarifado da ${EMPRESA.razaoSocial} os itens listados abaixo, em boas condições de uso, salvo desgaste natural.</p>
${tabelaItens}
${c.obs_devolucao ? `<div class="cl"><h4>Observações</h4><p>${c.obs_devolucao}</p></div>` : ''}
<p style="text-align:center;margin-top:30px">${EMPRESA.cidade}, ${hoje}</p>
<div class="assinaturas">
  <div class="asb">
    ${c.assinatura_devolucao ? `<img src="${c.assinatura_devolucao}" height="80" alt="Assinatura Devolução">` : '<div style="height:70px;border-bottom:1px solid #000"></div>'}
    <div><strong>DEVOLVEU</strong></div><div>${c.lider_nome}</div>
  </div>
  <div class="asb">
    <div style="height:70px;border-bottom:1px solid #000"></div>
    <div><strong>RECEBEU</strong></div><div>${EMPRESA.razaoSocial}</div><div>Almoxarifado</div>
  </div>
</div>
<div class="audit"><h5>REGISTRO DE AUTENTICIDADE</h5>
<p>Cautela: ${c.numero} | Devolução em: ${c.data_devolucao}</p>
<p>Líder: ${c.lider_nome} &lt;${c.lider_email}&gt;</p>
${c.ip_devolucao ? `<p>IP dispositivo: ${c.ip_devolucao}</p>` : ''}
<p>Lei 14.063/2020 e MP 2.200-2/2001</p></div>
${printBtn}</body></html>`
  }

  // tipo === 'ciencia_direta' — Operário retira diretamente do almoxarifado (sem PJ)
  if (tipo === 'ciencia_direta') {
    const responsavel = c.lider_nome  // lider_id guarda o operário neste fluxo
    const responsavelEmail = c.lider_email
    const op = db.prepare('SELECT cpf_cnpj, cargo FROM usuarios WHERE id=?').get(c.lider_id) || {}
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Termo de Ciência e Responsabilidade — ${c.numero}</title>${styles}</head><body>
<div class="hdr">
  <div class="co">${EMPRESA.razaoSocial}</div>
  <div>CNPJ: ${EMPRESA.cnpj} — ${EMPRESA.endereco}</div>
  <div style="margin-top:4px;font-weight:bold;font-size:13pt">TERMO DE CIÊNCIA E RESPONSABILIDADE — FERRAMENTAS E EQUIPAMENTOS</div>
</div>

<div class="partes">
  <p><strong>EMPRESA:</strong> ${EMPRESA.razaoSocial}, CNPJ nº ${EMPRESA.cnpj}, com sede em ${EMPRESA.endereco}.</p>
  <p><strong>COLABORADOR:</strong> ${responsavel}${op.cargo ? ' — ' + op.cargo : ''}${op.cpf_cnpj ? ' — CPF/CNPJ: ' + op.cpf_cnpj : ''}.</p>
  <p><strong>CAUTELA Nº:</strong> ${c.numero} &nbsp;|&nbsp; <strong>DATA:</strong> ${fmtData(c.data_retirada || c.criado_em)}</p>
</div>

<div class="cl"><h4>CLÁUSULA 1ª — DO OBJETO</h4>
<p>O colaborador identificado acima declara ter recebido do almoxarifado da <strong>${EMPRESA.razaoSocial}</strong>, em perfeitas condições de uso e funcionamento, os materiais e ferramentas descritos abaixo:</p>
${tabelaItens}
<p style="margin-top:8px">Valor total dos itens sob responsabilidade do colaborador: <strong>${fmtBRL(valorTotal)}</strong>.</p>
</div>

<div class="cl"><h4>CLÁUSULA 2ª — DAS OBRIGAÇÕES DO COLABORADOR</h4>
<p>O colaborador compromete-se a:</p><ul>
<li>Utilizar os itens exclusivamente nas atividades profissionais determinadas pela empresa;</li>
<li>Zelar pela conservação, guarda e correto manuseio das ferramentas e equipamentos;</li>
<li>Não emprestar, ceder ou transferir os equipamentos a terceiros sem autorização expressa e formal da empresa;</li>
<li>Comunicar <strong>imediatamente</strong> ao responsável do almoxarifado qualquer dano, perda, extravio ou necessidade de manutenção;</li>
<li>Realizar a devolução integral de todos os itens ao almoxarifado em caso de <strong>desligamento, troca de função, transferência ou solicitação da empresa</strong>, independentemente do motivo.</li>
</ul></div>

<div class="cl"><h4>CLÁUSULA 3ª — DA RESPONSABILIDADE FINANCEIRA E DESCONTOS</h4><ul>
<li>O colaborador está ciente de que danos causados por <strong>mau uso, negligência, extravio ou não devolução</strong> das ferramentas e equipamentos gerarão responsabilização conforme as normas internas da empresa e a legislação aplicável;</li>
<li>Os valores correspondentes aos itens danificados, extraviados ou não devolvidos <strong>poderão ser descontados das verbas rescisórias</strong> ao término do contrato de trabalho, nos termos do art. 462, §1º da CLT e do art. 477 da Consolidação das Leis do Trabalho, mediante prévia autorização do colaborador, conforme expresso neste termo;</li>
<li>Desgaste natural decorrente do uso correto e adequado <strong>não gera responsabilidade financeira</strong>;</li>
<li>Em caso de furto ou roubo, o colaborador deverá apresentar Boletim de Ocorrência ao almoxarifado em até <strong>48 horas</strong> do evento.</li>
</ul></div>

<div class="cl"><h4>CLÁUSULA 4ª — DA DIVISÃO DE CUSTO DO KIT DE FERRAMENTAS</h4>
<p>Fica acordado entre as partes que o custo referente à bolsa de ferramentas (kit completo) será dividido da seguinte forma:</p><ul>
<li><strong>20% (vinte por cento)</strong> do valor total será custeado pela empresa;</li>
<li><strong>80% (oitenta por cento)</strong> do valor total será de responsabilidade do colaborador.</li>
</ul>
<p>Em caso de perda, extravio, dano por mau uso ou não devolução dos itens pertencentes ao kit, o colaborador autoriza o desconto proporcional dos valores correspondentes, conforme relação descrita neste termo.</p></div>

<div class="cl"><h4>CLÁUSULA 5ª — DA VALIDADE JURÍDICA E ASSINATURA ELETRÔNICA</h4>
<p>O presente termo possui <strong>validade jurídica plena</strong> como documento eletrônico, nos termos da <strong>Lei nº 14.063/2020</strong> (Assinatura Eletrônica de Documentos) e da <strong>MP nº 2.200-2/2001</strong> (Infraestrutura de Chaves Públicas Brasileira — ICP-Brasil). A autenticação do colaborador por login e senha pessoal no sistema de Controle de Ferramentas equivale à sua assinatura eletrônica, com plena eficácia probatória, constituindo ato jurídico perfeito nos termos do art. 104 do Código Civil Brasileiro.</p></div>

<div class="cl"><h4>CLÁUSULA 6ª — DO FORO</h4>
<p>As partes elegem o foro da comarca de <strong>${EMPRESA.cidade}</strong> para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p></div>

<p style="text-align:center;margin-top:30px">${EMPRESA.cidade}, ${hoje}</p>
<div class="assinaturas">
  <div class="asb">
    <div style="height:70px;border-bottom:1px solid #000"></div>
    <div><strong>RESPONSÁVEL PELA ENTREGA</strong></div>
    <div>${EMPRESA.razaoSocial}</div>
    <div>Almoxarifado</div>
  </div>
  <div class="asb">
    ${c.assinatura_lider ? `<img src="${c.assinatura_lider}" height="80" alt="Assinatura do Colaborador">` : '<div style="height:70px;border-bottom:1px solid #000"></div>'}
    <div><strong>COLABORADOR RESPONSÁVEL</strong></div>
    <div>${responsavel}</div>
    ${op.cpf_cnpj ? `<div>CPF/CNPJ: ${op.cpf_cnpj}</div>` : ''}
  </div>
</div>

<div class="audit"><h5>REGISTRO DE AUTENTICIDADE ELETRÔNICA</h5>
<p>Cautela: ${c.numero} | ID: ${c.id} | Tipo: Retirada Direta — Colaborador CLT</p>
<p>Colaborador: ${responsavel} &lt;${responsavelEmail}&gt;</p>
${c.ip_lider ? `<p>IP do dispositivo no momento da autenticação: ${c.ip_lider}</p>` : ''}
<p>Registro em: ${c.criado_em} | Validade: Lei nº 14.063/2020 · MP nº 2.200-2/2001 · Art. 104 CC · Art. 462 CLT</p></div>
${printBtn}</body></html>`
  }

  // tipo === 'ciencia' — Líder ↔ Operário
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Termos de Ciência — ${c.numero}</title>${styles}</head><body>
<div class="hdr"><div class="co">TERMOS DE CIÊNCIA POR OPERÁRIO</div>
<div>Cautela nº ${c.numero} — ${EMPRESA.razaoSocial}</div></div>
<h1>Termos de Responsabilidade e Ciência</h1>
${(() => {
  const entregas = db.prepare(`
    SELECT ce.*, o.nome op_nome, o.email op_email, o.cpf_cnpj op_cpf_cnpj, o.empresa op_empresa
    FROM cautela_entregas ce JOIN usuarios o ON o.id=ce.operario_id
    WHERE ce.cautela_id=?`).all(cautela_id)
  return entregas.map((e, idx) => {
    const eitens = db.prepare(`
      SELECT cei.quantidade, f.nome, f.codigo, COALESCE(f.valor_unitario,0) valor_unitario,
        (cei.quantidade * COALESCE(f.valor_unitario,0)) valor_item
      FROM cautela_entrega_itens cei JOIN ferramentas f ON f.id=cei.ferramenta_id
      WHERE cei.entrega_id=?`).all(e.id)
    const vt = eitens.reduce((s, i) => s + i.valor_item, 0)
    return `<div style="margin-bottom:40px;padding:16px;border:1px solid #ccc;border-radius:6px">
      <h3>Termo ${idx+1} — ${e.op_nome}</h3>
      <p><strong>Responsável principal:</strong> ${c.lider_nome} (${c.lider_email})</p>
      <p><strong>Responsável secundário:</strong> ${e.op_empresa || e.op_nome} — CNPJ/CPF: ${e.op_cpf_cnpj || 'não informado'}</p>
      <p><strong>Data de entrega:</strong> ${fmtData(e.data_entrega)}</p>
      <table><thead><tr><th>Ferramenta</th><th>Código</th><th>Qtd.</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${eitens.map(i=>`<tr><td>${i.nome}</td><td>${i.codigo||'—'}</td><td style="text-align:center">${i.quantidade}</td><td style="text-align:right">${fmtBRL(i.valor_item)}</td></tr>`).join('')}</tbody>
      <tfoot><tr class="tr-total"><td colspan="3" style="text-align:right">TOTAL SOB RESPONSABILIDADE:</td><td style="text-align:right">${fmtBRL(vt)}</td></tr></tfoot></table>
      <p style="font-size:10pt;margin-top:8px">O responsável secundário declara ciência de que o desgaste natural não gera responsabilidade, porém perdas, extravios ou danos por uso inadequado implicam reposição integral acrescida de multa de 20%. Assinatura eletrônica com validade pela Lei 14.063/2020.</p>
      <div class="assinaturas" style="margin-top:20px">
        <div class="asb">
          ${c.assinatura_lider ? `<img src="${c.assinatura_lider}" height="60" alt="Assinatura Líder">` : '<div style="height:60px;border-bottom:1px solid #000"></div>'}
          <div><strong>Responsável principal</strong></div><div>${c.lider_nome}</div>
        </div>
        <div class="asb">
          ${e.assinatura_operario ? `<img src="${e.assinatura_operario}" height="60" alt="Assinatura Operário">` : '<div style="height:60px;border-bottom:1px dashed #999;color:#999;display:flex;align-items:flex-end;justify-content:center">Aguardando</div>'}
          <div><strong>Responsável secundário</strong></div><div>${e.op_nome}</div>
          ${e.ip_operario ? `<div style="font-size:9pt;color:#666">IP: ${e.ip_operario}</div>` : ''}
        </div>
      </div></div>`
  }).join('')
})()}
${printBtn}</body></html>`
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, senha } = req.body
  const u = db.prepare('SELECT * FROM usuarios WHERE LOWER(email)=LOWER(?) AND ativo=1').get(email)
  if (!u || !bcrypt.compareSync(senha, u.senha_hash))
    return res.status(401).json({ error: 'Email ou senha incorretos' })
  const payload = { id: u.id, nome: u.nome, email: u.email, role: u.role, cargo: u.cargo, primeiro_acesso: u.primeiro_acesso || 0 }
  const token = jwt.sign(payload, SECRET, { expiresIn: '8h' })
  audit(u.id, 'LOGIN', 'usuarios', u.id, 'Login realizado')
  res.json({ token, user: payload })
})

// Download do backup (somente almoxarifado)
app.get('/api/admin/backup', auth(['almoxarifado']), (req, res) => {
  try {
    const data = new Date().toISOString().slice(0, 10)
    const dest = path.join(BACKUP_DIR, `backup-${data}.db`)
    fs.copyFileSync(DB_PATH, dest)
    res.download(dest, `cautela-backup-${data}.db`)
  } catch (e) { res.status(500).json({ error: 'Erro ao gerar backup: ' + e.message }) }
})

app.get('/api/auth/me', auth(), (req, res) => {
  const u = db.prepare('SELECT id,nome,email,cargo,role,primeiro_acesso FROM usuarios WHERE id=?').get(req.user.id)
  res.json(u)
})

app.post('/api/auth/trocar-senha', auth(), (req, res) => {
  const { nova_senha, aceite_termos } = req.body
  if (!aceite_termos) return res.status(400).json({ error: 'Você deve aceitar os termos de responsabilidade.' })
  if (!nova_senha || nova_senha.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' })
  db.prepare('UPDATE usuarios SET senha_hash=?, primeiro_acesso=0 WHERE id=?')
    .run(bcrypt.hashSync(nova_senha, 10), req.user.id)
  const u = db.prepare('SELECT * FROM usuarios WHERE id=?').get(req.user.id)
  const payload = { id: u.id, nome: u.nome, email: u.email, role: u.role, cargo: u.cargo, primeiro_acesso: 0 }
  const newToken = jwt.sign(payload, SECRET, { expiresIn: '8h' })
  audit(req.user.id, 'TROCAR_SENHA_PRIMEIRO_ACESSO', 'usuarios', req.user.id, {})
  res.json({ token: newToken, user: payload })
})

// Validar credenciais sem gerar token (usado para auth no dispositivo)
app.post('/api/auth/validar', auth(), (req, res) => {
  const { email, senha, role_esperado } = req.body
  const u = db.prepare('SELECT * FROM usuarios WHERE LOWER(email)=LOWER(?) AND ativo=1').get(email)
  if (!u || !bcrypt.compareSync(senha, u.senha_hash))
    return res.status(401).json({ error: 'Email ou senha incorretos' })
  if (role_esperado && u.role !== role_esperado)
    return res.status(403).json({ error: `Esperado perfil ${role_esperado}, encontrado ${u.role}` })
  res.json({ id: u.id, nome: u.nome, email: u.email, role: u.role, cargo: u.cargo, cpf_cnpj: u.cpf_cnpj, empresa: u.empresa })
})

// ─── USUÁRIOS ─────────────────────────────────────────────────────────────────
app.get('/api/usuarios', auth(['almoxarifado', 'lider']), (req, res) => {
  const { role } = req.query
  let q = 'SELECT id,nome,email,cargo,role,ativo,cpf_cnpj,empresa,endereco,telefone FROM usuarios WHERE 1=1'
  const p = []
  if (role) { q += ' AND role=?'; p.push(role) }
  q += ' ORDER BY nome'
  res.json(db.prepare(q).all(...p))
})

// Busca por email exato (para empréstimos entre operários)
app.get('/api/usuarios/buscar', auth(), (req, res) => {
  const { email } = req.query
  if (!email) return res.json(null)
  const u = db.prepare("SELECT id,nome,email,cargo,role FROM usuarios WHERE LOWER(email)=LOWER(?) AND ativo=1 AND role='operario'").get(email)
  res.json(u || null)
})

// Líderes (para operário selecionar no empréstimo)
app.get('/api/usuarios/lideres', auth(), (req, res) => {
  res.json(db.prepare("SELECT id,nome,email,cargo FROM usuarios WHERE role='lider' AND ativo=1 ORDER BY nome").all())
})

app.post('/api/usuarios', auth(['almoxarifado']), (req, res) => {
  const { nome, email, senha, cargo, role, cpf_cnpj, empresa, endereco, telefone } = req.body
  if (!['lider', 'operario'].includes(role)) return res.status(400).json({ error: 'Role inválido' })
  try {
    const r = db.prepare('INSERT INTO usuarios (nome,email,senha_hash,cargo,role,cpf_cnpj,empresa,endereco,telefone,primeiro_acesso) VALUES (?,?,?,?,?,?,?,?,?,1)')
      .run(nome, email, bcrypt.hashSync(senha, 10), cargo || '', role, cpf_cnpj || null, empresa || null, endereco || null, telefone || null)
    audit(req.user.id, 'CRIAR_USUARIO', 'usuarios', r.lastInsertRowid, { nome, role })
    res.json({ id: r.lastInsertRowid })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email já cadastrado' })
    throw e
  }
})

app.put('/api/usuarios/:id', auth(['almoxarifado']), (req, res) => {
  const { nome, cargo, ativo, senha, cpf_cnpj, empresa, endereco, telefone } = req.body
  const base = 'UPDATE usuarios SET nome=?,cargo=?,ativo=?,cpf_cnpj=?,empresa=?,endereco=?,telefone=?'
  if (senha) {
    db.prepare(base + ',senha_hash=? WHERE id=?')
      .run(nome, cargo, ativo ? 1 : 0, cpf_cnpj || null, empresa || null, endereco || null, telefone || null, bcrypt.hashSync(senha, 10), req.params.id)
  } else {
    db.prepare(base + ' WHERE id=?')
      .run(nome, cargo, ativo ? 1 : 0, cpf_cnpj || null, empresa || null, endereco || null, telefone || null, req.params.id)
  }
  audit(req.user.id, 'EDITAR_USUARIO', 'usuarios', req.params.id, { nome, ativo })
  res.json({ ok: true })
})

app.delete('/api/usuarios/:id', auth(['almoxarifado']), (req, res) => {
  const u = db.prepare('SELECT * FROM usuarios WHERE id=?').get(req.params.id)
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado' })
  if (u.role === 'almoxarifado') return res.status(400).json({ error: 'Não é possível excluir o administrador do sistema' })
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Não pode excluir seu próprio usuário' })
  const temCautela = db.prepare("SELECT id FROM cautelas WHERE lider_id=? AND status='ativa'").get(req.params.id)
  if (temCautela) return res.status(400).json({ error: 'Usuário possui cautela(s) ativa(s). Encerre-as antes de excluir.' })
  db.prepare('DELETE FROM usuarios WHERE id=?').run(req.params.id)
  audit(req.user.id, 'EXCLUIR_USUARIO', 'usuarios', req.params.id, { nome: u.nome, email: u.email })
  res.json({ ok: true })
})

// ─── FERRAMENTAS ──────────────────────────────────────────────────────────────
app.get('/api/ferramentas', auth(), (req, res) => {
  res.json(db.prepare('SELECT * FROM ferramentas ORDER BY nome').all())
})

app.post('/api/ferramentas', auth(['almoxarifado']), (req, res) => {
  let { nome, codigo, categoria, descricao, quantidade_total, valor_unitario } = req.body
  // Ferramenta com código de patrimônio é item único — quantidade sempre 1
  if (codigo && codigo.trim()) quantidade_total = 1
  try {
    const r = db.prepare('INSERT INTO ferramentas (nome,codigo,categoria,descricao,quantidade_total,valor_unitario) VALUES (?,?,?,?,?,?)')
      .run(nome, codigo || null, categoria || '', descricao || '', quantidade_total || 1, valor_unitario || 0)
    audit(req.user.id, 'CRIAR_FERRAMENTA', 'ferramentas', r.lastInsertRowid, { nome, codigo })
    res.json({ id: r.lastInsertRowid })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Código de patrimônio já cadastrado' })
    throw e
  }
})

app.put('/api/ferramentas/:id', auth(['almoxarifado']), (req, res) => {
  let { nome, codigo, categoria, descricao, quantidade_total, valor_unitario } = req.body
  const atual = db.prepare('SELECT * FROM ferramentas WHERE id=?').get(req.params.id)
  if (!atual) return res.status(404).json({ error: 'Ferramenta não encontrada' })
  // Se tem código (atual ou novo), mantém quantidade 1 e não permite alterar código existente
  const codigoFinal = atual.codigo || (codigo && codigo.trim() ? codigo.trim() : null)
  if (codigoFinal) quantidade_total = 1
  db.prepare('UPDATE ferramentas SET nome=?,codigo=?,categoria=?,descricao=?,quantidade_total=?,valor_unitario=? WHERE id=?')
    .run(nome, codigoFinal, categoria, descricao, quantidade_total, valor_unitario || 0, req.params.id)
  audit(req.user.id, 'EDITAR_FERRAMENTA', 'ferramentas', req.params.id, { nome })
  res.json({ ok: true })
})

app.delete('/api/ferramentas/:id', auth(['almoxarifado']), (req, res) => {
  const f = db.prepare('SELECT * FROM ferramentas WHERE id=?').get(req.params.id)
  if (!f) return res.status(404).json({ error: 'Ferramenta não encontrada' })
  if (f.codigo && f.codigo.trim()) return res.status(400).json({ error: 'Ferramentas com código de patrimônio não podem ser excluídas' })
  db.prepare('DELETE FROM ferramentas WHERE id=?').run(req.params.id)
  audit(req.user.id, 'EXCLUIR_FERRAMENTA', 'ferramentas', req.params.id, null)
  res.json({ ok: true })
})

// ─── BOLSAS ───────────────────────────────────────────────────────────────────
app.get('/api/bolsas', auth(), (req, res) => {
  const bolsas = db.prepare('SELECT * FROM bolsas ORDER BY nome').all()
  const itensStmt = db.prepare(`
    SELECT bi.*,f.nome ferramenta_nome,f.codigo,f.categoria,COALESCE(f.valor_unitario,0) valor_unitario
    FROM bolsa_itens bi JOIN ferramentas f ON f.id=bi.ferramenta_id WHERE bi.bolsa_id=?`)
  for (const b of bolsas) {
    b.itens = itensStmt.all(b.id)
    b.valor_total = b.itens.reduce((s, i) => s + i.valor_unitario * i.quantidade, 0)
  }
  res.json(bolsas)
})

app.post('/api/bolsas', auth(['almoxarifado']), (req, res) => {
  const { nome, descricao, itens } = req.body
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO bolsas (nome,descricao) VALUES (?,?)').run(nome, descricao || '')
    const ins = db.prepare('INSERT INTO bolsa_itens (bolsa_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of (itens || [])) ins.run(r.lastInsertRowid, it.ferramenta_id, it.quantidade)
    return r.lastInsertRowid
  })()
  audit(req.user.id, 'CRIAR_BOLSA', 'bolsas', id, { nome })
  res.json({ id })
})

app.put('/api/bolsas/:id', auth(['almoxarifado']), (req, res) => {
  const { nome, descricao, itens } = req.body
  db.transaction(() => {
    db.prepare('UPDATE bolsas SET nome=?,descricao=? WHERE id=?').run(nome, descricao || '', req.params.id)
    db.prepare('DELETE FROM bolsa_itens WHERE bolsa_id=?').run(req.params.id)
    const ins = db.prepare('INSERT INTO bolsa_itens (bolsa_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of (itens || [])) ins.run(req.params.id, it.ferramenta_id, it.quantidade)
  })()
  audit(req.user.id, 'EDITAR_BOLSA', 'bolsas', req.params.id, { nome })
  res.json({ ok: true })
})

// ─── SOLICITAÇÕES ─────────────────────────────────────────────────────────────
const solQuery = `
  SELECT s.*, l.nome lider_nome, l.cargo lider_cargo, l.email lider_email,
    b.nome bolsa_nome
  FROM solicitacoes s
  JOIN usuarios l ON l.id=s.lider_id
  LEFT JOIN bolsas b ON b.id=s.bolsa_id`

const solItensQuery = `
  SELECT si.*, f.nome ferramenta_nome, f.codigo, COALESCE(f.valor_unitario,0) valor_unitario,
    (si.quantidade * COALESCE(f.valor_unitario,0)) valor_item
  FROM solicitacao_itens si JOIN ferramentas f ON f.id=si.ferramenta_id
  WHERE si.solicitacao_id=?`

app.get('/api/solicitacoes', auth(), (req, res) => {
  let q = solQuery + ' WHERE 1=1'
  const p = []
  if (req.user.role === 'lider') { q += ' AND s.lider_id=?'; p.push(req.user.id) }
  q += ' ORDER BY s.criado_em DESC'
  const lista = db.prepare(q).all(...p)
  const itensStmt = db.prepare(solItensQuery)
  for (const s of lista) {
    s.itens = itensStmt.all(s.id)
    s.valor_total = s.itens.reduce((acc, i) => acc + i.valor_item, 0)
  }
  res.json(lista)
})

app.get('/api/solicitacoes/:id', auth(), (req, res) => {
  const s = db.prepare(solQuery + ' WHERE s.id=?').get(req.params.id)
  if (!s) return res.status(404).json({ error: 'Não encontrada' })
  s.itens = db.prepare(solItensQuery).all(s.id)
  s.valor_total = s.itens.reduce((acc, i) => acc + i.valor_item, 0)
  res.json(s)
})

// Almoxarifado cria solicitação em nome de operário — operário autentica no dispositivo
app.post('/api/solicitacoes/por-operario', auth(['almoxarifado']), (req, res) => {
  const { operario_id, bolsa_id, itens, obs, email_operario, senha_operario } = req.body
  if (!operario_id) return res.status(400).json({ error: 'Operário obrigatório' })
  if (!email_operario || !senha_operario) return res.status(400).json({ error: 'Login do operário obrigatório' })
  const op = db.prepare("SELECT * FROM usuarios WHERE id=? AND role='operario' AND ativo=1").get(operario_id)
  if (!op) return res.status(404).json({ error: 'Operário não encontrado' })
  // Valida credenciais do operário
  if (op.email.toLowerCase() !== email_operario.trim().toLowerCase())
    return res.status(401).json({ error: 'Email não corresponde ao operário selecionado' })
  if (!bcrypt.compareSync(senha_operario, op.senha_hash))
    return res.status(401).json({ error: 'Senha incorreta' })
  // Resolve itens: da bolsa ou avulsos
  let itensFinal = itens || []
  if (bolsa_id && !itensFinal.length) {
    itensFinal = db.prepare('SELECT ferramenta_id, quantidade FROM bolsa_itens WHERE bolsa_id=?').all(bolsa_id)
  }
  if (!itensFinal.length) return res.status(400).json({ error: 'Adicione ao menos um item ou selecione uma bolsa' })
  const ip = getIP(req)
  const marcador = 'AUTH:' + new Date().toISOString()
  const id = db.transaction(() => {
    const numero = gerarNumero('SOL')
    const r = db.prepare('INSERT INTO solicitacoes (numero,lider_id,bolsa_id,obs,assinatura_solicitante,ip_solicitante) VALUES (?,?,?,?,?,?)')
      .run(numero, operario_id, bolsa_id || null, obs || '', marcador, ip)
    const ins = db.prepare('INSERT INTO solicitacao_itens (solicitacao_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of itensFinal) ins.run(r.lastInsertRowid, it.ferramenta_id, it.quantidade)
    return r.lastInsertRowid
  })()
  audit(req.user.id, 'CRIAR_SOLICITACAO', 'solicitacoes', id, { operario: op.nome, obs })
  res.json({ id })
})

app.post('/api/solicitacoes', auth(['lider']), (req, res) => {
  const { bolsa_id, itens, obs } = req.body
  if (!itens || !itens.length) return res.status(400).json({ error: 'Adicione ao menos um item' })
  const id = db.transaction(() => {
    const numero = gerarNumero('SOL')
    const r = db.prepare('INSERT INTO solicitacoes (numero,lider_id,bolsa_id,obs) VALUES (?,?,?,?)')
      .run(numero, req.user.id, bolsa_id || null, obs || '')
    const ins = db.prepare('INSERT INTO solicitacao_itens (solicitacao_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of itens) ins.run(r.lastInsertRowid, it.ferramenta_id, it.quantidade)
    return r.lastInsertRowid
  })()
  audit(req.user.id, 'CRIAR_SOLICITACAO', 'solicitacoes', id, { obs })
  res.json({ id })
})

app.post('/api/solicitacoes/:id/separando', auth(['almoxarifado']), (req, res) => {
  const s = db.prepare('SELECT * FROM solicitacoes WHERE id=?').get(req.params.id)
  if (!s || s.status !== 'solicitada') return res.status(400).json({ error: 'Status inválido' })
  db.prepare("UPDATE solicitacoes SET status='separando',obs_almoxarifado=? WHERE id=?")
    .run(req.body.obs || '', req.params.id)
  audit(req.user.id, 'SOLICITACAO_SEPARANDO', 'solicitacoes', req.params.id, null)
  res.json({ ok: true })
})

// Editar itens da solicitação enquanto em separação
app.put('/api/solicitacoes/:id/itens', auth(['almoxarifado']), (req, res) => {
  const s = db.prepare('SELECT * FROM solicitacoes WHERE id=?').get(req.params.id)
  if (!s || s.status !== 'separando') return res.status(400).json({ error: 'Só é possível editar itens durante a separação' })
  const { itens } = req.body
  if (!itens || !itens.length) return res.status(400).json({ error: 'A lista não pode ficar vazia' })
  db.transaction(() => {
    db.prepare('DELETE FROM solicitacao_itens WHERE solicitacao_id=?').run(s.id)
    const ins = db.prepare('INSERT INTO solicitacao_itens (solicitacao_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of itens) ins.run(s.id, it.ferramenta_id, it.quantidade)
  })()
  audit(req.user.id, 'EDITAR_ITENS_SOLICITACAO', 'solicitacoes', s.id, { itens: itens.length })
  res.json({ ok: true })
})

app.post('/api/solicitacoes/:id/pronta', auth(['almoxarifado']), (req, res) => {
  const s = db.prepare('SELECT * FROM solicitacoes WHERE id=?').get(req.params.id)
  if (!s || s.status !== 'separando') return res.status(400).json({ error: 'Status inválido' })

  // Cria a cautela automaticamente
  const cautela_id = db.transaction(() => {
    db.prepare("UPDATE solicitacoes SET status='pronta' WHERE id=?").run(req.params.id)
    const itens = db.prepare('SELECT * FROM solicitacao_itens WHERE solicitacao_id=?').all(req.params.id)
    let valor_total = 0
    for (const it of itens) {
      const f = db.prepare('SELECT COALESCE(valor_unitario,0) v FROM ferramentas WHERE id=?').get(it.ferramenta_id)
      if (f) valor_total += f.v * it.quantidade
    }
    const numero = gerarNumero('CAU')
    const tipo = s.assinatura_solicitante ? 'direto' : 'lider'
    const r = db.prepare('INSERT INTO cautelas (numero,solicitacao_id,lider_id,status,valor_total,cautela_tipo) VALUES (?,?,?,?,?,?)')
      .run(numero, s.id, s.lider_id, 'aguardando_retirada', valor_total, tipo)
    const ins = db.prepare('INSERT INTO cautela_itens (cautela_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of itens) ins.run(r.lastInsertRowid, it.ferramenta_id, it.quantidade)
    return r.lastInsertRowid
  })()

  audit(req.user.id, 'SOLICITACAO_PRONTA', 'solicitacoes', req.params.id, { cautela_id })
  res.json({ ok: true, cautela_id })
})

app.post('/api/solicitacoes/:id/cancelar', auth(['almoxarifado', 'lider']), (req, res) => {
  const s = db.prepare('SELECT * FROM solicitacoes WHERE id=?').get(req.params.id)
  if (!s) return res.status(404).json({ error: 'Não encontrada' })
  if (req.user.role === 'lider' && s.lider_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão' })
  if (!['solicitada', 'separando'].includes(s.status)) return res.status(400).json({ error: 'Não pode cancelar neste status' })
  db.prepare("UPDATE solicitacoes SET status='cancelada' WHERE id=?").run(req.params.id)
  audit(req.user.id, 'CANCELAR_SOLICITACAO', 'solicitacoes', req.params.id, null)
  res.json({ ok: true })
})

// ─── CAUTELAS ─────────────────────────────────────────────────────────────────
const cautelaQuery = `
  SELECT c.*, l.nome lider_nome, l.cargo lider_cargo, l.email lider_email,
    l.cpf_cnpj lider_cpf_cnpj, l.empresa lider_empresa
  FROM cautelas c JOIN usuarios l ON l.id=c.lider_id`

const cautelaItensQuery = `
  SELECT ci.*, f.nome ferramenta_nome, f.codigo, f.categoria,
    COALESCE(f.valor_unitario,0) valor_unitario,
    (ci.quantidade * COALESCE(f.valor_unitario,0)) valor_item
  FROM cautela_itens ci JOIN ferramentas f ON f.id=ci.ferramenta_id
  WHERE ci.cautela_id=?`

app.get('/api/cautelas', auth(), (req, res) => {
  let q = cautelaQuery + ' WHERE 1=1'
  const p = []
  if (req.user.role === 'lider') { q += ' AND c.lider_id=?'; p.push(req.user.id) }
  else if (req.user.role === 'operario') {
    q += ' AND (c.id IN (SELECT cautela_id FROM cautela_entregas WHERE operario_id=?) OR (c.cautela_tipo=\'direto\' AND c.lider_id=?))'
    p.push(req.user.id, req.user.id)
  }
  q += ' ORDER BY c.criado_em DESC'
  const lista = db.prepare(q).all(...p)
  const itensStmt = db.prepare(cautelaItensQuery)
  for (const c of lista) c.itens = itensStmt.all(c.id)
  res.json(lista)
})

app.get('/api/cautelas/:id', auth(), (req, res) => {
  const c = db.prepare(cautelaQuery + ' WHERE c.id=?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Não encontrada' })
  c.itens = db.prepare(cautelaItensQuery).all(c.id)
  c.entregas = db.prepare(`
    SELECT ce.*, o.nome operario_nome, o.email operario_email, o.cargo operario_cargo, o.cpf_cnpj operario_cpf_cnpj
    FROM cautela_entregas ce JOIN usuarios o ON o.id=ce.operario_id
    WHERE ce.cautela_id=?`).all(c.id)
  for (const e of c.entregas) {
    e.itens = db.prepare(`
      SELECT cei.*, f.nome ferramenta_nome, COALESCE(f.valor_unitario,0) valor_unitario,
        (cei.quantidade * COALESCE(f.valor_unitario,0)) valor_item
      FROM cautela_entrega_itens cei JOIN ferramentas f ON f.id=cei.ferramenta_id
      WHERE cei.entrega_id=?`).all(e.id)
  }
  res.json(c)
})

// ─── CAUTELA DIRETA (almoxarifado cria para operário retirar pessoalmente) ─────
app.post('/api/cautelas/direta', auth(['almoxarifado']), (req, res) => {
  const { operario_id, itens, obs } = req.body
  if (!operario_id) return res.status(400).json({ error: 'Operário obrigatório' })
  if (!itens || !itens.length) return res.status(400).json({ error: 'Adicione ao menos um item' })
  const op = db.prepare("SELECT * FROM usuarios WHERE id=? AND role='operario' AND ativo=1").get(operario_id)
  if (!op) return res.status(404).json({ error: 'Operário não encontrado' })
  const id = db.transaction(() => {
    let valor_total = 0
    for (const it of itens) {
      const f = db.prepare('SELECT COALESCE(valor_unitario,0) v FROM ferramentas WHERE id=?').get(it.ferramenta_id)
      if (f) valor_total += f.v * it.quantidade
    }
    const numero = gerarNumero('CAU')
    const r = db.prepare("INSERT INTO cautelas (numero,lider_id,status,valor_total,cautela_tipo,obs_devolucao) VALUES (?,?,'aguardando_retirada',?,'direto',?)")
      .run(numero, operario_id, valor_total, obs || '')
    const ins = db.prepare('INSERT INTO cautela_itens (cautela_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of itens) ins.run(r.lastInsertRowid, it.ferramenta_id, it.quantidade)
    return r.lastInsertRowid
  })()
  audit(req.user.id, 'CRIAR_CAUTELA_DIRETA', 'cautelas', id, { operario: op.nome })
  res.json({ ok: true, id })
})

// Responsável retira: autentica no dispositivo do almoxarife
app.post('/api/cautelas/:id/retirar', auth(['almoxarifado']), (req, res) => {
  const { email, senha, assinatura } = req.body
  const c = db.prepare('SELECT * FROM cautelas WHERE id=?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Não encontrada' })
  if (c.status !== 'aguardando_retirada') return res.status(400).json({ error: 'Cautela não aguarda retirada' })

  // Valida credenciais do responsável (líder ou operário direto)
  const responsavel = db.prepare('SELECT * FROM usuarios WHERE id=?').get(c.lider_id)
  if (!responsavel || responsavel.email.toLowerCase() !== (email||'').toLowerCase())
    return res.status(401).json({ error: 'Email não corresponde ao responsável desta cautela' })
  if (!bcrypt.compareSync(senha, responsavel.senha_hash)) return res.status(401).json({ error: 'Senha incorreta' })
  if (!assinatura) return res.status(400).json({ error: 'Assinatura obrigatória' })

  const ip = getIP(req)
  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ')
  db.prepare("UPDATE cautelas SET status='ativa',assinatura_lider=?,ip_lider=?,data_retirada=? WHERE id=?")
    .run(assinatura, ip, agora, req.params.id)

  if (c.solicitacao_id) {
    db.prepare("UPDATE solicitacoes SET status='retirada' WHERE id=?").run(c.solicitacao_id)
  }

  const label = c.cautela_tipo === 'direto' ? `Operário ${responsavel.nome}` : `Líder ${responsavel.nome}`
  audit(req.user.id, 'RETIRADA_CAUTELA', 'cautelas', req.params.id, `${label} retirou — IP: ${ip}`)
  res.json({ ok: true })
})

// Líder entrega ao operário: operário autentica no dispositivo do líder
app.post('/api/cautelas/:id/entregas', auth(['lider']), (req, res) => {
  const { email, senha, assinatura, itens } = req.body
  const c = db.prepare('SELECT * FROM cautelas WHERE id=?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Não encontrada' })
  if (c.lider_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão' })
  if (c.status !== 'ativa') return res.status(400).json({ error: 'Cautela não está ativa' })

  // Valida credenciais do operário
  const op = db.prepare("SELECT * FROM usuarios WHERE LOWER(email)=LOWER(?) AND ativo=1 AND role='operario'").get(email)
  if (!op) return res.status(401).json({ error: 'Operário não encontrado' })
  if (!bcrypt.compareSync(senha, op.senha_hash)) return res.status(401).json({ error: 'Senha incorreta' })
  if (!assinatura) return res.status(400).json({ error: 'Assinatura obrigatória' })
  if (!itens || !itens.length) return res.status(400).json({ error: 'Selecione os itens a entregar' })

  const ip = getIP(req)
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO cautela_entregas (cautela_id,operario_id,assinatura_operario,ip_operario) VALUES (?,?,?,?)')
      .run(c.id, op.id, assinatura, ip)
    const ins = db.prepare('INSERT INTO cautela_entrega_itens (entrega_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of itens) ins.run(r.lastInsertRowid, it.ferramenta_id, it.quantidade)
    return r.lastInsertRowid
  })()

  audit(req.user.id, 'ENTREGA_OPERARIO', 'cautela_entregas', id, `Operário ${op.nome} — IP: ${ip}`)
  res.json({ ok: true, id, operario_nome: op.nome })
})

app.post('/api/cautelas/:id/entregas/:eid/devolver', auth(['lider']), (req, res) => {
  const e = db.prepare('SELECT * FROM cautela_entregas WHERE id=? AND cautela_id=?').get(req.params.eid, req.params.id)
  if (!e) return res.status(404).json({ error: 'Não encontrada' })
  const c = db.prepare('SELECT * FROM cautelas WHERE id=?').get(req.params.id)
  if (c.lider_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão' })
  db.prepare("UPDATE cautela_entregas SET status='devolvida',data_devolucao=datetime('now','localtime') WHERE id=?").run(req.params.eid)
  audit(req.user.id, 'DEVOLUCAO_ENTREGA', 'cautela_entregas', req.params.eid, null)
  res.json({ ok: true })
})

app.post('/api/cautelas/:id/devolver', auth(['almoxarifado', 'lider']), (req, res) => {
  const c = db.prepare('SELECT * FROM cautelas WHERE id=?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Não encontrada' })
  if (c.status !== 'ativa') return res.status(400).json({ error: 'Cautela não está ativa' })
  if (req.user.role === 'lider' && c.lider_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão' })

  const { email, senha, assinatura, obs_devolucao } = req.body

  // Exige autenticação e assinatura do líder responsável
  const lider = db.prepare('SELECT * FROM usuarios WHERE id=?').get(c.lider_id)
  if (!lider || lider.email.toLowerCase() !== (email || '').toLowerCase())
    return res.status(401).json({ error: 'Email não corresponde ao líder desta cautela' })
  if (!bcrypt.compareSync(senha, lider.senha_hash))
    return res.status(401).json({ error: 'Senha do líder incorreta' })
  if (!assinatura) return res.status(400).json({ error: 'Assinatura do líder é obrigatória' })

  const ip = getIP(req)
  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ')
  db.prepare("UPDATE cautelas SET status='devolvida',data_devolucao=?,obs_devolucao=?,assinatura_devolucao=?,ip_devolucao=? WHERE id=?")
    .run(agora, obs_devolucao || '', assinatura, ip, req.params.id)
  audit(req.user.id, 'DEVOLVER_CAUTELA', 'cautelas', req.params.id, { obs_devolucao, lider: lider.nome, ip })
  res.json({ ok: true })
})

// Termos
app.get('/api/cautelas/:id/termo/:tipo', auth(), (req, res) => {
  const { tipo } = req.params
  if (!['comodato', 'ciencia', 'ciencia_direta', 'devolucao'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' })
  const html = gerarTermoHTML(req.params.id, tipo)
  if (!html) return res.status(404).json({ error: 'Não encontrada' })
  audit(req.user.id, 'VER_TERMO', 'cautelas', req.params.id, { tipo })
  res.json({ html })
})

// ─── EMPRÉSTIMOS ──────────────────────────────────────────────────────────────
const empQuery = `
  SELECT e.*, s.nome solicitante_nome, s.cargo solicitante_cargo,
    t.nome tomador_nome, t.cargo tomador_cargo,
    l.nome lider_nome
  FROM emprestimos e
  JOIN usuarios s ON s.id=e.solicitante_id
  JOIN usuarios t ON t.id=e.tomador_id
  LEFT JOIN usuarios l ON l.id=e.lider_id`

const empItensQuery = `
  SELECT ei.*, f.nome ferramenta_nome, f.codigo
  FROM emprestimo_itens ei JOIN ferramentas f ON f.id=ei.ferramenta_id
  WHERE ei.emprestimo_id=?`

app.get('/api/emprestimos', auth(), (req, res) => {
  let q = empQuery + ' WHERE 1=1'
  const p = []
  if (req.user.role === 'operario') {
    q += ' AND (e.solicitante_id=? OR e.tomador_id=?)'; p.push(req.user.id, req.user.id)
  } else if (req.user.role === 'lider') {
    q += ' AND e.lider_id=?'; p.push(req.user.id)
  }
  q += ' ORDER BY e.criado_em DESC'
  const lista = db.prepare(q).all(...p)
  const itensStmt = db.prepare(empItensQuery)
  for (const e of lista) e.itens = itensStmt.all(e.id)
  res.json(lista)
})

// Operário A solicita empréstimo
app.post('/api/emprestimos', auth(['operario']), (req, res) => {
  const { tomador_email, lider_id, itens, obs } = req.body
  if (!tomador_email || !lider_id || !itens?.length)
    return res.status(400).json({ error: 'Email do tomador, líder e itens são obrigatórios' })
  const tomador = db.prepare("SELECT * FROM usuarios WHERE LOWER(email)=LOWER(?) AND ativo=1 AND role='operario'").get(tomador_email)
  if (!tomador) return res.status(404).json({ error: 'Operário não encontrado com este email' })
  if (tomador.id === req.user.id) return res.status(400).json({ error: 'Não pode emprestar para si mesmo' })

  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO emprestimos (solicitante_id,tomador_id,lider_id,obs) VALUES (?,?,?,?)')
      .run(req.user.id, tomador.id, lider_id, obs || '')
    const ins = db.prepare('INSERT INTO emprestimo_itens (emprestimo_id,ferramenta_id,quantidade) VALUES (?,?,?)')
    for (const it of itens) ins.run(r.lastInsertRowid, it.ferramenta_id, it.quantidade)
    return r.lastInsertRowid
  })()
  audit(req.user.id, 'SOLICITAR_EMPRESTIMO', 'emprestimos', id, { tomador: tomador.nome })
  res.json({ id, tomador_nome: tomador.nome })
})

// Operário B confirma
app.post('/api/emprestimos/:id/confirmar', auth(['operario']), (req, res) => {
  const e = db.prepare('SELECT * FROM emprestimos WHERE id=?').get(req.params.id)
  if (!e) return res.status(404).json({ error: 'Não encontrado' })
  if (e.tomador_id !== req.user.id) return res.status(403).json({ error: 'Você não é o tomador deste empréstimo' })
  if (e.status !== 'aguardando_tomador') return res.status(400).json({ error: 'Status inválido' })
  db.prepare("UPDATE emprestimos SET status='aguardando_lider' WHERE id=?").run(req.params.id)
  audit(req.user.id, 'CONFIRMAR_EMPRESTIMO', 'emprestimos', req.params.id, 'Tomador confirmou')
  res.json({ ok: true })
})

// Operário B recusa
app.post('/api/emprestimos/:id/recusar', auth(['operario']), (req, res) => {
  const e = db.prepare('SELECT * FROM emprestimos WHERE id=?').get(req.params.id)
  if (!e) return res.status(404).json({ error: 'Não encontrado' })
  if (e.tomador_id !== req.user.id) return res.status(403).json({ error: 'Você não é o tomador deste empréstimo' })
  if (e.status !== 'aguardando_tomador') return res.status(400).json({ error: 'Status inválido' })
  db.prepare("UPDATE emprestimos SET status='recusado' WHERE id=?").run(req.params.id)
  audit(req.user.id, 'RECUSAR_EMPRESTIMO', 'emprestimos', req.params.id, 'Tomador recusou')
  res.json({ ok: true })
})

// Líder assina
app.post('/api/emprestimos/:id/aval-lider', auth(['lider']), (req, res) => {
  const { assinatura } = req.body
  const e = db.prepare('SELECT * FROM emprestimos WHERE id=?').get(req.params.id)
  if (!e) return res.status(404).json({ error: 'Não encontrado' })
  if (e.lider_id !== req.user.id) return res.status(403).json({ error: 'Você não é o líder responsável' })
  if (e.status !== 'aguardando_lider') return res.status(400).json({ error: 'Aguarde a confirmação do tomador' })
  const ip = getIP(req)
  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ')
  db.prepare("UPDATE emprestimos SET status='ativo',assinatura_lider=?,ip_lider=?,data_emprestimo=? WHERE id=?")
    .run(assinatura, ip, agora, req.params.id)
  audit(req.user.id, 'AVAL_LIDER_EMPRESTIMO', 'emprestimos', req.params.id, `Líder ${req.user.nome} aprovou`)
  res.json({ ok: true })
})

// Devolver
app.post('/api/emprestimos/:id/devolver', auth(['operario', 'lider', 'almoxarifado']), (req, res) => {
  const e = db.prepare('SELECT * FROM emprestimos WHERE id=?').get(req.params.id)
  if (!e) return res.status(404).json({ error: 'Não encontrado' })
  if (e.status !== 'ativo') return res.status(400).json({ error: 'Empréstimo não está ativo' })
  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ')
  db.prepare("UPDATE emprestimos SET status='devolvido',data_devolucao=? WHERE id=?").run(agora, req.params.id)
  audit(req.user.id, 'DEVOLVER_EMPRESTIMO', 'emprestimos', req.params.id, null)
  res.json({ ok: true })
})

// ─── NOTIFICAÇÕES ─────────────────────────────────────────────────────────────
app.get('/api/notificacoes', auth(), (req, res) => {
  const n = {}
  const u = req.user

  if (u.role === 'almoxarifado') {
    n.solicitacoes_novas    = db.prepare("SELECT COUNT(*) c FROM solicitacoes WHERE status='solicitada'").get().c
    n.solicitacoes_separando = db.prepare("SELECT COUNT(*) c FROM solicitacoes WHERE status='separando'").get().c
    n.solicitacoes_prontas  = db.prepare("SELECT COUNT(*) c FROM solicitacoes WHERE status='pronta'").get().c
    n.cautelas_aguardando   = db.prepare("SELECT COUNT(*) c FROM cautelas WHERE status='aguardando_retirada'").get().c
  }

  if (u.role === 'lider') {
    n.emprestimos_aguardando_aval = db.prepare("SELECT COUNT(*) c FROM emprestimos WHERE lider_id=? AND status='aguardando_lider'").get(u.id).c
    n.solicitacoes_prontas = db.prepare("SELECT COUNT(*) c FROM solicitacoes WHERE lider_id=? AND status='pronta'").get(u.id).c
    n.cautelas_aguardando_retirada = db.prepare("SELECT COUNT(*) c FROM cautelas WHERE lider_id=? AND status='aguardando_retirada'").get(u.id).c
  }

  if (u.role === 'operario') {
    n.emprestimos_aguardando_confirmacao = db.prepare("SELECT COUNT(*) c FROM emprestimos WHERE tomador_id=? AND status='aguardando_tomador'").get(u.id).c
  }

  res.json(n)
})

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
app.get('/api/dashboard', auth(), (req, res) => {
  const u = req.user
  const s = {}

  if (u.role === 'almoxarifado') {
    s.total_ferramentas   = db.prepare('SELECT COUNT(*) n FROM ferramentas').get().n
    s.total_unidades      = db.prepare('SELECT COALESCE(SUM(quantidade_total),0) n FROM ferramentas').get().n
    s.valor_total_estoque = db.prepare('SELECT COALESCE(SUM(quantidade_total * COALESCE(valor_unitario,0)),0) v FROM ferramentas').get().v
    s.total_bolsas        = db.prepare('SELECT COUNT(*) n FROM bolsas').get().n
    s.total_usuarios      = db.prepare("SELECT COUNT(*) n FROM usuarios WHERE role!='almoxarifado'").get().n
    s.sol_solicitadas     = db.prepare("SELECT COUNT(*) n FROM solicitacoes WHERE status='solicitada'").get().n
    s.sol_separando       = db.prepare("SELECT COUNT(*) n FROM solicitacoes WHERE status='separando'").get().n
    s.sol_prontas         = db.prepare("SELECT COUNT(*) n FROM solicitacoes WHERE status='pronta'").get().n
    s.cautelas_aguardando = db.prepare("SELECT COUNT(*) n FROM cautelas WHERE status='aguardando_retirada'").get().n
    s.cautelas_ativas     = db.prepare("SELECT COUNT(*) n FROM cautelas WHERE status='ativa'").get().n
    s.valor_em_campo      = db.prepare("SELECT COALESCE(SUM(valor_total),0) v FROM cautelas WHERE status='ativa'").get().v
    s.solicitacoes_recentes = db.prepare(`
      SELECT s.id,s.numero,s.status,s.criado_em,l.nome lider_nome
      FROM solicitacoes s JOIN usuarios l ON l.id=s.lider_id
      ORDER BY s.criado_em DESC LIMIT 5`).all()
  }

  if (u.role === 'lider') {
    s.minhas_sol_ativas    = db.prepare("SELECT COUNT(*) n FROM solicitacoes WHERE lider_id=? AND status NOT IN ('retirada','cancelada')").get(u.id).n
    s.cautelas_ativas      = db.prepare("SELECT COUNT(*) n FROM cautelas WHERE lider_id=? AND status='ativa'").get(u.id).n
    s.valor_responsabilidade = db.prepare("SELECT COALESCE(SUM(valor_total),0) v FROM cautelas WHERE lider_id=? AND status='ativa'").get(u.id).v
    s.valor_entregue_equipe  = db.prepare(`
      SELECT COALESCE(SUM(cei.quantidade * COALESCE(f.valor_unitario,0)),0) v
      FROM cautela_entregas ce
      JOIN cautela_entrega_itens cei ON cei.entrega_id=ce.id
      JOIN ferramentas f ON f.id=cei.ferramenta_id
      JOIN cautelas c ON c.id=ce.cautela_id
      WHERE c.lider_id=? AND ce.status='ativa'`).get(u.id).v
    s.emp_aguardando_aval  = db.prepare("SELECT COUNT(*) n FROM emprestimos WHERE lider_id=? AND status='aguardando_lider'").get(u.id).n
    s.sol_prontas          = db.prepare("SELECT COUNT(*) n FROM solicitacoes WHERE lider_id=? AND status='pronta'").get(u.id).n
    s.minhas_solicitacoes  = db.prepare(`
      SELECT s.id,s.numero,s.status,s.criado_em FROM solicitacoes s
      WHERE s.lider_id=? ORDER BY s.criado_em DESC LIMIT 5`).all(u.id)
  }

  if (u.role === 'operario') {
    s.emp_aguardando_confirmacao = db.prepare("SELECT COUNT(*) n FROM emprestimos WHERE tomador_id=? AND status='aguardando_tomador'").get(u.id).n
    s.emp_ativos = db.prepare("SELECT COUNT(*) n FROM emprestimos WHERE (solicitante_id=? OR tomador_id=?) AND status='ativo'").get(u.id, u.id).n
    s.valor_responsabilidade = db.prepare(`
      SELECT COALESCE(SUM(cei.quantidade * COALESCE(f.valor_unitario,0)),0) v
      FROM cautela_entregas ce
      JOIN cautela_entrega_itens cei ON cei.entrega_id=ce.id
      JOIN ferramentas f ON f.id=cei.ferramenta_id
      WHERE ce.operario_id=? AND ce.status='ativa'`).get(u.id).v
    s.minhas_entregas = db.prepare(`
      SELECT ce.id,ce.status,ce.data_entrega,c.numero cautela_numero,l.nome lider_nome
      FROM cautela_entregas ce
      JOIN cautelas c ON c.id=ce.cautela_id
      JOIN usuarios l ON l.id=c.lider_id
      WHERE ce.operario_id=? AND ce.status='ativa'`).all(u.id)
  }

  res.json(s)
})

// ─── AUDITORIA ────────────────────────────────────────────────────────────────
app.get('/api/auditoria', auth(['almoxarifado']), (req, res) => {
  res.json(db.prepare(`
    SELECT a.*,u.nome usuario_nome,u.role usuario_role
    FROM auditoria a LEFT JOIN usuarios u ON u.id=a.usuario_id
    ORDER BY a.criado_em DESC LIMIT 500`).all())
})

// ─── ZERAR QUANTIDADES (apenas ferramentas sem código de patrimônio) ──────────
app.post('/api/admin/zerar-quantidades', auth(['almoxarifado']), (req, res) => {
  try {
    const info = db.prepare(
      "UPDATE ferramentas SET quantidade_total=0, quantidade_disponivel=0 WHERE codigo IS NULL OR TRIM(codigo)=''"
    ).run()
    audit(req.user.id, 'ZERAR_QUANTIDADES', null, null, { alteradas: info.changes, por: req.user.email })
    res.json({ ok: true, alteradas: info.changes })
  } catch(e) {
    res.status(500).json({ error: 'Erro ao zerar: ' + e.message })
  }
})

// Nome (e logo opcional) da empresa para o front-end não depender de texto/imagem fixos
app.get('/api/empresa', (req, res) => res.json({ nome: EMPRESA.nome, razaoSocial: EMPRESA.razaoSocial, logoUrl: EMPRESA.logoUrl }))

// ─── RESET TRANSACIONAL (almoxarifado only) ───────────────────────────────────
app.post('/api/admin/reset-transacional', auth(['almoxarifado']), (req, res) => {
  const { confirmacao, senha_gestor } = req.body
  if (confirmacao !== 'CONFIRMAR RESET') return res.status(400).json({ error: 'Texto de confirmação inválido' })
  const GESTOR_SENHA = (process.env.GESTOR_RESET_SENHA || process.env.Gestor_Reset_Senha || '').trim()
  if (!GESTOR_SENHA) return res.status(500).json({ error: 'Variável GESTOR_RESET_SENHA não configurada no servidor' })
  if ((senha_gestor || '').trim() !== GESTOR_SENHA) return res.status(401).json({ error: 'Senha do gestor incorreta' })
  try {
    db.transaction(() => {
      db.exec('DELETE FROM cautela_entrega_itens')
      db.exec('DELETE FROM cautela_entregas')
      db.exec('DELETE FROM cautela_itens')
      db.exec('DELETE FROM cautelas')
      db.exec('DELETE FROM emprestimo_itens')
      db.exec('DELETE FROM emprestimos')
      db.exec('DELETE FROM solicitacao_itens')
      db.exec('DELETE FROM solicitacoes')
      db.exec('DELETE FROM auditoria')
    })()
    audit(req.user.id, 'RESET_TRANSACIONAL', null, null, { por: req.user.email, em: new Date().toISOString() })
    res.json({ ok: true })
  } catch(e) {
    res.status(500).json({ error: 'Erro ao resetar: ' + e.message })
  }
})

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║   CAUTELA DE FERRAMENTAS — SERVIDOR OK   ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log(`\n  Porta: ${PORT} | Banco: ${DB_PATH}`)
  console.log(`  Empresa: ${EMPRESA.nome}\n`)
})
