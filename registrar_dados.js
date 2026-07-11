// ============================================================
// REGISTRAR FERRAMENTAS E BOLSAS - Cautela de Ferramentas
// Execute: node registrar_dados.js
// ============================================================
const https = require('https');
const http = require('http');

const BASE = 'https://cautela.grupomarkat.com.br/api';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = mod.request(opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { resolve({ error: raw }); }
      });
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
  console.log('✅ Logado como', login.user.nome);

  // ── FERRAMENTAS ──────────────────────────────────────────
  const ferramentas = [
    // Comuns às bolsas
    { nome: 'Bolsa de Ferramentas',                     categoria: 'Acessório', valor_unitario: 125.00,  quantidade_total: 20 },
    { nome: 'Trena',                                    categoria: 'Medição',   valor_unitario: 41.25,   quantidade_total: 20 },
    { nome: 'Alicate Universal',                        categoria: 'Alicate',   valor_unitario: 37.50,   quantidade_total: 20 },
    // Bolsa Eletricista
    { nome: 'Passa Fio',                                categoria: 'Elétrico',  valor_unitario: 30.00,   quantidade_total: 10 },
    { nome: 'Alicate de Corte',                         categoria: 'Alicate',   valor_unitario: 40.00,   quantidade_total: 10 },
    { nome: 'Alicate Bico Longo',                       categoria: 'Alicate',   valor_unitario: 40.00,   quantidade_total: 10 },
    { nome: 'Alicate Amperímetro',                      categoria: 'Elétrico',  valor_unitario: 81.25,   quantidade_total: 10 },
    { nome: 'Chave Fenda 5/16x6',                       categoria: 'Chave',     valor_unitario: 25.00,   quantidade_total: 10 },
    { nome: 'Chave Fenda 1/8x4',                        categoria: 'Chave',     valor_unitario: 18.75,   quantidade_total: 10 },
    { nome: 'Chave Fenda 1/4x6',                        categoria: 'Chave',     valor_unitario: 18.75,   quantidade_total: 10 },
    { nome: 'Chave Fenda 3/16x6',                       categoria: 'Chave',     valor_unitario: 18.75,   quantidade_total: 10 },
    { nome: 'Chave Phillips 1/8x5',                     categoria: 'Chave',     valor_unitario: 18.75,   quantidade_total: 10 },
    { nome: 'Chave Phillips 5/16x6',                    categoria: 'Chave',     valor_unitario: 18.75,   quantidade_total: 10 },
    { nome: 'Chave Phillips 3/16x6',                    categoria: 'Chave',     valor_unitario: 18.75,   quantidade_total: 10 },
    { nome: 'Parafusadeira Bosch + 2 Baterias + Carregador', categoria: 'Máquina', valor_unitario: 1875.00, quantidade_total: 10 },
    // Bolsa Pedreiro
    { nome: "Alicate Bomba D'Água",                     categoria: 'Alicate',   valor_unitario: 47.38,   quantidade_total: 10 },
    { nome: 'Alicate Pressão',                          categoria: 'Alicate',   valor_unitario: 42.74,   quantidade_total: 10 },
    { nome: 'Chave Grifo',                              categoria: 'Chave',     valor_unitario: 36.48,   quantidade_total: 10 },
    { nome: 'Colher de Pedreiro',                       categoria: 'Pedreiro',  valor_unitario: 18.63,   quantidade_total: 10 },
    { nome: 'Desempenadeira Dentada',                   categoria: 'Pedreiro',  valor_unitario: 19.88,   quantidade_total: 10 },
    { nome: 'Desempenadeira Lisa',                      categoria: 'Pedreiro',  valor_unitario: 19.88,   quantidade_total: 10 },
    { nome: 'Esquadro',                                 categoria: 'Medição',   valor_unitario: 14.88,   quantidade_total: 10 },
    { nome: 'Jogo Chave Combinada',                     categoria: 'Chave',     valor_unitario: 47.60,   quantidade_total: 10 },
    { nome: 'Linha de Pedreiro',                        categoria: 'Pedreiro',  valor_unitario: 15.13,   quantidade_total: 10 },
    { nome: 'Furadeira Makita',                         categoria: 'Máquina',   valor_unitario: 507.46,  quantidade_total: 10 },
    { nome: 'Marreta',                                  categoria: 'Pedreiro',  valor_unitario: 36.75,   quantidade_total: 10 },
    { nome: 'Martelo',                                  categoria: 'Pedreiro',  valor_unitario: 33.63,   quantidade_total: 10 },
    { nome: 'Martelo de Borracha',                      categoria: 'Pedreiro',  valor_unitario: 13.63,   quantidade_total: 10 },
    { nome: 'Nível de Alumínio',                        categoria: 'Medição',   valor_unitario: 50.29,   quantidade_total: 10 },
    { nome: 'Ponteira',                                 categoria: 'Pedreiro',  valor_unitario: 13.29,   quantidade_total: 10 },
    { nome: 'Prumo',                                    categoria: 'Medição',   valor_unitario: 20.78,   quantidade_total: 10 },
    { nome: 'Talhadeira',                               categoria: 'Pedreiro',  valor_unitario: 13.28,   quantidade_total: 10 },
    // Bolsa Gesseiro
    { nome: 'Alicate Pulsionador',                      categoria: 'Alicate',   valor_unitario: 149.88,  quantidade_total: 10 },
    { nome: 'Arco de Serra',                            categoria: 'Corte',     valor_unitario: 37.49,   quantidade_total: 10 },
    { nome: 'Serrote p/ Drywall',                       categoria: 'Corte',     valor_unitario: 25.00,   quantidade_total: 10 },
    { nome: 'Reco (Cortador Drywall)',                  categoria: 'Gesseiro',  valor_unitario: 28.75,   quantidade_total: 10 },
    { nome: 'Nível de Mão',                             categoria: 'Medição',   valor_unitario: 37.50,   quantidade_total: 10 },
    { nome: 'Linha de Giz',                             categoria: 'Medição',   valor_unitario: 37.50,   quantidade_total: 10 },
    // Máquinas / Equipamentos eletrônicos (sem valor definido - atualizar depois)
    { nome: 'Martelete Pequeno 1,5kg',                  categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 5 },
    { nome: 'Martelete Médio 5,0kg',                    categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 5 },
    { nome: 'Martelete Grande 15kg',                    categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 3 },
    { nome: 'Furadeira com Fio',                        categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 5 },
    { nome: 'Máquina de Solda Inversora',               categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 3 },
    { nome: 'Máquina de Solda MIG/MAG',                 categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 2 },
    { nome: 'Serra de Mármore',                         categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 5 },
    { nome: 'Esmerilhadeira 4"',                        categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 5 },
    { nome: 'Esmerilhadeira 7"',                        categoria: 'Máquina',   valor_unitario: 0,       quantidade_total: 5 },
  ];

  console.log(`\n🔧 Cadastrando ${ferramentas.length} ferramentas...`);
  const idMap = {};
  for (const f of ferramentas) {
    const r = await req('POST', '/ferramentas', f, tok);
    if (r.id) {
      idMap[f.nome] = r.id;
      console.log(`  ✅ ${f.nome} → id ${r.id}`);
    } else {
      console.log(`  ❌ ${f.nome}:`, r.error || JSON.stringify(r));
    }
  }

  // ── BOLSAS ───────────────────────────────────────────────
  const bolsas = [
    {
      nome: 'Bolsa Eletricista',
      descricao: 'Kit padrão para eletricistas — R$ 2.407,50',
      itens: [
        { nome: 'Bolsa de Ferramentas',                     qtd: 1 },
        { nome: 'Passa Fio',                                qtd: 1 },
        { nome: 'Alicate de Corte',                         qtd: 1 },
        { nome: 'Alicate Bico Longo',                       qtd: 1 },
        { nome: 'Alicate Universal',                        qtd: 1 },
        { nome: 'Alicate Amperímetro',                      qtd: 1 },
        { nome: 'Trena',                                    qtd: 1 },
        { nome: 'Chave Fenda 5/16x6',                       qtd: 1 },
        { nome: 'Chave Fenda 1/8x4',                        qtd: 1 },
        { nome: 'Chave Phillips 1/8x5',                     qtd: 1 },
        { nome: 'Chave Phillips 5/16x6',                    qtd: 1 },
        { nome: 'Chave Fenda 1/4x6',                        qtd: 1 },
        { nome: 'Chave Phillips 3/16x6',                    qtd: 1 },
        { nome: 'Chave Fenda 3/16x6',                       qtd: 1 },
        { nome: 'Parafusadeira Bosch + 2 Baterias + Carregador', qtd: 1 },
      ]
    },
    {
      nome: 'Bolsa Pedreiro',
      descricao: 'Kit padrão para pedreiros — R$ 1.172,21',
      itens: [
        { nome: 'Bolsa de Ferramentas',    qtd: 1 },
        { nome: "Alicate Bomba D'Água",    qtd: 1 },
        { nome: 'Alicate Pressão',         qtd: 1 },
        { nome: 'Chave Grifo',             qtd: 1 },
        { nome: 'Colher de Pedreiro',      qtd: 1 },
        { nome: 'Desempenadeira Dentada',  qtd: 1 },
        { nome: 'Desempenadeira Lisa',     qtd: 1 },
        { nome: 'Esquadro',                qtd: 1 },
        { nome: 'Jogo Chave Combinada',    qtd: 1 },
        { nome: 'Linha de Pedreiro',       qtd: 1 },
        { nome: 'Furadeira Makita',        qtd: 1 },
        { nome: 'Marreta',                 qtd: 1 },
        { nome: 'Martelo',                 qtd: 1 },
        { nome: 'Martelo de Borracha',     qtd: 1 },
        { nome: 'Nível de Alumínio',       qtd: 1 },
        { nome: 'Ponteira',                qtd: 1 },
        { nome: 'Prumo',                   qtd: 1 },
        { nome: 'Talhadeira',              qtd: 1 },
        { nome: 'Trena',                   qtd: 1 },
      ]
    },
    {
      nome: 'Bolsa Gesseiro',
      descricao: 'Kit padrão para gesseiros — R$ 2.394,87',
      itens: [
        { nome: 'Bolsa de Ferramentas',                      qtd: 1 },
        { nome: 'Trena',                                     qtd: 1 },
        { nome: 'Alicate Universal',                         qtd: 1 },
        { nome: 'Alicate Pulsionador',                       qtd: 1 },
        { nome: 'Arco de Serra',                             qtd: 1 },
        { nome: 'Serrote p/ Drywall',                        qtd: 1 },
        { nome: 'Reco (Cortador Drywall)',                   qtd: 1 },
        { nome: 'Nível de Mão',                              qtd: 1 },
        { nome: 'Linha de Giz',                              qtd: 1 },
        { nome: 'Parafusadeira Bosch + 2 Baterias + Carregador', qtd: 1 },
      ]
    }
  ];

  console.log('\n🎒 Criando 3 bolsas...');
  for (const b of bolsas) {
    const itens = b.itens
      .map(i => ({ ferramenta_id: idMap[i.nome], quantidade: i.qtd }))
      .filter(i => i.ferramenta_id);

    const missing = b.itens.filter(i => !idMap[i.nome]).map(i => i.nome);
    if (missing.length) console.log(`  ⚠️  Itens não encontrados em ${b.nome}:`, missing);

    const r = await req('POST', '/bolsas', { nome: b.nome, descricao: b.descricao, itens }, tok);
    if (r.id) {
      console.log(`  ✅ ${b.nome} criada (id ${r.id}) com ${itens.length} itens`);
    } else {
      console.log(`  ❌ ${b.nome}:`, r.error || JSON.stringify(r));
    }
  }

  console.log('\n🎉 Concluído! Acesse o sistema e confira.');
}

main().catch(console.error);
