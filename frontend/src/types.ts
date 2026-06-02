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

/* ── Workspace appearance settings ───────────────────────────────── */

export type BaseColor='neutral'|'stone'|'zinc'|'mauve'|'olive'|'mist'|'taupe'
export type RadiusScale='none'|'sm'|'default'|'lg'|'full'
export type FontOption='inter'|'ibm-plex'|'geist'

export const BASE_COLOR_LABELS:Record<BaseColor,string>={
  neutral:'Neutral',
  stone:'Stone',
  zinc:'Zinc',
  mauve:'Mauve',
  olive:'Olive',
  mist:'Mist',
  taupe:'Taupe',
}

export const RADIUS_LABELS:Record<RadiusScale,string>={
  none:'None',
  sm:'Small',
  default:'Default',
  lg:'Large',
  full:'Full',
}

export const FONT_LABELS:Record<FontOption,string>={
  'inter':'Inter',
  'ibm-plex':'IBM Plex Sans',
  'geist':'Geist',
}
