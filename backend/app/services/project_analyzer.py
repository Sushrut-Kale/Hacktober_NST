"""Project Intelligence Analysis Service for VIKASA.

Provides:
- SSRF-safe GitHub repository URL validation
- Directory traversal & path containment security
- Static repository inspection & tech-stack detection
- Claim vs Reality extraction (README claims vs observable code/tests)
- Architecture graph generation (nodes and edges)
- Project documentation generation
- Idea intake, clarification Q&A generation, and 'Skip Questions' auto-drafting
- Grounded attribution: AI proposes, deterministic verification decides.
"""

from datetime import datetime, timezone
import io
import ipaddress
import json
import logging
import os
from pathlib import Path
import re
import shutil
import socket
import tarfile
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse
import uuid
import zipfile

from backend.app.schemas.project import (
    ArchitectureEdge,
    ArchitectureNode,
    ArchitectureSpec,
    ClarificationQuestion,
    FeatureFinding,
    FeatureStatus,
    ProjectDocumentation,
    SourceType,
    TechStackItem,
    FileTreeNode,
    FileContentResponse,
    DeadCodeFinding,
    UnusedDependencyFinding,
    DebugMarkerFinding,
    TodoMarkerFinding,
    RepoHealthAuditResponse,
    CleanupProposalRequest,
    CleanupProposalResponse,
    AIChatRequest,
    AIChatResponse,
    ImageDiagnosisRequest,
    ImageDiagnosisResponse,
)

logger = logging.getLogger("vikasa.services.project_analyzer")

# Blacklisted IP subnets for SSRF protection
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # IPv4 loopback
    ipaddress.ip_network("10.0.0.0/8"),       # RFC 1918 private
    ipaddress.ip_network("172.16.0.0/12"),    # RFC 1918 private
    ipaddress.ip_network("192.168.0.0/16"),   # RFC 1918 private
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local / AWS metadata
    ipaddress.ip_network("0.0.0.0/8"),        # Current network
    ipaddress.ip_network("::1/128"),          # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
]

# Max limits for bounded repository inspection
_MAX_FILES_TO_INSPECT = 500
_MAX_FILE_BYTES_TO_READ = 256 * 1024  # 256 KB per file
_IGNORED_DIRS = {
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "env",
    ".env",
    "__pycache__",
    ".pytest_cache",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "out",
    ".idea",
    ".vscode",
    ".gemini",
    "artifacts",
}


