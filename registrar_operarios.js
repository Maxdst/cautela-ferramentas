// ============================================================
// REGISTRAR OPERÁRIOS - Cautela de Ferramentas
// Execute: node registrar_operarios.js
// ============================================================
const https = require('https');

const BASE = 'https://cautela.grupomarkat.com.br/api';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method,
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

const operarios = [
  { nome: 'Rogerio Machado de Souza',          cargo: 'Pedreiro de Obra',                    cpf_cnpj: '114.471.247-58', email: 'rogerio.souza@gpsantos.com'      },
  { nome: 'Celso Costa da Silva',               cargo: 'Pedreiro de Obra',                    cpf_cnpj: '082.004.907-77', email: 'celso.silva@gpsantos.com'        },
  { nome: 'Frank Neves Nunes',                  cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '031.237.487-90', email: 'frank.nunes@gpsantos.com'        },
  { nome: 'Jose Adailton Braz',                 cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '283.363.804-34', email: 'jose.braz@gpsantos.com'          },
  { nome: 'Marcio Alexandre Cardoso',           cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '561.346.572-04', email: 'marcio.cardoso@gpsantos.com'     },
  { nome: 'Reginaldo Pinto da Silva',           cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '098.778.377-73', email: 'reginaldo.silva@gpsantos.com'    },
  { nome: 'Reginaldo Rangel Moreira',           cargo: 'Pedreiro de Obra',                    cpf_cnpj: '095.894.937-93', email: 'reginaldo.moreira@gpsantos.com'  },
  { nome: 'Carlos Alberto Barboza',             cargo: 'Pedreiro de Manutenção (Plantonista)',cpf_cnpj: '962.606.457-91', email: 'carlos.barboza@gpsantos.com'     },
  { nome: 'Edson Pinto de Freitas',             cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '075.969.237-80', email: 'edson.freitas@gpsantos.com'      },
  { nome: 'Rogerio Araujo Costa',               cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '029.796.277-98', email: 'rogerio.costa@gpsantos.com'      },
  { nome: 'Aldair Vicente Gomes de Araujo',     cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '069.559.607-17', email: 'aldair.araujo@gpsantos.com'      },
  { nome: 'Jean Luiz Carvalho Pereira',         cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '987.125.603-59', email: 'jean.pereira@gpsantos.com'       },
  { nome: 'Jair Luiz Ernesto da Silva',         cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '089.793.177-78', email: 'jair.silva@gpsantos.com'         },
  { nome: 'Renan da Silva Canto',               cargo: 'Gesseiro de Manutenção II',           cpf_cnpj: '151.190.047-41', email: 'renan.canto@gpsantos.com'        },
  { nome: 'Anderson Leonardo da Silva',         cargo: 'Pedreiro de Obra',                    cpf_cnpj: '127.376.447-12', email: 'anderson.silva@gpsantos.com'     },
  { nome: 'Alex Lima Ferreira',                 cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '087.551.077-96', email: 'alex.ferreira@gpsantos.com'      },
  { nome: 'Rodrigo Sousa Nascimento',           cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '115.113.617-43', email: 'rodrigo.nascimento@gpsantos.com' },
  { nome: 'Carlos Alberto Lima',                cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '618.190.344-53', email: 'carlos.lima@gpsantos.com'        },
  { nome: 'Marcelo Henrique Gilvaz Arantes',    cargo: 'Gesseiro de Manutenção',              cpf_cnpj: '144.574.657-39', email: 'marcelo.arantes@gpsantos.com'    },
  { nome: 'Paulo Roberto Costantino da Silva',  cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '090.613.417-01', email: 'paulo.silva@gpsantos.com'        },
  { nome: 'Reginaldo Oliveira de Souza',        cargo: 'Pedreiro de Manutenção',              cpf_cnpj: '110.896.257-23', email: 'reginaldo.souza@gpsantos.com'    },
  { nome: 'Alex Sandre da Assuncao Amancio',    cargo: 'Eletricista',                         cpf_cnpj: '077.704.377-13', email: 'alex.amancio@gpsantos.com'       },
  // ← Adicione mais entradas aqui se necessário
];

async function main() {
  console.log('🔐 Fazendo login...');
  const login = await req('POST', '/auth/login', { email: 'admin@markat.com', senha: 'admin123' });
  if (!login.token) { console.error('❌ Falha no login:', login); process.exit(1); }
  const tok = login.token;
  console.log(`✅ Logado. Cadastrando ${operarios.length} operários...\n`);

  for (const op of operarios) {
    const r = await req('POST', '/usuarios', {
      nome:     op.nome,
      email:    op.email,
      senha:    'admin123',
      cargo:    op.cargo,
      role:     'operario',
      cpf_cnpj: op.cpf_cnpj,
    }, tok);

    if (r.id || r.message) {
      console.log(`  ✅ ${op.nome} → ${op.email}`);
    } else if (r.error && r.error.includes('UNIQUE')) {
      console.log(`  ⚠️  ${op.nome} → já existe (${op.email})`);
    } else {
      console.log(`  ❌ ${op.nome}: ${r.error || JSON.stringify(r)}`);
    }
  }

  console.log('\n🎉 Concluído! Cada operário deverá criar sua própria senha no primeiro acesso.');
}

main().catch(console.error);
