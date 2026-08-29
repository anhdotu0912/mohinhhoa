"""Pytest suite for Phase 5: CI/CD Evaluation & Regression Metrics (P-014).

Enforces strict assertions on the 3 evaluation targets:
1. Tool Selection Accuracy >= 95% on the 50-query dataset.
2. Token Consumption Reduction >= 60% with Zero-Bloat context.
3. Zero Hallucination Rate = 100% on emergency & safety-critical queries.
"""

from __future__ import annotations

import json
from pathlib import Path
import pytest

from scripts.evaluate_agent_skills import (
    evaluate_emergency_zero_hallucination,
    evaluate_token_consumption_reduction,
    evaluate_tool_selection_accuracy,
    run_full_evaluation,
)

TEST_SET_PATH = Path(__file__).resolve().parent.parent / "data" / "eval_user_test_set_50.json"


@pytest.fixture(scope="module")
def user_test_set() -> list[dict]:
    assert TEST_SET_PATH.exists(), f"Evaluation dataset missing: {TEST_SET_PATH}"
    with open(TEST_SET_PATH, encoding="utf-8") as f:
        return json.load(f)


class TestAgentSkillsEvaluationMetrics:
    def test_tool_selection_accuracy_meets_target(self, user_test_set: list[dict]):
        """Metric 1: Tool Selection Accuracy must be >= 95.0%."""
        res = evaluate_tool_selection_accuracy(user_test_set)
        assert res["target_met"] is True
        assert res["accuracy_pct"] >= 95.0, (
            f"Tool selection accuracy {res['accuracy_pct']}% is below target 95.0%. Mismatches: {res['mismatches']}"
        )

    def test_average_token_reduction_meets_target(self):
        """Metric 2: Average Token Reduction must be >= 60.0%."""
        res = evaluate_token_consumption_reduction()
        assert res["target_met"] is True
        assert res["reduction_pct"] >= 60.0, (
            f"Token reduction {res['reduction_pct']}% is below target 60.0%."
        )

    def test_zero_hallucination_on_emergency_meets_target(self, user_test_set: list[dict]):
        """Metric 3: Zero Hallucination on Emergency & Safety must be exactly 100.0%."""
        res = evaluate_emergency_zero_hallucination(user_test_set)
        assert res["target_met"] is True
        assert res["zero_hallucination_rate_pct"] == 100.0, (
            f"Zero hallucination rate {res['zero_hallucination_rate_pct']}% != 100.0%. Failures: {res['failures']}"
        )

    def test_full_evaluation_pipeline_status_passed(self):
        """Verify full evaluation runner returns status PASSED and creates benchmark file."""
        report = run_full_evaluation()
        assert report["status"] == "PASSED"
        assert "metric_1_tool_selection_accuracy" in report
        assert "metric_2_token_consumption_reduction" in report
        assert "metric_3_emergency_zero_hallucination" in report
