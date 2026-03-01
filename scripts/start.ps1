# ============================================
# CrewHub Start Script (Windows PowerShell)
# ============================================
# Starts backend and frontend for local development.
# Usage: .\scripts\start.ps1

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# ------------------------------------------
# Preflight checks
# ------------------------------------------
if (-not (Test-Path (Join-Path $ProjectRoot "backend\venv"))) {
    Write-Host "Backend venv not found. Run setup first:" -ForegroundColor Red
    Write-Host "  .\scripts\setup.ps1"
    exit 1
}

if (-not (Test-Path (Join-Path $ProjectRoot "frontend\node_modules"))) {
    Write-Host "Frontend node_modules not found. Run setup first:" -ForegroundColor Red
    Write-Host "  .\scripts\setup.ps1"
    exit 1
}

# ------------------------------------------
# Load env vars from .env.development
# ------------------------------------------
function Import-EnvFile {
    param([string]$Path)
    if (Test-Path $Path) {
        Get-Content $Path | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $key = $Matches[1].Trim()
                $value = $Matches[2].Trim()
                # Expand ~ to user home
                $value = $value -replace '^~', $env:USERPROFILE
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    }
}

# ------------------------------------------
# Start services
# ------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor White
Write-Host "  CrewHub Development Server" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host ""

$backendPort = if ($env:CREWHUB_PORT) { $env:CREWHUB_PORT } else { "8091" }
$frontendPort = if ($env:VITE_DEV_PORT) { $env:VITE_DEV_PORT } else { "5181" }

# Load backend env
Import-EnvFile (Join-Path $ProjectRoot "backend\.env.development")
if ($env:CREWHUB_PORT) { $backendPort = $env:CREWHUB_PORT }

# Start backend as a job
$backendJob = Start-Job -ScriptBlock {
    param($root, $port)
    Set-Location (Join-Path $root "backend")

    # Load env vars
    if (Test-Path ".env.development") {
        Get-Content ".env.development" | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $key = $Matches[1].Trim()
                $value = $Matches[2].Trim()
                $value = $value -replace '^~', $env:USERPROFILE
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    }

    $venvPython = Join-Path $root "backend\venv\Scripts\python.exe"
    & $venvPython -m uvicorn app.main:app --reload --port $port
} -ArgumentList $ProjectRoot, $backendPort

# Start frontend as a job
$frontendJob = Start-Job -ScriptBlock {
    param($root, $port)
    Set-Location (Join-Path $root "frontend")

    # Load env vars
    if (Test-Path ".env.development") {
        Get-Content ".env.development" | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $key = $Matches[1].Trim()
                $value = $Matches[2].Trim()
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    }

    npm run dev -- --port $port
} -ArgumentList $ProjectRoot, $frontendPort

Write-Host "  Backend:  http://localhost:$backendPort" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:$frontendPort" -ForegroundColor Green
Write-Host ""
Write-Host "  Press Ctrl+C to stop both services."
Write-Host ""

# Wait and relay output
try {
    while ($true) {
        # Stream backend output
        Receive-Job -Job $backendJob -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "[backend] $_"
        }
        # Stream frontend output
        Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "[frontend] $_"
        }

        # Check if either job has stopped
        if ($backendJob.State -eq "Completed" -or $backendJob.State -eq "Failed") {
            Write-Host "Backend process exited." -ForegroundColor Yellow
            break
        }
        if ($frontendJob.State -eq "Completed" -or $frontendJob.State -eq "Failed") {
            Write-Host "Frontend process exited." -ForegroundColor Yellow
            break
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host ""
    Write-Host "Shutting down..." -ForegroundColor Blue
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped." -ForegroundColor Green
}
