"""API endpoints for empirical evidence collection and Claim vs Reality verification."""

import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.models.verification import VerificationRecord
from backend.app.schemas.core import (
    Task,
    ExecutionClaim,
    EvidenceItem,
    ClaimVsRealityReport,
    EvidenceCollectionRequest,
)
from backend.app.services.evidence_collector import EvidenceCollector
from backend.app.services.verification_engine import DeterministicVerificationEngine

logger = logging.getLogger("vikasa.api.evidence")

router = APIRouter()
collector = EvidenceCollector()
engine = DeterministicVerificationEngine()


class VerifyClaimVsRealityRequest(BaseModel):
    task: Task
    claim: ExecutionClaim


class VerifyRepoRequest(BaseModel):
    repo_path: str
    task: Task
    claim: ExecutionClaim
    test_command: Optional[List[str]] = None
    timeout_seconds: Optional[float] = 30.0


@router.post(
    "/claim-vs-reality",
    response_model=ClaimVsRealityReport,
    status_code=status.HTTP_200_OK,
    summary="Generate Claim vs Reality verification report",
    description="Evaluates an agent's claim against the deterministic verification engine and returns explicit discrepancies.",
)
def evaluate_claim_vs_reality(
    payload: VerifyClaimVsRealityRequest,
    db: Session = Depends(get_db),
) -> ClaimVsRealityReport:
    """Evaluate task and claim and return detailed Claim vs Reality comparison."""
    verification_result = engine.evaluate(payload.task, payload.claim)
    report = engine.generate_claim_vs_reality_report(payload.task, payload.claim, verification_result)

    # Persist verification audit record if task is tracked
    try:
        record = VerificationRecord(
            task_id=payload.task.id,
            agent_name=payload.claim.agent_name,
            claimed_success=payload.claim.claimed_success,
            claim_statement=payload.claim.statement,
            verdict=report.verdict.value,
            confidence_score=report.verification_result.confidence_score,
            discrepancies=json.dumps(report.discrepancies),
            raw_evidence_count=len(payload.claim.evidence_list),
        )
        db.add(record)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.debug("Skipped database persistence of ephemeral verification record: %s", exc)

    return report


@router.post(
    "/collect",
    response_model=List[EvidenceItem],
    status_code=status.HTTP_200_OK,
    summary="Collect empirical Git and command evidence",
    description="Captures Git status, diff, and executes whitelisted test commands with timeouts.",
)
def collect_evidence(
    payload: EvidenceCollectionRequest,
) -> List[EvidenceItem]:
    """Collect real git and execution evidence from a local repository."""
    items: List[EvidenceItem] = []

    # 1. Collect git evidence
    git_evidence = collector.collect_git_evidence(
        repo_path=payload.repo_path,
        criterion_id=payload.criterion_id,
        timeout_seconds=payload.timeout_seconds or 15.0,
    )
    items.extend(git_evidence)

    # 2. Execute test command if provided
    if payload.test_command:
        cmd_evidence = collector.execute_test_command(
            command=payload.test_command,
            cwd=payload.repo_path,
            criterion_id=payload.criterion_id,
            timeout_seconds=payload.timeout_seconds or 30.0,
        )
        items.append(cmd_evidence)

    return items


@router.post(
    "/verify-repo",
    response_model=ClaimVsRealityReport,
    status_code=status.HTTP_200_OK,
    summary="Collect repository evidence and verify claim",
    description="Gathers live Git diffs and executes test commands, then evaluates the claim against reality.",
)
def verify_repository_claim(
    payload: VerifyRepoRequest,
    db: Session = Depends(get_db),
) -> ClaimVsRealityReport:
    """Capture live evidence from a repository and evaluate Claim vs Reality."""
    report = collector.collect_and_verify(
        task=payload.task,
        claim=payload.claim,
        repo_path=payload.repo_path,
        test_command=payload.test_command,
        timeout_seconds=payload.timeout_seconds or 30.0,
    )
    return report
