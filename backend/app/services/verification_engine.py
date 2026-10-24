"""
Deterministic Verification Engine for VIKASA.

CRITICAL INVARIANT:
An AI model or agent must never decide that a task is verified merely by claiming success.
Only this deterministic verification engine may issue the final verification verdict
according to explicit rules, recorded evidence, exit codes, and repository diffs.
"""

from typing import List, Optional
from backend.app.schemas.core import (
    Task,
    ExecutionClaim,
    EvidenceItem,
    EvidenceType,
    VerificationResult,
    VerificationVerdict,
    RuleEvaluation,
)

class DeterministicVerificationEngine:
    """
    Evaluates execution claims against tasks using rule-based deterministic checks.
    """

    def evaluate(self, task: Task, claim: ExecutionClaim) -> VerificationResult:
        evaluations: List[RuleEvaluation] = []
        evidence_by_criterion = {}
        for ev in claim.evidence_list:
            if ev.criterion_id:
                evidence_by_criterion.setdefault(ev.criterion_id, []).append(ev)

        # Rule 1: No Unsubstantiated Claims
        # If agent claims success without any evidence, immediately fail.
        if claim.claimed_success and not claim.evidence_list:
            evaluations.append(RuleEvaluation(
                rule_name="UnsubstantiatedClaimCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAILED,
                message="Agent claimed success, but zero evidence items were attached."
            ))

        # Rule 2: Strict Exit Code & Test Integrity
        # Any evidence with non-zero exit code or passed==False causes immediate failure.
        failed_commands = [
            ev for ev in claim.evidence_list 
            if (ev.exit_code is not None and ev.exit_code != 0) or (ev.passed is False)
        ]
        if failed_commands:
            evaluations.append(RuleEvaluation(
                rule_name="CommandExitCodeCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAILED,
                message=f"{len(failed_commands)} command(s) or test execution(s) exited with non-zero status or failed."
            ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="CommandExitCodeCheck",
                passed=True,
                verdict_impact=VerificationVerdict.VERIFIED,
                message="All command executions and test runs reported exit code 0 / passed."
            ))

        # Rule 3: Acceptance Criteria Evidence Coverage
        # Every required acceptance criterion must have explicit passing evidence.
        missing_criteria = []
        for crit in task.acceptance_criteria:
            if crit.required:
                mapped_evidence = evidence_by_criterion.get(crit.id, [])
                passing_evidence = [e for e in mapped_evidence if e.passed is not False and (e.exit_code is None or e.exit_code == 0)]
                if not passing_evidence:
                    missing_criteria.append(crit.id)

        if missing_criteria:
            evaluations.append(RuleEvaluation(
                rule_name="AcceptanceCriteriaCoverageCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAILED,
                message=f"Missing verified evidence for required acceptance criteria: {missing_criteria}"
            ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="AcceptanceCriteriaCoverageCheck",
                passed=True,
                verdict_impact=VerificationVerdict.VERIFIED,
                message="All required acceptance criteria are substantiated by explicit evidence."
            ))

        # Rule 4: Diff Existence & Code Modification Check
        # If criteria require code changes, verify that a meaningful git diff exists.
        has_diff_evidence = any(e.evidence_type == EvidenceType.GIT_DIFF for e in claim.evidence_list) or bool(claim.git_diff and claim.git_diff.strip())
        if not has_diff_evidence and len(task.acceptance_criteria) > 0:
            evaluations.append(RuleEvaluation(
                rule_name="RepositoryDiffCheck",
                passed=False,
                verdict_impact=VerificationVerdict.REVIEW_REQUIRED,
                message="No repository diff provided. Code changes cannot be verified without recorded diff."
            ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="RepositoryDiffCheck",
                passed=True,
                verdict_impact=VerificationVerdict.VERIFIED,
                message="Repository diff evidence is present."
            ))

        # Rule 5: Conflict / Contradiction Check
        # Check if logs or test outputs contain obvious fatal errors despite claimed success.
        fatal_keywords = ["Traceback (most recent call last)", "FATAL ERROR", "AssertionError", "SyntaxError:"]
        contradictions = []
        for ev in claim.evidence_list:
            if ev.content:
                for kw in fatal_keywords:
                    if kw in ev.content and (ev.passed is True or claim.claimed_success):
                        contradictions.append(f"Found '{kw}' in evidence content while claiming success.")
                        break

        if contradictions:
            evaluations.append(RuleEvaluation(
                rule_name="ContradictionCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAILED,
                message=f"Contradictory evidence detected: {'; '.join(contradictions)}"
            ))

        # Final Verdict Aggregation
        has_failure = any(ev.verdict_impact == VerificationVerdict.FAILED for ev in evaluations)
        has_review = any(ev.verdict_impact == VerificationVerdict.REVIEW_REQUIRED for ev in evaluations)

        if has_failure:
            verdict = VerificationVerdict.FAILED
        elif has_review:
            verdict = VerificationVerdict.REVIEW_REQUIRED
        else:
            verdict = VerificationVerdict.VERIFIED

        # Deterministic confidence scoring
        total_rules = len(evaluations)
        passed_rules = sum(1 for e in evaluations if e.passed)
        confidence = round(passed_rules / total_rules, 2) if total_rules > 0 else 0.0

        summary = f"Verification {verdict.value}: {passed_rules}/{total_rules} deterministic rules satisfied."

        return VerificationResult(
            task_id=task.id,
            verdict=verdict,
            confidence_score=confidence,
            rule_evaluations=evaluations,
            summary=summary,
            raw_evidence_count=len(claim.evidence_list),
        )
