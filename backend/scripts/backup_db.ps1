# Faz um backup do banco Postgres do Veloxy, lendo a DATABASE_URL do .env
# na pasta backend/ (nao precisa passar usuario/senha/host na mao).
#
# Uso: abra o PowerShell dentro de backend/ (ou de qualquer pasta) e rode:
#   .\scripts\backup_db.ps1
#
# O arquivo de saida vai para backend\backups\veloxy_YYYY-MM-DD_HHmmss.dump
# — esse formato (-Fc, "custom" do pg_dump) e compactado e serve tanto para
# restaurar o banco inteiro quanto so uma tabela, com pg_restore.

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$envPath = Join-Path $backendDir ".env"

if (-not (Test-Path $envPath)) {
    Write-Error "Nao encontrei $envPath — rode este script a partir do repositorio clonado, com o .env do backend configurado."
    exit 1
}

$databaseUrl = (Get-Content $envPath | Where-Object { $_ -match "^DATABASE_URL=" }) -replace "^DATABASE_URL=", ""
if (-not $databaseUrl) {
    Write-Error "DATABASE_URL nao encontrada em $envPath"
    exit 1
}

# postgresql+psycopg://usuario:senha@host:porta/banco
if ($databaseUrl -notmatch "^postgresql(\+psycopg)?://([^:]+):([^@]+)@([^:/]+):(\d+)/(.+)$") {
    Write-Error "Nao foi possivel interpretar DATABASE_URL. Formato esperado: postgresql+psycopg://usuario:senha@host:porta/banco"
    exit 1
}

$dbUser = $Matches[2]
$dbPassword = $Matches[3]
$dbHost = $Matches[4]
$dbPort = $Matches[5]
$dbName = $Matches[6]

$backupsDir = Join-Path $backendDir "backups"
if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outputFile = Join-Path $backupsDir "veloxy_$timestamp.dump"

$env:PGPASSWORD = $dbPassword

Write-Host "Fazendo backup de '$dbName' ($dbHost`:$dbPort) para $outputFile ..."

try {
    & pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName -Fc -f $outputFile
} catch {
    Write-Error "pg_dump falhou ou nao foi encontrado no PATH. Se o PostgreSQL estiver instalado, ache o pg_dump.exe (geralmente em C:\Program Files\PostgreSQL\<versao>\bin) e rode este script de novo apos adicionar essa pasta ao PATH, ou chame pg_dump com o caminho completo."
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump terminou com erro (codigo $LASTEXITCODE)."
    exit 1
}

$sizeKb = [math]::Round((Get-Item $outputFile).Length / 1KB, 1)
Write-Host "Backup concluido: $outputFile ($sizeKb KB)"
Write-Host ""
Write-Host "Para restaurar esse backup num banco (mesmo nome ou outro, ja criado e vazio):"
Write-Host "  pg_restore -h $dbHost -p $dbPort -U $dbUser -d NOME_DO_BANCO -c `"$outputFile`""
