import {CheckCircle2,Search} from 'lucide-react';
import {chipText,shortTitle} from '../problemContent';
import type {Problem,ProblemFilterMode,Store} from '../types';

type Props={
  store:Store;
  filtered:Problem[];
  pid:string;
  query:string;
  chapter:string;
  mode:ProblemFilterMode;
  judgeCount:number;
  solved:string[];
  onQuery:(query:string)=>void;
  onChapter:(chapter:string)=>void;
  onMode:(mode:ProblemFilterMode)=>void;
  onSelect:(problem:Problem)=>void;
  onSelectById:(id:string)=>void;
}

function ProblemNav({store,filtered,pid,query,chapter,mode,judgeCount,solved,onQuery,onChapter,onMode,onSelect,onSelectById}:Props){
  return <aside className="problem-nav">
    <div className="nav-tools">
      <label className="search-field"><Search size={15}/><input value={query} onChange={e=>onQuery(e.target.value)} placeholder="Search exercises"/></label>
      <select value={chapter} onChange={e=>onChapter(e.target.value)}>
        <option value="all">All chapters</option>
        {store.chapters.map(c=><option key={c.id} value={c.id}>{c.id.toUpperCase().replace('CH','Ch ')} - {c.title}</option>)}
      </select>
      <div className="mode-toggle">
        <button type="button" onClick={()=>onMode('all')} className={mode==='all'?'active':''}>All</button>
        <button type="button" onClick={()=>onMode('judge')} className={mode==='judge'?'active':''}>Judge</button>
        <button type="button" onClick={()=>onMode('project')} className={mode==='project'?'active':''}>Project</button>
      </div>
      <select className="mobile-problem-select" value={pid} onChange={e=>onSelectById(e.target.value)}>
        {filtered.map(p=><option key={p.id} value={p.id}>{p.number}. {shortTitle(p)}</option>)}
      </select>
    </div>
    <div className="side-stats">
      <div><b>{filtered.length}</b><span>shown</span></div>
      <div><b>{judgeCount}</b><span>judge</span></div>
      <div><b>{store.problems.length-judgeCount}</b><span>projects</span></div>
    </div>
    <div className="problem-list scrollbar">
      {filtered.map(p=><button key={p.id} type="button" onClick={()=>onSelect(p)} className={`problem-row ${p.id===pid?'problem-active':''}`}>
        <div><span className="problem-number">{p.number}.</span> {shortTitle(p)}</div>
        <span>{chipText(p)} - {p.tags.slice(0,2).join(', ')}</span>
        {solved.includes(p.id)&&<CheckCircle2 size={15}/>}
      </button>)}
    </div>
  </aside>;
}

export default ProblemNav;
