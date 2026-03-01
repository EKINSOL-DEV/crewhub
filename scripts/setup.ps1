# ============================================
# CrewHub Setup Script (Windows PowerShell)
# ============================================
# One-command setup: .\scripts\setup.ps1
# Checks prerequisites, creates venv, installs dependencies.

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$passed = @()
$warnings = @()
$failed = @()

function Write-Header {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor White
    Write-Host "  CrewHub Setup" -ForegroundColor White
    Write-Host "============================================" -ForegroundColor White
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host ">>> $Message" -ForegroundColor Blue
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  + $Message" -ForegroundColor Green
    $script:passed += $Message
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  ! $Message" -ForegroundColor Yellow
    $script:warnings += $Message
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  x $Message" -ForegroundColor Red
    $script:failed += $Message
}

# ------------------------------------------
# Check Python 3.11+
# ------------------------------------------
function Test-Python {
    Write-Step "Checking Python..."

    $pythonCmd = $null
    foreach ($cmd in @("python3", "python")) {
        try {
            $null = & $cmd --version 2>&1
            $pythonCmd = $cmd
            break
        } catch {
            continue
        }
    }

    if (-not $pythonCmd) {
        Write-Fail "Python 3.11+ is required but not found."
        Write-Host "       Install it from: https://www.python.org/downloads/"
        Write-Host "       Make sure to check 'Add Python to PATH' during installation."
        return $false
    }

    $version = & $pythonCmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    $parts = $version.Split(".")
    $major = [int]$parts[0]
    $minor = [int]$parts[1]

    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 11)) {
        Write-Fail "Python $version found, but 3.11+ is required."
        Write-Host "       Download a newer version from: https://www.python.org/downloads/"
        return $false
    }

    $script:PythonCmd = $pythonCmd
    Write-Ok "Python $version"
    return $true
}

# ------------------------------------------
# Check Node.js 18+
# ------------------------------------------
function Test-Node {
    Write-Step "Checking Node.js..."

    try {
        $version = (node --version) -replace '^v', ''
    } catch {
        Write-Fail "Node.js 18+ is required but not found."
        Write-Host "       Install it from: https://nodejs.org"
        return $false
    }

    $major = [int]($version.Split(".")[0])
    if ($major -lt 18) {
        Write-Fail "Node.js $version found, but 18+ is required."
        Write-Host "       Download a newer version from: https://nodejs.org"
        return $false
    }

    Write-Ok "Node.js $version"
    return $true
}

# ------------------------------------------
# Check npm
# ------------------------------------------
function Test-Npm {
    Write-Step "Checking npm..."

    try {
        $version = npm --version
    } catch {
        Write-Fail "npm is required but not found (should come with Node.js)."
        return $false
    }

    Write-Ok "npm $version"
    return $true
}

# ------------------------------------------
# Check Claude Code CLI (optional)
# ------------------------------------------
function Test-Claude {
    Write-Step "Checking Claude Code CLI..."

    try {
        $version = claude --version 2>&1
        Write-Ok "Claude Code CLI $version"
    } catch {
        Write-Warn "Claude Code CLI not found (optional)."
        Write-Host "       Install it for full Claude Code support:"
        Write-Host "         npm install -g @anthropic-ai/claude-code"
        Write-Host "       CrewHub will still work for OpenClaw monitoring without it."
    }
}

# ------------------------------------------
# Setup Python venv + backend deps
# ------------------------------------------
function Install-Backend {
    Write-Step "Setting up backend..."

    $venvPath = Join-Path $ProjectRoot "backend\venv"

    if (-not (Test-Path $venvPath)) {
        Write-Host "       Creating Python virtual environment..."
        & $script:PythonCmd -m venv $venvPath
        Write-Ok "Created venv at backend\venv"
    } else {
        Write-Ok "venv already exists at backend\venv"
    }

    Write-Host "       Installing Python dependencies..."
    $pipPath = Join-Path $venvPath "Scripts\pip.exe"
    & $pipPath install --quiet --upgrade pip
    & $pipPath install --quiet -r (Join-Path $ProjectRoot "backend\requirements.txt")
    Write-Ok "Backend dependencies installed"

    $envDev = Join-Path $ProjectRoot "backend\.env.development"
    $envExample = Join-Path $ProjectRoot "backend\.env.example"
    if (-not (Test-Path $envDev)) {
        if (Test-Path $envExample) {
            Copy-Item $envExample $envDev
            Write-Ok "Created backend\.env.development from .env.example"
        }
    } else {
        Write-Ok "backend\.env.development already exists"
    }
}

# ------------------------------------------
# Setup frontend deps
# ------------------------------------------
function Install-Frontend {
    Write-Step "Setting up frontend..."

    Write-Host "       Installing npm dependencies (this may take a minute)..."
    Push-Location (Join-Path $ProjectRoot "frontend")
    try {
        npm install --legacy-peer-deps --silent 2>&1 | Select-Object -Last 1
    } finally {
        Pop-Location
    }
    Write-Ok "Frontend dependencies installed"

    $envDev = Join-Path $ProjectRoot "frontend\.env.development"
    if (-not (Test-Path $envDev)) {
        Write-Host "       Creating frontend\.env.development..."
        @"
# Development environment - Vite dev server
VITE_API_URL=http://127.0.0.1:8091
"@ | Set-Content $envDev
        Write-Ok "Created frontend\.env.development"
    } else {
        Write-Ok "frontend\.env.development already exists"
    }
}

# ------------------------------------------
# Print summary
# ------------------------------------------
function Write-Summary {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor White
    Write-Host "  Setup Summary" -ForegroundColor White
    Write-Host "============================================" -ForegroundColor White

    if ($script:passed.Count -gt 0) {
        Write-Host ""
        Write-Host "Passed:" -ForegroundColor Green
        foreach ($item in $script:passed) {
            Write-Host "  + $item" -ForegroundColor Green
        }
    }

    if ($script:warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "Warnings:" -ForegroundColor Yellow
        foreach ($item in $script:warnings) {
            Write-Host "  ! $item" -ForegroundColor Yellow
        }
    }

    if ($script:failed.Count -gt 0) {
        Write-Host ""
        Write-Host "Failed:" -ForegroundColor Red
        foreach ($item in $script:failed) {
            Write-Host "  x $item" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "Please fix the issues above and re-run .\scripts\setup.ps1" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Start CrewHub:"
    Write-Host "    .\scripts\start.ps1"
    Write-Host ""
}

# ------------------------------------------
# Main
# ------------------------------------------
Write-Header

$script:PythonCmd = "python"
$prereqsOk = $true

if (-not (Test-Python)) { $prereqsOk = $false }
if (-not (Test-Node))   { $prereqsOk = $false }
if (-not (Test-Npm))    { $prereqsOk = $false }
Test-Claude

if (-not $prereqsOk) {
    Write-Host ""
    Write-Host "Prerequisites missing. Please install them and re-run this script." -ForegroundColor Red
    exit 1
}

Write-Host ""
Install-Backend
Install-Frontend
Write-Summary
