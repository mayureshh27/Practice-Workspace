export type Problem={
  id:string;
  number:number;
  title:string;
  chapter:string;
  difficulty:string;
  tags:string[];
  statement:string;
  problemText?:string;
  explanation:string;
  howItWorks?:string;
  syntax?:string;
  solve?:string;
  lessonTitle?:string;
  lesson?:string;
  approach?:string;
  pitfalls?:string[];
  hints:string[];
  starterCode:string;
  solutionCode:string;
  exerciseMode?:string;
  verifier?:string;
  examples:{input:string;output:string}[];
}

export type Store={chapters:{id:string;title:string}[];problems:Problem[]}
export type FlowTab='explanation'|'how'|'syntax'|'problem'|'solve'
export type Theme='light'|'dark'
export type RunMode='run'|'submit'
export type ProblemFilterMode='all'|'judge'|'project'
export type RunResp={verdict:string;output:string;error?:string;durationMs:number}
export type UploadedFile={name:string;text:string}

export type LessonSection={
  id:string;
  title:string;
  body:string;
}

export type OutputComparison={
  title:string;
  expected:string;
  actual:string;
  status:'match'|'mismatch';
  diff?:{
    line:number;
    expected:string;
    actual:string;
  }|null;
}
