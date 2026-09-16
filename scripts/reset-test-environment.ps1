#Requires -Version 7.0

<#
.SYNOPSIS
Backs up and resets the local development environment to an empty data state.

.DESCRIPTION
Creates and verifies backups of PostgreSQL and the application-data Docker
volume before removing application data. The database schema and Alembic
revision are preserved. Redis, uploaded data sources, generated artifacts, and
artifact run files are cleared. API and worker services are restarted and the
result is verified.

The script refuses to run unless the rendered Compose configuration targets the
local development PostgreSQL and Redis services.

.PARAMETER BackupDirectory
Directory that receives timestamped database, runtime-data, and manifest files.
Defaults to a sibling `<repository-name>-backups` directory.

.PARAMETER ReadyTimeoutSeconds
Maximum time to wait for the API readiness endpoint after the reset.

.EXAMPLE
./scripts/reset-test-environment.ps1

.EXAMPLE
./scripts/reset-test-environment.ps1 -WhatIf

.EXAMPLE
./scripts/reset-test-environment.ps1 -Confirm:$false
#>

[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
    [string]$BackupDirectory,

    [ValidateRange(10, 300)]
    [int]$ReadyTimeoutSeconds = 90
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,

        [Parameter(Mandatory)]
        [string[]]$ArgumentList,

        [string]$FailureMessage = "Command failed: $FilePath"
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit code $LASTEXITCODE)."
    }
}

function Get-NativeOutput {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,

        [Parameter(Mandatory)]
        [string[]]$ArgumentList,

        [string]$FailureMessage = "Command failed: $FilePath"
    )

    $output = & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit code $LASTEXITCODE)."
    }

    return ($output | Out-String).Trim()
}

function Assert-RequiredValue {
    param(
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$Value,

        [Parameter(Mandatory)]
        [string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Required Compose value '$Name' is missing."
    }
}

function Test-ApplicationTablesEmpty {
    param(
        [Parameter(Mandatory)]
        [string]$DatabaseUser,

        [Parameter(Mandatory)]
        [string]$DatabaseName
    )

    $verificationSql = @'
DO $$
DECLARE
    item record;
    row_total bigint;
BEGIN
    FOR item IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> 'alembic_version'
        ORDER BY tablename
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM %I.%I',
            item.schemaname,
            item.tablename
        )
        INTO row_total;

        IF row_total <> 0 THEN
            RAISE EXCEPTION 'Table %.% contains % rows',
                item.schemaname,
                item.tablename,
                row_total;
        END IF;
    END LOOP;
END
$$;

SELECT version_num FROM alembic_version;
'@

    $result = $verificationSql |
        & docker compose exec -T postgres psql `
            -v ON_ERROR_STOP=1 `
            -At `
            -U $DatabaseUser `
            -d $DatabaseName

    if ($LASTEXITCODE -ne 0) {
        throw 'PostgreSQL empty-state verification failed.'
    }

    $revision = ($result | Select-Object -Last 1).Trim()
    if ([string]::IsNullOrWhiteSpace($revision)) {
        throw 'The Alembic revision was not preserved.'
    }

    return $revision
}

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repositoryParent = Split-Path -Parent $repositoryRoot
$repositoryName = Split-Path -Leaf $repositoryRoot

if ([string]::IsNullOrWhiteSpace($BackupDirectory)) {
    $BackupDirectory = Join-Path $repositoryParent "$repositoryName-backups"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is required but was not found on PATH.'
}

