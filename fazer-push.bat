@echo off
echo.
echo  =============================================
echo   ENVIANDO PARA GITHUB - MARKAT ENGENHARIA
echo  =============================================
echo.
echo  Repositorio: github.com/Maxdst/cautela-ferramentas
echo.

cd /d "%~dp0"

echo [1/4] Inicializando git...
if exist ".git" (
    echo     Repositorio ja existia, resetando...
    rmdir /s /q .git
)
git init -b main
if %errorlevel% neq 0 (
    git init
    git checkout -b main 2>nul || git branch -M main
)

echo [2/4] Configurando identidade...
git config user.email "admin@markat.com.br"
git config user.name "Markat Engenharia"

echo [3/4] Adicionando arquivos...
git add .
git commit -m "Sistema Cautela de Ferramentas - Markat Engenharia v1.0"

echo [4/4] Enviando para GitHub...
echo.
echo  ATENCAO: Uma janela de autenticacao pode abrir.
echo  Entre com sua conta GitHub (Maxdst) quando solicitado.
echo.
git remote add origin https://github.com/Maxdst/cautela-ferramentas.git
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo  =============================================
    echo   SUCESSO! Codigo enviado para o GitHub.
    echo  =============================================
    echo.
    echo  Agora conecte no Railway:
    echo.
    echo  1. Abrir Railway (sera aberto automaticamente)
    echo  2. New Project - Deploy from GitHub repo
    echo  3. Selecionar: Maxdst/cautela-ferramentas
    echo  4. Adicionar Volume com mount path: /data
    echo  5. Variaveis de ambiente:
    echo       DATABASE_PATH = /data/ferramentas.db
    echo       JWT_SECRET    = markat-2024-secret-key
    echo.
    start https://railway.app/new
) else (
    echo.
    echo  [ERRO] Falha ao enviar.
    echo  Tente autenticar e rodar novamente.
)

echo.
pause
