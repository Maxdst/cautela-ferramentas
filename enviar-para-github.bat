@echo off
chcp 65001 >nul 2>&1

echo.
echo  ============================================
echo   CAUTELA DE FERRAMENTAS - ENVIAR PARA GITHUB
echo  ============================================
echo.

:: Verifica se o Git esta instalado
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Git nao encontrado.
    echo.
    echo Baixe e instale o Git em:
    echo   https://git-scm.com/download/win
    echo.
    echo Apos instalar, feche e execute este arquivo novamente.
    start https://git-scm.com/download/win
    pause
    exit /b 1
)
echo [OK] Git encontrado.

:: Vai para a pasta do projeto
cd /d "%~dp0"

:: Inicializa o repositorio se ainda nao existir
if not exist ".git" (
    echo.
    echo Inicializando repositorio git...
    git init -b main
    if %errorlevel% neq 0 (
        git init
        git checkout -b main 2>nul || git branch -M main
    )
    echo [OK] Repositorio criado.
) else (
    echo [OK] Repositorio git ja existe.
)

:: Configura identidade do git (necessario para o commit)
for /f "tokens=*" %%i in ('git config user.email 2^>nul') do set GIT_EMAIL=%%i
if "%GIT_EMAIL%"=="" (
    git config user.email "deploy@mindmax.com.br"
    git config user.name "MindMax Tecnologia"
)

:: Adiciona todos os arquivos
echo.
echo Preparando arquivos...
git add .

:: Verifica se ha algo para commitar
git diff --cached --quiet >nul 2>&1
if %errorlevel% equ 0 (
    echo Sem alteracoes novas. Continuando com o push...
    goto :PUSH_SETUP
)

:: Faz o commit
git commit -m "Deploy: Cautela de Ferramentas - Markat Engenharia"
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao criar commit.
    pause
    exit /b 1
)
echo [OK] Commit realizado.

:PUSH_SETUP
echo.
echo  ============================================
echo   CRIAR REPOSITORIO NO GITHUB
echo  ============================================
echo.
echo Vamos criar o repositorio no GitHub agora.
echo.
echo PASSOS (sera aberto no navegador):
echo  1. Clique em "New repository"
echo  2. Nome sugerido:  cautela-ferramentas
echo  3. Visibilidade:   Private
echo  4. IMPORTANTE: NAO marque nenhuma opcao de inicializacao
echo     (sem README, sem .gitignore, sem licenca)
echo  5. Clique em "Create repository"
echo  6. Copie a URL que aparecer
echo     Exemplo: https://github.com/seu-usuario/cautela-ferramentas.git
echo.
echo Pressione qualquer tecla para abrir o GitHub...
pause >nul
start https://github.com/new

echo.
set /p REPO_URL="Cole a URL do repositorio aqui e pressione Enter: "

if "%REPO_URL%"=="" (
    echo Nenhuma URL informada. Tente novamente.
    pause
    exit /b 1
)

:: Remove remote existente e adiciona o novo
git remote remove origin 2>nul
git remote add origin %REPO_URL%
echo [OK] Repositorio configurado.

:: Push
echo.
echo Enviando codigo para o GitHub...
echo (Se uma janela de login aparecer, entre com sua conta GitHub)
echo.
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo  ============================================
    echo   SUCESSO! Codigo enviado para o GitHub.
    echo  ============================================
    echo.
    echo Proximo passo: conectar no Railway.
    echo.
    echo  1. Acesse https://railway.app
    echo  2. New Project - Deploy from GitHub repo
    echo  3. Selecione o repositorio: cautela-ferramentas
    echo  4. Adicione um Volume com mount path: /data
    echo  5. Adicione as variaveis de ambiente:
    echo       DATABASE_PATH = /data/ferramentas.db
    echo       JWT_SECRET    = (uma senha longa qualquer)
    echo.
    echo Abrindo Railway...
    start https://railway.app/new
) else (
    echo.
    echo  [ERRO] Falha ao enviar para o GitHub.
    echo.
    echo  Causas possiveis:
    echo  - Autenticacao necessaria (faca login no navegador quando solicitado)
    echo  - URL do repositorio incorreta
    echo.
    echo  Tente executar manualmente no terminal:
    echo    git push -u origin main
)

echo.
pause
