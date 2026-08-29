"""Unit tests for HITL clinical constraint proposals."""

from __future__ import annotations

from app.models.profile import Profile
from app.schemas.profile import PatientProfile, ProfileUpsert, Restrictions
from app.services.clinical_constraints import (
    apply_approved_proposals,
    store_patient_proposals,
)


def test_store_patient_proposals_does_not_touch_effective_kcal():
    row = Profile(user_id="u1", target_kcal=1600, restrictions={"sugar_daily_g": 20})
    payload = ProfileUpsert(target_kcal=2500, restrictions=Restrictions(sugar_daily_g=80))

    pending = store_patient_proposals(row, payload)

    assert pending is True
    assert row.target_kcal == 1600
    assert row.restrictions == {"sugar_daily_g": 20}
    assert row.proposed_target_kcal == 2500
    assert row.proposed_restrictions["sugar_daily_g"] == 80
    assert row.constraints_status == "pending_doctor_review"


def test_apply_approved_proposals_copies_then_clears():
    row = Profile(
        user_id="u1",
        target_kcal=1600,
        restrictions={"sugar_daily_g": 20, "salt_daily_g": 5},
        proposed_target_kcal=2500,
        proposed_restrictions={"sugar_daily_g": 80},
        constraints_status="pending_doctor_review",
    )

    apply_approved_proposals(row)

    assert row.target_kcal == 2500
    assert row.restrictions["sugar_daily_g"] == 80
    assert row.restrictions["salt_daily_g"] == 5
    assert row.proposed_target_kcal is None
    assert row.proposed_restrictions is None
    assert row.constraints_status == "confirmed"


def test_patient_profile_for_meal_planning_drops_proposals():
    profile = PatientProfile(target_kcal=1600, proposed_target_kcal=2500)
    planning = profile.for_meal_planning()
    assert planning.target_kcal == 1600
    assert planning.proposed_target_kcal is None
