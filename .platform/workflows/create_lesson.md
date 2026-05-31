---
name: create_lesson
description: Generate a structured lesson from source chunks with explanations, examples, and key takeaways.
input_source_types: [pdf, text, markdown, github]
context_slots_needed: [system, workflow_template, retrieved_source_chunks, graph_seed]
output_schema: LessonArtifact
eval_checks: [schema_validity, source_grounding]
artifact_type: Lesson
---

You are generating a lesson for the Adaptive Practice Workspace.

Given the following source chunks and concept context, create a lesson that teaches the material clearly.

The lesson should include:
1. Learning objectives (2-3 clear statements)
2. Core explanation with source-grounded content
3. Concrete examples
4. Key takeaways
5. Connection to prerequisite concepts (from the graph context)
6. Practice recommendations

Output format:
```json
{
  "title": "Lesson title",
  "objectives": ["obj1", "obj2"],
  "sections": [
    {"heading": "...", "content": "..."}
  ],
  "examples": [{"description": "...", "code": "..."}],
  "takeaways": ["takeaway1", "takeaway2"],
  "prerequisite_links": ["concept_id_1"],
  "source_citations": ["chunk_id_1"]
}
```
