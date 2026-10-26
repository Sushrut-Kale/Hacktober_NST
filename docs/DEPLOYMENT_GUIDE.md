# VIKASA — Production Deployment Guide

---

## 1. Hosting Architecture Strategy

VIKASA is composed of:
1. **Next.js 14 Frontend:** Optimized for deployment on **Vercel**.
2. **FastAPI Backend:** Can be deployed as a containerized service (Docker / Cloud Run / AWS ECS / Render / Railway) or via Vercel Serverless Functions.

> [!IMPORTANT]
> **Sandboxed Subprocess Execution Constraint:**
> Vercel Serverless Functions have ephemeral, read-only filesystems (except `/tmp`) and execution duration caps (10s on Hobby, 60s on Pro).
> While the REST API, project intake, AI planning, and Claim vs Reality comparisons run seamlessly in serverless environments, long-running subprocess code execution (e.g. running extensive `pytest` test suites) requires a containerized or VM host where Docker, Python virtualenvs, and process runners have execution privileges.

---

## 2. Next.js Frontend Deployment on Vercel

### Step 1: Connect GitHub Repository to Vercel
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Select **Add New...** -> **Project**.
3. Import `Sushrut-Kale/Hacktober_NST`.

### Step 2: Configure Project Settings
- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Build Command:** `next build` (or default `npm run build`)
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### Step 3: Configure Environment Variables
Set the following environment variables in the Vercel project settings:

```env
# Public URL of the FastAPI Backend
NEXT_PUBLIC_API_URL=https://api.your-vikasa-domain.com
```

---

## 3. Backend Deployment (Docker Container / Cloud Run)

### Dockerfile for FastAPI Backend

```dockerfile
FROM python:3.12-slim

# Install system dependencies (git for evidence capture, build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY backend/ ./backend/
COPY .env.example .env

# Expose FastAPI port
EXPOSE 8000

# Run uvicorn server
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 4. Environment Variables Reference

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `APP_NAME` | No | `VIKASA` | Application title reported in health check |
| `APP_VERSION` | No | `1.0.0` | API version string |
| `DATABASE_URL` | Yes (Prod) | `sqlite:///./vikasa.db` | PostgreSQL connection string for production |
| `CORS_ORIGINS` | Yes (Prod) | `http://localhost:3000` | Comma-separated list of allowed frontend origins |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama endpoint URL if using local LLM |
| `GEMMA_MODEL` | No | `gemma4:e4b` | Ollama model identifier |
| `GITHUB_API_TOKEN`| No | None | Server-side personal access token for higher GitHub API rate limits |
| `MAX_EXECUTION_TIMEOUT_SECONDS` | No | `30` | Subprocess timeout in seconds |
| `NEXT_PUBLIC_API_URL` | Yes (FE) | `http://localhost:8000` | Browser endpoint for FastAPI backend |

---

## 5. Post-Deployment Verification Checklist

- [ ] Check root health check: `GET /health` returns `{"status": "healthy"}`.
- [ ] Check database health: `GET /api/health` returns `{"database": "connected"}`.
- [ ] Check Ollama / AI readiness: `GET /api/health/ollama`.
- [ ] Verify CORS preflight from frontend origin.
- [ ] Create a test project intake via Git URL and Idea statement.
- [ ] Verify deterministic verification engine with a sample test run.
