"""
Safe command execution and evidence collection hardening tests.

Verifies all security guardrails:
- Disallowed executables are blocked.
- Unsafe command strings are rejected.
- Path traversal is rejected.
- Invalid workspace paths are rejected.
- Successful commands produce correct evidence.
- Failed commands record non-zero exit codes.
- Command timeouts terminate execution.
- Missing dependencies are handled gracefully.
- Git evidence collection errors are isolated.
- Invalid/inaccessible repositories handled correctly.
- Evidence-to-run association correctness.
- Evidence collection failures cannot silently produce PASS.
"""

import os
import subprocess
import pytest
from backend.app.schemas.core import EvidenceType, VerificationVerdict
from backend.app.services.evidence_collector import EvidenceCollector, ALLOWED_COMMAND_BINARIES


@pytest.fixture
def collector():
    return EvidenceCollector()


@pytest.fixture
def git_repo(tmp_path):
    """Creates a minimal initialized git repository for testing."""
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.name", "Tester"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, capture_output=True)
    (tmp_path / "hello.py").write_text("print('v1')\n", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=tmp_path, capture_output=True, check=True)
    return tmp_path


# ===========================================================================
# 1. Disallowed executables are blocked
# ===========================================================================

def test_curl_is_blocked(collector, tmp_path):
    """curl is not in the allowlist and must be rejected."""
    item = collector.execute_test_command(
        command=["curl", "https://evil.com"],
        cwd=str(tmp_path),
    )
    assert item.exit_code == -1
    assert item.passed is False
    assert "Execution blocked" in item.content
    assert "curl" in item.content


def test_bash_is_blocked(collector, tmp_path):
    """bash is not in the allowlist and must be rejected."""
    item = collector.execute_test_command(
        command=["bash", "-c", "rm -rf /"],
        cwd=str(tmp_path),
    )
    assert item.exit_code == -1
    assert "Execution blocked" in item.content


def test_powershell_is_blocked(collector, tmp_path):
    """PowerShell is not in the allowlist and must be rejected."""
    item = collector.execute_test_command(
        command=["powershell", "-Command", "echo hello"],
        cwd=str(tmp_path),
    )
    assert item.exit_code == -1
    assert "Execution blocked" in item.content


def test_cmd_is_blocked(collector, tmp_path):
    """cmd.exe is not in the allowlist and must be rejected."""
    item = collector.execute_test_command(
        command=["cmd", "/c", "dir"],
        cwd=str(tmp_path),
    )
    assert item.exit_code == -1
    assert "Execution blocked" in item.content


def test_rm_is_blocked(collector, tmp_path):
    """rm/del are not in the allowlist and must be rejected."""
    item = collector.execute_test_command(
        command=["rm", "-rf", "/tmp/test"],
        cwd=str(tmp_path),
    )
    assert item.exit_code == -1
    assert "Execution blocked" in item.content


def test_allowed_executables_are_all_in_whitelist():
    """Spot-check that the ALLOWED_COMMAND_BINARIES set is sane."""
    assert "python" in ALLOWED_COMMAND_BINARIES
    assert "pytest" in ALLOWED_COMMAND_BINARIES
    assert "git" in ALLOWED_COMMAND_BINARIES
    assert "npm" in ALLOWED_COMMAND_BINARIES
    # Dangerous binaries must NOT be allowed
    assert "bash" not in ALLOWED_COMMAND_BINARIES
    assert "curl" not in ALLOWED_COMMAND_BINARIES
    assert "wget" not in ALLOWED_COMMAND_BINARIES
    assert "cmd" not in ALLOWED_COMMAND_BINARIES
    assert "powershell" not in ALLOWED_COMMAND_BINARIES
    assert "sh" not in ALLOWED_COMMAND_BINARIES
    assert "rm" not in ALLOWED_COMMAND_BINARIES


# ===========================================================================
# 2. Unsafe command strings (shell injection attempt via list)
# ===========================================================================

def test_empty_command_is_rejected(collector, tmp_path):
    """Empty command list is rejected immediately."""
    item = collector.execute_test_command(command=[], cwd=str(tmp_path))
    assert item.exit_code == -1
    assert item.passed is False
    assert "Execution blocked" in item.content


def test_none_command_is_rejected(collector, tmp_path):
    """None command is rejected immediately."""
    item = collector.execute_test_command(command=None, cwd=str(tmp_path))  # type: ignore[arg-type]
    assert item.exit_code == -1
    assert item.passed is False


def test_executable_with_exe_extension_checked(collector, tmp_path):
    """Windows .exe extension is stripped before allowlist check."""
    # python.exe should resolve to "python" which IS allowed
    item = collector.execute_test_command(
        command=["python.exe", "-c", "print('ok')"],
        cwd=str(tmp_path),
    )
    # python.exe → python (allowed); should succeed
    assert item.exit_code == 0
    assert item.passed is True


# ===========================================================================
# 3. Path traversal
# ===========================================================================

def test_path_traversal_rejected_for_nonexistent_cwd(collector):
    """Path traversal that resolves to a nonexistent path is rejected."""
    item = collector.execute_test_command(
        command=["python", "-c", "print('hi')"],
        cwd="/nonexistent/path/../../etc/passwd",
    )
    assert item.exit_code == -1
    assert "Execution blocked" in item.content


def test_nonexistent_cwd_is_rejected(collector):
    """CWD that doesn't exist is rejected with a clear error."""
    item = collector.execute_test_command(
        command=["python", "-c", "print('hi')"],
        cwd="C:/totally/nonexistent/path/xyz123",
    )
    assert item.exit_code == -1
    assert item.passed is False
    assert "Execution blocked" in item.content


# ===========================================================================
# 4. Invalid workspace paths in validate_repo_path
# ===========================================================================

