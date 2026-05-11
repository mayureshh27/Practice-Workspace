import {useEffect,useMemo,useState} from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {BookOpen, CheckCircle2, GraduationCap, Play, Search, Send} from 'lucide-react';
import './index.css';

type Problem={id:string;number:number;title:string;chapter:string;difficulty:string;tags:string[];statement:string;explanation:string;lessonTitle?:string;lesson?:string;approach?:string;pitfalls?:string[];hints:string[];starterCode:string;solutionCode:string;exerciseMode?:string;verifier?:string;examples:{input:string;output:string}[]}
type Store={chapters:{id:string;title:string}[];problems:Problem[]}
const API=import.meta.env.VITE_API_URL||'http://localhost:8080';

function md(text:string){return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>}
function chipText(p:Problem){return p.exerciseMode==='judge'?'Judge':'Project'}

function App(){
  const [store,setStore]=useState<Store>({chapters:[],problems:[]});
  const [pid,setPid]=useState(''); const [query,setQuery]=useState(''); const [chapter,setChapter]=useState('all'); const [mode,setMode]=useState('all');
  const [code,setCode]=useState(''); const [out,setOut]=useState(''); const [verdict,setVerdict]=useState(''); const [tab,setTab]=useState<'study'|'problem'|'solution'>('study');
  const [solved,setSolved]=useState<string[]>(()=>JSON.parse(localStorage.getItem('solved')||'[]'));
  useEffect(()=>{fetch(API+'/api/problems').then(r=>r.json()).then(s=>{setStore(s); setPid(s.problems[0]?.id||''); setCode(s.problems[0]?.starterCode||'')})},[]);
  const problem=store.problems.find(p=>p.id===pid);
  const progress=Math.round((solved.length/Math.max(store.problems.length,1))*100);
  const judgeCount=store.problems.filter(p=>p.exerciseMode==='judge').length;
  const filtered=useMemo(()=>store.problems.filter(p=>(chapter==='all'||p.chapter===chapter)&&(mode==='all'||p.exerciseMode===mode)&&((p.title+p.tags.join(' ')+p.statement+(p.lesson||'')).toLowerCase().includes(query.toLowerCase()))),[store,query,chapter,mode]);
  function select(p:Problem){setPid(p.id); setCode(localStorage.getItem('draft:'+p.id)||p.starterCode); setOut(''); setVerdict(''); setTab('study')}
  function saveDraft(v:string|undefined){const c=v||''; setCode(c); if(problem)localStorage.setItem('draft:'+problem.id,c)}
  async function run(mode:string){setVerdict('Running...'); setOut(''); const r=await fetch(API+'/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({problemId:pid,code,mode})}); const j=await r.json(); const body=(j.error?`### Error\n\n\`\`\`text\n${j.error}\n\`\`\`\n\n`:'')+`### Output\n\n\`\`\`text\n${j.output}\n\`\`\`\n\n**Time:** ${j.durationMs}ms`; setVerdict(j.verdict); setOut(body); if(mode==='submit'&&j.verdict==='Accepted'&&problem){const ns=[...new Set([...solved,problem.id])]; setSolved(ns); localStorage.setItem('solved',JSON.stringify(ns))}}
  return <div className="min-h-screen app-shell">
    <header className="glass sticky top-0 z-20 px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3"><div className="go-logo-wrap"><img src="/go-logo.svg" alt="Go" /></div><div><h1 className="text-xl font-semibold tracking-[-.03em]">PracDaGo</h1><p className="text-xs muted">book-first Go practice</p></div></div>
      <div className="hidden md:flex items-center gap-3 text-sm muted"><span>{judgeCount} judgeable</span><span>·</span><span>{solved.length}/{store.problems.length} solved</span><div className="w-36 h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full progressbar" style={{width:progress+'%'}}/></div><span>{progress}%</span></div>
    </header>
    <div className="grid grid-cols-[320px_1fr] gap-3 p-3">
      <aside className="panel p-3 h-[calc(100vh-76px)] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 surface px-3 mb-2"><Search size={15} className="muted"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search" className="bg-transparent outline-none py-2.5 w-full text-sm"/></div>
        <select value={chapter} onChange={e=>setChapter(e.target.value)} className="w-full surface p-2.5 mb-2 outline-none text-sm"><option value="all">All chapters</option>{store.chapters.map(c=><option key={c.id} value={c.id}>{c.id.toUpperCase().replace('CH','Ch ')} · {c.title}</option>)}</select>
        <div className="grid grid-cols-3 gap-1 mb-3"><button onClick={()=>setMode('all')} className={`mini ${mode==='all'?'active':''}`}>All</button><button onClick={()=>setMode('judge')} className={`mini ${mode==='judge'?'active':''}`}>Judge</button><button onClick={()=>setMode('project')} className={`mini ${mode==='project'?'active':''}`}>Project</button></div>
        <div className="side-stats"><div><b>{filtered.length}</b><span>shown</span></div><div><b>{judgeCount}</b><span>judge</span></div><div><b>{store.problems.length-judgeCount}</b><span>projects</span></div></div>
        <div className="space-y-1.5 overflow-auto scrollbar pr-1">{filtered.map(p=><button key={p.id} onClick={()=>select(p)} className={`problem-row ${p.id===pid?'problem-active':'bg-white/[.018] hover:bg-white/[.045]'}`}><div className="flex justify-between gap-2"><span className="truncate"><span className="muted">{p.number}.</span> {p.title.replace(/^Exercise \d+\.\d+: /,'')}</span>{solved.includes(p.id)&&<CheckCircle2 size={15} className="text-emerald-400 shrink-0"/>}</div><div className="text-[11px] opacity-60 mt-1 truncate">{chipText(p)} · {p.tags.slice(0,2).join(', ')}</div></button>)}</div>
      </aside>
      <main className="grid grid-cols-[minmax(430px,0.95fr)_minmax(520px,1.05fr)] gap-3 h-[calc(100vh-76px)]">{problem&&<>
        <section className="panel overflow-hidden flex flex-col"><div className="px-5 py-4 border-b border-white/[.06]"><div className="flex items-center gap-2 muted text-sm"><BookOpen size={16}/>Exercise workspace</div><h2 className="text-2xl font-semibold tracking-[-.04em] mt-2">{problem.title}</h2><div className="flex flex-wrap gap-1.5 mt-3"><span className="chip">{problem.exerciseMode==='judge'?'Local judge':'Project-style'}</span>{problem.tags.slice(0,4).map(t=><span className="chip" key={t}>{t}</span>)}</div><div className="flex gap-1.5 mt-3"><button className={`tab ${tab==='study'?'active':''}`} onClick={()=>setTab('study')}><GraduationCap size={14} className="inline mr-1"/> Study</button><button className={`tab ${tab==='problem'?'active':''}`} onClick={()=>setTab('problem')}>Problem</button><button className={`tab ${tab==='solution'?'active':''}`} onClick={()=>setTab('solution')}>Explain</button></div></div>
          <div className="p-5 overflow-auto scrollbar prose markdown-body">{tab==='study'&&<>{md(`### ${problem.lessonTitle}\n\n${problem.lesson||''}\n\n### How to attack this\n\n${problem.approach||''}\n\n### Common traps\n\n${(problem.pitfalls||[]).map(x=>`- ${x}`).join('\n')}`)}</>}{tab==='problem'&&<>{md(`### Task\n\n${problem.statement}\n\n### Examples\n\n${problem.examples.map(e=>`\`\`\`text\nInput: ${e.input}\nOutput: ${e.output}\n\`\`\``).join('\n\n')}\n\n### Hints\n\n${problem.hints.map(h=>`- ${h}`).join('\n')}`)}</>}{tab==='solution'&&<>{md(`### Detailed explanation\n\n${problem.explanation}\n\n### Reference solution\n\n\`\`\`go\n${problem.solutionCode}\n\`\`\``)}</>}</div></section>
        <section className="panel overflow-hidden flex flex-col"><div className="p-3 flex gap-2 justify-between border-b border-white/[.06]"><div><div className="font-medium">Go editor</div><div className="text-xs muted">Drafts save locally</div></div><div className="flex gap-2"><button className="btn2" onClick={()=>run('run')}><Play size={15} className="inline"/> Run</button><button className="btn" onClick={()=>run('submit')}><Send size={15} className="inline"/> Submit</button></div></div><div className="flex-1"><Editor height="100%" defaultLanguage="go" theme="vs-dark" value={code} onChange={saveDraft} options={{fontSize:14,fontFamily:'JetBrains Mono, monospace',minimap:{enabled:false},scrollBeyondLastLine:false,renderLineHighlight:'all',padding:{top:16}}}/></div><div className="h-52 border-t border-white/[.06] p-3 overflow-auto bg-black/70 markdown-body output"><div className={`verdict ${verdict==='Accepted'?'ok':verdict==='Error'?'bad':''}`}>{verdict||'Output'}</div>{out?md(out):md("Run code to see formatted output. Project-style tasks use Run mode plus the study guide's reproducible proof.")}</div></section>
      </>}</main>
    </div>
  </div>
}
export default App
