import type {FlowTab,LessonSection,OutputComparison,Problem,RunMode,RunResp} from './types';

export const API=import.meta.env.VITE_API_URL||'http://localhost:8000';

export const flowTabs:{id:FlowTab;label:string}[]=[
  {id:'explanation',label:'Explanation'},
  {id:'how',label:'How it works'},
  {id:'syntax',label:"What's the syntax"},
  {id:'problem',label:'Problem'},
  {id:'solve',label:'Solve'},
];

export function canSubmit(p:Problem){
  return p.exerciseMode==='judge'&&p.verifier==='local-tests';
}

export function chipText(p:Problem){
  return p.exerciseMode==='judge'?'Judge':'Project';
}

export function shortTitle(p:Problem){
  return p.title.replace(/^Exercise \d+\.\d+: /,'');
}

export function problemNeedsFiles(p:Problem){
  return p.tags.includes('file')||/file|stdin|read/i.test(p.statement);
}

export function flowContent(p:Problem,tab:FlowTab){
  if(tab==='explanation') return `### Explanation\n\n${p.explanation}`;
  if(tab==='how') return `### How it works\n\n${p.howItWorks||p.lesson||''}`;
  if(tab==='syntax') return `### What's the syntax\n\n${p.syntax||p.lesson||p.approach||p.statement}`;
  if(tab==='problem') return `### Problem\n\n${p.problemText||p.statement}\n\n### Examples\n\n${p.examples.map(e=>`\`\`\`text\nInput: ${e.input}\nOutput: ${e.output}\n\`\`\``).join('\n\n')}\n\n### Hints\n\n${p.hints.map(h=>`- ${h}`).join('\n')}`;

  const reference=canSubmit(p)&&p.solutionCode?`\n\n### Reference solution\n\n\`\`\`go\n${p.solutionCode}\n\`\`\``:'';
  const guidance=!canSubmit(p)&&p.solutionCode?`\n\n### Project guidance\n\n${p.solutionCode}`:'';
  const completion=!canSubmit(p)?'\n\n### Completion\n\nUse Run mode or your local terminal to produce the proof requested by the exercise, then use the manual completion button in the editor panel.':'';
  return `### Solve\n\n${p.solve||p.approach||''}${reference}${guidance}${completion}`;
}

export function splitLessonSections(markdown:string):LessonSection[]{
  const sections:{title:string;lines:string[]}[]=[];
  let current:{title:string;lines:string[]}|null=null;

  for(const line of markdown.split('\n')){
    const heading=line.match(/^###\s+(.+?)\s*$/);
    if(heading){
      if(current) sections.push(current);
      current={title:heading[1],lines:[]};
    }else if(current){
      current.lines.push(line);
    }else if(line.trim()){
      current={title:'Overview',lines:[line]};
    }
  }

  if(current) sections.push(current);

  const seen=new Map<string,number>();
  return sections.map((section,index)=>{
    const base=slug(section.title)||`section-${index+1}`;
    const count=seen.get(base)||0;
    seen.set(base,count+1);
    return {
      id:count?`${base}-${count+1}`:base,
      title:section.title,
      body:section.lines.join('\n').trim(),
    };
  });
}

export function buildRunMarkdown(j:RunResp){
  return `${j.error?`### Error\n\n\`\`\`text\n${j.error}\n\`\`\`\n\n`:''}### Output\n\n\`\`\`text\n${j.output}\n\`\`\`\n\n**Time:** ${j.durationMs}ms`;
}

export function buildOutputComparison(problem:Problem,mode:RunMode,response:RunResp):OutputComparison|null{
  if(!canSubmit(problem)) return null;

  const assertion=parseAssertionMismatch(response.error);
  if(assertion){
    return {
      title:'Failing local test',
      expected:assertion.expected,
      actual:assertion.actual,
      status:'mismatch',
      diff:firstDifference(assertion.expected,assertion.actual),
    };
  }

  if(mode==='run'&&problem.examples[0]){
    const expected=problem.examples[0].output;
    const actual=response.output.trim();
    const status=normalizeOutput(expected)===normalizeOutput(actual)?'match':'mismatch';
    return {
      title:'First example output',
      expected,
      actual:actual||'(no output)',
      status,
      diff:status==='mismatch'?firstDifference(expected,actual):null,
    };
  }

  if(mode==='submit'&&response.verdict==='Accepted'){
    return {
      title:'Local judge result',
      expected:'All local tests pass.',
      actual:response.output.trim()||'All tests passed.',
      status:'match',
      diff:null,
    };
  }

  return null;
}

function parseAssertionMismatch(error?:string){
  if(!error) return null;
  const match=error.match(/got ([\s\S]*?), want ([^\n]+)/);
  if(!match) return null;
  return {actual:match[1].trim(),expected:match[2].trim()};
}

function firstDifference(expected:string,actual:string){
  const expectedLines=normalizeLines(expected);
  const actualLines=normalizeLines(actual);
  const count=Math.max(expectedLines.length,actualLines.length);

  for(let i=0;i<count;i++){
    if((expectedLines[i]||'')!==(actualLines[i]||'')){
      return {
        line:i+1,
        expected:expectedLines[i]||'(missing)',
        actual:actualLines[i]||'(missing)',
      };
    }
  }

  return null;
}

function normalizeOutput(value:string){
  return normalizeLines(value).join('\n').trim();
}

function normalizeLines(value:string){
  return value.replace(/\r\n/g,'\n').trim().split('\n');
}

function slug(value:string){
  return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
