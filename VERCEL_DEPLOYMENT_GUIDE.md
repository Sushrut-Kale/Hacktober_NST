# VIKASA — Vercel Frontend Deployment Guide

This guide walks you through deploying the VIKASA Next.js Frontend to **Vercel** with full 3D visuals, responsive dashboards, and production API connectivity.

---

## 1. Single Supported Vercel Architecture

In monorepo and split backend/frontend repositories, Vercel natively deploys Next.js applications when the **Project Root Directory** is configured to point directly to the Next.js directory.

- **Canonical Configuration:** [`frontend/vercel.json`](file:///S:/Hacktober_NST/frontend/vercel.json)
- **Framework Preset:** `Next.js`
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** Managed automatically by Next.js and Vercel (no custom override needed).

> [!NOTE]
> The repository's root `vercel.json` was intentionally retired during the pre-deployment release audit. Overriding `outputDirectory: "frontend/.next"` at the repository root violates Next.js deployment conventions and breaks serverless function compilation for dynamic routes. Setting the Vercel Root Directory to `frontend` is the single supported deployment method.

---

## 2. Deploying via Vercel Web Console (Recommended)

### Step 1: Import Repository
1. Navigate to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** → **"Project"**.
3. Select your repository: `Sushrut-Kale/Hacktober_NST`.

### Step 2: Configure Project Settings
In the Project Configuration screen:

1. **Framework Preset:** `Next.js` (Automatically detected).
2. **Root Directory:** Click **Edit** and select **`frontend`**.
3. **Build and Output Settings:** Leave default (automatically detected via `frontend/package.json` and `frontend/vercel.json`):
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`

### Step 3: Add Environment Variables
Expand the **Environment Variables** section and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://your-vikasa-backend.onrender.com` | HTTPS URL of your deployed FastAPI backend service. |

*(Note: The frontend also supports `NEXT_PUBLIC_API_BASE_URL` as a fallback. Both variables point to the backend).*

### Step 4: Click Deploy
Click **"Deploy"**. Vercel will:
1. Install dependencies (`three`, `@types/three`, `lucide-react`, `tailwindcss`, etc.).
2. Run `next build` across all 16 static and dynamic routes.
3. Provision your live production URL: `https://your-project.vercel.app`.

---

## 3. Deploying via Vercel CLI

If deploying via the command line:

```powershell
# Navigate to the frontend directory (mandatory)
cd frontend

# Deploy preview
vercel

# Deploy to production
vercel --prod
```

When prompted:
- **Set up and deploy?** `yes`
- **In which directory is your code located?** `./` (when run from inside `frontend/`)
- **Framework Preset:** `Next.js`

---

## 4. Backend Deployment & CORS Alignment

For the frontend on Vercel to communicate with the backend, your FastAPI backend must be deployed with HTTPS (e.g. Render, Railway, or Fly.io).

### Backend Setup on Render:
1. Go to [render.com](https://render.com) and create a **"New Web Service"**.
2. Connect `Sushrut-Kale/Hacktober_NST`.
3. Configure settings:
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt` *(works cleanly from root or backend)*
   - **Start Command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. Add Environment Variables:
   - `DATABASE_URL`: Your persistent PostgreSQL connection URL (e.g. `postgresql://...`).
   - `CORS_ORIGINS`: `https://your-project.vercel.app` (your Vercel domain).
   - `ENVIRONMENT`: `production`
5. Copy your live Render URL and paste it as `NEXT_PUBLIC_API_URL` in your Vercel project settings.

---

## 5. Post-Deployment Verification Checklist

Once deployed:
1. **Landing Page (`/`):** Open the Vercel URL. Confirm the interactive 3D DNA Helix background canvas, developer status telemetry strip, and feature showcase render without errors.
2. **Settings Connection Test (`/settings`):** Navigate to `/settings`, verify the detected backend URL, and click **"Test Connection"** to verify live connectivity with your backend `/api/health`.
3. **Start New Project (`/projects/new`):** Test intake flow with an idea prompt or local repo inspection.
4. **Claim vs Reality Matrix (`/projects/[projectId]`):** View deterministic green (`PRESENT`), red (`MISSING`), amber (`PARTIAL`), and gray (`UNVERIFIED`) feature findings backed by repository evidence.
5. **Build Further Task Flow:** Generate a task plan, verify that execution remains blocked before explicit human approval, approve the task, and inspect the verification verdict.
