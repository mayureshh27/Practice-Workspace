import fs from 'node:fs';

const file = 'data/problems.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const chapters = Object.fromEntries(data.chapters.map((chapter) => [chapter.id, chapter]));

const tagInsights = {
  alignment: 'Alignment is about placing sizes on predictable boundaries. Think in remainders: if the value is already on a boundary, keep it; otherwise add the gap to the next boundary.',
  args: 'Command-line arguments are just ordered strings. Keep the ordering explicit and treat the program name, flags, and user values as data that can be inspected and transformed.',
  arrays: 'Arrays have fixed length as part of their type. They are useful when the size is part of the idea, but slices are usually the flexible working view.',
  basic: 'The important move is to make the simple value transformation completely explicit before adding any surrounding program structure.',
  benchmark: 'Benchmarking is only meaningful when two implementations do the same work over the same input. Keep the comparison small, repeatable, and easy to rerun.',
  bits: 'Bit problems become easier when you name the mask, shift, or population-count operation you need before writing the expression.',
  channel: 'Channels communicate values and also communicate timing. Ask which goroutine owns sending, which owns receiving, and how the receiver learns that work is done.',
  channels: 'Channels communicate values and also communicate timing. Ask which goroutine owns sending, which owns receiving, and how the receiver learns that work is done.',
  cli: 'A command-line program is easiest to test when argument parsing is kept at the edge and the core behavior is a plain function.',
  composite: 'Composite values are built from smaller values. Decide which field, index, or key carries each piece of meaning before writing loops.',
  constants: 'Constants describe ideas, not storage locations. Use them to give names to stable values and let Go keep the numeric precision until a concrete type is required.',
  defaults: 'Defaults are boundary decisions. Convert raw input once, reject or replace bad values there, and keep the rest of the code working with clean data.',
  defer: 'Defer is for cleanup tied to a successful acquisition. Place it immediately after open/lock/start so the lifetime is visible.',
  echo: 'Echo-style problems are about preserving or reshaping order. Build the output from left to right so the code mirrors what the user sees.',
  file: 'File work has a boundary: open/read/scan at the edge, then pass ordinary strings, bytes, or lines into the core logic.',
  files: 'File work has a boundary: open/read/scan at the edge, then pass ordinary strings, bytes, or lines into the core logic.',
  formatting: 'Formatting mixes data with presentation. Use formatting helpers when the output has a precise shape, and keep the raw values available until the final step.',
  functions: 'A function is a contract: inputs in, result out, with as little hidden state as possible. Read the signature as the first clue.',
  goroutine: 'A goroutine is independent work. Make its lifetime and result path visible so it cannot leak or silently fail.',
  goroutines: 'A goroutine is independent work. Make its lifetime and result path visible so it cannot leak or silently fail.',
  graphs: 'Graph-shaped data needs an explicit visited set or frontier. Decide how you avoid repeating nodes before you traverse.',
  html: 'HTML tasks are tree or token-stream tasks. Separate traversal from the decision about which nodes matter.',
  http: 'HTTP code has two halves: constructing the request and interpreting the response. Keep errors, status, headers, and body handling distinct.',
  interface: 'Interfaces describe required behavior. Name the method set you need, then let concrete types satisfy it without ceremony.',
  interfaces: 'Interfaces describe required behavior. Name the method set you need, then let concrete types satisfy it without ceremony.',
  iota: 'iota is a compact counter for related constants. It is clearest when the constant block represents one scale, enum, or bit family.',
  join: 'Joining avoids repeated string growth. Prepare the pieces first, then let strings.Join create the final text in one pass.',
  json: 'JSON work is about mapping between Go fields and encoded names. Make the struct shape and tags tell the story.',
  lissajous: 'Image and animation exercises are about the relationship between a formula, a palette, and visible output. Change one of those at a time.',
  map: 'Maps are for lookup, grouping, counting, and deduplication. Decide what the key means and what invariant each value should maintain.',
  maps: 'Maps are for lookup, grouping, counting, and deduplication. Decide what the key means and what invariant each value should maintain.',
  memoization: 'Memoization trades memory for repeated work. The cache key must represent exactly the inputs that affect the result.',
  memory: 'Memory-layout problems ask what Go stores, not what the code visually resembles. Think in size, alignment, padding, and representation.',
  methods: 'Methods attach behavior to a type. Choose value receivers for copy-like behavior and pointer receivers when mutation or avoiding copies matters.',
  mutex: 'A mutex protects an invariant. Keep the locked section small, and make every read or write of the protected state follow the same rule.',
  packages: 'Packages draw boundaries. A good package exposes the vocabulary callers need while hiding the details they should not depend on.',
  panic: 'Panic is for exceptional control flow, not routine errors. When using recover, keep the boundary narrow and intentional.',
  program: 'Program-shaped exercises are still easier when the real behavior is a small function and main only wires inputs and outputs.',
  reader: 'Readers stream bytes in chunks. Code that uses an io.Reader should work even when data arrives in small pieces.',
  reflect: 'Reflection is for code that must inspect values whose concrete type is not known at compile time. Always check Kind before assuming operations are valid.',
  reflection: 'Reflection is for code that must inspect values whose concrete type is not known at compile time. Always check Kind before assuming operations are valid.',
  runes: 'Runes represent Unicode code points. Use them when the task is about characters rather than raw bytes.',
  server: 'Server code should keep handler state explicit. Parse the request, call focused logic, then write one clear response.',
  sets: 'A set is usually a map whose values are unimportant. The key carries membership, and existence is the operation you care about.',
  shared: 'Shared state needs one owner or one synchronization rule. If two goroutines can touch it, decide how the invariant is protected.',
  slice: 'Slices are views over arrays. Track length, capacity, and whether two slices might share the same backing array.',
  slices: 'Slices are views over arrays. Track length, capacity, and whether two slices might share the same backing array.',
  sort: 'Sorting requires a comparison rule. Make that rule match the domain, then let the sort package handle ordering mechanics.',
  state: 'Stateful code is safest when transitions are explicit. Name what changes, when it changes, and what should remain true afterward.',
  strconv: 'String conversion is boundary work. Convert once near the input, handle the error there, and keep the rest of the program typed.',
  strings: 'Strings are immutable byte sequences. Decide whether the task is about bytes, runes, words, prefixes, or joined pieces before choosing helpers.',
  structs: 'Structs give names to related fields. Use those names to make illegal or confusing data shapes harder to create.',
  temperature: 'Unit conversion is a formula plus a type choice. Keep the arithmetic direct and make rounding expectations explicit.',
  test: 'Tests are executable examples. They are strongest when the input, expected output, and edge case each communicate one idea.',
  testing: 'Tests are executable examples. They are strongest when the input, expected output, and edge case each communicate one idea.',
  time: 'Time code is easier when durations, deadlines, and timestamps are kept as separate ideas.',
  tutorial: 'Tutorial exercises reward small edits. Preserve the original shape, change one behavior, run it, then observe the difference.',
  types: 'Types give meaning to values. In Go, conversions are explicit, so decide where a value changes meaning.',
  unicode: 'Unicode tasks need clarity about bytes, runes, and categories. Pick the level that matches the user-visible behavior.',
  unsafe: 'Unsafe code bypasses Go safety. Use it only when the representation question is the point, and keep the unsafe boundary tiny.',
  variadic: 'Variadic functions receive zero or more values as a slice. They are useful when callers should not have to build the slice themselves.',
  writer: 'Writers consume bytes and report how much was accepted. Treat errors from Write as part of the result, not as background noise.',
  xml: 'XML tasks are stream or tree tasks. Keep element names, attributes, nesting, and text handling as separate decisions.',
};

