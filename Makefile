# Practice-Workspace top-level Makefile
# One command runs all feedback loops. Use `make check` before pushing.
#
# NOTE: `pnpm lint` is intentionally NOT wired here. The repo's
# eslint.config.js imports @eslint/js, globals, typescript-eslint,
# eslint-plugin-react-hooks, and eslint-plugin-react-refresh, but
# NONE of those are in frontend/package.json (pre-existing tech debt
# on the repo). Installing the full ESLint stack is Phase 14 work
# (see docs/plan/implementation-plan-2026-06-02-review-fix-cycle.md
# §"Phase 14 - housekeeping"). For now, `make check` runs:
#   - frontend: typecheck + test
#   - backend: ruff + mypy + pytest with coverage
.PHONY: check check-frontend check-backend format lint test build clean

check: check-frontend check-backend
	@echo "==> all checks passed"

check-frontend:
	@echo "==> frontend typecheck + test"
	cd frontend && pnpm typecheck && pnpm test

check-backend:
	@echo "==> backend ruff + mypy + pytest"
	cd backend && uv run ruff check . && uv run mypy app/ && \
	  uv run pytest --cov=app --cov-fail-under=55 \
	    --ignore=tests/test_workspace_api.py

format:
	@echo "==> format frontend"
	cd frontend && pnpm format
	@echo "==> format backend"
	cd backend && uv run ruff format .

lint:
	@echo "==> frontend typecheck (eslint wiring is Phase 14 work)"
	cd frontend && pnpm typecheck

test:
	cd frontend && pnpm test
	cd backend && uv run pytest --ignore=tests/test_workspace_api.py

build:
	cd frontend && pnpm build
