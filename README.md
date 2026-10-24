# VIKASA — AI Development Intelligence & Verification Platform

> **Plan → Approve → Execute → Record Evidence → Verify → Claim vs Reality → Build Further**

VIKASA is a deterministic AI development intelligence platform that evaluates what a repository or agent claims against what is actually proven by verifiable code evidence and deterministic test outcomes.

**Critical Invariant:** An AI model or agent message must never decide that a task is verified merely by claiming success. Only the deterministic verification engine issues the final verdict according to explicit empirical rules, test results, exit codes, and recorded diffs.

---

## 1. System Architecture

```text
+-------------------------------------------------------------------------+
|                  VIKASA Next.js 14 Frontend                             |
|  - 3D DNA Helix & Typography (Shourya Thorat Design System)             |
|  - Start New Project: GitHub Repo Intake & Idea Specification Pipeline  |
|  - Claim vs Reality Matrix (Present, Missing, Partial, Unverified)     |
|  - Interactive Architecture Graph & Tech Stack Visualizer              |
|  - Build Further Action, Human Approval Gate, & Evidence Inspector      |
+------------------------------------+------------------------------------+
                                     | HTTP / REST (Port 3000 -> 8000)
+------------------------------------v------------------------------------+
|                             FastAPI Backend                             |
|  +----------------------------+     +--------------------------------+  |
|  | Project Analyzer & SSRF    |     |  Deterministic Verification    |  |
|  | (SSRF Guard & File Parser) |     |     (Rule-Based Evaluation)    |  |
|  +----------------------------+     +--------------------------------+  |
|  +----------------------------+     +--------------------------------+  |
|  |     Lifecycle Workflow     |     |      Safe Execution Runner     |  |
|  |  (State Machine & Approval)|     |   (Subprocess Sandbox & Diffs) |  |
|  +----------------------------+     +--------------------------------+  |
|  +----------------------------+     +--------------------------------+  |
|  |  Gemma Service / Ollama    |     |    Antigravity IDE Adapter     |  |
|  | (AI Planning & Diagnosis)  |     |  (Manual Handoff & Dispatch)   |  |
|  +----------------------------+     +--------------------------------+  |
|  +-------------------------------------------------------------------+  |
|  |          Relational Persistence Layer (SQLAlchemy + SQLite/PG)    |  |
|  | (Projects, Tasks, Features, Evidence, Runs, Verifications, Events)|  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Core Product Capabilities

### 2.1 Start New Project Experience
- **Path 1: Analyze a GitHub Repository**
  - SSRF protection: Blocks loopbacks (`127.0.0.1`, `localhost`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), AWS metadata (`169.254.169.254`), and non-HTTP schemes.
  - Bounded static repository analyzer: inspects up to 500 files, skips dependency folders (`node_modules`, `venv`), caps file inspection at 256KB.
  - Automatically identifies technology stack from manifests (`package.json`, `requirements.txt`, etc.).
- **Path 2: Start from an Idea or Problem Statement**
  - Generates initial structured specification, architectural components, proposed features, and 4 high-value clarification questions.
  - **Clarification Q&A:** Submit answers to refine architecture and technology choices.
  - **"Skip Questions — Generate It For Me":** Applies standard defaults, explicitly tags all assumptions as `INFERRED` / `is_proposed: True`, and auto-generates the project specification without blank screens or fake success messages.

### 2.2 Claim vs Reality — The Core Invariant
Evaluates project claims against observable code and automated test evidence:
- **PRESENT / VERIFIED (Green):** Supported by matching code symbols and passing deterministic test suites.
- **CLAIMED / MISSING (Red):** Claimed in README or specification, but no implementation evidence was found in the codebase.
- **PARTIAL (Amber):** Code exists (e.g., model or partial handler), but integration is incomplete.
- **UNVERIFIED / UNKNOWN (Gray):** Implementation exists or is proposed, but behavior has not been proven by an automated check.
- **VERIFICATION FAILED (Red):** A relevant deterministic test failed.

### 2.3 Build Further & Agent Handoff
For any missing or partial feature:
1. Click **"Build Further"** to automatically generate a bounded implementation task with explicit acceptance criteria.
2. Mandatory **Human Approval** required before task execution.
3. Safe execution runner or manual Antigravity IDE handoff executes the test.
4. Deterministic verification evaluates real telemetry and refreshes feature status.

---

## 3. Quick Start (Windows 11 PowerShell)

### Prerequisites
- Python 3.10+ (Recommended: 3.12 / 3.13)
- Node.js 18.17+ (Recommended: 20 LTS)
- (Optional) Ollama with `gemma4:e4b`

### Step 1: Clone Repository
```powershell
git clone https://github.com/Sushrut-Kale/Hacktober_NST.git
cd Hacktober_NST
```

### Step 2: Set Up Backend
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -c "from backend.app.db.init_db import init_db; init_db()"
python -m uvicorn backend.app.main:app --port 8000 --reload
```
Backend runs at: `http://localhost:8000` (Health check: `/health`).