function clean(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function exerciseName(problem) {
  return problem.sourceExercise || String(problem.title).match(/Exercise\s+([^:]+)/)?.[1] || String(problem.number);
}

function shortTitle(problem) {
  return String(problem.title).replace(/^Exercise\s+\d+\.\d+:\s*/, '').trim();
}

function signature(problem) {
  const match = String(problem.starterCode || '').match(/func\s+Solve\s*\([^)]*\)\s*[^{\n]*/);
  return match ? match[0].trim() : 'func Solve() string';
}

function topicPhrase(problem) {
  return (problem.tags || []).slice(0, 4).join(', ') || 'Go fundamentals';
}

function insightLines(problem) {
  const seen = new Set();
  const lines = [];
  for (const tag of problem.tags || []) {
    const insight = tagInsights[tag];
    if (insight && !seen.has(insight)) {
      seen.add(insight);
      lines.push(`- ${insight}`);
    }
    if (lines.length >= 5) break;
  }
  if (lines.length === 0) {
    lines.push('- Start by naming the input shape, the output shape, and the one transformation that connects them.');
    lines.push('- Keep side effects at the boundary and make the central logic easy to call from tests.');
  }
  return lines;
}

function examples(problem) {
  const items = problem.examples || [];
  if (items.length === 0) {
    return 'There is no fixed sample in the catalog for this one, so create a tiny input that exercises the main behavior before you scale up.';
  }
  return items.slice(0, 2).map((example) => `- Input: ${clean(example.input)}\n  Output: ${clean(example.output)}`).join('\n');
}

function explanation(problem) {
  const chapter = chapters[problem.chapter]?.title || 'this chapter';
  const ex = exerciseName(problem);
  const task = clean(problem.problemText || problem.statement);
  const modeText = problem.exerciseMode === 'judge'
    ? 'Because this one is judgeable, the app can check a focused `Solve` function. That is a gift: you can ignore command-line plumbing for a moment and concentrate on the exact value transformation.'
    : 'Because this one is a project exercise, there may not be one hidden-test answer. The win is a small reproducible program plus proof that the observed behavior matches the goal.';

  return [
    `### What you are learning`,
    `Exercise ${ex}, **${shortTitle(problem)}**, is a practice rep for ${topicPhrase(problem)} in ${chapter}. The surface task is: ${task}`,
    `The deeper lesson is learning how to turn a paragraph-sized programming request into a small Go-shaped decision. Before typing code, slow down and ask: What are the inputs? What should come out? Which part is pure transformation, and which part is just I/O, formatting, or demonstration? That question is the difference between guessing at code and designing a solution you can explain.`,
    `### Intuition`,
    `Think of the problem as a pipeline. Something enters the left side, your code applies one clear rule, and a result leaves the right side. If the exercise mentions files, HTTP, command-line arguments, reflection, or concurrency, those are still just boundaries around the core idea. The trick is to keep the boundary visible instead of letting it blur the actual operation.`,
    modeText,
    `### Go mental model`,
    ...insightLines(problem),
    `### Tiny check`,
    examples(problem),
    `Use the tiny check before chasing a complete solution. If you cannot predict the output for a small input by hand, the code will feel mysterious. Once the hand prediction is clear, the implementation usually becomes a direct translation: choose the right data shape, loop or call the helper that matches the shape, and return the result without extra cleverness.`,
    `### What mastery feels like`,
    `You understand this exercise when you can explain why each variable exists, what invariant is maintained while the code runs, and which edge case would break a sloppy solution. Do not just aim for green tests; aim for the moment where the code reads like the problem statement in Go form.`,
  ].join('\n\n');
}

function howItWorks(problem) {
  const task = clean(problem.problemText || problem.statement);
  const modePlan = problem.exerciseMode === 'judge'
    ? [
        '4. Return exactly the type promised by the `Solve` signature. Avoid printing from `Solve` unless the signature or task explicitly asks for output text.',
        '5. Let the local tests cover normal and edge cases after your hand-check makes sense.',
      ]
    : [
        '4. Build the smallest runnable demonstration that shows the behavior. For project exercises, the proof matters as much as the code.',
        '5. Record the command, input, and observed output so you can tell whether later edits changed the behavior.',
      ];

  return [
    `### How it works`,
    `The target behavior is: ${task}`,
    `A good solution usually has this flow:`,
    `1. Normalize the input into a shape that is easy to reason about.`,
    `2. Apply one clear rule repeatedly or directly, depending on the task.`,
    `3. Keep intermediate names honest so the code explains what each value means.`,
    ...modePlan,
    `### Why this approach works`,
    ...insightLines(problem),
    `### Debugging lens`,
    `If the answer is wrong, do not randomly rearrange code. Print or inspect the value after each stage of the flow: input shape, transformed shape, final result. Most mistakes in these exercises come from using the right tool at the wrong boundary, or from mixing representation details with the core rule.`,
  ].join('\n\n');
}

function syntax(problem) {
  const sig = signature(problem);
  const imports = Array.from(String(problem.starterCode || '').matchAll(/import\s+(?:\(([^)]*)\)|"([^"]+)")/g))
    .map((match) => clean(match[0]))
    .slice(0, 2);
  const importText = imports.length ? imports.map((item) => `- ${item}`).join('\n') : '- No import is required by the starter code unless your implementation chooses a helper package.';
  const modeNote = problem.exerciseMode === 'judge'
    ? '- Keep this exact function name and compatible parameters. The backend judge calls it directly.'
    : '- For a project entry, you may keep this shape as a helper, but you can also add a small `main` when you need a runnable proof.';

  return [
    `### Syntax you need`,
    'Core shape:',
    '```go',
    sig,
    '```',
    modeNote,
    `### Imports`,
    importText,
    `### Patterns to reach for`,
    ...insightLines(problem),
    `### Read the signature out loud`,
    `The parameters are the only facts your function gets for free. The return type is the promise your function must keep. When you get stuck, read the signature as a sentence and ask what value would satisfy that promise for the smallest sample input.`,
  ].join('\n');
}

function solve(problem) {
  const ex = exerciseName(problem);
  const sig = signature(problem);
  const projectSteps = [
    '1. Rephrase the task in one sentence using your own words.',
    '2. Start with the smallest runnable version, even if it only handles one tiny case.',
    '3. Run it and write down the command or input you used.',
    '4. Expand the implementation until it demonstrates the full behavior.',
    '5. Keep the proof: command, sample input or file, observed output, and one note explaining why it satisfies the exercise.',
  ];
  const judgeSteps = [
    '1. Rephrase the task in one sentence using your own words.',
    `2. Keep the core function compatible with \`${sig}\`.`,
    '3. Work from the smallest sample input first. Predict the output by hand.',
    '4. Implement the direct transformation. Prefer clear names and boring control flow.',
    '5. Run once for feedback, then Submit when the examples and edge cases make sense.',
  ];
  const steps = problem.exerciseMode === 'judge' ? judgeSteps : projectSteps;

  return [
    `### Solve path for exercise ${ex}`,
    ...steps,
    `### Self-check before calling it done`,
    `- Can you point to the line where the main idea happens?`,
    `- Can you explain what happens for an empty, tiny, or boundary-shaped input?`,
    `- Did you keep I/O or demonstration code separate from the value transformation where possible?`,
    `- If you came back tomorrow, would the variable names remind you of the problem rather than the mechanics?`,
  ].join('\n');
}

for (const problem of data.problems) {
  const expandedExplanation = explanation(problem);
  const expandedHow = howItWorks(problem);
  const expandedSyntax = syntax(problem);
  const expandedSolve = solve(problem);

  problem.lessonTitle = 'Intuitive Explanation';
  problem.explanation = expandedExplanation;
  problem.lesson = expandedExplanation;
  problem.howItWorks = expandedHow;
  problem.syntax = expandedSyntax;
  problem.approach = expandedSolve;
  problem.solve = expandedSolve;
}

fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Expanded learning content for ${data.problems.length} exercises.`);
