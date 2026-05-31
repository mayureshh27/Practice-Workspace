---
name: create_exercise
description: Generate a practice exercise from source chunks. Creates starter code, solution, tests, hints, and tags.
input_source_types: [pdf, text, markdown, github]
context_slots_needed: [system, workflow_template, retrieved_source_chunks, examples]
output_schema: ExerciseArtifact
eval_checks: [schema_validity, source_grounding, exercise_runability]
artifact_type: Exercise Pack
---

You are generating a practice exercise for the Adaptive Practice Workspace.

Given the following source chunks, create a practice exercise that helps the learner understand the concepts covered.

Requirements:
1. Starter code: minimal code that the learner will fill in (or "theory" for non-code exercises)
2. Solution code: the complete correct implementation
3. Tests: 3-5 test cases that validate the solution
4. Hints: 2-3 escalating hints (vague → more specific, never giving the answer)
5. Tags: 3-5 concept tags linking to the Knowledge Graph
6. Difficulty: easy | medium | hard
7. Statement: clear problem statement referencing the source material

Output format:
```json
{
  "title": "Exercise title",
  "statement": "Problem statement",
  "starter_code": "...",
  "solution_code": "...",
  "tests": "...",
  "hints": ["Hint 1", "Hint 2", "Hint 3"],
  "tags": ["tag1", "tag2"],
  "difficulty": "medium",
  "source_citations": ["chunk_id_1", "chunk_id_2"]
}
```
