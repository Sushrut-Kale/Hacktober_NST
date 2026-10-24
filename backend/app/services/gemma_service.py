"""
Gemma Service for VIKASA.
Integrates with local Ollama instance running gemma4:e4b.
Responsible for:
- Health & model readiness verification
- Structured task planning
- Failure explanation
- Evidence-based corrective suggestions
- Schema validation with graceful fallbacks and timeouts
"""

import json
import logging
from typing import Optional, Dict, Any, List
import httpx
from pydantic import ValidationError

from backend.app.config import settings
from backend.app.schemas.core import Task, TaskPlan, PlanStep, VerificationResult

logger = logging.getLogger(__name__)

class GemmaService:
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.gemma_model
        self.timeout = settings.ollama_timeout_seconds

    async def check_readiness(self) -> Dict[str, Any]:
        """
        Verifies whether Ollama is accessible and whether the required Gemma model is loaded.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code != 200:
                    return {
                        "available": False,
                        "error": f"Ollama HTTP {res.status_code}",
                        "model_ready": False,
                    }
                data = res.json()
                models = [m.get("name") for m in data.get("models", [])]
                model_ready = any(self.model in name or name in self.model for name in models)
                return {
                    "available": True,
                    "model": self.model,
                    "model_ready": model_ready,
                    "all_models": models,
                }
        except httpx.RequestError as exc:
            return {
                "available": False,
                "error": str(exc),
                "model_ready": False,
            }

    async def _query_ollama(self, prompt: str, system: Optional[str] = None) -> Optional[str]:
        """
        Executes a prompt against local Ollama with timeout and error handling.
        """
        payload: Dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
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
        except Exception as e:
            logger.warning("Error contacting Ollama at %s: %s", self.base_url, e)
            return None

    async def generate_task_plan(self, task: Task) -> TaskPlan:
        """
        Generates a structured plan for completing a task using Gemma.
        Falls back to a safe deterministic plan if Ollama is unavailable or response is malformed.
        """
        criteria_str = "\n".join([f"- [{c.id}]: {c.description}" for c in task.acceptance_criteria])
        system_prompt = (
            "You are VIKASA Plan Generator. Return strictly a JSON object with keys: "
            "summary (string), steps (array of {step_number: int, action: string, expected_outcome: string, associated_criterion_id: string}), "
            "verification_strategy (string). Do not include markdown code block ticks."
        )
        user_prompt = (
            f"Generate a verification-first development plan for this task:\n"
            f"Title: {task.title}\n"
            f"Description: {task.description}\n"
            f"Acceptance Criteria:\n{criteria_str}\n"
        )

        raw_response = await self._query_ollama(prompt=user_prompt, system=system_prompt)
        
        # Try parsing structured JSON
        if raw_response:
            try:
                # Strip markdown code blocks if model wrapped JSON
                cleaned = raw_response.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("```")[1]
                    if cleaned.startswith("json"):
                        cleaned = cleaned[4:]
                cleaned = cleaned.strip()
                data = json.loads(cleaned)
                steps = [
                    PlanStep(
                        step_number=s.get("step_number", i + 1),
                        action=s.get("action", ""),
                        expected_outcome=s.get("expected_outcome", ""),
                        associated_criterion_id=s.get("associated_criterion_id"),
                    )
                    for i, s in enumerate(data.get("steps", []))
                ]
                return TaskPlan(
                    task_id=task.id,
                    model_name=self.model,
                    summary=data.get("summary", f"Plan for {task.title}"),
                    steps=steps,
                    verification_strategy=data.get("verification_strategy", "Deterministic criteria check"),
                )
            except (json.JSONDecodeError, ValidationError) as e:
                logger.warning("Failed to parse Gemma plan JSON: %s. Using structured fallback.", e)

        # Robust deterministic fallback if model is unreachable or output invalid
        fallback_steps = [
            PlanStep(
                step_number=idx + 1,
                action=f"Implement and satisfy criterion: {crit.description}",
                expected_outcome=f"Explicit passing evidence and test for {crit.id}",
                associated_criterion_id=crit.id,
            )
            for idx, crit in enumerate(task.acceptance_criteria)
        ]
        return TaskPlan(
            task_id=task.id,
            model_name=f"{self.model} (structured fallback)",
            summary=f"Automated verification-aligned plan for: {task.title}",
            steps=fallback_steps,
            verification_strategy="Run deterministic test assertions and verify git diff against acceptance criteria.",
        )

    async def explain_verification_failure(
        self, task: Task, verification_result: VerificationResult
    ) -> Dict[str, Any]:
        """
        Asks Gemma to explain why a task failed verification and suggest evidence-based corrections.
        """
        failed_rules = [r for r in verification_result.rule_evaluations if not r.passed]
        rules_text = "\n".join([f"- {r.rule_name}: {r.message}" for r in failed_rules])
        prompt = (
            f"The task '{task.title}' failed deterministic verification with verdict '{verification_result.verdict.value}'.\n"
            f"Failed Rules:\n{rules_text}\n"
            f"Provide a concise, evidence-based correction suggestion. What specific tests, diffs, or commands must be run?"
        )
        explanation = await self._query_ollama(prompt=prompt)
        return {
            "task_id": task.id,
            "verdict": verification_result.verdict.value,
            "failed_rule_count": len(failed_rules),
            "ai_explanation": explanation or "Deterministic verification failed. Ensure all acceptance criteria have passing test evidence and git diffs.",
        }
