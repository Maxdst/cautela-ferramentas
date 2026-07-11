@echo off
cd /d "%~dp0"
echo.
echo === DEPLOY RAILWAY - CAUTELA DE FERRAMENTAS ===
echo.
echo Passo 1: Verificando Railway CLI...
railway --version
if %errorlevel% neq 0 goto ERRO_CLI
echo OK.

echo.
echo Passo 2: Verificando login...
railway whoami
if %errorlevel% neq 0 (
    echo Fazendo login...
    railway login
    echo Autorizou no navegador? Pressione Enter para continuar.
    pause
)

echo.
echo Passo 3: Criando projeto...
echo ATENCAO: troque "cautela-ferramentas" pelo nome deste cliente antes de rodar.
railway init --name cautela-ferramentas

echo.
echo Passo 4: Deploy (aguarde)...
railway up --detach

echo.
echo Passo 5: Variaveis de ambiente...
echo ATENCAO: edite os valores abaixo (EMPRESA_*, ADMIN_*, JWT_SECRET) antes de rodar,
echo trocando para os dados reais do cliente. Nao reutilize o mesmo JWT_SECRET entre clientes.
railway variables set DATABASE_PATH=/data/ferramentas.db
railway variables set JWT_SECRET=TROCAR-por-uma-chave-aleatoria-unica-deste-cliente
railway variables set EMPRESA_NOME="NOME DA EMPRESA CLIENTE LTDA."
railway variables set EMPRESA_CNPJ="XX.XXX.XXX/XXXX-XX"
railway variables set EMPRESA_ENDERECO="Endereco completo do cliente"
railway variables set EMPRESA_CIDADE="Cidade do cliente"
railway variables set ADMIN_EMAIL="admin@empresa.com"
railway variables set ADMIN_SENHA="trocar123"
echo.
echo OPCIONAL: se o cliente ja tinha logo propria (ex.: migrando de outro sistema),
echo suba a imagem em algum lugar publico (ex.: um Storage) e descomente a linha abaixo.
echo Sem isso, o produto usa o wordmark padrao "Cautelix" - e a opcao recomendada para clientes novos.
:: railway variables set EMPRESA_LOGO_URL="https://.../logo-do-cliente.png"

echo.
echo Gerando URL publica...
railway domain

echo.
echo === DEPLOY CONCLUIDO ===
goto FIM

:ERRO_CLI
echo [ERRO] Railway CLI nao encontrado.

:FIM
pause