### Step 3: Set Up Frontend
In a second PowerShell terminal:
```powershell
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:3000`.

---

## 4. API Reference

### Project Intelligence Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/projects` | Register and analyze project (Supports Git URL or Idea intake). |
| `GET` | `/api/projects` | List all registered projects with pagination. |
| `GET` | `/api/projects/{id}/detail` | Complete intelligence payload: Claim vs Reality, architecture, tech stack, documentation. |
| `POST` | `/api/projects/{id}/rescan` | Rescan repository and record scan history. |
| `POST` | `/api/projects/{id}/clarify` | Submit answers to architectural clarification questions. |
| `POST` | `/api/projects/{id}/skip-questions` | Auto-draft specification with explicit inferred defaults. |
| `POST` | `/api/projects/{id}/build-feature` | Create an implementation task from a missing/partial feature. |

### Task Workflow & Verification Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/tasks` | Create task with explicit acceptance criteria. |
| `GET` | `/api/tasks/{task_id}` | Retrieve task detail, plan, runs, and verifications. |
| `POST` | `/api/tasks/{task_id}/plan` | Generate AI plan (advances to `PLANNED`). |
| `POST` | `/api/tasks/{task_id}/approve` | Mandatory human approval gate (advances to `APPROVED`). |
| `POST` | `/api/tasks/{task_id}/execute` | Run allowlisted command and capture evidence (advances to `VERIFYING`). |
| `POST` | `/api/tasks/{task_id}/verify` | Deterministic verification of exit code, diff, and assertions. |
| `GET` | `/api/runs/{run_id}/claim-vs-reality` | Claim vs Reality comparison report for an execution run. |
| `GET` | `/api/health/antigravity` | Truthful capability inspection for local runner and Antigravity. |
| `POST` | `/api/tasks/{task_id}/handoff` | Submit manual Antigravity IDE chat telemetry. |

---

## 5. Automated Validation & Verification Results

```powershell
# Run backend test suite (233 passing tests)
python -m pytest backend/tests/ -v

# Run frontend production build (16/16 routes compiled)
npm --prefix frontend run build
```

- **Backend Tests:** 233 passed (100%), 0 failed.
- **Frontend Production Build:** 16 routes compiled cleanly with 0 TypeScript/ESLint errors.
- **SSRF Defenses:** Validated against private IPs, AWS metadata, and local loops.
- **Deterministic Verification Authority:** Validated against fabricated exit codes and missing diffs.

---

## 6. Deployment Documentation

For production PostgreSQL configuration, containerization, environment variables, and cloud hosting architecture, see [DEPLOYMENT_GUIDE.md](file:///s:/Hacktober_NST/DEPLOYMENT_GUIDE.md).

For integration history and branch resolution, see [FINAL_INTEGRATION_REPORT.md](file:///s:/Hacktober_NST/FINAL_INTEGRATION_REPORT.md) and [FINAL_TEST_REPORT.md](file:///s:/Hacktober_NST/FINAL_TEST_REPORT.md).
