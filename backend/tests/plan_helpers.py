"""Shared meal-plan test helpers."""

from __future__ import annotations


def login(client, email: str, password: str = "demo1234") -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def generate_approve_apply(
    client,
    patient_email: str,
    doctor_headers: dict,
    *,
    apply: bool = True,
    apply_mode: str | None = None,
) -> str:
    """Generate + approve; optionally apply so the next generate is allowed."""
    patient_headers = login(client, patient_email)
    plan = client.post("/api/v1/meal-plans/generate", headers=patient_headers)
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["id"]
    review = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/review",
        headers=doctor_headers,
        json={"action": "approve", "notes": "OK"},
    )
    assert review.status_code == 200, review.text
    if not apply:
        return plan_id

    if apply_mode is None:
        chained = client.post(
            f"/api/v1/doctor/meal-plans/{plan_id}/apply",
            headers=doctor_headers,
            json={"apply_mode": "after_current"},
        )
        if chained.status_code == 200:
            return plan_id
        assert chained.status_code == 400 and chained.json().get("code") == "NO_CHAIN_PLAN"
        apply_mode = "from_today"

    applied = client.post(
        f"/api/v1/doctor/meal-plans/{plan_id}/apply",
        headers=doctor_headers,
        json={"apply_mode": apply_mode},
    )
    assert applied.status_code == 200, applied.text
    return plan_id
