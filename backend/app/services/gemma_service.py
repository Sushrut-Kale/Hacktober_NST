"""
Gemma Service for VIKASA.
Integrates with local Ollama instance running gemma4:e4b.
Provides:
- Connection and readiness health checks with explicit status (AI_ACTIVE vs AI_UNAVAILABLE)
- Structured task planning with Pydantic schema validation
- Evidence-grounded failure diagnosis distinguishing facts from hypotheses
- Safe timeouts, error handling, and deterministic fallback responses
"""

import json
import logging
import re
from typing import Optional, Dict, Any, List
import httpx
from pydantic import ValidationError

from backend.app.config import settings
from backend.app.schemas.core import (
    Task,
    TaskPlan,
    PlanStep,
    MappedCriterion,
    VerificationResult,
    VerificationVerdict,
    EvidenceItem,
    FailureDiagnosis,
    GeneratorStatus,
)

logger = logging.getLogger(__name__)

class GemmaService:
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None, timeout: Optional[float] = None):
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.gemma_model
        self.timeout = timeout if timeout is not None else settings.ollama_timeout_seconds

    async def check_readiness(self) -> Dict[str, Any]:
        """
        Verifies whether Ollama is accessible and whether the required Gemma model is installed/loaded.
        Returns status AI_ACTIVE or AI_UNAVAILABLE with fine-grained readiness state.
        """
        try:
            async with httpx.AsyncClient(timeout=min(self.timeout, 10.0)) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code != 200:
                    return {
                        "status": GeneratorStatus.AI_UNAVAILABLE.value,
                        "available": False,
                        "error": f"Ollama HTTP {res.status_code}",
                        "model": self.model,
                        "model_ready": False,
                        "model_loaded": False,
                        "readiness_state": "OLLAMA_UNREACHABLE",
                        "all_models": [],
                    }
                data = res.json()
                models = [m.get("name") for m in data.get("models", [])]
                model_ready = any(self.model in name or name in self.model for name in models)

                model_loaded = False
                try:
                    ps_res = await client.get(f"{self.base_url}/api/ps")
                    if ps_res.status_code == 200:
                        ps_data = ps_res.json()
                        ps_models = [m.get("name") for m in ps_data.get("models", [])]
                        model_loaded = any(self.model in name or name in self.model for name in ps_models)
                except Exception:
                    pass

                if not model_ready:
                    readiness_state = "MODEL_NOT_FOUND"
                    status = GeneratorStatus.AI_UNAVAILABLE.value
                elif model_loaded:
                    readiness_state = "ACTIVE_IN_MEMORY"
                    status = GeneratorStatus.AI_ACTIVE.value
                else:
                    readiness_state = "READY_TO_LOAD"
                    status = GeneratorStatus.AI_ACTIVE.value

                return {
                    "status": status,
                    "available": True,
                    "model": self.model,
                    "model_ready": model_ready,
                    "model_loaded": model_loaded,
                    "readiness_state": readiness_state,
                    "all_models": models,
                }
        except Exception as exc:
            logger.warning("Ollama readiness check failed: %s", exc)
            return {
                "status": GeneratorStatus.AI_UNAVAILABLE.value,
                "available": False,
                "error": str(exc),
                "model": self.model,
                "model_ready": False,
                "model_loaded": False,
                "readiness_state": "OLLAMA_UNREACHABLE",
                "all_models": [],
            }

    async def _query_ollama(self, prompt: str, system: Optional[str] = None, force_json: bool = True) -> Optional[str]:
        """
        Executes a prompt against local Ollama with timeout and error handling.
        Uses format='json' when requested for structured output.
        """
        payload: Dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        if force_json:
            payload["format"] = "json"
        if system:
            payload["system"] = system

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/api/generate", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    return data.get("response", "").strip()
                logger.error("Ollama query failed: HTTP %s: %s", response.status_code, response.text)
                return None
        except httpx.TimeoutException as te:
            logger.warning("Ollama query timed out after %s seconds: %s", self.timeout, te)
            return None
        except Exception as e:
            logger.warning("Error contacting Ollama at %s: %s", self.base_url, e)
            return None

    @staticmethod
    def _extract_json_payload(raw_text: str) -> Optional[Dict[str, Any]]:
        """
        Extracts and parses JSON object from model response, handling optional markdown code blocks.
        """
        if not raw_text:
            return None
        cleaned = raw_text.strip()
        # Strip markdown fences if present
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()
            else:
                cleaned = cleaned.replace("```json", "").replace("```", "").strip()
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
            return None
        except Exception:
            # Fallback regex search for { ... }
            match = re.search(r"(\{[\s\S]*\})", cleaned)
            if match:
                try:
                    parsed = json.loads(match.group(1))
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    pass
            return None

    async def generate_plan(self, task: Task, repo_context: Optional[str] = None) -> TaskPlan:
        """
        Generates a structured plan for completing a task using Gemma.
        Falls back to a safe deterministic plan if Ollama is unavailable, times out, or returns invalid schema.
        """
        criteria_str = "\n".join([f"- [{c.id}]: {c.description}" for c in task.acceptance_criteria])
        repo_str = f"\nRepository Context:\n{repo_context}\n" if repo_context else ""

        system_prompt = (
            "You are VIKASA Task Planner. Respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            '  "task_summary": "Concise summary of task objectives",\n'
            '  "steps": [{"step_number": 1, "action": "Step action", "expected_outcome": "Outcome", "associated_criterion_id": "AC-1"}],\n'
            '  "acceptance_criteria": [{"criterion_id": "AC-1", "description": "Criteria text", "verification_method": "pytest"}],\n'
            '  "files_to_inspect": ["path/to/file.py"],\n'
            '  "tests_to_run": ["pytest tests/test_feature.py"],\n'
            '  "risks": ["Risk description"],\n'
            '  "verification_strategy": "Deterministic verification description"\n'
            "}\n"
            "Never fabricate nonexistent paths or claim tests were already executed."
        )

        user_prompt = (
            f"Generate a verification-first development plan for the following task:\n"
            f"Task ID: {task.id}\n"
            f"Title: {task.title}\n"
            f"Description: {task.description}\n"
            f"Acceptance Criteria:\n{criteria_str}\n"
            f"{repo_str}"
        )

        raw_response = await self._query_ollama(prompt=user_prompt, system=system_prompt, force_json=True)
        json_data = self._extract_json_payload(raw_response) if raw_response else None

        if json_data:
            try:
                # Validate required fields
                if "task_summary" not in json_data and "summary" in json_data:
                    json_data["task_summary"] = json_data["summary"]

                raw_steps = json_data.get("steps")
                if not isinstance(raw_steps, list) or len(raw_steps) == 0:
                    raise ValueError("Field 'steps' must be a non-empty list")

                steps = [
                    PlanStep(
                        step_number=s.get("step_number", idx + 1),
                        action=s.get("action", f"Step {idx + 1}"),
                        expected_outcome=s.get("expected_outcome", "Expected step outcome"),
                        associated_criterion_id=s.get("associated_criterion_id"),
                    )
                    for idx, s in enumerate(raw_steps)
                ]

                mapped_criteria = [
                    MappedCriterion(
                        criterion_id=c.get("criterion_id", f"AC-{idx+1}"),
                        description=c.get("description", ""),
                        verification_method=c.get("verification_method", "deterministic check"),
                    )
                    for idx, c in enumerate(json_data.get("acceptance_criteria", []))
                ]

                plan = TaskPlan(
                    task_id=task.id,
                    model_name=self.model,
                    generator_status=GeneratorStatus.AI_ACTIVE,
                    task_summary=json_data.get("task_summary") or f"Plan for {task.title}",
                    steps=steps,
                    acceptance_criteria=mapped_criteria,
                    files_to_inspect=[str(f) for f in json_data.get("files_to_inspect", [])],
                    tests_to_run=[str(t) for t in json_data.get("tests_to_run", [])],
                    risks=[str(r) for r in json_data.get("risks", [])],
                    verification_strategy=json_data.get("verification_strategy", "Deterministic criteria check"),
                )
                return plan
            except (ValidationError, ValueError, TypeError) as e:
                logger.warning("Gemma plan output schema validation failed: %s. Using structured fallback.", e)

        # Robust deterministic fallback if model is unavailable, times out, or output is invalid
        fallback_steps = [
            PlanStep(
                step_number=idx + 1,
                action=f"Implement and satisfy criterion: {crit.description}",
                expected_outcome=f"Explicit passing evidence and test output for {crit.id}",
                associated_criterion_id=crit.id,
            )
            for idx, crit in enumerate(task.acceptance_criteria)
        ]
        fallback_criteria = [
            MappedCriterion(
                criterion_id=crit.id,
                description=crit.description,
                verification_method="Deterministic test suite & exit code 0",
            )
            for crit in task.acceptance_criteria
        ]

        return TaskPlan(
            task_id=task.id,
            model_name=f"{self.model} (deterministic fallback)",
            generator_status=GeneratorStatus.FALLBACK_ACTIVE,
            task_summary=f"Automated verification-aligned plan for: {task.title}",
            steps=fallback_steps,
            acceptance_criteria=fallback_criteria,
            files_to_inspect=["backend/app/main.py", "backend/requirements.txt"],
            tests_to_run=["python -m pytest backend/tests/ -v"],
            risks=["Unverified external dependencies", "Missing acceptance criteria evidence"],
            verification_strategy="Run deterministic test assertions and verify git diff against acceptance criteria.",
        )

    # Legacy alias for backward compatibility
    async def generate_task_plan(self, task: Task) -> TaskPlan:
        return await self.generate_plan(task)

    async def explain_failure(
        self,
        task: Task,
        verification_result: VerificationResult,
        repo_diff: Optional[str] = None,
        evidence_list: Optional[List[EvidenceItem]] = None,
    ) -> FailureDiagnosis:
        """
        Evaluates a verification failure and generates an evidence-grounded diagnosis.
        Distinguishes observed facts from hypotheses. Never overrides the deterministic verdict.
        """
        evidence_items = evidence_list or []
        failed_rules = [r for r in verification_result.rule_evaluations if not r.passed]

        # Determine if evidence is insufficient
        insufficient_evidence = False
        if not evidence_items and not repo_diff:
            insufficient_evidence = True
        elif any(r.rule_name == "UnsubstantiatedClaimCheck" for r in failed_rules):
            insufficient_evidence = True

        # Extract concrete observed facts from evidence
        observed_evidence_refs = []
        for ev in evidence_items:
            ref = f"[{ev.evidence_type.value}]"
            if ev.criterion_id:
                ref += f" Criterion {ev.criterion_id}:"
            if ev.exit_code is not None:
                ref += f" exit_code={ev.exit_code}"
            if ev.passed is not None:
                ref += f" passed={ev.passed}"
            if ev.content:
                snippet = ev.content.strip().split("\n")[0][:100]
                ref += f" snippet='{snippet}'"
            observed_evidence_refs.append(ref)

        failed_rules_summary = "\n".join([f"- {r.rule_name}: {r.message}" for r in failed_rules])
        evidence_summary = "\n".join(observed_evidence_refs) if observed_evidence_refs else "No concrete evidence provided."
        diff_summary = f"\nGit Diff:\n{repo_diff[:1500]}\n" if repo_diff else "No git diff attached."

        system_prompt = (
            "You are VIKASA Failure Diagnostician. Respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            '  "failure_summary": "Clear statement of what failed based strictly on observed facts",\n'
            '  "likely_causes": ["Hypothesis 1 regarding why the failure occurred"],\n'
            '  "evidence_references": ["Observed evidence supporting the finding"],\n'
            '  "recommended_fixes": ["Concrete proposed fix to be executed (do not claim it is already implemented)"],\n'
            '  "suggested_retests": ["Command or test to verify the fix"],\n'
            '  "confidence": 0.85\n'
            "}\n"
            "CRITICAL RULES:\n"
            "1. You must distinguish observed facts from hypotheses.\n"
            "2. Never claim that a task is verified or that a fix has already been implemented.\n"
            "3. If evidence is insufficient, state that clearly in failure_summary."
        )

        user_prompt = (
            f"Analyze this verification failure:\n"
            f"Task: {task.title} (ID: {task.id})\n"
            f"Deterministic Verdict: {verification_result.verdict.value}\n"
            f"Failed Rule Checks:\n{failed_rules_summary}\n"
            f"Recorded Evidence:\n{evidence_summary}\n"
            f"{diff_summary}\n"
            f"Insufficient Evidence Flag: {insufficient_evidence}\n"
        )

        raw_response = await self._query_ollama(prompt=user_prompt, system=system_prompt, force_json=True)
        json_data = self._extract_json_payload(raw_response) if raw_response else None

        if json_data:
            try:
                # Never allow AI to change the verdict! The verdict is ALWAYS from verification_result.verdict.
                summary = json_data.get("failure_summary") or f"Task '{task.title}' failed deterministic verification."
                if insufficient_evidence and "insufficient" not in summary.lower():
                    summary = f"Insufficient evidence: {summary}"

                confidence = float(json_data.get("confidence", 0.75))
                confidence = max(0.0, min(1.0, confidence))

                return FailureDiagnosis(
                    task_id=task.id,
                    verdict=verification_result.verdict,  # Deterministic verdict preserved
                    generator_status=GeneratorStatus.AI_ACTIVE,
                    failure_summary=summary,
                    likely_causes=[str(c) for c in json_data.get("likely_causes", [])],
                    evidence_references=[str(e) for e in json_data.get("evidence_references", observed_evidence_refs)],
                    recommended_fixes=[str(f) for f in json_data.get("recommended_fixes", [])],
                    suggested_retests=[str(r) for r in json_data.get("suggested_retests", [])],
                    confidence=confidence,
                    insufficient_evidence=insufficient_evidence,
                )
            except (ValidationError, ValueError, TypeError) as e:
                logger.warning("Gemma failure diagnosis schema validation failed: %s. Using structured fallback.", e)

        # Deterministic fallback failure diagnosis
        default_causes = [f"Rule failed: {r.rule_name} - {r.message}" for r in failed_rules]
        if insufficient_evidence:
            default_causes.append("Agent submitted completion claim without attached test outputs or exit code evidence.")

        default_fixes = [
            f"Execute tests corresponding to {crit.id} and capture stdout/exit code."
            for crit in task.acceptance_criteria if crit.required
        ]
        default_retests = ["python -m pytest backend/tests/ -v"]

        return FailureDiagnosis(
            task_id=task.id,
            verdict=verification_result.verdict,  # Invariant: deterministic verdict preserved
            generator_status=GeneratorStatus.FALLBACK_ACTIVE,
            failure_summary=(
                "Insufficient evidence attached to claim; verification failed."
                if insufficient_evidence else
                f"Deterministic verification failed: {len(failed_rules)} rule check(s) violated."
            ),
            likely_causes=default_causes,
            evidence_references=observed_evidence_refs if observed_evidence_refs else ["No evidence items attached."],
            recommended_fixes=default_fixes,
            suggested_retests=default_retests,
            confidence=0.5 if insufficient_evidence else 0.85,
            insufficient_evidence=insufficient_evidence,
        )

    # Legacy alias for backward compatibility
    async def explain_verification_failure(
        self, task: Task, verification_result: VerificationResult
    ) -> Dict[str, Any]:
        diagnosis = await self.explain_failure(task, verification_result)
        res = diagnosis.model_dump()
        failed_count = sum(1 for r in getattr(verification_result, "rule_evaluations", []) if not r.passed)
        res["failed_rule_count"] = failed_count
        return res
