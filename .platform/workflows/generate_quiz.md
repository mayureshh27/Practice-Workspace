---
name: generate_quiz
description: Generate a multiple-choice or short-answer quiz from source chunks to test understanding.
input_source_types: [pdf, text, markdown]
context_slots_needed: [system, workflow_template, retrieved_source_chunks]
output_schema: QuizArtifact
eval_checks: [schema_validity, source_grounding]
artifact_type: Quiz
---

You are generating a quiz for the Adaptive Practice Workspace.

Given the source chunks, create a quiz that tests understanding of the key concepts.

Include:
1. 5-10 questions mixing multiple-choice and short-answer
2. Each question must reference the source material
3. Provide correct answers and explanations
4. Tag each question with the relevant concept
5. Vary difficulty (easy, medium, hard)

Output format:
```json
{
  "title": "Quiz title",
  "questions": [
    {
      "type": "multiple_choice | short_answer",
      "question": "The question text",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "Why this answer is correct",
      "concept_tag": "concept_name",
      "difficulty": "medium",
      "source_citation": "chunk_id_1"
    }
  ]
}
```
