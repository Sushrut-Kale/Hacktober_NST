# VIKASA — Vercel Frontend Deployment Guide

This guide walks you through deploying the VIKASA Next.js Frontend to **Vercel** with full 3D visuals, responsive dashboards, and production API connectivity.

---

## 1. Quick Summary of Vercel Configuration

The repository includes pre-configured Vercel configurations:
- **`frontend/vercel.json`**: For when your Vercel project's Root Directory is set to `frontend`.
- **`vercel.json`** (Root): For when your Vercel project is deployed from the repository root.

---

## 2. Option A: Deploy via Vercel Web Dashboard (Recommended)

### Step 1: Import Repository
1. Navigate to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** → **"Project"**.
3. Select your repository: `Sushrut-Kale/Hacktober_NST`.

### Step 2: Configure Project Settings
In the Project Configuration screen:

1. **Framework Preset:** `Next.js` (Automatically detected).
2. **Root Directory:** Click **Edit** and select **`frontend`**.
   *(If you leave it at the repository root, the root `vercel.json` will automatically route the build to `frontend`)*.
3. **Build and Output Settings:**
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

### Step 3: Add Environment Variables
Expand the **Environment Variables** section and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://your-vikasa-backend.onrender.com` | URL of your deployed FastAPI backend service. |

> **Note for Local Testing:** If testing Vercel preview while running the backend locally via ngrok or Cloudflare tunnel, set `NEXT_PUBLIC_API_URL` to your tunnel URL (e.g. `https://xxxx.ngrok-free.app`).

### Step 4: Click Deploy
Click **"Deploy"**. Vercel will:
1. Install dependencies (`three`, `@types/three`, `lucide-react`, `tailwindcss`, etc.).
2. Run `next build` across all 16 routes.
3. Provide a live production URL: `https://your-project.vercel.app`.

---

## 3. Option B: Deploy via Vercel CLI

If you have the Vercel CLI installed (`npm i -g vercel`):

```powershell
# Navigate to frontend directory
cd s:\Hacktober_NST\frontend

# Log in to Vercel
vercel login

# Link and deploy preview
vercel

# Deploy to production
vercel --prod
```

When prompted:
- **Set up and deploy?** `yes`
- **Which scope?** Your personal or team account
- **Link to existing project?** `no` (or `yes` if already created)
- **What’s your project’s name?** `vikasa-frontend`
- **In which directory is your code located?** `./` (when run from inside `frontend/`)
- **Want to modify settings?** `no`

---

## 4. Backend Deployment (Render / Railway / Fly.io)

For the frontend on Vercel to fetch real repository intelligence, your FastAPI backend needs to be accessible over HTTPS.

### Deploying the Backend on Render:
1. Go to [render.com](https://render.com) and click **"New Web Service"**.
2. Connect `Sushrut-Kale/Hacktober_NST`.
3. Set:
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
4. In **Environment Variables**:
   - `CORS_ORIGINS`: `https://your-project.vercel.app`
   - `ENVIRONMENT`: `production`
5. Copy your Render service URL (e.g., `https://vikasa-api.onrender.com`) and paste it as `NEXT_PUBLIC_API_URL` in your Vercel project settings!

---

## 5. Verification Checklist After Deployment

Once deployed:
1. **Landing Page (`/`):** Open the Vercel URL. You will see Shourya's interactive 3D DNA Helix canvas, glowing glassmorphism cards, and real-time developer telemetry.
2. **Start New Project (`/projects/new`):** Input a public GitHub URL (e.g. `https://github.com/Sushrut-Kale/Hacktober_NST.git`) or an idea.
3. **Claim vs Reality Matrix (`/projects/[projectId]`):** View deterministic green (`PRESENT`), red (`MISSING`), amber (`PARTIAL`), and gray (`UNVERIFIED`) feature findings backed by repository evidence.
4. **Build Further:** Click on any missing or partial feature and generate an engineering task with explicit acceptance criteria.
