// ============================================================
// ATUALIZAR EMAILS @markat.com → @gpsantos.com
// Execute: node atualizar_emails.js
// ============================================================
const https = require('https');

const BASE = 'https://cautela.grupomarkat.com.br/api';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname, port: 443, path: url.pathname, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve({ error: raw }) } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('🔐 Fazendo login...');
  const login = await req('POST', '/auth/login', { email: 'admin@markat.com', senha: 'admin123' });
  if (!login.token) { console.error('❌ Falha no login:', login); process.exit(1); }
  const tok = login.token;

  console.log('📋 Buscando usuários...');
  const usuarios = await req('GET', '/usuarios', null, tok);
  const comMarkat = usuarios.filter(u => u.email && u.email.endsWith('@markat.com') && u.role === 'operario');

  console.log(`\n🔄 Atualizando ${comMarkat.length} emails de @markat.com → @gpsantos.com...\n`);

  for (const u of comMarkat) {
    const novoEmail = u.email.replace('@markat.com', '@gpsantos.com');
    const r = await req('PUT', `/usuarios/${u.id}`, {
      nome:            u.nome,
      email:           novoEmail,
      cargo:           u.cargo,
      role:            u.role,
      cpf_cnpj:        u.cpf_cnpj,
      empresa:         u.empresa,
      endereco:        u.endereco,
      telefone:        u.telefone,
      ativo:           u.ativo,
    }, tok);

    if (r.message || r.id || r.success) {
      console.log(`  ✅ ${u.nome}: ${u.email} → ${novoEmail}`);
    } else {
      console.log(`  ❌ ${u.nome}: ${r.error || JSON.stringify(r)}`);
    }
  }

  console.log('\n🎉 Concluído!');
}

main().catch(console.error);
