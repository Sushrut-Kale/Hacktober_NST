"""
Deterministic Verification Engine for VIKASA.

CRITICAL INVARIANT:
An AI model or agent must never decide that a task is verified merely by claiming success.
Only this deterministic verification engine may issue the final verification verdict
according to explicit rules, recorded evidence, exit codes, and repository diffs.

Verdicts:
- PASS: All required configured checks passed.
- FAIL: A required check established a failure.
- NOT_RUN: Required checks have not been executed.
- BLOCKED: An environment or dependency prevented verification.
- UNKNOWN: Evidence is insufficient to determine the outcome.
"""

from typing import List, Optional, Dict, Any
from backend.app.schemas.core import (
    Task,
    ExecutionClaim,
    EvidenceItem,
    EvidenceType,
    VerificationResult,
    VerificationVerdict,
    RuleEvaluation,
    ClaimVsRealityReport,
)


class DeterministicVerificationEngine:
    """
    Evaluates execution claims against tasks using rule-based deterministic checks.
    """

    def evaluate(self, task: Task, claim: ExecutionClaim) -> VerificationResult:
        evaluations: List[RuleEvaluation] = []
        evidence_by_criterion: Dict[str, List[EvidenceItem]] = {}
        for ev in claim.evidence_list:
            if ev.criterion_id:
                evidence_by_criterion.setdefault(ev.criterion_id, []).append(ev)

        # Rule 1: No Unsubstantiated Claims
        # If agent claims success without any evidence, immediately fail.
        # If no evidence and not claiming success, mark NOT_RUN.
        if not claim.evidence_list:
            if claim.claimed_success:
                evaluations.append(RuleEvaluation(
                    rule_name="UnsubstantiatedClaimCheck",
                    passed=False,
                    verdict_impact=VerificationVerdict.FAIL,
                    message="Agent claimed success, but zero evidence items were attached."
                ))
            else:
                evaluations.append(RuleEvaluation(
                    rule_name="UnsubstantiatedClaimCheck",
                    passed=False,
                    verdict_impact=VerificationVerdict.NOT_RUN,
                    message="No execution evidence has been recorded."
                ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="UnsubstantiatedClaimCheck",
                passed=True,
                verdict_impact=VerificationVerdict.PASS,
                message=f"{len(claim.evidence_list)} evidence item(s) attached to claim."
            ))

        # Rule 2: Environment and Dependency Block Check
        # Detect environment errors, permission denials, missing dependencies, or timeouts.
        blocking_keywords = [
            "Execution blocked:",
            "Command timed out",
            "PermissionError",
            "ConnectionRefusedError",
        ]
        blocked_items = [
            ev for ev in claim.evidence_list
            if any(bk in (ev.content or "") for bk in blocking_keywords)
        ]
        if blocked_items:
            evaluations.append(RuleEvaluation(
                rule_name="EnvironmentBlockCheck",
                passed=False,
                verdict_impact=VerificationVerdict.BLOCKED,
                message=f"Environment or dependency issue prevented verification in {len(blocked_items)} item(s)."
            ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="EnvironmentBlockCheck",
                passed=True,
                verdict_impact=VerificationVerdict.PASS,
                message="No environment or dependency blocks detected."
            ))

        # Rule 3: Strict Exit Code & Test Integrity
        # Any evidence with non-zero exit code or passed==False causes failure.
        command_evidence = [
            ev for ev in claim.evidence_list
            if ev.exit_code is not None or ev.evidence_type in (EvidenceType.COMMAND_EXIT_CODE, EvidenceType.TEST_OUTPUT)
        ]
        failed_commands = [
            ev for ev in claim.evidence_list
            if (ev.exit_code is not None and ev.exit_code != 0) or (ev.passed is False)
        ]

        if failed_commands:
            evaluations.append(RuleEvaluation(
                rule_name="CommandExitCodeCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAIL,
                message=f"{len(failed_commands)} command(s) or test execution(s) exited with non-zero status or failed."
            ))
        elif command_evidence:
            evaluations.append(RuleEvaluation(
                rule_name="CommandExitCodeCheck",
                passed=True,
                verdict_impact=VerificationVerdict.PASS,
                message="All command executions and test runs reported exit code 0 / passed."
            ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="CommandExitCodeCheck",
                passed=False,
                verdict_impact=VerificationVerdict.NOT_RUN,
                message="No command execution or test run evidence was recorded."
            ))

        # Rule 4: Acceptance Criteria Evidence Coverage
        # Every required acceptance criterion must have explicit passing evidence.
        # A missing test result must never be silently treated as a pass.
        missing_criteria = []
        unconfirmed_criteria = []
        for crit in task.acceptance_criteria:
            if crit.required:
                mapped_evidence = evidence_by_criterion.get(crit.id, [])
                if not mapped_evidence:
                    missing_criteria.append(crit.id)
                else:
                    # Check if evidence actually confirms the criterion (not merely unvalidated content)
                    has_passing = any(
                        e.passed is True or (e.exit_code == 0 and e.passed is not False)
                        for e in mapped_evidence
                    )
                    if not has_passing:
                        unconfirmed_criteria.append(crit.id)

        if missing_criteria:
            evaluations.append(RuleEvaluation(
                rule_name="AcceptanceCriteriaCoverageCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAIL,
                message=f"Missing verified evidence for required acceptance criteria: {missing_criteria}"
            ))
        elif unconfirmed_criteria:
            evaluations.append(RuleEvaluation(
                rule_name="AcceptanceCriteriaCoverageCheck",
                passed=False,
                verdict_impact=VerificationVerdict.UNKNOWN,
                message=f"Evidence submitted for criteria {unconfirmed_criteria} is inconclusive (missing test result or exit code)."
            ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="AcceptanceCriteriaCoverageCheck",
                passed=True,
                verdict_impact=VerificationVerdict.PASS,
                message="All required acceptance criteria are substantiated by explicit evidence."
            ))

        # Rule 5: Diff Existence & Code Modification Check
        # If criteria require code changes, verify that a meaningful git diff exists.
        has_diff_evidence = (
            any(e.evidence_type == EvidenceType.GIT_DIFF for e in claim.evidence_list)
            or bool(claim.git_diff and claim.git_diff.strip())
        )
        if not has_diff_evidence and len(task.acceptance_criteria) > 0:
            evaluations.append(RuleEvaluation(
                rule_name="RepositoryDiffCheck",
                passed=False,
                verdict_impact=VerificationVerdict.UNKNOWN,
                message="No repository diff provided. Code changes cannot be verified without recorded diff."
            ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="RepositoryDiffCheck",
                passed=True,
                verdict_impact=VerificationVerdict.PASS,
                message="Repository diff evidence is present."
            ))

        # Rule 6: Conflict / Contradiction Check
        # Check if logs or test outputs contain obvious fatal errors despite claimed success.
        fatal_keywords = [
            "Traceback (most recent call last)",
            "FATAL ERROR",
            "AssertionError",
            "SyntaxError:",
        ]
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
                verdict_impact=VerificationVerdict.FAIL,
                message=f"Contradictory evidence detected: {'; '.join(contradictions)}"
            ))
        else:
            evaluations.append(RuleEvaluation(
                rule_name="ContradictionCheck",
                passed=True,
                verdict_impact=VerificationVerdict.PASS,
                message="No contradictory error logs detected in evidence content."
            ))

        # Final Verdict Aggregation Hierarchy:
        # 1. BLOCKED (environment/dependency failure took place)
        # 2. FAIL (any explicit failure or violation of required criteria)
        # 3. UNKNOWN (evidence is insufficient or inconclusive)
        # 4. NOT_RUN (checks were not executed)
        # 5. PASS (all required configured checks passed)
        has_blocked = any(ev.verdict_impact == VerificationVerdict.BLOCKED for ev in evaluations)
        has_failed = any(ev.verdict_impact == VerificationVerdict.FAIL for ev in evaluations)
        has_unknown = any(ev.verdict_impact == VerificationVerdict.UNKNOWN for ev in evaluations)
        has_not_run = any(ev.verdict_impact == VerificationVerdict.NOT_RUN for ev in evaluations)

        if has_blocked:
            verdict = VerificationVerdict.BLOCKED
        elif has_failed:
            verdict = VerificationVerdict.FAIL
        elif has_unknown:
            verdict = VerificationVerdict.UNKNOWN
        elif has_not_run:
            verdict = VerificationVerdict.NOT_RUN
        else:
            verdict = VerificationVerdict.PASS


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

    def generate_claim_vs_reality_report(
        self, task: Task, claim: ExecutionClaim, result: Optional[VerificationResult] = None
    ) -> ClaimVsRealityReport:
        """
        Builds a structured Claim vs Reality report highlighting any discrepancies
        between what the agent claimed and what deterministic verification established.
        """
        if result is None:
            result = self.evaluate(task, claim)

        discrepancies: List[str] = []

        # Compare claim statement with reality
        if claim.claimed_success and result.verdict != VerificationVerdict.PASS:
            discrepancies.append(
                f"Agent claimed success, but deterministic verification verdict was '{result.verdict.value}'."
            )

        if claim.claimed_success and not claim.evidence_list:
            discrepancies.append(
                "Agent claimed completion, but zero supporting evidence items were provided."
            )

        # Check exit codes
        failed_commands = [
            e for e in claim.evidence_list
            if (e.exit_code is not None and e.exit_code != 0) or (e.passed is False)
        ]
        if failed_commands:
            for fc in failed_commands:
                discrepancies.append(
                    f"Execution item '{fc.criterion_id or 'General'}' failed with exit code {fc.exit_code}."
                )

        # Check git diff discrepancy
        has_diff = bool(claim.git_diff and claim.git_diff.strip()) or any(
            e.evidence_type == EvidenceType.GIT_DIFF for e in claim.evidence_list
        )
        if claim.claimed_success and not has_diff and len(task.acceptance_criteria) > 0:
            discrepancies.append(
                "Agent claimed task finished, but no repository diff or changed files were recorded."
            )

        # Summarize evidence
        evidence_summary = {
            "total_evidence_items": len(claim.evidence_list),
            "command_runs": sum(1 for e in claim.evidence_list if e.evidence_type == EvidenceType.COMMAND_EXIT_CODE),
            "test_runs": sum(1 for e in claim.evidence_list if e.evidence_type == EvidenceType.TEST_OUTPUT),
            "git_diff_recorded": has_diff,
            "failed_command_count": len(failed_commands),
            "rules_passed": sum(1 for r in result.rule_evaluations if r.passed),
            "rules_total": len(result.rule_evaluations),
        }

        claim_verified = (result.verdict == VerificationVerdict.PASS) and claim.claimed_success

        return ClaimVsRealityReport(
            task_id=task.id,
            original_task=task,
            agent_claim=claim,
            verification_result=result,
            verdict=result.verdict,
            claim_verified=claim_verified,
            discrepancies=discrepancies,
            evidence_summary=evidence_summary,
        )
