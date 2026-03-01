# CrewHub Service Manager (Windows)
# Install, uninstall, update, status, and logs for CrewHub as a background service.
# Usage: .\scripts\service.ps1 {install|uninstall|update|status|logs}

param(
    [Parameter(Position = 0)]
    [ValidateSet("install", "uninstall", "update", "status", "logs")]
    [string]$Command
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $env:USERPROFILE ".crewhub"
$TaskName = "CrewHub"
$BackendPort = if ($env:CREWHUB_PORT) { $env:CREWHUB_PORT } else { "8090" }
$FrontendPort = if ($env:CREWHUB_FRONTEND_PORT) { $env:CREWHUB_FRONTEND_PORT } else { "8446" }

# ------------------------------------------
# Helpers
# ------------------------------------------
function Write-Info  { param($msg) Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host ">>> $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host ">>> $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host ">>> $msg" -ForegroundColor Red }

function Test-Prerequisites {
    $ok = $true

    if (-not (Test-Path (Join-Path $ProjectRoot "backend\venv"))) {
        Write-Err "Backend venv not found. Run setup first: .\scripts\setup.ps1"
        $ok = $false
    }

    if (-not (Test-Path (Join-Path $ProjectRoot "frontend\node_modules"))) {
        Write-Err "Frontend node_modules not found. Run setup first: .\scripts\setup.ps1"
        $ok = $false
    }

    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Err "python not found"
        $ok = $false
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err "node not found"
        $ok = $false
    }

    if (-not $ok) { exit 1 }
}

