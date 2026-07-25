$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path $scriptDir "..")
Set-Location (Join-Path $rootDir "backend")

$env:DJANGO_SETTINGS_MODULE = "config.settings.local"
& "$rootDir\.venv\Scripts\python.exe" manage.py migrate
& "$rootDir\.venv\Scripts\python.exe" manage.py seed_initial_data
& "$rootDir\.venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000
