.PHONY: run test lint format typecheck check clean

run:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	cd backend && pytest tests/ -v

lint:
	ruff check backend/app/ backend/tests/

format:
	ruff format backend/app/ backend/tests/

typecheck:
	cd backend && mypy app/

check: lint format test

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
