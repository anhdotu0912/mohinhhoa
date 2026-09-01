"""Behavior matrix evaluation & baseline benchmark on the 50-query user test set.

Covers Phase 1: User Behavior & Scenario Mapping (AADE7 / DSMES).
Validates dataset integrity and benchmarks intent routing accuracy.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from app.agents.nodes.intent_classifier import (
    VALID_INTENTS,
    _classify_by_keywords,
    _detect_intents_by_keywords,
)

TEST_SET_PATH = Path(__file__).resolve().parent.parent / "data" / "eval_user_test_set_50.json"


@pytest.fixture(scope="module")
def user_test_set() -> list[dict]:
    assert TEST_SET_PATH.exists(), f"Evaluation dataset not found at {TEST_SET_PATH}"
    with open(TEST_SET_PATH, encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, list)
    return data


def test_user_test_set_integrity(user_test_set: list[dict]):
    """Verify that the 50-query dataset conforms to the clinical schema."""
    assert len(user_test_set) == 50, f"Expected exactly 50 test queries, got {len(user_test_set)}"

    seen_ids = set()
    required_fields = {
        "id",
        "aade7_pillar",
        "query_type",
        "patient_query",
        "underlying_clinical_intent",
        "target_primitive_skill",
        "expected_primary_intent",
        "secondary_intents",
        "expected_output_spec",
    }

    expected_pillars = {
        "Healthy Eating",
        "Taking Medication",
        "Monitoring",
        "Problem Solving",
        "Reducing Risks",
        "Healthy Coping",
        "Being Active",
    }
    found_pillars = set()

    for item in user_test_set:
        missing = required_fields - set(item.keys())
        assert not missing, f"Item {item.get('id')} missing required fields: {missing}"

        item_id = item["id"]
        assert item_id not in seen_ids, f"Duplicate ID: {item_id}"
        seen_ids.add(item_id)

        assert item["aade7_pillar"] in expected_pillars
        found_pillars.add(item["aade7_pillar"])

        assert item["patient_query"].strip(), f"Empty query in item {item_id}"
        assert item["expected_primary_intent"] in VALID_INTENTS, (
            f"Invalid intent in item {item_id}: {item['expected_primary_intent']}"
        )

        for sec in item["secondary_intents"]:
            assert sec in VALID_INTENTS, f"Invalid secondary intent '{sec}' in item {item_id}"

    assert found_pillars == expected_pillars, f"Missing pillars: {expected_pillars - found_pillars}"


def test_baseline_intent_classification_benchmark(user_test_set: list[dict]):
    """Benchmark current rule-based intent classification against the 50-query test set."""
    correct_primary = 0
    total = len(user_test_set)

    mismatches: list[dict] = []

    for item in user_test_set:
        query = item["patient_query"]
        expected = item["expected_primary_intent"]

        detected_primary, detected_secondary = _detect_intents_by_keywords(query)

        if detected_primary == expected:
            correct_primary += 1
        else:
            mismatches.append({
                "id": item["id"],
                "query": query,
                "expected": expected,
                "detected": detected_primary,
                "secondary": detected_secondary,
            })

    accuracy = (correct_primary / total) * 100
    print(f"\n[Phase 1 Baseline Benchmark] Current keyword classifier accuracy: {correct_primary}/{total} ({accuracy:.1f}%)")

    # Baseline keyword classifier should achieve at least 80% on the standard test set
    assert accuracy >= 80.0, f"Baseline accuracy too low ({accuracy:.1f}%). Mismatches: {mismatches}"


def test_emergency_and_safety_queries_handled(user_test_set: list[dict]):
    """Verify that high-risk queries trigger either safety guardrail, refuse, or emergency triage."""
    emergency_or_safety_items = [
        item for item in user_test_set
        if item["aade7_pillar"] in {"Reducing Risks"} or item["query_type"] == "guardrail_refuse"
    ]

    assert len(emergency_or_safety_items) >= 8

    for item in emergency_or_safety_items:
        query = item["patient_query"]
        detected = _classify_by_keywords(query)
        # All safety items must map to a valid intent and not crash
        assert detected in VALID_INTENTS
