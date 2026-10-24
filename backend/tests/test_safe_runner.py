import pytest
import os
import tempfile

from backend.app.services.safe_runner import SafeExecutionRunner

@pytest.fixture
def temp_workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

def test_safe_runner_executes_allowlisted_python(temp_workspace):
    runner = SafeExecutionRunner(default_workspace=temp_workspace)
    run = runner.execute_command(
        task_id="t-safe-1",
        command="python -c \"print('EXECUTION_VERIFIED')\"",
        workspace_path=temp_workspace,
        timeout_seconds=5.0,
    )
    assert run.status == "COMPLETED"
    assert run.exit_code == 0
    assert "EXECUTION_VERIFIED" in run.stdout
    assert len(run.evidence_items) >= 2

def test_safe_runner_rejects_unallowlisted_binary(temp_workspace):
    runner = SafeExecutionRunner(default_workspace=temp_workspace)
    with pytest.raises(ValueError, match="is not permitted"):
        runner.execute_command(
            task_id="t-safe-2",
            command="curl http://example.com",
            workspace_path=temp_workspace,
        )

def test_safe_runner_rejects_shell_metacharacters(temp_workspace):
    runner = SafeExecutionRunner(default_workspace=temp_workspace)
    dangerous_commands = [
        "python -c 'print(1)' ; rm -rf /",
        "python -c 'print(1)' && echo 'hacked'",
        "python -c 'print(1)' | grep 1",
        "python -c 'print(1)' > output.txt",
        "python -c 'print(1)' `echo hack`",
        "python -c 'print(1)' $(whoami)",
    ]
    for cmd in dangerous_commands:
        with pytest.raises(ValueError, match="Forbidden shell metacharacter"):
            runner.execute_command(
                task_id="t-safe-3",
                command=cmd,
                workspace_path=temp_workspace,
            )

def test_safe_runner_rejects_invalid_workspace():
    runner = SafeExecutionRunner()
    with pytest.raises(ValueError, match="does not exist"):
        runner.execute_command(
            task_id="t-safe-4",
            command="python -c 'print(1)'",
            workspace_path="Z:/nonexistent/path/for/vikasa",
        )

def test_safe_runner_enforces_execution_timeout(temp_workspace):
    runner = SafeExecutionRunner(default_workspace=temp_workspace)
    # Command that sleeps for 5 seconds with a 0.5s timeout
    run = runner.execute_command(
        task_id="t-safe-5",
        command="python -c \"import time; time.sleep(5)\"",
        workspace_path=temp_workspace,
        timeout_seconds=0.5,
    )
    assert run.status == "TIMEOUT"
    assert run.exit_code == -1
    assert "timed out" in run.stderr.lower()