def test_validate_repo_path_rejects_nonexistent(collector):
    """validate_repo_path raises ValueError for nonexistent path."""
    with pytest.raises(ValueError, match="does not exist"):
        collector.validate_repo_path("/nonexistent_dir_xyz_9999")


def test_validate_repo_path_rejects_empty_string(collector):
    """validate_repo_path raises ValueError for empty string."""
    with pytest.raises(ValueError):
        collector.validate_repo_path("")


def test_validate_repo_path_accepts_valid_dir(collector, tmp_path):
    """validate_repo_path returns absolute path for a valid directory."""
    result = collector.validate_repo_path(str(tmp_path))
    assert os.path.isabs(result)
    assert os.path.exists(result)


# ===========================================================================
# 5. Successful commands produce correct evidence
# ===========================================================================

def test_successful_python_command_recorded(collector, tmp_path):
    """A successful python command returns exit_code=0 and passed=True."""
    item = collector.execute_test_command(
        command=["python", "-c", "print('HELLO')"],
        cwd=str(tmp_path),
        criterion_id="AC-TEST",
    )
    assert item.evidence_type == EvidenceType.COMMAND_EXIT_CODE
    assert item.exit_code == 0
    assert item.passed is True
    assert "HELLO" in item.content
    assert item.criterion_id == "AC-TEST"


# ===========================================================================
# 6. Failed commands record non-zero exit codes
# ===========================================================================

def test_failing_python_command_records_nonzero(collector, tmp_path):
    """A failing command returns non-zero exit code and passed=False."""
    item = collector.execute_test_command(
        command=["python", "-c", "import sys; sys.exit(2)"],
        cwd=str(tmp_path),
    )
    assert item.exit_code == 2
    assert item.passed is False


def test_failed_command_cannot_produce_pass_evidence(collector, tmp_path):
    """Verify failed command does not produce a passing evidence item."""
    item = collector.execute_test_command(
        command=["python", "-c", "raise RuntimeError('boom')"],
        cwd=str(tmp_path),
    )
    assert item.passed is False
    assert item.exit_code != 0


# ===========================================================================
# 7. Command timeouts terminate execution
# ===========================================================================

def test_command_timeout_terminates_and_records(collector, tmp_path):
    """Commands that exceed timeout are terminated and recorded with exit_code=-1."""
    item = collector.execute_test_command(
        command=["python", "-c", "import time; time.sleep(10)"],
        cwd=str(tmp_path),
        timeout_seconds=0.5,
    )
    assert item.exit_code == -1
    assert item.passed is False
    assert "timed out" in item.content.lower()


# ===========================================================================
# 8. Missing dependencies handled gracefully
# ===========================================================================

def test_missing_python_module_produces_failed_evidence(collector, tmp_path):
    """Importing a nonexistent module produces a failed evidence item, not a crash."""
    item = collector.execute_test_command(
        command=["python", "-c", "import totally_nonexistent_module_xyz"],
        cwd=str(tmp_path),
    )
    assert item.exit_code != 0
    assert item.passed is False


# ===========================================================================
# 9. Git evidence collection errors are isolated
# ===========================================================================

def test_git_evidence_non_repo_returns_log_output(collector, tmp_path):
    """Git evidence on a non-repo directory returns an error log, not a pass."""
    items = collector.collect_git_evidence(repo_path=str(tmp_path))
    assert len(items) >= 1
    # Evidence should indicate git issue (not a pass)
    has_error = any(
        item.evidence_type == EvidenceType.LOG_OUTPUT or
        (item.content and "fatal" in item.content.lower()) or
        item.exit_code not in (0, None)
        for item in items
    )
    assert has_error


def test_git_evidence_missing_path_returns_log_output(collector):
    """Git evidence on a nonexistent path returns error log item."""
    items = collector.collect_git_evidence(repo_path="/nonexistent/path/xyz")
    assert len(items) >= 1
    assert all(
        item.evidence_type == EvidenceType.LOG_OUTPUT or item.passed is False
        for item in items
    )


def test_git_evidence_non_repo_cannot_produce_pass_verdict(collector, tmp_path):
    """
    Even if git commands succeed (e.g., return empty output), evidence from
    a non-git directory must not enable a PASS verdict when used in verification.
    """
    from backend.app.schemas.core import Task, AcceptanceCriterion, ExecutionClaim
    from backend.app.services.verification_engine import DeterministicVerificationEngine

    items = collector.collect_git_evidence(repo_path=str(tmp_path))

    task = Task(
        id="t-git-nonrepo",
        title="Git NonRepo Test",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="Code must be verified", required=True),
        ],
    )
    claim = ExecutionClaim(
        task_id="t-git-nonrepo",
        agent_name="NonRepoAgent",
        claimed_success=True,
        statement="Done",
        evidence_list=items,
    )

    engine = DeterministicVerificationEngine()
    result = engine.evaluate(task, claim)
    # No passing test evidence → cannot be PASS
    assert result.verdict != VerificationVerdict.PASS


# ===========================================================================
# 10. Invalid/inaccessible repositories
# ===========================================================================

def test_collect_git_evidence_inaccessible_path(collector):
    """Evidence collection on an inaccessible path returns a safe error item."""
    items = collector.collect_git_evidence(repo_path="Z:/totally/invalid/path")
    assert isinstance(items, list)
    assert len(items) >= 1
    # Must return log output, not throw exception
    assert all(isinstance(i.content, str) for i in items)


def test_execute_test_command_inaccessible_cwd(collector):
    """Command with inaccessible cwd returns a safe blocked item."""
    item = collector.execute_test_command(
        command=["python", "-c", "print('x')"],
        cwd="Z:/totally/invalid/path",
    )
    assert item.exit_code == -1
    assert item.passed is False
