# VIKASA — Deployment & Operations Guide

## 1. System Architecture Overview

VIKASA is a deterministic AI development intelligence and verification platform composed of five decoupled layers:

```
[ Next.js 14 Web Command Center (Vercel) ]
               │
               ▼  (HTTP / REST / JSON, HTTPS -> Port 8000)
[ FastAPI Backend Application (Render / Railway / Linux VM) ]
   ├── [ Project Analyzer & SSRF Guard ]
   ├── [ Deterministic Verification Engine ] ◄── Core Invariant (Empirical Verdicts)
   ├── [ Safe Execution Runner (Subprocesses) ]
   ├── [ Local AI Service (Ollama / Gemma 4:e4b) ] (Optional, with transparent fallback)
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
| **Database** | SQLite 3.35+ (Local development only) | PostgreSQL 15+ (Production required) |
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
*(Both `requirements.txt` in the root and `backend/requirements.txt` include all core dependencies plus `psycopg2-binary`)*.

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
Verify backend is online at: `http://127.0.0.1:8000/health` and `http://127.0.0.1:8000/api/health`

### Step 7: Start Frontend Dev Server
In a separate terminal window:
```powershell
cd frontend
npm run dev
```
Open browser at: `http://localhost:3000`

---

## 4. Production Deployment Configuration

### 4.1 Database Requirements (Persistent PostgreSQL vs Ephemeral SQLite)

> [!WARNING]
> **Ephemeral Container Filesystem Hazard:** Cloud container platforms (Render, Railway, Fly.io, Heroku, AWS ECS) use ephemeral disks that are wiped on every restart or redeployment. Do NOT use SQLite (`DATABASE_URL=sqlite:///...`) in production. You MUST configure a persistent external PostgreSQL database.

1. **Provision PostgreSQL Database:**
   ```sql
   CREATE DATABASE vikasa_prod;
   CREATE USER vikasa_user WITH ENCRYPTED PASSWORD 'your_strong_password';
   GRANT ALL PRIVILEGES ON DATABASE vikasa_prod TO vikasa_user;
   ```

2. **Configure Production Database URL:**
   ```ini
   DATABASE_URL=postgresql://vikasa_user:your_strong_password@db.yourhost.internal:5432/vikasa_prod
   ```
   *Note: If your host provides a legacy `postgres://` connection string, the backend automatically normalizes it to `postgresql://`.*

3. **Install Dependencies:**
   `psycopg2-binary>=2.9.9` is included in `backend/requirements.txt` and root `requirements.txt`.

4. **Initialize Production Tables:**
   The backend automatically invokes `init_db()` during application lifespan startup (`backend/app/main.py`). You can also run it explicitly:
   ```bash
   python -c "from backend.app.db.init_db import init_db; init_db()"
   ```

### 4.2 Backend Start Command

For containerized cloud hosts (Render, Railway, Fly.io):
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
```
Or with Gunicorn workers for high-concurrency Linux hosts:
```bash
gunicorn backend.app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:$PORT \
  --timeout 120
```

### 4.3 Frontend Vercel Deployment

Deploy the Next.js frontend to Vercel:
1. Connect `Sushrut-Kale/Hacktober_NST` to Vercel.
2. In Project Settings, set **Root Directory** to `frontend`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL`: `https://your-vikasa-backend.onrender.com`
4. The frontend will compile all 16 pages and automatically route API requests to the backend.

---

## 5. Security & Invariant Hardening

### 5.1 Authentication & Authorization Warning
> [!CAUTION]
> **No Built-in Public Authentication:** VIKASA does not include built-in user authentication (JWT/session tokens) or RBAC. Anyone with network access to the backend can create projects, approve plans, and trigger subprocess executions via `/api/tasks/{id}/execute`.
> **Do NOT expose the backend directly to the untrusted public internet without protection.** Always place the backend behind an authenticating reverse proxy (Cloudflare Access, Nginx with auth, Tailscale, or a VPN gateway).

### 5.2 SSRF Protection & Remote Repository Handling
- The backend validates all user-submitted repository URLs against blocked IP subnets (loopbacks `127.0.0.0/8`, private `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, link-local/AWS metadata `169.254.169.254`, and non-HTTP schemes).
- **Architectural Scope:** The backend performs bounded static analysis on local filesystem workspaces specified in `root_path`. It does not execute remote `git clone` over the network.
- Path traversal protection (`validate_safe_path`) prevents symlink or `../` boundary escapes outside the intended workspace.

### 5.3 Subprocess Execution Boundaries
- Commands are restricted to allowlisted binaries (`python`, `pytest`, `git`).
- Shell metacharacters (`&&`, `||`, `|`, `>`, `<`, "`", `$(`) are rejected.
- Execution timeouts (default: 30s) and memory buffer caps (512 KB) prevent resource starvation.
- Environment variables are sanitized and sensitive credentials (`TOKEN`, `KEY`, `PASSWORD`) are redacted from logs.

---

## 6. Health & Diagnostic Endpoints

| Endpoint | Method | Purpose | Normal Response |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Root uptime liveness probe | `{"status": "healthy", "service": "VIKASA API"}` |
| `/api/health` | `GET` | Live database connectivity verification | `{"status": "healthy", "database": "connected"}` |
| `/api/health/ollama` | `GET` | Local AI engine status (Ollama / Gemma) | `{"status": "AI_ACTIVE" | "AI_UNAVAILABLE", "model": "gemma4:e4b"}` |
| `/api/health/antigravity`| `GET` | Truthful Antigravity IDE capability probe | `{"status": "NEEDS_INSTALLATION" | "READY", "available_modes": [...]}` |

---

## 7. Troubleshooting & Recovery

### Issue 1: PostgreSQL Connection Failure
- **Error:** `OperationalError: could not connect to server`
- **Remedy:** Ensure `DATABASE_URL` is accessible from the container network, credentials are correct, and SSL mode is configured (e.g. `?sslmode=require` for hosted PostgreSQL).

### Issue 2: Ollama Offline Fallback
- **Behavior:** When Ollama is offline or `gemma4:e4b` is not installed, VIKASA transparently switches to deterministic rule-based planning with `generator_status: FALLBACK_ACTIVE`. All APIs remain fully functional.

### Issue 3: Next.js CORS Errors
- **Error:** `Access to fetch at ... from origin ... has been blocked by CORS policy`
- **Remedy:** Add your Vercel deployment domain to `CORS_ORIGINS` in your backend environment variables (e.g. `CORS_ORIGINS=https://vikasa-frontend.vercel.app`).
