# Codebase Self-Review Plan

Tools you can run yourself to inspect the whole codebase.

---

## 1. Architecture Overview (5 min)

```bash
# Project tree (dirs only, no node_modules)
cmd //c "tree /A /F backend/app | findstr /V __pycache__" | head -80
cmd //c "tree /A /F frontend/src" | head -80
```

Or use this to see every file with line counts:

```python
# dev/inventory.py
from pathlib import Path
for p in sorted(Path("backend/app").rglob("*.py")):
    if "__pycache__" not in str(p):
        lines = len(p.read_text().splitlines())
        print(f"{lines:>5}  {p}")
```

---

## 2. Dependency Graph (10 min)

See who imports what:

```bash
# All imports in harness module
grep -rn "^from\|^import" backend/app/harness/ | sort
```

Check for circular imports:

```bash
# Find files that import each other
for f in backend/app/**/*.py; do
  name=$(basename $f .py)
  imports=$(grep "from.*$name import\|import.*$name" backend/app/**/*.py 2>/dev/null | wc -l)
  if [ $imports -gt 5 ]; then echo "$imports imports -> $f"; fi
done | sort -rn
```

---

## 3. Code Practice Checks (run individually)

### Type annotations
```bash
# Files missing type annotations on functions
grep -rn "def \|async def " backend/app/harness/*.py backend/app/agents/*.py | grep -v "->" | grep -v "__init__\|__str__\|__repr__"
```

### Broad exception handling (anti-pattern)
```bash
grep -rn "except:\|except Exception" backend/app/ --include="*.py" | grep -v __pycache__ | grep -v "logfire\|logger"
```

### Functions over 50 lines (complexity signal)
```bash
python dev/inventory.py  # then manually check large files
```

Or:
```bash
# Count lines between def and next def (rough proxy)
rg -n "def \|async def " backend/app/harness/*.py | head -30
```

### Hardcoded strings that should be config
```bash
grep -rn "\"localhost\"\|\"http://localhost\"\|port=6333\|port=8000" backend/app/ --include="*.py"
```

### Import * (namespace pollution)
```bash
grep -rn "from.*import \*" backend/app/ --include="*.py"
```

### Print instead of logger
```bash
grep -rn "^\s*print(" backend/app/ --include="*.py" | grep -v __pycache__
```

### Old-style string formatting
```bash
grep -rn "%s\|%d\|%f" backend/app/ --include="*.py" | grep -v "__" | grep -v "% "
```

### Anywhere `Any` type is used
```bash
grep -rn ": Any\|-> Any" backend/app/harness/*.py backend/app/agents/*.py
```

---

## 4. File-by-File Deep Review Order

Recommended reading order (most important first):

| Priority | File | Why |
|---|---|---|
| **1** | `backend/app/main.py` | App factory, wiring, startup |
| **2** | `backend/app/harness/context_gate.py` | Core context assembly (9-slot design) |
| **3** | `backend/app/harness/event_emitter.py` | Mastery rules, blind spot detection |
| **4** | `backend/app/harness/named_configs.py` | Role configs |
| **5** | `backend/app/harness/qdrant_router.py` | Retrieval implementation |
| **6** | `backend/app/harness/eval_gate.py` | SocraticGate |
| **7** | `backend/app/harness/tool_registry.py` | Tool schema loading |
| **8** | `backend/app/harness/graphiti_mastery_store.py` | Graphiti integration |
| **9** | `backend/app/domain/events.py` | Event models |
| **10** | `backend/app/agents/*.py` | Agent roles |
| **11** | `frontend/src/api/workspaceApi.ts` | API layer |
| **12** | `frontend/src/components/panels/*.tsx` | UI panels |

---

## 5. Quick Health Checks

### Backend starts without import errors
```bash
python -c "from app.main import create_app; print('OK')"
```

### All event models validate
```bash
python -c "
from app.domain.events import *
from datetime import datetime
e = PracticeAttempted(session_id='s1', concept_id='c1', verdict='Accepted')
print(f'Event OK: {e.id}')
"
```

### Frontend compiles
```bash
cd frontend && npx tsc --noEmit 2>&1 | tail -5
```

---

## 6. What to Look For

- **Circular deps** — harness modules shouldn't import agents, agents can import harness
- **Broad try/except** — `except:` without logging is a bug
- **Any type use** — means missing Pydantic model or Protocol
- **Mixed responsibilities** — a file doing DB + logic + formatting is a smell
- **Hardcoded ports/paths** — should be env vars
- **Missing error handling** — external calls (Qdrant, Graphiti, sandbox) need timeouts
- **Inconsistent naming** — `get_foo()` vs `fetch_foo()` vs `load_foo()` within same module
