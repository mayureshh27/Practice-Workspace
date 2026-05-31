# Context Gate Uses Seed-And-Discover Pattern

The Context Gate produces a minimal seed context of approximately 9,400 tokens (system slot + workflow template name + skills index + graph seed + memory seed path + tools names list + examples + user request). The agent discovers all additional context at runtime through typed tool calls: `skill_lookup`, `tool_lookup`, `workflow_lookup`, `source_search`, `memory_read`, `graph_lookup`, `session_history`, `file_read`. No slot other than `system` carries full content at seed time. Full tool schemas, workflow prompts, skill content, memory files, and source chunks enter the context only when the agent requests them.

## Consequences

The total seed context is ~9,400 tokens regardless of how many tools, skills, or workflows the platform has defined — adding a new tool file does not increase the cost of any context assembly. The agent's tool calls grow the effective context dynamically based on what is relevant to the current turn, not what the harness decided might be relevant at construction time. KV-cache efficiency improves because the first ~9,400 tokens are stable across most calls. The `debug_print()` method reports seed tokens plus estimated tool-fetched tokens separately. Deep-source mode is the only path to expanding slots beyond their default budgets; it is a constructor boolean, not an implicit consequence of any other setting.

## Considered Options

- Pre-assembly (current ContextBuilder): all slots populated at call time, full tool schemas injected, full skill content injected. Results in ~33k token seed regardless of problem — context rot from irrelevant content, KV-cache invalidated on any tool change.
- Retrieval-augmented assembly without slot budgets: no hard budget enforcement, no attribution of which slot is consuming tokens — violates the anti-bloat requirement.
- Seed-and-discover: chosen because it minimises the seed, lets the agent decide what is relevant, enforces hard system budget, and makes every token traceable to a specific slot.
