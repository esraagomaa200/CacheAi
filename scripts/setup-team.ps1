# NajdaAI one-shot team setup (Windows PowerShell 5.1+, ASCII only).
# Usage: clone the repo, drop the two .env files you received privately
# (backend\.env and .env at the repo root), then run:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-team.ps1
# When it finishes it prints the three run commands.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "== NajdaAI team setup ==" -ForegroundColor Green
Write-Host "Repo root: $root"

function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

# --- prerequisites -----------------------------------------------------------
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { Fail "Python not found on PATH. Install Python 3.12+ first." }
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail "Node.js not found on PATH. Install Node 20+ first." }
Write-Host ("Python: " + (& python --version))
Write-Host ("Node:   " + (& node --version))

# --- secrets check -----------------------------------------------------------
$missing = @()
if (-not (Test-Path (Join-Path $root "backend\.env"))) { $missing += "backend\.env" }
if (-not (Test-Path (Join-Path $root ".env")))         { $missing += ".env (repo root)" }
if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Missing secret files: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "Ask spoOOokii for them privately (WhatsApp/Drive), place them, then re-run."
    Write-Host "Templates showing the required keys: backend\.env.example and .env.example"
    exit 1
}
Write-Host "Secret files found." -ForegroundColor Green

# --- backend venv ------------------------------------------------------------
Write-Host "`n[1/4] Backend venv + deps..." -ForegroundColor Cyan
if (-not (Test-Path "backend\.venv")) { & python -m venv backend\.venv }
& backend\.venv\Scripts\python -m pip install --quiet --upgrade pip
& backend\.venv\Scripts\python -m pip install --quiet -r backend\requirements.txt
& backend\.venv\Scripts\python -c "import fastapi, sqlalchemy, qdrant_client, groq; from google import genai; print('backend deps OK')"

# --- NAJDA engine venv ---------------------------------------------------------
Write-Host "`n[2/4] NAJDA engine venv + deps (torch etc, takes a few minutes)..." -ForegroundColor Cyan
if (-not (Test-Path ".venv")) { & python -m venv .venv }
& .venv\Scripts\python -m pip install --quiet --upgrade pip
& .venv\Scripts\python -m pip install --quiet -r requirements.txt
& .venv\Scripts\python -c "import sentence_transformers, qdrant_client, groq; print('najda deps OK')"

# --- frontend ------------------------------------------------------------------
Write-Host "`n[3/4] Frontend npm install..." -ForegroundColor Cyan
Push-Location frontend
& npm install --no-audit --no-fund
Pop-Location

# --- local vector index ----------------------------------------------------------
Write-Host "`n[4/4] Building the local Qdrant index (needs GEMINI_API_KEY)..." -ForegroundColor Cyan
Push-Location backend
& .venv\Scripts\python -m ai.ingest
Pop-Location

Write-Host "`n== Setup complete. Run these in three terminals ==" -ForegroundColor Green
Write-Host "1) NAJDA engine :  cd app ; `$env:PYTHONIOENCODING='utf-8'; `$env:GEMINI_NORMALIZER_ENABLED='false'; ..\.venv\Scripts\python -m uvicorn main:app --port 8001"
Write-Host "2) Backend      :  cd backend ; `$env:PYTHONIOENCODING='utf-8'; .\.venv\Scripts\python -m uvicorn main:app --port 8000"
Write-Host "3) Frontend     :  cd frontend ; npm run dev -- --port 3000"
Write-Host "Then open http://localhost:3000  (demo user: demo@cacheai.com / Demo12345!)"