Push-Location $repositoryRoot
try {
    $composeJson = Get-NativeOutput `
        -FilePath 'docker' `
        -ArgumentList @('compose', 'config', '--format', 'json') `
        -FailureMessage 'Could not render the Docker Compose configuration'
    $compose = $composeJson | ConvertFrom-Json

    $requiredServices = @('api', 'worker', 'postgres', 'redis')
    foreach ($service in $requiredServices) {
        if (-not $compose.services.PSObject.Properties.Name.Contains($service)) {
            throw "Required Compose service '$service' is missing."
        }
    }

    $appEnvironment = [string]$compose.services.api.environment.APP_ENV
    $databaseUrl = [string]$compose.services.api.environment.DATABASE_URL
    $redisUrl = [string]$compose.services.api.environment.REDIS_URL
    $dataDirectory = [string]$compose.services.api.environment.DATA_DIRECTORY
    $databaseName = [string]$compose.services.postgres.environment.POSTGRES_DB
    $databaseUser = [string]$compose.services.postgres.environment.POSTGRES_USER
    $backupImage = [string]$compose.services.postgres.image

    Assert-RequiredValue -Value $appEnvironment -Name 'services.api.environment.APP_ENV'
    Assert-RequiredValue -Value $databaseUrl -Name 'services.api.environment.DATABASE_URL'
    Assert-RequiredValue -Value $redisUrl -Name 'services.api.environment.REDIS_URL'
    Assert-RequiredValue -Value $dataDirectory -Name 'services.api.environment.DATA_DIRECTORY'
    Assert-RequiredValue -Value $databaseName -Name 'services.postgres.environment.POSTGRES_DB'
    Assert-RequiredValue -Value $databaseUser -Name 'services.postgres.environment.POSTGRES_USER'
    Assert-RequiredValue -Value $backupImage -Name 'services.postgres.image'

    if ($appEnvironment -ne 'development') {
        throw "Reset refused: APP_ENV is '$appEnvironment', not 'development'."
    }

    $escapedDatabaseName = [regex]::Escape($databaseName)
    if ($databaseUrl -notmatch "@postgres(?::[0-9]+)?/$escapedDatabaseName(?:[?]|$)") {
        throw 'Reset refused: DATABASE_URL does not target the local Compose postgres service.'
    }

    if ($redisUrl -notmatch '^redis://redis(?::6379)?/0$') {
        throw 'Reset refused: REDIS_URL does not target database 0 on the local Compose redis service.'
    }

    if ($dataDirectory -ne '/app/runtime-data') {
        throw "Reset refused: unexpected DATA_DIRECTORY '$dataDirectory'."
    }

    $apiContainer = Get-NativeOutput `
        -FilePath 'docker' `
        -ArgumentList @('compose', 'ps', '-aq', 'api') `
        -FailureMessage 'Could not locate the API container'
    if ([string]::IsNullOrWhiteSpace($apiContainer)) {
        throw 'The API container does not exist. Start the stack before running the reset.'
    }

    $applicationDataVolume = Get-NativeOutput `
        -FilePath 'docker' `
        -ArgumentList @(
            'inspect',
            '--format',
            '{{range .Mounts}}{{if eq .Destination "/app/runtime-data"}}{{.Name}}{{end}}{{end}}',
            $apiContainer
        ) `
        -FailureMessage 'Could not identify the application-data volume'
    Assert-RequiredValue -Value $applicationDataVolume -Name 'application-data volume'

    $volumeRole = Get-NativeOutput `
        -FilePath 'docker' `
        -ArgumentList @(
            'volume',
            'inspect',
            '--format',
            '{{index .Labels "com.docker.compose.volume"}}',
            $applicationDataVolume
        ) `
        -FailureMessage 'Could not validate the application-data volume'
    if ($volumeRole -ne 'application-data') {
        throw "Reset refused: volume '$applicationDataVolume' is not labeled as application-data."
    }

    $publishedApiPort = [string](@($compose.services.api.ports)[0].published)
    Assert-RequiredValue -Value $publishedApiPort -Name 'services.api.ports[0].published'
    $readyUrl = "http://127.0.0.1:$publishedApiPort/ready"

    $targetDescription = @(
        "PostgreSQL database '$databaseName' application rows",
        'Redis database 0',
        "Docker volume '$applicationDataVolume' contents"
    ) -join '; '

    if (-not $PSCmdlet.ShouldProcess(
            $targetDescription,
            'Create verified backups, permanently clear test data, and restart services'
        )) {
        return
    }

    New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
    $resolvedBackupDirectory = (Resolve-Path -LiteralPath $BackupDirectory).Path

    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $databaseBackupName = "$databaseName-before-reset-$timestamp.dump"
    $runtimeBackupName = "application-data-before-reset-$timestamp.tar.gz"
    $manifestName = "reset-$timestamp.manifest.json"
    $databaseBackupPath = Join-Path $resolvedBackupDirectory $databaseBackupName
    $runtimeBackupPath = Join-Path $resolvedBackupDirectory $runtimeBackupName
    $manifestPath = Join-Path $resolvedBackupDirectory $manifestName
    $containerDumpPath = "/tmp/$databaseBackupName"
    $verificationDatabase = "${databaseName}_reset_verify_$($timestamp -replace '-', '_')_$PID"

    if ($verificationDatabase -notmatch "^$([regex]::Escape($databaseName))_reset_verify_[0-9_]+$") {
        throw 'Generated verification database name failed validation.'
    }

    $servicesStopped = $false
    $verificationDatabaseCreated = $false
    $operationError = $null
    $alembicRevision = ''

    try {
        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @('compose', 'stop', 'api', 'worker') `
            -FailureMessage 'Could not stop application writers'
        $servicesStopped = $true

        $postgresContainer = Get-NativeOutput `
            -FilePath 'docker' `
            -ArgumentList @('compose', 'ps', '-q', 'postgres') `
            -FailureMessage 'Could not locate the PostgreSQL container'
        Assert-RequiredValue -Value $postgresContainer -Name 'PostgreSQL container'

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @(
                'compose', 'exec', '-T', 'postgres',
                'pg_dump', '-U', $databaseUser, '-d', $databaseName,
                '-Fc', '-f', $containerDumpPath
            ) `
            -FailureMessage 'PostgreSQL backup failed'

        $containerBackupSource = $postgresContainer + ':' + $containerDumpPath
        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @('cp', $containerBackupSource, $databaseBackupPath) `
            -FailureMessage 'Could not copy the PostgreSQL backup to the host'

        $databaseBackup = Get-Item -LiteralPath $databaseBackupPath
        if ($databaseBackup.Length -le 0) {
            throw 'PostgreSQL produced an empty backup file.'
        }

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @(
                'run', '--rm',
                '--mount', "type=volume,source=$applicationDataVolume,target=/source,readonly",
                '--mount', "type=bind,source=$resolvedBackupDirectory,target=/backup",
                $backupImage,
                'tar', '-czf', "/backup/$runtimeBackupName", '-C', '/source', '.'
            ) `
            -FailureMessage 'Application-data backup failed'

        $runtimeBackup = Get-Item -LiteralPath $runtimeBackupPath
        if ($runtimeBackup.Length -le 0) {
            throw 'Application-data produced an empty backup file.'
        }

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @(
                'compose', 'exec', '-T', 'postgres',
                'pg_restore', '--list', $containerDumpPath
            ) `
            -FailureMessage 'PostgreSQL backup catalog verification failed'

        & docker run --rm `
            --mount "type=bind,source=$resolvedBackupDirectory,target=/backup,readonly" `
            $backupImage `
            tar -tzf "/backup/$runtimeBackupName" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'Application-data archive verification failed.'
        }

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @(
                'compose', 'exec', '-T', 'postgres',
                'createdb', '-U', $databaseUser, $verificationDatabase
            ) `
            -FailureMessage 'Could not create the backup verification database'
        $verificationDatabaseCreated = $true

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @(
                'compose', 'exec', '-T', 'postgres',
                'pg_restore', '-U', $databaseUser,
                '-d', $verificationDatabase, $containerDumpPath
            ) `
            -FailureMessage 'PostgreSQL restore verification failed'

        $alembicRevision = Get-NativeOutput `
            -FilePath 'docker' `
            -ArgumentList @(
                'compose', 'exec', '-T', 'postgres',
                'psql', '-U', $databaseUser, '-d', $verificationDatabase,
                '-Atc', 'SELECT version_num FROM alembic_version;'
            ) `
            -FailureMessage 'Could not validate the restored Alembic revision'
        Assert-RequiredValue -Value $alembicRevision -Name 'restored Alembic revision'

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @(
                'compose', 'exec', '-T', 'postgres',
                'dropdb', '-U', $databaseUser, $verificationDatabase
            ) `
            -FailureMessage 'Could not remove the backup verification database'
        $verificationDatabaseCreated = $false

        $cleanupSql = @'
BEGIN;
DO $$
DECLARE
    table_list text;
BEGIN
    SELECT string_agg(
        format('%I.%I', schemaname, tablename),
        ', ' ORDER BY schemaname, tablename
    )
    INTO table_list
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'alembic_version';

    IF table_list IS NULL THEN
        RAISE EXCEPTION 'No application tables were found to truncate.';
    END IF;

    EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
END
$$;
COMMIT;
'@

        $cleanupSql |
            & docker compose exec -T postgres psql `
                -v ON_ERROR_STOP=1 `
                -U $databaseUser `
                -d $databaseName
        if ($LASTEXITCODE -ne 0) {
            throw 'PostgreSQL cleanup failed.'
        }

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @('compose', 'exec', '-T', 'redis', 'redis-cli', 'FLUSHDB') `
            -FailureMessage 'Redis cleanup failed'

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @(
                'run', '--rm',
                '--mount', "type=volume,source=$applicationDataVolume,target=/data",
                $backupImage,
                'sh', '-ceu',
                'find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
            ) `
            -FailureMessage 'Application-data cleanup failed'

        $alembicRevisionAfterCleanup = Test-ApplicationTablesEmpty `
            -DatabaseUser $databaseUser `
            -DatabaseName $databaseName
        if ($alembicRevisionAfterCleanup -ne $alembicRevision) {
            throw "Alembic revision changed from '$alembicRevision' to '$alembicRevisionAfterCleanup'."
        }

        $redisSize = Get-NativeOutput `
            -FilePath 'docker' `
            -ArgumentList @('compose', 'exec', '-T', 'redis', 'redis-cli', 'DBSIZE') `
            -FailureMessage 'Could not verify Redis cleanup'
        if ($redisSize -ne '0') {
            throw "Redis still contains $redisSize key(s) after cleanup."
        }

        Invoke-NativeCommand `
            -FilePath 'docker' `
            -ArgumentList @(
                'run', '--rm',
                '--mount', "type=volume,source=$applicationDataVolume,target=/data,readonly",
                $backupImage,
                'sh', '-ceu',
                'test -z "$(find /data -mindepth 1 -maxdepth 1 -print -quit)"'
            ) `
            -FailureMessage 'Application-data is not empty after cleanup'
    }
    catch {
        $operationError = $_
    }
    finally {
        if ($verificationDatabaseCreated) {
            & docker compose exec -T postgres dropdb `
                -U $databaseUser `
                --if-exists $verificationDatabase | Out-Null
        }

        if (-not [string]::IsNullOrWhiteSpace($containerDumpPath)) {
            & docker compose exec -T postgres rm -f -- $containerDumpPath | Out-Null
        }

        if ($servicesStopped) {
            & docker compose start api worker
            if ($LASTEXITCODE -ne 0 -and $null -eq $operationError) {
                $operationError = [System.Management.Automation.ErrorRecord]::new(
                    [System.InvalidOperationException]::new('Could not restart API and worker services.'),
                    'ServiceRestartFailed',
                    [System.Management.Automation.ErrorCategory]::OperationStopped,
                    $null
                )
            }
        }
    }

    if ($null -ne $operationError) {
        throw $operationError
    }

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($ReadyTimeoutSeconds)
    $apiReady = $false
    do {
        try {
            $response = Invoke-WebRequest `
                -UseBasicParsing `
                -Uri $readyUrl `
                -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                $apiReady = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    } while ([DateTimeOffset]::UtcNow -lt $deadline)

    if (-not $apiReady) {
        throw "API readiness check did not pass within $ReadyTimeoutSeconds seconds: $readyUrl"
    }

    $postStartRevision = Test-ApplicationTablesEmpty `
        -DatabaseUser $databaseUser `
        -DatabaseName $databaseName
    if ($postStartRevision -ne $alembicRevision) {
        throw "Post-start Alembic revision '$postStartRevision' does not match '$alembicRevision'."
    }

    $redisJobStream = [string]$compose.services.api.environment.REDIS_JOB_STREAM
    Assert-RequiredValue -Value $redisJobStream -Name 'services.api.environment.REDIS_JOB_STREAM'
    $redisKeys = Get-NativeOutput `
        -FilePath 'docker' `
        -ArgumentList @('compose', 'exec', '-T', 'redis', 'redis-cli', '--scan') `
        -FailureMessage 'Could not perform the post-start Redis verification'

    if (-not [string]::IsNullOrWhiteSpace($redisKeys)) {
        $unexpectedKeys = @(
            $redisKeys -split "`r?`n" |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_ -ne $redisJobStream }
        )
        if ($unexpectedKeys.Count -gt 0) {
            throw "Redis contains unexpected key(s) after startup: $($unexpectedKeys -join ', ')"
        }

        $streamLength = Get-NativeOutput `
            -FilePath 'docker' `
            -ArgumentList @('compose', 'exec', '-T', 'redis', 'redis-cli', 'XLEN', $redisJobStream) `
            -FailureMessage 'Could not verify the Redis job stream'
        if ($streamLength -ne '0') {
            throw "Redis job stream contains $streamLength queued item(s) after startup."
        }
    }

    $databaseHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $databaseBackupPath).Hash
    $runtimeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $runtimeBackupPath).Hash
    $manifest = [ordered]@{
        completed_at = [DateTimeOffset]::Now.ToString('o')
        repository = $repositoryRoot
        app_environment = $appEnvironment
        database = $databaseName
        alembic_revision = $alembicRevision
        database_backup = [ordered]@{
            path = $databaseBackupPath
            bytes = (Get-Item -LiteralPath $databaseBackupPath).Length
            sha256 = $databaseHash
        }
        application_data_backup = [ordered]@{
            path = $runtimeBackupPath
            bytes = (Get-Item -LiteralPath $runtimeBackupPath).Length
            sha256 = $runtimeHash
        }
        reset = [ordered]@{
            application_tables_empty = $true
            redis_queue_empty = $true
            application_data_empty = $true
            api_ready = $true
        }
    }
    $manifest |
        ConvertTo-Json -Depth 6 |
        Set-Content -LiteralPath $manifestPath -Encoding utf8

    Write-Host ''
    Write-Host 'Development data reset completed successfully.' -ForegroundColor Green
    Write-Host "Database backup:        $databaseBackupPath"
    Write-Host "Application-data backup: $runtimeBackupPath"
    Write-Host "Manifest:               $manifestPath"
    Write-Host "Alembic revision:        $alembicRevision"
    Write-Host 'All application tables, Redis jobs, and runtime-data files are empty.'
}
finally {
    Pop-Location
}
