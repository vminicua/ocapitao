$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"
$pythonExe = Join-Path $rootDir ".venv\Scripts\python.exe"
$npmCmd = "npm.cmd"
$logsDir = Join-Path $rootDir "logs"

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port
  )

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $task = $client.ConnectAsync($HostName, $Port)
    if (-not $task.Wait(1500)) {
      $client.Dispose()
      return $false
    }
    $client.Dispose()
    return $true
  } catch {
    return $false
  }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$Retries = 30
  )

  for ($i = 0; $i -lt $Retries; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 6
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 800
    }
  }

  return $false
}

function Clear-WorkspacePort {
  param([int]$Port)

  $portProcessId = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

  if (-not $portProcessId) {
    return
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $portProcessId"
  if (-not $process) {
    return
  }

  $commandLine = $process.CommandLine
  $isWorkspaceVite = $process.Name -eq "node.exe" -and $commandLine -like "*$frontendDir*" -and $commandLine -like "*vite*"
  if (-not $isWorkspaceVite) {
    throw "A porta $Port já está em uso por outro processo ($($process.Name) #$portProcessId). Feche esse processo e tente novamente."
  }

  Stop-Process -Id $portProcessId -Force -ErrorAction SilentlyContinue

  if ($process.ParentProcessId -gt 0) {
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ParentProcessId)"
    if ($parent -and $parent.CommandLine -like "*$frontendDir*") {
      Stop-Process -Id $parent.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }

  Start-Sleep -Seconds 1
}

$startedProcesses = @()

try {
  if (-not (Test-Path $pythonExe)) {
    throw "Não encontrei o Python virtual em $pythonExe"
  }

  # Garantir que as dependências estão instaladas (inclui paramiko)
  Write-Host "A verificar dependências Python..." -ForegroundColor Cyan
  & $pythonExe -m pip install -r (Join-Path $backendDir "requirements.txt") --quiet

  # Iniciar apenas o backend-local (SQLite). O backend-cloud e o túnel SSH
  # são geridos pelo próprio Django quando o utilizador liga a cloud na app.
  if (Test-TcpPort -HostName "127.0.0.1" -Port 8000) {
    Write-Host "backend-local já está a correr na porta 8000." -ForegroundColor Yellow
  } else {
    $stdout = Join-Path $logsDir "backend-local.out.log"
    $stderr = Join-Path $logsDir "backend-local.err.log"

    $command = @"
`$env:DJANGO_SETTINGS_MODULE = 'config.settings.local'
Set-Location '$backendDir'
& '$pythonExe' manage.py migrate
& '$pythonExe' manage.py seed_initial_data
& '$pythonExe' manage.py runserver 127.0.0.1:8000
"@

    $localProcess = Start-Process `
      -FilePath "powershell.exe" `
      -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $command) `
      -WorkingDirectory $backendDir `
      -WindowStyle Hidden `
      -PassThru `
      -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr

    $startedProcesses += $localProcess

    if (-not (Wait-HttpReady -Url "http://127.0.0.1:8000/api/health/")) {
      Write-Host "Aviso: backend-local não respondeu a tempo. Veja os logs em $logsDir." -ForegroundColor Red
    } else {
      Write-Host "backend-local pronto em http://127.0.0.1:8000" -ForegroundColor Green
    }
  }

  Write-Host "A app vai arrancar em modo local. Se houver credenciais de cloud guardadas, a ligação será feita automaticamente." -ForegroundColor Cyan

  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  Set-Location $frontendDir
  Clear-WorkspacePort -Port 1420
  & $npmCmd run tauri:dev
} finally {
  foreach ($process in $startedProcesses) {
    if ($null -ne $process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
