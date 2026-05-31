# Socratic Gate Enforces No-Leakage Post-Generation

The platform enforces the no-answer-leakage constraint through a post-generation eval gate (the Socratic Gate) that runs on every tutor response before delivery, not through prompting alone. The gate is a fast binary check on a separate, cheaper model call that answers three questions: does the response contain solution code? Does it state the answer directly? Does it end with a question? Responses failing (a) or (b) are blocked, a HintLeakage event is logged, the prompt is sharpened, and the response is regenerated. The gate fires regardless of model version, prompt version, or how the request was phrased.

## Consequences

Prompt instructions for the Socratic constraint are still written — they are the first line of defence. The Workflow Template for hints must end with a question requirement — this is the second line of defence. The Socratic Gate is the third. All three are necessary because each fails differently: prompt instructions fail on adversarial phrasing; the template requirement fails if the model front-loads a full solution before adding the required question; the gate catches what both of the above miss. This is defence in depth, not redundancy. The gate is a permanent architectural component, not a temporary workaround pending model improvement — the pedagogical requirement has no expiry date.

## Considered Options

- Prompt-only enforcement: fails on adversarial phrasing and long-context degradation of instruction following.
- Output classifier at the model level: model-version-dependent, not auditable, cannot produce a HintLeakage event.
- Manual review queue for all hints: not feasible at interaction speed; defeats the practice loop.
