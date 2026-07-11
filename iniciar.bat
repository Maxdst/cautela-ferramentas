@echo off
echo.
echo =============================================
echo  CAUTELA DE FERRAMENTAS - INICIANDO...
echo =============================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ERRO: Node.js nao encontrado.
  echo Baixe a versao LTS em: https://nodejs.org
  echo Apos instalar, feche e abra este arquivo novamente.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Instalando dependencias (primeira vez, aguarde)...
  npm install
  if %errorlevel% neq 0 (
    echo ERRO na instalacao. Verifique sua conexao.
    pause
    exit /b 1
  )
)

echo.
echo Servidor iniciado!
echo.
echo Acesse no navegador: http://localhost:3000
echo Login padrao:        admin@empresa.com / trocar123 (senha temporaria, sera pedida troca)
echo.
echo Para encerrar: feche esta janela
echo.

node server.js
pause
