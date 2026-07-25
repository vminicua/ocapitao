# O Capitão

Aplicação desktop para gestão do Barbershop “O Capitão”, preparada para operação offline com SQLite local e sincronização via API Django para MySQL remoto.

## Stack

- Desktop: Tauri v2
- Frontend: React + TypeScript + Vite
- Backend/API: Python + Django + Django REST Framework
- Offline local: SQLite
- Online central: MySQL via túnel SSH

## Estrutura

- `backend/` API Django local e remota
- `frontend/` interface React preparada para Tauri
- `frontend/src-tauri/` shell desktop Tauri v2
- `scripts/` atalhos operacionais

## Pré-requisitos

- Python 3.12+
- Node.js 20+ ou 22+
- npm 10+
- Rust + Cargo
  Necessário para correr `tauri dev` e gerar o build Windows
- WebView2 no Windows

## Configuração inicial

1. Criar o ambiente virtual:

```powershell
python -m venv .venv
```

2. Instalar dependências Python:

```powershell
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

3. Instalar dependências do frontend:

```powershell
cd frontend
npm install
```

4. Copiar `.env.example` para `.env` e preencher a password do MySQL.

## Túnel SSH para MySQL remoto

```powershell
ssh -L 5523:127.0.0.1:3306 salacsth@premium342.web-hosting.com -p 21098 -N
```

Também existe o atalho:

```powershell
.\scripts\open_ssh_tunnel.ps1
```

## Rodar o backend local com SQLite

```powershell
cd backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py seed_initial_data
..\.venv\Scripts\python manage.py runserver 127.0.0.1:8000
```

Ou usar o script:

```powershell
cd backend
..\scripts\run_local_backend.ps1
```

## Rodar a API remota com MySQL

Com o túnel SSH ativo:

```powershell
cd backend
$env:DJANGO_SETTINGS_MODULE="config.settings.remote"
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py runserver 127.0.0.1:8001
```

## Rodar o frontend web

```powershell
cd frontend
npm run dev
```

Frontend esperado em `http://127.0.0.1:1420`.

## Rodar a app desktop Tauri

Depois de instalar Rust + Cargo:

```powershell
cd frontend
npm run tauri:dev
```

## Build Windows

```powershell
cd frontend
npm run tauri:build
```

## Utilizador inicial

- Email: `admin@ocapitao.local`
- Senha inicial: `admin123`
- O campo `force_password_change` fica ativo para futura alteração obrigatória.

## Funcionalidades já preparadas

- Modelos Django para contas, clientes, serviços, POS, stock, viaturas, sincronização e definições
- JWT com endpoint de login
- Dashboard em português
- Interface touch/POS com sidebar e cartões grandes
- Inputs reutilizáveis com teclado virtual
- Fila local de sincronização `sync_queue`
- Serviço manual de sincronização para API remota

## Notas importantes

- O frontend nunca escreve diretamente no MySQL remoto.
- O modo offline depende do backend local a correr com SQLite.
- Nesta máquina, no momento desta entrega, `cargo` e `rustc` não estavam instalados; por isso a shell Tauri foi preparada mas não validada em execução nativa.
