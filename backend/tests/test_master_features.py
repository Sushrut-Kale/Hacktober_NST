"""
Tests for Master VIKASA Platform Features:
- Safe archive ingestion & Zip-Slip protection
- Repository Explorer & contained file viewer
- Repository Health & Garbage Code audit
- Cleanup diff proposal with human approval gate
- Context-grounded Project AI Chat
- Image-based error issue diagnosis
- Historical Replay mode timeline
"""

import io
import json
import zipfile
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.project_analyzer import ProjectAnalyzerService
from backend.app.schemas.project import (
    CleanupProposalRequest,
    AIChatRequest,
    ImageDiagnosisRequest,
)

client = TestClient(app)


# =====================================================================
# 1. Archive Ingestion & Zip-Slip Defense
# =====================================================================

def test_safe_extract_archive_valid():
    """Verify that a valid ZIP archive unpacks safely and extracts files."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("app/main.py", "print('hello')\n")
        zf.writestr("README.md", "# Sample App\n")

    buf.seek(0)
    is_ok, msg, count = ProjectAnalyzerService.safe_extract_archive(
        archive_bytes=buf.getvalue(),
        filename="sample.zip",
        target_dir="scratch/test_extract_valid",
    )
    assert is_ok is True
    assert count == 2


def test_safe_extract_archive_blocks_zip_slip():
    """Verify that Zip-Slip path traversal entries are blocked immediately."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("../../etc/passwd", "root:x:0:0\n")

    buf.seek(0)
    is_ok, msg, count = ProjectAnalyzerService.safe_extract_archive(
        archive_bytes=buf.getvalue(),
        filename="malicious.zip",
        target_dir="scratch/test_extract_malicious",
    )
    assert is_ok is False
    assert "Zip-Slip path traversal blocked" in msg


def test_upload_project_archive_endpoint():
    """Test POST /api/projects/upload endpoint."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("index.js", "console.log('App running');\n")
        zf.writestr("package.json", json.dumps({"name": "test-pkg", "version": "1.0.0"}))
        zf.writestr("README.md", "# Test Package\nFeatures:\n- Authentication\n")

    buf.seek(0)
    files = {"file": ("archive.zip", buf.getvalue(), "application/zip")}
    data = {"name": "UploadTestProj", "description": "Testing archive upload"}

    res = client.post("/api/projects/upload", data=data, files=files)
    assert res.status_code == 201
    payload = res.json()
    assert payload["name"] == "UploadTestProj"
    assert payload["source_type"] == "FOLDER"
    assert payload["analysis_status"] == "COMPLETED"
    assert "id" in payload


# =====================================================================
# 2. Repository Explorer & File Viewer
# =====================================================================

def test_project_file_tree_and_content():
    """Test GET /api/projects/{id}/files and GET /api/projects/{id}/file-content."""
    # Create project pointing to current directory
    create_res = client.post("/api/projects", json={
        "name": "ExplorerProj",
        "root_path": ".",
        "source_type": "GIT",
    })
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    # 1. Fetch file tree
    tree_res = client.get(f"/api/projects/{proj_id}/files?max_depth=2")
    assert tree_res.status_code == 200
    tree = tree_res.json()
    assert "name" in tree
    assert "children" in tree
    assert isinstance(tree["children"], list)

    # 2. Read safe contained file
    content_res = client.get(f"/api/projects/{proj_id}/file-content?path=README.md")
    assert content_res.status_code == 200
    content_data = content_res.json()
    assert content_data["relative_path"] == "README.md"
    assert "VIKASA" in content_data["content"]
    assert content_data["lines_count"] > 10

    # 3. Path traversal attack must be rejected with 400
    evil_res = client.get(f"/api/projects/{proj_id}/file-content?path=../../Windows/win.ini")
    assert evil_res.status_code == 400
    assert "escapes workspace boundary" in evil_res.json()["detail"]


# =====================================================================
# 3. Repository Health & Garbage Code Analysis
# =====================================================================

def test_project_health_audit_and_cleanup_proposal():
    """Test GET /api/projects/{id}/health-audit and POST /api/projects/{id}/cleanup-proposal."""
    create_res = client.post("/api/projects", json={
        "name": "HealthProj",
        "root_path": ".",
        "source_type": "GIT",
    })
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    # 1. Run health audit
    audit_res = client.get(f"/api/projects/{proj_id}/health-audit")
    assert audit_res.status_code == 200
    audit = audit_res.json()
    assert "health_score" in audit
    assert 0 <= audit["health_score"] <= 100
    assert isinstance(audit["debug_markers"], list)
    assert isinstance(audit["todo_markers"], list)

    # 2. Generate cleanup proposal
    proposal_res = client.post(f"/api/projects/{proj_id}/cleanup-proposal", json={
        "target_findings": ["debug_markers"],
        "remove_debug_statements": True,
    })
    assert proposal_res.status_code == 200
    proposal = proposal_res.json()
    assert "proposal_id" in proposal
    assert proposal["requires_human_approval"] is True
    assert proposal["approved"] is False


# =====================================================================
# 4. Context-Grounded Project AI Chat
# =====================================================================

def test_project_ai_chat():
    """Test POST /api/projects/{id}/chat."""
    create_res = client.post("/api/projects", json={
        "name": "ChatProj",
        "root_path": ".",
        "source_type": "GIT",
    })
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    chat_res = client.post(f"/api/projects/{proj_id}/chat", json={
        "message": "What is the tech stack and architecture of this project?",
        "history": [],
    })
    assert chat_res.status_code == 200
    chat = chat_res.json()
    assert "response" in chat
    assert chat["generator_status"] in ("AI_ACTIVE", "FALLBACK_ACTIVE")
    assert "suggested_actions" in chat
    assert len(chat["suggested_actions"]) > 0


# =====================================================================
# 5. Image-Based Issue Diagnosis
# =====================================================================

def test_project_diagnose_image():
    """Test POST /api/projects/{id}/diagnose-image."""
    create_res = client.post("/api/projects", json={
        "name": "DiagProj",
        "root_path": ".",
        "source_type": "GIT",
    })
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    diag_res = client.post(f"/api/projects/{proj_id}/diagnose-image", json={
        "error_text_override": "KeyError: 'id' in backend/tests/test_db_consistency.py:137",
        "context_notes": "Test failed with KeyError",
    })
    assert diag_res.status_code == 200
    diag = diag_res.json()
    assert diag["is_hypothesis"] is True
    assert "KeyError" in diag["likely_cause"]
    assert "coding_agent_prompt" in diag
    assert len(diag["suggested_verification_tests"]) > 0


# =====================================================================
# 6. Replay Mode & Event Timeline
# =====================================================================

def test_project_replay_timeline():
    """Test GET /api/projects/{id}/replay."""
    create_res = client.post("/api/projects", json={
        "name": "ReplayProj",
        "root_path": ".",
        "source_type": "GIT",
    })
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    replay_res = client.get(f"/api/projects/{proj_id}/replay")
    assert replay_res.status_code == 200
    replay = replay_res.json()
    assert replay["project_id"] == proj_id
    assert replay["total_events"] >= 1
    assert any(e["event_type"] == "PROJECT_CREATED" for e in replay["events"])
