"""
SQLite Database Repository for VIKASA.
Manages persistent tasks, plans, execution runs, evidence items,
verifications, failure diagnoses, and timeline events.
"""

import sqlite3
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from contextlib import contextmanager

from backend.app.config import settings
from backend.app.schemas.core import (
    Task,
    TaskState,
    AcceptanceCriterion,
    TaskPlan,
    PlanStep,
    MappedCriterion,
    EvidenceItem,
    EvidenceType,
    ExecutionRun,
    ExecutionEvent,
    VerificationResult,
    VerificationVerdict,
    RuleEvaluation,
    FailureDiagnosis,
    GeneratorStatus,
)

logger = logging.getLogger(__name__)

class DatabaseRepository:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.sqlite_db_path
        self.init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def init_db(self):
        """
        Creates all required tables and indexes safely if they do not exist.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.executescript("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT DEFAULT 'default',
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                state TEXT NOT NULL,
                status TEXT DEFAULT 'PLANNED',
                acceptance_criteria TEXT NOT NULL,
                workspace_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                approved_at TEXT
            );


            CREATE TABLE IF NOT EXISTS plans (
                task_id TEXT PRIMARY KEY,
                model_name TEXT NOT NULL,
                generator_status TEXT NOT NULL,
                task_summary TEXT NOT NULL,
                steps TEXT NOT NULL,
                acceptance_criteria TEXT NOT NULL,
                files_to_inspect TEXT NOT NULL,
                tests_to_run TEXT NOT NULL,
                risks TEXT NOT NULL,
                verification_strategy TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id)
            );

            CREATE TABLE IF NOT EXISTS execution_runs (
                run_id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                status TEXT NOT NULL,
                command TEXT NOT NULL,
                exit_code INTEGER,
                stdout TEXT,
                stderr TEXT,
                source TEXT NOT NULL,
                git_diff TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id)
            );

            CREATE TABLE IF NOT EXISTS evidence_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                run_id TEXT,
                criterion_id TEXT,
                evidence_type TEXT NOT NULL,
                content TEXT NOT NULL,
                exit_code INTEGER,
                file_path TEXT,
                passed INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id)
            );

            CREATE TABLE IF NOT EXISTS verifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                run_id TEXT,
                verdict TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                rule_evaluations TEXT NOT NULL,
                summary TEXT NOT NULL,
                verified_at TEXT NOT NULL,
                raw_evidence_count INTEGER NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id)
            );

            CREATE TABLE IF NOT EXISTS diagnoses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                run_id TEXT,
                verdict TEXT NOT NULL,
                generator_status TEXT NOT NULL,
                failure_summary TEXT NOT NULL,
                likely_causes TEXT NOT NULL,
                evidence_references TEXT NOT NULL,
                recommended_fixes TEXT NOT NULL,
                suggested_retests TEXT NOT NULL,
                confidence REAL NOT NULL,
                insufficient_evidence INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id)
            );

            CREATE TABLE IF NOT EXISTS execution_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                run_id TEXT,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT,
                FOREIGN KEY (task_id) REFERENCES tasks (id)
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
            CREATE INDEX IF NOT EXISTS idx_runs_task ON execution_runs (task_id);
            CREATE INDEX IF NOT EXISTS idx_evidence_task ON evidence_records (task_id);
            CREATE INDEX IF NOT EXISTS idx_verifications_task ON verifications (task_id);
            CREATE INDEX IF NOT EXISTS idx_events_task ON execution_events (task_id);
            """)

            try:
                cursor.execute("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'PLANNED'")
            except Exception:
                pass

    def save_task(self, task: Task) -> Task:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            criteria_json = json.dumps([c.model_dump() for c in task.acceptance_criteria])
            status_val = task.status or ("PLANNED" if task.state.value in ("CREATED", "PLANNED", "APPROVED") else task.state.value)
            cursor.execute(
                """
                INSERT INTO tasks (id, project_id, title, description, state, status, acceptance_criteria, workspace_path, created_at, updated_at, approved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    project_id=excluded.project_id,
                    title=excluded.title,
                    description=excluded.description,
                    state=excluded.state,
                    status=excluded.status,
                    acceptance_criteria=excluded.acceptance_criteria,
                    workspace_path=excluded.workspace_path,
                    created_at=excluded.created_at,
                    updated_at=excluded.updated_at,
                    approved_at=excluded.approved_at
                """,
                (
                    task.id,
                    task.project_id,
                    task.title,
                    task.description,
                    task.state.value if isinstance(task.state, TaskState) else str(task.state),
                    status_val,
                    criteria_json,
                    task.workspace_path,
                    task.created_at.isoformat(),
                    task.updated_at.isoformat(),
                    task.approved_at.isoformat() if task.approved_at else None,
                ),
            )
        return task

    def _parse_criteria(self, raw: Any) -> List[AcceptanceCriterion]:
        if not raw:
            return []
        if isinstance(raw, list):
            return [c if isinstance(c, AcceptanceCriterion) else AcceptanceCriterion(**c) for c in raw]
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [AcceptanceCriterion(**c) for c in parsed]
            return [AcceptanceCriterion(id="AC-1", description=str(parsed))]
        except Exception:
            return [AcceptanceCriterion(id="AC-1", description=str(raw))]

    def get_task(self, task_id: str) -> Optional[Task]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
            row = cursor.fetchone()
            if not row:
                return None
            criteria = self._parse_criteria(row["acceptance_criteria"])
            status_val = row["status"] if "status" in row.keys() and row["status"] else None
            return Task(
                id=row["id"],
                project_id=row["project_id"],
                title=row["title"],
                description=row["description"],
                state=TaskState(row["state"]),
                status=status_val,
                acceptance_criteria=criteria,
                workspace_path=row["workspace_path"],
                created_at=datetime.fromisoformat(row["created_at"]),
                updated_at=datetime.fromisoformat(row["updated_at"]),
                approved_at=datetime.fromisoformat(row["approved_at"]) if row["approved_at"] else None,
            )

    def list_tasks(
        self,
        project_id: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Task]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM tasks"
            params: List[Any] = []
            if project_id:
                query += " WHERE project_id = ?"
                params.append(project_id)
            query += " ORDER BY created_at DESC, id DESC"
            if limit is not None:
                query += " LIMIT ? OFFSET ?"
                params.extend([limit, offset])

            cursor.execute(query, tuple(params))
            tasks = []
            for row in cursor.fetchall():
                criteria = self._parse_criteria(row["acceptance_criteria"])
                status_val = row["status"] if "status" in row.keys() and row["status"] else None
                tasks.append(
                    Task(
                        id=row["id"],
                        project_id=row["project_id"],
                        title=row["title"],
                        description=row["description"],
                        state=TaskState(row["state"]),
                        status=status_val,
                        acceptance_criteria=criteria,
                        workspace_path=row["workspace_path"],
                        created_at=datetime.fromisoformat(row["created_at"]),
                        updated_at=datetime.fromisoformat(row["updated_at"]),
                        approved_at=datetime.fromisoformat(row["approved_at"]) if row["approved_at"] else None,
                    )
                )
            return tasks


    def update_task_state(self, task_id: str, state: TaskState, approved_at: Optional[datetime] = None) -> Optional[Task]:
        task = self.get_task(task_id)
        if not task:
            return None
        task.state = state
        task.updated_at = datetime.now(timezone.utc)
        if approved_at is not None:
            task.approved_at = approved_at
        return self.save_task(task)

    def save_plan(self, plan: TaskPlan):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO plans (
                    task_id, model_name, generator_status, task_summary, steps,
                    acceptance_criteria, files_to_inspect, tests_to_run, risks,
                    verification_strategy, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_id) DO UPDATE SET
                    model_name=excluded.model_name,
                    generator_status=excluded.generator_status,
                    task_summary=excluded.task_summary,
                    steps=excluded.steps,
                    acceptance_criteria=excluded.acceptance_criteria,
                    files_to_inspect=excluded.files_to_inspect,
                    tests_to_run=excluded.tests_to_run,
                    risks=excluded.risks,
                    verification_strategy=excluded.verification_strategy,
                    created_at=excluded.created_at
                """,
                (
                    plan.task_id,
                    plan.model_name,
                    plan.generator_status.value if isinstance(plan.generator_status, GeneratorStatus) else str(plan.generator_status),
                    plan.task_summary,
                    json.dumps([s.model_dump() for s in plan.steps]),
                    json.dumps([c.model_dump() for c in plan.acceptance_criteria]),
                    json.dumps(plan.files_to_inspect),
                    json.dumps(plan.tests_to_run),
                    json.dumps(plan.risks),
                    plan.verification_strategy,
                    plan.created_at.isoformat(),
                ),
            )

    def get_plan(self, task_id: str) -> Optional[TaskPlan]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM plans WHERE task_id = ?", (task_id,))
            row = cursor.fetchone()
            if not row:
                return None
            steps = [PlanStep(**s) for s in json.loads(row["steps"])]
            criteria = [MappedCriterion(**c) for c in json.loads(row["acceptance_criteria"])]
            return TaskPlan(
                task_id=row["task_id"],
                model_name=row["model_name"],
                generator_status=GeneratorStatus(row["generator_status"]),
                task_summary=row["task_summary"],
                steps=steps,
                acceptance_criteria=criteria,
                files_to_inspect=json.loads(row["files_to_inspect"]),
                tests_to_run=json.loads(row["tests_to_run"]),
                risks=json.loads(row["risks"]),
                verification_strategy=row["verification_strategy"],
                created_at=datetime.fromisoformat(row["created_at"]),
            )

    def save_execution_run(self, run: ExecutionRun):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO execution_runs (
                    run_id, task_id, started_at, completed_at, status, command,
                    exit_code, stdout, stderr, source, git_diff, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    completed_at=excluded.completed_at,
                    status=excluded.status,
                    exit_code=excluded.exit_code,
                    stdout=excluded.stdout,
                    stderr=excluded.stderr,
                    git_diff=excluded.git_diff
                """,
                (
                    run.run_id,
                    run.task_id,
                    run.started_at.isoformat(),
                    run.completed_at.isoformat() if run.completed_at else None,
                    run.status,
                    run.command,
                    run.exit_code,
                    run.stdout,
                    run.stderr,
                    run.source,
                    run.git_diff,
                    run.started_at.isoformat(),
                ),
            )
            # Insert evidence directly using the active cursor to avoid connection deadlocks
            for ev in run.evidence_items:
                cursor.execute(
                    """
                    INSERT INTO evidence_records (
                        task_id, run_id, criterion_id, evidence_type, content,
                        exit_code, file_path, passed, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run.task_id,
                        run.run_id,
                        ev.criterion_id,
                        ev.evidence_type.value if isinstance(ev.evidence_type, EvidenceType) else str(ev.evidence_type),
                        ev.content,
                        ev.exit_code,
                        ev.file_path,
                        1 if ev.passed else (0 if ev.passed is False else None),
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )

    def get_execution_run(self, run_id: str) -> Optional[ExecutionRun]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM execution_runs WHERE run_id = ?", (run_id,))
            row = cursor.fetchone()
            if not row:
                return None
            
            # Query evidence directly on the active cursor
            cursor.execute(
                "SELECT * FROM evidence_records WHERE task_id = ? AND run_id = ? ORDER BY id ASC",
                (row["task_id"], run_id),
            )
            evidence = []
            for ev_row in cursor.fetchall():
                passed_val = True if ev_row["passed"] == 1 else (False if ev_row["passed"] == 0 else None)
                evidence.append(
                    EvidenceItem(
                        criterion_id=ev_row["criterion_id"],
                        evidence_type=EvidenceType(ev_row["evidence_type"]),
                        content=ev_row["content"],
                        exit_code=ev_row["exit_code"],
                        file_path=ev_row["file_path"],
                        passed=passed_val,
                    )
                )

            return ExecutionRun(
                run_id=row["run_id"],
                task_id=row["task_id"],
                started_at=datetime.fromisoformat(row["started_at"]),
                completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
                status=row["status"],
                command=row["command"],
                exit_code=row["exit_code"],
                stdout=row["stdout"] or "",
                stderr=row["stderr"] or "",
                source=row["source"],
                git_diff=row["git_diff"],
                evidence_items=evidence,
            )

    def get_latest_execution_run(self, task_id: str) -> Optional[ExecutionRun]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT run_id FROM execution_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 1",
                (task_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            run_id = row["run_id"]
        return self.get_execution_run(run_id)

    def list_execution_runs(self, task_id: str) -> List[ExecutionRun]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT run_id FROM execution_runs WHERE task_id = ? ORDER BY started_at ASC",
                (task_id,),
            )
            run_ids = [row["run_id"] for row in cursor.fetchall()]
        
        runs = []
        for rid in run_ids:
            r = self.get_execution_run(rid)
            if r:
                runs.append(r)
        return runs

    def save_evidence_item(self, task_id: str, run_id: Optional[str], evidence: EvidenceItem):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO evidence_records (
                    task_id, run_id, criterion_id, evidence_type, content,
                    exit_code, file_path, passed, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    run_id,
                    evidence.criterion_id,
                    evidence.evidence_type.value if isinstance(evidence.evidence_type, EvidenceType) else str(evidence.evidence_type),
                    evidence.content,
                    evidence.exit_code,
                    evidence.file_path,
                    1 if evidence.passed else (0 if evidence.passed is False else None),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

    def list_evidence(self, task_id: str, run_id: Optional[str] = None) -> List[EvidenceItem]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if run_id:
                cursor.execute(
                    "SELECT * FROM evidence_records WHERE task_id = ? AND run_id = ? ORDER BY id ASC",
                    (task_id, run_id),
                )
            else:
                cursor.execute(
                    "SELECT * FROM evidence_records WHERE task_id = ? ORDER BY id ASC",
                    (task_id,),
                )
            items = []
            for row in cursor.fetchall():
                passed_val = True if row["passed"] == 1 else (False if row["passed"] == 0 else None)
                items.append(
                    EvidenceItem(
                        criterion_id=row["criterion_id"],
                        evidence_type=EvidenceType(row["evidence_type"]),
                        content=row["content"],
                        exit_code=row["exit_code"],
                        file_path=row["file_path"],
                        passed=passed_val,
                    )
                )
            return items

    def save_verification(self, verification: VerificationResult, run_id: Optional[str] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            evaluations_json = json.dumps([r.model_dump() for r in verification.rule_evaluations])
            cursor.execute(
                """
                INSERT INTO verifications (
                    task_id, run_id, verdict, confidence_score, rule_evaluations,
                    summary, verified_at, raw_evidence_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    verification.task_id,
                    run_id or verification.run_id,
                    verification.verdict.value if isinstance(verification.verdict, VerificationVerdict) else str(verification.verdict),
                    verification.confidence_score,
                    evaluations_json,
                    verification.summary,
                    verification.verified_at.isoformat(),
                    verification.raw_evidence_count,
                ),
            )

    def get_latest_verification(self, task_id: str) -> Optional[VerificationResult]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM verifications WHERE task_id = ? ORDER BY id DESC LIMIT 1",
                (task_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            evaluations = [RuleEvaluation(**r) for r in json.loads(row["rule_evaluations"])]
            return VerificationResult(
                task_id=row["task_id"],
                verdict=VerificationVerdict(row["verdict"]),
                confidence_score=row["confidence_score"],
                rule_evaluations=evaluations,
                summary=row["summary"],
                verified_at=datetime.fromisoformat(row["verified_at"]),
                raw_evidence_count=row["raw_evidence_count"],
                run_id=row["run_id"],
            )

    def list_verifications(self, task_id: str) -> List[VerificationResult]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM verifications WHERE task_id = ? ORDER BY id ASC",
                (task_id,),
            )
            results = []
            for row in cursor.fetchall():
                evaluations = [RuleEvaluation(**r) for r in json.loads(row["rule_evaluations"])]
                results.append(
                    VerificationResult(
                        task_id=row["task_id"],
                        verdict=VerificationVerdict(row["verdict"]),
                        confidence_score=row["confidence_score"],
                        rule_evaluations=evaluations,
                        summary=row["summary"],
                        verified_at=datetime.fromisoformat(row["verified_at"]),
                        raw_evidence_count=row["raw_evidence_count"],
                        run_id=row["run_id"],
                    )
                )
            return results

    def save_diagnosis(self, diagnosis: FailureDiagnosis):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO diagnoses (
                    task_id, run_id, verdict, generator_status, failure_summary,
                    likely_causes, evidence_references, recommended_fixes,
                    suggested_retests, confidence, insufficient_evidence, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    diagnosis.task_id,
                    diagnosis.run_id,
                    diagnosis.verdict.value if isinstance(diagnosis.verdict, VerificationVerdict) else str(diagnosis.verdict),
                    diagnosis.generator_status.value if isinstance(diagnosis.generator_status, GeneratorStatus) else str(diagnosis.generator_status),
                    diagnosis.failure_summary,
                    json.dumps(diagnosis.likely_causes),
                    json.dumps(diagnosis.evidence_references),
                    json.dumps(diagnosis.recommended_fixes),
                    json.dumps(diagnosis.suggested_retests),
                    diagnosis.confidence,
                    1 if diagnosis.insufficient_evidence else 0,
                    diagnosis.created_at.isoformat(),
                ),
            )

    def get_latest_diagnosis(self, task_id: str) -> Optional[FailureDiagnosis]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM diagnoses WHERE task_id = ? ORDER BY id DESC LIMIT 1",
                (task_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return FailureDiagnosis(
                task_id=row["task_id"],
                verdict=VerificationVerdict(row["verdict"]),
                generator_status=GeneratorStatus(row["generator_status"]),
                failure_summary=row["failure_summary"],
                likely_causes=json.loads(row["likely_causes"]),
                evidence_references=json.loads(row["evidence_references"]),
                recommended_fixes=json.loads(row["recommended_fixes"]),
                suggested_retests=json.loads(row["suggested_retests"]),
                confidence=row["confidence"],
                insufficient_evidence=bool(row["insufficient_evidence"]),
                run_id=row["run_id"],
                created_at=datetime.fromisoformat(row["created_at"]),
            )

    def record_event(self, event: ExecutionEvent):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO execution_events (
                    task_id, run_id, timestamp, event_type, message, details
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    event.task_id,
                    event.run_id,
                    event.timestamp.isoformat(),
                    event.event_type,
                    event.message,
                    json.dumps(event.details),
                ),
            )

    def list_events(self, task_id: str) -> List[ExecutionEvent]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM execution_events WHERE task_id = ? ORDER BY id ASC",
                (task_id,),
            )
            events = []
            for row in cursor.fetchall():
                events.append(
                    ExecutionEvent(
                        id=row["id"],
                        task_id=row["task_id"],
                        run_id=row["run_id"],
                        timestamp=datetime.fromisoformat(row["timestamp"]),
                        event_type=row["event_type"],
                        message=row["message"],
                        details=json.loads(row["details"]) if row["details"] else {},
                    )
                )
            return events
