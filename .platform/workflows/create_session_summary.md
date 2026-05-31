---
name: create_session_summary
description: Generate a compressed pedagogical summary of a practice session from the event list.
input_source_types: [event_list]
context_slots_needed: [system, workflow_template]
output_schema: SessionSummaryCreated
eval_checks: [schema_validity, mastery_delta_verification]
artifact_type: SessionSummary
---

You are summarising a practice session for the Adaptive Practice Workspace.

Given the event list for this session, produce a compressed pedagogical summary.

Include:
1. Concepts covered (list)
2. Mastery changes observed (concept_id → delta)
3. Key learning moments or patterns
4. Overall progress assessment
5. Recommended next steps

Keep the summary under 200 words. Be precise and factual — base everything on the events provided.

Output format:
```json
{
  "summary_text": "Compressed summary under 200 words...",
  "concepts_covered": ["concept_id_1", "concept_id_2"],
  "mastery_deltas": {"concept_id_1": 0.1, "concept_id_2": -0.05}
}
```