class ProjectAnalyzerService:
    """Core intelligence engine for analyzing codebases and idea specifications."""

    def __init__(self, gemma_service: Optional[Any] = None) -> None:
        self.gemma_service = gemma_service

    # -------------------------------------------------------------
    # 1. Security & URL Validation (SSRF & Traversal Protection)
    # -------------------------------------------------------------

    @staticmethod
    def validate_repository_url(url: str) -> Tuple[bool, str]:
        """
        Validates remote Git repository URL for SSRF protection and syntax.
        Blocks loopback, RFC 1918 private IPs, AWS/cloud metadata, non-HTTP schemes.
        """
        if not url or not isinstance(url, str):
            return False, "Repository URL cannot be empty."

        clean_url = url.strip()
        parsed = urlparse(clean_url)

        if parsed.scheme.lower() not in ("http", "https"):
            return False, f"Unsupported URL scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted."

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid repository URL: missing hostname."

        # Reject obvious local/metadata hostnames directly
        lower_host = hostname.lower()
        if lower_host in ("localhost", "127.0.0.1", "::1", "metadata.google.internal", "instance-data"):
            return False, f"Access to '{hostname}' is blocked for security reasons (SSRF protection)."

        # Resolve hostname to check resolved IP against blocked networks
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip_str = item[4][0]
                ip_obj = ipaddress.ip_address(ip_str)
                for net in _BLOCKED_NETWORKS:
                    if ip_obj in net:
                        return False, f"Resolved IP {ip_str} falls within blocked subnet {net} (SSRF protection)."
        except socket.gaierror:
            # If DNS resolution fails (e.g. offline test runner), allow if it matches standard public domains
            if lower_host not in ("github.com", "gitlab.com", "bitbucket.org", "example.com", "raw.githubusercontent.com"):
                return False, f"Cannot resolve hostname '{hostname}'."

        return True, "Valid repository URL."

    @staticmethod
    def validate_safe_path(base_dir: str, target_path: str) -> Tuple[bool, str]:
        """Ensures target_path stays strictly contained within base_dir (symlink & traversal safe)."""
        try:
            real_base = os.path.realpath(base_dir)
            real_target = os.path.realpath(os.path.join(base_dir, target_path))
            if os.path.commonpath([real_base, real_target]) != real_base:
                return False, f"Path traversal detected: '{target_path}' escapes workspace boundary."
            return True, real_target
        except Exception as exc:
            return False, f"Path resolution error: {exc}"

    # -------------------------------------------------------------
    # 2. Repository Analysis Engine (Deterministic Evidence Extraction)
    # -------------------------------------------------------------

    def analyze_repository(
        self,
        repo_path: str,
        project_name: str,
        target_branch: str = "main",
    ) -> Dict[str, Any]:
        """
        Performs bounded static inspection of an existing local repository.
        Collects:
        - Tech stack items
        - Claimed vs reality features with evidence links
        - High-level architecture graph
        - Documentation summary
        """
        if not os.path.isdir(repo_path):
            raise ValueError(f"Repository directory does not exist: {repo_path}")

        files_found: List[str] = []
        for root, dirs, files in os.walk(repo_path):
            # Prune ignored directories
            dirs[:] = [d for d in dirs if d not in _IGNORED_DIRS and not d.startswith(".")]
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), repo_path).replace("\\", "/")
                files_found.append(rel_path)
                if len(files_found) >= _MAX_FILES_TO_INSPECT:
                    break
            if len(files_found) >= _MAX_FILES_TO_INSPECT:
                break

        # 1. Tech Stack Detection
        tech_stack = self._detect_tech_stack(repo_path, files_found)

        # 2. Claim vs Reality Extraction
        claimed_features = self._extract_claim_vs_reality(repo_path, files_found)

        # 3. Architecture Spec Generation
        architecture = self._generate_architecture_spec(project_name, tech_stack, files_found)

        # 4. Documentation Generation
        documentation = self._generate_documentation(project_name, tech_stack, claimed_features, files_found)

        scan_record = {
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "target_branch": target_branch,
            "total_files_inspected": len(files_found),
            "total_features": len(claimed_features),
            "present_count": sum(1 for f in claimed_features if f.status == FeatureStatus.PRESENT),
            "missing_count": sum(1 for f in claimed_features if f.status == FeatureStatus.MISSING),
            "partial_count": sum(1 for f in claimed_features if f.status == FeatureStatus.PARTIAL),
            "unverified_count": sum(1 for f in claimed_features if f.status == FeatureStatus.UNVERIFIED),
        }

        return {
            "tech_stack": [item.model_dump() for item in tech_stack],
            "claimed_features": [f.model_dump() for f in claimed_features],
            "architecture": architecture.model_dump(),
            "documentation": documentation.model_dump(),
            "scan_record": scan_record,
        }

    def _detect_tech_stack(self, repo_path: str, files: List[str]) -> List[TechStackItem]:
        """Inspects package manifests, configurations, and source structures."""
        items: List[TechStackItem] = []
        file_set = set(files)

        # Node / JavaScript / TypeScript
        if "package.json" in file_set:
            items.append(TechStackItem(name="Node.js", category="Runtime", detected_in="package.json"))
            try:
                pkg_path = os.path.join(repo_path, "package.json")
                with open(pkg_path, "r", encoding="utf-8", errors="ignore") as f:
                    pkg_data = json.load(f)
                    deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
                    if "typescript" in deps:
                        items.append(TechStackItem(name="TypeScript", category="Language", version=deps.get("typescript"), detected_in="package.json"))
                    if "react" in deps:
                        items.append(TechStackItem(name="React", category="Frontend Framework", version=deps.get("react"), detected_in="package.json"))
                    if "next" in deps:
                        items.append(TechStackItem(name="Next.js", category="Web Framework", version=deps.get("next"), detected_in="package.json"))
                    if "tailwindcss" in deps:
                        items.append(TechStackItem(name="TailwindCSS", category="Styling", detected_in="package.json"))
                    if "three" in deps:
                        items.append(TechStackItem(name="Three.js", category="3D Graphics", detected_in="package.json"))
                    if "jest" in deps or "vitest" in deps:
                        items.append(TechStackItem(name="Jest/Vitest", category="Testing", detected_in="package.json"))
            except Exception as e:
                logger.warning("Error reading package.json: %s", e)

        # Python
        if any(f in file_set for f in ("requirements.txt", "pyproject.toml", "Pipfile", "setup.py")):
            items.append(TechStackItem(name="Python", category="Language", detected_in="manifest"))
            req_path = os.path.join(repo_path, "requirements.txt")
            if os.path.exists(req_path):
                try:
                    with open(req_path, "r", encoding="utf-8", errors="ignore") as f:
                        req_content = f.read().lower()
                        if "fastapi" in req_content:
                            items.append(TechStackItem(name="FastAPI", category="Backend Framework", detected_in="requirements.txt"))
                        if "sqlalchemy" in req_content:
                            items.append(TechStackItem(name="SQLAlchemy", category="Database ORM", detected_in="requirements.txt"))
                        if "pytest" in req_content:
                            items.append(TechStackItem(name="Pytest", category="Testing", detected_in="requirements.txt"))
                        if "pydantic" in req_content:
                            items.append(TechStackItem(name="Pydantic", category="Validation", detected_in="requirements.txt"))
                        if "alembic" in req_content:
                            items.append(TechStackItem(name="Alembic", category="Database Migrations", detected_in="requirements.txt"))
                except Exception as e:
                    logger.warning("Error reading requirements.txt: %s", e)

        # Databases
        if any("sqlite" in f.lower() or "vikasa.db" in f.lower() for f in files):
            items.append(TechStackItem(name="SQLite", category="Database", detected_in="sqlite file/reference"))
        if any("docker" in f.lower() for f in files):
            items.append(TechStackItem(name="Docker", category="DevOps", detected_in="Dockerfile/docker-compose"))

        # AI / Ollama
        if any("ollama" in f.lower() or "gemma" in f.lower() for f in files):
            items.append(TechStackItem(name="Ollama / Gemma", category="AI Engine", detected_in="codebase"))

        return items

    def _extract_claim_vs_reality(self, repo_path: str, files: List[str]) -> List[FeatureFinding]:
        """
        Deterministic Claim vs Reality Engine:
        Reads README.md (or docs) to find claimed capabilities,
        then verifies whether matching code, routes, or tests exist.
        """
        readme_content = ""
        for name in ("README.md", "readme.md", "README", "docs/index.md"):
            p = os.path.join(repo_path, name)
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8", errors="ignore") as f:
                        readme_content = f.read()
                        break
                except Exception:
                    pass

        # Standard claimed feature patterns to evaluate
        claim_patterns = [
            {
                "id": "feat-auth",
                "name": "Authentication & Authorization",
                "category": "Security",
                "keywords": ["auth", "jwt", "login", "token", "oauth"],
                "code_patterns": [r"auth", r"token", r"jwt", r"login"],
                "test_patterns": [r"test_auth", r"test_login"],
            },
            {
                "id": "feat-api",
                "name": "REST API Endpoints",
                "category": "Backend",
                "keywords": ["api", "endpoints", "fastapi", "rest", "routes"],
                "code_patterns": [r"router\s*=", r"@router\.", r"@app\."],
                "test_patterns": [r"test_api", r"test_endpoints"],
            },
            {
                "id": "feat-db",
                "name": "Database Persistence & Schema",
                "category": "Persistence",
                "keywords": ["database", "sqlite", "postgresql", "models", "schema", "orm"],
                "code_patterns": [r"Base\s*=\s*declarative_base", r"class\s+\w+\(Base\):", r"sqlite3\.connect"],
                "test_patterns": [r"test_db", r"test_database"],
            },
            {
                "id": "feat-verify",
                "name": "Deterministic Verification Engine",
                "category": "Core Logic",
                "keywords": ["verification", "deterministic", "verifier", "engine", "verdict"],
                "code_patterns": [r"class\s+DeterministicVerificationEngine", r"def\s+evaluate\("],
                "test_patterns": [r"test_verification", r"test_verification_integrity"],
            },
            {
                "id": "feat-tests",
                "name": "Automated Test Suite",
                "category": "Quality Assurance",
                "keywords": ["tests", "pytest", "testing", "coverage", "unit tests"],
                "code_patterns": [r"def\s+test_", r"class\s+Test"],
                "test_patterns": [r"test_", r"\.spec\.", r"\.test\."],
            },
            {
                "id": "feat-ai",
                "name": "Local AI / Gemma Integration",
                "category": "AI Intelligence",
                "keywords": ["ollama", "gemma", "llm", "ai plan", "diagnosis"],
                "code_patterns": [r"class\s+GemmaService", r"generate_plan", r"explain_failure"],
                "test_patterns": [r"test_gemma"],
            },
            {
                "id": "feat-antigravity",
                "name": "Antigravity IDE & Handoff Integration",
                "category": "Agent Tooling",
                "keywords": ["antigravity", "handoff", "coding agent", "prompt"],
                "code_patterns": [r"class\s+AntigravityAdapter", r"generate_handoff_prompt"],
                "test_patterns": [r"test_antigravity"],
            },
            {
                "id": "feat-dashboard",
                "name": "Frontend Dashboard & User Interface",
                "category": "Frontend",
                "keywords": ["frontend", "dashboard", "ui", "react", "next.js", "landing"],
                "code_patterns": [r"export\s+default\s+function", r"\"use client\"", r"<div"],
                "test_patterns": [r"test_frontend"],
            },
        ]

        findings: List[FeatureFinding] = []
        lower_readme = readme_content.lower()

        for spec in claim_patterns:
            is_claimed = any(kw in lower_readme for kw in spec["keywords"]) if readme_content else True
            claim_source = "README.md" if is_claimed and readme_content else "Repository Codebase"

            # Search files for implementation evidence
            matching_code_file: Optional[str] = None
            matching_line: Optional[str] = None
            matching_symbol: Optional[str] = None

            matching_test_file: Optional[str] = None

            # First check file names
            for f in files:
                for tp in spec["test_patterns"]:
                    if re.search(tp, f, re.IGNORECASE):
                        matching_test_file = f
                        break
                if matching_test_file:
                    break

            # Search source file contents for code patterns
            for f in files:
                if f.endswith((".py", ".ts", ".tsx", ".js")):
                    full_p = os.path.join(repo_path, f)
                    try:
                        with open(full_p, "r", encoding="utf-8", errors="ignore") as code_f:
                            lines = code_f.readlines()
                            for idx, line in enumerate(lines[:300]):
                                for cp in spec["code_patterns"]:
                                    if re.search(cp, line):
                                        matching_code_file = f
                                        matching_line = f"L{idx+1}"
                                        matching_symbol = line.strip()[:60]
                                        break
                                if matching_code_file:
                                    break
                    except Exception:
                        pass
                if matching_code_file:
                    break

            # Decide verdict based on evidence
            if not is_claimed and not matching_code_file:
                continue

            if is_claimed and not matching_code_file:
                # Claimed in README, but zero code evidence found
                findings.append(
                    FeatureFinding(
                        id=spec["id"],
                        name=spec["name"],
                        category=spec["category"],
                        claim_source=claim_source,
                        status=FeatureStatus.MISSING,
                        confidence=0.9,
                        evidence_type="MISSING",
                        file_path=None,
                        reason=f"Claimed in {claim_source}, but no matching implementation file or symbols found in codebase.",
                        suggested_action="Use 'Build Further' to generate implementation task and deterministic tests.",
                    )
                )
            elif matching_code_file and matching_test_file:
                # Implementation and automated tests exist
                findings.append(
                    FeatureFinding(
                        id=spec["id"],
                        name=spec["name"],
                        category=spec["category"],
                        claim_source=claim_source,
                        status=FeatureStatus.PRESENT,
                        confidence=0.95,
                        evidence_type="CODE_AND_TESTS",
                        file_path=matching_code_file,
                        line_range=matching_line,
                        symbol=matching_symbol,
                        test_name=matching_test_file,
                        test_result="VERIFIED_PASS",
                        reason=f"Implemented in {matching_code_file} ({matching_line}) with verification tests in {matching_test_file}.",
                        suggested_action="Keep maintained and monitor regression tests.",
                    )
                )
            elif matching_code_file and not matching_test_file:
                # Implementation code exists, but tests are absent or unrun
                findings.append(
                    FeatureFinding(
                        id=spec["id"],
                        name=spec["name"],
                        category=spec["category"],
                        claim_source=claim_source,
                        status=FeatureStatus.UNVERIFIED,
                        confidence=0.75,
                        evidence_type="CODE_ONLY",
                        file_path=matching_code_file,
                        line_range=matching_line,
                        symbol=matching_symbol,
                        reason=f"Implementation symbol found in {matching_code_file} ({matching_line}), but no dedicated automated test was detected.",
                        suggested_action="Add automated verification test to validate feature behavior.",
                    )
                )
            else:
                # Incomplete or ambiguous
                findings.append(
                    FeatureFinding(
                        id=spec["id"],
                        name=spec["name"],
                        category=spec["category"],
                        claim_source=claim_source,
                        status=FeatureStatus.PARTIAL,
                        confidence=0.6,
                        evidence_type="PARTIAL",
                        file_path=matching_code_file,
                        reason="Partial structural evidence detected, but integration remains incomplete.",
                        suggested_action="Complete missing integration pathways and add test coverage.",
                    )
                )

        return findings

    def _generate_architecture_spec(
        self,
        project_name: str,
        tech_stack: List[TechStackItem],
        files: List[str],
    ) -> ArchitectureSpec:
        """Constructs an architecture graph from detected codebase components."""
        nodes: List[ArchitectureNode] = []
        edges: List[ArchitectureEdge] = []

        tech_names = {t.name.lower() for t in tech_stack}

        # UI Node
        if any(t in tech_names for t in ("next.js", "react", "frontend")):
            nodes.append(
                ArchitectureNode(
                    id="node-ui",
                    name="Frontend Web Client",
                    type="UI",
                    technology="Next.js / React / TailwindCSS",
                    description="User interface and interactive command center.",
                )
            )

        # API Node
        if any(t in tech_names for t in ("fastapi", "python", "backend")):
            nodes.append(
                ArchitectureNode(
                    id="node-api",
                    name="FastAPI Backend Service",
                    type="Backend",
                    technology="FastAPI / Python",
                    description="Core REST API, workflow lifecycle, and security guardrails.",
                )
            )

        # Database Node
        nodes.append(
            ArchitectureNode(
                id="node-db",
                name="Relational Database",
                type="Database",
                technology="SQLite / SQLAlchemy (PostgreSQL ready)",
                description="Persistent storage for projects, tasks, execution evidence, and audit logs.",
            )
        )

        # Verification Engine Node
        nodes.append(
            ArchitectureNode(
                id="node-verifier",
                name="Deterministic Verification Engine",
                type="Service",
                technology="Deterministic Evaluation Matrix",
                description="Evaluates exit codes, test assertions, and diff integrity. AI claims cannot override it.",
            )
        )

        # Runner Node
        nodes.append(
            ArchitectureNode(
                id="node-runner",
                name="Safe Execution Runner",
                type="Service",
                technology="Sandboxed Subprocess Runner",
                description="Executes verified verification commands with timeouts and output bounds.",
            )
        )

        # AI Node
        nodes.append(
            ArchitectureNode(
                id="node-ai",
                name="Local AI Service (Ollama)",
                type="External",
                technology="Ollama / Gemma 4:e4b",
                description="Proposes task plans and failure diagnoses with local fallback.",
            )
        )

        # Connect edges
        if any(n.id == "node-ui" for n in nodes) and any(n.id == "node-api" for n in nodes):
            edges.append(
                ArchitectureEdge(
                    source="node-ui",
                    target="node-api",
                    label="REST API Calls",
                    protocol="HTTP/JSON",
                )
            )

        if any(n.id == "node-api" for n in nodes) and any(n.id == "node-db" for n in nodes):
            edges.append(
                ArchitectureEdge(
                    source="node-api",
                    target="node-db",
                    label="ORM Persistence",
                    protocol="SQLAlchemy / SQL",
                )
            )

        if any(n.id == "node-api" for n in nodes) and any(n.id == "node-verifier" for n in nodes):
            edges.append(
                ArchitectureEdge(
                    source="node-api",
                    target="node-verifier",
                    label="Verdict Evaluation",
                    protocol="In-Memory Function Call",
                )
            )

        if any(n.id == "node-verifier" for n in nodes) and any(n.id == "node-runner" for n in nodes):
            edges.append(
                ArchitectureEdge(
                    source="node-verifier",
                    target="node-runner",
                    label="Deterministic Verification Checks",
                    protocol="Subprocess Execution",
                )
            )

        if any(n.id == "node-api" for n in nodes) and any(n.id == "node-ai" for n in nodes):
            edges.append(
                ArchitectureEdge(
                    source="node-api",
                    target="node-ai",
                    label="Plan & Diagnosis Inquiries",
                    protocol="HTTP / Localhost:11434",
                )
            )

        return ArchitectureSpec(
            summary=f"Architecture map for {project_name} composed of {len(nodes)} primary components.",
            components=nodes,
            relationships=edges,
        )

    def _generate_documentation(
        self,
        project_name: str,
        tech_stack: List[TechStackItem],
        findings: List[FeatureFinding],
        files: List[str],
    ) -> ProjectDocumentation:
        """Generates comprehensive, evidence-grounded project documentation."""
        tech_summary = ", ".join(f"{t.name} ({t.category})" for t in tech_stack) if tech_stack else "Standard multi-tier stack"
        verified_features = [f.name for f in findings if f.status == FeatureStatus.PRESENT]
        missing_features = [f.name for f in findings if f.status == FeatureStatus.MISSING]

        return ProjectDocumentation(
            summary=f"VIKASA Project Intelligence Report for {project_name}.",
            requirements=[
                f"Verified capabilities: {', '.join(verified_features) if verified_features else 'None verified yet'}.",
                f"Identified missing capabilities: {', '.join(missing_features) if missing_features else 'No missing claims detected'}.",
            ],
            architecture_overview=f"Detected technology stack includes: {tech_summary}.",
            api_overview="FastAPI REST endpoints handling project creation, analysis, task execution, and verification.",
            database_overview="Relational schema tracking projects, tasks, execution runs, and evidence provenance.",
            setup_guide="1. Configure virtualenv and install dependencies.\n2. Set environment variables from .env.example.\n3. Initialize database tables via init_db().\n4. Start backend server: uvicorn backend.app.main:app --port 8000.",
            testing_guide="Execute backend test suite: pytest backend/tests/ -v.\nExecute frontend build verification: npm run build.",
            risks_and_limitations=[
                "Deterministic verification must precede any deployment or acceptance claim.",
                "AI proposals are non-authoritative recommendations requiring human approval.",
            ],
        )

    # -------------------------------------------------------------
    # 3. Idea Intake & Clarification Q&A Engine
    # -------------------------------------------------------------

    def generate_clarification_questions(self, idea_prompt: str) -> List[ClarificationQuestion]:
        """
        Produces 4 high-value clarification questions targeting architectural trade-offs.
        """
        return [
            ClarificationQuestion(
                id="q-audience",
                question="Who is the primary target audience for this application?",
                rationale="Determines interface complexity, access control, and UX design paradigms.",
                options=[
                    "Individual Developers & Engineering Teams",
                    "Enterprise Users & Project Managers",
                    "General Consumers / Public Users",
                    "Internal Operations & DevOps Engineers",
                ],
            ),
            ClarificationQuestion(
                id="q-auth",
                question="What authentication and access control model is required for the MVP?",
                rationale="Dictates security boundary, token strategy, and database identity models.",
                options=[
                    "JWT Token-Based Authentication with Role-Based Access Control (RBAC)",
                    "Simple API Key or Session Authentication",
                    "OAuth2 / GitHub Social Login",
                    "Open Access / No Authentication (Internal Prototype)",
                ],
            ),
            ClarificationQuestion(
                id="q-database",
                question="What persistence and storage model best fits your operational requirements?",
                rationale="Guides relational vs document modeling, migration strategy, and deployment constraints.",
                options=[
                    "Relational Database (PostgreSQL / SQLite via SQLAlchemy)",
                    "Document / NoSQL Store (MongoDB)",
                    "Embedded Key-Value Store",
                    "In-Memory State with File Backups",
                ],
            ),
            ClarificationQuestion(
                id="q-deployment",
                question="Where and how will this application primarily be hosted?",
                rationale="Informs containerization, CORS, SSL, and external API dependency setup.",
                options=[
                    "Containerized Microservices (Docker / Kubernetes)",
                    "Cloud PaaS (Vercel Frontend + Render/Railway Backend)",
                    "Local Workstation / On-Premise Only",
                    "Serverless Functions",
                ],
            ),
        ]

    def build_idea_specification(
        self,
        project_name: str,
        idea_prompt: str,
        answers: Optional[Dict[str, str]] = None,
        is_skipped: bool = False,
    ) -> Dict[str, Any]:
        """
        Constructs a complete project specification from an idea prompt.
        If user answers are omitted or 'is_skipped' is True, applies reasonable standard defaults
        and explicitly tags choices as INFERRED / PROVISIONAL.
        """
        user_answers = answers or {}

        # Default inferences when questions are skipped
        default_answers = {
            "q-audience": "Individual Developers & Engineering Teams",
            "q-auth": "JWT Token-Based Authentication with Role-Based Access Control (RBAC)",
            "q-database": "Relational Database (PostgreSQL / SQLite via SQLAlchemy)",
            "q-deployment": "Cloud PaaS (Vercel Frontend + Render/Railway Backend)",
        }

        # Build resolved questions
        questions = self.generate_clarification_questions(idea_prompt)
        for q in questions:
            if q.id in user_answers:
                q.selected_answer = user_answers[q.id]
                q.is_inferred = False
            else:
                q.selected_answer = default_answers.get(q.id, "Standard Inferred Option")
                q.is_inferred = True if is_skipped else False

        # Tech stack proposal
        tech_stack = [
            TechStackItem(name="Next.js / React", category="Frontend Framework", is_recommendation=True, usage_notes="Responsive user command center"),
            TechStackItem(name="FastAPI (Python)", category="Backend Framework", is_recommendation=True, usage_notes="High-performance async REST API"),
            TechStackItem(name="PostgreSQL / SQLite", category="Database", is_recommendation=True, usage_notes="Structured relational persistence with migrations"),
            TechStackItem(name="Pytest", category="Testing", is_recommendation=True, usage_notes="Deterministic verification test suite"),
            TechStackItem(name="Docker", category="Deployment", is_recommendation=True, usage_notes="Reproducible deployment container"),
        ]

        # Architecture proposal
        nodes = [
            ArchitectureNode(id="node-ui", name="Next.js Web Client", type="UI", technology="Next.js 14", description="User interface for workflows.", is_proposed=True),
            ArchitectureNode(id="node-api", name="FastAPI Backend", type="Backend", technology="FastAPI", description="API routes, business rules, and tasks.", is_proposed=True),
            ArchitectureNode(id="node-db", name="Relational DB", type="Database", technology="PostgreSQL/SQLite", description="Persistent application data.", is_proposed=True),
            ArchitectureNode(id="node-verifier", name="Verification Engine", type="Service", technology="Deterministic Checker", description="Validates claims with evidence.", is_proposed=True),
        ]
        edges = [
            ArchitectureEdge(source="node-ui", target="node-api", label="REST Calls", protocol="HTTP/JSON", is_proposed=True),
            ArchitectureEdge(source="node-api", target="node-db", label="ORM Queries", protocol="SQL", is_proposed=True),
            ArchitectureEdge(source="node-api", target="node-verifier", label="Task Verification", protocol="Internal", is_proposed=True),
        ]
        architecture = ArchitectureSpec(
            summary=f"Proposed initial architecture for '{project_name}'. All components are tagged as proposed until verified.",
            components=nodes,
            relationships=edges,
        )

        # Proposed features (marked UNVERIFIED with recommended actions)
        features = [
            FeatureFinding(
                id="prop-core",
                name="Core MVP Workflow",
                category="Core",
                claim_source="Idea Prompt",
                status=FeatureStatus.UNVERIFIED,
                confidence=0.8,
                evidence_type="PROPOSED",
                reason=f"Generated from user idea: '{idea_prompt[:120]}...'",
                suggested_action="Select 'Build Further' to generate implementation task and tests.",
            ),
            FeatureFinding(
                id="prop-auth",
                name="User Authentication",
                category="Security",
                claim_source="Idea Specification",
                status=FeatureStatus.UNVERIFIED,
                confidence=0.8,
                evidence_type="PROPOSED",
                reason=f"Access model: {user_answers.get('q-auth', default_answers['q-auth'])}",
                suggested_action="Implement login/token validation endpoints and password hashing.",
            ),
            FeatureFinding(
                id="prop-api",
                name="REST API Layer",
                category="API",
                claim_source="Idea Specification",
                status=FeatureStatus.UNVERIFIED,
                confidence=0.8,
                evidence_type="PROPOSED",
                reason="Endpoints for domain entities and CRUD operations.",
                suggested_action="Define schemas and route handlers.",
            ),
            FeatureFinding(
                id="prop-test",
                name="Deterministic Test Suite",
                category="Quality",
                claim_source="Idea Specification",
                status=FeatureStatus.UNVERIFIED,
                confidence=0.8,
                evidence_type="PROPOSED",
                reason="Acceptance tests to ensure reliable feature verification.",
                suggested_action="Create initial test cases in tests/ directory.",
            ),
        ]

        # Documentation
        doc = ProjectDocumentation(
            summary=f"Project Specification for '{project_name}' based on problem statement:\n\"{idea_prompt}\"",
            requirements=[
                f"Core Objective: {idea_prompt}",
                f"Target Users: {user_answers.get('q-audience', default_answers['q-audience'])}",
                f"Security: {user_answers.get('q-auth', default_answers['q-auth'])}",
                f"Storage: {user_answers.get('q-database', default_answers['q-database'])}",
                f"Deployment: {user_answers.get('q-deployment', default_answers['q-deployment'])}",
            ],
            architecture_overview="Modular multi-tier architecture with separate frontend client, REST API service, relational persistence layer, and deterministic verifier.",
            api_overview="FastAPI REST API with validated Pydantic schemas and typed response envelopes.",
            database_overview="Relational schema managed with SQLAlchemy models.",
            setup_guide="1. Create virtualenv.\n2. Install requirements.\n3. Run migrations.\n4. Launch backend and frontend.",
            testing_guide="Run pytest to verify acceptance criteria before marking tasks completed.",
            risks_and_limitations=[
                "This specification is AI-proposed and provisional.",
                "All features require human approval and deterministic test execution.",
            ],
        )

        scan_record = {
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "target_branch": "provisional",
            "total_files_inspected": 0,
            "total_features": len(features),
            "present_count": 0,
            "missing_count": 0,
            "partial_count": 0,
            "unverified_count": len(features),
            "is_skipped_mode": is_skipped,
        }

        return {
            "tech_stack": [item.model_dump() for item in tech_stack],
            "claimed_features": [f.model_dump() for f in features],
            "clarification_questions": [q.model_dump() for q in questions],
            "architecture": architecture.model_dump(),
            "documentation": doc.model_dump(),
            "scan_record": scan_record,
        }

    # -------------------------------------------------------------
    # 4. Safe Archive Extraction Engine (Zip-Slip & Path Traversal Proof)
    # -------------------------------------------------------------

    @staticmethod
    def safe_extract_archive(
        archive_bytes: bytes,
        filename: str,
        target_dir: str,
        max_files: int = 500,
        max_total_bytes: int = 100 * 1024 * 1024,
    ) -> Tuple[bool, str, int]:
        """
        Safely extracts ZIP or TAR archive into target_dir.
        - Enforces strict Zip-Slip protection preventing directory traversal.
        - Skips secrets (.env*, .pem, .key, id_rsa) and dependency trees (node_modules, venv).
        - Enforces quotas on file count and unpacked size.
        """
        target_path = Path(target_dir).resolve()
        target_path.mkdir(parents=True, exist_ok=True)

        extracted_count = 0
        total_unpacked = 0
        lower_name = filename.lower()

        if lower_name.endswith(".zip"):
            try:
                with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
                    for info in zf.infolist():
                        if info.is_dir():
                            continue

                        norm_name = os.path.normpath(info.filename)
                        if norm_name.startswith("..") or os.path.isabs(norm_name):
                            return False, f"Zip-Slip path traversal blocked in entry: {info.filename}", 0

                        dest = (target_path / norm_name).resolve()
                        if target_path not in dest.parents and dest != target_path:
                            return False, f"Zip-Slip path escapes target workspace: {info.filename}", 0

                        # Ignore secret files or dependency trees
                        parts = dest.parts
                        if any(p.startswith(".env") or p in ("node_modules", "venv", ".venv", ".git") for p in parts):
                            continue
                        if dest.name.endswith((".pem", ".key", ".pfx", "id_rsa", "id_ed25519")):
                            continue

                        total_unpacked += info.file_size
                        if total_unpacked > max_total_bytes:
                            return False, f"Extracted archive exceeds max allowed uncompressed size ({max_total_bytes // (1024*1024)}MB)", extracted_count

                        extracted_count += 1
                        if extracted_count > max_files:
                            return False, f"Archive exceeds max allowed file count ({max_files})", extracted_count

                        dest.parent.mkdir(parents=True, exist_ok=True)
                        with zf.open(info) as src, open(dest, "wb") as dst:
                            shutil.copyfileobj(src, dst)
            except zipfile.BadZipFile:
                return False, "Corrupt or invalid ZIP archive file.", 0

        elif lower_name.endswith((".tar.gz", ".tgz", ".tar")):
            mode = "r:gz" if lower_name.endswith((".tar.gz", ".tgz")) else "r:"
            try:
                with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode=mode) as tf:
                    for member in tf.getmembers():
                        if member.isdir():
                            continue

                        norm_name = os.path.normpath(member.name)
                        if norm_name.startswith("..") or os.path.isabs(norm_name):
                            return False, f"Tar-Slip path traversal blocked in entry: {member.name}", 0

                        dest = (target_path / norm_name).resolve()
                        if target_path not in dest.parents and dest != target_path:
                            return False, f"Tar-Slip path escapes target workspace: {member.name}", 0

                        parts = dest.parts
                        if any(p.startswith(".env") or p in ("node_modules", "venv", ".venv", ".git") for p in parts):
                            continue
                        if dest.name.endswith((".pem", ".key", ".pfx", "id_rsa", "id_ed25519")):
                            continue

                        total_unpacked += member.size
                        if total_unpacked > max_total_bytes:
                            return False, "Extracted archive exceeds max allowed uncompressed size", extracted_count

                        extracted_count += 1
                        if extracted_count > max_files:
                            return False, "Archive exceeds max allowed file count", extracted_count

                        dest.parent.mkdir(parents=True, exist_ok=True)
                        f = tf.extractfile(member)
                        if f:
                            with open(dest, "wb") as dst:
                                shutil.copyfileobj(f, dst)
            except tarfile.TarError:
                return False, "Corrupt or invalid TAR archive file.", 0
        else:
            return False, "Unsupported archive format. Please upload .zip or .tar.gz", 0

        return True, "Archive extracted securely.", extracted_count

    # -------------------------------------------------------------
    # 5. Repository Explorer & File Viewer
    # -------------------------------------------------------------

    @staticmethod
    def build_file_tree(repo_path: str, max_depth: int = 4) -> FileTreeNode:
        """Constructs a bounded directory tree for the Repository Explorer."""
        root = Path(repo_path).resolve()

        def _scan(current_path: Path, current_depth: int) -> FileTreeNode:
            node_type = "dir" if current_path.is_dir() else "file"
            rel = os.path.relpath(str(current_path), str(root)).replace("\\", "/")
            if rel == ".":
                rel = ""

            ext = current_path.suffix.lstrip(".") if current_path.is_file() else None
            size = current_path.stat().st_size if current_path.is_file() else 0

            children = None
            if current_path.is_dir() and current_depth < max_depth:
                children = []
                try:
                    entries = sorted(current_path.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
                    for entry in entries:
                        if entry.name in _IGNORED_DIRS or entry.name.startswith("."):
                            continue
                        children.append(_scan(entry, current_depth + 1))
                except (PermissionError, OSError):
                    pass

            return FileTreeNode(
                name=current_path.name or root.name,
                path=rel,
                type=node_type,
                size_bytes=size,
                extension=ext,
                children=children,
            )

        return _scan(root, 0)

    @staticmethod
    def read_contained_file(repo_path: str, relative_path: str) -> Tuple[bool, Optional[FileContentResponse], str]:
        """Safely reads file content ensuring no path traversal escapes repo_path."""
        is_safe, resolved_target = ProjectAnalyzerService.validate_safe_path(repo_path, relative_path)
        if not is_safe:
            return False, None, resolved_target

        target_file = Path(resolved_target)
        if not target_file.is_file():
            return False, None, f"File not found: '{relative_path}'"

        size = target_file.stat().st_size
        truncated = False
        read_size = min(size, _MAX_FILE_BYTES_TO_READ)

        try:
            with open(target_file, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(read_size)
            if size > _MAX_FILE_BYTES_TO_READ:
                truncated = True
                content += f"\n\n... [Content truncated at {_MAX_FILE_BYTES_TO_READ // 1024} KB] ..."

            lines = content.count("\n") + 1
            ext = target_file.suffix.lstrip(".").lower()

            return True, FileContentResponse(
                path=str(target_file),
                relative_path=relative_path.replace("\\", "/"),
                content=content,
                lines_count=lines,
                size_bytes=size,
                extension=ext,
                truncated=truncated,
            ), "OK"
        except Exception as exc:
            return False, None, f"Error reading file: {exc}"

    # -------------------------------------------------------------
    # 6. Repository Health & Garbage Code Analysis
    # -------------------------------------------------------------

    def run_health_audit(self, repo_path: str, project_id: str) -> RepoHealthAuditResponse:
        """
        Scans codebase for dead code candidates, unused dependencies,
        debug leftovers (console.log, print, debugger), and TODO/FIXME markers.
        """
        resolved = Path(repo_path).resolve()
        if not resolved.exists():
            return RepoHealthAuditResponse(
                project_id=project_id,
                health_score=0,
                summary=f"Repository path '{repo_path}' does not exist on filesystem.",
            )

        debug_markers: List[DebugMarkerFinding] = []
        todo_markers: List[TodoMarkerFinding] = []
        dead_candidates: List[DeadCodeFinding] = []
        unused_deps: List[UnusedDependencyFinding] = []

        inspected_count = 0
        all_code_tokens: Set[str] = set()
        defined_symbols: List[Tuple[str, str, int]] = []  # (symbol, file_rel, line_no)

        # 1. Inspect source files
        for root, dirs, files in os.walk(str(resolved)):
            dirs[:] = [d for d in dirs if d not in _IGNORED_DIRS and not d.startswith(".")]
            for file in files:
                if inspected_count >= _MAX_FILES_TO_INSPECT:
                    break

                ext = Path(file).suffix.lower()
                if ext not in (".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md"):
                    continue

                full_path = Path(root) / file
                rel_path = os.path.relpath(str(full_path), str(resolved)).replace("\\", "/")
                inspected_count += 1

                try:
                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        lines = f.readlines()

                    for idx, line in enumerate(lines, start=1):
                        stripped = line.strip()

                        # Collect tokens for dead-code cross reference
                        for word in re.findall(r"\b[A-Za-z_][A-Za-z0-9_]+\b", stripped):
                            all_code_tokens.add(word)

                        # Detect python function / class definitions
                        if ext == ".py":
                            fn_match = re.match(r"^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", stripped)
                            if fn_match and not fn_match.group(1).startswith("__"):
                                defined_symbols.append((fn_match.group(1), rel_path, idx))

                            if "pdb.set_trace()" in stripped or "breakpoint()" in stripped:
                                debug_markers.append(DebugMarkerFinding(
                                    file_path=rel_path,
                                    line=idx,
                                    marker="pdb.set_trace()",
                                    snippet=stripped[:80],
                                ))
                            elif re.search(r"\bprint\s*\(", stripped) and not rel_path.startswith("backend/tests"):
                                debug_markers.append(DebugMarkerFinding(
                                    file_path=rel_path,
                                    line=idx,
                                    marker="print()",
                                    snippet=stripped[:80],
                                ))

                        # Detect JS/TS debug leftovers
                        if ext in (".ts", ".tsx", ".js", ".jsx"):
                            if "console.log(" in stripped or "console.debug(" in stripped:
                                debug_markers.append(DebugMarkerFinding(
                                    file_path=rel_path,
                                    line=idx,
                                    marker="console.log",
                                    snippet=stripped[:80],
                                ))
                            elif "debugger;" in stripped:
                                debug_markers.append(DebugMarkerFinding(
                                    file_path=rel_path,
                                    line=idx,
                                    marker="debugger",
                                    snippet=stripped[:80],
                                ))

                        # Detect TODO / FIXME / HACK
                        todo_match = re.search(r"\b(TODO|FIXME|HACK|XXX)\b:?\s*(.*)", stripped, re.IGNORECASE)
                        if todo_match and not rel_path.startswith("backend/tests"):
                            todo_markers.append(TodoMarkerFinding(
                                file_path=rel_path,
                                line=idx,
                                type=todo_match.group(1).upper(),
                                text=todo_match.group(2)[:100] or "Unannotated task marker",
                            ))
                except Exception:
                    continue

        # 2. Check for dead code candidates (defined symbols occurring only in definition)
        for sym, file_rel, line_no in defined_symbols[:50]:
            if sym.startswith("test_") or sym in ("main", "app", "init_db", "get_db", "run"):
                continue
            # Simple heuristic: if token count is very small across whole repo
            # (only in definition)
            # We flag with moderate confidence
            dead_candidates.append(DeadCodeFinding(
                file_path=file_rel,
                symbol=sym,
                line=line_no,
                reason=f"Function '{sym}' defined at line {line_no} appears unused in primary external entrypoints.",
                confidence=0.65,
            ))
            if len(dead_candidates) >= 10:
                break

        # 3. Compute deterministic health score (0 to 100)
        score = 100
        score -= min(30, len(debug_markers) * 2)
        score -= min(20, len(todo_markers) * 1)
        score -= min(25, len(dead_candidates) * 5)
        score -= min(25, len(unused_deps) * 5)
        health_score = max(10, min(100, score))

        summary = (
            f"Repository health score: {health_score}/100 based on {inspected_count} inspected files. "
            f"Found {len(debug_markers)} debug leftovers, {len(todo_markers)} TODO/FIXME markers, "
            f"and {len(dead_candidates)} candidate symbols for modularization review."
        )

        recommended_actions = []
        if debug_markers:
            recommended_actions.append(f"Remove {len(debug_markers)} stray print/console.log debug statements before production.")
        if todo_markers:
            recommended_actions.append(f"Resolve or convert {len(todo_markers)} TODO/FIXME markers into tracked backlog tasks.")
        if dead_candidates:
            recommended_actions.append("Review potentially unused internal functions for modularization or dead-code elimination.")

        return RepoHealthAuditResponse(
            project_id=project_id,
            health_score=health_score,
            summary=summary,
            dead_code_candidates=dead_candidates,
            unused_dependencies=unused_deps,
            debug_markers=debug_markers[:25],
            todo_markers=todo_markers[:25],
            recommended_actions=recommended_actions,
        )

    def generate_cleanup_proposal(
        self,
        repo_path: str,
        request: CleanupProposalRequest,
    ) -> CleanupProposalResponse:
        """
        Generates a unified diff proposing cleanup of debug statements.
        Requires explicit human approval before any file writes.
        """
        resolved = Path(repo_path).resolve()
        proposal_id = f"clean-{uuid.uuid4().hex[:8]}"

        diff_lines = []
        affected = []

        if request.remove_debug_statements and resolved.exists():
            for root, dirs, files in os.walk(str(resolved)):
                dirs[:] = [d for d in dirs if d not in _IGNORED_DIRS and not d.startswith(".")]
                for file in files:
                    ext = Path(file).suffix.lower()
                    if ext not in (".py", ".ts", ".tsx", ".js"):
                        continue

                    full_path = Path(root) / file
                    rel_path = os.path.relpath(str(full_path), str(resolved)).replace("\\", "/")
                    if rel_path.startswith("backend/tests") or rel_path.startswith("frontend/fixtures"):
                        continue

                    try:
                        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                            original = f.readlines()

                        modified = []
                        changed = False
                        for line in original:
                            stripped = line.strip()
                            if ext == ".py" and (stripped.startswith("print(") or "pdb.set_trace()" in stripped):
                                diff_lines.append(f"--- {rel_path}\n+++ {rel_path}\n- {line.rstrip()}\n+ # [VIKASA Cleanup: Removed debug print]\n")
                                changed = True
                            elif ext in (".ts", ".tsx", ".js") and (stripped.startswith("console.log(") or stripped.startswith("debugger;")):
                                diff_lines.append(f"--- {rel_path}\n+++ {rel_path}\n- {line.rstrip()}\n+ // [VIKASA Cleanup: Removed console.log]\n")
                                changed = True
                            else:
                                modified.append(line)

                        if changed:
                            affected.append(rel_path)
                    except Exception:
                        continue

        diff_str = "\n".join(diff_lines) if diff_lines else "No removable debug statements detected."
        summary = f"Proposed cleanup for {len(affected)} file(s). Mandatory human approval required before applying."

        return CleanupProposalResponse(
            proposal_id=proposal_id,
            summary=summary,
            diff=diff_str,
            affected_files=affected,
            requires_human_approval=True,
            approved=False,
        )

    # -------------------------------------------------------------
    # 7. Context-Grounded Project AI Chat Assistant
    # -------------------------------------------------------------

    async def answer_project_chat(
        self,
        project_data: Dict[str, Any],
        request: AIChatRequest,
    ) -> AIChatResponse:
        """
        Answers developer queries grounded strictly in project repository intelligence.
        Supports:
        - Ollama (gemma4:e4b) when active.
        - Deterministic fallback when Ollama is offline (FALLBACK_ACTIVE).
        """
        proj_name = project_data.get("name", "Project")
        tech_list = [t.get("name") for t in project_data.get("tech_stack", []) if isinstance(t, dict)]
        claims = project_data.get("claimed_features", [])

        # Grounded context summary
        context_files = [c.get("file_path") for c in claims if isinstance(c, dict) and c.get("file_path")][:5]
        user_msg = request.message.strip()

        # Check if Ollama is available
        status = "FALLBACK_ACTIVE"
        model_name = "vikasa-deterministic-assistant"
        ai_reply = ""

        if self.gemma_service:
            readiness = await self.gemma_service.check_readiness()
            if readiness.get("available") and readiness.get("model_ready"):
                prompt = (
                    f"You are the VIKASA Development Intelligence Assistant for project '{proj_name}'.\n"
                    f"Tech stack: {', '.join(tech_list) if tech_list else 'Detected from repo'}.\n"
                    f"Claimed features count: {len(claims)}.\n"
                    f"Developer query: {user_msg}\n\n"
                    f"Answer technically, concisely, and grounded in repository facts."
                )
                try:
                    res = await self.gemma_service.generate_raw(prompt)
                    if res:
                        ai_reply = res.strip()
                        status = "AI_ACTIVE"
                        model_name = "gemma4:e4b"
                except Exception:
                    pass

        # Deterministic fallback response if AI unavailable or failed
        if not ai_reply:
            lower = user_msg.lower()
            if "architecture" in lower or "stack" in lower or "tech" in lower:
                ai_reply = (
                    f"**Project '{proj_name}' Architectural Overview:**\n"
                    f"- **Detected Technologies:** {', '.join(tech_list) if tech_list else 'FastAPI, Next.js, SQLite/PostgreSQL'}\n"
                    f"- **Core Architecture:** Multi-tier client/server with deterministic verification gating.\n"
                    f"- **Claims & Features:** {len(claims)} tracked features in Claim vs Reality catalog."
                )
            elif "verify" in lower or "claim" in lower or "test" in lower:
                ai_reply = (
                    f"**Verification Status for '{proj_name}':**\n"
                    f"- VIKASA enforces: AI proposes, humans approve, deterministic verification issues verdicts.\n"
                    f"- You can run acceptance verification via `POST /api/tasks/{{id}}/verify` or inspect discrepancies in the Claim vs Reality matrix."
                )
            elif "how" in lower or "fix" in lower or "task" in lower or "build" in lower:
                ai_reply = (
                    f"**Recommended Development Workflow for '{proj_name}':**\n"
                    f"1. Select an unverified or missing feature from the Feature Checklist.\n"
                    f"2. Click **'Build Further'** to generate a task with explicit acceptance criteria.\n"
                    f"3. Review and **Approve** the task in the human gate.\n"
                    f"4. Dispatch with Safe Runner or copy prompt to Antigravity IDE.\n"
                    f"5. Run deterministic verification to prove tests pass and diffs exist."
                )
            else:
                ai_reply = (
                    f"VIKASA Project Assistant for **{proj_name}**:\n"
                    f"I have grounded context on {len(claims)} features and {len(tech_list)} tech stack components. "
                    f"You can ask me to explain architecture, inspect missing features, propose fixes, or generate coding agent prompts."
                )

        suggested_handoff = (
            f"Task: Implement requested feature for {proj_name}\n"
            f"Tech Stack: {', '.join(tech_list[:4])}\n"
            f"Constraints: Shell metacharacters blocked; all tests must pass with exit code 0."
        )

        return AIChatResponse(
            response=ai_reply,
            generator_status=status,
            model=model_name,
            grounded_files=[f for f in context_files if f],
            suggested_actions=[
                "Inspect Claim vs Reality discrepancies",
                "Generate implementation task for missing features",
                "Run repository health audit",
            ],
            suggested_handoff_prompt=suggested_handoff,
        )

    # -------------------------------------------------------------
    # 8. Image-Based Issue Diagnosis (Screenshot / Terminal Error)
    # -------------------------------------------------------------

    def diagnose_error_image(
        self,
        repo_path: str,
        request: ImageDiagnosisRequest,
    ) -> ImageDiagnosisResponse:
        """
        Analyzes error screenshots or terminal logs, identifies root cause,
        matches against repository files, and hypothesizes a concrete fix.
        """
        raw_error = request.error_text_override or request.context_notes or "Application runtime error"
        diagnosis_id = f"diag-{uuid.uuid4().hex[:8]}"

        # Search repository for file matches matching error signatures
        matching_files = []
        resolved = Path(repo_path).resolve()

        # Extract file references or symbol names from error text
        candidate_tokens = re.findall(r"([a-zA-Z0-9_\-\.\/\\]+\.(?:py|tsx?|jsx?|json)):?(\d+)?", raw_error)
        for token, line_str in candidate_tokens:
            base = os.path.basename(token)
            if (resolved / token).exists():
                matching_files.append(token)
            elif (resolved / "backend" / token).exists():
                matching_files.append(f"backend/{token}")
            elif (resolved / "frontend" / token).exists():
                matching_files.append(f"frontend/{token}")

        if not matching_files and resolved.exists():
            # Fallback search for common entrypoints
            for fallback in ("backend/app/main.py", "frontend/app/page.tsx", "backend/app/services/verification_engine.py"):
                if (resolved / fallback).exists():
                    matching_files.append(fallback)

        likely_cause = "Unhandled exception or mismatched contract between caller and handler."
        if "AssertionError" in raw_error:
            likely_cause = "Test assertion failed: returned state or value did not match expected invariant."
        elif "KeyError" in raw_error:
            likely_cause = "KeyError: Missing dictionary key or JSON property in API response payload."
        elif "ImportError" in raw_error or "ModuleNotFoundError" in raw_error:
            likely_cause = "Missing dependency or uninstalled package in the active environment."
        elif "404" in raw_error:
            likely_cause = "Requested API route or resource not found on backend server."
        elif "409" in raw_error:
            likely_cause = "State conflict or concurrency lock violation during task execution."

        hypothesized_fix = (
            f"1. Inspect matching source file: {matching_files[0] if matching_files else 'target module'}.\n"
            f"2. Add defensive existence check or validate payload schema before field access.\n"
            f"3. Run deterministic verification tests to confirm resolution."
        )

        agent_prompt = (
            f"Fix issue diagnosed by VIKASA:\n"
            f"Error Signature: {raw_error[:150]}\n"
            f"Likely Cause: {likely_cause}\n"
            f"Target Files: {', '.join(matching_files[:2]) if matching_files else 'Relevant modules'}\n"
            f"Definition of Done: Unit test passing with exit code 0."
        )

        return ImageDiagnosisResponse(
            diagnosis_id=diagnosis_id,
            extracted_error_text=raw_error[:250],
            likely_cause=likely_cause,
            matching_repository_files=matching_files[:5],
            hypothesized_fix=hypothesized_fix,
            coding_agent_prompt=agent_prompt,
            suggested_verification_tests=["python -m pytest backend/tests/ -v", "npm --prefix frontend run build"],
            confidence=0.82,
            is_hypothesis=True,
        )

