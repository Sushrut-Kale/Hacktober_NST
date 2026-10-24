# VIKASA — Deployment & Operations Guide

## 1. System Architecture Overview

VIKASA is a deterministic AI development intelligence and verification platform composed of five decoupled layers:

```
[ Next.js 14 Web Command Center ]
               │
               ▼  (HTTP / REST / JSON, Port 3000 -> 8000)
[ FastAPI Backend Application ]
   ├── [ Project Analyzer & SSRF Guard ]
   ├── [ Deterministic Verification Engine ] ◄── Core Invariant (Empirical Verdicts)
   ├── [ Safe Execution Runner (Subprocesses) ]
   ├── [ Local AI Service (Ollama / Gemma 4:e4b) ] (Optional, with fallback)
   └── [ Dual Persistence (SQLAlchemy ORM + SQLite / PostgreSQL) ]
```

### Core Invariant
**AI proposes and diagnoses. Humans approve. Deterministic verification decides the verdict.**
No LLM or agent claim can override a nonzero exit code, failed test assertion, missing file, or invalid hash.

---

## 2. System Requirements & Prerequisites

| Component | Minimum Version | Recommended Version |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11, Ubuntu 22.04 LTS, macOS 13+ | Windows 11 / Ubuntu 22.04 |
| **Python** | 3.10 | 3.12 or 3.13 |
| **Node.js** | 18.17+ | 20.x LTS |
| **Database** | SQLite 3.35+ (Embedded) | PostgreSQL 15+ (Production) |
| **Local AI (Optional)**| Ollama v0.3+ | Ollama with `gemma4:e4b` |

---

## 3. Local Development Setup (Windows 11 PowerShell)

### Step 1: Clone and Enter Repository
```powershell
git clone https://github.com/Sushrut-Kale/Hacktober_NST.git
cd Hacktober_NST
```

### Step 2: Set Up Python Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Set Up Frontend Node Environment
```powershell
cd frontend
npm install
cd ..
```

### Step 4: Configure Local Environment
```powershell
Copy-Item .env.example .env
```
Default local settings in `.env`:
```ini
ENVIRONMENT=development
DATABASE_URL=sqlite:///./vikasa.db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 5: Run Database Migrations & Initializer
```powershell
python -c "from backend.app.db.init_db import init_db; init_db()"
```

### Step 6: Start Backend Server
```powershell
# From workspace root
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Verify backend is online at: `http://127.0.0.1:8000/health`

### Step 7: Start Frontend Dev Server
In a separate terminal window:
```powershell
cd frontend
npm run dev
```
Open browser at: `http://localhost:3000`

---

## 4. Production Deployment Configuration

### 4.1 Database Migration (SQLite to PostgreSQL)

While SQLite is optimal for local development and unit tests, managed relational databases like PostgreSQL are strongly recommended for multi-worker containerized deployments.

1. **Provision PostgreSQL Database:**
   ```sql
   CREATE DATABASE vikasa_prod;
   CREATE USER vikasa_user WITH ENCRYPTED PASSWORD 'your_strong_password';
   GRANT ALL PRIVILEGES ON DATABASE vikasa_prod TO vikasa_user;
   ```

2. **Update Connection String:**
   ```ini
   DATABASE_URL=postgresql://vikasa_user:your_strong_password@db.yourhost.internal:5432/vikasa_prod
   ```

3. **Install PostgreSQL Driver:**
   ```bash
   pip install psycopg2-binary
   ```

4. **Initialize Schema on Production DB:**
   ```bash
   python -c "from backend.app.db.init_db import init_db; init_db()"
   ```

### 4.2 Backend Production Process (Gunicorn + Uvicorn Workers)

Run FastAPI behind Gunicorn with Uvicorn worker processes:
```bash
gunicorn backend.app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

### 4.3 Frontend Production Build (Next.js)

```bash
cd frontend
npm run build
npm start -- -p 3000
```

Or deploy directly to Vercel / Cloudflare Pages pointing `NEXT_PUBLIC_API_URL` to your production backend domain.

---

## 5. Security & Operational Hardening

### 5.1 SSRF & Traversal Protection
All remote repository URLs provided by users undergo strict validation in `ProjectAnalyzerService`:
- Rejects non-HTTP(S) schemes (`file://`, `ftp://`, `ssh://`, `gopher://`).
- Blocks private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Blocks loopbacks (`127.0.0.0/8`, `::1`, `localhost`).
- Blocks cloud metadata IP (`169.254.169.254`).
- Sanitizes file paths with `os.path.realpath` to prevent directory traversal escapes (`../`).

### 5.2 Safe Runner Execution Bounds
Subprocess execution performed by `SafeExecutionRunner` enforces:
- Command allowlist (`python`, `pytest`, `git`, `npm`, `node`, `cargo`).
- Maximum process execution timeout (default: 30 seconds).
- Maximum captured output buffer (default: 512 KB) to prevent memory exhaustion.
- Shell metacharacter injection blocking.

---

## 6. Health & Diagnostic Endpoints

| Endpoint | Method | Purpose | Normal Response |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Root uptime probe | `{"status": "healthy"}` |
| `/api/health` | `GET` | Database connectivity verification | `{"status": "healthy", "database": "connected"}` |
| `/api/health/ollama` | `GET` | Local AI engine readiness & model check | `{"status": "AI_ACTIVE", "model_ready": true}` |
| `/api/health/antigravity` | `GET` | Antigravity IDE & runner capability inspect | `{"status": "NEEDS_INSTALLATION" | "READY", "available_modes": [...]}` |

---

## 7. Troubleshooting & Recovery

### Issue 1: SQLite `database is locked`
- **Cause:** High concurrency or orphaned background process holding a write lock.
- **Remedy:** Ensure `timeout=30.0` and WAL mode in `repository.py`. For high concurrency, switch to PostgreSQL.

### Issue 2: Ollama Unreachable (`Connection refused on port 11434`)
- **Behavior:** VIKASA automatically activates its deterministic rule-based fallback. No crashes occur.
- **Remedy:** Start Ollama locally: `ollama serve`, and pull model: `ollama pull gemma4:e4b`.

### Issue 3: Next.js CORS Error in Browser
- **Cause:** Frontend domain not included in backend `CORS_ORIGINS`.
- **Remedy:** Add frontend domain to `CORS_ORIGINS` in `.env` (e.g., `CORS_ORIGINS=https://app.example.com`).
