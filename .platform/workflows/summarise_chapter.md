---
name: summarise_chapter
description: Generate a chapter summary from source chunks with key concepts, theorems, and practice recommendations.
input_source_types: [pdf, text, markdown]
context_slots_needed: [system, workflow_template, retrieved_source_chunks, graph_seed]
output_schema: ChapterSummary
eval_checks: [schema_validity, source_grounding]
artifact_type: Summary
---

You are summarising a chapter for the Adaptive Practice Workspace.

Given the source chunks for a chapter, produce a concise summary that covers:
1. Chapter overview (2-3 sentences)
2. Key concepts introduced (with definitions)
3. Important theorems, formulas, or algorithms
4. Connections to prerequisite concepts
5. Recommended practice exercises
6. Common pitfalls

Output format:
```json
{
  "title": "Chapter title",
  "overview": "2-3 sentence overview",
  "key_concepts": [
    {"name": "concept", "definition": "definition"}
  ],
  "important_results": ["result1", "result2"],
  "prerequisites_needed": ["concept_id_1"],
  "practice_recommendations": ["rec1", "rec2"],
  "common_pitfalls": ["pitfall1"]
}
```
