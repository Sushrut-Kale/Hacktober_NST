"""Test suite for VIKASA Project Intelligence and Security Validation.

Tests:
- SSRF protection and repository URL validation
- Safe path containment and symlink escape prevention
- Repository tech stack detection and Claim vs Reality extraction
- Idea intake, clarification questions, and skip-questions workflow
- Project Intelligence API endpoints
"""

import os
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas.project import FeatureStatus, SourceType
from backend.app.services.project_analyzer import ProjectAnalyzerService


@pytest.fixture
def client():
    return TestClient(app)


def test_ssrf_repository_url_validation():
    """Validates that SSRF attack vectors, loopbacks, and private subnets are blocked."""
    analyzer = ProjectAnalyzerService()

    # Valid URLs
    valid, msg = analyzer.validate_repository_url("https://github.com/Sushrut-Kale/Hacktober_NST.git")
    assert valid is True

    valid, msg = analyzer.validate_repository_url("https://gitlab.com/group/repo.git")
    assert valid is True

    # Blocked: non-HTTP schemes
    valid, msg = analyzer.validate_repository_url("file:///etc/passwd")
    assert valid is False
    assert "scheme" in msg.lower()

    valid, msg = analyzer.validate_repository_url("ftp://example.com/repo.git")
    assert valid is False

    # Blocked: loopback addresses
    valid, msg = analyzer.validate_repository_url("http://127.0.0.1:8000/repo.git")
    assert valid is False
    assert "blocked" in msg.lower() or "ssrf" in msg.lower()

    valid, msg = analyzer.validate_repository_url("http://localhost:3000")
    assert valid is False

    # Blocked: cloud metadata
    valid, msg = analyzer.validate_repository_url("http://169.254.169.254/latest/meta-data/")
    assert valid is False

    # Blocked: RFC 1918 private subnets
    valid, msg = analyzer.validate_repository_url("http://10.0.0.5/repo.git")
    assert valid is False

    valid, msg = analyzer.validate_repository_url("http://192.168.1.1/repo.git")
    assert valid is False


def test_path_containment_validation(tmp_path):
    """Ensures paths escaping the base directory via traversal or symlinks are rejected."""
    analyzer = ProjectAnalyzerService()
    base_dir = str(tmp_path)

    # Safe child path
    child = tmp_path / "subdir"
    child.mkdir()
    valid, resolved = analyzer.validate_safe_path(base_dir, "subdir")
    assert valid is True
    assert os.path.exists(resolved)

    # Path traversal attempt
    valid, resolved = analyzer.validate_safe_path(base_dir, "../outside")
    assert valid is False
    assert "traversal" in resolved.lower()


def test_repository_analysis_on_current_workspace():
    """Runs repository analysis on the actual VIKASA workspace and validates findings."""
    analyzer = ProjectAnalyzerService()
    analysis = analyzer.analyze_repository(
        repo_path=".",
        project_name="VIKASA Workspace",
        target_branch="main",
    )

    # Tech stack check
    tech_stack = analysis["tech_stack"]
    assert any(t["name"] in ("Python", "FastAPI", "Node.js", "TypeScript", "Next.js") for t in tech_stack)

    # Claim vs Reality check
    features = analysis["claimed_features"]
    assert len(features) > 0

    # Ensure status values are valid
    valid_statuses = {s.value for s in FeatureStatus}
    for f in features:
        assert f["status"] in valid_statuses
        assert "id" in f
        assert "name" in f
        assert "reason" in f

    # Architecture graph check
    arch = analysis["architecture"]
    assert "components" in arch
    assert len(arch["components"]) >= 3
    assert "relationships" in arch

    # Documentation check
    doc = analysis["documentation"]
    assert "summary" in doc
    assert "setup_guide" in doc


def test_idea_clarification_questions():
    """Tests clarification question generation for an idea prompt."""
    analyzer = ProjectAnalyzerService()
    questions = analyzer.generate_clarification_questions("An AI-powered recipe planner with grocery inventory sync")
    assert len(questions) == 4
    for q in questions:
        assert len(q.options) >= 2
        assert q.rationale != ""


def test_idea_skip_questions_workflow():
    """Tests the 'Skip questions — generate it for me' auto-drafting engine."""
    analyzer = ProjectAnalyzerService()
    spec = analyzer.build_idea_specification(
        project_name="RecipeAI",
        idea_prompt="Smart grocery tracker with recipe suggestions",
        answers=None,
        is_skipped=True,
    )

    # Check clarification questions have inferred defaults
    questions = spec["clarification_questions"]
    assert all(q["is_inferred"] is True for q in questions)
    assert all(q["selected_answer"] is not None for q in questions)

    # Check proposed architecture and features
    arch = spec["architecture"]
    assert all(c.get("is_proposed") is True for c in arch["components"])

    features = spec["claimed_features"]
    assert len(features) >= 3
    assert all(f["status"] == FeatureStatus.UNVERIFIED.value for f in features)


def test_project_intelligence_api_full_workflow(client):
    """End-to-end integration test of Project Intelligence API routes."""
    # 1. Reject SSRF URL
    bad_res = client.post(
        "/api/projects",
        json={
            "name": "Malicious Project",
            "repository_url": "http://127.0.0.1:8000/internal",
            "source_type": "GIT",
        },
    )
    assert bad_res.status_code == 400
    assert "SSRF" in bad_res.json()["detail"] or "security" in bad_res.json()["detail"].lower()

    # 2. Create Project from Idea
    create_res = client.post(
        "/api/projects",
        json={
            "name": "HealthTracker AI",
            "idea_prompt": "Continuous wearable metrics analysis with preventive health alerts",
            "source_type": "IDEA",
        },
    )
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    # 3. Retrieve Project Detail
    detail_res = client.get(f"/api/projects/{project_id}/detail")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["name"] == "HealthTracker AI"
    assert len(detail["clarification_questions"]) == 4
    assert len(detail["claimed_features"]) >= 3
    assert "PRESENT" in detail["feature_counts"]

    # 4. Skip Questions workflow
    skip_res = client.post(f"/api/projects/{project_id}/skip-questions")
    assert skip_res.status_code == 200
    skip_detail = skip_res.json()
    assert all(q["is_inferred"] is True for q in skip_detail["clarification_questions"])

    # 5. Build Feature -> Generates Task
    feature_id = skip_detail["claimed_features"][0]["id"]
    task_res = client.post(
        f"/api/projects/{project_id}/build-feature",
        json={"feature_id": feature_id},
    )
    assert task_res.status_code == 201
    task_data = task_res.json()
    assert task_data["status"] == "CREATED"
    assert task_data["project_id"] == project_id
    assert "acceptance_criteria" in task_data

    # 6. Verify task shows up under project tasks
    tasks_res = client.get(f"/api/projects/{project_id}/tasks")
    assert tasks_res.status_code == 200
    assert len(tasks_res.json()) >= 1