function Stop-CrewHubProcesses {
    # Stop backend
    $backendPid = Join-Path $LogDir "backend.pid"
    if (Test-Path $backendPid) {
        $pid = Get-Content $backendPid -ErrorAction SilentlyContinue
        if ($pid) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $backendPid -Force -ErrorAction SilentlyContinue
    }

    # Stop frontend
    $frontendPid = Join-Path $LogDir "frontend.pid"
    if (Test-Path $frontendPid) {
        $pid = Get-Content $frontendPid -ErrorAction SilentlyContinue
        if ($pid) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $frontendPid -Force -ErrorAction SilentlyContinue
    }

    # Stop watchdog
    $watchdogPid = Join-Path $LogDir "watchdog.pid"
    if (Test-Path $watchdogPid) {
        $pid = Get-Content $watchdogPid -ErrorAction SilentlyContinue
        if ($pid) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $watchdogPid -Force -ErrorAction SilentlyContinue
    }

    # Kill anything lingering on service ports
    $connections = Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    $connections = Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# ------------------------------------------
# Wrapper script that Task Scheduler runs
# ------------------------------------------
function Write-WrapperScript {
    $wrapperPath = Join-Path $ScriptDir "service-wrapper.ps1"
    $wrapperContent = @"
# CrewHub Service Wrapper — launched by Task Scheduler
# Starts backend and frontend, monitors and restarts on crash

`$ErrorActionPreference = "Continue"

`$ProjectRoot = "$ProjectRoot"
`$LogDir = "$LogDir"
`$BackendPort = "$BackendPort"
`$FrontendPort = "$FrontendPort"

if (-not (Test-Path `$LogDir)) { New-Item -ItemType Directory -Path `$LogDir -Force | Out-Null }

`$pidFile = Join-Path `$LogDir "watchdog.pid"
`$PID | Out-File -FilePath `$pidFile -Force

function Start-Backend {
    `$env:CREWHUB_PORT = `$BackendPort
    `$env:CREWHUB_DB_PATH = Join-Path `$env:USERPROFILE ".crewhub\crewhub.db"
    `$venvPython = Join-Path `$ProjectRoot "backend\venv\Scripts\python.exe"
    `$logFile = Join-Path `$LogDir "backend.log"
    `$proc = Start-Process -FilePath `$venvPython -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", `$BackendPort -WorkingDirectory (Join-Path `$ProjectRoot "backend") -RedirectStandardOutput `$logFile -RedirectStandardError (Join-Path `$LogDir "backend-stderr.log") -PassThru -NoNewWindow
    `$proc.Id | Out-File -FilePath (Join-Path `$LogDir "backend.pid") -Force
    return `$proc
}

function Start-Frontend {
    `$distDir = Join-Path `$ProjectRoot "frontend\dist"
    if (-not (Test-Path `$distDir)) {
        Set-Location (Join-Path `$ProjectRoot "frontend")
        npm run build
    }
    `$logFile = Join-Path `$LogDir "frontend.log"
    `$proc = Start-Process -FilePath "npx" -ArgumentList "serve", "dist", "-l", `$FrontendPort, "-s" -WorkingDirectory (Join-Path `$ProjectRoot "frontend") -RedirectStandardOutput `$logFile -RedirectStandardError (Join-Path `$LogDir "frontend-stderr.log") -PassThru -NoNewWindow
    `$proc.Id | Out-File -FilePath (Join-Path `$LogDir "frontend.pid") -Force
    return `$proc
}

# Start both
`$backendProc = Start-Backend
`$frontendProc = Start-Frontend

`$maxRestarts = 10
`$restartCount = 0
`$windowStart = Get-Date

while (`$true) {
    Start-Sleep -Seconds 30

    # Reset counter after 10 minutes
    if (((Get-Date) - `$windowStart).TotalSeconds -gt 600) {
        `$restartCount = 0
        `$windowStart = Get-Date
    }

    # Check backend
    if (`$backendProc.HasExited) {
        if (`$restartCount -ge `$maxRestarts) {
            Add-Content -Path (Join-Path `$LogDir "backend.log") -Value "[`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: Max restarts reached. Giving up."
            break
        }
        `$restartCount++
        Add-Content -Path (Join-Path `$LogDir "backend.log") -Value "[`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Backend exited. Restarting (attempt `$restartCount/`$maxRestarts)..."
        Start-Sleep -Seconds ([Math]::Min([Math]::Pow(2, `$restartCount), 120))
        `$backendProc = Start-Backend
    }

    # Check frontend
    if (`$frontendProc.HasExited) {
        Add-Content -Path (Join-Path `$LogDir "backend.log") -Value "[`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Frontend exited. Restarting..."
        `$frontendProc = Start-Frontend
    }
}

Remove-Item `$pidFile -Force -ErrorAction SilentlyContinue
"@
    Set-Content -Path $wrapperPath -Value $wrapperContent -Force
    return $wrapperPath
}

# ------------------------------------------
# Install
# ------------------------------------------
function Do-Install {
    Write-Info "Installing CrewHub as a background service..."
    Write-Host ""

    Test-Prerequisites

    # Build frontend
    Write-Info "Building frontend..."
    Set-Location (Join-Path $ProjectRoot "frontend")
    npm run build
    if (-not (Test-Path (Join-Path $ProjectRoot "frontend\dist"))) {
        Write-Err "Frontend build failed"
        exit 1
    }
    Write-Ok "Frontend built"

    # Ensure serve is available
    Write-Info "Checking for serve..."
    $serveCheck = npm list serve 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Installing serve..."
        npm install --save-dev serve --legacy-peer-deps
    }
    Write-Ok "serve available"

    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }

    # Generate wrapper script
    Write-Info "Generating service wrapper..."
    $wrapperPath = Write-WrapperScript
    Write-Ok "Wrapper script written"

    # Remove existing task if present
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    # Create scheduled task
    Write-Info "Registering scheduled task..."
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapperPath`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(1))
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "CrewHub background service" | Out-Null

    # Start the task now
    Start-ScheduledTask -TaskName $TaskName
    Write-Ok "Service registered and started"

    Write-Host ""
    Write-Ok "CrewHub service installed and started!"
    Write-Host ""
    Write-Host "  Backend:  http://localhost:$BackendPort"  -ForegroundColor Green
    Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor Green
    Write-Host ""
    Write-Host "  The service will start automatically on login."
    Write-Host "  Run .\scripts\service.ps1 status to check."
    Write-Host ""
}

# ------------------------------------------
# Uninstall
# ------------------------------------------
function Do-Uninstall {
    Write-Info "Uninstalling CrewHub service..."

    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Ok "Scheduled task removed"
    } else {
        Write-Warn "Scheduled task '$TaskName' not found (already removed?)"
    }

    Stop-CrewHubProcesses

    # Remove wrapper script
    $wrapperPath = Join-Path $ScriptDir "service-wrapper.ps1"
    if (Test-Path $wrapperPath) {
        Remove-Item $wrapperPath -Force
    }

    Write-Host ""
    Write-Ok "CrewHub service uninstalled."
    Write-Host ""
}

# ------------------------------------------
# Update
# ------------------------------------------
function Do-Update {
    Write-Info "Updating CrewHub..."
    Write-Host ""

    # Stop the service
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Info "Stopping service..."
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    }
    Stop-CrewHubProcesses

    # Pull latest code
    Write-Info "Pulling latest code..."
    Set-Location $ProjectRoot
    git pull
    Write-Ok "Code updated"

    # Update backend deps
    Write-Info "Updating backend dependencies..."
    $venvPip = Join-Path $ProjectRoot "backend\venv\Scripts\pip.exe"
    & $venvPip install -r (Join-Path $ProjectRoot "backend\requirements.txt") -q
    Write-Ok "Backend dependencies updated"

    # Update frontend deps
    Write-Info "Updating frontend dependencies..."
    Set-Location (Join-Path $ProjectRoot "frontend")
    npm install --legacy-peer-deps
    Write-Ok "Frontend dependencies updated"

    # Rebuild frontend
    Write-Info "Building frontend..."
    npm run build
    Write-Ok "Frontend rebuilt"

    # Regenerate wrapper and restart
    if ($existingTask) {
        Write-Info "Restarting service..."
        Write-WrapperScript | Out-Null
        Start-ScheduledTask -TaskName $TaskName
        Write-Ok "Service restarted"
    } else {
        Write-Warn "No scheduled task found. Run '.\scripts\service.ps1 install' to set up the service."
    }

    Write-Host ""
    Write-Ok "Update complete!"
    Write-Host ""
    Write-Host "  Backend:  http://localhost:$BackendPort"  -ForegroundColor Green
    Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor Green
    Write-Host ""
}

# ------------------------------------------
# Status
# ------------------------------------------
function Do-Status {
    Write-Host "CrewHub Service Status" -ForegroundColor White
    Write-Host ""

    # Check Task Scheduler
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Ok "Scheduled Task: $($task.State)"
        Write-Host "  Last run: $($taskInfo.LastRunTime)"
        Write-Host "  Last result: $($taskInfo.LastTaskResult)"
    } else {
        Write-Warn "Scheduled Task: not registered"
    }

    # Check processes
    $watchdogPid = Join-Path $LogDir "watchdog.pid"
    if (Test-Path $watchdogPid) {
        $pid = Get-Content $watchdogPid -ErrorAction SilentlyContinue
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Ok "Watchdog: running (PID $pid)"
        } else {
            Write-Warn "Watchdog: not running (stale PID file)"
        }
    } else {
        Write-Warn "Watchdog: not running"
    }

    $backendPid = Join-Path $LogDir "backend.pid"
    if (Test-Path $backendPid) {
        $pid = Get-Content $backendPid -ErrorAction SilentlyContinue
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Ok "Backend: running (PID $pid) on port $BackendPort"
            try {
                $response = Invoke-RestMethod -Uri "http://localhost:$BackendPort/api/health" -TimeoutSec 5
                if ($response.status -eq "healthy") {
                    Write-Ok "Health: OK"
                } else {
                    Write-Warn "Health: DEGRADED"
                }
            } catch {
                Write-Warn "Health: FAILING"
            }
        } else {
            Write-Warn "Backend: not running (stale PID file)"
        }
    } else {
        Write-Warn "Backend: not running"
    }

    $frontendPid = Join-Path $LogDir "frontend.pid"
    if (Test-Path $frontendPid) {
        $pid = Get-Content $frontendPid -ErrorAction SilentlyContinue
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Ok "Frontend: running (PID $pid) on port $FrontendPort"
        } else {
            Write-Warn "Frontend: not running (stale PID file)"
        }
    } else {
        Write-Warn "Frontend: not running"
    }

    Write-Host ""
    Write-Host "  Backend:  http://localhost:$BackendPort"  -ForegroundColor Green
    Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor Green
    Write-Host ""
}

# ------------------------------------------
# Logs
# ------------------------------------------
function Do-Logs {
    $logFile = Join-Path $LogDir "backend.log"
    if (Test-Path $logFile) {
        Get-Content $logFile -Tail 50 -Wait
    } else {
        Write-Warn "No log file found at $logFile"
        exit 1
    }
}

# ------------------------------------------
# Main
# ------------------------------------------
if (-not $Command) {
    Write-Host "Usage: .\scripts\service.ps1 {install|uninstall|update|status|logs}"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  install    Build, register, and start CrewHub as a background service"
    Write-Host "  uninstall  Stop and remove the CrewHub service"
    Write-Host "  update     Pull latest code, rebuild, and restart the service"
    Write-Host "  status     Show service and process status"
    Write-Host "  logs       Tail the service log file"
    exit 1
}

switch ($Command) {
    "install"   { Do-Install }
    "uninstall" { Do-Uninstall }
    "update"    { Do-Update }
    "status"    { Do-Status }
    "logs"      { Do-Logs }
}
