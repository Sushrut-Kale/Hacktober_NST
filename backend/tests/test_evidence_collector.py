"""Tests for EvidenceCollector service."""

import os
import subprocess
import pytest
from backend.app.schemas.core import (
    Task,
    AcceptanceCriterion,
    ExecutionClaim,
    EvidenceItem,
    EvidenceType,
    VerificationVerdict,
)
from backend.app.services.evidence_collector import EvidenceCollector


@pytest.fixture
def collector():
    return EvidenceCollector()


def test_validate_repo_path_success(collector, tmp_path):
    """Test validating an existing directory succeeds."""
    validated = collector.validate_repo_path(str(tmp_path))
    assert os.path.isabs(validated)
    assert os.path.exists(validated)


def test_validate_repo_path_invalid_raises_error(collector):
    """Test validating a nonexistent directory raises ValueError."""
    with pytest.raises(ValueError, match="does not exist"):
        collector.validate_repo_path("C:/nonexistent_repo_dir_12345")


def test_git_evidence_unavailable_on_non_repo(collector, tmp_path):
    """Test git evidence returns unavailable log when folder is not a git repo."""
    items = collector.collect_git_evidence(repo_path=str(tmp_path))
    assert len(items) >= 1
    # Plain directory without git init will indicate git issue or diff error
    has_git_issue = any(
        item.evidence_type == EvidenceType.LOG_OUTPUT or "fatal" in (item.content or "").lower()
        for item in items
    )
    assert has_git_issue


def test_git_evidence_collection_in_git_repo(collector, tmp_path):
    """Test git status and diff collection in a real temporary git repo."""
    # Initialize a temporary git repo
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.name", "Tester"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, capture_output=True)

    # Initial commit
    file1 = tmp_path / "hello.py"
    file1.write_text("print('v1')\n", encoding="utf-8")
    subprocess.run(["git", "add", "hello.py"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=tmp_path, capture_output=True, check=True)

    # Modify file to create a real diff
    file1.write_text("print('v2 modified')\n", encoding="utf-8")

    items = collector.collect_git_evidence(repo_path=str(tmp_path))
    assert len(items) == 2

    # Verify status item
    status_item = next(i for i in items if i.evidence_type == EvidenceType.FILE_CONTENT)
    assert "hello.py" in status_item.content
    assert status_item.exit_code == 0

    # Verify diff item
    diff_item = next(i for i in items if i.evidence_type == EvidenceType.GIT_DIFF)
    assert "print('v2 modified')" in diff_item.content
    assert diff_item.exit_code == 0
    assert diff_item.passed is True


def test_execute_test_command_passing(collector, tmp_path):
    """Test executing a whitelisted safe command with exit code 0."""
    item = collector.execute_test_command(
        command=["python", "-c", "print('TEST SUCCESSFUL')"],
        cwd=str(tmp_path),
        criterion_id="AC-TEST",
    )
    assert item.evidence_type == EvidenceType.COMMAND_EXIT_CODE
    assert item.exit_code == 0
    assert item.passed is True
    assert "TEST SUCCESSFUL" in item.content


def test_execute_test_command_failing(collector, tmp_path):
    """Test executing a whitelisted command that exits with code 1."""
    item = collector.execute_test_command(
        command=["python", "-c", "import sys; sys.exit(1)"],
        cwd=str(tmp_path),
        criterion_id="AC-TEST",
    )
    assert item.evidence_type == EvidenceType.COMMAND_EXIT_CODE
    assert item.exit_code == 1
    assert item.passed is False


def test_execute_test_command_blocks_disallowed_binary(collector, tmp_path):
    """Test security guardrail blocks disallowed executables."""
    item = collector.execute_test_command(
        command=["curl", "https://malicious-domain.com"],
        cwd=str(tmp_path),
    )
    assert item.evidence_type == EvidenceType.LOG_OUTPUT
    assert item.exit_code == -1
    assert item.passed is False
    assert "Execution blocked" in item.content


def test_execute_test_command_timeout(collector, tmp_path):
    """Test command timeout triggers timeout failure without hanging."""
    item = collector.execute_test_command(
        command=["python", "-c", "import time; time.sleep(5)"],
        cwd=str(tmp_path),
        timeout_seconds=0.5,
    )
    assert item.evidence_type == EvidenceType.COMMAND_EXIT_CODE
    assert item.exit_code == -1
    assert item.passed is False
    assert "timed out" in item.content.lower()


def test_collect_and_verify_claim_vs_reality(collector, tmp_path):
    """Test full collect_and_verify pipeline generates Claim vs Reality report."""
    task = Task(
        id="task-cvr",
        title="Sample verification task",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="Execution successful")
        ]
    )
    claim = ExecutionClaim(
        task_id="task-cvr",
        agent_name="TestAgent",
        claimed_success=True,
        statement="Completed task with verified python script execution",
    )

    report = collector.collect_and_verify(
        task=task,
        claim=claim,
        repo_path=str(tmp_path),
        test_command=["python", "-c", "print('Executed')"],
    )

    assert report.task_id == "task-cvr"
    assert report.agent_claim.claimed_success is True
    assert "evidence_summary" in report.model_dump()
    assert report.evidence_summary["total_evidence_items"] >= 1
